import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:tflite_flutter/tflite_flutter.dart';

/// ---------------------------------------------------------------------------
/// CÁC TẦNG NGUY CƠ THÍCH ỨNG SINH HỌC & NGỮ CẢNH (ADAPTIVE RISK LEVELS)
/// ---------------------------------------------------------------------------
enum AdaptiveRiskLevel {
  relaxed,    // Ngủ say / Khiên đêm / Cắm sạc ở nhà -> Dãn chu kỳ (+4h đến +6h)
  normal,     // Ban ngày bình thường -> Chu kỳ chuẩn (12h)
  elevated,   // Đi ngoài đường đêm (>22:00) hoặc pin yếu -> Thu hẹp chu kỳ (2h - 3h)
  highThreat, // Nhịp tim bất thường / BMAI đột quỵ / Nguy cơ ngã -> Siết chặt (30m - 45m)
}

/// Kết quả phân tích chu kỳ DeadMan thích ứng thời gian thực
class AdaptiveDeadManResult {
  const AdaptiveDeadManResult({
    required this.level,
    required this.recommendedIntervalMinutes,
    required this.reasons,
    required this.threatScore,
    required this.adaptedDeadline,
  });

  final AdaptiveRiskLevel level;
  final int recommendedIntervalMinutes;
  final List<String> reasons;
  final double threatScore; // 0.0 -> 1.0
  final DateTime adaptedDeadline;

  String get labelVi {
    switch (level) {
      case AdaptiveRiskLevel.relaxed:
        return 'Khiên Đêm (Tự dãn chu kỳ)';
      case AdaptiveRiskLevel.normal:
        return 'Bình an (Chu kỳ chuẩn)';
      case AdaptiveRiskLevel.elevated:
        return 'Cảnh giác (Thu hẹp chu kỳ)';
      case AdaptiveRiskLevel.highThreat:
        return 'Rủi ro cao (Siết chặt chu kỳ)';
    }
  }

  String get badgeColorHex {
    switch (level) {
      case AdaptiveRiskLevel.relaxed:
        return '#818CF8'; // Indigo/Purple
      case AdaptiveRiskLevel.normal:
        return '#34D399'; // Emerald
      case AdaptiveRiskLevel.elevated:
        return '#FBBF24'; // Amber
      case AdaptiveRiskLevel.highThreat:
        return '#EF4444'; // Red
    }
  }
}

class TfLiteAiEngine {
  TfLiteAiEngine._();
  static final TfLiteAiEngine instance = TfLiteAiEngine._();

  Interpreter? _interpreter;
  bool _isInitialized = false;

  Future<void> initialize() async {
    if (_isInitialized) return;
    try {
      _interpreter = await Interpreter.fromAsset('assets/models/safesolo_ai.tflite');
      _isInitialized = true;
      debugPrint('[TfLiteAiEngine] Model loaded successfully.');
    } catch (e) {
      debugPrint('[TfLiteAiEngine] Failed to load model: $e. Falling back to heuristic engine.');
      _isInitialized = false;
    }
  }

  /// =========================================================================
  /// TÍNH NĂNG ĐỘT PHÁ 1: DYNAMIC RISK-ADAPTIVE DEADMAN ENGINE
  /// Tự động co giãn chu kỳ điểm danh sinh tồn theo nhịp sinh học & cảm biến
  /// =========================================================================
  AdaptiveDeadManResult evaluateDynamicRiskState({
    required bool isNightShieldActive,
    required bool isHomeWifiOrAnchor,
    required int currentHour,
    required int heartRate,
    required int batteryLevel,
    required double bmaiScore, // Bilateral Motor Asymmetry Index
    required bool hasRecentFallSignal,
    required int baseIntervalMinutes,
    required DateTime lastCheckinTime,
  }) {
    final reasons = <String>[];
    double threatScore = 0.0;

    // 1. Phân tích bối cảnh giấc ngủ & Khiên đêm
    final isSleepingHours = (currentHour >= 23 || currentHour < 6);
    if (isNightShieldActive || (isHomeWifiOrAnchor && isSleepingHours)) {
      if (heartRate <= 85 && !hasRecentFallSignal && bmaiScore < 0.4) {
        reasons.add('Khiên Đêm đang bật hoặc đang ngủ tại nhà an toàn');
        final relaxedMinutes = math.min(840, baseIntervalMinutes + 240); // Thêm 4 tiếng
        return AdaptiveDeadManResult(
          level: AdaptiveRiskLevel.relaxed,
          recommendedIntervalMinutes: relaxedMinutes,
          reasons: reasons,
          threatScore: 0.1,
          adaptedDeadline: lastCheckinTime.add(Duration(minutes: relaxedMinutes)),
        );
      }
    }

    // 2. Phân tích nhịp tim sinh trắc học
    if (heartRate > 0) {
      if (heartRate > 125) {
        threatScore += 0.45;
        reasons.add('Nhịp tim tĩnh tăng vọt bất thường ($heartRate BPM)');
      } else if (heartRate < 48) {
        threatScore += 0.40;
        reasons.add('Nhịp tim chậm nguy hiểm ($heartRate BPM)');
      } else if (heartRate > 105) {
        threatScore += 0.20;
        reasons.add('Nhịp tim gia tăng ($heartRate BPM)');
      }
    }

    // 3. Phân tích vận động & bất đối xứng đột quỵ
    if (hasRecentFallSignal) {
      threatScore += 0.50;
      reasons.add('Ghi nhận xung động chấn động/té ngã gần đây');
    }
    if (bmaiScore > 0.65) {
      threatScore += 0.40;
      reasons.add('Độ lệch vận động 2 tay BMAI cao (${bmaiScore.toStringAsFixed(2)}g)');
    }

    // 4. Phân tích địa lý & thời gian di chuyển đêm
    if (!isHomeWifiOrAnchor && isSleepingHours) {
      threatScore += 0.30;
      reasons.add('Di chuyển ngoài vùng an toàn vào ban đêm ($currentHour:00)');
    }
    if (batteryLevel > 0 && batteryLevel < 15) {
      threatScore += 0.20;
      reasons.add('Pin điện thoại dưới mức 15% ($batteryLevel%)');
    }

    threatScore = threatScore.clamp(0.0, 1.0);

    // 5. Quyết định tầng rủi ro thích ứng
    AdaptiveRiskLevel level;
    int adaptedMinutes;

    if (threatScore >= 0.60) {
      level = AdaptiveRiskLevel.highThreat;
      adaptedMinutes = 30; // Siết chặt 30 phút
    } else if (threatScore >= 0.30) {
      level = AdaptiveRiskLevel.elevated;
      adaptedMinutes = math.min(180, baseIntervalMinutes ~/ 3); // 2-3 giờ
    } else {
      level = AdaptiveRiskLevel.normal;
      adaptedMinutes = baseIntervalMinutes;
      if (reasons.isEmpty) {
        reasons.add('Chỉ số sinh trắc & không gian bình an');
      }
    }

    final targetDeadline = lastCheckinTime.add(Duration(minutes: adaptedMinutes));
    final now = DateTime.now();
    // Đảm bảo không biến thành quá hạn tức thì nếu rút ngắn, tối thiểu 15 phút ân hạn
    final safeDeadline = (targetDeadline.isBefore(now))
        ? now.add(const Duration(minutes: 15))
        : targetDeadline;

    return AdaptiveDeadManResult(
      level: level,
      recommendedIntervalMinutes: adaptedMinutes,
      reasons: reasons,
      threatScore: threatScore,
      adaptedDeadline: safeDeadline,
    );
  }

  /// 2. Adaptive Check-in Prediction (Học máy TFLite cổ điển)
  int predictOptimalCheckinInterval(List<double> activityScores, int currentIntervalMin) {
    if (_isInitialized && _interpreter != null) {
      try {
        var input = [activityScores];
        var output = List<double>.filled(1, 0).reshape([1, 1]);
        _interpreter!.run(input, output);
        int predicted = (output[0][0] * 60).round();
        return predicted.clamp(15, 720);
      } catch (e) {
        debugPrint('[TfLiteAiEngine] Inference failed: $e. Using fallback.');
      }
    }

    if (activityScores.isEmpty) return currentIntervalMin;
    double avgActivity = activityScores.reduce((a, b) => a + b) / activityScores.length;
    
    if (avgActivity > 0.7) {
      return math.max(15, currentIntervalMin ~/ 2);
    } else if (avgActivity < 0.2) {
      return math.min(720, currentIntervalMin * 2);
    }
    return currentIntervalMin;
  }

  /// 3. Anomaly Detection for Vitals
  bool detectVitalsAnomaly({
    required double currentHr,
    required double currentSpo2,
    required double baselineHr,
    required double baselineSpo2,
  }) {
    if (_isInitialized && _interpreter != null) {
      try {
        var input = [[currentHr, currentSpo2, baselineHr, baselineSpo2]];
        var output = List<double>.filled(1, 0).reshape([1, 1]);
        _interpreter!.run(input, output);
        return output[0][0] > 0.5;
      } catch (e) {
        debugPrint('[TfLiteAiEngine] Inference failed: $e. Using fallback.');
      }
    }

    bool hrAnomaly = (currentHr - baselineHr).abs() / baselineHr > 0.3;
    bool spo2Anomaly = (baselineSpo2 - currentSpo2) > 5.0;
    bool absoluteAnomaly = currentHr > 160 || currentHr < 40 || currentSpo2 < 85;

    return hrAnomaly || spo2Anomaly || absoluteAnomaly;
  }
}
