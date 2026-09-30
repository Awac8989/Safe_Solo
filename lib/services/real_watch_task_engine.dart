import 'dart:async';
import 'package:flutter/material.dart';

import 'watch_sync_manager.dart';
import 'wear_os_service.dart';

/// Trạng thái hoạt động của một tác vụ nền trên đồng hồ thật
enum WatchTaskStatus {
  idle,
  active,
  warning,
  critical,
  paused,
}

/// Mô tả chi tiết một tác vụ chạy ngầm trên đồng hồ thật Wear OS
class WatchTaskInfo {
  final String id;
  final String title;
  final String category;
  final String description;
  final String samplingRate;
  final IconData icon;
  final Color activeColor;
  WatchTaskStatus status;
  String currentMetric;
  DateTime lastExecuted;
  Map<String, dynamic> metadata;

  WatchTaskInfo({
    required this.id,
    required this.title,
    required this.category,
    required this.description,
    required this.samplingRate,
    required this.icon,
    required this.activeColor,
    this.status = WatchTaskStatus.active,
    this.currentMetric = 'Đang sẵn sàng',
    required this.lastExecuted,
    this.metadata = const {},
  });
}

/// ============================================================================
/// SAFESOLO - HỆ THỐNG ĐIỀU PHỐI TÁC VỤ ĐỒNG HỒ THẬT (REAL WATCH TASK ENGINE)
/// Chịu trách nhiệm quản lý, điều phối và giám sát toàn bộ 5 tác vụ cốt lõi
/// vận hành độc lập trên Samsung Galaxy Watch 5 (Wear OS) và kết nối với điện thoại:
/// 1. Tác vụ Giám sát Sinh hiệu BioActive PPG & SpO2 thời gian thực (1Hz - 10Hz)
/// 2. Tác vụ Phát hiện Té ngã & Va chạm chấn động Kinematic IMU 4 pha (50Hz)
/// 3. Tác vụ Bộ đếm Điểm danh sinh tồn độc lập (Dead-man Survival Timer)
/// 4. Tác vụ Đồng bộ Truyền thông Đa kênh Hai chiều (BLE GATT, DataLayer, Cloud)
/// 5. Tác vụ Phản ứng Khẩn cấp SOS & Mã Cưỡng bức Ngầm (Duress Protocol)
/// ============================================================================
class RealWatchTaskEngine extends ChangeNotifier {
  RealWatchTaskEngine._() {
    _initializeTasks();
  }
  static final RealWatchTaskEngine instance = RealWatchTaskEngine._();

  final WearOsService _wearOs = WearOsService.instance;
  final WatchSyncManager _syncManager = WatchSyncManager.instance;

  Timer? _taskLoopTimer;
  bool _isEngineRunning = false;
  DateTime _lastHeartbeat = DateTime.now();

  // Danh mục 5 tác vụ nền cốt lõi của đồng hồ thật
  final Map<String, WatchTaskInfo> _tasks = {};

  List<WatchTaskInfo> get tasks => _tasks.values.toList();
  bool get isEngineRunning => _isEngineRunning;
  DateTime get lastHeartbeat => _lastHeartbeat;

  void _initializeTasks() {
    _tasks['vitals_bioactive'] = WatchTaskInfo(
      id: 'vitals_bioactive',
      title: 'Giám sát Sinh hiệu BioActive PPG',
      category: 'SỨC KHỎE SINH TỒN',
      description: 'Lấy mẫu liên tục nhịp tim BioActive quang học (Type 21) & nồng độ oxy hòa tan SpO2 kèm lọc nhiễu số EMA.',
      samplingRate: '1Hz (1 lần/giây)',
      icon: Icons.favorite_rounded,
      activeColor: const Color(0xFFEF4444),
      status: WatchTaskStatus.active,
      currentMetric: '${_wearOs.heartRate} BPM · SpO2 ${_wearOs.spO2}%',
      lastExecuted: DateTime.now(),
    );

    _tasks['fall_crash_imu'] = WatchTaskInfo(
      id: 'fall_crash_imu',
      title: 'Phát hiện Té ngã & Tai nạn Kinematic',
      category: 'AN TOÀN CHUYỂN ĐỘNG',
      description: 'Thuật toán 4 pha phân tích gia tốc kế 3 trục & con quay hồi chuyển: Rơi tự do -> Va đập -> Biến thiên góc nghiêng -> Bất động.',
      samplingRate: '50Hz (50 mẫu/giây)',
      icon: Icons.personal_injury_rounded,
      activeColor: const Color(0xFFF59E0B),
      status: WatchTaskStatus.active,
      currentMetric: 'SVM ${_wearOs.currentSvmG.toStringAsFixed(1)}g · Nghiêng ${_wearOs.currentTiltAngle.toStringAsFixed(0)}°',
      lastExecuted: DateTime.now(),
    );

    _tasks['deadman_countdown'] = WatchTaskInfo(
      id: 'deadman_countdown',
      title: 'Bộ đếm Điểm danh Sinh tồn Độc lập',
      category: 'SINH TỒN ĐỘC HÀNH',
      description: 'Đồng hồ duy trì đếm ngược sinh tồn độc lập trong phần cứng ngay cả khi mất sóng điện thoại; rung nhắc nhở trước 30p, 15p và khi quá hạn.',
      samplingRate: 'Liên tục thời gian thực',
      icon: Icons.timer_outlined,
      activeColor: const Color(0xFF10B981),
      status: WatchTaskStatus.active,
      currentMetric: 'Đang đếm lùi an toàn',
      lastExecuted: DateTime.now(),
    );

    _tasks['bidirectional_sync'] = WatchTaskInfo(
      id: 'bidirectional_sync',
      title: 'Đồng bộ Đa kênh Hai chiều',
      category: 'TRUYỀN THÔNG MẠNG',
      description: 'Kênh truyền gói tin 2 chiều qua Bluetooth LE GATT SIG, Google Wearable Data Layer và Wi-Fi/LTE Cloud Relay kèm Heartbeat 10s.',
      samplingRate: 'Heartbeat mỗi 10 giây',
      icon: Icons.sync_alt_rounded,
      activeColor: const Color(0xFF0EA5E9),
      status: WatchTaskStatus.active,
      currentMetric: _syncManager.connectionStatusLabel,
      lastExecuted: DateTime.now(),
    );

    _tasks['emergency_duress'] = WatchTaskInfo(
      id: 'emergency_duress',
      title: 'Phản ứng Khẩn cấp SOS & Mã Cưỡng bức',
      category: 'BẢO MẬT & CỨU HỘ',
      description: 'Nút SOS phần cứng 3 giây; mã an toàn (1234) hủy báo động; mã cưỡng bức ngầm (9999) ngụy trang hủy báo động nhưng gửi SOS ngầm.',
      samplingRate: 'Thường trực 24/7 (Sẵn sàng ngắt)',
      icon: Icons.shield_rounded,
      activeColor: const Color(0xFF8B5CF6),
      status: WatchTaskStatus.active,
      currentMetric: 'Safe PIN (1234) / Duress PIN (9999)',
      lastExecuted: DateTime.now(),
    );
  }

  /// Khởi động chu trình giám sát tác vụ của đồng hồ thật
  void startEngine() {
    if (_isEngineRunning) return;
    _isEngineRunning = true;
    _taskLoopTimer?.cancel();
    _taskLoopTimer = Timer.periodic(const Duration(seconds: 1), _onTaskLoopTick);
    notifyListeners();
  }

  /// Tạm dừng chu trình giám sát tác vụ
  void stopEngine() {
    _isEngineRunning = false;
    _taskLoopTimer?.cancel();
    notifyListeners();
  }

  /// Chu kỳ cập nhật trạng thái các tác vụ
  void _onTaskLoopTick(Timer timer) {
    final now = DateTime.now();
    _lastHeartbeat = now;

    // 1. Cập nhật Tác vụ Sinh hiệu
    final vitalsTask = _tasks['vitals_bioactive'];
    if (vitalsTask != null) {
      vitalsTask.lastExecuted = now;
      final hr = _wearOs.heartRate;
      final spo2 = _wearOs.spO2;
      final off = _wearOs.isOffWrist;

      if (off) {
        vitalsTask.status = WatchTaskStatus.paused;
        vitalsTask.currentMetric = 'Đã tháo đồng hồ (Off-wrist)';
      } else if (hr > 130 || hr < 45 || spo2 < 90) {
        vitalsTask.status = WatchTaskStatus.warning;
        vitalsTask.currentMetric = '$hr BPM (Bất thường) · SpO2 $spo2%';
      } else {
        vitalsTask.status = WatchTaskStatus.active;
        vitalsTask.currentMetric = '$hr BPM · SpO2 $spo2% (Ổn định)';
      }
    }

    // 2. Cập nhật Tác vụ Té ngã
    final fallTask = _tasks['fall_crash_imu'];
    if (fallTask != null) {
      fallTask.lastExecuted = now;
      final svm = _wearOs.currentSvmG;
      final tilt = _wearOs.currentTiltAngle;

      if (_wearOs.isCountdownActive) {
        fallTask.status = WatchTaskStatus.critical;
        fallTask.currentMetric = '🚨 ĐANG ĐẾM NGƯỢC CỨU HỘ (${_wearOs.countdownSeconds}s)';
      } else if (svm >= 2.5) {
        fallTask.status = WatchTaskStatus.warning;
        fallTask.currentMetric = 'Phát hiện rung chấn ${svm.toStringAsFixed(1)}g';
      } else {
        fallTask.status = WatchTaskStatus.active;
        fallTask.currentMetric = 'SVM ${svm.toStringAsFixed(1)}g · Nghiêng ${tilt.toStringAsFixed(0)}° (Bình thường)';
      }
    }

    // 3. Cập nhật Tác vụ Điểm danh sinh tồn
    final deadmanTask = _tasks['deadman_countdown'];
    if (deadmanTask != null) {
      deadmanTask.lastExecuted = now;
      deadmanTask.status = _syncManager.isPaired ? WatchTaskStatus.active : WatchTaskStatus.paused;
      deadmanTask.currentMetric = _syncManager.isPaired
          ? 'Đồng bộ hạn chót sinh tồn · Hoạt động độc lập'
          : 'Chờ ghép nối để đồng bộ';
    }

    // 4. Cập nhật Tác vụ Truyền thông hai chiều
    final syncTask = _tasks['bidirectional_sync'];
    if (syncTask != null) {
      syncTask.lastExecuted = now;
      if (_syncManager.isPaired) {
        syncTask.status = WatchTaskStatus.active;
        syncTask.currentMetric = '${_syncManager.connectionStatusLabel} · RTT ${_syncManager.latencyMs}ms';
      } else {
        syncTask.status = WatchTaskStatus.idle;
        syncTask.currentMetric = 'Chưa kết nối đồng hồ thật';
      }
    }

    // 5. Cập nhật Tác vụ SOS & Duress
    final duressTask = _tasks['emergency_duress'];
    if (duressTask != null) {
      duressTask.lastExecuted = now;
      duressTask.status = WatchTaskStatus.active;
      duressTask.currentMetric = 'Sẵn sàng kích hoạt 24/7 (Safe: ${_wearOs.safePin} / Duress: ${_wearOs.duressPin})';
    }

    notifyListeners();
  }

  /// Gửi lệnh Rung chuông tìm kiếm đồng hồ thật
  Future<bool> sendFindWatchCommand() async {
    try {
      _syncManager.sendFindWatchPing();
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Gửi lệnh yêu cầu đồng hồ thật đo sinh hiệu BioActive tức thời
  Future<bool> sendForceMeasureCommand() async {
    try {
      _syncManager.sendInstantMeasureRequest();
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Gửi lệnh đồng bộ hóa hai chiều tức thì
  Future<void> sendForceSyncCommand() async {
    await _syncManager.pingHost();
  }

  /// Gửi lệnh cập nhật mã PIN bảo mật xuống đồng hồ thật
  void updatePins({String? safePin, String? duressPin}) {
    final sPin = safePin ?? _wearOs.safePin;
    final dPin = duressPin ?? _wearOs.duressPin;
    _wearOs.setPins(safePin: sPin, duressPin: dPin);
    _syncManager.sendPinConfigSync(
      safePin: sPin,
      duressPin: dPin,
    );
    notifyListeners();
  }

  /// Kích hoạt phím SOS khẩn cấp phần cứng từ xa trên đồng hồ
  void triggerHardwareSos({String? userId}) {
    _wearOs.triggerHardwareSos(userId: userId);
  }

  /// Hủy tình huống khẩn cấp trên đồng hồ bằng mã PIN
  bool verifyAndCancelEmergency(String pin) {
    if (pin == _wearOs.safePin) {
      _wearOs.cancelEmergency();
      _syncManager.sendAlertCancelled();
      return true;
    } else if (pin == _wearOs.duressPin) {
      // Mã cưỡng bức ngầm: Giao diện giả vờ tắt nhưng ngầm phát Duress SOS
      _wearOs.cancelEmergency();
      _syncManager.emitDuressSos();
      return true;
    }
    return false;
  }
}
