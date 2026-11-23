import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

/// ============================================================================
/// SAFESOLO — PHÂN HỆ 137: GALAXY WATCH 5 SpO₂ CONTINUOUS MONITOR
/// Theo dõi liên tục SpO₂ + HR qua BioActive Sensor Watch 5
/// Cảnh báo: SpO₂ < 90% = Nguy hiểm, HR > 180 BPM = Rủi ro khi cứu hộ
///
/// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03 - TDMU
/// Căn cứ y khoa:
/// - WHO: SpO₂ bình thường 95–100%
/// - SpO₂ < 90% = hypoxemia nghiêm trọng → cần can thiệp
/// - AHA: Max safe HR khi cứu hộ = 220 - tuổi
/// ============================================================================

/// Mức cảnh báo SpO₂
enum SpO2AlertLevel {
  normal,      // 95–100%
  caution,     // 90–94%
  critical,    // < 90%
  unavailable, // Chưa đọc được
}

/// Reading SpO₂ + HR tại một thời điểm
class SpO2Reading {
  const SpO2Reading({
    required this.timestamp,
    required this.spo2Percent,
    required this.heartRateBpm,
    required this.alertLevel,
    required this.isRescuerAtRisk,
  });

  final DateTime timestamp;
  final double spo2Percent;    // 0–100
  final int heartRateBpm;
  final SpO2AlertLevel alertLevel;
  final bool isRescuerAtRisk;  // HR quá cao cho người cứu hộ

  String get spo2Display => '${spo2Percent.toStringAsFixed(0)}%';
  String get hrDisplay => '$heartRateBpm BPM';

  String get alertMessage {
    switch (alertLevel) {
      case SpO2AlertLevel.normal:
        return 'SpO₂ bình thường — An toàn';
      case SpO2AlertLevel.caution:
        return '⚠️ SpO₂ thấp — Chú ý theo dõi';
      case SpO2AlertLevel.critical:
        return '🚨 SpO₂ NGUY HIỂM — Can thiệp ngay!';
      case SpO2AlertLevel.unavailable:
        return 'Đang đọc dữ liệu...';
    }
  }

  Color get alertColor {
    switch (alertLevel) {
      case SpO2AlertLevel.normal:     return const Color(0xFF4CAF50);
      case SpO2AlertLevel.caution:    return const Color(0xFFFF9800);
      case SpO2AlertLevel.critical:   return const Color(0xFFF44336);
      case SpO2AlertLevel.unavailable: return const Color(0xFF9E9E9E);
    }
  }

  static SpO2AlertLevel computeAlertLevel(double spo2) {
    if (spo2 <= 0) return SpO2AlertLevel.unavailable;
    if (spo2 < 90) return SpO2AlertLevel.critical;
    if (spo2 < 95) return SpO2AlertLevel.caution;
    return SpO2AlertLevel.normal;
  }
}

/// Configuration Watch SpO₂ Monitor
class SpO2MonitorConfig {
  const SpO2MonitorConfig({
    this.criticalSpO2Threshold = 90.0,
    this.cautionSpO2Threshold = 94.0,
    this.maxSafeHrForRescuer = 170,
    this.measureIntervalSeconds = 30,
    this.enableVibrateOnCritical = true,
    this.enableWatchAlert = true,
  });

  final double criticalSpO2Threshold;
  final double cautionSpO2Threshold;
  final int maxSafeHrForRescuer;
  final int measureIntervalSeconds;
  final bool enableVibrateOnCritical;
  final bool enableWatchAlert;
}

/// Service theo dõi SpO₂ liên tục qua Galaxy Watch 5 BioActive Sensor
/// Phân hệ 137 — Watch SpO₂ Monitor
class WatchSpo2MonitorService extends ChangeNotifier {
  WatchSpo2MonitorService._();
  static final WatchSpo2MonitorService instance = WatchSpo2MonitorService._();

  SpO2MonitorConfig _config = const SpO2MonitorConfig();
  Timer? _monitorTimer;
  bool _isMonitoring = false;
  final List<SpO2Reading> _readings = [];
  SpO2Reading? _latestReading;
  final _rng = math.Random();

  bool get isMonitoring => _isMonitoring;
  SpO2Reading? get latestReading => _latestReading;
  List<SpO2Reading> get readings => List.unmodifiable(_readings);

  /// Khởi động theo dõi liên tục
  Future<void> startMonitoring({SpO2MonitorConfig? config}) async {
    if (_isMonitoring) return;
    if (config != null) _config = config;

    _isMonitoring = true;
    notifyListeners();

    if (kDebugMode) {
      debugPrint('[WatchSpO₂] Bắt đầu theo dõi — Interval: ${_config.measureIntervalSeconds}s');
    }

    // Tick đọc SpO₂ định kỳ từ Watch 5 BioActive Sensor
    _monitorTimer = Timer.periodic(
      Duration(seconds: _config.measureIntervalSeconds),
      (_) => _takeMeasurement(),
    );

    // Đọc ngay lần đầu
    await _takeMeasurement();
  }

  /// Dừng theo dõi
  void stopMonitoring() {
    _monitorTimer?.cancel();
    _monitorTimer = null;
    _isMonitoring = false;
    notifyListeners();
  }

  /// Lấy reading mới nhất thủ công
  Future<SpO2Reading?> takeManualReading() async {
    return _takeMeasurement();
  }

  /// Tính SpO₂ trung bình trong N phút gần nhất
  double averageSpO2({int lastMinutes = 10}) {
    final cutoff = DateTime.now().subtract(Duration(minutes: lastMinutes));
    final recent = _readings.where((r) => r.timestamp.isAfter(cutoff)).toList();
    if (recent.isEmpty) return 0;
    return recent.map((r) => r.spo2Percent).reduce((a, b) => a + b) / recent.length;
  }

  /// Số lần SpO₂ critical trong session
  int get criticalCount => _readings.where((r) => r.alertLevel == SpO2AlertLevel.critical).length;

  /// Xuất log SpO₂ cho báo cáo y tế
  Map<String, dynamic> exportSessionLog() => {
    'sessionStart': _readings.isNotEmpty ? _readings.first.timestamp.toIso8601String() : null,
    'sessionEnd': _readings.isNotEmpty ? _readings.last.timestamp.toIso8601String() : null,
    'totalReadings': _readings.length,
    'averageSpO2': averageSpO2(lastMinutes: 60),
    'criticalEpisodes': criticalCount,
    'minSpO2': _readings.isNotEmpty
        ? _readings.map((r) => r.spo2Percent).reduce(math.min)
        : 0,
    'readings': _readings.map((r) => {
      'time': r.timestamp.toIso8601String(),
      'spo2': r.spo2Percent,
      'hr': r.heartRateBpm,
      'level': r.alertLevel.name,
    }).toList(),
  };

  // === PRIVATE ===

  Future<SpO2Reading?> _takeMeasurement() async {
    try {
      // Thực tế: Samsung Health SDK (Wear OS) SpO₂ Continuous API
      // → BLE GATT notify → parse characteristic 0x2A5F (SpO2)
      //
      // Demo: sinh giá trị thực tế mô phỏng
      final spo2 = _simulateSpO2();
      final hr = _simulateHeartRate();
      final alertLevel = SpO2Reading.computeAlertLevel(spo2);
      final rescuerAtRisk = hr > _config.maxSafeHrForRescuer;

      final reading = SpO2Reading(
        timestamp: DateTime.now(),
        spo2Percent: spo2,
        heartRateBpm: hr,
        alertLevel: alertLevel,
        isRescuerAtRisk: rescuerAtRisk,
      );

      _readings.add(reading);
      if (_readings.length > 500) _readings.removeAt(0); // Giữ 500 readings gần nhất
      _latestReading = reading;

      // Cảnh báo khi critical
      if (alertLevel == SpO2AlertLevel.critical && _config.enableVibrateOnCritical) {
        _triggerCriticalAlert(reading);
      }

      notifyListeners();
      return reading;
    } catch (e) {
      if (kDebugMode) debugPrint('[WatchSpO₂] Lỗi đọc: $e');
      return null;
    }
  }

  void _triggerCriticalAlert(SpO2Reading reading) {
    if (kDebugMode) {
      debugPrint('[WatchSpO₂] 🚨 CRITICAL: SpO₂=${reading.spo2Percent}% HR=${reading.heartRateBpm}');
    }
    // Thực tế: gửi vibrate command qua BLE GATT → Watch 5
    // + local notification
  }

  /// Mô phỏng SpO₂ thực tế (95–100% bình thường, đôi khi drop)
  double _simulateSpO2() {
    final base = 97.0 + _rng.nextDouble() * 2.0;
    // 5% cơ hội SpO₂ thấp (cứu hộ trong môi trường khói/thiếu O₂)
    if (_rng.nextDouble() < 0.05) return 88.0 + _rng.nextDouble() * 4.0;
    return (base).clamp(94.0, 100.0);
  }

  /// Mô phỏng HR (60–90 bình thường, cao hơn khi hoạt động cứu hộ)
  int _simulateHeartRate() {
    return (70 + _rng.nextInt(40)).clamp(60, 180);
  }

  @override
  void dispose() {
    _monitorTimer?.cancel();
    super.dispose();
  }
}
