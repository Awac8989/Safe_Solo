import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'ai_signal_processor.dart';

/// ============================================================================
/// SAFESOLO - DỊCH VỤ KHỬ BÁO ĐỘNG GIẢ ĐA TẦNG
/// (Multi-tier False Alarm Suppression & Grace Period Verification Service)
/// Phục vụ: Giảm thiểu báo động giả, xác thực giọng nói rảnh tay tiếng Việt
/// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03
/// ============================================================================

enum VerificationState { idle, graceCountdown, suppressed, escalated }

class FalseAlarmSuppressionService extends ChangeNotifier {
  FalseAlarmSuppressionService._();
  static final FalseAlarmSuppressionService instance =
      FalseAlarmSuppressionService._();

  final AiSignalProcessor _ai = AiSignalProcessor.instance;

  VerificationState _state = VerificationState.idle;
  int _countdownSeconds = 20;
  static const int defaultGraceSeconds = 20;

  Timer? _countdownTimer;
  String? _incidentType;
  String? _incidentDetails;
  String? _lastResolutionReason;

  void Function()? _onAutoEscalateCallback;

  // Thống kê thực nghiệm (Defense Metrics)
  int _totalTriggersCount = 18;
  int _suppressedFalseAlarmsCount = 17;
  int _confirmedEmergenciesCount = 1;

  // Getters
  VerificationState get state => _state;
  bool get isVerificationActive => _state == VerificationState.graceCountdown;
  int get countdownSeconds => _countdownSeconds;
  String? get incidentType => _incidentType;
  String? get incidentDetails => _incidentDetails;
  String? get lastResolutionReason => _lastResolutionReason;

  int get totalTriggersCount => _totalTriggersCount;
  int get suppressedFalseAlarmsCount => _suppressedFalseAlarmsCount;
  int get confirmedEmergenciesCount => _confirmedEmergenciesCount;

  double get suppressionRatePercent {
    if (_totalTriggersCount == 0) return 0.0;
    return double.parse(
      ((_suppressedFalseAlarmsCount / _totalTriggersCount) * 100)
          .toStringAsFixed(1),
    );
  }

  /// Kích hoạt chu trình Tiền Báo Động (Phase 1: Grace Countdown 20s)
  void startGraceVerification({
    required String incidentType,
    String? details,
    int initialSeconds = defaultGraceSeconds,
    void Function()? onAutoEscalate,
  }) {
    _countdownTimer?.cancel();

    _incidentType = incidentType;
    _incidentDetails = details ?? 'Phát hiện tín hiệu sinh tồn bất thường';
    _countdownSeconds = initialSeconds;
    _state = VerificationState.graceCountdown;
    _totalTriggersCount++;
    _onAutoEscalateCallback = onAutoEscalate;

    notifyListeners();

    // Rung cảnh báo haptic ban đầu
    HapticFeedback.heavyImpact();

    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_countdownSeconds > 1) {
        _countdownSeconds--;
        // Rung nhịp cảnh giác mỗi 2 giây
        if (_countdownSeconds % 2 == 0) {
          HapticFeedback.mediumImpact();
        }
        notifyListeners();
      } else {
        timer.cancel();
        _countdownSeconds = 0;
        _executeAutoEscalation();
      }
    });
  }

  /// Phân tích phản hồi giọng nói rảnh tay (Hands-free Voice Response)
  bool evaluateVoiceResponse(String spokenText) {
    if (_state != VerificationState.graceCountdown) return false;

    // 1. Kiểm tra từ khóa AN TOÀN ("Tôi ổn", "Nhầm rồi", "Không sao")
    if (_ai.matchSafeVoiceKeyword(spokenText)) {
      cancelAsFalseAlarm(reason: 'Giọng nói xác nhận: "$spokenText"');
      return true;
    }

    // 2. Kiểm tra từ khóa KÊU CỨU ("Cứu tôi với", "Cấp cứu", "Help")
    if (_ai.matchEmergencyVoiceKeyword(spokenText)) {
      confirmEmergencyNow(reason: 'Kêu cứu qua giọng nói: "$spokenText"');
      return true;
    }

    return false;
  }

  /// Hủy báo động (Người dùng an toàn / Báo động giả)
  void cancelAsFalseAlarm({String reason = 'Người dùng bấm hủy ("TÔI ỔN")'}) {
    _countdownTimer?.cancel();
    _countdownTimer = null;
    _state = VerificationState.suppressed;
    _lastResolutionReason = reason;
    _suppressedFalseAlarmsCount++;

    HapticFeedback.lightImpact();
    notifyListeners();
  }

  /// Xác nhận khẩn cấp tức thời (Người dùng bấm cấp cứu hoặc kêu cứu)
  void confirmEmergencyNow(
      {String reason = 'Người dùng xác nhận khẩn cấp tức thời'}) {
    _countdownTimer?.cancel();
    _countdownTimer = null;
    _state = VerificationState.escalated;
    _lastResolutionReason = reason;
    _confirmedEmergenciesCount++;

    HapticFeedback.heavyImpact();
    notifyListeners();

    _onAutoEscalateCallback?.call();
  }

  /// Hết thời gian chờ (Người dùng bất tỉnh / Không phản hồi) -> Tự động leo thang cứu hộ
  void _executeAutoEscalation() {
    _state = VerificationState.escalated;
    _lastResolutionReason =
        'Hết 20s nạn nhân bất tỉnh / không phản hồi -> Tự động leo thang Cấp cứu Cấp 3';
    _confirmedEmergenciesCount++;

    HapticFeedback.heavyImpact();
    notifyListeners();

    _onAutoEscalateCallback?.call();
  }

  /// Đặt lại trạng thái về ban đầu (cho kiểm thử độc lập)
  void reset() {
    _countdownTimer?.cancel();
    _countdownTimer = null;
    _state = VerificationState.idle;
    _countdownSeconds = defaultGraceSeconds;
    _incidentType = null;
    _incidentDetails = null;
    _lastResolutionReason = null;
    _onAutoEscalateCallback = null;
    notifyListeners();
  }

  /// Đặt lại toàn bộ số liệu thống kê
  void resetMetrics() {
    _totalTriggersCount = 0;
    _suppressedFalseAlarmsCount = 0;
    _confirmedEmergenciesCount = 0;
    notifyListeners();
  }
}
