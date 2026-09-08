import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sensors_plus/sensors_plus.dart';

import '../models/user_model.dart';
import 'api_service.dart';
import 'notification_service.dart';

const _backgroundSafetyConfigKey = 'safesolo_background_safety_config_v1';

bool _automationEnabled(Map<String, dynamic> automation) {
  return _boolish(automation['geofenceAutoCheckin']) ||
      _boolish(automation['fallDetection']) ||
      _boolish(automation['shakeSos']);
}

bool _boolish(Object? value) {
  if (value is bool) {
    return value;
  }
  if (value is String) {
    return value.toLowerCase() == 'true';
  }
  if (value is num) {
    return value != 0;
  }
  return false;
}

bool _boolishOrDefault(Object? value, bool defaultValue) {
  if (value == null) {
    return defaultValue;
  }
  return _boolish(value);
}

class BackgroundSafetyService {
  BackgroundSafetyService._();

  static final BackgroundSafetyService instance = BackgroundSafetyService._();

  final FlutterBackgroundService _service = FlutterBackgroundService();
  bool _configured = false;

  bool get _isSupportedPlatform =>
      !kIsWeb && (Platform.isAndroid || Platform.isIOS);

  Future<void> prepare({bool hasLocationPermission = false}) async {
    if (!_isSupportedPlatform) {
      return;
    }
    if (_configured) {
      return;
    }
    try {
      await _service.configure(
        androidConfiguration: AndroidConfiguration(
          onStart: _onStart,
          autoStart: false,
          isForegroundMode: true,
          notificationChannelId: 'safesolo_background_safety',
          initialNotificationTitle: 'SafeSolo đang bảo vệ nền',
          initialNotificationContent: 'Đang theo dõi geofence và tín hiệu an toàn',
          foregroundServiceNotificationId: 9071,
          foregroundServiceTypes: [
            AndroidForegroundType.dataSync,
            if (hasLocationPermission) AndroidForegroundType.location,
          ],
        ),
        iosConfiguration: IosConfiguration(
          autoStart: false,
          onForeground: _onIosForeground,
          onBackground: _onIosBackground,
        ),
      );
      _configured = true;
    } catch (_) {}
  }

  Future<void> updateFromState({
    required String? userId,
    required bool permissionsGranted,
    required bool appVisible,
    required bool enabled,
    required Map<String, dynamic> automation,
    Map<String, dynamic>? homeAnchor,
    required String languageCode,
  }) async {
    if (!_isSupportedPlatform) {
      return;
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _backgroundSafetyConfigKey,
      jsonEncode({
        'userId': userId,
        'permissionsGranted': permissionsGranted,
        'appVisible': appVisible,
        'enabled': enabled,
        'automation': automation,
        'homeAnchor': homeAnchor,
        'languageCode': languageCode,
      }),
    );

    final shouldRun =
        userId != null &&
        userId.isNotEmpty &&
        permissionsGranted &&
        enabled &&
        !appVisible &&
        _automationEnabled(automation);

    if (!shouldRun) {
      try {
        final running = await _service.isRunning();
        if (running) {
          _service.invoke('stopService');
        }
      } catch (_) {}
      return;
    }

    await prepare(hasLocationPermission: permissionsGranted);

    try {
      final running = await _service.isRunning();
      if (running) {
        _service.invoke('syncConfig');
      } else {
        await _service.startService();
      }
    } catch (_) {}
  }

  Future<void> stop() async {
    if (!_isSupportedPlatform) {
      return;
    }
    try {
      final running = await _service.isRunning();
      if (running) {
        _service.invoke('stopService');
      }
    } catch (_) {}
  }
}

class _BackgroundSafetyRuntime {
  _BackgroundSafetyRuntime(this._service);

  final ServiceInstance _service;
  final ApiService _api = ApiService();
  final NotificationService _notifications = NotificationService.instance;
  StreamSubscription<UserAccelerometerEvent>? _accelerometerSubscription;
  Timer? _pollTimer;
  Map<String, dynamic> _config = const {};
  AppLocation? _homeAnchor;
  bool _wasOutsideHome = false;
  DateTime? _lastGeofenceCheckInAt;
  DateTime? _fallCandidateAt;
  DateTime? _lowMotionSince;
  DateTime? _lastFallSignalAt;
  DateTime? _lastShakeSignalAt;
  DateTime? _lastShakePeakAt;
  final List<DateTime> _shakePeaks = [];

  Future<void> start() async {
    await _notifications.initialize();
    await _loadConfigFromPrefs();
    _applyConfig(_config);
  }

  Future<void> _loadConfigFromPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    final raw = prefs.getString(_backgroundSafetyConfigKey);
    if (raw == null || raw.isEmpty) {
      _config = const {};
      return;
    }
    try {
      _config = Map<String, dynamic>.from(jsonDecode(raw) as Map);
    } catch (_) {
      _config = const {};
    }
  }

  void attachListeners() {
    _service.on('syncConfig').listen((_) async {
      await _loadConfigFromPrefs();
      _applyConfig(_config);
    });
    _service.on('stopService').listen((_) async {
      await dispose();
      _service.stopSelf();
    });
  }

  void _applyConfig(Map<String, dynamic> config) {
    final userId = (config['userId'] as String? ?? '').trim();
    final permissionsGranted = _boolish(config['permissionsGranted']);
    final appVisible = _boolish(config['appVisible']);
    final enabled = _boolishOrDefault(config['enabled'], true);
    final automation = Map<String, dynamic>.from(config['automation'] as Map? ?? const {});
    final homeAnchorRaw = config['homeAnchor'];
    _homeAnchor = homeAnchorRaw is Map<String, dynamic>
        ? AppLocation.fromJson(homeAnchorRaw)
        : homeAnchorRaw is Map
            ? AppLocation.fromJson(Map<String, dynamic>.from(homeAnchorRaw))
            : null;

    final shouldRun =
        userId.isNotEmpty &&
        permissionsGranted &&
        enabled &&
        !appVisible &&
        _automationEnabled(automation);

    if (!shouldRun) {
      _stopMonitors();
      return;
    }

    _startMonitors(automation, userId, config['languageCode'] as String? ?? 'vi');
  }

  void _startMonitors(
    Map<String, dynamic> automation,
    String userId,
    String languageCode,
  ) {
    _pollTimer ??= Timer.periodic(const Duration(seconds: 30), (_) {
      unawaited(_checkGeofence(automation, userId, languageCode));
    });
    unawaited(_checkGeofence(automation, userId, languageCode));

    final wantMotion = _boolish(automation['fallDetection']) || _boolish(automation['shakeSos']);
    if (wantMotion && _accelerometerSubscription == null) {
      _accelerometerSubscription = userAccelerometerEventStream().listen(
        (event) => unawaited(_handleMotionEvent(event, automation, userId, languageCode)),
        onError: (_) {},
        cancelOnError: false,
      );
    } else if (!wantMotion) {
      _accelerometerSubscription?.cancel();
      _accelerometerSubscription = null;
    }
  }

  void _stopMonitors() {
    _pollTimer?.cancel();
    _pollTimer = null;
    _accelerometerSubscription?.cancel();
    _accelerometerSubscription = null;
    _wasOutsideHome = false;
    _homeAnchor = null;
  }

  Future<void> _checkGeofence(
    Map<String, dynamic> automation,
    String userId,
    String languageCode,
  ) async {
    if (!_boolish(automation['geofenceAutoCheckin'])) {
      return;
    }
    final anchor = _homeAnchor;
    if (anchor == null) {
      return;
    }

    final enabled = await Geolocator.isLocationServiceEnabled();
    if (!enabled) {
      return;
    }

    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 8),
        ),
      );

      final distance = Geolocator.distanceBetween(
        anchor.lat,
        anchor.lng,
        position.latitude,
        position.longitude,
      );

      if (distance > 250) {
        _wasOutsideHome = true;
        return;
      }

      if (_wasOutsideHome && distance <= 120) {
        final now = DateTime.now();
        if (_lastGeofenceCheckInAt == null ||
            now.difference(_lastGeofenceCheckInAt!).inMinutes >= 15) {
          _lastGeofenceCheckInAt = now;
          _wasOutsideHome = false;
          await _api.createDeviceSignal(
            userId: userId,
            signalType: 'GEOFENCE_HOME_ARRIVAL',
            payload: {
              'lat': position.latitude,
              'lng': position.longitude,
              'distanceMeters': distance.round(),
              'triggeredAt': now.toIso8601String(),
              'background': true,
            },
          );
          await _notifications.showHomeArrivalAutoCheckIn(
            isVietnamese: languageCode == 'vi',
          );
        }
      }
    } catch (_) {
      // Ignore background location failures and keep the service alive.
    }
  }

  Future<void> _handleMotionEvent(
    UserAccelerometerEvent event,
    Map<String, dynamic> automation,
    String userId,
    String languageCode,
  ) async {
    final now = DateTime.now();
    final magnitude = math.sqrt(
      event.x * event.x + event.y * event.y + event.z * event.z,
    );

    if (_boolish(automation['shakeSos'])) {
      final lastPeak = _lastShakePeakAt;
      if (magnitude > 16 &&
          (lastPeak == null || now.difference(lastPeak).inMilliseconds > 350)) {
        _lastShakePeakAt = now;
        _shakePeaks.add(now);
        _shakePeaks.removeWhere((item) => now.difference(item).inSeconds > 2);
        if (_shakePeaks.length >= 3 &&
            (_lastShakeSignalAt == null ||
                now.difference(_lastShakeSignalAt!).inSeconds > 45)) {
          _lastShakeSignalAt = now;
          _shakePeaks.clear();
          await _api.createDeviceSignal(
            userId: userId,
            signalType: 'SHAKE_SOS',
            payload: {
              'magnitude': magnitude,
              'triggeredAt': now.toIso8601String(),
              'background': true,
            },
          );
          await _notifications.showShakeSosTriggered(
            isVietnamese: languageCode == 'vi',
          );
        }
      }
    }

    if (!_boolish(automation['fallDetection'])) {
      return;
    }

    if (magnitude > 18) {
      _fallCandidateAt = now;
      _lowMotionSince = null;
      return;
    }

    final candidate = _fallCandidateAt;
    if (candidate == null) {
      return;
    }

    if (now.difference(candidate).inSeconds > 12) {
      _fallCandidateAt = null;
      _lowMotionSince = null;
      return;
    }

    if (magnitude < 1.2) {
      _lowMotionSince ??= now;
      if (_lowMotionSince != null &&
          now.difference(_lowMotionSince!).inSeconds >= 4 &&
          (_lastFallSignalAt == null ||
              now.difference(_lastFallSignalAt!).inSeconds > 60)) {
        _lastFallSignalAt = now;
        _fallCandidateAt = null;
        _lowMotionSince = null;
        await _api.createDeviceSignal(
          userId: userId,
          signalType: 'FALL_DETECTED',
          payload: {
            'magnitude': magnitude,
            'triggeredAt': now.toIso8601String(),
            'background': true,
          },
        );
        await _notifications.showFallDetected(
          isVietnamese: languageCode == 'vi',
        );
      }
    } else if (magnitude > 3) {
      _lowMotionSince = null;
    }
  }

  Future<void> dispose() async {
    _stopMonitors();
  }
}

@pragma('vm:entry-point')
Future<bool> _onIosBackground(ServiceInstance service) async {
  DartPluginRegistrant.ensureInitialized();
  return true;
}

@pragma('vm:entry-point')
void _onIosForeground(ServiceInstance service) {}

@pragma('vm:entry-point')
void _onStart(ServiceInstance service) async {
  DartPluginRegistrant.ensureInitialized();
  final runtime = _BackgroundSafetyRuntime(service);
  runtime.attachListeners();
  await runtime.start();
}
