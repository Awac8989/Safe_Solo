import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

/// ============================================================================
/// SAFESOLO — PHÂN HỆ 136: STROKE TIME-LOCK — Bộ Đếm Cửa Sổ Vàng tPA
///
/// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03 - TDMU
/// Căn cứ y khoa:
/// - Cửa sổ tPA: 4.5 giờ (270 phút) từ khi khởi phát triệu chứng
/// - "Time is Brain": mỗi phút mất = 1.9 triệu tế bào não (Saver JL, 2006)
/// - AHA/ASA Stroke Guidelines 2019
/// ============================================================================

/// Mức cảnh báo theo thời gian còn lại
enum StrokeAlertLevel {
  safe,          // > 180 phút — còn nhiều thời gian
  warning,       // 60–180 phút — cần khẩn trương
  critical,      // 20–60 phút — rất khẩn cấp
  expired,       // ≤ 0 phút — hết cửa sổ vàng
}

/// Trạng thái bộ đếm
enum StrokeTimerState {
  idle,
  running,
  paused,
  expired,
}

/// Snapshot thời gian thực của bộ đếm
class StrokeTimerSnapshot {
  const StrokeTimerSnapshot({
    required this.state,
    required this.symptomOnsetTime,
    required this.elapsedMinutes,
    required this.remainingMinutes,
    required this.alertLevel,
    required this.brainCellsLost,
    required this.progressPercent,
    required this.nearestHospital,
  });

  final StrokeTimerState state;
  final DateTime symptomOnsetTime;    // Thời điểm khởi phát
  final int elapsedMinutes;           // Số phút đã trôi qua
  final int remainingMinutes;         // Số phút còn lại
  final StrokeAlertLevel alertLevel;
  final double brainCellsLost;        // Triệu tế bào não đã mất
  final double progressPercent;       // 0.0 → 1.0 (1.0 = hết cửa sổ)
  final String nearestHospital;       // Bệnh viện gần nhất có can thiệp tPA

  String get remainingText {
    if (remainingMinutes <= 0) return 'ĐÃ HẾT CỬA SỔ VÀNG';
    final h = remainingMinutes ~/ 60;
    final m = remainingMinutes % 60;
    if (h > 0) return '$h giờ $m phút';
    return '$m phút';
  }

  String get alertMessage {
    switch (alertLevel) {
      case StrokeAlertLevel.safe:
        return 'Còn thời gian — Vận chuyển ngay đến bệnh viện';
      case StrokeAlertLevel.warning:
        return '⚠️ Khẩn trương! Báo bệnh viện pre-alert ngay';
      case StrokeAlertLevel.critical:
        return '🚨 CỰC KỲ KHẨN CẤP — Dưới 1 giờ còn lại!';
      case StrokeAlertLevel.expired:
        return '❌ Hết cửa sổ tPA — Chuyển phác đồ thrombectomy';
    }
  }

  Color get alertColor {
    switch (alertLevel) {
      case StrokeAlertLevel.safe:     return const Color(0xFF4CAF50); // Xanh lá
      case StrokeAlertLevel.warning:  return const Color(0xFFFF9800); // Cam
      case StrokeAlertLevel.critical: return const Color(0xFFF44336); // Đỏ
      case StrokeAlertLevel.expired:  return const Color(0xFF9E9E9E); // Xám
    }
  }

  String get brainCellsText => '${brainCellsLost.toStringAsFixed(0)} triệu tế bào não';
}

/// Service quản lý bộ đếm cửa sổ vàng đột quỵ
/// Phân hệ 136 — Stroke Time-Lock
class StrokeTimelockService extends ChangeNotifier {
  StrokeTimelockService._();
  static final StrokeTimelockService instance = StrokeTimelockService._();

  /// Cửa sổ can thiệp tPA chuẩn AHA: 270 phút = 4.5 giờ
  static const int kTpaWindowMinutes = 270;

  /// Tốc độ chết tế bào não: 1.9 triệu/phút (Saver 2006)
  static const double kBrainCellsPerMinute = 1.9;

  Timer? _ticker;
  DateTime? _symptomOnsetTime;
  StrokeTimerState _state = StrokeTimerState.idle;
  String _nearestHospital = 'Bệnh viện Đa khoa Bình Dương';

  StrokeTimerState get state => _state;
  DateTime? get symptomOnsetTime => _symptomOnsetTime;

  /// Snapshot hiện tại
  StrokeTimerSnapshot get snapshot {
    if (_symptomOnsetTime == null) {
      return StrokeTimerSnapshot(
        state: _state,
        symptomOnsetTime: DateTime.now(),
        elapsedMinutes: 0,
        remainingMinutes: kTpaWindowMinutes,
        alertLevel: StrokeAlertLevel.safe,
        brainCellsLost: 0,
        progressPercent: 0,
        nearestHospital: _nearestHospital,
      );
    }

    final elapsed = DateTime.now().difference(_symptomOnsetTime!).inMinutes;
    final remaining = (kTpaWindowMinutes - elapsed).clamp(0, kTpaWindowMinutes);
    final progress = (elapsed / kTpaWindowMinutes).clamp(0.0, 1.0);
    final cells = (elapsed * kBrainCellsPerMinute).clamp(0.0, double.infinity);

    StrokeAlertLevel level;
    if (remaining <= 0) {
      level = StrokeAlertLevel.expired;
    } else if (remaining <= 20) {
      level = StrokeAlertLevel.critical;
    } else if (remaining <= 60) {
      level = StrokeAlertLevel.warning;
    } else {
      level = StrokeAlertLevel.safe;
    }

    return StrokeTimerSnapshot(
      state: _state,
      symptomOnsetTime: _symptomOnsetTime!,
      elapsedMinutes: elapsed,
      remainingMinutes: remaining,
      alertLevel: level,
      brainCellsLost: cells,
      progressPercent: progress,
      nearestHospital: _nearestHospital,
    );
  }

  /// Bắt đầu bộ đếm từ thời điểm khởi phát triệu chứng
  void start({
    required DateTime onsetTime,
    String? nearestHospital,
  }) {
    _symptomOnsetTime = onsetTime;
    _state = StrokeTimerState.running;
    if (nearestHospital != null) _nearestHospital = nearestHospital;

    // Tick mỗi 15 giây để cập nhật UI
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(seconds: 15), (_) {
      final s = snapshot;
      if (s.remainingMinutes <= 0) {
        _state = StrokeTimerState.expired;
        _ticker?.cancel();
      }
      notifyListeners();
    });

    notifyListeners();
    if (kDebugMode) {
      debugPrint('[StrokeTimeLock] Started — Onset: $onsetTime — Window: $kTpaWindowMinutes min');
    }
  }

  /// Bắt đầu ngay từ thời điểm hiện tại
  void startNow({String? nearestHospital}) {
    start(onsetTime: DateTime.now(), nearestHospital: nearestHospital);
  }

  /// Dừng và reset
  void stop() {
    _ticker?.cancel();
    _symptomOnsetTime = null;
    _state = StrokeTimerState.idle;
    notifyListeners();
  }

  /// Cập nhật bệnh viện gần nhất (khi GPS xác định được)
  void updateNearestHospital(String hospitalName) {
    _nearestHospital = hospitalName;
    notifyListeners();
  }

  /// Danh sách bệnh viện có can thiệp tPA tại Bình Dương & TP.HCM
  static const List<Map<String, dynamic>> kStrokeHospitals = [
    {'name': 'BV Đa khoa tỉnh Bình Dương', 'type': 'tPA + Thrombectomy', 'phone': '0274 3822 840'},
    {'name': 'BV Chợ Rẫy TP.HCM', 'type': 'tPA + Thrombectomy', 'phone': '028 3855 4137'},
    {'name': 'BV Nhân dân 115', 'type': 'tPA + Thrombectomy', 'phone': '028 3864 0411'},
    {'name': 'BV Đại học Y Dược TP.HCM', 'type': 'tPA', 'phone': '028 3952 5174'},
    {'name': 'BV FV', 'type': 'tPA + Thrombectomy', 'phone': '028 5411 3333'},
  ];

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }
}
