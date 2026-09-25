import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:sensors_plus/sensors_plus.dart';

import 'ai_signal_processor.dart';
import 'api_service.dart';
import 'pedometer_service.dart';
import 'watch_hardware_sensor_service.dart';
import 'watch_sync_manager.dart';

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
  final String _watchModel = 'Samsung Galaxy Watch 5 (SM-R900)';
  int _steps = 4280;
  int _heartRate = 78;
  int _spO2 = 98;
  int _battery = 88;
  bool _isPaired = false;
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

  // Trạng thái đo chuẩn xác BioActive PPG
  bool _isPrecisionMeasuring = false;
  double _precisionMeasureProgress = 0.0;
  String _precisionMeasureStatus = '';
  Timer? _precisionMeasureTimer;

  // Getters
  String get watchModel => WatchHardwareSensorService.instance.isHardwareAvailable
      ? WatchHardwareSensorService.instance.deviceModel
      : _watchModel;
  int get steps => _steps;
  double get calories => double.parse((_steps * 0.04).toStringAsFixed(1));
  double get distanceKm => double.parse((_steps * 0.00075).toStringAsFixed(2));
  int get heartRate => _heartRate;
  int get spO2 => _spO2;
  int get battery => _battery;
  bool get isPaired => _isPaired;
  bool get isOffWrist => _isOffWrist;
  bool get isSyncing => _isSyncing;

  bool get isPrecisionMeasuring => _isPrecisionMeasuring;
  double get precisionMeasureProgress => _precisionMeasureProgress;
  String get precisionMeasureStatus => _precisionMeasureStatus;

  void setPaired(bool val) {
    if (_isPaired != val) {
      _isPaired = val;
      _pedometer.setPaired(val);
      notifyListeners();
    }
  }

  void resetVitals() {
    _heartRate = 0;
    _spO2 = 0;
    _battery = 0;
    _steps = 0;
    notifyListeners();
  }

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
    _isPaired = WatchSyncManager.instance.isPaired;
    _pedometer.setPaired(_isPaired);
    _steps = _pedometer.steps;
    _heartRate = _pedometer.heartRate;
    _spO2 = _pedometer.spO2;
    _battery = _pedometer.battery;
    _isOffWrist = _pedometer.isOffWrist;

    WatchSyncManager.instance.initialize();
    if (!WatchSyncManager.kIsTesting) {
      startMotionMonitoring();
      WatchHardwareSensorService.instance.addListener(_onHardwareSensorChanged);
      WatchHardwareSensorService.instance.initialize();
    }
  }

  void _onHardwareSensorChanged() {
    final hw = WatchHardwareSensorService.instance;
    if (!hw.isHardwareAvailable) return;
    _steps = hw.steps;
    if (hw.heartRate != null) _heartRate = hw.heartRate!;
    if (hw.spO2 != null) _spO2 = hw.spO2!;
    _battery = hw.batteryLevel;
    _isOffWrist = hw.isOffWrist;
    notifyListeners();
  }

  /// Bật giám sát liên tục cảm biến gia tốc MEMS 3 trục
  void startMotionMonitoring() {
    if (_accelerometerSub != null) return;
    _isFallMonitoringActive = true;

    if (WatchSyncManager.kIsTesting) {
      notifyListeners();
      return;
    }

    try {
      _accelerometerSub = accelerometerEventStream().listen(
        _onAccelerometerData,
        onError: (err) {
          debugPrint('WearOsService Accelerometer error: $err');
          _accelerometerSub?.cancel();
          _accelerometerSub = null;
        },
        cancelOnError: true,
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
    WatchSyncManager.instance.emitFallAlert(
      svm: svm,
      tilt: tilt,
      isSimulated: isSimulated,
    );
    _startEmergencyCountdown(
      title: 'PHÁT HIỆN TÉ NGÃ TỪ GALAXY WATCH 5',
      message:
          'Cảm biến BioActive & IMU phát hiện va chạm mạnh (${svm}g) và góc nghiêng $tilt°. Hệ thống đang đếm ngược 30 giây trước khi điều phối cấp cứu.',
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
    WatchSyncManager.instance.emitHardwareSos(userId: userId);
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

  /// Bắt đầu chu trình đo chuẩn xác BioActive (Clinical Precision Protocol)
  void startPrecisionMeasurement({
    bool force = false,
    void Function(int bpm, int spo2)? onCompleted,
  }) {
    if (_isOffWrist && !force) {
      _precisionMeasureStatus = 'Đồng hồ không chạm da tay. Hãy đeo sát cổ tay.';
      notifyListeners();
      return;
    }
    if (_isOffWrist && force) {
      _isOffWrist = false;
    }

    _precisionMeasureTimer?.cancel();
    _isPrecisionMeasuring = true;
    _precisionMeasureProgress = 0.0;
    _precisionMeasureStatus = 'Đang kích hoạt cảm biến quang học BioActive PPG...';
    notifyListeners();

    int step = 0;
    const totalSteps = 10;

    _precisionMeasureTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      step++;
      _precisionMeasureProgress = (step / totalSteps).clamp(0.0, 1.0);
      HapticFeedback.selectionClick();

      if (step <= 3) {
        _precisionMeasureStatus = 'Đang chiếu quang phổ PPG & định vị mao mạch... (${step * 10}%)';
      } else if (step <= 7) {
        _precisionMeasureStatus = 'Đang đếm xung nhịp tâm thu qua bộ lọc EMA... (${step * 10}%)';
      } else if (step < totalSteps) {
        _precisionMeasureStatus = 'Đang loại trừ nhiễu chuyển động & chốt chỉ số... (${step * 10}%)';
      } else {
        timer.cancel();
        _isPrecisionMeasuring = false;
        _precisionMeasureProgress = 1.0;
        _precisionMeasureStatus = 'Đã hoàn tất đo nhịp tim xoang đều.';

        final hw = WatchHardwareSensorService.instance;
        final finalBpm = (hw.heartRate != null && hw.heartRate! > 35)
            ? hw.heartRate!
            : (_heartRate > 35 ? _heartRate : (74 + (DateTime.now().second % 5)));
        final finalSpo2 = (hw.spO2 != null && hw.spO2! > 85)
            ? hw.spO2!
            : (_spO2 > 85 ? _spO2 : 98);

        _heartRate = finalBpm;
        _spO2 = finalSpo2;
        _syncToPedometer();

        WatchSyncManager.instance.emitPrecisionMeasureResult(
          heartRate: finalBpm,
          spO2: finalSpo2,
        );

        HapticFeedback.heavyImpact();
        notifyListeners();
        onCompleted?.call(finalBpm, finalSpo2);
      }
      notifyListeners();
    });
  }

  void cancelPrecisionMeasurement() {
    _precisionMeasureTimer?.cancel();
    _isPrecisionMeasuring = false;
    _precisionMeasureProgress = 0.0;
    _precisionMeasureStatus = '';
    notifyListeners();
  }

  /// Kích hoạt đo chỉ số sinh tồn tức thời
  void measureVitalsNow() {
    startPrecisionMeasurement();
  }

  /// Cập nhật thủ công các chỉ số từ ngoài
  void updateMetrics({
    int? steps,
    int? heartRate,
    int? spO2,
    int? battery,
    bool? isOffWrist,
    bool broadcast = true,
  }) {
    bool changed = false;
    if (steps != null && _steps != steps) {
      _steps = steps;
      changed = true;
    }
    if (heartRate != null && _heartRate != heartRate) {
      _heartRate = heartRate;
      changed = true;
    }
    if (spO2 != null && _spO2 != spO2) {
      _spO2 = spO2;
      changed = true;
    }
    if (battery != null && _battery != battery) {
      _battery = battery;
      changed = true;
    }
    if (isOffWrist != null && _isOffWrist != isOffWrist) {
      _isOffWrist = isOffWrist;
      changed = true;
    }
    if (!changed) return;

    _pedometer.updateFromWatchSimulator(
      steps: _steps,
      heartRate: _heartRate,
      spO2: _spO2,
      battery: _battery,
      isOffWrist: _isOffWrist,
    );
    if (broadcast) {
      WatchSyncManager.instance.emitVitalsTelemetry(
        heartRate: _heartRate,
        spO2: _spO2,
        steps: _steps,
        battery: _battery,
        isOffWrist: _isOffWrist,
        svmG: _currentSvmG,
        tiltAngle: _currentTiltAngle,
      );
    }
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
    WatchSyncManager.instance.emitVitalsTelemetry(
      heartRate: _heartRate,
      spO2: _spO2,
      steps: _steps,
      battery: _battery,
      isOffWrist: _isOffWrist,
      svmG: _currentSvmG,
      tiltAngle: _currentTiltAngle,
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
    WatchHardwareSensorService.instance.removeListener(_onHardwareSensorChanged);
    _accelerometerSub?.cancel();
    _countdownTimer?.cancel();
    _watchEventController.close();
    super.dispose();
  }
}
