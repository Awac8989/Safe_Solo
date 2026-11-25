import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../core/constants.dart';
import '../models/watch_protocol.dart';
import 'fall_fusion_engine.dart';
import 'pedometer_service.dart';
import 'wear_os_service.dart';

enum WatchConnectionType {
  disconnected,
  inMemory,
  cloudRelay,
  localBle,
}

/// ============================================================================
/// SAFESOLO - WATCH SYNC MANAGER (ĐIỀU PHỐI ĐỒNG BỘ ĐA KÊNH WATCH <-> PHONE)
/// Phục vụ: Cảnh báo khẩn cấp tức thời & Đồng bộ sinh tồn hai chiều
/// ============================================================================
class WatchSyncManager extends ChangeNotifier {
  WatchSyncManager._();
  static final WatchSyncManager instance = WatchSyncManager._();

  static const String _storagePairedKey = 'safesolo_watch_paired';
  static const String _storageDeviceIdKey = 'safesolo_watch_device_id';
  static const String _storagePairingCodeKey = 'safesolo_watch_pairing_code';
  static const String _storageUserIdKey = 'safesolo_watch_user_id';

  final _client = http.Client();
  static const Map<String, String> _watchApiHeaders = {
    'Content-Type': 'application/json',
    'x-api-key': 'android-app-key-abc',
  };
  final StreamController<WatchPacket> _packetController =
      StreamController<WatchPacket>.broadcast();

  static bool get kIsTesting =>
      const bool.fromEnvironment('flutter.testing') ||
      (!kIsWeb && Platform.environment.containsKey('FLUTTER_TEST'));

  // Trạng thái ghép nối và thiết bị
  bool _isPaired = false;
  WatchConnectionType _connectionType = WatchConnectionType.disconnected;
  String _deviceId = 'watch_galaxy_5';
  String _deviceModel = 'Samsung Galaxy Watch 5 (SM-R900)';
  String _pairingCode = '742-891';
  int _latencyMs = 28;

  void setBleConnected({
    required String deviceId,
    required String deviceModel,
  }) {
    _deviceId = deviceId;
    _deviceModel = deviceModel;
    _isPaired = true;
    _connectionType = WatchConnectionType.localBle;
    _latencyMs = 12;
    WearOsService.instance.setPaired(true);
    PedometerService.instance.setPaired(true);
    notifyListeners();
  }
  bool _isSyncing = false;
  bool _isCheckingStatus = false;
  String? _pairedUserId;
  String? _lastPairingError;
  String? get lastPairingError => _lastPairingError;

  static bool isPlaceholderUserId(String? userId) {
    final clean = userId?.trim() ?? '';
    return clean.isEmpty ||
        clean == 'anonymous' ||
        clean == 'user_default' ||
        clean == 'sandbox_user';
  }

  // Lịch sử gói tin truyền thông
  WatchPacket? _lastPacket;
  final List<WatchPacket> _recentPackets = [];
  final Set<String> _processedMessageIds = <String>{};
  final List<String> _processedMessageOrder = <String>[];
  Timer? _cloudPollTimer;

  // Hồ sơ y tế thực tế đồng bộ hai chiều (Real Medical Profile)
  String _medicalFullName = 'Đoàn Minh Quân';
  String _medicalBirthYear = '2003';
  String _medicalCitizenId = '079203001234';
  String _medicalBloodType = 'O+';
  String _medicalAllergies = 'Penicillin';
  String _medicalConditions = 'Tăng HA nhẹ';
  String _medicalMedications = 'Amlodipine 5mg';
  String _medicalEmergencyPhone = '0901112222';
  String _medicalEmergencyName = 'Mẹ Lan (ICE)';
  String _medicalInsuranceProvider = 'BHYT Quân Đội';
  String _medicalInsuranceNumber = 'DN4791234567890';

  // Getters
  bool get isPaired => _isPaired;
  WatchConnectionType get connectionType => _connectionType;
  String get deviceId => _deviceId;
  String get deviceModel => _deviceModel;
  String get pairingCode => _pairingCode;
  int get latencyMs => _latencyMs;
  bool get isSyncing => _isSyncing;
  String? get pairedUserId => _pairedUserId;
  WatchPacket? get lastPacket => _lastPacket;
  List<WatchPacket> get recentPackets => List.unmodifiable(_recentPackets);
  Stream<WatchPacket> get packetStream => _packetController.stream;

  String get medicalFullName => _medicalFullName;
  String get medicalBirthYear => _medicalBirthYear;
  String get medicalCitizenId => _medicalCitizenId;
  String get medicalBloodType => _medicalBloodType;
  String get medicalAllergies => _medicalAllergies;
  String get medicalConditions => _medicalConditions;
  String get medicalMedications => _medicalMedications;
  String get medicalEmergencyPhone => _medicalEmergencyPhone;
  String get medicalEmergencyName => _medicalEmergencyName;
  String get medicalInsuranceProvider => _medicalInsuranceProvider;
  String get medicalInsuranceNumber => _medicalInsuranceNumber;

  String get connectionStatusLabel {
    switch (_connectionType) {
      case WatchConnectionType.localBle:
        return 'Bluetooth trực tiếp';
      case WatchConnectionType.cloudRelay:
        return 'Wi-Fi & Internet';
      case WatchConnectionType.inMemory:
        return 'Đang kết nối';
      case WatchConnectionType.disconnected:
        return 'Chưa kết nối';
    }
  }

  // Chế độ chạy: Trên Đồng hồ hay Điện thoại
  bool _isRunningOnWatch = false;
  bool get isRunningOnWatch => _isRunningOnWatch;
  void setIsRunningOnWatch(bool val) {
    _isRunningOnWatch = val;
  }

  /// Định danh phần cứng duy nhất cho Galaxy Watch (SM-R900 / Wear OS) để ghép 1-1
  void configureHardwareIdentity({
    required String deviceId,
    required String deviceModel,
    required bool isWatch,
  }) {
    _isRunningOnWatch = isWatch;
    if (deviceId.isNotEmpty) {
      _deviceId = deviceId;
    }
    if (deviceModel.isNotEmpty) {
      _deviceModel = deviceModel;
    }
    _savePersistedState();
    notifyListeners();
  }

  /// Gắn userId nạn nhân thực tế vào đồng hồ để đồng bộ với TOC Web Admin
  void setActiveUserId(String? userId) {
    if (isPlaceholderUserId(userId)) return;
    if (_pairedUserId != userId) {
      // Nếu điện thoại vừa đổi sang tài khoản khác với chủ đồng hồ trước đó -> hủy trạng thái ghép cũ
      if (!_isRunningOnWatch && _isPaired && !isPlaceholderUserId(_pairedUserId)) {
        _isPaired = false;
        _connectionType = WatchConnectionType.disconnected;
        WearOsService.instance.setPaired(false);
        PedometerService.instance.setPaired(false);
      }
      _pairedUserId = userId;
      _savePersistedState();
      notifyListeners();
    }
  }

  // Các sự kiện đồng bộ tương tác thực tế 2 chiều (Bidirectional Event Callbacks)
  Future<void> Function(String mood)? onWatchCheckinReceived;
  void Function(String action, Map<String, dynamic> payload)? onWatchEmergencyReceived;
  Future<void> Function(String action, Map<String, dynamic> payload)? onOfflineEmergencyFallback;

  @visibleForTesting
  Future<bool> Function(WatchPacket packet)? cloudRelayOverrideForTest;
  void Function()? onAlertCancelledReceived;
  void Function(int remainingSeconds, String deadline)? onTimerSyncReceived;
  void Function()? onFindWatchPingReceived;
  void Function()? onFindPhonePingReceived;
  void Function()? onInstantMeasureReqReceived;
  void Function(int heartRate, int spO2)? onPrecisionMeasureResultReceived;
  void Function(Map<String, dynamic> payload)? onTocDispatchAckReceived;
  void Function(Map<String, dynamic> payload)? onRouteDeviationCheckReceived;
  void Function(Map<String, dynamic> payload)? onJourneyCheckSafeReceived;

  // Wear OS Data Layer & Tile native delegates (registered by WatchHardwareSensorService)
  Future<Map<String, dynamic>> Function(String path, String payloadJson)? _wearDataLayerSender;
  Future<List<Map<String, dynamic>>> Function()? _wearNodeFinder;
  Future<void> Function({
    String? deviceId,
    String? pairedUserId,
    String? userName,
    bool? isPaired,
    DateTime? nextDeadline,
  })? _wearTileSync;

  bool _isWearDataLayerConnected = false;
  int _wearNodeCount = 0;
  List<String> _wearNodeNames = const [];
  bool _fusionWired = false;

  bool get isWearDataLayerConnected => _isWearDataLayerConnected;
  int get wearNodeCount => _wearNodeCount;
  List<String> get wearNodeNames => List.unmodifiable(_wearNodeNames);

  void registerWearBridgeHandlers({
    Future<Map<String, dynamic>> Function(String path, String payloadJson)? sender,
    Future<List<Map<String, dynamic>>> Function()? nodeFinder,
    Future<void> Function({
      String? deviceId,
      String? pairedUserId,
      String? userName,
      bool? isPaired,
      DateTime? nextDeadline,
    })? tileSync,
  }) {
    _wearDataLayerSender = sender;
    _wearNodeFinder = nodeFinder;
    _wearTileSync = tileSync;
  }

  Future<void> refreshWearConnectedNodes() async {
    final finder = _wearNodeFinder;
    if (finder == null) return;
    try {
      final nodes = await finder();
      _wearNodeCount = nodes.length;
      _wearNodeNames = nodes
          .map((n) => n['displayName']?.toString() ?? n['id']?.toString() ?? 'WearNode')
          .toList();
      _isWearDataLayerConnected = nodes.isNotEmpty;
      if (_isWearDataLayerConnected && _connectionType == WatchConnectionType.disconnected) {
        _connectionType = WatchConnectionType.localBle;
      }
      notifyListeners();
    } catch (_) {}
  }

  StreamSubscription<WatchPacket>? _packetSub;

  void initialize() {
    _packetSub ??= _packetController.stream.listen(_handleIncomingPacket);
    _ensureFusionWired();
    loadPersistedState().then((_) {
      if (!kIsTesting) {
        _startPeriodicHealthCheck();
        _fetchLatestVitals();
        fetchMedicalProfileFromBackend();
      }
    });
  }

  void _ensureFusionWired() {
    if (_fusionWired) return;
    _fusionWired = true;
    final fusion = FallFusionEngine.instance;
    fusion.onPhase3CountdownStarted = (sec, peakSvmG, ppgNote) {
      HapticFeedback.heavyImpact();
      emitVitalsTelemetry(
        heartRate: fusion.heartRate,
        spO2: fusion.spO2,
        steps: PedometerService.instance.steps,
        battery: WearOsService.instance.battery,
        isOffWrist: fusion.isOffWrist,
        svmG: peakSvmG,
        tiltAngle: fusion.impactTiltAngle,
      );
    };
    fusion.onFalseAlarmBlocked = (phase, reason) {
      debugPrint('[WatchSyncManager] 3-Phase Fusion BLOCKED false alarm: $reason');
      emitVitalsTelemetry(
        heartRate: fusion.heartRate,
        spO2: fusion.spO2,
        steps: PedometerService.instance.steps,
        battery: WearOsService.instance.battery,
        isOffWrist: fusion.isOffWrist,
        svmG: fusion.currentSvmG,
        tiltAngle: fusion.impactTiltAngle,
      );
    };
    fusion.onConfirmedFall = (event) {
      debugPrint('[WatchSyncManager] 3-Phase Fusion CONFIRMED FALL: ${event.peakSvmG}G conf=${event.fusionConfidence}');
      WearOsService.instance.updateMetrics(
        heartRate: event.heartRateAtImpact,
        spO2: event.spO2AtImpact,
        isOffWrist: event.isOffWrist,
        broadcast: false,
      );
      emitFallAlert(
        svm: event.peakSvmG,
        tilt: event.tiltAngleDegrees,
        isSimulated: false,
        gForceWaveform: event.gForceWaveform,
        ppgWaveform: event.ppgWaveform,
        fusionMetadata: fusion.toFusionPayload(),
      );
    };
  }

  /// Khôi phục trạng thái ghép nối từ SharedPreferences
  Future<void> loadPersistedState() async {
    if (kIsTesting) return;
    try {
      await _loadMedicalState();
      final prefs = await SharedPreferences.getInstance();
      final paired = prefs.getBool(_storagePairedKey) ?? false;
      final devId = prefs.getString(_storageDeviceIdKey);
      final pCode = prefs.getString(_storagePairingCodeKey);
      final uId = prefs.getString(_storageUserIdKey);

      if (devId != null && devId.isNotEmpty) _deviceId = devId;
      if (pCode != null && pCode.isNotEmpty) _pairingCode = pCode;
      if (uId != null && uId.isNotEmpty) _pairedUserId = uId;

      if (paired) {
        _isPaired = true;
        _connectionType = WatchConnectionType.cloudRelay;
        WearOsService.instance.setPaired(true);
        PedometerService.instance.setPaired(true);
      }
      notifyListeners();
    } catch (e) {
      debugPrint('[WatchSyncManager] Error loading persisted state: $e');
    }
  }

  /// Lưu trạng thái ghép nối xuống SharedPreferences
  Future<void> _savePersistedState() async {
    if (kIsTesting) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_storagePairedKey, _isPaired);
      await prefs.setString(_storageDeviceIdKey, _deviceId);
      await prefs.setString(_storagePairingCodeKey, _pairingCode);
      if (_pairedUserId != null) {
        await prefs.setString(_storageUserIdKey, _pairedUserId!);
      } else {
        await prefs.remove(_storageUserIdKey);
      }
    } catch (e) {
      debugPrint('[WatchSyncManager] Error saving persisted state: $e');
    }
  }

  void _updateMedicalProfileFromMap(Map<String, dynamic> data) {
    if (data['fullName'] != null && (data['fullName'] as String).isNotEmpty) {
      _medicalFullName = data['fullName'] as String;
    }
    if (data['birthYear'] != null && (data['birthYear'] as String).isNotEmpty) {
      _medicalBirthYear = data['birthYear'] as String;
    }
    if (data['citizenId'] != null && (data['citizenId'] as String).isNotEmpty) {
      _medicalCitizenId = data['citizenId'] as String;
    }
    if (data['bloodType'] != null && (data['bloodType'] as String).isNotEmpty) {
      _medicalBloodType = data['bloodType'] as String;
    }
    if (data['allergies'] != null && (data['allergies'] as String).isNotEmpty) {
      _medicalAllergies = data['allergies'] as String;
    }
    if (data['conditions'] != null && (data['conditions'] as String).isNotEmpty) {
      _medicalConditions = data['conditions'] as String;
    }
    if (data['medications'] != null && (data['medications'] as String).isNotEmpty) {
      _medicalMedications = data['medications'] as String;
    }
    if (data['emergencyPhone'] != null && (data['emergencyPhone'] as String).isNotEmpty) {
      _medicalEmergencyPhone = data['emergencyPhone'] as String;
    } else if (data['emergencyContactPhone'] != null && (data['emergencyContactPhone'] as String).isNotEmpty) {
      _medicalEmergencyPhone = data['emergencyContactPhone'] as String;
    }
    if (data['emergencyName'] != null && (data['emergencyName'] as String).isNotEmpty) {
      _medicalEmergencyName = data['emergencyName'] as String;
    } else if (data['emergencyContactName'] != null && (data['emergencyContactName'] as String).isNotEmpty) {
      _medicalEmergencyName = data['emergencyContactName'] as String;
    }
    if (data['insuranceProvider'] != null && (data['insuranceProvider'] as String).isNotEmpty) {
      _medicalInsuranceProvider = data['insuranceProvider'] as String;
    }
    if (data['insuranceNumber'] != null && (data['insuranceNumber'] as String).isNotEmpty) {
      _medicalInsuranceNumber = data['insuranceNumber'] as String;
    }
    _saveMedicalState();
    notifyListeners();
  }

  Future<void> _saveMedicalState() async {
    if (kIsTesting) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('safesolo_med_name', _medicalFullName);
      await prefs.setString('safesolo_med_birth', _medicalBirthYear);
      await prefs.setString('safesolo_med_citizen', _medicalCitizenId);
      await prefs.setString('safesolo_med_blood', _medicalBloodType);
      await prefs.setString('safesolo_med_allergy', _medicalAllergies);
      await prefs.setString('safesolo_med_cond', _medicalConditions);
      await prefs.setString('safesolo_med_drugs', _medicalMedications);
      await prefs.setString('safesolo_med_phone', _medicalEmergencyPhone);
      await prefs.setString('safesolo_med_ename', _medicalEmergencyName);
      await prefs.setString('safesolo_med_ins_prov', _medicalInsuranceProvider);
      await prefs.setString('safesolo_med_ins_num', _medicalInsuranceNumber);
    } catch (_) {}
  }

  Future<void> _loadMedicalState() async {
    if (kIsTesting) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      _medicalFullName = prefs.getString('safesolo_med_name') ?? _medicalFullName;
      _medicalBirthYear = prefs.getString('safesolo_med_birth') ?? _medicalBirthYear;
      _medicalCitizenId = prefs.getString('safesolo_med_citizen') ?? _medicalCitizenId;
      _medicalBloodType = prefs.getString('safesolo_med_blood') ?? _medicalBloodType;
      _medicalAllergies = prefs.getString('safesolo_med_allergy') ?? _medicalAllergies;
      _medicalConditions = prefs.getString('safesolo_med_cond') ?? _medicalConditions;
      _medicalMedications = prefs.getString('safesolo_med_drugs') ?? _medicalMedications;
      _medicalEmergencyPhone = prefs.getString('safesolo_med_phone') ?? _medicalEmergencyPhone;
      _medicalEmergencyName = prefs.getString('safesolo_med_ename') ?? _medicalEmergencyName;
      _medicalInsuranceProvider = prefs.getString('safesolo_med_ins_prov') ?? _medicalInsuranceProvider;
      _medicalInsuranceNumber = prefs.getString('safesolo_med_ins_num') ?? _medicalInsuranceNumber;
    } catch (_) {}
  }

  /// Tải hồ sơ y tế từ Backend Cloud Relay
  Future<void> fetchMedicalProfileFromBackend() async {
    if (kIsTesting) return;
    try {
      final uri = Uri.parse('${AppConstants.backendBaseUrl}/watch/medical-profile/$_deviceId');
      final res = await _client
          .get(uri, headers: _watchApiHeaders)
          .timeout(const Duration(seconds: 3));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final med = data['medical'] as Map<String, dynamic>?;
        if (med != null) {
          _updateMedicalProfileFromMap(med);
        }
      }
    } catch (_) {}
  }

  /// Gửi hồ sơ y tế từ Điện thoại sang Đồng hồ
  Future<void> sendMedicalProfileSync({
    required String fullName,
    required String birthYear,
    required String citizenId,
    required String bloodType,
    required String allergies,
    required String conditions,
    required String medications,
    required String emergencyPhone,
    required String emergencyName,
    required String insuranceProvider,
    required String insuranceNumber,
  }) async {
    final payload = {
      'fullName': fullName,
      'birthYear': birthYear,
      'citizenId': citizenId,
      'bloodType': bloodType,
      'allergies': allergies,
      'conditions': conditions,
      'medications': medications,
      'emergencyPhone': emergencyPhone,
      'emergencyName': emergencyName,
      'insuranceProvider': insuranceProvider,
      'insuranceNumber': insuranceNumber,
    };
    _updateMedicalProfileFromMap(payload);

    await sendPacket(WatchPacket.create(
      sender: WatchSender.phone,
      type: WatchPacketType.command,
      action: WatchAction.medicalProfileSync,
      payload: payload,
    ));

    if (!kIsTesting) {
      try {
        final uri = Uri.parse('${AppConstants.backendBaseUrl}/watch/medical-profile/$_deviceId');
        await _client.post(
          uri,
          headers: _watchApiHeaders,
          body: jsonEncode({'medical': payload}),
        ).timeout(const Duration(seconds: 3));
      } catch (_) {}
    }
  }

  /// Đo độ trễ RTT thực tế tới Host IP
  Future<bool> pingHost([String? targetUrl]) async {
    final start = DateTime.now().millisecondsSinceEpoch;
    try {
      final url = targetUrl ?? '${AppConstants.backendBaseUrl}/health';
      final res = await _client
          .get(Uri.parse(url), headers: _watchApiHeaders)
          .timeout(const Duration(seconds: 3));
      final end = DateTime.now().millisecondsSinceEpoch;
      _latencyMs = (end - start).clamp(5, 999);
      notifyListeners();
      return res.statusCode >= 200 && res.statusCode < 400;
    } catch (_) {
      final end = DateTime.now().millisecondsSinceEpoch;
      _latencyMs = (end - start).clamp(50, 999);
      notifyListeners();
      return false;
    }
  }

  void _startPeriodicHealthCheck() {
    _cloudPollTimer?.cancel();
    if (kIsTesting) return;
    _cloudPollTimer = Timer.periodic(const Duration(seconds: 2), (_) {
      _fetchLatestVitals();
    });
  }

  Future<void> _fetchLatestVitals() async {
    if (kIsTesting) return;
    // Chặn lỗi ghép ngầm: Điện thoại chưa ghép nối 1-1 thì không tự ý poll & nhận nhầm đồng hồ khác
    if (!_isRunningOnWatch && !_isPaired) return;
    if (_isRunningOnWatch) {
      await checkWatchPairingStatus();
    }
    final start = DateTime.now().millisecondsSinceEpoch;
    try {
      final uri = Uri.parse('${AppConstants.backendBaseUrl}/watch/vitals/$_deviceId');
      final res = await _client
          .get(uri, headers: _watchApiHeaders)
          .timeout(const Duration(seconds: 3));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final end = DateTime.now().millisecondsSinceEpoch;
        _latencyMs = (end - start).clamp(12, 450);

        final vitals = data['vitals'] as Map<String, dynamic>?;
        final serverPaired = data['paired'] == true;
        if (vitals != null && (serverPaired || _isRunningOnWatch)) {
          final heartRate = vitals['heartRate'] as int?;
          final spO2 = vitals['spO2'] as int?;
          final steps = vitals['steps'] as int?;
          final battery = vitals['battery'] as int?;
          final isOffWrist = vitals['isOffWrist'] as bool?;

          WearOsService.instance.updateMetrics(
            heartRate: heartRate,
            spO2: spO2,
            steps: steps,
            battery: battery,
            isOffWrist: isOffWrist,
            broadcast: false,
          );
          PedometerService.instance.updateFromWatchSimulator(
            steps: steps ?? PedometerService.instance.steps,
            heartRate: heartRate ?? PedometerService.instance.heartRate,
            spO2: spO2 ?? PedometerService.instance.spO2,
            battery: battery ?? PedometerService.instance.battery,
            isOffWrist: isOffWrist ?? false,
          );
          if (_isPaired) {
            _connectionType = WatchConnectionType.cloudRelay;
          }
        }
        notifyListeners();
      }

      // 2. Lấy các lệnh chờ điều phối hai chiều từ Backend (Command Queue Polling)
      final target = _isRunningOnWatch ? 'watch' : 'phone';
      final cmdUri = Uri.parse('${AppConstants.backendBaseUrl}/watch/commands/$_deviceId?target=$target');
      final cmdRes = await _client
          .get(cmdUri, headers: _watchApiHeaders)
          .timeout(const Duration(seconds: 2));
      if (cmdRes.statusCode == 200) {
        final cmdData = jsonDecode(cmdRes.body) as Map<String, dynamic>;
        final commands = cmdData['commands'] as List<dynamic>? ?? [];
        for (final raw in commands) {
          if (raw is Map<String, dynamic>) {
            final packet = WatchPacket.fromJson(raw);
            _handleIncomingPacket(packet);
          }
        }
        if (_isRunningOnWatch && cmdData['timer'] != null) {
          final timerMap = cmdData['timer'] as Map<String, dynamic>;
          final remaining = timerMap['remainingSeconds'] as int?;
          final deadline = timerMap['deadline'] as String?;
          if (remaining != null) {
            onTimerSyncReceived?.call(remaining, deadline ?? '');
          }
        }
      }
    } catch (_) {}
  }

  void stopPeriodicChecks() {
    _cloudPollTimer?.cancel();
    _cloudPollTimer = null;
  }

  /// 1. TẠO MÃ GHÉP NỐI TRÊN ĐỒNG HỒ
  Future<String> requestNewPairingCode({String? deviceId}) async {
    if (deviceId != null) _deviceId = deviceId;
    _isSyncing = true;
    notifyListeners();

    if (kIsTesting) {
      final rnd = (100000 + DateTime.now().microsecond % 900000).toString();
      _pairingCode = '${rnd.substring(0, 3)}-${rnd.substring(3)}';
      _connectionType = WatchConnectionType.inMemory;
      _isSyncing = false;
      notifyListeners();
      return _pairingCode;
    }

    try {
      final uri = Uri.parse('${AppConstants.backendBaseUrl}/watch/pair/request-code');
      final res = await _client.post(
        uri,
        headers: _watchApiHeaders,
        body: jsonEncode({
          'deviceId': _deviceId,
          'deviceModel': _deviceModel,
        }),
      ).timeout(const Duration(seconds: 4));

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final rawCode = data['code'] as String? ?? '123456';
        _pairingCode = '${rawCode.substring(0, 3)}-${rawCode.substring(3)}';
        _connectionType = WatchConnectionType.cloudRelay;
      }
    } catch (_) {
      // Fallback offline / in-memory code
      final rnd = (100000 + DateTime.now().microsecond % 900000).toString();
      _pairingCode = '${rnd.substring(0, 3)}-${rnd.substring(3)}';
      _connectionType = WatchConnectionType.inMemory;
    } finally {
      _isSyncing = false;
      notifyListeners();
    }
    return _pairingCode;
  }

  /// 2. ĐIỆN THOẠI XÁC NHẬN MÃ GHÉP NỐI TỪ ĐỒNG HỒ (RÀNG BUỘC 1-1)
  Future<bool> verifyPairingCode(String code, {required String userId}) async {
    _isSyncing = true;
    _lastPairingError = null;
    notifyListeners();

    if (kIsTesting) {
      _isPaired = true;
      _pairedUserId = userId;
      _connectionType = WatchConnectionType.inMemory;
      _pairingCode = code;
      WearOsService.instance.setPaired(true);
      PedometerService.instance.setPaired(true);
      _broadcastInternal(WatchPacket.create(
        sender: WatchSender.phone,
        type: WatchPacketType.pairing,
        action: WatchAction.pairConfirmed,
        payload: {'userId': userId, 'deviceId': _deviceId},
      ));
      _isSyncing = false;
      notifyListeners();
      return true;
    }

    final cleanCode = code.replaceAll('-', '').trim();
    try {
      final uri = Uri.parse('${AppConstants.backendBaseUrl}/watch/pair/verify-code');
      final res = await _client.post(
        uri,
        headers: _watchApiHeaders,
        body: jsonEncode({
          'code': cleanCode,
          'userId': userId,
        }),
      ).timeout(const Duration(seconds: 4));

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        _isPaired = true;
        _pairedUserId = userId;
        _connectionType = WatchConnectionType.cloudRelay;
        _deviceId = data['deviceId'] as String? ?? _deviceId;
        _latencyMs = 32;

        WearOsService.instance.setPaired(true);
        PedometerService.instance.setPaired(true);

        _broadcastInternal(WatchPacket.create(
          sender: WatchSender.phone,
          type: WatchPacketType.pairing,
          action: WatchAction.pairConfirmed,
          payload: {'userId': userId, 'deviceId': _deviceId},
        ));

        _savePersistedState();
        _isSyncing = false;
        notifyListeners();
        _startPeriodicHealthCheck();
        _fetchLatestVitals();
        return true;
      }

      if (res.statusCode == 409 || res.statusCode == 403 || res.statusCode == 400) {
        try {
          final errData = jsonDecode(res.body) as Map<String, dynamic>;
          _lastPairingError = errData['message'] as String? ?? 'Đồng hồ đã được ghép nối 1-1 với tài khoản khác.';
        } catch (_) {
          _lastPairingError = 'Không thể ghép nối với mã đã nhập.';
        }
        _isSyncing = false;
        notifyListeners();
        return false;
      }
    } catch (_) {
      // Nếu không có mạng Backend hoặc test cục bộ:
      _isPaired = true;
      _pairedUserId = userId;
      _connectionType = WatchConnectionType.inMemory;
      _pairingCode = code;

      WearOsService.instance.setPaired(true);
      PedometerService.instance.setPaired(true);

      _broadcastInternal(WatchPacket.create(
        sender: WatchSender.phone,
        type: WatchPacketType.pairing,
        action: WatchAction.pairConfirmed,
        payload: {'userId': userId, 'deviceId': _deviceId, 'offline': true},
      ));

      _savePersistedState();
      _isSyncing = false;
      notifyListeners();
      _startPeriodicHealthCheck();
      return true;
    }

    _isSyncing = false;
    notifyListeners();
    return false;
  }

  /// Tự động tìm deviceId đồng hồ thật đang phát OTP / online để ghép nối chính xác 1-1
  Future<String?> _discoverAvailableWatchDeviceId() async {
    try {
      final discoverUri = Uri.parse('${AppConstants.backendBaseUrl}/watch/pair/discover');
      final dRes = await _client.get(discoverUri, headers: _watchApiHeaders).timeout(const Duration(seconds: 2));
      if (dRes.statusCode == 200) {
        final dJson = jsonDecode(dRes.body) as Map<String, dynamic>;
        final devs = dJson['devices'] as List<dynamic>? ?? [];
        final free = devs.cast<Map>().where((d) => d['alreadyPaired'] != true).toList();
        if (free.isNotEmpty) {
          return free.first['deviceId']?.toString();
        }
      }
    } catch (_) {}

    try {
      final listUri = Uri.parse('${AppConstants.backendBaseUrl}/watch/devices');
      final lRes = await _client.get(listUri, headers: _watchApiHeaders).timeout(const Duration(seconds: 2));
      if (lRes.statusCode == 200) {
        final lJson = jsonDecode(lRes.body) as Map<String, dynamic>;
        final devs = (lJson['data']?['devices'] as List<dynamic>? ?? []);
        final freeOrMatched = devs.cast<Map>().where((d) => d['paired'] != true || d['userId'] == _pairedUserId).toList();
        if (freeOrMatched.isNotEmpty) {
          return freeOrMatched.first['deviceId']?.toString();
        }
      }
    } catch (_) {}
    return null;
  }

  /// 2b. GHÉP NỐI NHANH 1-CHẠM (QUICK PAIR 1-1)
  Future<bool> quickPairDevice({String? userId, String? deviceId}) async {
    _isSyncing = true;
    _lastPairingError = null;
    notifyListeners();

    if (deviceId != null) _deviceId = deviceId;
    final uId = userId ?? 'user_default';
    _pairedUserId = uId;

    if (kIsTesting) {
      _isPaired = true;
      _connectionType = WatchConnectionType.inMemory;
      WearOsService.instance.setPaired(true);
      PedometerService.instance.setPaired(true);
      _isSyncing = false;
      _broadcastInternal(WatchPacket.create(
        sender: WatchSender.phone,
        type: WatchPacketType.pairing,
        action: WatchAction.pairConfirmed,
        payload: {'userId': uId, 'deviceId': _deviceId, 'auto': true},
      ));
      _savePersistedState();
      notifyListeners();
      return true;
    }

    if (deviceId == null || deviceId.isEmpty) {
      final discovered = await _discoverAvailableWatchDeviceId();
      if (discovered != null && discovered.isNotEmpty) {
        _deviceId = discovered;
      }
    }

    try {
      final uri = Uri.parse('${AppConstants.backendBaseUrl}/watch/pair/auto-pair');
      final res = await _client.post(
        uri,
        headers: _watchApiHeaders,
        body: jsonEncode({
          'deviceId': _deviceId,
          'deviceModel': _deviceModel,
          'userId': uId,
        }),
      ).timeout(const Duration(seconds: 4));

      if (res.statusCode == 200) {
        _isPaired = true;
        _connectionType = WatchConnectionType.cloudRelay;
        _latencyMs = 24;
      } else if (res.statusCode == 409 || res.statusCode == 403) {
        try {
          final errData = jsonDecode(res.body) as Map<String, dynamic>;
          _lastPairingError = errData['message'] as String? ?? 'Đồng hồ đã được ghép nối 1-1 với tài khoản khác.';
        } catch (_) {
          _lastPairingError = 'Đồng hồ đã thuộc tài khoản khác.';
        }
        _isPaired = false;
        _isSyncing = false;
        notifyListeners();
        return false;
      } else {
        _isPaired = true;
        _connectionType = WatchConnectionType.inMemory;
      }
    } catch (_) {
      _isPaired = true;
      _connectionType = WatchConnectionType.inMemory;
    }

    WearOsService.instance.setPaired(true);
    PedometerService.instance.setPaired(true);
    _savePersistedState();
    _isSyncing = false;

    _broadcastInternal(WatchPacket.create(
      sender: WatchSender.phone,
      type: WatchPacketType.pairing,
      action: WatchAction.pairConfirmed,
      payload: {'userId': uId, 'deviceId': _deviceId, 'auto': true},
    ));

    notifyListeners();
    _startPeriodicHealthCheck();
    _fetchLatestVitals();
    return true;
  }

  /// 2c. HỦY GHÉP NỐI THIẾT BỊ (CHÍNH CHỦ)
  Future<void> unpairDevice() async {
    final prevOwnerId = _pairedUserId;
    _isPaired = false;
    _connectionType = WatchConnectionType.disconnected;
    stopPeriodicChecks();
    WearOsService.instance.setPaired(false);
    PedometerService.instance.setPaired(false);
    _savePersistedState();

    if (!kIsTesting) {
      try {
        final uri = Uri.parse('${AppConstants.backendBaseUrl}/watch/pair/unpair');
        await _client.post(
          uri,
          headers: _watchApiHeaders,
          body: jsonEncode({
            'deviceId': _deviceId,
            if (!isPlaceholderUserId(prevOwnerId)) 'userId': prevOwnerId,
          }),
        ).timeout(const Duration(seconds: 2));
      } catch (_) {}
    }

    _broadcastInternal(WatchPacket.create(
      sender: WatchSender.phone,
      type: WatchPacketType.pairing,
      action: WatchAction.alertCancelled,
      payload: {'deviceId': _deviceId, 'unpaired': true},
    ));

    notifyListeners();
  }

  /// 2d. ĐỒNG HỒ KIỂM TRA TRẠNG THÁI GHÉP NỐI TỪ BACKEND (TỰ ĐỒNG BỘ CHỦ SỞ HỮU 1-1)
  Future<bool> checkWatchPairingStatus() async {
    if (kIsTesting) return _isPaired;
    if (_isCheckingStatus) return _isPaired;
    _isCheckingStatus = true;
    try {
      final uri = Uri.parse('${AppConstants.backendBaseUrl}/watch/pair/status/$_deviceId');
      final res = await _client
          .get(uri, headers: _watchApiHeaders)
          .timeout(const Duration(seconds: 2));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final paired = data['paired'] as bool? ?? false;
        final serverUserId = data['userId']?.toString();
        bool changed = false;
        if (!isPlaceholderUserId(serverUserId) && _pairedUserId != serverUserId) {
          _pairedUserId = serverUserId;
          changed = true;
          fetchMedicalProfileFromBackend();
        }
        if (_isPaired != paired) {
          _isPaired = paired;
          _connectionType = paired ? WatchConnectionType.cloudRelay : WatchConnectionType.disconnected;
          WearOsService.instance.setPaired(paired);
          PedometerService.instance.setPaired(paired);
          changed = true;
        }
        if (changed) {
          _savePersistedState();
          notifyListeners();
        }
        return _isPaired;
      }
    } catch (_) {
    } finally {
      _isCheckingStatus = false;
    }
    return _isPaired;
  }

  /// 3. GỬI GÓI TIN SSWP ĐI (Ưu tiên Wear OS Data Layer Bluetooth < 100ms, song song Cloud Relay)
  Future<void> sendPacket(WatchPacket packet) async {
    final enrichedPayload = <String, dynamic>{
      ...packet.payload,
      if (!packet.payload.containsKey('deviceId')) 'deviceId': _deviceId,
      if (_pairedUserId != null && !packet.payload.containsKey('userId')) 'userId': _pairedUserId,
    };
    final outgoing = WatchPacket(
      protocol: packet.protocol,
      messageId: packet.messageId,
      timestamp: packet.timestamp,
      sender: packet.sender,
      type: packet.type,
      action: packet.action,
      payload: enrichedPayload,
    );
    _lastPacket = outgoing;
    _addPacketToHistory(outgoing);

    // Phát nội bộ trước để UI phản hồi ngay (0ms latency)
    _packetController.add(outgoing);

    final serialized = jsonEncode(outgoing.toJson());

    // Tầng ưu tiên 1 (< 100ms): Wear OS Data Layer (MessageClient) trực tiếp qua Bluetooth
    if (!kIsTesting && _wearDataLayerSender != null) {
      try {
        final btRes = await _wearDataLayerSender!('/safesolo/packet', serialized);
        if (btRes['sent'] == true) {
          _isWearDataLayerConnected = true;
          _connectionType = WatchConnectionType.localBle;
          final latVal = btRes['latencyMs'];
          if (latVal is int && latVal >= 0) {
            _latencyMs = latVal;
          }
        }
      } catch (e) {
        debugPrint('[WatchSyncManager] Wear Data Layer BT send error: $e');
      }
    }

    // Tầng 2: Đồng bộ lên Cloud Relay (nếu Watch đang mất Wi-Fi ngoài đường, Phone đã nhận qua BT sẽ tự relay bước dưới)
    if (!kIsTesting) {
      try {
        final uri = Uri.parse('${AppConstants.backendBaseUrl}/watch/packet');
        await _client.post(
          uri,
          headers: _watchApiHeaders,
          body: serialized,
        ).timeout(const Duration(seconds: 3));
      } catch (e) {
        debugPrint('[WatchSyncManager] Error sending packet to backend: $e');
      }
    }

    notifyListeners();
  }

  /// Tiếp nhận gói tin trực tiếp từ Android Wear OS Data Layer / Watch Tile
  Future<void> handleNativeWearBridgeEvent(Map<String, dynamic> event) async {
    final sensorType = event['sensorType'] as String?;
    if (sensorType == 'WEAR_TILE_ACTION' || sensorType == 'WEAR_LAUNCH_ACTION') {
      final action = event['action'] as String? ?? '';
      if (action == WatchAction.deadmanCheckin) {
        emitDeadmanCheckin(mood: 'Wear OS Tile 1-chạm', userId: _pairedUserId);
      } else if (action == WatchAction.hardwareSos) {
        emitHardwareSos(userId: _pairedUserId);
      }
      return;
    }

    final payloadJson = event['payloadJson'] as String?;
    if (payloadJson == null || payloadJson.isEmpty) return;

    try {
      final decoded = jsonDecode(payloadJson);
      if (decoded is! Map) return;
      final packet = WatchPacket.fromJson(Map<String, dynamic>.from(decoded));

      _isWearDataLayerConnected = true;
      _connectionType = WatchConnectionType.localBle;
      final rawTs = event['timestamp'] as int?;
      if (rawTs != null) {
        _latencyMs = (DateTime.now().millisecondsSinceEpoch - rawTs).clamp(1, 200);
      }

      // 1. Đẩy vào luồng xử lý sự kiện Watch <-> Phone ngay lập tức (< 100ms BT)
      _broadcastInternal(packet);
      _handleIncomingPacket(packet);

      // 2. Nếu đây là Điện thoại nhận gói tin từ Watch qua Bluetooth ngoài đường:
      //    Tự động chuyển tiếp (relay) lên Backend; nếu mất mạng hoàn toàn & là SOS -> kích hoạt SMS fallback!
      if (!_isRunningOnWatch && packet.sender == WatchSender.watch && (!kIsTesting || cloudRelayOverrideForTest != null)) {
        bool relayOk = false;
        try {
          if (cloudRelayOverrideForTest != null) {
            relayOk = await cloudRelayOverrideForTest!(packet);
          } else {
            final uri = Uri.parse('${AppConstants.backendBaseUrl}/watch/packet');
            final resp = await _client.post(
              uri,
              headers: _watchApiHeaders,
              body: jsonEncode(packet.toJson()),
            ).timeout(const Duration(seconds: 3));
            relayOk = resp.statusCode >= 200 && resp.statusCode < 300;
          }
        } catch (e) {
          debugPrint('[WatchSyncManager] BT->Cloud relay offline ($e)');
        }

        const emergencyActions = {
          WatchAction.fallDetected,
          WatchAction.accidentCrash,
          WatchAction.freeFallImpact,
          WatchAction.hardwareSos,
          WatchAction.duressSos,
          WatchAction.cardiacDistress,
          WatchAction.hypoxiaRisk,
        };
        if (!relayOk && emergencyActions.contains(packet.action)) {
          debugPrint('[WatchSyncManager] Offline BT SOS -> invoking Phone SmsManager fallback!');
          await onOfflineEmergencyFallback?.call(packet.action, packet.payload);
        }
      }
    } catch (e) {
      debugPrint('[WatchSyncManager] handleNativeWearBridgeEvent parse error: $e');
    }
  }

  void _addPacketToHistory(WatchPacket packet) {
    _recentPackets.insert(0, packet);
    if (_recentPackets.length > 30) {
      _recentPackets.removeLast();
    }
  }

  void _broadcastInternal(WatchPacket packet) {
    _lastPacket = packet;
    _addPacketToHistory(packet);
    _packetController.add(packet);
    notifyListeners();
  }

  bool _markMessageProcessed(String messageId) {
    if (messageId.isEmpty) return true;
    if (!_processedMessageIds.add(messageId)) {
      return false;
    }
    _processedMessageOrder.add(messageId);
    if (_processedMessageOrder.length > 150) {
      final oldest = _processedMessageOrder.removeAt(0);
      _processedMessageIds.remove(oldest);
    }
    return true;
  }

  /// 4. XỬ LÝ GÓI TIN ĐẾN (INCOMING PACKET HANDLER)
  void _handleIncomingPacket(WatchPacket packet) {
    // Chỉ xử lý gói tin từ thiết bị đối tác
    if (_isRunningOnWatch && packet.sender == WatchSender.watch) {
      return; // Bỏ qua gói tin do chính đồng hồ vừa phát ra
    }
    if (!_isRunningOnWatch && packet.sender == WatchSender.phone) {
      return; // Bỏ qua gói tin do chính điện thoại vừa phát ra
    }
    if (!_markMessageProcessed(packet.messageId)) {
      return; // Bỏ qua gói tin trùng lặp (đã xử lý qua kênh nội bộ/poll khác)
    }

    final wearOs = WearOsService.instance;

    switch (packet.action) {
      // Nhận lệnh từ điện thoại: Tìm đồng hồ (Rung Haptic trên đồng hồ)
      case WatchAction.findWatchPing:
        HapticFeedback.heavyImpact();
        for (int i = 1; i <= 4; i++) {
          Future.delayed(Duration(milliseconds: i * 400), () => HapticFeedback.heavyImpact());
        }
        onFindWatchPingReceived?.call();
        if (packet.sender == WatchSender.toc) {
          emitCommandAck(
            ackAction: WatchAction.findWatchPing,
            status: 'VIBRATING_ON_WATCH',
            note: 'Galaxy Watch 5 đã rung chuông kiểm tra phản xạ từ lệnh TOC',
          );
        }
        debugPrint('[WatchSyncManager] Received FIND_WATCH_PING: triggering haptic vibration on watch!');
        break;

      // Nhận lệnh từ đồng hồ: Tìm điện thoại (Rung Haptic & Chuông trên điện thoại)
      case WatchAction.findPhonePing:
        HapticFeedback.heavyImpact();
        for (int i = 1; i <= 4; i++) {
          Future.delayed(Duration(milliseconds: i * 400), () => HapticFeedback.heavyImpact());
        }
        onFindPhonePingReceived?.call();
        debugPrint('[WatchSyncManager] Received FIND_PHONE_PING from watch: ringing phone!');
        break;

      // Nhận lệnh từ điện thoại: Bắt đầu chu trình đo BioActive PPG chuẩn xác
      case WatchAction.instantMeasureReq:
      case WatchAction.precisionMeasureStart:
        if (onInstantMeasureReqReceived != null) {
          onInstantMeasureReqReceived?.call();
        } else {
          wearOs.startPrecisionMeasurement(force: true);
        }
        if (packet.sender == WatchSender.toc) {
          emitCommandAck(
            ackAction: WatchAction.instantMeasureReq,
            status: 'MEASURING_BIOACTIVE_PPG',
            note: 'Galaxy Watch 5 đã nhận lệnh TOC và bắt đầu đo nhịp tim/SpO2',
          );
        }
        debugPrint('[WatchSyncManager] Received INSTANT_MEASURE_REQ: BioActive PPG measurement triggered!');
        break;

      // Nhận xác nhận điều phối cứu hộ từ Trung tâm Chỉ huy TOC lên Đồng hồ
      case WatchAction.tocDispatchAck:
        HapticFeedback.heavyImpact();
        for (int i = 1; i <= 3; i++) {
          Future.delayed(Duration(milliseconds: i * 350), () => HapticFeedback.heavyImpact());
        }
        onTocDispatchAckReceived?.call(packet.payload);
        if (packet.sender == WatchSender.toc) {
          emitCommandAck(
            ackAction: WatchAction.tocDispatchAck,
            status: 'DISPLAYED_ON_WATCH',
            note: 'Đã hiển thị thông báo cứu hộ TOC trên màn hình đồng hồ',
          );
        }
        debugPrint('[WatchSyncManager] Received TOC_DISPATCH_ACK: ${packet.payload}');
        break;

      // Xác nhận đồng hồ đã thực thi lệnh
      case WatchAction.watchCommandAck:
        debugPrint('[WatchSyncManager] Watch ACK received: ${packet.payload}');
        break;

      // Nhận kết quả đo chuẩn xác từ đồng hồ
      case WatchAction.precisionMeasureResult:
        final p = packet.payload;
        final bpm = p['heartRate'] as int?;
        final spo2 = p['spO2'] as int?;
        if (bpm != null || spo2 != null) {
          wearOs.updateMetrics(
            heartRate: bpm,
            spO2: spo2,
            broadcast: false,
          );
          PedometerService.instance.updateFromWatchSimulator(
            steps: PedometerService.instance.steps,
            heartRate: bpm ?? PedometerService.instance.heartRate,
            spO2: spo2 ?? PedometerService.instance.spO2,
            battery: PedometerService.instance.battery,
            isOffWrist: false,
          );
        }
        onPrecisionMeasureResultReceived?.call(bpm ?? 72, spo2 ?? 98);
        debugPrint('[WatchSyncManager] Received PRECISION_MEASURE_RESULT: BPM=$bpm, SpO2=$spo2%');
        break;

      // Nhận sự kiện từ đồng hồ: Điểm danh Deadman thành công
      case WatchAction.deadmanCheckin:
        final mood = packet.payload['mood'] as String? ?? 'Tuyệt vời';
        debugPrint('[WatchSyncManager] Received DEADMAN_CHECKIN from watch: resetting phone timer! Mood: $mood');
        PedometerService.instance.notifyListeners();
        onWatchCheckinReceived?.call(mood);
        break;

      // Nhận sự kiện từ đồng hồ: Té ngã
      case WatchAction.fallDetected:
        debugPrint('[WatchSyncManager] Received FALL_DETECTED from watch: ${packet.payload}');
        onWatchEmergencyReceived?.call(packet.action, packet.payload);
        break;

      // Nhận sự kiện từ đồng hồ: Tai nạn giao thông / Va chạm mạnh
      case WatchAction.accidentCrash:
      case WatchAction.freeFallImpact:
      case WatchAction.cardiacDistress:
      case WatchAction.hypoxiaRisk:
        debugPrint('[WatchSyncManager] Received ${packet.action} from watch: ${packet.payload}');
        onWatchEmergencyReceived?.call(packet.action, packet.payload);
        break;

      // Nhận sự kiện từ đồng hồ: SOS khẩn cấp
      case WatchAction.hardwareSos:
        debugPrint('[WatchSyncManager] Received HARDWARE_SOS from watch');
        onWatchEmergencyReceived?.call(packet.action, packet.payload);
        break;

      // Nhận sự kiện từ đồng hồ: Duress SOS ngầm (Silent Duress Alarm)
      case WatchAction.duressSos:
        debugPrint('[WatchSyncManager] Received DURESS_SOS from watch: Silent emergency triggered!');
        onWatchEmergencyReceived?.call(packet.action, packet.payload);
        break;

      // Nhận đồng bộ cấu hình PIN từ điện thoại sang đồng hồ
      case WatchAction.pinConfigSync:
        final sPin = packet.payload['safePin'] as String?;
        final dPin = packet.payload['duressPin'] as String?;
        wearOs.setPins(safePin: sPin, duressPin: dPin);
        debugPrint('[WatchSyncManager] Received PIN_CONFIG_SYNC: safePin=$sPin, duressPin=$dPin');
        break;

      // Nhận đồng bộ hồ sơ y tế thực tế từ điện thoại sang đồng hồ
      case WatchAction.medicalProfileSync:
        final p = packet.payload;
        if (p.isNotEmpty) {
          _updateMedicalProfileFromMap(p);
          debugPrint('[WatchSyncManager] Received MEDICAL_PROFILE_SYNC: name=${p['fullName']}, blood=${p['bloodType']}');
        }
        break;

      // Nhận đồng bộ thời gian từ điện thoại sang đồng hồ
      case WatchAction.timerSync:
        final rem = packet.payload['remainingSeconds'] as int?;
        final dl = packet.payload['deadline'] as String? ?? '';
        if (rem != null) {
          onTimerSyncReceived?.call(rem, dl);
        }
        break;

      // Nhận cập nhật sinh tồn định kỳ
      case WatchAction.vitalsUpdate:
        if (packet.sender == WatchSender.watch && _isRunningOnWatch) {
          break; // Bỏ qua gói tin do chính đồng hồ vừa phát ra nếu đang chạy trên đồng hồ
        }
        final p = packet.payload;
        final hr = p['heartRate'] as int?;
        final spo2 = p['spO2'] as int?;
        final st = p['steps'] as int?;
        final bat = p['battery'] as int?;
        final off = p['isOffWrist'] as bool?;

        wearOs.updateMetrics(
          heartRate: hr,
          spO2: spo2,
          steps: st,
          battery: bat,
          isOffWrist: off,
          broadcast: false,
        );
        PedometerService.instance.updateFromWatchSimulator(
          steps: st ?? PedometerService.instance.steps,
          heartRate: hr ?? PedometerService.instance.heartRate,
          spO2: spo2 ?? PedometerService.instance.spO2,
          battery: bat ?? PedometerService.instance.battery,
          isOffWrist: off ?? PedometerService.instance.isOffWrist,
        );
        break;

      // Nhận lệnh hủy cảnh báo ("Tôi ổn")
      case WatchAction.alertCancelled:
        wearOs.cancelEmergency();
        onAlertCancelledReceived?.call();
        break;

      // Nhận lệnh hỏi thăm khi lệch tuyến > 300m hoặc đứng im > 3 phút (Phone/Backend -> Watch 5)
      case WatchAction.routeDeviationCheck:
        HapticFeedback.heavyImpact();
        onRouteDeviationCheckReceived?.call(packet.payload);
        debugPrint('[WatchSyncManager] Received ROUTE_DEVIATION_CHECK: ${packet.payload['reason']}');
        break;

      // Nhận xác nhận "Tôi ổn" từ Watch 5 -> Phone dừng đếm ngược 30s Lệch tuyến
      case WatchAction.journeyCheckSafe:
        onJourneyCheckSafeReceived?.call(packet.payload);
        debugPrint('[WatchSyncManager] Received JOURNEY_CHECK_SAFE from Watch 5!');
        break;
    }
  }

  // ===========================================================================
  // CÁC HÀM TIỆN ÍCH DÀNH CHO CẢ WATCH & PHONE
  // ===========================================================================

  /// Watch phát gói tin sinh tồn (Telemetry) kèm sóng IMU / PPG 3 pha
  void emitVitalsTelemetry({
    required int heartRate,
    required int spO2,
    required int steps,
    required int battery,
    required bool isOffWrist,
    double? svmG,
    double? tiltAngle,
    List<double>? gForceWaveform,
    List<double>? ppgWaveform,
    Map<String, dynamic>? fusionMetadata,
  }) {
    if (!kIsTesting && !_isRunningOnWatch && (!_isPaired || isPlaceholderUserId(_pairedUserId))) {
      return; // Chặn điện thoại chưa ghép 1-1 phát nhầm telemetry Watch
    }
    final fusion = FallFusionEngine.instance;
    final effectiveGForce = gForceWaveform ?? fusion.gForceWaveform;
    final effectivePpg = ppgWaveform ?? fusion.ppgWaveform;
    final effectiveFusion = fusionMetadata ?? fusion.toFusionPayload();

    if (!kIsTesting) {
      _wearTileSync?.call(
        deviceId: _deviceId,
        pairedUserId: _pairedUserId,
        userName: _medicalFullName,
        isPaired: _isPaired,
      );
      try {
        final uri = Uri.parse('${AppConstants.backendBaseUrl}/watch/vitals');
        _client.post(
          uri,
          headers: _watchApiHeaders,
          body: jsonEncode({
            'deviceId': _deviceId,
            if (_pairedUserId != null) 'userId': _pairedUserId,
            'heartRate': heartRate,
            'spO2': spO2,
            'steps': steps,
            'battery': battery,
            'isOffWrist': isOffWrist,
            if (svmG != null) 'svmG': svmG,
            if (tiltAngle != null) 'tiltAngle': tiltAngle,
            'gForceWaveform': effectiveGForce,
            'ppgWaveform': effectivePpg,
            'fusion': effectiveFusion,
          }),
        ).timeout(const Duration(seconds: 2)).catchError((_) => http.Response('', 500));
      } catch (_) {}
    }

    // Đồng thời phát gói tin SSWP (qua Wear Data Layer BT + Cloud)
    sendPacket(WatchPacket.create(
      sender: WatchSender.watch,
      type: WatchPacketType.telemetry,
      action: WatchAction.vitalsUpdate,
      payload: {
        'deviceId': _deviceId,
        if (_pairedUserId != null) 'userId': _pairedUserId,
        'heartRate': heartRate,
        'spO2': spO2,
        'steps': steps,
        'battery': battery,
        'isOffWrist': isOffWrist,
        if (svmG != null) 'svmG': svmG,
        if (tiltAngle != null) 'tiltAngle': tiltAngle,
        'gForceWaveform': effectiveGForce,
        'ppgWaveform': effectivePpg,
        'fusion': effectiveFusion,
      },
    ));
  }

  /// Watch phát sự kiện Té ngã (đính kèm bằng chứng Fusion 3 pha & sóng G-Force/PPG)
  void emitFallAlert({
    required double svm,
    required double tilt,
    bool isSimulated = false,
    List<double>? gForceWaveform,
    List<double>? ppgWaveform,
    Map<String, dynamic>? fusionMetadata,
  }) {
    final fusion = FallFusionEngine.instance;
    sendPacket(WatchPacket.create(
      sender: WatchSender.watch,
      type: WatchPacketType.emergency,
      action: WatchAction.fallDetected,
      payload: {
        'deviceId': _deviceId,
        'svmG': svm,
        'tiltAngle': tilt,
        'isSimulated': isSimulated,
        'gForceWaveform': gForceWaveform ?? fusion.gForceWaveform,
        'ppgWaveform': ppgWaveform ?? fusion.ppgWaveform,
        'fusion': fusionMetadata ?? fusion.toFusionPayload(),
        'alert': 'Phát hiện va đập $svm g và góc nghiêng $tilt° từ Samsung Galaxy Watch 5',
      },
    ));
  }

  /// Watch phát sự kiện Tai nạn va chạm giao thông xung lực mạnh
  void emitAccidentCrashAlert({
    required double svm,
    required double tilt,
    required int heartRate,
    required int spO2,
    String? accidentType,
    bool isSimulated = false,
  }) {
    sendPacket(WatchPacket.create(
      sender: WatchSender.watch,
      type: WatchPacketType.emergency,
      action: WatchAction.accidentCrash,
      payload: {
        'deviceId': _deviceId,
        'svmG': svm,
        'tiltAngle': tilt,
        'heartRate': heartRate,
        'spO2': spO2,
        'accidentType': accidentType ?? 'VEHICULAR_CRASH',
        'isSimulated': isSimulated,
        'title': '🚨 PHÁT HIỆN TAI NẠN VA CHẠM TỪ GALAXY WATCH 5',
        'alert': 'Cảm biến IMU phát hiện va chạm cực mạnh ($svm g) và góc nghiêng $tilt°!',
        'timestamp': DateTime.now().toIso8601String(),
      },
    ));
  }

  /// Watch phát sự kiện Rơi tự do & Va đập độ cao
  void emitFreeFallAlert({
    required double svm,
    required double tilt,
    required int heartRate,
    bool isSimulated = false,
  }) {
    sendPacket(WatchPacket.create(
      sender: WatchSender.watch,
      type: WatchPacketType.emergency,
      action: WatchAction.freeFallImpact,
      payload: {
        'deviceId': _deviceId,
        'svmG': svm,
        'tiltAngle': tilt,
        'heartRate': heartRate,
        'accidentType': 'FREE_FALL_IMPACT',
        'isSimulated': isSimulated,
        'title': '⚠️ PHÁT HIỆN RƠI TỰ DO & VA ĐẬP TỪ GALAXY WATCH 5',
        'alert': 'Cảm biến phát hiện rơi ngã độ cao/cầu thang với lực va chạm $svm g!',
        'timestamp': DateTime.now().toIso8601String(),
      },
    ));
  }

  /// Watch phát sự kiện Rủi ro nhịp tim / SpO2 cấp tính
  void emitCardiacDistressAlert({
    required int heartRate,
    required int spO2,
    required String condition,
    bool isSimulated = false,
  }) {
    sendPacket(WatchPacket.create(
      sender: WatchSender.watch,
      type: WatchPacketType.emergency,
      action: WatchAction.cardiacDistress,
      payload: {
        'deviceId': _deviceId,
        'heartRate': heartRate,
        'spO2': spO2,
        'condition': condition,
        'isSimulated': isSimulated,
        'title': '💓 CẢNH BÁO RỦI RO SINH TỒN NGUY CẤP (GALAXY WATCH 5)',
        'alert': 'Cảm biến BioActive phát hiện $condition: Nhịp tim $heartRate BPM, SpO2 $spO2%!',
        'timestamp': DateTime.now().toIso8601String(),
      },
    ));
  }

  /// Watch phát phím cứng SOS
  void emitHardwareSos({String? userId}) {
    sendPacket(WatchPacket.create(
      sender: WatchSender.watch,
      type: WatchPacketType.emergency,
      action: WatchAction.hardwareSos,
      payload: {
        'deviceId': _deviceId,
        'userId': userId,
        'alert': 'Kích hoạt phím SOS phần cứng trên Samsung Galaxy Watch 5',
      },
    ));
  }

  /// Watch phát tín hiệu Duress SOS ngầm (Mã PIN cưỡng bức 9999)
  void emitDuressSos({String? userId}) {
    sendPacket(WatchPacket.create(
      sender: WatchSender.watch,
      type: WatchPacketType.emergency,
      action: WatchAction.duressSos,
      payload: {
        'deviceId': _deviceId,
        'userId': userId,
        'isDuress': true,
        'silent': true,
        'alert': 'BÁO ĐỘNG CƯỠNG BỨC (DURESS): Người dùng bị ép nhập mã PIN giải phóng trên đồng hồ!',
        'timestamp': DateTime.now().toIso8601String(),
      },
    ));
  }

  /// Phone gửi lệnh đồng bộ cấu hình PIN sang đồng hồ
  void sendPinConfigSync({required String safePin, required String duressPin}) {
    sendPacket(WatchPacket.create(
      sender: WatchSender.phone,
      type: WatchPacketType.command,
      action: WatchAction.pinConfigSync,
      payload: {
        'deviceId': _deviceId,
        'safePin': safePin,
        'duressPin': duressPin,
      },
    ));
  }

  /// Watch phát điểm danh thành công
  void emitDeadmanCheckin({String mood = 'Tuyệt vời', String? userId}) {
    sendPacket(WatchPacket.create(
      sender: WatchSender.watch,
      type: WatchPacketType.telemetry,
      action: WatchAction.deadmanCheckin,
      payload: {
        'deviceId': _deviceId,
        'userId': userId,
        'mood': mood,
        'timestamp': DateTime.now().toIso8601String(),
      },
    ));
  }

  /// Phone đẩy ping rung xuống Watch 5 hỏi "Bạn ổn chứ?" khi Lệch tuyến >300m / Đứng im >3p
  void sendRouteDeviationCheck({
    required String journeyId,
    required String reason,
    String anomalyType = 'ROUTE_DEVIATION',
    double? deviationMeters,
    int? stationarySeconds,
  }) {
    sendPacket(WatchPacket.create(
      sender: WatchSender.phone,
      type: WatchPacketType.command,
      action: WatchAction.routeDeviationCheck,
      payload: {
        'deviceId': _deviceId,
        'journeyId': journeyId,
        'anomalyType': anomalyType,
        'reason': reason,
        'prompt': 'Bạn ổn chứ?',
        if (deviationMeters != null) 'deviationMeters': deviationMeters.round(),
        if (stationarySeconds != null) 'stationarySeconds': stationarySeconds,
        'responseTimeoutSeconds': 30,
        'timestamp': DateTime.now().toIso8601String(),
      },
    ));
  }

  /// Watch 5 xác nhận "Tôi ổn" trả lời ping Lệch tuyến / Đứng im
  void emitJourneyCheckSafe({String? journeyId, String? userId}) {
    sendPacket(WatchPacket.create(
      sender: WatchSender.watch,
      type: WatchPacketType.ack,
      action: WatchAction.journeyCheckSafe,
      payload: {
        'deviceId': _deviceId,
        if (userId != null) 'userId': userId,
        if (journeyId != null) 'journeyId': journeyId,
        'status': 'SAFE_CONFIRMED',
        'timestamp': DateTime.now().toIso8601String(),
      },
    ));
  }

  /// Phone gửi lệnh tìm đồng hồ (Rung)
  void sendFindWatchPing() {
    HapticFeedback.heavyImpact();
    sendPacket(WatchPacket.create(
      sender: WatchSender.phone,
      type: WatchPacketType.command,
      action: WatchAction.findWatchPing,
      payload: {
        'deviceId': _deviceId,
        'vibratePattern': [500, 200, 500],
      },
    ));
  }

  /// Phone gửi lệnh đo nhịp tim tức thì
  void sendInstantMeasureRequest() {
    sendPacket(WatchPacket.create(
      sender: WatchSender.phone,
      type: WatchPacketType.command,
      action: WatchAction.instantMeasureReq,
      payload: {
        'deviceId': _deviceId,
        'sensor': 'BIOACTIVE_PPG',
      },
    ));
  }

  /// Đồng bộ hẹn giờ Dead-man's switch từ Phone sang Watch
  void sendTimerSync({required int remainingSeconds, required String deadline}) {
    sendPacket(WatchPacket.create(
      sender: WatchSender.phone,
      type: WatchPacketType.command,
      action: WatchAction.timerSync,
      payload: {
        'deviceId': _deviceId,
        'remainingSeconds': remainingSeconds,
        'deadline': deadline,
      },
    ));
  }

  /// Watch phát kết quả đo chuẩn xác BioActive PPG 10s
  void emitPrecisionMeasureResult({
    required int heartRate,
    required int spO2,
  }) {
    sendPacket(WatchPacket.create(
      sender: WatchSender.watch,
      type: WatchPacketType.telemetry,
      action: WatchAction.precisionMeasureResult,
      payload: {
        'deviceId': _deviceId,
        'heartRate': heartRate,
        'spO2': spO2,
        'protocol': 'BIOACTIVE_CLINICAL_10S',
        'timestamp': DateTime.now().toIso8601String(),
      },
    ));
  }

  /// Watch gửi lệnh tìm điện thoại (Rung & Chuông trên điện thoại)
  void sendFindPhonePing() {
    HapticFeedback.heavyImpact();
    sendPacket(WatchPacket.create(
      sender: WatchSender.watch,
      type: WatchPacketType.command,
      action: WatchAction.findPhonePing,
      payload: {
        'deviceId': _deviceId,
        'action': 'RING_PHONE_NOW',
        'timestamp': DateTime.now().toIso8601String(),
      },
    ));
  }

  /// Hủy cảnh báo ("Tôi an toàn")
  void sendAlertCancelled() {
    sendPacket(WatchPacket.create(
      sender: WatchSender.phone,
      type: WatchPacketType.command,
      action: WatchAction.alertCancelled,
      payload: {'deviceId': _deviceId, 'by': 'user_confirm'},
    ));
  }

  /// Đồng hồ gửi xác nhận (ACK) đã nhận & thực thi lệnh từ TOC / Phone
  void emitCommandAck({
    required String ackAction,
    String status = 'EXECUTED',
    String? note,
  }) {
    sendPacket(WatchPacket.create(
      sender: WatchSender.watch,
      type: WatchPacketType.ack,
      action: WatchAction.watchCommandAck,
      payload: {
        'deviceId': _deviceId,
        if (_pairedUserId != null) 'userId': _pairedUserId,
        'ackAction': ackAction,
        'status': status,
        if (note != null) 'note': note,
        'heartRate': WearOsService.instance.heartRate,
        'spO2': WearOsService.instance.spO2,
        'battery': WearOsService.instance.battery,
        'isOffWrist': WearOsService.instance.isOffWrist,
        'acknowledgedAt': DateTime.now().toIso8601String(),
      },
    ));
  }

  @override
  void dispose() {
    _cloudPollTimer?.cancel();
    _packetController.close();
    _client.close();
    super.dispose();
  }
}
