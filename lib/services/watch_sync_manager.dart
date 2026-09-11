import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

import '../core/constants.dart';
import '../models/watch_protocol.dart';
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

  final _client = http.Client();
  final StreamController<WatchPacket> _packetController =
      StreamController<WatchPacket>.broadcast();

  // Trạng thái ghép nối và thiết bị
  bool _isPaired = true;
  WatchConnectionType _connectionType = WatchConnectionType.inMemory;
  String _deviceId = 'watch_galaxy_5';
  final String _deviceModel = 'Samsung Galaxy Watch 5 (WearOS 4.0)';
  String _pairingCode = '742-891';
  int _latencyMs = 28;
  bool _isSyncing = false;
  String? _pairedUserId;

  // Lịch sử gói tin truyền thông
  WatchPacket? _lastPacket;
  final List<WatchPacket> _recentPackets = [];
  Timer? _cloudPollTimer;

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

  String get connectionStatusLabel {
    switch (_connectionType) {
      case WatchConnectionType.localBle:
        return 'Bluetooth LE (Direct)';
      case WatchConnectionType.cloudRelay:
        return 'Cloud Relay (Active Sync)';
      case WatchConnectionType.inMemory:
        return 'Local Virtual Link';
      case WatchConnectionType.disconnected:
        return 'Chưa kết nối';
    }
  }

  void initialize() {
    _packetController.stream.listen(_handleIncomingPacket);
    _startPeriodicHealthCheck();
  }

  void _startPeriodicHealthCheck() {
    _cloudPollTimer?.cancel();
    _cloudPollTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (_connectionType == WatchConnectionType.cloudRelay && _isPaired) {
        _measureLatency();
      }
    });
  }

  void stopPeriodicChecks() {
    _cloudPollTimer?.cancel();
    _cloudPollTimer = null;
  }

  Future<void> _measureLatency() async {
    final start = DateTime.now().millisecondsSinceEpoch;
    try {
      final uri = Uri.parse('${AppConstants.backendBaseUrl}/watch/pair/status/$_deviceId');
      final res = await _client.get(uri).timeout(const Duration(seconds: 3));
      if (res.statusCode == 200) {
        final end = DateTime.now().millisecondsSinceEpoch;
        _latencyMs = (end - start).clamp(15, 999);
        notifyListeners();
      }
    } catch (_) {}
  }

  /// 1. TẠO MÃ GHÉP NỐI TRÊN ĐỒNG HỒ
  Future<String> requestNewPairingCode({String? deviceId}) async {
    if (deviceId != null) _deviceId = deviceId;
    _isSyncing = true;
    notifyListeners();

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
    } catch (_) {
      // Nếu không có mạng Backend hoặc test cục bộ:
      _isPaired = true;
      _pairedUserId = userId;
      _connectionType = WatchConnectionType.inMemory;
      _pairingCode = code;

      _broadcastInternal(WatchPacket.create(
        sender: WatchSender.phone,
        type: WatchPacketType.pairing,
        action: WatchAction.pairConfirmed,
        payload: {'userId': userId, 'deviceId': _deviceId, 'offline': true},
      ));

      _isSyncing = false;
      notifyListeners();
      return true;
    }

    _isSyncing = false;
    notifyListeners();
    return false;
  }

  /// Hủy ghép nối
  void unpairDevice() {
    _isPaired = false;
    _connectionType = WatchConnectionType.disconnected;
    notifyListeners();
  }

  /// 3. GỬI GÓI TIN SSWP ĐI
  Future<void> sendPacket(WatchPacket packet) async {
    _lastPacket = packet;
    _addPacketToHistory(packet);

    // Phát nội bộ trước để UI phản hồi ngay (0ms latency)
    _packetController.add(packet);

    // Đồng bộ lên Cloud Relay nếu có kết nối
    try {
      final uri = Uri.parse('${AppConstants.backendBaseUrl}/watch/packet');
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(packet.toJson()),
      ).timeout(const Duration(seconds: 2)).catchError((_) => http.Response('', 500));
    } catch (_) {}

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
    final wearOs = WearOsService.instance;

    switch (packet.action) {
      // Nhận lệnh từ điện thoại: Tìm đồng hồ (Rung Haptic)
      case WatchAction.findWatchPing:
        HapticFeedback.heavyImpact();
        debugPrint('[WatchSyncManager] Received FIND_WATCH_PING: triggering haptic vibration!');
        break;

      // Nhận lệnh từ điện thoại: Đo nhịp tim tức thì (PPG)
      case WatchAction.instantMeasureReq:
        wearOs.measureVitalsNow();
        debugPrint('[WatchSyncManager] Received INSTANT_MEASURE_REQ: BioActive PPG measurement triggered!');
        break;

      // Nhận sự kiện từ đồng hồ: Té ngã
      case WatchAction.fallDetected:
        debugPrint('[WatchSyncManager] Received FALL_DETECTED from watch: ${packet.payload}');
        break;

      // Nhận sự kiện từ đồng hồ: SOS khẩn cấp
      case WatchAction.hardwareSos:
        debugPrint('[WatchSyncManager] Received HARDWARE_SOS from watch');
        break;

      // Nhận cập nhật sinh tồn định kỳ
      case WatchAction.vitalsUpdate:
        final p = packet.payload;
        wearOs.updateMetrics(
          heartRate: p['heartRate'] as int?,
          spO2: p['spO2'] as int?,
          steps: p['steps'] as int?,
          battery: p['battery'] as int?,
          isOffWrist: p['isOffWrist'] as bool?,
        );
        break;

      // Nhận lệnh hủy cảnh báo ("Tôi ổn")
      case WatchAction.alertCancelled:
        wearOs.cancelEmergency();
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
