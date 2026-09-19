import 'dart:math' as math;

/// ============================================================================
/// SAFESOLO - MODULE THUẬT TOÁN XỬ LÝ TÍN HIỆU SỐ (DSP) VÀ TRÍ TUỆ NHÂN TẠO (AI)
/// Phục vụ Đề tài: Cảnh báo khẩn cấp tự động và Điều phối cứu hộ thời gian thực
/// Tác giả: SV Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03
/// ============================================================================
class AiSignalProcessor {
  AiSignalProcessor._();
  static final AiSignalProcessor instance = AiSignalProcessor._();

  // ---------------------------------------------------------------------------
  // 1. BỘ LỌC DẢI THÔNG BANDPASS BUTTERWORTH (0.5Hz - 5.0Hz)
  // Lọc nhiễu chuyển động, nhiễu trôi đường nền (baseline wander) của sóng quang thể tích PPG.
  // ---------------------------------------------------------------------------
  final _ButterworthBandpassFilter _ppgFilter = _ButterworthBandpassFilter();

  double filterPpgSample(double rawPpg) {
    return _ppgFilter.process(rawPpg);
  }

  // ---------------------------------------------------------------------------
  // 2. BỘ LỌC TRUNG BÌNH ĐỘNG (MOVING AVERAGE FILTER N=5)
  // Làm mịn đường cong sóng mạch máu, loại bỏ gai xung nhiễu vi mô.
  // ---------------------------------------------------------------------------
  final List<double> _maWindow = [];
  static const int _maSize = 5;

  double movingAverage(double sample) {
    _maWindow.add(sample);
    if (_maWindow.length > _maSize) {
      _maWindow.removeAt(0);
    }
    final sum = _maWindow.reduce((a, b) => a + b);
    return sum / _maWindow.length;
  }

  // ---------------------------------------------------------------------------
  // 3. THUẬT TOÁN PEAK DETECTION (XÁC ĐỊNH ĐỈNH SÓNG SYSTOLIC TÍNH NHỊP TIM BPM)
  // Sử dụng ngưỡng thích ứng động (Dynamic Threshold) và thời gian trơ (Refractory Period).
  // ---------------------------------------------------------------------------
  final List<double> _peakBuffer = [];
  int _samplesSinceLastPeak = 0;
  static const int _samplingRate = 25; // 25 Hz (mẫu/giây từ cảm biến Wearable)

  int calculateBpmFromInterval(int intervalSamples) {
    if (intervalSamples <= 0) return 75;
    return ((60 * _samplingRate) / intervalSamples).round().clamp(40, 200);
  }
  static const int _minPeakIntervalSamples = 8; // Tương đương 320ms (~187 BPM max)

  bool detectSystolicPeak(double filteredSample) {
    _peakBuffer.add(filteredSample);
    if (_peakBuffer.length > 30) {
      _peakBuffer.removeAt(0);
    }
    _samplesSinceLastPeak++;

    if (_peakBuffer.length < 5 || _samplesSinceLastPeak < _minPeakIntervalSamples) {
      return false;
    }

    // Tính ngưỡng động: Mean + 0.5 * StdDev
    final mean = _peakBuffer.reduce((a, b) => a + b) / _peakBuffer.length;
    double variance = 0;
    for (final v in _peakBuffer) {
      variance += math.pow(v - mean, 2);
    }
    final stdDev = math.sqrt(variance / _peakBuffer.length);
    final threshold = mean + 0.5 * stdDev;

    final current = _peakBuffer.last;
    final prev = _peakBuffer[_peakBuffer.length - 2];

    if (current > threshold && current < prev && _samplesSinceLastPeak >= _minPeakIntervalSamples) {
      _samplesSinceLastPeak = 0;
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // 4. THUẬT TOÁN RATIO OF RATIOS (R) TÍNH NỒNG ĐỘ OXY TRONG MÁU (SpO2 %)
  // Công thức lâm sàng Beer-Lambert: R = (AC_red / DC_red) / (AC_ir / DC_ir)
  // SpO2 = 110 - 25 * R
  // ---------------------------------------------------------------------------
  double calculateSpO2({
    required double acRed,
    required double dcRed,
    required double acIr,
    required double dcIr,
  }) {
    if (dcRed <= 0 || dcIr <= 0 || acIr <= 0) return 98.0;

    final rRed = acRed / dcRed;
    final rIr = acIr / dcIr;
    final ratio = rRed / rIr;

    // Đường chuẩn thực nghiệm (Empirical Calibration Line)
    final spO2 = 110.0 - (25.0 * ratio);
    return spO2.clamp(70.0, 100.0);
  }

  // ---------------------------------------------------------------------------
  // 5. THUẬT TOÁN KINEMATIC SVM THRESHOLDING & GÓC NGHIÊNG THÂN THỂ (TÉ NGÃ)
  // SVM = sqrt(Ax^2 + Ay^2 + Az^2)
  // Tilt = arccos(Az / SVM) * (180 / pi)
  // ---------------------------------------------------------------------------
  FallDetectionResult evaluateKinematicFall({
    required double ax,
    required double ay,
    required double az,
    double thresholdG = 2.5,
  }) {
    final svm = math.sqrt(ax * ax + ay * ay + az * az);
    final safeSvm = svm > 0.001 ? svm : 0.001;
    final tiltAngle = math.acos((az.abs() / safeSvm).clamp(0.0, 1.0)) * (180.0 / math.pi);

    final isImpact = svm >= thresholdG;
    final isTilted = tiltAngle >= 60.0;
    final isHardFall = isImpact && isTilted;

    return FallDetectionResult(
      svmG: svm,
      tiltAngleDegrees: tiltAngle,
      isImpact: isImpact,
      isLyingPosition: isTilted,
      isFallDetected: isHardFall,
    );
  }

  // ---------------------------------------------------------------------------
  // 6. MÔ HÌNH MACHINE LEARNING AI (SVM CLASSIFIER) PHÂN LOẠI TÉ NGÃ
  // Phân biệt té ngã thật (True Fall) vs hoạt động ngồi mạnh/cúi gập người (ADL - Activities of Daily Living)
  // ---------------------------------------------------------------------------
  bool classifyFallWithAi({
    required double peakG,
    required double postImpactTilt,
    required double impactDurationMs,
    required double postImpactMobility,
  }) {
    // Trọng số mô hình Linear SVM đã được huấn luyện sẵn (Pre-trained weights)
    // w1 * PeakG + w2 * Tilt + w3 * Duration + w4 * Mobility + bias
    const w1 = 1.45;  // Trọng số đỉnh gia tốc
    const w2 = 0.035; // Trọng số góc nghiêng
    const w3 = 0.008; // Trọng số thời gian va đập
    const w4 = -2.10; // Trọng số độ bất động (càng bất động càng có nguy cơ ngã thật)
    const bias = -5.80;

    final decisionValue = (w1 * peakG) +
        (w2 * postImpactTilt) +
        (w3 * impactDurationMs) +
        (w4 * postImpactMobility) +
        bias;

    return decisionValue > 0.0;
  }

  // ---------------------------------------------------------------------------
  // 7. THUẬT TOÁN ĐÁNH GIÁ NGUY CƠ SỨC KHỎE & SINH TỒN (SURVIVAL RISK SCORE - SRS)
  // Thang điểm đa thông số (0 - 100) kết hợp SpO2, nhịp tim, ngã và trạng thái tương tác.
  // ---------------------------------------------------------------------------
  SurvivalRiskAssessment calculateSurvivalRisk({
    required int spO2,
    required int heartRate,
    bool isFallOccurred = false,
    bool isOffWrist = false,
    int inactivityMinutes = 0,
  }) {
    int score = 0;

    // Thành phần 1: SpO2 (Trọng số 45%)
    if (spO2 < 85) {
      score += 45;
    } else if (spO2 < 90) {
      score += 35;
    } else if (spO2 < 95) {
      score += 15;
    }

    // Thành phần 2: Nhịp tim (Trọng số 30%)
    if (heartRate > 140 || heartRate < 45) {
      score += 30;
    } else if (heartRate > 115 || heartRate < 55) {
      score += 15;
    }

    // Thành phần 3: Biến cố gia tốc té ngã (Trọng số 35%)
    if (isFallOccurred) {
      score += 35;
    }

    // Thành phần 4: Bất động / Không tương tác quá hạn
    if (inactivityMinutes > 60) {
      score += 15;
    } else if (inactivityMinutes > 30) {
      score += 8;
    }

    // Nếu tháo đồng hồ thì giảm bớt cảnh báo sai
    if (isOffWrist) {
      score = (score * 0.4).round();
    }

    final finalScore = score.clamp(0, 100);

    String riskLevel;
    String recommendation;
    if (finalScore >= 60) {
      riskLevel = 'CRITICAL (NGUY CẤP)';
      recommendation = 'Kích hoạt Cảnh báo Leo thang Cấp 3 SOS và điều phối cứu hộ tức thời.';
    } else if (finalScore >= 30) {
      riskLevel = 'WARNING (CẢNH BÁO)';
      recommendation = 'Phát còi rung nhắc nhở kiểm tra sinh tồn tại chỗ.';
    } else {
      riskLevel = 'NORMAL (AN TOÀN)';
      recommendation = 'Chỉ số sinh tồn ổn định, tiếp tục giám sát ngầm.';
    }

    return SurvivalRiskAssessment(
      score: finalScore,
      level: riskLevel,
      recommendation: recommendation,
    );
  }

  // ---------------------------------------------------------------------------
  // 8. PHÁT HIỆN RUNG LẮC SMARTPHONE KHẨN CẤP (SHAKE-TO-SOS)
  // Nhận dạng chuỗi dao động đổi dấu liên tục trong cửa sổ thời gian 1.5 giây.
  // ---------------------------------------------------------------------------
  final List<DateTime> _shakeEvents = [];

  bool registerShakeEvent(double accelerationMagnitude) {
    final now = DateTime.now();
    // Lọc bỏ sự kiện cũ hơn 1.5 giây
    _shakeEvents.removeWhere((t) => now.difference(t).inMilliseconds > 1500);

    if (accelerationMagnitude > 22.0) { // ~2.2g
      _shakeEvents.add(now);
      if (_shakeEvents.length >= 4) {
        _shakeEvents.clear();
        return true; // Xác nhận người dùng đang lắc máy khẩn cấp
      }
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // 9. AI VOICE KEYWORD SPOTTING (KWS) NHẬN DẠNG TỪ KHÓA CỨU HỘ
  // So khớp ngữ âm các cụm từ kêu cứu khẩn cấp trong tiếng Việt và tiếng Anh.
  // ---------------------------------------------------------------------------
  bool matchEmergencyVoiceKeyword(String spokenText) {
    final text = spokenText.toLowerCase().trim();
    const keywords = [
      'cứu tôi',
      'cứu tôi với',
      'cứu với',
      'giúp tôi',
      'giúp tôi với',
      'cần cứu hộ',
      'cấp cứu',
      'help me',
      'emergency',
      'sos',
    ];

    for (final kw in keywords) {
      if (text.contains(kw)) {
        return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // 10. THUẬT TOÁN PHÂN TÍCH BIẾN THIÊN NHỊP TIM (HRV - HEART RATE VARIABILITY)
  // Tính toán các chỉ số miền thời gian: Mean RR, SDNN, RMSSD, pNN50, Baevsky Stress Index
  // ---------------------------------------------------------------------------
  HrvMetrics calculateHrvMetrics(List<int> rrIntervalsMs) {
    if (rrIntervalsMs.length < 2) {
      return const HrvMetrics(
        meanRrMs: 800.0,
        sdnnMs: 45.0,
        rmssdMs: 35.0,
        pnn50Percent: 12.0,
        stressIndex: 95.0,
        vagalTone: 'balanced',
        sampleCount: 0,
      );
    }

    final n = rrIntervalsMs.length;
    final sum = rrIntervalsMs.reduce((a, b) => a + b);
    final mean = sum / n;

    // 1. SDNN: Độ lệch chuẩn toàn bộ khoảng RR (ms)
    double varSum = 0;
    for (final rr in rrIntervalsMs) {
      varSum += math.pow(rr - mean, 2);
    }
    final sdnn = math.sqrt(varSum / (n - 1));

    // 2. RMSSD: Căn bậc hai trung bình bình phương các hiệu liên tiếp (ms)
    // 3. pNN50: Tỷ lệ các hiệu liên tiếp > 50ms (%)
    double successiveDiffSquareSum = 0;
    int diffGreaterThan50Count = 0;

    for (int i = 0; i < n - 1; i++) {
      final diff = (rrIntervalsMs[i + 1] - rrIntervalsMs[i]).abs();
      successiveDiffSquareSum += math.pow(diff, 2);
      if (diff > 50) {
        diffGreaterThan50Count++;
      }
    }

    final rmssd = math.sqrt(successiveDiffSquareSum / (n - 1));
    final pnn50 = (diffGreaterThan50Count / (n - 1)) * 100.0;

    // 4. Baevsky Stress Index (SI = AMo / (2 * Mo * MxDMn))
    // Tính Mode (Mo): Phân nhóm theo bước 50ms
    final minRr = rrIntervalsMs.reduce(math.min);
    final maxRr = rrIntervalsMs.reduce(math.max);
    final mxDMnSec = math.max(0.05, (maxRr - minRr) / 1000.0); // biên độ (s)

    // Tìm Mo: giá trị xuất hiện nhiều nhất trong dải
    final bucketCount = <int, int>{};
    for (final rr in rrIntervalsMs) {
      final bucket = (rr ~/ 50) * 50;
      bucketCount[bucket] = (bucketCount[bucket] ?? 0) + 1;
    }
    int bestBucket = (mean ~/ 50) * 50;
    int maxCount = 0;
    bucketCount.forEach((bucket, count) {
      if (count > maxCount) {
        maxCount = count;
        bestBucket = bucket;
      }
    });

    final moSec = math.max(0.4, bestBucket / 1000.0); // Mode tính theo giây
    final aMo = (maxCount / n) * 100.0; // Biên độ Mode (%)
    final stressIndex = (aMo / (2.0 * moSec * mxDMnSec)).clamp(10.0, 999.0);

    // Trương lực phế vị (Vagal Tone)
    String vagalTone;
    if (rmssd < 18.0) {
      vagalTone = 'suppressed'; // Ức chế đối giao cảm / Suy kiệt
    } else if (rmssd > 75.0) {
      vagalTone = 'elevated'; // Rung loạn nhịp hoặc phó giao cảm cao
    } else {
      vagalTone = 'balanced'; // Cân bằng sinh học tốt
    }

    return HrvMetrics(
      meanRrMs: double.parse(mean.toStringAsFixed(1)),
      sdnnMs: double.parse(sdnn.toStringAsFixed(1)),
      rmssdMs: double.parse(rmssd.toStringAsFixed(1)),
      pnn50Percent: double.parse(pnn50.toStringAsFixed(1)),
      stressIndex: double.parse(stressIndex.toStringAsFixed(1)),
      vagalTone: vagalTone,
      sampleCount: n,
    );
  }

  // ---------------------------------------------------------------------------
  // 11. DỰ ĐOÁN NGUY CƠ ĐỘT QUỴ NÃO & RUNG NHĨ SỚM (STROKE & AFIB PREDICTION)
  // Tổng hợp đa biến từ HRV, nhịp tim, SpO2 và dấu hiệu loạn nhịp
  // ---------------------------------------------------------------------------
  StrokeCardiacRiskAssessment evaluateStrokeCardiacRisk({
    required HrvMetrics hrv,
    required int heartRate,
    required int spO2,
    bool isResting = true,
  }) {
    double riskScore = 8.0; // Điểm rủi ro cơ sở
    bool isAfibSuspected = false;
    bool isAutonomicExhaustion = false;

    // 1. Phân tích Rung nhĩ (AFib - nguyên nhân gây 80% cục máu đông đột quỵ)
    // Đặc trưng lâm sàng AFib: pNN50 rất cao kết hợp RMSSD dao động bất thường và phân tán rộng
    if (hrv.pnn50Percent > 32.0 && hrv.rmssdMs > 75.0) {
      isAfibSuspected = true;
      riskScore += 45.0;
    } else if (hrv.pnn50Percent > 24.0) {
      riskScore += 25.0;
    }

    // 2. Phân tích Suy kiệt Thần kinh Thực vật (Autonomic Exhaustion / Stress)
    // SDNN < 18ms hoặc RMSSD < 14ms: Nguy cơ co thắt mạch vành, nhồi máu cơ tim
    if (hrv.sdnnMs < 18.0 || hrv.rmssdMs < 14.0) {
      isAutonomicExhaustion = true;
      riskScore += 30.0;
    } else if (hrv.sdnnMs < 25.0) {
      riskScore += 12.0;
    }

    // Chỉ số Stress Index Baevsky > 300: Căng thẳng huyết động cực đoan
    if (hrv.stressIndex > 350.0) {
      riskScore += 18.0;
    } else if (hrv.stressIndex > 200.0) {
      riskScore += 10.0;
    }

    // 3. Tác động của Nhịp tim & Oxy máu SpO2
    if (heartRate > 120 || heartRate < 50) {
      riskScore += 18.0;
    }
    if (spO2 < 93) {
      riskScore += 22.0;
    } else if (spO2 < 95) {
      riskScore += 10.0;
    }

    final finalRiskPercent = riskScore.clamp(5.0, 98.0);

    HrvRiskLevel level;
    String title;
    String recommendation;

    if (finalRiskPercent >= 60.0) {
      level = HrvRiskLevel.critical;
      title = isAfibSuspected
          ? 'CẢNH BÁO CAO: Nghi ngờ Rung nhĩ (AFib) & Nguy cơ Đột quỵ'
          : 'CẢNH BÁO CAO: Suy giảm Tim mạch & Nguy cơ Đột quỵ Cấp';
      recommendation =
          'Nhịp tim phân tán bất thường. Hãy ngồi tựa vững chắc, thực hiện bài kiểm tra F.A.S.T ngay và chuẩn bị liên hệ 115 nếu có triệu chứng yếu cơ hoặc tê bì.';
    } else if (finalRiskPercent >= 30.0) {
      level = HrvRiskLevel.moderate;
      title = isAutonomicExhaustion
          ? 'CẢNH BÁO SỚM: Căng thẳng Tim mạch & Suy nhược'
          : 'CẢNH BÁO SỚM: Biến thiên Nhịp tim Không đều';
      recommendation =
          'Hệ thần kinh thực vật đang chịu áp lực cao. Khuyến nghị dừng vận động nặng, nghỉ ngơi tại chỗ và thực hiện bài tập thở sâu 4-4-4 trong 5 phút.';
    } else {
      level = HrvRiskLevel.normal;
      title = 'Hệ Tim Mạch Ổn Định · Trương Lực Cân Bằng';
      recommendation =
          'Chỉ số HRV và nhịp sinh học trong giới hạn an toàn. Tiếp tục duy trì lối sống lành mạnh và điểm danh an toàn.';
    }

    return StrokeCardiacRiskAssessment(
      riskPercent: double.parse(finalRiskPercent.toStringAsFixed(1)),
      level: level,
      title: title,
      recommendation: recommendation,
      isAfibSuspected: isAfibSuspected,
      isAutonomicExhaustion: isAutonomicExhaustion,
      metrics: hrv,
    );
  }

  // ---------------------------------------------------------------------------
  // 12. BỘ TẠO DỮ LIỆU MÔ PHỎNG LÂM SÀNG PHỤC VỤ KIỂM THỬ VÀ TRÌNH DIỄN (DEMO)
  // ---------------------------------------------------------------------------
  List<int> generateNormalRrSample({int count = 30}) {
    // Nhịp tim ~ 75 BPM với biến thiên điều hòa phó giao cảm (SDNN ~ 36ms, RMSSD ~ 27ms, pNN50 < 10%)
    const normalPattern = [
      800, 825, 850, 830, 805, 780, 760, 785, 815, 840,
      865, 835, 810, 775, 755, 790, 820, 845, 825, 795,
      770, 750, 780, 810, 840, 860, 830, 800, 770, 755,
    ];
    final result = <int>[];
    for (int i = 0; i < count; i++) {
      result.add(normalPattern[i % normalPattern.length]);
    }
    return result;
  }

  List<int> generateAfibArrhythmiaRrSample({int count = 30}) {
    // Rung nhĩ: khoảng cách R-R biến thiên hỗn loạn cực đoan (520ms - 1050ms)
    const afibPattern = [
      520, 960, 610, 920, 540, 1020, 680, 910, 530, 980,
      640, 890, 560, 1010, 670, 940, 580, 990, 630, 870
    ];
    final result = <int>[];
    for (int i = 0; i < count; i++) {
      result.add(afibPattern[i % afibPattern.length]);
    }
    return result;
  }

  List<int> generateAutonomicExhaustionRrSample({int count = 30}) {
    // Suy kiệt: Tim đập nhanh đơ cứng như máy (metronome), SDNN và RMSSD cực thấp
    const stiffPattern = [600, 604, 598, 602, 605, 599, 601, 603, 597, 602];
    final result = <int>[];
    for (int i = 0; i < count; i++) {
      result.add(stiffPattern[i % stiffPattern.length]);
    }
    return result;
  }
}

/// Lớp hỗ trợ Bộ lọc Butterworth Dải thông bậc 2 (0.5Hz - 5.0Hz)
class _ButterworthBandpassFilter {
  // Hệ số lọc IIR đã tính toán cho Fs=25Hz, dải thông [0.5, 5.0]Hz
  static const double _b0 = 0.24523728;
  static const double _b1 = 0.0;
  static const double _b2 = -0.24523728;
  static const double _a1 = -0.91261414;
  static const double _a2 = 0.50952545;

  double _x1 = 0, _x2 = 0;
  double _y1 = 0, _y2 = 0;

  double process(double x) {
    final y = (_b0 * x) + (_b1 * _x1) + (_b2 * _x2) - (_a1 * _y1) - (_a2 * _y2);
    _x2 = _x1;
    _x1 = x;
    _y2 = _y1;
    _y1 = y;
    return y;
  }
}

/// Kết quả phân tích gia tốc té ngã
class FallDetectionResult {
  const FallDetectionResult({
    required this.svmG,
    required this.tiltAngleDegrees,
    required this.isImpact,
    required this.isLyingPosition,
    required this.isFallDetected,
  });

  final double svmG;
  final double tiltAngleDegrees;
  final bool isImpact;
  final bool isLyingPosition;
  final bool isFallDetected;
}

/// Kết quả đánh giá chỉ số sinh tồn và nguy cơ sức khỏe
class SurvivalRiskAssessment {
  const SurvivalRiskAssessment({
    required this.score,
    required this.level,
    required this.recommendation,
  });

  final int score;
  final String level;
  final String recommendation;
}

/// Mức độ nguy cơ đột quỵ & loạn nhịp
enum HrvRiskLevel {
  normal,   // < 28%
  moderate, // 28% - 59%
  critical, // >= 60%
}

/// Dữ liệu thống kê Biến thiên nhịp tim (HRV Time-Domain Metrics)
class HrvMetrics {
  const HrvMetrics({
    required this.meanRrMs,
    required this.sdnnMs,
    required this.rmssdMs,
    required this.pnn50Percent,
    required this.stressIndex,
    required this.vagalTone,
    required this.sampleCount,
  });

  final double meanRrMs;     // Khoảng RR trung bình (ms)
  final double sdnnMs;       // Độ lệch chuẩn NN (ms)
  final double rmssdMs;      // Căn bậc hai trung bình bình phương hiệu liên tiếp (ms)
  final double pnn50Percent; // Tỷ lệ chênh lệch > 50ms (%)
  final double stressIndex;  // Chỉ số căng thẳng Baevsky (SI)
  final String vagalTone;    // 'balanced' | 'suppressed' | 'elevated'
  final int sampleCount;
}

/// Đánh giá nguy cơ Đột quỵ & Loạn nhịp tim
class StrokeCardiacRiskAssessment {
  const StrokeCardiacRiskAssessment({
    required this.riskPercent,
    required this.level,
    required this.title,
    required this.recommendation,
    required this.isAfibSuspected,
    required this.isAutonomicExhaustion,
    required this.metrics,
  });

  final double riskPercent;
  final HrvRiskLevel level;
  final String title;
  final String recommendation;
  final bool isAfibSuspected;
  final bool isAutonomicExhaustion;
  final HrvMetrics metrics;
}

