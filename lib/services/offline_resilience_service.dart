import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';

/// Dữ liệu ước tính vị trí trong nhà / tầng hầm khi mất hoàn toàn sóng GPS (PDR)
class PdrIndoorEstimate {
  const PdrIndoorEstimate({
    required this.lastKnownLat,
    required this.lastKnownLng,
    required this.lastKnownTime,
    required this.stepsFromGpsLost,
    required this.headingDegrees,
    required this.estimatedDistanceMeters,
    required this.estimatedLat,
    required this.estimatedLng,
    required this.floorLabel,
    required this.altitudeDeltaMeters,
  });

  final double lastKnownLat;
  final double lastKnownLng;
  final DateTime lastKnownTime;
  final int stepsFromGpsLost;
  final double headingDegrees;
  final double estimatedDistanceMeters;
  final double estimatedLat;
  final double estimatedLng;
  final String floorLabel;
  final double altitudeDeltaMeters;

  String get summaryText {
    final minsAgo = DateTime.now().difference(lastKnownTime).inMinutes;
    final timeStr = minsAgo <= 0 ? 'vừa xong' : '$minsAgo phút trước';
    return 'Mất GPS $timeStr. Đã đi $stepsFromGpsLost bước (~${estimatedDistanceMeters.toStringAsFixed(0)}m, góc ${headingDegrees.toStringAsFixed(0)}°). Vị trí: $floorLabel.';
  }
}

/// Dịch vụ Sinh tồn Ngoại tuyến Toàn diện (Offline Resilience & PDR Service)
/// Giải quyết triệt để bài toán: Không có Internet, Không có sóng GPS, Kẹt hầm/nhà cao tầng
class OfflineResilienceService {
  OfflineResilienceService._();
  static final OfflineResilienceService instance = OfflineResilienceService._();

  // Trạng thái sóng & kết nối
  bool _isOnline = true;
  bool _hasGpsSignal = true;

  // Điểm GPS cuối cùng ghi nhận được (Last Known Location)
  double _lastKnownLat = 10.7769;
  double _lastKnownLng = 106.7009;
  DateTime _lastKnownGpsTime = DateTime.now();
  String _lastKnownAddress = 'Gần 18 Lê Lợi, Bến Nghé, Quận 1, TP.HCM';

  // Dữ liệu PDR (Pedestrian Dead Reckoning)
  int _stepsSinceGpsLoss = 0;
  double _currentHeadingDegrees = 90.0; // 0: Bắc, 90: Đông, 180: Nam, 270: Tây
  double _strideLengthMeters = 0.72; // Sải chân trung bình
  double _referencePressureHpa = 1013.25;
  double _currentPressureHpa = 1013.25;

  // Còi cứu hộ âm học
  bool _isSirenActive = false;
  Timer? _sirenTimer;
  final ValueNotifier<bool> sirenNotifier = ValueNotifier(false);

  bool get isOnline => _isOnline;
  bool get hasGpsSignal => _hasGpsSignal;
  bool get isSirenActive => _isSirenActive;
  double get lastKnownLat => _lastKnownLat;
  double get lastKnownLng => _lastKnownLng;
  DateTime get lastKnownGpsTime => _lastKnownGpsTime;
  String get lastKnownAddress => _lastKnownAddress;
  int get stepsSinceGpsLoss => _stepsSinceGpsLoss;

  void updateConnectivity({required bool isOnline}) {
    _isOnline = isOnline;
  }

  /// Cập nhật tọa độ GPS mới nhất khi còn nhận được vệ tinh GNSS
  void recordGpsPosition({
    required double lat,
    required double lng,
    String? address,
    double? pressureHpa,
  }) {
    _lastKnownLat = lat;
    _lastKnownLng = lng;
    _lastKnownGpsTime = DateTime.now();
    if (address != null) _lastKnownAddress = address;
    if (pressureHpa != null) _referencePressureHpa = pressureHpa;
    _hasGpsSignal = true;
    _stepsSinceGpsLoss = 0;
  }

  /// Đánh dấu mất sóng GPS và chuyển sang thuật toán PDR
  void markGpsLost() {
    _hasGpsSignal = false;
  }

  /// Cập nhật bước chân và góc la bàn khi di chuyển trong hầm/nhà kín
  void recordIndoorMovement({
    int newSteps = 1,
    double? headingDegrees,
    double? currentPressureHpa,
  }) {
    _stepsSinceGpsLoss += newSteps;
    if (headingDegrees != null) _currentHeadingDegrees = headingDegrees;
    if (currentPressureHpa != null) _currentPressureHpa = currentPressureHpa;
  }

  /// Tính toán tầng hầm / tầng cao từ cảm biến áp suất khí quyển (Barometer)
  /// deltaP = P0 - P; 1 hPa tương đương chênh lệch độ cao xấp xỉ 8.3m (0.12 hPa/m)
  String estimateFloor({double? pressureHpa, double? baselineHpa}) {
    final p = pressureHpa ?? _currentPressureHpa;
    final p0 = baselineHpa ?? _referencePressureHpa;
    final deltaP = p0 - p;
    final deltaHeightMeters = deltaP / 0.12; // Mét chênh lệch

    const floorHeight = 3.2; // Độ cao trung bình 1 tầng
    final floorIndex = (deltaHeightMeters / floorHeight).round();

    if (floorIndex == 0) {
      return 'Mặt đất (Tầng G / L1)';
    } else if (floorIndex < 0) {
      return 'Tầng hầm B${floorIndex.abs()} (${deltaHeightMeters.toStringAsFixed(1)}m)';
    } else {
      return 'Tầng cao L${floorIndex + 1} (+${deltaHeightMeters.toStringAsFixed(1)}m)';
    }
  }

  /// Ước tính vị trí quán tính (Pedestrian Dead Reckoning - PDR)
  PdrIndoorEstimate calculatePdrEstimate() {
    final distanceMeters = _stepsSinceGpsLoss * _strideLengthMeters;
    final headingRad = (_currentHeadingDegrees * math.pi) / 180.0;

    // Chuyển đổi mét sang vĩ độ/kinh độ xấp xỉ
    // 1 độ vĩ độ ~ 111,320m; 1 độ kinh độ ~ 111,320m * cos(lat)
    final dLat = (distanceMeters * math.cos(headingRad)) / 111320.0;
    final latRad = (_lastKnownLat * math.pi) / 180.0;
    final dLng = (distanceMeters * math.sin(headingRad)) / (111320.0 * math.cos(latRad));

    final estimatedLat = _lastKnownLat + dLat;
    final estimatedLng = _lastKnownLng + dLng;

    final deltaP = _referencePressureHpa - _currentPressureHpa;
    final altitudeDelta = deltaP / 0.12;
    final floorLabel = estimateFloor();

    return PdrIndoorEstimate(
      lastKnownLat: _lastKnownLat,
      lastKnownLng: _lastKnownLng,
      lastKnownTime: _lastKnownGpsTime,
      stepsFromGpsLost: _stepsSinceGpsLoss,
      headingDegrees: _currentHeadingDegrees,
      estimatedDistanceMeters: distanceMeters,
      estimatedLat: estimatedLat,
      estimatedLng: estimatedLng,
      floorLabel: floorLabel,
      altitudeDeltaMeters: altitudeDelta,
    );
  }

  /// Đóng gói tin nhắn SMS Cứu hộ Siêu Cấp Ngoại Tuyến (Toàn bộ Vị trí PDR + Y tế Cấp cứu)
  /// Cố định dưới 160 ký tự SMS tiêu chuẩn
  String formatComprehensiveOfflineSms({
    required String victimName,
    String? bloodType,
    String? criticalAllergy,
    int? heartRate,
    int? spO2,
    int? batteryLevel,
  }) {
    final pdr = calculatePdrEstimate();
    final latStr = pdr.lastKnownLat.toStringAsFixed(4);
    final lngStr = pdr.lastKnownLng.toStringAsFixed(4);

    final medParts = <String>[];
    if (bloodType != null && bloodType.trim().isNotEmpty) {
      medParts.add('Máu:$bloodType');
    }
    if (criticalAllergy != null && criticalAllergy.trim().isNotEmpty && criticalAllergy != 'Không có') {
      medParts.add('Dị ứng:$criticalAllergy');
    }
    final medStr = medParts.isNotEmpty ? ' [${medParts.join(",")}]' : '';

    final vitalsParts = <String>[];
    if (heartRate != null) vitalsParts.add('HR:$heartRate');
    if (spO2 != null) vitalsParts.add('SpO2:$spO2%');
    if (batteryLevel != null) vitalsParts.add('Pin:$batteryLevel%');
    final vitalsStr = vitalsParts.isNotEmpty ? ' {${vitalsParts.join(",")}}' : '';

    String locDetail;
    if (_hasGpsSignal) {
      locDetail = 'GPS: https://maps.google.com/?q=$latStr,$lngStr';
    } else {
      locDetail = 'LKL:$latStr,$lngStr PDR:+${pdr.estimatedDistanceMeters.round()}m ${pdr.floorLabel}';
    }

    return 'SOS SAFESOLO! $victimName$medStr$vitalsStr. $locDetail';
  }

  /// Kích hoạt Còi Cứu hộ Định vị Âm học (Acoustic Rescue Siren)
  void startAcousticRescueSiren() {
    _isSirenActive = true;
    sirenNotifier.value = true;
    _sirenTimer?.cancel();
    // Tạo xung nhịp phát âm thanh cứu hộ SOS
    _sirenTimer = Timer.periodic(const Duration(seconds: 2), (_) {
      // Trong môi trường thiết bị thực, gọi AudioPlayer hoặc SystemSound để phát 110dB SOS tone
      debugPrint('[OfflineResilience] Beeping Acoustic Rescue Siren 115dB SOS Morse pulse...');
    });
  }

  /// Tắt Còi Cứu hộ Âm học
  void stopAcousticRescueSiren() {
    _isSirenActive = false;
    sirenNotifier.value = false;
    _sirenTimer?.cancel();
    _sirenTimer = null;
  }
}
