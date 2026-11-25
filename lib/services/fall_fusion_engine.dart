import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';

/// Các pha của Bộ lọc Fusion Chống Báo Động Giả 3 Pha (IMU + Off-Body + BioActive PPG)
enum FallFusionPhase {
  idleMonitoring,
  stillnessOffBodyCheck,
  ppgAndCountdown,
  confirmedSos,
  rejectedOffWrist,
  rejectedPostImpactMotion,
  cancelledByUser,
}

class FallFusionConfirmedEvent {
  const FallFusionConfirmedEvent({
    required this.peakSvmG,
    required this.tiltAngleDegrees,
    required this.stillnessRatio,
    required this.isOffWrist,
    required this.heartRateAtImpact,
    required this.spO2AtImpact,
    required this.ppgAnomalyReason,
    required this.fusionConfidence,
    required this.gForceWaveform,
    required this.ppgWaveform,
    required this.timestamp,
  });

  final double peakSvmG;
  final double tiltAngleDegrees;
  final double stillnessRatio;
  final bool isOffWrist;
  final int heartRateAtImpact;
  final int spO2AtImpact;
  final String ppgAnomalyReason;
  final double fusionConfidence;
  final List<double> gForceWaveform;
  final List<double> ppgWaveform;
  final DateTime timestamp;
}

/// ============================================================================
/// SAFESOLO - BỘ LỌC FUSION CHỐNG BÁO ĐỘNG GIẢ THỰC NGHIỆM (3 PHA)
/// Pha 1: Phát hiện xung lực va chạm IMU (SVM >= 2.5G)
/// Pha 2: Kiểm chứng bất động 3–5 giây VÀ Off-Body == false (đang đeo trên cổ tay)
/// Pha 3: Rung đồng hồ 15 giây chờ hủy + Kiểm tra HR/SpO2 từ cảm biến BioActive PPG
/// ============================================================================
class FallFusionEngine extends ChangeNotifier {
  FallFusionEngine._();
  static final FallFusionEngine instance = FallFusionEngine._();

  @visibleForTesting
  FallFusionEngine.testable({DateTime Function()? clock})
      : _clock = clock ?? DateTime.now;

  DateTime Function() _clock = DateTime.now;

  @visibleForTesting
  void setClockForTesting(DateTime Function() clock) {
    _clock = clock;
  }

  // Ngưỡng cấu hình thực nghiệm
  static const double defaultImpactThresholdG = 2.5;
  static const int defaultStillnessWindowMs = 4000;
  static const int defaultCountdownSeconds = 15;

  double impactThresholdG = defaultImpactThresholdG;
  int stillnessWindowMs = defaultStillnessWindowMs;
  int countdownSeconds = defaultCountdownSeconds;

  FallFusionPhase _phase = FallFusionPhase.idleMonitoring;
  DateTime? _impactAt;
  DateTime? _lastTriggerAt;
  double _currentSvmG = 1.0;
  double _peakSvmG = 1.0;
  double _impactTiltAngle = 0.0;
  int _stillSamples = 0;
  int _activeSamples = 0;
  double _stillnessRatio = 1.0;

  bool _isOffWrist = false;
  int _heartRate = 76;
  int _spO2 = 98;
  int _countdownRemaining = 0;
  int _falseAlarmsBlockedCount = 0;
  String? _rejectedReason;
  String _ppgAnomalyReason = 'Nhịp tim bình thường';
  double _fusionConfidence = 0.0;
  Timer? _countdownTimer;

  // Rolling buffer 32 mẫu sóng thật G-Force & PPG cho Web Admin TOC Drawer
  final List<double> _gForceWaveform = <double>[1.0, 1.01, 0.99, 1.0, 1.02, 0.98, 1.0, 1.01];
  final List<double> _ppgWaveform = <double>[0.18, 0.24, 0.92, 0.14, 0.36, 0.18, 0.16, 0.19];
  int _ppgPhaseStep = 0;

  void Function(FallFusionConfirmedEvent event)? onConfirmedFall;
  void Function(FallFusionPhase phase, String reason)? onFalseAlarmBlocked;
  void Function(int secondsRemaining, double peakSvmG, String ppgNote)? onPhase3CountdownStarted;
  void Function(int secondsRemaining)? onPhase3Tick;

  // Getters
  FallFusionPhase get phase => _phase;
  double get currentSvmG => _currentSvmG;
  double get peakSvmG => _peakSvmG;
  double get impactTiltAngle => _impactTiltAngle;
  double get stillnessRatio => _stillnessRatio;
  bool get isOffWrist => _isOffWrist;
  int get heartRate => _heartRate;
  int get spO2 => _spO2;
  int get countdownRemaining => _countdownRemaining;
  int get falseAlarmsBlockedCount => _falseAlarmsBlockedCount;
  String? get rejectedReason => _rejectedReason;
  String get ppgAnomalyReason => _ppgAnomalyReason;
  double get fusionConfidence => _fusionConfidence;
  List<double> get gForceWaveform => List.unmodifiable(_gForceWaveform);
  List<double> get ppgWaveform => List.unmodifiable(_ppgWaveform);

  String get phaseApiCode {
    switch (_phase) {
      case FallFusionPhase.idleMonitoring:
        return 'IDLE_MONITORING';
      case FallFusionPhase.stillnessOffBodyCheck:
        return 'STILLNESS_OFFBODY_CHECK';
      case FallFusionPhase.ppgAndCountdown:
        return 'PPG_AND_COUNTDOWN';
      case FallFusionPhase.confirmedSos:
        return 'CONFIRMED_SOS';
      case FallFusionPhase.rejectedOffWrist:
        return 'REJECTED_OFF_WRIST';
      case FallFusionPhase.rejectedPostImpactMotion:
        return 'REJECTED_POST_IMPACT_MOTION';
      case FallFusionPhase.cancelledByUser:
        return 'CANCELLED_BY_USER';
    }
  }

  /// Cập nhật dữ liệu Off-body & BioActive PPG mới nhất từ Watch 5
  void updateVitals({
    int? heartRate,
    int? spO2,
    required bool isOffWrist,
  }) {
    _isOffWrist = isOffWrist;
    if (heartRate != null && heartRate > 0) {
      _heartRate = heartRate;
      _appendPpgSample(heartRate, spO2 ?? _spO2);
    }
    if (spO2 != null && spO2 > 0) {
      _spO2 = spO2;
    }

    // Nếu phát hiện tháo đồng hồ trong lúc đang kiểm tra bất động / chờ hủy -> chặn báo động giả!
    if (_isOffWrist &&
        (_phase == FallFusionPhase.stillnessOffBodyCheck ||
            _phase == FallFusionPhase.ppgAndCountdown)) {
      _rejectFalseAlarm(
        FallFusionPhase.rejectedOffWrist,
        'Watch tháo khỏi cổ tay (Off-Body = true) -> Chặn báo động giả rơi bàn',
      );
      return;
    }
    notifyListeners();
  }

  void _appendPpgSample(int bpm, int spo2Val) {
    // Biểu diễn mẫu sóng xung động mạch (systolic/dicrotic notch) tỷ lệ theo nhịp tim thực & cường độ Oxy
    _ppgPhaseStep = (_ppgPhaseStep + 1) % 6;
    final ampScale = ((spo2Val.clamp(70, 100) - 65) / 35.0) * (bpm > 115 ? 1.15 : 1.0);
    final double val = switch (_ppgPhaseStep) {
      0 => 0.16,
      1 => 0.95 * ampScale,
      2 => 0.25,
      3 => 0.44 * ampScale,
      4 => 0.18,
      _ => 0.12,
    };
    _ppgWaveform.add(double.parse(val.clamp(0.05, 1.25).toStringAsFixed(3)));
    if (_ppgWaveform.length > 32) {
      _ppgWaveform.removeAt(0);
    }
  }

  /// Tiếp nhận mẫu gia tốc kế 3 trục (đơn vị g) theo thời gian thực
  void ingestAccelerometer({
    required double axG,
    required double ayG,
    required double azG,
    DateTime? timestamp,
  }) {
    final now = timestamp ?? _clock();
    final svm = math.sqrt(axG * axG + ayG * ayG + azG * azG);
    final safeSvm = svm > 0.001 ? svm : 0.001;
    final tiltDeg = math.acos((azG.abs() / safeSvm).clamp(0.0, 1.0)) * (180.0 / math.pi);

    _currentSvmG = double.parse(svm.toStringAsFixed(2));
    _gForceWaveform.add(_currentSvmG);
    if (_gForceWaveform.length > 32) {
      _gForceWaveform.removeAt(0);
    }

    // Pha 1 -> Bắt xung va chạm IMU >= 2.5G
    if (_phase == FallFusionPhase.idleMonitoring ||
        _phase == FallFusionPhase.rejectedOffWrist ||
        _phase == FallFusionPhase.rejectedPostImpactMotion ||
        _phase == FallFusionPhase.cancelledByUser ||
        _phase == FallFusionPhase.confirmedSos) {
      final inCooldown = _lastTriggerAt != null &&
          now.difference(_lastTriggerAt!).inSeconds < 15;
      if (!inCooldown && svm >= impactThresholdG) {
        if (_isOffWrist) {
          // Va chạm nhưng đồng hồ đang nằm trên bàn -> Chặn ngay từ Pha 1/2!
          _peakSvmG = _currentSvmG;
          _impactTiltAngle = double.parse(tiltDeg.toStringAsFixed(1));
          _rejectFalseAlarm(
            FallFusionPhase.rejectedOffWrist,
            'Va chạm ${_currentSvmG}G khi đồng hồ đang tháo tay (Off-Body = true) -> Chặn báo giả',
          );
          return;
        }
        _phase = FallFusionPhase.stillnessOffBodyCheck;
        _impactAt = now;
        _peakSvmG = _currentSvmG;
        _impactTiltAngle = double.parse(tiltDeg.toStringAsFixed(1));
        _stillSamples = 0;
        _activeSamples = 0;
        _stillnessRatio = 0.0;
        _rejectedReason = null;
        notifyListeners();
      }
      return;
    }

    // Pha 2 -> Đánh giá bất động 3–5 giây (bỏ 1s rung dư chấn đầu tiên) + Off-Body == false
    if (_phase == FallFusionPhase.stillnessOffBodyCheck) {
      if (_currentSvmG > _peakSvmG) {
        _peakSvmG = _currentSvmG;
      }
      if (tiltDeg > _impactTiltAngle) {
        _impactTiltAngle = double.parse(tiltDeg.toStringAsFixed(1));
      }

      if (_isOffWrist) {
        _rejectFalseAlarm(
          FallFusionPhase.rejectedOffWrist,
          'Watch bị tháo tay trong cửa sổ 4s sau va chạm (Off-Body = true)',
        );
        return;
      }

      final impactTime = _impactAt ?? now;
      final elapsedMs = now.difference(impactTime).inMilliseconds;
      if (elapsedMs >= 900) {
        final dev = (svm - 1.0).abs();
        if (dev < 0.45) {
          _stillSamples++;
        } else {
          _activeSamples++;
        }
      }

      if (elapsedMs >= stillnessWindowMs) {
        final total = _stillSamples + _activeSamples;
        _stillnessRatio = total > 0 ? (_stillSamples / total) : 1.0;

        if (_stillnessRatio < 0.60) {
          _rejectFalseAlarm(
            FallFusionPhase.rejectedPostImpactMotion,
            'Sau va chạm vẫn cử động bình thường (Tỉ lệ bất động ${(_stillnessRatio * 100).round()}% < 60%)',
          );
          return;
        }

        // Đạt cả 3 điều kiện Pha 1 + Pha 2 -> Vào Pha 3: Kiểm tra PPG & Rung chờ hủy 15s
        _enterPhase3PpgAndCountdown(now);
      }
    }
  }

  void _enterPhase3PpgAndCountdown(DateTime now) {
    _phase = FallFusionPhase.ppgAndCountdown;
    _lastTriggerAt = now;
    _countdownRemaining = countdownSeconds;
    _evaluatePpgAndConfidence();
    notifyListeners();

    onPhase3CountdownStarted?.call(_countdownRemaining, _peakSvmG, _ppgAnomalyReason);

    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_phase != FallFusionPhase.ppgAndCountdown) {
        timer.cancel();
        return;
      }
      if (_isOffWrist) {
        timer.cancel();
        _rejectFalseAlarm(
          FallFusionPhase.rejectedOffWrist,
          'Đồng hồ tháo khỏi tay trong lúc đếm ngược -> Chặn báo động giả',
        );
        return;
      }
      if (_countdownRemaining > 1) {
        _countdownRemaining--;
        onPhase3Tick?.call(_countdownRemaining);
        notifyListeners();
      } else {
        timer.cancel();
        _countdownRemaining = 0;
        confirmPhase3Now();
      }
    });
  }

  void _evaluatePpgAndConfidence() {
    final reasons = <String>[];
    double conf = 0.72;
    if (_peakSvmG >= 4.0) {
      conf += 0.10;
    } else if (_peakSvmG >= 2.5) {
      conf += 0.05;
    }
    if (_stillnessRatio >= 0.85) conf += 0.06;

    if (_heartRate >= 115) {
      reasons.add('Nhịp tim tăng vọt $_heartRate BPM');
      conf += 0.09;
    } else if (_heartRate <= 48 && _heartRate > 0) {
      reasons.add('Nhịp tim tụt thấp $_heartRate BPM');
      conf += 0.10;
    }
    if (_spO2 < 92 && _spO2 > 0) {
      reasons.add('SpO2 hạ $_spO2%');
      conf += 0.10;
    }

    _ppgAnomalyReason = reasons.isEmpty
        ? 'PPG ổn định ($_heartRate BPM, SpO2 $_spO2%) + Bất động kéo dài'
        : reasons.join(' · ');
    _fusionConfidence = double.parse(conf.clamp(0.0, 0.99).toStringAsFixed(2));
  }

  /// Xác nhận hết 15s (hoặc dùng trong unit test để chốt Pha 3) -> Phát SOS Fusion
  FallFusionConfirmedEvent confirmPhase3Now() {
    _countdownTimer?.cancel();
    _countdownRemaining = 0;
    _evaluatePpgAndConfidence();
    _phase = FallFusionPhase.confirmedSos;
    notifyListeners();

    final event = FallFusionConfirmedEvent(
      peakSvmG: _peakSvmG,
      tiltAngleDegrees: _impactTiltAngle,
      stillnessRatio: double.parse(_stillnessRatio.toStringAsFixed(2)),
      isOffWrist: _isOffWrist,
      heartRateAtImpact: _heartRate,
      spO2AtImpact: _spO2,
      ppgAnomalyReason: _ppgAnomalyReason,
      fusionConfidence: _fusionConfidence,
      gForceWaveform: List<double>.from(_gForceWaveform),
      ppgWaveform: List<double>.from(_ppgWaveform),
      timestamp: _clock(),
    );
    onConfirmedFall?.call(event);
    return event;
  }

  void _rejectFalseAlarm(FallFusionPhase rejectedPhase, String reason) {
    _countdownTimer?.cancel();
    _phase = rejectedPhase;
    _rejectedReason = reason;
    _falseAlarmsBlockedCount++;
    _countdownRemaining = 0;
    _fusionConfidence = 0.0;
    notifyListeners();
    onFalseAlarmBlocked?.call(rejectedPhase, reason);
  }

  /// Người dùng bấm Hủy ("Tôi ổn") trong 15s Pha 3
  void cancelCurrentAlert() {
    _countdownTimer?.cancel();
    _countdownRemaining = 0;
    _phase = FallFusionPhase.cancelledByUser;
    _rejectedReason = 'Người đeo xác nhận an toàn trong 15s chờ hủy';
    notifyListeners();
  }

  @visibleForTesting
  void resetForTesting() {
    _countdownTimer?.cancel();
    _phase = FallFusionPhase.idleMonitoring;
    _impactAt = null;
    _lastTriggerAt = null;
    _currentSvmG = 1.0;
    _peakSvmG = 1.0;
    _impactTiltAngle = 0.0;
    _stillSamples = 0;
    _activeSamples = 0;
    _stillnessRatio = 1.0;
    _isOffWrist = false;
    _heartRate = 76;
    _spO2 = 98;
    _countdownRemaining = 0;
    _falseAlarmsBlockedCount = 0;
    _rejectedReason = null;
    _ppgAnomalyReason = 'Nhịp tim bình thường';
    _fusionConfidence = 0.0;
    impactThresholdG = defaultImpactThresholdG;
    stillnessWindowMs = defaultStillnessWindowMs;
    countdownSeconds = defaultCountdownSeconds;
    _gForceWaveform
      ..clear()
      ..addAll([1.0, 1.01, 0.99, 1.0, 1.02, 0.98, 1.0, 1.01]);
    _ppgWaveform
      ..clear()
      ..addAll([0.18, 0.24, 0.92, 0.14, 0.36, 0.18, 0.16, 0.19]);
    notifyListeners();
  }

  Map<String, dynamic> toFusionPayload() {
    return {
      'phase': phaseApiCode,
      'peakSvmG': _peakSvmG,
      'currentSvmG': _currentSvmG,
      'tiltAngle': _impactTiltAngle,
      'stillnessRatio': double.parse(_stillnessRatio.toStringAsFixed(2)),
      'isOffWrist': _isOffWrist,
      'heartRateAtImpact': _heartRate,
      'spo2AtImpact': _spO2,
      'ppgAnomalyReason': _ppgAnomalyReason,
      'confidence': _fusionConfidence,
      'falseAlarmsBlockedCount': _falseAlarmsBlockedCount,
      if (_rejectedReason != null) 'rejectedReason': _rejectedReason,
    };
  }
}
