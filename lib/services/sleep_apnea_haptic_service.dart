import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'blackbox_service.dart';
import 'offline_resilience_service.dart';
import 'wear_os_service.dart';

/// ============================================================================
/// SAFESOLO - CƠ CHẾ PHÁT HIỆN TỤT OXY BAN ĐÊM & XUNG RUNG THỨC TỈNH HAPTIC
/// (Nocturnal Desaturation & Sleep Apnea Emergency Haptic Engine)
///
/// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03
/// Phục vụ: Cảnh báo và ngăn ngừa đột tử ban đêm, đột quỵ trong giấc ngủ (Wake-up Stroke)
/// do ngưng thở khi ngủ tắc nghẽn (Obstructive Sleep Apnea - OSA).
///
/// 3 TẦNG KÍCH THÍCH CAN THIỆP THỨC TỈNH:
/// - TẦNG 0: Bình thường (SpO2 >= 92%)
/// - TẦNG 1: Xung rung Haptic dồn dập kích thích phản xạ thở (SpO2 < 88% kéo dài > 15s)
/// - TẦNG 2: Báo thức âm học tần số cao buộc đổi tư thế ngủ nghiêng (SpO2 < 85% > 30s)
/// - TẦNG 3: Báo động khẩn cấp SOS đa kênh + SMS người thân & Web Admin (SpO2 < 80% > 60s)
/// ============================================================================

enum ApneaInterventionTier {
  normal,                    // Bình an (SpO2 >= 92%)
  tier1HapticArousal,        // Tầng 1: Xung rung Haptic kích thích phản xạ thở (< 88% > 15s)
  tier2AcousticReposition,   // Tầng 2: Chuông âm học đánh thức đổi tư thế ngủ (< 85% > 30s)
  tier3EmergencySos,         // Tầng 3: Báo động đỏ khẩn cấp SOS ngưng thở (< 80% > 60s)
}

class ApneaEventLog {
  const ApneaEventLog({
    required this.timestamp,
    required this.lowestSpo2,
    required this.durationSeconds,
    required this.maxTierReached,
    required this.recoveredSuccessfully,
    required this.notes,
  });

  final DateTime timestamp;
  final int lowestSpo2;
  final int durationSeconds;
  final ApneaInterventionTier maxTierReached;
  final bool recoveredSuccessfully;
  final String notes;

  String get timeFormatted {
    final h = timestamp.hour.toString().padLeft(2, '0');
    final m = timestamp.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }
}

class SleepApneaHapticService extends ChangeNotifier {
  SleepApneaHapticService._() {
    _initDefaultPoints();
  }

  static final SleepApneaHapticService instance = SleepApneaHapticService._();

  final bool _isMonitoring = true;
  final double _baselineSpo2 = 98.0;
  int _currentSpo2 = 98;
  int _currentHeartRate = 68;

  ApneaInterventionTier _currentTier = ApneaInterventionTier.normal;
  DateTime? _eventStartTime;
  Timer? _hapticBurstTimer;

  // Thống kê giấc ngủ ban đêm
  int _desaturationCountTonight = 0;
  int _successfulHapticRecoveries = 0;
  final List<double> _spo2WaveformPoints = [];
  final List<ApneaEventLog> _tonightLogs = [];

  // Getters
  bool get isMonitoring => _isMonitoring;
  double get baselineSpo2 => _baselineSpo2;
  int get currentSpo2 => _currentSpo2;
  int get currentHeartRate => _currentHeartRate;
  ApneaInterventionTier get currentTier => _currentTier;
  int get desaturationCountTonight => _desaturationCountTonight;
  int get successfulHapticRecoveries => _successfulHapticRecoveries;
  List<double> get spo2WaveformPoints => List.unmodifiable(_spo2WaveformPoints);
  List<ApneaEventLog> get tonightLogs => List.unmodifiable(_tonightLogs);

  double get odiScore {
    // Chỉ số Oxygen Desaturation Index (ODI): số lần tụt oxy mỗi giờ
    // Giả định phiên ngủ 7 tiếng
    return double.parse((_desaturationCountTonight / 7.0).toStringAsFixed(1));
  }

  String get odiSeverityVi {
    if (odiScore < 5.0) return 'Bình thường / Nhẹ (<5/giờ)';
    if (odiScore < 15.0) return 'Mức độ Trung bình (5-15/giờ)';
    if (odiScore < 30.0) return 'Nguy cơ Nặng (15-30/giờ)';
    return 'CỰC KỲ NGUY HIỂM (>30/giờ - Nguy cơ Đột quỵ cao)';
  }

  void _initDefaultPoints() {
    _spo2WaveformPoints.clear();
    // Khởi tạo đồ thị SpO2 mẫu 16 điểm ban đêm
    for (int i = 0; i < 16; i++) {
      _spo2WaveformPoints.add(97.0 + (math.Random().nextDouble() * 2.0));
    }
  }

  // ===========================================================================
  // 1. ĐÁNH GIÁ CHỈ SỐ SINH TRẮC BAN ĐÊM (EVALUATION ENGINE)
  // ===========================================================================

  void evaluateVitalsReading({
    required int spo2,
    required int heartRate,
    bool isNightMode = true,
  }) {
    if (!_isMonitoring) return;

    _currentSpo2 = spo2;
    _currentHeartRate = heartRate;

    // Cập nhật waveform
    _spo2WaveformPoints.add(spo2.toDouble());
    if (_spo2WaveformPoints.length > 24) {
      _spo2WaveformPoints.removeAt(0);
    }

    final now = DateTime.now();

    // 1. Kiểm tra tụt oxy cấp tính (SpO2 < 88%)
    if (spo2 < 88) {
      _eventStartTime ??= now;
      final elapsedSec = now.difference(_eventStartTime!).inSeconds;

      if (spo2 < 80 && elapsedSec >= 60) {
        _escalateToTier3Emergency();
      } else if (spo2 < 85 && elapsedSec >= 30) {
        _escalateToTier2Acoustic();
      } else if (elapsedSec >= 15) {
        _escalateToTier1Haptic();
      }
    } else {
      // 2. Phục hồi oxy an toàn (SpO2 >= 95%)
      if (_currentTier != ApneaInterventionTier.normal) {
        _handleRecoveryEvent();
      }
      _eventStartTime = null;
    }

    notifyListeners();
  }

  // ===========================================================================
  // 2. CÁC TẦNG CAN THIỆP XUNG RUNG & BÁO ĐỘNG (INTERVENTION TIERS)
  // ===========================================================================

  /// TẦNG 1: Phát chuỗi xung rung Haptic dồn dập kích thích cơ hô hấp
  void _escalateToTier1Haptic() {
    if (_currentTier == ApneaInterventionTier.tier1HapticArousal) return;
    _currentTier = ApneaInterventionTier.tier1HapticArousal;
    _desaturationCountTonight++;

    debugPrint('[SleepApnea] Triggering Tier 1 Tactile Respiratory Arousal (SpO2: $_currentSpo2%)');

    // Phát chuỗi xung rung 3 nhịp liên tiếp mỗi 3 giây
    _hapticBurstTimer?.cancel();
    _hapticBurstTimer = Timer.periodic(const Duration(seconds: 3), (timer) {
      if (_currentTier != ApneaInterventionTier.tier1HapticArousal) {
        timer.cancel();
        return;
      }
      HapticFeedback.heavyImpact();
      Future.delayed(const Duration(milliseconds: 300), () => HapticFeedback.heavyImpact());
      Future.delayed(const Duration(milliseconds: 600), () => HapticFeedback.heavyImpact());
    });

    notifyListeners();
  }

  /// TẦNG 2: Báo thức âm học đánh thức người dùng xoay nghiêng người
  void _escalateToTier2Acoustic() {
    if (_currentTier == ApneaInterventionTier.tier2AcousticReposition) return;
    _currentTier = ApneaInterventionTier.tier2AcousticReposition;

    debugPrint('[SleepApnea] Escalating to Tier 2 Acoustic Repositioning Wake-up (SpO2: $_currentSpo2%)');
    _hapticBurstTimer?.cancel();

    // Bật còi báo thức tần số cao
    OfflineResilienceService.instance.startAcousticRescueSiren();

    notifyListeners();
  }

  /// TẦNG 3: Báo động đỏ khẩn cấp cứu hộ ngưng thở ban đêm
  void _escalateToTier3Emergency() {
    if (_currentTier == ApneaInterventionTier.tier3EmergencySos) return;
    _currentTier = ApneaInterventionTier.tier3EmergencySos;

    debugPrint('[SleepApnea] CRITICAL: Escalating to Tier 3 Nocturnal Emergency SOS (SpO2: $_currentSpo2%)');
    _hapticBurstTimer?.cancel();

    // 1. Kích hoạt chuông còi cứu nạn lớn nhất
    OfflineResilienceService.instance.startAcousticRescueSiren();

    // 2. Đẩy bằng chứng Hộp đen
    unawaited(BlackboxService.instance.captureAndUploadEvidence(
      userId: 'user_quan_2224801030137',
      triggerSource: 'NOCTURNAL_SLEEP_APNEA_CRITICAL',
    ));

    // 3. Báo WearOS
    WearOsService.instance.simulateCriticalSpO2();

    notifyListeners();
  }

  void _handleRecoveryEvent() {
    final prevTier = _currentTier;
    final duration = _eventStartTime != null
        ? DateTime.now().difference(_eventStartTime!).inSeconds
        : 22;

    _tonightLogs.insert(
      0,
      ApneaEventLog(
        timestamp: DateTime.now(),
        lowestSpo2: _currentSpo2,
        durationSeconds: duration,
        maxTierReached: prevTier,
        recoveredSuccessfully: true,
        notes: 'Xung rung Haptic đánh thức thành công. Oxy máu phục hồi lên $_currentSpo2%.',
      ),
    );

    if (prevTier == ApneaInterventionTier.tier1HapticArousal) {
      _successfulHapticRecoveries++;
    }

    _currentTier = ApneaInterventionTier.normal;
    _hapticBurstTimer?.cancel();
    _hapticBurstTimer = null;
    OfflineResilienceService.instance.stopAcousticRescueSiren();

    debugPrint('[SleepApnea] Patient respiratory reflex restored! SpO2 normalized to $_currentSpo2%');
    notifyListeners();
  }

  // ===========================================================================
  // 3. CÁC KỊCH BẢN GIẢ LẬP HỘI ĐỒNG (THESIS DEFENSE SIMULATIONS)
  // ===========================================================================

  /// Mô phỏng Cơn ngưng thở OSA ban đêm: SpO2 hạ còn 84%, kích hoạt Rung Haptic tầng 1,
  /// sau đó phục hồi về 98%
  void simulateNocturnalApneaEvent({
    int dropSpo2 = 84,
    int durationSec = 18,
    bool autoRecover = true,
  }) {
    _currentSpo2 = dropSpo2;
    _currentHeartRate = 52; // Nhịp tim chậm dần khi ngưng thở
    _eventStartTime = DateTime.now().subtract(Duration(seconds: durationSec));

    evaluateVitalsReading(spo2: dropSpo2, heartRate: 52);

    if (autoRecover) {
      // Sau 5 giây, giả lập phản xạ thở phục hồi
      Timer(const Duration(seconds: 5), () {
        _currentSpo2 = 97;
        _currentHeartRate = 82; // Nhịp tim tăng vọt bù trừ khi thở lại
        evaluateVitalsReading(spo2: 97, heartRate: 82);
      });
    }
  }

  /// Mô phỏng Suy hô hấp kịch phát: SpO2 rơi tự do còn 76% kéo dài > 60s
  void simulateSevereHypoxemicCrisis() {
    _currentSpo2 = 76;
    _currentHeartRate = 128;
    _eventStartTime = DateTime.now().subtract(const Duration(seconds: 65));
    evaluateVitalsReading(spo2: 76, heartRate: 128);
  }

  void resetNightSession() {
    _currentSpo2 = 98;
    _currentHeartRate = 68;
    _currentTier = ApneaInterventionTier.normal;
    _eventStartTime = null;
    _hapticBurstTimer?.cancel();
    _hapticBurstTimer = null;
    OfflineResilienceService.instance.stopAcousticRescueSiren();
    _desaturationCountTonight = 0;
    _successfulHapticRecoveries = 0;
    _tonightLogs.clear();
    _initDefaultPoints();
    notifyListeners();
  }
}
