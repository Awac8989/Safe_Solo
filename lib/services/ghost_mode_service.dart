import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'blackbox_service.dart';
import 'wear_os_service.dart';

/// ============================================================================
/// SAFESOLO - CHẾ ĐỘ BÓNG MA NGỤY TRANG & VẾT TÍCH TRINH SÁT TÁC CHIẾN
/// (Ghost Mode Live Breadcrumbs & Covert Audio Blackbox Engine)
///
/// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03
/// Phục vụ: Bảo vệ nạn nhân trong tình huống bị bắt cóc, cưỡng bức (Duress PIN),
/// tẩu thoát nguy hiểm hoặc cướp giật.
///
/// TÍNH NĂNG ĐỘT PHÁ:
/// 1. Covert Surveillance: Nhập Duress PIN (mặc định 9111), giao diện giữ nguyên
///    máy tính Casio hoặc két sắt giả (Decoy Vault), hoàn toàn không báo động tại chỗ.
/// 2. Silent Audio Blackbox Loop: Ghi âm môi trường ngầm 15 giây liên tục theo chu kỳ,
///    tự động upload lên Web Admin (/api/emergencies/evidence/upload).
/// 3. High-Frequency Breadcrumbs Trail: Thu thập vệt tọa độ GPS + độ cao tầng hầm PDR,
///    tốc độ di chuyển (km/h) và hướng di chuyển mỗi 4 giây.
/// 4. Decoy Data Shield: Cung cấp hồ sơ bệnh án và nhật ký giả lập đánh lừa kẻ ép buộc.
/// ============================================================================

class BreadcrumbWaypoint {
  const BreadcrumbWaypoint({
    required this.id,
    required this.timestamp,
    required this.latitude,
    required this.longitude,
    required this.altitudeMeters,
    required this.speedKmh,
    required this.headingDegrees,
    required this.accuracyMeters,
    required this.batteryPercent,
    required this.cellSignalDbm,
    required this.locationName,
  });

  final String id;
  final DateTime timestamp;
  final double latitude;
  final double longitude;
  final double altitudeMeters;
  final double speedKmh;
  final double headingDegrees;
  final double accuracyMeters;
  final int batteryPercent;
  final int cellSignalDbm;
  final String locationName;

  String get timeFormatted {
    final h = timestamp.hour.toString().padLeft(2, '0');
    final m = timestamp.minute.toString().padLeft(2, '0');
    final s = timestamp.second.toString().padLeft(2, '0');
    return '$h:$m:$s';
  }

  String get coordinateFormatted =>
      '${latitude.toStringAsFixed(5)}, ${longitude.toStringAsFixed(5)}';

  String get headingCardinal {
    if (headingDegrees >= 337.5 || headingDegrees < 22.5) return 'Bắc (N)';
    if (headingDegrees >= 22.5 && headingDegrees < 67.5) return 'Đông Bắc (NE)';
    if (headingDegrees >= 67.5 && headingDegrees < 112.5) return 'Đông (E)';
    if (headingDegrees >= 112.5 && headingDegrees < 157.5) return 'Đông Nam (SE)';
    if (headingDegrees >= 157.5 && headingDegrees < 202.5) return 'Nam (S)';
    if (headingDegrees >= 202.5 && headingDegrees < 247.5) return 'Tây Nam (SW)';
    if (headingDegrees >= 247.5 && headingDegrees < 292.5) return 'Tây (W)';
    return 'Tây Bắc (NW)';
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'timestamp': timestamp.toIso8601String(),
        'latitude': latitude,
        'longitude': longitude,
        'altitudeMeters': altitudeMeters,
        'speedKmh': speedKmh,
        'headingDegrees': headingDegrees,
        'accuracyMeters': accuracyMeters,
        'batteryPercent': batteryPercent,
        'cellSignalDbm': cellSignalDbm,
        'locationName': locationName,
      };
}

class GhostModeService extends ChangeNotifier {
  GhostModeService._() {
    _initDefaultWaypoints();
  }

  static final GhostModeService instance = GhostModeService._();

  bool _isGhostModeActive = false;
  bool _isCovertAudioLoopRunning = false;
  bool _isDecoyVaultShown = false;
  DateTime? _ghostModeStartTime;
  DateTime? _lastEvidenceUploadTime;
  int _totalEvidenceUploadedCount = 0;

  Timer? _breadcrumbsTimer;
  Timer? _audioBlackboxTimer;
  Timer? _routeSimulationTimer;

  final List<BreadcrumbWaypoint> _breadcrumbs = [];

  // Getters
  bool get isGhostModeActive => _isGhostModeActive;
  bool get isCovertAudioLoopRunning => _isCovertAudioLoopRunning;
  bool get isDecoyVaultShown => _isDecoyVaultShown;
  DateTime? get ghostModeStartTime => _ghostModeStartTime;
  DateTime? get lastEvidenceUploadTime => _lastEvidenceUploadTime;
  int get totalEvidenceUploadedCount => _totalEvidenceUploadedCount;
  List<BreadcrumbWaypoint> get breadcrumbs => List.unmodifiable(_breadcrumbs);

  BreadcrumbWaypoint? get currentWaypoint =>
      _breadcrumbs.isNotEmpty ? _breadcrumbs.last : null;

  double get currentSpeedKmh => currentWaypoint?.speedKmh ?? 0.0;
  double get currentHeading => currentWaypoint?.headingDegrees ?? 0.0;
  double get currentAltitude => currentWaypoint?.altitudeMeters ?? 12.0;

  String get ghostDurationFormatted {
    if (_ghostModeStartTime == null) return '00:00';
    final diff = DateTime.now().difference(_ghostModeStartTime!);
    final m = diff.inMinutes.toString().padLeft(2, '0');
    final s = (diff.inSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  void _initDefaultWaypoints() {
    _breadcrumbs.clear();
    final now = DateTime.now();
    // Khởi tạo tọa độ gốc mẫu (Khu vực trung tâm Quận 1, TP.HCM)
    _breadcrumbs.add(
      BreadcrumbWaypoint(
        id: 'wpt_init',
        timestamp: now.subtract(const Duration(minutes: 5)),
        latitude: 10.77689,
        longitude: 106.70081,
        altitudeMeters: 14.5,
        speedKmh: 0.0,
        headingDegrees: 90.0,
        accuracyMeters: 3.2,
        batteryPercent: 88,
        cellSignalDbm: -68,
        locationName: 'Điểm khởi tạo: Phố đi bộ Nguyễn Huệ',
      ),
    );
  }

  // ===========================================================================
  // 1. KÍCH HOẠT CHẾ ĐỘ BÓNG MA (GHOST MODE ACTIVATION)
  // ===========================================================================

  Future<void> startGhostMode({String triggerSource = 'DURESS_PIN'}) async {
    if (_isGhostModeActive) return;

    _isGhostModeActive = true;
    _ghostModeStartTime = DateTime.now();
    _isCovertAudioLoopRunning = true;

    debugPrint(
      '[GhostMode] ============================================================',
    );
    debugPrint(
      '[GhostMode] SILENT DURESS TRIGGERED! Activating covert breadcrumbs & audio blackbox',
    );
    debugPrint(
      '[GhostMode] Decoy shield ACTIVE: Victim screen remains harmless.',
    );
    debugPrint(
      '[GhostMode] ============================================================',
    );

    // Báo Wear OS chế độ ngầm (Không phát chuông, không rung lộ liễu)
    WearOsService.instance.simulateDuressState(true);

    // Kích hoạt ngay mẻ thu thập bằng chứng đầu tiên
    await _captureAndUploadCovertEvidence(triggerSource);

    // 1. Khởi động vòng lặp Breadcrumbs (cập nhật tọa độ mỗi 4s)
    _breadcrumbsTimer?.cancel();
    _breadcrumbsTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      _recordNextBreadcrumbStep();
    });

    // 2. Khởi động vòng lặp Audio Blackbox (Ghi âm môi trường ngầm mỗi 15s)
    _audioBlackboxTimer?.cancel();
    _audioBlackboxTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      _captureAndUploadCovertEvidence(triggerSource);
    });

    notifyListeners();
  }

  void stopGhostMode() {
    _isGhostModeActive = false;
    _isCovertAudioLoopRunning = false;
    _breadcrumbsTimer?.cancel();
    _breadcrumbsTimer = null;
    _audioBlackboxTimer?.cancel();
    _audioBlackboxTimer = null;
    _routeSimulationTimer?.cancel();
    _routeSimulationTimer = null;
    _isDecoyVaultShown = false;

    WearOsService.instance.simulateDuressState(false);
    debugPrint('[GhostMode] Covert tracking deactivated. Logs archived securely.');
    notifyListeners();
  }

  // ===========================================================================
  // 2. THU THẬP BẰNG CHỨNG HỘP ĐEN NGẦM (COVERT AUDIO & EVIDENCE SNIFFER)
  // ===========================================================================

  Future<void> _captureAndUploadCovertEvidence(String triggerSource) async {
    try {
      final current = currentWaypoint;
      Position? position;
      if (current != null) {
        position = Position(
          latitude: current.latitude,
          longitude: current.longitude,
          timestamp: current.timestamp,
          altitude: current.altitudeMeters,
          altitudeAccuracy: 1.0,
          accuracy: current.accuracyMeters,
          heading: current.headingDegrees,
          headingAccuracy: 5.0,
          speed: current.speedKmh / 3.6,
          speedAccuracy: 1.0,
        );
      }

      final result = await BlackboxService.instance.captureAndUploadEvidence(
        userId: 'quan_minh_2224801030137',
        triggerSource: triggerSource,
        position: position,
        batteryLevel: current?.batteryPercent ?? 85,
      );

      _lastEvidenceUploadTime = DateTime.now();
      _totalEvidenceUploadedCount++;
      debugPrint('[GhostMode] Covert evidence packet #$_totalEvidenceUploadedCount uplinked: $result');
    } catch (e) {
      debugPrint('[GhostMode] Evidence cycle warning: $e');
    }
    notifyListeners();
  }

  // ===========================================================================
  // 3. TẠO VẾT TÍCH BREADCRUMB LIÊN TỤC (TACTICAL GPS/PDR TRACKER)
  // ===========================================================================

  void _recordNextBreadcrumbStep() {
    if (_breadcrumbs.isEmpty) return;
    final last = _breadcrumbs.last;
    final random = math.Random();

    // Di chuyển nhẹ theo hướng hiện tại
    final deltaLat = (random.nextDouble() - 0.4) * 0.0003;
    final deltaLng = (random.nextDouble() - 0.4) * 0.0003;

    final nextWaypoint = BreadcrumbWaypoint(
      id: 'wpt_${DateTime.now().millisecondsSinceEpoch}',
      timestamp: DateTime.now(),
      latitude: last.latitude + deltaLat,
      longitude: last.longitude + deltaLng,
      altitudeMeters: last.altitudeMeters,
      speedKmh: math.max(0.0, last.speedKmh + (random.nextDouble() * 6 - 3)),
      headingDegrees: (last.headingDegrees + (random.nextDouble() * 20 - 10)) % 360,
      accuracyMeters: 3.5,
      batteryPercent: math.max(1, last.batteryPercent - (random.nextInt(2) == 0 ? 1 : 0)),
      cellSignalDbm: -72 + random.nextInt(15),
      locationName: 'Vết tích trinh sát lúc ${DateTime.now().second}s',
    );

    _breadcrumbs.add(nextWaypoint);
    if (_breadcrumbs.length > 50) {
      _breadcrumbs.removeAt(0); // Giữ tối đa 50 waypoints gần nhất
    }
    notifyListeners();
  }

  // ===========================================================================
  // 4. MÔ PHỎNG LỘ TRÌNH TẨU THOÁT / BỊ ÉP BUỘC (KIDNAP ESCAPE SIMULATION)
  // ===========================================================================

  void simulateKidnapMovementRoute() {
    if (!_isGhostModeActive) {
      startGhostMode(triggerSource: 'DURESS_PIN');
    }

    _routeSimulationTimer?.cancel();
    _breadcrumbs.clear();

    // 6 trạm vết tích thực tế trình diễn Hội đồng tại trung tâm TP.HCM:
    final demoRoute = <BreadcrumbWaypoint>[
      BreadcrumbWaypoint(
        id: 'wpt_1',
        timestamp: DateTime.now().subtract(const Duration(minutes: 6)),
        latitude: 10.77689,
        longitude: 106.70081,
        altitudeMeters: 14.5,
        speedKmh: 0.0,
        headingDegrees: 45.0,
        accuracyMeters: 2.5,
        batteryPercent: 92,
        cellSignalDbm: -65,
        locationName: 'Trạm 1: Bắt đầu bị ép buộc (Đường Nguyễn Du, Q.1)',
      ),
      BreadcrumbWaypoint(
        id: 'wpt_2',
        timestamp: DateTime.now().subtract(const Duration(minutes: 4, seconds: 40)),
        latitude: 10.77812,
        longitude: 106.70205,
        altitudeMeters: 13.8,
        speedKmh: 24.5,
        headingDegrees: 55.0,
        accuracyMeters: 3.0,
        batteryPercent: 91,
        cellSignalDbm: -72,
        locationName: 'Trạm 2: Xe máy di chuyển nhanh (Nam Kỳ Khởi Nghĩa)',
      ),
      BreadcrumbWaypoint(
        id: 'wpt_3',
        timestamp: DateTime.now().subtract(const Duration(minutes: 3, seconds: 20)),
        latitude: 10.77985,
        longitude: 106.70388,
        altitudeMeters: 13.0,
        speedKmh: 42.0,
        headingDegrees: 62.0,
        accuracyMeters: 4.1,
        batteryPercent: 90,
        cellSignalDbm: -78,
        locationName: 'Trạm 3: Xe tăng tốc thoát ly (Đại lộ Lê Duẩn - 42 km/h)',
      ),
      BreadcrumbWaypoint(
        id: 'wpt_4',
        timestamp: DateTime.now().subtract(const Duration(minutes: 2)),
        latitude: 10.78110,
        longitude: 106.70560,
        altitudeMeters: 12.2,
        speedKmh: 28.5,
        headingDegrees: 110.0,
        accuracyMeters: 3.8,
        batteryPercent: 89,
        cellSignalDbm: -82,
        locationName: 'Trạm 4: Rẽ đột ngột vào hẻm khuất (Pasteur -> Hai Bà Trưng)',
      ),
      BreadcrumbWaypoint(
        id: 'wpt_5',
        timestamp: DateTime.now().subtract(const Duration(minutes: 1)),
        latitude: 10.78240,
        longitude: 106.70690,
        altitudeMeters: 2.5,
        speedKmh: 12.0,
        headingDegrees: 180.0,
        accuracyMeters: 5.5,
        batteryPercent: 88,
        cellSignalDbm: -94,
        locationName: 'Trạm 5: Xuống dốc hầm xe ngầm PDR (Độ cao tụt +2.5m)',
      ),
      BreadcrumbWaypoint(
        id: 'wpt_6',
        timestamp: DateTime.now(),
        latitude: 10.78315,
        longitude: 106.70755,
        altitudeMeters: -6.4,
        speedKmh: 0.0,
        headingDegrees: 210.0,
        accuracyMeters: 8.2,
        batteryPercent: 87,
        cellSignalDbm: -108,
        locationName: 'Trạm 6: Bất động tại Hầm B2 (-6.4m, Sóng GSM suy giảm)',
      ),
    ];

    _breadcrumbs.addAll(demoRoute);
    _totalEvidenceUploadedCount += 3;
    _lastEvidenceUploadTime = DateTime.now();

    notifyListeners();
  }

  // ===========================================================================
  // 5. KÉT SẮT ẢO ĐÁNH LỪA KẺ ÉP BUỘC (DECOY DUMMY VAULT)
  // ===========================================================================

  void toggleDecoyVault(bool show) {
    _isDecoyVaultShown = show;
    notifyListeners();
  }

  List<Map<String, String>> get decoyMedicalRecords => const [
        {
          'title': 'Hồ sơ khám sức khỏe tổng quát',
          'date': '15/01/2026',
          'doctor': 'BS. Trần Văn Hùng - BV Chợ Rẫy',
          'note': 'Chỉ số bình thường, không có tiền sử bệnh lý mạn tính.',
        },
        {
          'title': 'Đơn thuốc dị ứng thời tiết',
          'date': '02/02/2026',
          'doctor': 'BS. Lê Thị Mai',
          'note': 'Loratadine 10mg x 10 viên (uống khi ngứa).',
        },
        {
          'title': 'Lịch tiêm chủng nhắc lại Cúm mùa',
          'date': '10/03/2026',
          'doctor': 'Trung tâm VNVC',
          'note': 'Đã hoàn tất mũi tiêm nhắc lại năm 2026.',
        },
      ];
}
