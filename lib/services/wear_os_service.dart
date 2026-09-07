import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:sensors_plus/sensors_plus.dart';

import 'ai_signal_processor.dart';
import 'api_service.dart';
import 'pedometer_service.dart';

/// ============================================================================
/// SAFESOLO - DỊCH VỤ THIẾT BỊ ĐEO THÔNG MINH SAMSUNG GALAXY WATCH 5 (WEAR OS)
/// Phục vụ Đề tài: Cảnh báo khẩn cấp tự động và Điều phối cứu hộ thời gian thực
/// Tác giả: SV Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03
/// ============================================================================
class WearOsService extends ChangeNotifier {
  WearOsService._();
  static final WearOsService instance = WearOsService._();

  final ApiService _api = ApiService();
  final PedometerService _pedometer = PedometerService.instance;
  final AiSignalProcessor _ai = AiSignalProcessor.instance;

  StreamSubscription<AccelerometerEvent>? _accelerometerSub;
  final StreamController<Map<String, dynamic>> _watchEventController =
      StreamController<Map<String, dynamic>>.broadcast();

  // Thông số thiết bị và chỉ số sinh tồn
  final String _watchModel = 'Samsung Galaxy Watch 5 (WearOS 4.0)';
  int _steps = 4280;
  int _heartRate = 78;
  int _spO2 = 98;
  int _battery = 88;
  bool _isPaired = true;
  bool _isOffWrist = false;
  bool _isSyncing = false;

  // Giám sát cảm biến gia tốc & Phát hiện té ngã (Kinematic Fall)
  bool _isFallMonitoringActive = true;
  double _fallSensitivityG = 2.5; // Ngưỡng mặc định 2.5g
  double _currentSvmG = 1.0;
  double _currentTiltAngle = 0.0;
  DateTime? _lastFallDetectedAt;

  // Trạng thái đếm ngược khẩn cấp trên đồng hồ (30s)
  bool _isCountdownActive = false;
  int _countdownSeconds = 30;
  Timer? _countdownTimer;
  String? _emergencyTitle;
  String? _emergencyMessage;
  String? _emergencySignalType;

  // Getters
  String get watchModel => _watchModel;
  int get steps => _steps;
  double get calories => double.parse((_steps * 0.04).toStringAsFixed(1));
  double get distanceKm => double.parse((_steps * 0.00075).toStringAsFixed(2));
  int get heartRate => _heartRate;
  int get spO2 => _spO2;
  int get battery => _battery;
  bool get isPaired => _isPaired;
  bool get isOffWrist => _isOffWrist;
  bool get isSyncing => _isSyncing;

  bool get isFallMonitoringActive => _isFallMonitoringActive;
  double get fallSensitivityG => _fallSensitivityG;
  double get currentSvmG => _currentSvmG;
  double get currentTiltAngle => _currentTiltAngle;
  DateTime? get lastFallDetectedAt => _lastFallDetectedAt;

  bool get isCountdownActive => _isCountdownActive;
  int get countdownSeconds => _countdownSeconds;
  String? get emergencyTitle => _emergencyTitle;
  String? get emergencyMessage => _emergencyMessage;
  String? get emergencySignalType => _emergencySignalType;

  Stream<Map<String, dynamic>> get watchEventStream =>
      _watchEventController.stream;

  /// Khởi tạo dịch vụ, kết nối dữ liệu ban đầu từ PedometerService và bật lắng nghe gia tốc
  void initialize() {
    _steps = _pedometer.steps;
    _heartRate = _pedometer.heartRate;
    _spO2 = _pedometer.spO2;
    _battery = _pedometer.battery;
    _isOffWrist = _pedometer.isOffWrist;
    _isPaired = _pedometer.isPaired;

    startMotionMonitoring();
  }

  /// Bật giám sát liên tục cảm biến gia tốc MEMS 3 trục
  void startMotionMonitoring() {
    if (_accelerometerSub != null) return;
    _isFallMonitoringActive = true;

    try {
      _accelerometerSub = accelerometerEventStream().listen(
        _onAccelerometerData,
        onError: (err) {
          debugPrint('WearOsService Accelerometer error: $err');
        },
        cancelOnError: false,
      );
    } catch (e) {
      debugPrint('Accelerometer stream not supported on this platform: $e');
    }
    notifyListeners();
  }

  /// Dừng giám sát chuyển động (khi tháo đồng hồ ra sạc để tiết kiệm pin)
  void stopMotionMonitoring() {
    _accelerometerSub?.cancel();
    _accelerometerSub = null;
    _isFallMonitoringActive = false;
    notifyListeners();
  }

  /// Thay đổi độ nhạy phát hiện té ngã
  void setFallSensitivity(double thresholdG) {
    _fallSensitivityG = thresholdG;
    notifyListeners();
  }

  /// Chuyển đổi trạng thái tháo đồng hồ (Off-wrist)
  void setOffWrist(bool off) {
    _isOffWrist = off;
    _pedometer.setOffWrist(off);
    if (off) {
      // Khi tháo đồng hồ thì tạm ngưng báo động té ngã giả
      stopMotionMonitoring();
    } else {
      startMotionMonitoring();
    }
    notifyListeners();
  }

  /// Xử lý dữ liệu gia tốc kế thời gian thực
  void _onAccelerometerData(AccelerometerEvent event) {
    if (_isOffWrist || !_isFallMonitoringActive) return;

    // Chuyển m/s^2 sang đơn vị g (1g ≈ 9.80665 m/s^2)
    final axG = event.x / 9.80665;
    final ayG = event.y / 9.80665;
    final azG = event.z / 9.80665;

    final result = _ai.evaluateKinematicFall(
      ax: axG,
      ay: ayG,
      az: azG,
      thresholdG: _fallSensitivityG,
    );

    _currentSvmG = double.parse(result.svmG.toStringAsFixed(2));
    _currentTiltAngle = double.parse(result.tiltAngleDegrees.toStringAsFixed(1));

    // Nếu phát hiện va đập kèm tư thế nghiêng bất động (Hard Fall)
    if (result.isFallDetected && !_isCountdownActive) {
      _triggerFallAlert(
        svm: _currentSvmG,
        tilt: _currentTiltAngle,
        isSimulated: false,
      );
    }
  }

  /// Kích hoạt chu kỳ cảnh báo té ngã
  void _triggerFallAlert({
    required double svm,
    required double tilt,
    bool isSimulated = false,
  }) {
    if (_isOffWrist && !isSimulated) return;

    _lastFallDetectedAt = DateTime.now();
    _currentSvmG = svm;
    _currentTiltAngle = tilt;
    _heartRate = 118; // Tim đập nhanh sau va chạm

    _syncToPedometer();
    _startEmergencyCountdown(
      title: 'PHÁT HIỆN TÉ NGÃ TỪ GALAXY WATCH 5',
      message:
          'Cảm biến BioActive & IMU phát hiện va chạm mạnh (${svm}g) và góc nghiêng ${tilt}°. Hệ thống đang đếm ngược 30 giây trước khi điều phối cấp cứu.',
      signalType: 'WATCH_FALL_DETECTED',
      extraPayload: {
        'svm': svm,
        'tilt': tilt,
        'isSimulated': isSimulated,
      },
    );
  }

  /// Mô phỏng sự kiện té ngã 4.8g có chủ đích để kiểm thử
  void simulateFall() {
    _isOffWrist = false;
    _triggerFallAlert(svm: 4.8, tilt: 72.0, isSimulated: true);
  }

  /// Mô phỏng sự kiện tụt nồng độ oxy hòa tan SpO2 xuống dưới 90% (86%)
  void simulateCriticalSpO2() {
    _isOffWrist = false;
    _spO2 = 86;
    _heartRate = 126;
    _syncToPedometer();

    _startEmergencyCountdown(
      title: 'CẢNH BÁO NGUY HIỂM: SpO2 < 90%',
      message:
          'Cảm biến BioActive trên Galaxy Watch 5 phát hiện SpO2 hạ còn 86% và nhịp tim 126 bpm. Hệ thống sẽ kích hoạt Cảnh báo Leo thang Cấp 3 SOS sau 30 giây.',
      signalType: 'WATCH_CRITICAL_SPO2',
      extraPayload: {
        'spO2': _spO2,
        'heartRate': _heartRate,
        'alert': 'SpO2 giảm thấp nguy kịch dưới 90% (86%)',
      },
    );
  }

  /// Nhấn phím SOS khẩn cấp phần cứng/màn hình trên đồng hồ
  void triggerHardwareSos({String? userId}) {
    HapticFeedback.heavyImpact();
    _pedometer.emitWatchEmergencyAlert(
      type: 'WATCH_EMERGENCY_SOS',
      message: 'Người dùng kích hoạt SOS khẩn cấp tức thời từ Samsung Galaxy Watch 5!',
      extra: {
        'spO2': _spO2,
        'heartRate': _heartRate,
        'battery': _battery,
      },
    );

    _watchEventController.add({
      'type': 'WATCH_EMERGENCY_SOS',
      'title': 'SOS KHẨN CẤP TỪ ĐỒNG HỒ',
      'message': 'Đã gửi tín hiệu SOS khẩn cấp cấp độ 3!',
      'timestamp': DateTime.now().toIso8601String(),
    });

    if (userId != null && userId.isNotEmpty) {
      _sendSignalToBackend(
        userId: userId,
        signalType: 'WATCH_EMERGENCY_SOS',
        payload: {
          'alert': 'Người dùng nhấn phím SOS trên Samsung Galaxy Watch 5',
          'source': 'SAMSUNG_GALAXY_WATCH_5',
        },
      );
    }
  }

  /// Bắt đầu chu kỳ đếm ngược 30 giây kèm rung phản hồi xúc giác
  void _startEmergencyCountdown({
    required String title,
    required String message,
    required String signalType,
    Map<String, dynamic>? extraPayload,
  }) {
    _countdownTimer?.cancel();
    _isCountdownActive = true;
    _countdownSeconds = 30;
    _emergencyTitle = title;
    _emergencyMessage = message;
    _emergencySignalType = signalType;
    notifyListeners();

    _watchEventController.add({
      'type': signalType,
      'title': title,
      'message': message,
      'payload': extraPayload,
      'timestamp': DateTime.now().toIso8601String(),
    });

    // Rung cảnh báo tức thời
    HapticFeedback.heavyImpact();

    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_countdownSeconds > 1) {
        _countdownSeconds--;
        // Rung nhịp đều đặn mỗi giây để đánh thức người đeo
        if (_countdownSeconds % 2 == 0) {
          HapticFeedback.mediumImpact();
        }
        notifyListeners();
      } else {
        timer.cancel();
        _isCountdownActive = false;
        notifyListeners();
        // Hết thời gian mà không bấm hủy -> Tự động phát báo động cấp cứu
        _executeEmergencyDispatch(extraPayload: extraPayload);
      }
    });
  }

  /// Hủy cảnh báo khẩn cấp ("TÔI ỔN")
  void cancelEmergency() {
    _countdownTimer?.cancel();
    _countdownTimer = null;
    _isCountdownActive = false;
    _emergencyTitle = null;
    _emergencyMessage = null;
    _emergencySignalType = null;

    // Khôi phục chỉ số về bình thường
    _spO2 = 98;
    _heartRate = 78;
    _syncToPedometer();

    HapticFeedback.lightImpact();
    notifyListeners();

    _watchEventController.add({
      'type': 'WATCH_ALERT_CANCELLED',
      'title': 'ĐÃ HỦY CẢNH BÁO',
      'message': 'Người dùng đã xác nhận an toàn ("Tôi ổn").',
      'timestamp': DateTime.now().toIso8601String(),
    });
  }

  /// Thực thi phát báo động khẩn cấp khi hết thời gian đếm ngược hoặc khi bấm "CỨU HỘ NGAY"
  void _executeEmergencyDispatch({
    String? userId,
    Map<String, dynamic>? extraPayload,
  }) {
    _countdownTimer?.cancel();
    _isCountdownActive = false;
    final signalType = _emergencySignalType ?? 'WATCH_EMERGENCY_SOS';
    notifyListeners();

    // Phát cảnh báo sang PedometerService để kích hoạt AppProvider trên điện thoại
    _pedometer.emitWatchEmergencyAlert(
      type: signalType,
      message: _emergencyMessage ?? 'Khẩn cấp phát hiện từ Galaxy Watch 5!',
      extra: {
        'spO2': _spO2,
        'heartRate': _heartRate,
        'battery': _battery,
        if (extraPayload != null) ...extraPayload,
      },
    );

    _watchEventController.add({
      'type': signalType,
      'title': _emergencyTitle ?? 'BÁO ĐỘNG KHẨN CẤP TỪ ĐỒNG HỒ',
      'message': _emergencyMessage ?? 'Đã chuyển báo động tới trung tâm cứu hộ!',
      'timestamp': DateTime.now().toIso8601String(),
    });

    if (userId != null && userId.isNotEmpty) {
      _sendSignalToBackend(
        userId: userId,
        signalType: signalType,
        payload: {
          'title': _emergencyTitle,
          'message': _emergencyMessage,
          if (extraPayload != null) ...extraPayload,
        },
      );
    }
  }

  /// Bấm nút "CỨU HỘ NGAY" bỏ qua đếm ngược
  void forceEmergencyDispatch({String? userId}) {
    _executeEmergencyDispatch(userId: userId);
  }

  /// Điểm danh an toàn 1-chạm (Dead-man's Switch Check-in)
  Future<bool> performDeadmanCheckin({required String userId}) async {
    HapticFeedback.mediumImpact();
    try {
      await _api.checkin(
        userId: userId,
        lat: 10.762622,
        lng: 106.660172,
      );
      _watchEventController.add({
        'type': 'WATCH_CHECKIN_SUCCESS',
        'title': 'ĐÃ ĐIỂM DANH AN TOÀN',
        'message': 'Đã hoàn tất điểm danh từ Samsung Galaxy Watch 5.',
        'timestamp': DateTime.now().toIso8601String(),
      });
      return true;
    } catch (e) {
      debugPrint('Watch check-in error: $e');
      return false;
    }
  }

  /// Đo mới chỉ số sinh tồn (Simulation / BioActive refresh)
  void measureVitalsNow() {
    HapticFeedback.lightImpact();
    // Tạo biến thiên tự nhiên nhẹ
    _heartRate = (72 + (DateTime.now().second % 15));
    _spO2 = (97 + (DateTime.now().second % 3));
    _steps += 12;
    _syncToPedometer();
    notifyListeners();
  }

  /// Cập nhật thủ công các chỉ số từ ngoài
  void updateMetrics({
    int? steps,
    int? heartRate,
    int? spO2,
    int? battery,
    bool? isOffWrist,
  }) {
    if (steps != null) _steps = steps;
    if (heartRate != null) _heartRate = heartRate;
    if (spO2 != null) _spO2 = spO2;
    if (battery != null) _battery = battery;
    if (isOffWrist != null) _isOffWrist = isOffWrist;
    _syncToPedometer();
    notifyListeners();
  }

  void _syncToPedometer() {
    _pedometer.updateFromWatchSimulator(
      steps: _steps,
      heartRate: _heartRate,
      spO2: _spO2,
      battery: _battery,
      isOffWrist: _isOffWrist,
    );
  }

  /// Gửi tín hiệu trực tiếp từ đồng hồ lên SafeSolo Backend API
  Future<void> _sendSignalToBackend({
    required String userId,
    required String signalType,
    required Map<String, dynamic> payload,
  }) async {
    _isSyncing = true;
    notifyListeners();

    try {
      await _api.createDeviceSignal(
        userId: userId,
        signalType: signalType,
        payload: {
          'device': _watchModel,
          'spO2': _spO2,
          'heartRate': _heartRate,
          'battery': _battery,
          'steps': _steps,
          'isOffWrist': _isOffWrist,
          'timestamp': DateTime.now().toIso8601String(),
          ...payload,
        },
      );
    } catch (e) {
      debugPrint('Sync watch signal to backend error: $e');
    } finally {
      _isSyncing = false;
      notifyListeners();
    }
  }

  /// Đồng bộ thủ công toàn bộ dữ liệu sinh tồn lên đám mây
  Future<void> syncVitalsToCloud(String userId) async {
    await _sendSignalToBackend(
      userId: userId,
      signalType: 'WATCH_VITALS_STREAM',
      payload: {
        'status': _isOffWrist ? 'off_wrist' : 'active_monitoring',
      },
    );
  }

  @override
  void dispose() {
    _accelerometerSub?.cancel();
    _countdownTimer?.cancel();
    _watchEventController.close();
    super.dispose();
  }
}
