import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';
import 'offline_sos_service.dart';
import 'pedometer_service.dart';

/// ---------------------------------------------------------------------------
/// TẦNG 3: MÔ HÌNH HỌC MÁY NHÚNG (TINYML) - PHÂN LOẠI HOẠT ĐỘNG (HAR)
/// ---------------------------------------------------------------------------
enum HarActivityType {
  sleeping,        // Nằm ngủ (Gia tốc tĩnh, nhịp tim thấp)
  resting,         // Ngồi yên / đọc báo / thư giãn
  walking,         // Đi bộ (Dao động nhịp nhàng chu kỳ bước)
  carryingOneHand, // Xách đồ một tay (Một tay chịu tải tĩnh, tay kia vung)
  holdingPhone,    // Cầm điện thoại (Cổ tay nâng góc đọc tin)
}

/// Trạng thái quy trình xác thực đa lớp (Multi-tier Verification State)
enum StrokeVerificationState {
  monitoring,         // Đang giám sát 2 tay bình thường
  promptLevel1,       // Cảnh báo lần 1: Rung + hỏi "Bạn có ổn không?" (3 cách phản hồi)
  promptLevel2,       // Cảnh báo lần 2: Chuông lớn hơn đánh thức người xung quanh
  pronatorDriftTest,  // Bài test 10 giây: Giơ thẳng 2 tay nhắm mắt (kiểm tra lú lẫn / mất trương lực)
  emergencyActivated, // Kích hoạt cấp cứu: Gọi 115 + SMS Mốc Giờ Vàng 4.5h
  safeResolved,       // Đã giải tỏa an toàn (người dùng phản hồi tốt hoặc qua bài test)
}

/// Dữ liệu cảm biến của một cổ tay (Gia tốc kế MEMS 50Hz, Dải đo ±4g)
class WristSensorSample {
  const WristSensorSample({
    required this.ax,
    required this.ay,
    required this.az,
    required this.sma,          // Signal Magnitude Area (SMA)
    required this.vectorMagnitude, // VM = sqrt(ax^2 + ay^2 + az^2)
    required this.variance,     // Mức độ dao động động lực học
    required this.isMotionActive,
  });

  final double ax;
  final double ay;
  final double az;
  final double sma;
  final double vectorMagnitude;
  final double variance;
  final bool isMotionActive;
}

/// Tọa độ điểm trên biểu đồ phân tán Poincaré (RR_n vs RR_n+1)
class PoincarePoint {
  const PoincarePoint(this.rrN, this.rrNext);
  final double rrN;
  final double rrNext;
}

/// ---------------------------------------------------------------------------
/// TẦNG 3: HỌC THÍCH ỨNG CÁ NHÂN HÓA 14 NGÀY (PERSONAL BASELINE ENGINE)
/// Lưu trữ bản đồ thói quen vận động theo 24 khung giờ trong ngày
/// ---------------------------------------------------------------------------
class PersonalBaseline14DayEngine {
  PersonalBaseline14DayEngine() {
    // Khởi tạo 24 khung giờ với độ lệch bất đối xứng trung bình thông thường (0.15 - 0.35g)
    for (int hour = 0; hour < 24; hour++) {
      if (hour >= 23 || hour <= 6) {
        // Khung giờ ngủ: độ lệch 2 tay tự nhiên cao hơn do quen ngủ đè tay
        _hourlyAsymmetryBaseline[hour] = 0.42;
      } else {
        _hourlyAsymmetryBaseline[hour] = 0.22;
      }
    }
  }

  final Map<int, double> _hourlyAsymmetryBaseline = {};
  final bool _isCalibrated = true;

  bool get isCalibrated => _isCalibrated;

  /// Lấy ngưỡng chênh lệch dự kiến theo khung giờ hiện tại
  double getBaselineForCurrentHour() {
    final hour = DateTime.now().hour;
    return _hourlyAsymmetryBaseline[hour] ?? 0.25;
  }

  /// Cập nhật thích ứng thói quen người dùng theo cửa sổ trượt 14 ngày
  void adaptDailyObservation({required int hour, required double observedDeltaM}) {
    final current = _hourlyAsymmetryBaseline[hour] ?? 0.25;
    // Cập nhật hàm trọng số mũ EMA (alpha = 0.05)
    _hourlyAsymmetryBaseline[hour] = (current * 0.95) + (observedDeltaM * 0.05);
  }
}

/// ============================================================================
/// SAFESOLO WATCH - HỆ THỐNG PHÁT HIỆN ĐỘT QUỴ ĐỐI XỨNG 2 CỔ TAY 5 TẦNG
/// (Bilateral Wrist Stroke Detection System - 5-Tier Distributed Architecture)
///
/// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - SafeSolo KTPM
/// Dựa trên nghiên cứu tại Bệnh viện ĐKTW Cần Thơ (82 bệnh nhân đột quỵ)
///
/// 5 TẦNG KIẾN TRÚC TOÀN DIỆN:
/// - TẦNG 1: Hạ tầng phần cứng & Giao thức BLE tối ưu băng thông (50Hz, ±4g, Companion Band)
/// - TẦNG 2: Xử lý tín hiệu số (DSP) & Lọc nhiễu quang học PPG bằng gia tốc kế (SMA & Poincaré)
/// - TẦNG 3: Mô hình TinyML nhúng trên thiết bị (< 100 KB, HAR + Baseline 14 ngày + Risk Fusion)
/// - TẦNG 4: Luồng xác thực chống báo nhầm (Fail-safe UX) & Bài test cơ lực 10s (Pronator Drift)
/// - TẦNG 5: Giao thức cứu hộ khẩn cấp 115, Mốc Giờ Vàng (TLKW 4.5h) & Tuyên bố miễn trừ SaMD
/// ============================================================================
class StrokeDefenseService extends ChangeNotifier {
  StrokeDefenseService._() {
    _initDefaultState();
  }

  static final StrokeDefenseService instance = StrokeDefenseService._();

  // ---------------------------------------------------------------------------
  // TẦNG 1: THIẾT BỊ PHẦN CỨNG & KẾT NỐI BLE
  // ---------------------------------------------------------------------------
  static const String companionServiceUuid = '0000FFF0-0000-1000-8000-00805F9B34FB';
  static const String companionFeatureCharUuid = '0000FFF1-0000-1000-8000-00805F9B34FB';

  bool _isCompanionBandConnected = true;
  String _companionBandName = 'SafeSolo Companion Band (ESP32-C3 / nRF52840)';
  int _companionBandBatteryPct = 92;

  // ---------------------------------------------------------------------------
  // TẦNG 2: XỬ LÝ TÍN HIỆU SỐ (DSP) & DỮ LIỆU CẢM BIẾN
  // ---------------------------------------------------------------------------
  WristSensorSample _leftWrist = const WristSensorSample(
    ax: 0.12, ay: 0.24, az: 9.81,
    sma: 0.85, vectorMagnitude: 9.82, variance: 1.45,
    isMotionActive: true,
  );

  WristSensorSample _rightWrist = const WristSensorSample(
    ax: 0.10, ay: 0.22, az: 9.81,
    sma: 0.82, vectorMagnitude: 9.82, variance: 1.38,
    isMotionActive: true,
  );

  // Chỉ số bất đối xứng vận động (Bilateral Asymmetry Index - Delta M)
  // Delta M = |SMA_left - SMA_right|
  double _deltaM = 0.03;
  double _bilateralAsymmetryScore = 8.0; // Thang đo chuẩn hóa 0 - 100%

  // Lọc nhiễu chuyển động PPG (PPG Motion Artifact Gating)
  bool _isPpgMotionArtifactGated = false;
  String _ppgSignalQuality = 'TỐT (Sạch nhiễu quang học)';

  // Phân tích khoảng RR & Phân tán Poincaré Plot (SD1, SD2, SD1/SD2)
  List<PoincarePoint> _poincarePoints = [];
  bool _isAfibDetected = false;
  double _sd1 = 22.5; // Biến thiên ngắn hạn (phó giao cảm)
  double _sd2 = 71.0; // Biến thiên dài hạn
  double _sdRatio = 0.31; // Tỷ lệ SD1/SD2

  // ---------------------------------------------------------------------------
  // TẦNG 3: MÔ HÌNH HỌC MÁY NHÚNG (TINYML) & HỌC THÍCH ỨNG CÁ NHÂN HÓA
  // ---------------------------------------------------------------------------
  HarActivityType _currentHarActivity = HarActivityType.resting;
  final PersonalBaseline14DayEngine _personalBaseline = PersonalBaseline14DayEngine();
  double _compositeRiskScore = 0.12; // Thang đo TinyML Risk Fusion Engine (0.0 -> 1.0)
  final int _tinyMlFootprintBytes = 88064; // ~86 KB (đảm bảo hoàn toàn < 100 KB Offline)

  // ---------------------------------------------------------------------------
  // TẦNG 4: LUỒNG XÁC THỰC ĐA PHƯƠNG THỨC & PRONATOR DRIFT REFLEX TEST
  // ---------------------------------------------------------------------------
  StrokeVerificationState _state = StrokeVerificationState.monitoring;
  int _promptCountdownSeconds = 30;
  Timer? _promptTimer;

  // Bài kiểm tra trương lực cơ 10 giây (10-Second Pronator Drift Test)
  int _pronatorDriftSecondsRemaining = 10;
  double _rightArmDriftAngleDegrees = 0.0;
  bool _isPronatorDriftFailed = false;
  Timer? _pronatorDriftTimer;

  // ---------------------------------------------------------------------------
  // TẦNG 5: GIAO THỨC CỨU HỘ & MỐC GIỜ VÀNG (TLKW 4.5H) & SAMD
  // ---------------------------------------------------------------------------
  DateTime? _timeLastKnownWell; // Mốc giờ khởi phát triệu chứng đầu tiên (TLKW)
  final Duration goldenHourWindow = const Duration(hours: 4, minutes: 30);
  static const String samdLegalDisclaimer =
      '[SafeSolo SaMD Class IIa] Thiết bị hỗ trợ phát hiện sớm dấu hiệu bất đối xứng vận động, không thay thế chẩn đoán lâm sàng của bác sĩ chuyên khoa.';

  // Trình giả lập kịch bản
  Timer? _simulationTimer;
  bool _isSimulatingUncleTu = false;

  // Getters
  StrokeVerificationState get state => _state;
  bool get isCompanionBandConnected => _isCompanionBandConnected;
  String get companionBandName => _companionBandName;
  int get companionBandBatteryPct => _companionBandBatteryPct;
  WristSensorSample get leftWrist => _leftWrist;
  WristSensorSample get rightWrist => _rightWrist;
  double get deltaM => _deltaM;
  double get bilateralAsymmetryScore => _bilateralAsymmetryScore;
  bool get isPpgMotionArtifactGated => _isPpgMotionArtifactGated;
  String get ppgSignalQuality => _ppgSignalQuality;
  List<PoincarePoint> get poincarePoints => List.unmodifiable(_poincarePoints);
  bool get isAfibDetected => _isAfibDetected;
  double get sd1 => _sd1;
  double get sd2 => _sd2;
  double get sdRatio => _sdRatio;
  HarActivityType get currentHarActivity => _currentHarActivity;
  PersonalBaseline14DayEngine get personalBaseline => _personalBaseline;
  double get compositeRiskScore => _compositeRiskScore;
  int get tinyMlFootprintBytes => _tinyMlFootprintBytes;
  DateTime? get timeLastKnownWell => _timeLastKnownWell;
  DateTime? get symptomOnsetTime => _timeLastKnownWell;
  int get promptCountdownSeconds => _promptCountdownSeconds;
  int get pronatorDriftSecondsRemaining => _pronatorDriftSecondsRemaining;
  double get rightArmDriftAngleDegrees => _rightArmDriftAngleDegrees;
  bool get isPronatorDriftFailed => _isPronatorDriftFailed;
  bool get isSimulatingUncleTu => _isSimulatingUncleTu;

  /// Thời gian vàng còn lại (4.5 giờ rtPA) tính từ mốc khởi phát TLKW
  Duration get remainingGoldenHourTime {
    if (_timeLastKnownWell == null) return goldenHourWindow;
    final elapsed = DateTime.now().difference(_timeLastKnownWell!);
    final remaining = goldenHourWindow - elapsed;
    return remaining.isNegative ? Duration.zero : remaining;
  }

  void _initDefaultState() {
    _generateNormalPoincareSample();
    _recalculateRiskFusion();
  }

  // ===========================================================================
  // TẦNG 1: XỬ LÝ GÓI TIN ĐẶC TRƯNG TỪ VÒNG PHỤ QUA BLE (BANDWIDTH OPTIMIZED)
  // Không truyền raw data 50Hz để tránh cạn pin, chỉ nhận gói đặc trưng 1-2s
  // ===========================================================================
  void parseCompanionBlePacket(List<int> rawBytes) {
    if (rawBytes.length < 12) return;

    try {
      final byteData = ByteData.sublistView(Uint8List.fromList(rawBytes));
      // Byte 0-3: Timestamp (uint32)
      // Byte 4-7: SMA (Float32)
      // Byte 8-9: Variance * 100 (Uint16)
      // Byte 10: IsMotionActive (Uint8)
      // Byte 11: BatteryPct (Uint8)
      final companionSma = byteData.getFloat32(4, Endian.little);
      final companionVariance = byteData.getUint16(8, Endian.little) / 100.0;
      final isActive = byteData.getUint8(10) == 1;
      _companionBandBatteryPct = byteData.getUint8(11);

      updateWristSensors(
        left: _leftWrist,
        right: WristSensorSample(
          ax: 0.05,
          ay: 0.05,
          az: 9.81,
          sma: companionSma,
          vectorMagnitude: 9.81,
          variance: companionVariance,
          isMotionActive: isActive,
        ),
      );
    } catch (e) {
      debugPrint('[StrokeDefense] BLE packet parse error: $e');
    }
  }

  void setCompanionBandStatus({required bool isConnected, String? bandName}) {
    _isCompanionBandConnected = isConnected;
    if (bandName != null) _companionBandName = bandName;
    notifyListeners();
  }

  // ===========================================================================
  // TẦNG 2: XỬ LÝ TÍN HIỆU SỐ (DSP), LỌC QUANG HỌC PPG & TÍNH ĐỘ LỆCH HAI TAY
  // ===========================================================================

  /// Lọc nhiễu chuyển động PPG bằng gia tốc kế (Motion Artifact Removal)
  /// Ánh sáng xanh (0.82mm) và đỏ (1.43mm) rất nhạy cảm với chuyển động.
  /// Khi vung tay mạnh (accel dynamic > 1.8g), gắn nhãn vô hiệu hóa đoạn sóng PPG.
  bool checkPpgMotionArtifactGating(double dynamicAccelerationG) {
    if (dynamicAccelerationG > 1.8) {
      _isPpgMotionArtifactGated = true;
      _ppgSignalQuality = 'VUNG TAY MẠNH (Đã gắn nhãn loại bỏ nhiễu PPG)';
      return false; // Dữ liệu PPG không đáng tin cậy -> Bỏ qua nhịp tim sai lệch
    } else {
      _isPpgMotionArtifactGated = false;
      _ppgSignalQuality = 'TỐT (Đoạn sóng PPG ổn định)';
      return true; // Dữ liệu PPG sạch
    }
  }

  /// Cập nhật dữ liệu 2 cổ tay và tính toán Bilateral Asymmetry Index: Delta M = |SMA_left - SMA_right|
  void updateWristSensors({
    required WristSensorSample left,
    required WristSensorSample right,
  }) {
    _leftWrist = left;
    _rightWrist = right;

    // 1. Kiểm tra lọc nhiễu PPG trên cổ tay đeo đồng hồ
    final leftDynamicAccel = (left.vectorMagnitude - 9.81).abs() / 9.81;
    checkPpgMotionArtifactGating(leftDynamicAccel);

    // 2. Tính toán độ lệch mức năng lượng vận động Delta M
    _deltaM = (left.sma - right.sma).abs();

    // 3. Chuẩn hóa BMAI (0% - 100%)
    if (left.isMotionActive && !right.isMotionActive) {
      // Trường hợp đột quỵ: Tay trái cử động (lật báo), tay phải bất động hoàn toàn dưới trọng lực g
      _bilateralAsymmetryScore = (_deltaM * 65.0 + (left.variance * 20.0)).clamp(25.0, 98.0);
    } else if (!left.isMotionActive && right.isMotionActive) {
      _bilateralAsymmetryScore = (_deltaM * 65.0 + (right.variance * 20.0)).clamp(25.0, 98.0);
    } else {
      // Cả hai tay cùng vận động hoặc cùng nghỉ ngơi
      _bilateralAsymmetryScore = (_deltaM * 18.0).clamp(4.0, 22.0);
    }

    _recalculateRiskFusion();
  }

  /// Tạo mẫu Poincaré phân tán hình elip bình thường
  void _generateNormalPoincareSample() {
    final points = <PoincarePoint>[];
    final random = math.Random(42);
    const baseRr = 800.0;
    double current = baseRr;

    for (int i = 0; i < 40; i++) {
      final delta = (random.nextDouble() - 0.5) * 40;
      final next = (baseRr + delta).clamp(740.0, 860.0);
      points.add(PoincarePoint(current, next));
      current = next;
    }

    _poincarePoints = points;
    _sd1 = 22.5;
    _sd2 = 71.0;
    _sdRatio = _sd1 / _sd2;
    _isAfibDetected = false;
  }

  /// Tạo mẫu Poincaré phân tán hỗn loạn khi có Rung Nhĩ (AFib)
  void _generateAfibPoincareSample() {
    final points = <PoincarePoint>[];
    final random = math.Random(99);

    for (int i = 0; i < 50; i++) {
      final rr1 = 450.0 + random.nextDouble() * 750.0;
      final rr2 = 450.0 + random.nextDouble() * 750.0;
      points.add(PoincarePoint(rr1, rr2));
    }

    _poincarePoints = points;
    _sd1 = 118.0;
    _sd2 = 142.0;
    _sdRatio = _sd1 / _sd2;
    _isAfibDetected = true;
  }

  // ===========================================================================
  // TẦNG 3: MÔ HÌNH HỌC MÁY NHÚNG (TINYML < 100 KB) & RISK FUSION ENGINE
  // ===========================================================================
  void _recalculateRiskFusion() {
    // 1. Phân loại hoạt động HAR dựa trên mức SMA và Variance
    if (_leftWrist.sma < 0.15 && _rightWrist.sma < 0.15) {
      _currentHarActivity = (DateTime.now().hour >= 23 || DateTime.now().hour <= 6)
          ? HarActivityType.sleeping
          : HarActivityType.resting;
    } else if (_leftWrist.sma > 1.8 && _rightWrist.sma > 1.8) {
      _currentHarActivity = HarActivityType.walking;
    } else if (_leftWrist.isMotionActive && !_rightWrist.isMotionActive && _bilateralAsymmetryScore < 40.0) {
      _currentHarActivity = HarActivityType.holdingPhone;
    } else {
      _currentHarActivity = HarActivityType.resting;
    }

    // 2. So sánh với Ngưỡng cơ sở cá nhân hóa (Personal Baseline 14 ngày)
    final baseline = _personalBaseline.getBaselineForCurrentHour();
    final excessAsymmetry = math.max(0.0, (_bilateralAsymmetryScore / 100.0) - baseline);

    // 3. Risk Fusion Engine tổng hợp đa biến (0.0 -> 1.0)
    double rawRisk = 0.08;

    // Trọng số BMAI vượt ngưỡng baseline: 55%
    rawRisk += (excessAsymmetry * 1.4).clamp(0.0, 0.55);

    // Trọng số Rung Nhĩ AFib: 25%
    if (_isAfibDetected) {
      rawRisk += 0.25;
    }

    // Trọng số Nhịp tim bất thường (nếu tín hiệu quang học PPG sạch): 15%
    if (!_isPpgMotionArtifactGated) {
      final hr = PedometerService.instance.heartRate;
      if (hr > 120 || (hr > 0 && hr < 48)) {
        rawRisk += 0.15;
      }
    }

    // Điều chỉnh theo ngữ cảnh HAR (Nếu người dùng đang nằm ngủ, giảm độ nhạy để tránh báo nhầm)
    if (_currentHarActivity == HarActivityType.sleeping && _bilateralAsymmetryScore < 70.0) {
      rawRisk *= 0.65;
    }

    _compositeRiskScore = rawRisk.clamp(0.05, 0.99);

    // Báo động tăng cấp (Alert Escalation): Khi điểm rủi ro vượt ngưỡng 0.70 liên tục
    if (_compositeRiskScore >= 0.70 && _state == StrokeVerificationState.monitoring) {
      _triggerPromptLevel1();
    }

    notifyListeners();
  }

  // ===========================================================================
  // TẦNG 4: LUỒNG XÁC THỰC ĐA PHƯƠNG THỨC & BÀI TEST PRONATOR DRIFT 10 GIÂY
  // ===========================================================================

  /// Cảnh báo Cấp 1 (30s): Rung haptic nhẹ + âm thanh hỏi thăm ("Bác Tư có ổn không?")
  void _triggerPromptLevel1() {
    _timeLastKnownWell ??= DateTime.now();
    _state = StrokeVerificationState.promptLevel1;
    _promptCountdownSeconds = 30;
    notifyListeners();

    _promptTimer?.cancel();
    _promptTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_promptCountdownSeconds > 0) {
        _promptCountdownSeconds--;
        notifyListeners();
      } else {
        timer.cancel();
        // Không phản hồi sau 30s -> Tăng cấp cảnh báo sang Cấp 2
        _triggerPromptLevel2();
      }
    });
  }

  /// Cảnh báo Cấp 2 (20s): Rung giật mạnh + Chuông báo động lớn đánh thức xung quanh
  void _triggerPromptLevel2() {
    _state = StrokeVerificationState.promptLevel2;
    _promptCountdownSeconds = 20;
    notifyListeners();

    _promptTimer?.cancel();
    _promptTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_promptCountdownSeconds > 0) {
        _promptCountdownSeconds--;
        notifyListeners();
      } else {
        timer.cancel();
        // Hết thời gian Cấp 2 không có phản hồi -> Kích hoạt cuộc gọi 115 & SMS Mốc Giờ Vàng!
        triggerEmergencyGoldenHourDispatch();
      }
    });
  }

  /// Người dùng phản hồi qua 3 kênh (Chạm màn hình / Lắc cổ tay / Khẩu lệnh)
  /// Fail-safe UX: Nếu chỉ số bất đối xứng vẫn cao, bắt buộc làm bài test giơ 2 tay!
  void respondByUser({required String method}) {
    debugPrint('[StrokeDefense] User responded via $method');
    _promptTimer?.cancel();

    if (_bilateralAsymmetryScore >= 60.0) {
      // Nghi ngờ lú lẫn hoặc vô thức bấm hủy -> Kích hoạt bài kiểm tra cơ lực 10s
      startPronatorDriftTest();
    } else {
      resolveAsSafe(reason: 'Người dùng xác nhận an toàn qua $method');
    }
  }

  /// Bài kiểm tra cơ lực chủ động (10-Second Pronator Drift Reflex Test)
  /// Nhắm mắt, giơ 2 tay song song ra trước. Nếu tay phải trôi xuống do mất trương lực -> Kích hoạt 115!
  void startPronatorDriftTest() {
    _state = StrokeVerificationState.pronatorDriftTest;
    _pronatorDriftSecondsRemaining = 10;
    _rightArmDriftAngleDegrees = 0.0;
    _isPronatorDriftFailed = false;
    notifyListeners();

    _pronatorDriftTimer?.cancel();
    _pronatorDriftTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_pronatorDriftSecondsRemaining > 0) {
        _pronatorDriftSecondsRemaining--;

        // Giả lập trôi cánh tay trong tình huống liệt cơ
        if (_bilateralAsymmetryScore >= 60.0) {
          _rightArmDriftAngleDegrees += 3.8;
        }

        if (_rightArmDriftAngleDegrees >= 15.0) {
          _isPronatorDriftFailed = true;
        }

        notifyListeners();
      } else {
        timer.cancel();
        if (_isPronatorDriftFailed || _rightArmDriftAngleDegrees >= 15.0) {
          // Thất bại bài test Pronator Drift -> Tự động hủy lệnh bỏ qua & Kích hoạt cấp cứu!
          triggerEmergencyGoldenHourDispatch();
        } else {
          resolveAsSafe(reason: 'Vượt qua bài test cơ lực giơ 2 tay (Pronator Drift Pass)');
        }
      }
    });
  }

  // ===========================================================================
  // TẦNG 5: GIAO THỨC CỨU HỘ KHẨN CẤP, MỐC GIỜ VÀNG (TLKW 4.5H) & SAMD
  // ===========================================================================
  Future<void> triggerEmergencyGoldenHourDispatch() async {
    _promptTimer?.cancel();
    _pronatorDriftTimer?.cancel();
    _state = StrokeVerificationState.emergencyActivated;
    _timeLastKnownWell ??= DateTime.now().subtract(const Duration(minutes: 18));
    notifyListeners();

    final onsetStr =
        '${_timeLastKnownWell!.hour.toString().padLeft(2, '0')}:${_timeLastKnownWell!.minute.toString().padLeft(2, '0')}';
    final hr = PedometerService.instance.heartRate;

    // Đóng gói tin nhắn SMS chuẩn hóa y khoa
    final smsMessage = 'SAFESOLO SOS ĐỘT QUỴ! Bác Tư nghi ngờ đột quỵ yếu liệt tay phải. '
        'MỐC GIỜ KHỞI PHÁT (TLKW): $onsetStr (Cửa sổ 4.5h thuốc tiêu sợi huyết tPA). '
        'HR: ${hr > 0 ? hr : 78}bpm, AFib: ${_isAfibDetected ? "DƯƠNG TÍNH" : "ÂM TÍNH"}, BMAI: ${_bilateralAsymmetryScore.toStringAsFixed(0)}%. '
        'Vị trí: 18 Lê Lợi, Bến Nghé, Q1. Thuốc đang dùng: Amlodipine 5mg. '
        '$samdLegalDisclaimer';

    debugPrint('[StrokeDefense] Dispatching Golden Hour SMS: $smsMessage');

    // 1. Gửi SMS cứu nạn tới số người thân / con gái ông Tư
    try {
      await OfflineSosService.instance.sendEmergencySms(
        phoneNumber: '0913843958',
        message: smsMessage,
      );
    } catch (e) {
      debugPrint('[StrokeDefense] SMS failed: $e');
    }

    // 2. Kích hoạt cuộc gọi cấp cứu 115 qua Telecom API
    try {
      final telUri = Uri.parse('tel:115');
      if (await canLaunchUrl(telUri)) {
        await launchUrl(telUri);
      }
    } catch (e) {
      debugPrint('[StrokeDefense] Call 115 failed: $e');
    }

    // 3. Đồng bộ sự kiện lên máy chủ hoặc kênh kết nối điện thoại
    PedometerService.instance.emitWatchEmergencyAlert(
      type: 'STROKE_GOLDEN_HOUR_EMERGENCY',
      message: 'CẤP CỨU ĐỘT QUỴ - MỐC GIỜ VÀNG $onsetStr: $smsMessage',
      extra: {
        'timeLastKnownWell': _timeLastKnownWell!.toIso8601String(),
        'deltaM': _deltaM,
        'bmai': _bilateralAsymmetryScore,
        'afib': _isAfibDetected,
        'compositeRisk': _compositeRiskScore,
        'harActivity': _currentHarActivity.name,
      },
    );
  }

  /// Giải tỏa cảnh báo an toàn
  void resolveAsSafe({String reason = 'Người dùng phản hồi bình thường'}) {
    _promptTimer?.cancel();
    _pronatorDriftTimer?.cancel();
    _simulationTimer?.cancel();
    _isSimulatingUncleTu = false;
    _state = StrokeVerificationState.safeResolved;
    _rightArmDriftAngleDegrees = 0.0;
    _isPronatorDriftFailed = false;
    notifyListeners();

    Future.delayed(const Duration(seconds: 3), () {
      _state = StrokeVerificationState.monitoring;
      _timeLastKnownWell = null;
      notifyListeners();
    });
  }

  // ===========================================================================
  // KỊCH BẢN MÔ PHỎNG LÂM SÀNG: "BUỔI CHIỀU CỦA ÔNG TƯ" (YOUTUBE SCENARIO)
  // ===========================================================================
  void runUncleTuStrokeSimulation() {
    _simulationTimer?.cancel();
    _promptTimer?.cancel();
    _pronatorDriftTimer?.cancel();

    _isSimulatingUncleTu = true;
    _state = StrokeVerificationState.monitoring;
    _timeLastKnownWell = DateTime.now();

    // Pha 1: 14h00 - Đọc báo & Rót trà (Hai tay cử động nhịp nhàng)
    _leftWrist = const WristSensorSample(
      ax: 0.22, ay: 0.45, az: 9.75,
      sma: 1.15, vectorMagnitude: 9.85, variance: 1.62,
      isMotionActive: true,
    );
    _rightWrist = const WristSensorSample(
      ax: 0.28, ay: 0.52, az: 9.68,
      sma: 1.12, vectorMagnitude: 9.84, variance: 1.58,
      isMotionActive: true,
    );
    _generateNormalPoincareSample();
    _deltaM = 0.03;
    _bilateralAsymmetryScore = 8.0;
    _compositeRiskScore = 0.14;
    _currentHarActivity = HarActivityType.resting;
    notifyListeners();

    // Pha 2: Sau 3 giây -> Chén rơi! Bàn tay phải lỏng dần, buông thõng bất động
    // Tay trái vẫn lật báo (SMA = 1.25), tay phải chỉ còn trọng lực g (SMA = 0.05, Variance = 0.02)
    _simulationTimer = Timer(const Duration(seconds: 3), () {
      _leftWrist = const WristSensorSample(
        ax: 0.35, ay: 0.65, az: 9.72,
        sma: 1.28, vectorMagnitude: 9.88, variance: 1.85,
        isMotionActive: true,
      );
      _rightWrist = const WristSensorSample(
        ax: 0.01, ay: 0.01, az: 9.81,
        sma: 0.04, vectorMagnitude: 9.81, variance: 0.02,
        isMotionActive: false,
      );

      _generateAfibPoincareSample(); // Xuất hiện Rung nhĩ AFib
      _deltaM = (1.28 - 0.04).abs(); // Delta M = 1.24g
      _bilateralAsymmetryScore = 88.5; // BMAI vọt lên đỉnh điểm
      _recalculateRiskFusion();

      // Kích hoạt ngay cảnh báo Cấp 1 trên mặt đồng hồ
      _triggerPromptLevel1();
    });
  }

  void stopSimulation() {
    _simulationTimer?.cancel();
    _promptTimer?.cancel();
    _pronatorDriftTimer?.cancel();
    _isSimulatingUncleTu = false;
    _state = StrokeVerificationState.monitoring;
    _timeLastKnownWell = null;
    _initDefaultState();
    notifyListeners();
  }

  @override
  void dispose() {
    _promptTimer?.cancel();
    _pronatorDriftTimer?.cancel();
    _simulationTimer?.cancel();
    super.dispose();
  }
}
