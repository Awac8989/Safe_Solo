import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'fall_fusion_engine.dart';
import 'pedometer_service.dart';
import 'watch_sync_manager.dart';
import 'wear_os_service.dart';

/// Trạng thái hoạt động của cảm biến BioActive
enum BioActiveSensorState {
  uninitialized,
  measuring,
  calibrated,
  offWrist,
  unavailable,
}

/// ============================================================================
/// SAFESOLO - DỊCH VỤ CẢM BIẾN PHẦN CỨNG GALAXY WATCH 5 (SM-R900)
/// Đọc trực tiếp từ Android SensorManager & Wear Data Layer:
/// 1. Nhịp tim quang học BioActive PPG (Type 21) kèm lọc nhiễu EMA chuẩn xác
/// 2. Đếm bước chân phần cứng (Type 19 Step Counter & Type 18 Step Detector)
/// 3. Nồng độ oxy hòa tan trong máu SpO2 (Type 65545 / 38 / Samsung Vendor)
/// 4. Cảm biến nhận diện tháo đồng hồ (Type 34 Off-body Detect)
/// 5. Gia tốc kế 3 trục thật (Type 1 Accelerometer) -> Bộ lọc Fusion 3 pha
/// 6. Cầu nối Wear OS Data Layer (MessageClient / DataClient Bluetooth) + Tile Sync
/// ============================================================================
class WatchHardwareSensorService extends ChangeNotifier {
  WatchHardwareSensorService._();
  static final WatchHardwareSensorService instance = WatchHardwareSensorService._();

  static const MethodChannel _methodChannel =
      MethodChannel('com.example.safesolo/watch_native');
  static const EventChannel _eventChannel =
      EventChannel('com.example.safesolo/watch_sensors');

  StreamSubscription<dynamic>? _sensorStreamSub;

  // Trạng thái phần cứng thiết bị
  bool _isHardwareAvailable = false;
  bool _isSamsungWatch5 = false;
  bool _isSmR900 = false;
  String _deviceModel = 'Samsung Galaxy Watch 5 (SM-R900)';
  String _deviceManufacturer = 'Samsung';
  BioActiveSensorState _sensorState = BioActiveSensorState.uninitialized;

  // Dữ liệu sinh tồn thời gian thực (đã qua xử lý chuẩn hóa)
  int? _heartRate;
  int? _rawHeartRate;
  double? _emaHeartRate;
  int _heartRateAccuracy = 3;

  int _steps = 0;
  int? _dailyStepBaseline;
  int? _rawCumulativeSteps;

  int? _spO2;
  final List<int> _spO2Buffer = [];

  int _batteryLevel = 100;
  bool _isOffWrist = false;
  DateTime? _lastReadingTime;
  bool _backgroundSensorServiceStarted = false;

  // Getters
  bool get isHardwareAvailable => _isHardwareAvailable;
  bool get isSamsungWatch5 => _isSamsungWatch5;
  bool get isSmR900 => _isSmR900;
  String get deviceModel => _deviceModel;
  String get deviceManufacturer => _deviceManufacturer;
  BioActiveSensorState get sensorState => _sensorState;

  int? get heartRate => _heartRate;
  int? get rawHeartRate => _rawHeartRate;
  double? get emaHeartRate => _emaHeartRate;
  int get heartRateAccuracy => _heartRateAccuracy;
  int get steps => _steps;
  int? get rawCumulativeSteps => _rawCumulativeSteps;
  int? get spO2 => _spO2;
  int get batteryLevel => _batteryLevel;
  bool get isOffWrist => _isOffWrist;
  DateTime? get lastReadingTime => _lastReadingTime;
  bool get backgroundSensorServiceStarted => _backgroundSensorServiceStarted;

  /// Bật và kết nối với các cảm biến phần cứng của đồng hồ SM-R900 + Cầu nối Wear Data Layer trên Phone
  Future<void> initialize() async {
    if (WatchSyncManager.kIsTesting || kIsWeb || !Platform.isAndroid) {
      _sensorState = BioActiveSensorState.unavailable;
      return;
    }

    try {
      // 1. Lấy thông tin phần cứng thiết bị
      final Map<dynamic, dynamic>? info =
          await _methodChannel.invokeMethod<Map<dynamic, dynamic>>('getDeviceInfo');

      if (info != null) {
        final model = (info['model'] as String? ?? '').toUpperCase();
        final manufacturer = (info['manufacturer'] as String? ?? '').toUpperCase();
        final isWatch = info['isWatch'] as bool? ?? false;
        final isSmR900Flag = info['isSmR900'] == true;
        final hwDeviceId = info['hardwareDeviceId'] as String?;
        final smR900Match = model.contains('SM-R900') ||
            model.contains('WATCH5') ||
            isSmR900Flag;

        _isSmR900 = smR900Match;
        _isSamsungWatch5 = smR900Match || (manufacturer.contains('SAMSUNG') && isWatch);
        _deviceModel = smR900Match
            ? 'Samsung Galaxy Watch 5 (SM-R900)'
            : (info['model'] as String? ?? 'Wear OS Device');
        _deviceManufacturer = info['manufacturer'] as String? ?? 'Samsung';
        _isHardwareAvailable = true;

        if (isWatch || smR900Match) {
          WatchSyncManager.instance.configureHardwareIdentity(
            deviceId: (hwDeviceId != null && hwDeviceId.isNotEmpty) ? hwDeviceId : 'watch_galaxy_5',
            deviceModel: _deviceModel,
            isWatch: true,
          );
          await startWatchBackgroundService();
        }

        debugPrint('[WatchHardwareSensorService] Khởi tạo thiết bị: $_deviceModel (SM-R900=$smR900Match, hwId=$hwDeviceId)');
      }

      WatchSyncManager.instance.registerWearBridgeHandlers(
        sender: (path, payloadJson) => sendWearDataLayerMessage(path: path, payloadJson: payloadJson),
        nodeFinder: getWearConnectedNodes,
        tileSync: ({deviceId, pairedUserId, userName, isPaired, nextDeadline}) =>
            syncSnapshotToWatchTile(
              deviceId: deviceId,
              pairedUserId: pairedUserId,
              userName: userName,
              isPaired: isPaired,
              nextDeadline: nextDeadline,
            ),
      );

      // 2. Yêu cầu cấp quyền cảm biến nếu cần (đồng hồ)
      if (_isSamsungWatch5 || _isSmR900) {
        await _methodChannel.invokeMethod('requestSensorPermissions');
      }

      // 3. Đọc mức pin hiện tại
      final bat = await _methodChannel.invokeMethod<int>('getBatteryLevel');
      if (bat != null && bat > 0) {
        _batteryLevel = bat;
      }

      // 4. Bắt đầu lắng nghe dòng dữ liệu thời gian thực từ EventChannel (gồm cả Wear Data Layer Bluetooth)
      _startSensorStream();
      // Kiểm tra các Wear Node Bluetooth đã ghép sẵn
      await WatchSyncManager.instance.refreshWearConnectedNodes();
    } catch (e) {
      debugPrint('[WatchHardwareSensorService] Thiết bị không hỗ trợ Native SensorChannel: $e');
      _isHardwareAvailable = false;
      _sensorState = BioActiveSensorState.unavailable;
    }
  }

  /// Khởi động WatchSensorForegroundService chạy độc lập khi Watch tắt màn hình
  Future<bool> startWatchBackgroundService() async {
    if (WatchSyncManager.kIsTesting || kIsWeb || !Platform.isAndroid) return false;
    try {
      final ok = await _methodChannel.invokeMethod<bool>('startWatchBackgroundService') ?? false;
      _backgroundSensorServiceStarted = ok;
      notifyListeners();
      return ok;
    } catch (_) {
      return false;
    }
  }

  /// Gửi gói tin SSWP qua cầu nối Wear OS Data Layer (MessageClient Bluetooth < 100ms)
  Future<Map<String, dynamic>> sendWearDataLayerMessage({
    String path = '/safesolo/packet',
    required String payloadJson,
  }) async {
    if (WatchSyncManager.kIsTesting || kIsWeb || !Platform.isAndroid) {
      return const {'sent': false, 'nodeCount': 0};
    }
    try {
      final raw = await _methodChannel.invokeMethod<Map<dynamic, dynamic>>(
        'sendWearMessage',
        {'path': path, 'payloadJson': payloadJson},
      );
      if (raw != null) {
        return Map<String, dynamic>.from(raw);
      }
    } catch (e) {
      debugPrint('[WatchHardwareSensorService] sendWearMessage error: $e');
    }
    return const {'sent': false, 'nodeCount': 0};
  }

  /// Liệt kê các thiết bị Wear OS đang kết nối Bluetooth trực tiếp
  Future<List<Map<String, dynamic>>> getWearConnectedNodes() async {
    if (WatchSyncManager.kIsTesting || kIsWeb || !Platform.isAndroid) {
      return const [];
    }
    try {
      final raw = await _methodChannel.invokeMethod<List<dynamic>>('getWearConnectedNodes');
      if (raw != null) {
        return raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
      }
    } catch (_) {}
    return const [];
  }

  /// Đồng bộ dữ liệu mới nhất sang Wear OS Tile & DataClient
  Future<void> syncSnapshotToWatchTile({
    String? deviceId,
    String? pairedUserId,
    String? userName,
    bool? isPaired,
    DateTime? nextDeadline,
  }) async {
    if (WatchSyncManager.kIsTesting || kIsWeb || !Platform.isAndroid) return;
    try {
      await _methodChannel.invokeMethod('syncWatchSnapshotToTile', {
        if (_heartRate != null) 'heartRate': _heartRate,
        if (_spO2 != null) 'spO2': _spO2,
        'battery': _batteryLevel,
        'steps': _steps,
        'isOffWrist': _isOffWrist,
        'svmG': FallFusionEngine.instance.currentSvmG,
        'fusionPhase': FallFusionEngine.instance.phaseApiCode,
        if (deviceId != null) 'deviceId': deviceId,
        if (pairedUserId != null) 'pairedUserId': pairedUserId,
        if (userName != null) 'userName': userName,
        if (isPaired != null) 'isPaired': isPaired,
        if (nextDeadline != null) 'nextDeadlineMs': nextDeadline.millisecondsSinceEpoch,
      });
    } catch (_) {}
  }

  void _startSensorStream() {
    _sensorStreamSub?.cancel();
    _sensorState = BioActiveSensorState.measuring;
    notifyListeners();

    try {
      _sensorStreamSub = _eventChannel.receiveBroadcastStream().listen(
        _onSensorEvent,
        onError: (err) {
          debugPrint('[WatchHardwareSensorService] Stream error: $err');
          _sensorState = BioActiveSensorState.unavailable;
          notifyListeners();
        },
      );
    } catch (e) {
      debugPrint('[WatchHardwareSensorService] Không thể kết nối EventChannel: $e');
    }
  }

  void _onSensorEvent(dynamic event) {
    if (event is! Map) return;
    final map = Map<String, dynamic>.from(event);
    final type = map['sensorType'] as String?;
    _lastReadingTime = DateTime.now();

    switch (type) {
      case 'HEART_RATE':
        _processHeartRate(
          rawBpm: map['value'] as int? ?? 0,
          accuracy: map['accuracy'] as int? ?? 3,
        );
        break;

      case 'HEART_RATE_ACCURACY':
        _heartRateAccuracy = map['accuracy'] as int? ?? 3;
        notifyListeners();
        break;

      case 'STEP_COUNTER':
        _processCumulativeSteps(map['value'] as int? ?? 0);
        break;

      case 'STEP_DETECTOR':
        _processStepDetector();
        break;

      case 'SPO2':
        _processSpO2(
          rawSpo2: map['value'] as int? ?? 0,
          accuracy: map['accuracy'] as int? ?? 3,
        );
        break;

      case 'OFFBODY':
        _processOffBody(map['isOffWrist'] as bool? ?? false);
        break;

      case 'ACCELEROMETER':
        final axG = (map['axG'] as num?)?.toDouble() ?? 0.0;
        final ayG = (map['ayG'] as num?)?.toDouble() ?? 0.0;
        final azG = (map['azG'] as num?)?.toDouble() ?? 1.0;
        // Chỉ chạy IMU Watch Sensor Fusion trên đồng hồ (hoặc khi bật giám sát Watch)
        if (_isSamsungWatch5 || _isSmR900 || WatchSyncManager.instance.isRunningOnWatch) {
          FallFusionEngine.instance.ingestAccelerometer(
            axG: axG,
            ayG: ayG,
            azG: azG,
          );
        }
        break;

      case 'BATTERY':
        final bat = map['level'] as int? ?? _batteryLevel;
        if (bat > 0 && bat <= 100) {
          _batteryLevel = bat;
          _syncToSubsystems();
          notifyListeners();
        }
        break;

      case 'WEAR_MESSAGE':
      case 'WEAR_TILE_ACTION':
      case 'WEAR_LAUNCH_ACTION':
        WatchSyncManager.instance.handleNativeWearBridgeEvent(map);
        break;
    }
  }

  /// Thuật toán lọc nhịp tim chuẩn y tế (EMA Filter & Accuracy Validation)
  void _processHeartRate({required int rawBpm, required int accuracy}) {
    if (_isOffWrist) {
      _heartRate = null;
      _rawHeartRate = 0;
      _sensorState = BioActiveSensorState.offWrist;
      FallFusionEngine.instance.updateVitals(heartRate: 0, spO2: _spO2, isOffWrist: true);
      notifyListeners();
      return;
    }

    _rawHeartRate = rawBpm;
    _heartRateAccuracy = accuracy;

    if (rawBpm < 35 || rawBpm > 220) {
      _sensorState = BioActiveSensorState.measuring;
      notifyListeners();
      return;
    }

    if (accuracy == 0) {
      _sensorState = BioActiveSensorState.measuring;
    } else {
      _sensorState = BioActiveSensorState.calibrated;
    }

    if (_emaHeartRate == null) {
      _emaHeartRate = rawBpm.toDouble();
    } else {
      _emaHeartRate = (0.35 * rawBpm) + (0.65 * _emaHeartRate!);
    }
    _heartRate = _emaHeartRate!.round();
    FallFusionEngine.instance.updateVitals(
      heartRate: _heartRate,
      spO2: _spO2,
      isOffWrist: _isOffWrist,
    );
    _syncToSubsystems();
    notifyListeners();
  }

  /// Thuật toán đếm bước chân chuẩn (Tự động trừ mốc đầu ngày)
  void _processCumulativeSteps(int rawSteps) {
    _rawCumulativeSteps = rawSteps;
    if (_dailyStepBaseline == null || _dailyStepBaseline! > rawSteps) {
      _dailyStepBaseline = rawSteps;
    }

    final todaySteps = rawSteps - _dailyStepBaseline!;
    if (todaySteps >= 0 && todaySteps < 200000) {
      _steps = todaySteps;
      _syncToSubsystems();
      notifyListeners();
    }
  }

  void _processStepDetector() {
    _steps++;
    _syncToSubsystems();
    notifyListeners();
  }

  /// Thuật toán lọc SpO2 chuẩn y tế (Median Filter 5 mẫu chống nhiễu quang học)
  void _processSpO2({required int rawSpo2, required int accuracy}) {
    if (_isOffWrist) {
      _spO2 = null;
      _sensorState = BioActiveSensorState.offWrist;
      FallFusionEngine.instance.updateVitals(heartRate: _heartRate, spO2: 0, isOffWrist: true);
      notifyListeners();
      return;
    }

    if (rawSpo2 < 70 || rawSpo2 > 100) return;

    _spO2Buffer.add(rawSpo2);
    if (_spO2Buffer.length > 5) {
      _spO2Buffer.removeAt(0);
    }

    final sorted = List<int>.from(_spO2Buffer)..sort();
    final median = sorted[sorted.length ~/ 2];

    _spO2 = median;
    _sensorState = BioActiveSensorState.calibrated;
    FallFusionEngine.instance.updateVitals(
      heartRate: _heartRate,
      spO2: _spO2,
      isOffWrist: _isOffWrist,
    );
    _syncToSubsystems();
    notifyListeners();
  }

  /// Xử lý sự kiện tháo/đeo đồng hồ
  void _processOffBody(bool off) {
    _isOffWrist = off;
    if (off) {
      _sensorState = BioActiveSensorState.offWrist;
      _heartRate = null;
      _spO2 = null;
    } else {
      _sensorState = BioActiveSensorState.measuring;
    }
    FallFusionEngine.instance.updateVitals(
      heartRate: _heartRate,
      spO2: _spO2,
      isOffWrist: off,
    );
    _syncToSubsystems();
    notifyListeners();
  }

  void _syncToSubsystems() {
    WearOsService.instance.updateMetrics(
      heartRate: _heartRate,
      spO2: _spO2,
      steps: _steps,
      battery: _batteryLevel,
      isOffWrist: _isOffWrist,
      broadcast: true,
    );

    PedometerService.instance.updateFromWatchSimulator(
      steps: _steps,
      heartRate: _heartRate ?? PedometerService.instance.heartRate,
      spO2: _spO2 ?? PedometerService.instance.spO2,
      battery: _batteryLevel,
      isOffWrist: _isOffWrist,
    );

    unawaited(syncSnapshotToWatchTile(
      deviceId: WatchSyncManager.instance.deviceId,
      pairedUserId: WatchSyncManager.instance.pairedUserId,
      isPaired: WatchSyncManager.instance.isPaired,
    ));
  }

  @visibleForTesting
  void testSetVitals({
    int? heartRate,
    int? steps,
    int? spO2,
    int? battery,
    bool? isOffWrist,
  }) {
    if (isOffWrist != null) _processOffBody(isOffWrist);
    if (heartRate != null) _processHeartRate(rawBpm: heartRate, accuracy: 3);
    if (steps != null) _steps = steps;
    if (spO2 != null) _processSpO2(rawSpo2: spO2, accuracy: 3);
    if (battery != null) _batteryLevel = battery;
    _syncToSubsystems();
    notifyListeners();
  }

  @override
  void dispose() {
    _sensorStreamSub?.cancel();
    super.dispose();
  }
}
