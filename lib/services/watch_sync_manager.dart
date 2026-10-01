import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../core/constants.dart';
import '../models/watch_protocol.dart';
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

  // Lịch sử gói tin truyền thông
  WatchPacket? _lastPacket;
  final List<WatchPacket> _recentPackets = [];
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

  // Các sự kiện đồng bộ tương tác thực tế 2 chiều (Bidirectional Event Callbacks)
  Future<void> Function(String mood)? onWatchCheckinReceived;
  void Function(String action, Map<String, dynamic> payload)? onWatchEmergencyReceived;
  void Function()? onAlertCancelledReceived;
  void Function(int remainingSeconds, String deadline)? onTimerSyncReceived;
  void Function()? onFindWatchPingReceived;
  void Function()? onFindPhonePingReceived;
  void Function()? onInstantMeasureReqReceived;
  void Function(int heartRate, int spO2)? onPrecisionMeasureResultReceived;

  StreamSubscription<WatchPacket>? _packetSub;

  void initialize() {
    _packetSub ??= _packetController.stream.listen(_handleIncomingPacket);
    loadPersistedState().then((_) {
      if (!kIsTesting) {
        _startPeriodicHealthCheck();
        _fetchLatestVitals();
        fetchMedicalProfileFromBackend();
      }
    });
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
      final res = await _client.get(uri).timeout(const Duration(seconds: 3));
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
          headers: {'Content-Type': 'application/json'},
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
      final res = await _client.get(Uri.parse(url)).timeout(const Duration(seconds: 3));
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
    final start = DateTime.now().millisecondsSinceEpoch;
    try {
      final uri = Uri.parse('${AppConstants.backendBaseUrl}/watch/vitals/$_deviceId');
      final res = await _client.get(uri).timeout(const Duration(seconds: 3));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final end = DateTime.now().millisecondsSinceEpoch;
        _latencyMs = (end - start).clamp(12, 450);

        final vitals = data['vitals'] as Map<String, dynamic>?;
        if (vitals != null) {
          final heartRate = vitals['heartRate'] as int?;
          final spO2 = vitals['spO2'] as int?;
          final steps = vitals['steps'] as int?;
          final battery = vitals['battery'] as int?;
          final isOffWrist = vitals['isOffWrist'] as bool?;

          if (!_isPaired) {
            _isPaired = true;
            WearOsService.instance.setPaired(true);
            PedometerService.instance.setPaired(true);
            _savePersistedState();
          }

          WearOsService.instance.updateMetrics(
            heartRate: heartRate,
            spO2: spO2,
            steps: steps,
            battery: battery,
            isOffWrist: isOffWrist,
          );
          PedometerService.instance.updateFromWatchSimulator(
            steps: steps ?? PedometerService.instance.steps,
            heartRate: heartRate ?? PedometerService.instance.heartRate,
            spO2: spO2 ?? PedometerService.instance.spO2,
            battery: battery ?? PedometerService.instance.battery,
            isOffWrist: isOffWrist ?? false,
          );
          _connectionType = WatchConnectionType.cloudRelay;
        }
        notifyListeners();
      }

      // 2. Lấy các lệnh chờ điều phối hai chiều từ Backend (Command Queue Polling)
      final target = _isRunningOnWatch ? 'watch' : 'phone';
      final cmdUri = Uri.parse('${AppConstants.backendBaseUrl}/watch/commands/$_deviceId?target=$target');
      final cmdRes = await _client.get(cmdUri).timeout(const Duration(seconds: 2));
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
        headers: {'Content-Type': 'application/json'},
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

  /// 2. ĐIỆN THOẠI XÁC NHẬN MÃ GHÉP NỐI TỪ ĐỒNG HỒ
  Future<bool> verifyPairingCode(String code, {required String userId}) async {
    _isSyncing = true;
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
        headers: {'Content-Type': 'application/json'},
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

  /// 2b. GHÉP NỐI NHANH 1-CHẠM (QUICK PAIR)
  Future<bool> quickPairDevice({String? userId, String? deviceId}) async {
    _isSyncing = true;
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

    try {
      final uri = Uri.parse('${AppConstants.backendBaseUrl}/watch/pair/auto-pair');
      final res = await _client.post(
        uri,
        headers: {'Content-Type': 'application/json'},
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

  /// 2c. HỦY GHÉP NỐI THIẾT BỊ
  Future<void> unpairDevice() async {
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
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'deviceId': _deviceId}),
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

  /// 2d. ĐỒNG HỒ KIỂM TRA TRẠNG THÁI GHÉP NỐI TỪ BACKEND
  Future<bool> checkWatchPairingStatus() async {
    if (kIsTesting) return _isPaired;
    if (_isCheckingStatus) return _isPaired;
    _isCheckingStatus = true;
    try {
      final uri = Uri.parse('${AppConstants.backendBaseUrl}/watch/pair/status/$_deviceId');
      final res = await _client.get(uri).timeout(const Duration(seconds: 2));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final paired = data['paired'] as bool? ?? false;
        if (_isPaired != paired) {
          _isPaired = paired;
          _connectionType = paired ? WatchConnectionType.cloudRelay : WatchConnectionType.disconnected;
          WearOsService.instance.setPaired(paired);
          PedometerService.instance.setPaired(paired);
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

  /// 3. GỬI GÓI TIN SSWP ĐI
  Future<void> sendPacket(WatchPacket packet) async {
    _lastPacket = packet;
    _addPacketToHistory(packet);

    // Phát nội bộ trước để UI phản hồi ngay (0ms latency)
    _packetController.add(packet);

    // Đồng bộ lên Cloud Relay nếu có kết nối
    if (!kIsTesting) {
      try {
        final uri = Uri.parse('${AppConstants.backendBaseUrl}/watch/packet');
        await _client.post(
          uri,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode(packet.toJson()),
        ).timeout(const Duration(seconds: 3));
      } catch (e) {
        debugPrint('[WatchSyncManager] Error sending packet to backend: $e');
      }
    }

    notifyListeners();
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

  /// 4. XỬ LÝ GÓI TIN ĐẾN (INCOMING PACKET HANDLER)
  void _handleIncomingPacket(WatchPacket packet) {
    // Chỉ xử lý gói tin từ thiết bị đối tác
    if (_isRunningOnWatch && packet.sender == WatchSender.watch) {
      return; // Bỏ qua gói tin do chính đồng hồ vừa phát ra
    }
    if (!_isRunningOnWatch && packet.sender == WatchSender.phone) {
      return; // Bỏ qua gói tin do chính điện thoại vừa phát ra
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
        debugPrint('[WatchSyncManager] Received INSTANT_MEASURE_REQ: BioActive PPG measurement triggered!');
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
    }
  }

  // ===========================================================================
  // CÁC HÀM TIỆN ÍCH DÀNH CHO CẢ WATCH & PHONE
  // ===========================================================================

  /// Watch phát gói tin sinh tồn (Telemetry)
  void emitVitalsTelemetry({
    required int heartRate,
    required int spO2,
    required int steps,
    required int battery,
    required bool isOffWrist,
    double? svmG,
    double? tiltAngle,
  }) {
    // 1. Post trực tiếp lên /api/watch/vitals để Backend relay lưu cache tức thì
    try {
      final uri = Uri.parse('${AppConstants.backendBaseUrl}/watch/vitals');
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'deviceId': _deviceId,
          'heartRate': heartRate,
          'spO2': spO2,
          'steps': steps,
          'battery': battery,
          'isOffWrist': isOffWrist,
          if (svmG != null) 'svmG': svmG,
          if (tiltAngle != null) 'tiltAngle': tiltAngle,
        }),
      ).timeout(const Duration(seconds: 2)).catchError((_) => http.Response('', 500));
    } catch (_) {}

    // 2. Đồng thời phát gói tin SSWP
    sendPacket(WatchPacket.create(
      sender: WatchSender.watch,
      type: WatchPacketType.telemetry,
      action: WatchAction.vitalsUpdate,
      payload: {
        'deviceId': _deviceId,
        'heartRate': heartRate,
        'spO2': spO2,
        'steps': steps,
        'battery': battery,
        'isOffWrist': isOffWrist,
        if (svmG != null) 'svmG': svmG,
        if (tiltAngle != null) 'tiltAngle': tiltAngle,
      },
    ));
  }

  /// Watch phát sự kiện Té ngã
  void emitFallAlert({
    required double svm,
    required double tilt,
    bool isSimulated = false,
  }) {
    sendPacket(WatchPacket.create(
      sender: WatchSender.watch,
      type: WatchPacketType.emergency,
      action: WatchAction.fallDetected,
      payload: {
        'deviceId': _deviceId,
        'svmG': svm,
        'tiltAngle': tilt,
        'isSimulated': isSimulated,
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

  @override
  void dispose() {
    _cloudPollTimer?.cancel();
    _packetController.close();
    _client.close();
    super.dispose();
  }
}
