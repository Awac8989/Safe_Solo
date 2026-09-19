import 'dart:async';
import 'package:flutter/foundation.dart';

import 'ai_signal_processor.dart';
import 'pedometer_service.dart';

/// Các kịch bản thử nghiệm / mô phỏng lâm sàng
enum HrvScenario {
  normal,         // Khỏe mạnh, nhịp tim đều đặn, HRV cân bằng
  moderateStress, // Căng thẳng, mệt mỏi, hệ đối giao cảm suy giảm
  afibRisk,       // Rung nhĩ (AFib), RR phân tán hỗn loạn, nguy cơ đột quỵ cao
}

/// ============================================================================
/// SAFESOLO - DỊCH VỤ PHÂN TÍCH BIẾN THIÊN NHỊP TIM & DỰ ĐOÁN ĐỘT QUỴ SỚM
/// (HRV Analysis & Early Stroke / Cardiac Arrhythmia Detection Service)
/// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03
/// ============================================================================
class HrvStrokeService extends ChangeNotifier {
  HrvStrokeService._() {
    // Khởi tạo mặc định với mẫu nhịp tim bình thường
    _rrIntervals = List<int>.from(_ai.generateNormalRrSample(count: 30));
    _metrics = _ai.calculateHrvMetrics(_rrIntervals);
    _assessment = _ai.evaluateStrokeCardiacRisk(
      hrv: _metrics,
      heartRate: 75,
      spO2: 98,
    );
  }

  static final HrvStrokeService instance = HrvStrokeService._();
  final AiSignalProcessor _ai = AiSignalProcessor.instance;

  List<int> _rrIntervals = [];
  late HrvMetrics _metrics;
  late StrokeCardiacRiskAssessment _assessment;

  bool _isMeasuring = false;
  double _measureProgress = 0.0;
  Timer? _measureTimer;
  HrvScenario _currentScenario = HrvScenario.normal;

  // Getters
  List<int> get rrIntervals => List.unmodifiable(_rrIntervals);
  HrvMetrics get metrics => _metrics;
  StrokeCardiacRiskAssessment get assessment => _assessment;
  bool get isMeasuring => _isMeasuring;
  double get measureProgress => _measureProgress;
  HrvScenario get currentScenario => _currentScenario;

  /// Đưa một khoảng RR mới từ cảm biến PPG / Smartwatch vào hàng đợi
  void recordRrInterval(int rrMs) {
    if (rrMs < 300 || rrMs > 2000) return; // Lọc bỏ giá trị ngoại lai

    _rrIntervals.add(rrMs);
    if (_rrIntervals.length > 40) {
      _rrIntervals.removeAt(0);
    }

    _recalculate();
  }

  /// Tính toán lại toàn bộ chỉ số khi có mẫu mới hoặc thay đổi nhịp tim
  void _recalculate({int? customHeartRate, int? customSpO2}) {
    _metrics = _ai.calculateHrvMetrics(_rrIntervals);
    final hr = customHeartRate ?? PedometerService.instance.heartRate;
    final sp = customSpO2 ?? PedometerService.instance.spO2;

    _assessment = _ai.evaluateStrokeCardiacRisk(
      hrv: _metrics,
      heartRate: hr,
      spO2: sp,
    );

    // Kích hoạt thông báo cảnh báo leo thang nếu mức nguy cơ nghiêm trọng
    if (_assessment.level == HrvRiskLevel.critical) {
      PedometerService.instance.emitWatchEmergencyAlert(
        type: 'STROKE_AFIB_WARNING',
        message: 'Cảnh báo nguy cơ Đột quỵ / Loạn nhịp tim: ${_assessment.title}',
        extra: {
          'riskPercent': _assessment.riskPercent,
          'rmssd': _metrics.rmssdMs,
          'pnn50': _metrics.pnn50Percent,
        },
      );
    }

    notifyListeners();
  }

  /// Kích hoạt đo kiểm định chuẩn HRV trong 15 giây
  Future<void> startHrvMeasurement({Duration duration = const Duration(seconds: 15)}) async {
    if (_isMeasuring) return;

    final completer = Completer<void>();
    _isMeasuring = true;
    _measureProgress = 0.0;
    notifyListeners();

    _measureTimer?.cancel();
    final totalSteps = 15;
    final stepDuration = duration.inMilliseconds ~/ totalSteps;
    int currentStep = 0;

    _measureTimer = Timer.periodic(Duration(milliseconds: stepDuration > 0 ? stepDuration : 20), (timer) {
      currentStep++;
      _measureProgress = (currentStep / totalSteps).clamp(0.0, 1.0);

      // Bổ sung mẫu giả lập dựa theo kịch bản hiện thời trong lúc đo
      final hr = PedometerService.instance.heartRate;
      final baseInterval = (60000 / (hr > 0 ? hr : 75)).round();
      final jitter = (_currentScenario == HrvScenario.afibRisk)
          ? ((currentStep % 4 == 0) ? 160 : -140)
          : ((currentStep % 2 == 0) ? 22 : -18);
      recordRrInterval(baseInterval + jitter);

      if (currentStep >= totalSteps) {
        timer.cancel();
        _isMeasuring = false;
        _measureProgress = 1.0;
        _recalculate();
        if (!completer.isCompleted) completer.complete();
      } else {
        notifyListeners();
      }
    });

    return completer.future;
  }

  /// Chuyển đổi kịch bản mô phỏng lâm sàng (phục vụ kiểm thử và chấm đồ án)
  void simulateScenario(HrvScenario scenario) {
    _currentScenario = scenario;
    _measureTimer?.cancel();
    _isMeasuring = false;
    _measureProgress = 0.0;

    switch (scenario) {
      case HrvScenario.normal:
        _rrIntervals = List<int>.from(_ai.generateNormalRrSample(count: 30));
        _recalculate(customHeartRate: 72, customSpO2: 98);
        break;

      case HrvScenario.moderateStress:
        _rrIntervals = List<int>.from(_ai.generateAutonomicExhaustionRrSample(count: 30));
        _recalculate(customHeartRate: 104, customSpO2: 96);
        break;

      case HrvScenario.afibRisk:
        _rrIntervals = List<int>.from(_ai.generateAfibArrhythmiaRrSample(count: 30));
        _recalculate(customHeartRate: 118, customSpO2: 92);
        break;
    }
  }

  /// Đặt lại trạng thái về ban đầu (phục vụ kiểm thử độc lập)
  void reset() {
    _measureTimer?.cancel();
    _isMeasuring = false;
    _measureProgress = 0.0;
    _currentScenario = HrvScenario.normal;
    _rrIntervals = List<int>.from(_ai.generateNormalRrSample(count: 30));
    _recalculate(customHeartRate: 72, customSpO2: 98);
  }

  @override
  void dispose() {
    _measureTimer?.cancel();
    super.dispose();
  }
}
