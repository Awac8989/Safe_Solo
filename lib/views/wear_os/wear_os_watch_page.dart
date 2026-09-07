import 'dart:async';
import 'dart:io';
import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/app_strings.dart';
import '../../core/providers/app_provider.dart';
import '../../services/wear_os_service.dart';

/// ============================================================================
/// SAFESOLO - MẶT ĐỒNG HỒ THÔNG MINH SAMSUNG GALAXY WATCH 5 (WEAR OS 4.0)
/// Giao diện tròn AMOLED Black chuyên biệt cho Smartwatch và Bộ điều khiển Edge
/// Đề tài: Cảnh báo khẩn cấp tự động và Điều phối cứu hộ thời gian thực
/// Tác giả: SV Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03
/// ============================================================================
class WearOsWatchPage extends StatefulWidget {
  const WearOsWatchPage({super.key});

  @override
  State<WearOsWatchPage> createState() => _WearOsWatchPageState();
}

class _WearOsWatchPageState extends State<WearOsWatchPage>
    with SingleTickerProviderStateMixin {
  final PageController _pageController = PageController(initialPage: 0);
  int _currentPage = 0;
  late Timer _clockTimer;
  DateTime _now = DateTime.now();
  late AnimationController _pulseController;
  double _dragDelta = 0;
  final GlobalKey _watchBoundaryKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    WearOsService.instance.initialize();

    _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() {
          _now = DateTime.now();
        });
      }
    });

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);

    // Tự động chụp tuần tự các màn hình để kiểm tra pixel trực tiếp từ Flutter GPU canvas (chỉ khi chạy app thật)
    if (!Platform.environment.containsKey('FLUTTER_TEST') &&
        !WidgetsBinding.instance.runtimeType.toString().contains('Test')) {
      _startAutoCaptureSequence();
    }
  }

  bool _forceShowEmergencyOverlay = false;
  Timer? _autoCaptureTimer;

  void _startAutoCaptureSequence() {
    _autoCaptureTimer = Timer(const Duration(seconds: 5), () async {
      if (!mounted) return;
      debugPrint('AUTO_CAPTURE: Starting 6-screen capture sequence...');

      for (int i = 0; i < 6; i++) {
        if (!mounted) return;
        setState(() => _currentPage = i);
        await Future.delayed(const Duration(milliseconds: 1600));
        final filename = (i == 5)
            ? 'safesolo_watch_p6_emergency.png'
            : 'safesolo_watch_p${i + 1}.png';
        await _captureScreenToDisk(filename);
      }

      if (!mounted) return;
      setState(() => _currentPage = 0);
      debugPrint('AUTO_CAPTURE: All 6 screens captured successfully!');
    });
  }

  Future<void> _captureScreenToDisk(String filename) async {
    try {
      if (!mounted) return;
      final wasAnimating = _pulseController.isAnimating;
      if (wasAnimating) {
        _pulseController.stop();
      }
      await WidgetsBinding.instance.endOfFrame;
      await Future.delayed(const Duration(milliseconds: 300));
      await WidgetsBinding.instance.endOfFrame;

      final boundary = _watchBoundaryKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary == null) {
        debugPrint('CAPTURE_ERROR: boundary is null for $filename');
        if (wasAnimating) _pulseController.repeat(reverse: true);
        return;
      }
      final pr = (boundary.size.width <= 240) ? 2.0 : 1.0;
      final image = await boundary.toImage(pixelRatio: pr);
      final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      if (byteData != null) {
        final dir = Directory('/data/data/com.example.safesolo/cache');
        if (!dir.existsSync()) {
          dir.createSync(recursive: true);
        }
        final file = File('${dir.path}/$filename');
        await file.writeAsBytes(byteData.buffer.asUint8List(), flush: true);
        debugPrint('CAPTURED_WATCH_SCREEN: ${file.path} (${file.lengthSync()} bytes)');
      }
      if (wasAnimating && mounted) {
        _pulseController.repeat(reverse: true);
      }
    } catch (e) {
      debugPrint('CAPTURE_ERROR: $e');
    }
  }

  @override
  void dispose() {
    _autoCaptureTimer?.cancel();
    _clockTimer.cancel();
    _pulseController.dispose();
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final wearOs = WearOsService.instance;
    final provider = context.watch<AppProvider>();
    final user = provider.user;
    final strings = AppStrings(provider.language);
    final screenSize = MediaQuery.of(context).size;

    // Tự động căn chỉnh kích thước nếu chạy trên đồng hồ Wear OS thật hoặc màn hình điện thoại
    final isNativeWatch = screenSize.width <= 480 && screenSize.height <= 480;
    final watchDiameter = isNativeWatch
        ? math.min(screenSize.width, screenSize.height)
        : 380.0;
    debugPrint('WEAR_OS_WATCH_PAGE build: screenSize=$screenSize, isNativeWatch=$isNativeWatch, watchDiameter=$watchDiameter');

    if (isNativeWatch) {
      return Material(
        color: Colors.black,
        child: AnimatedBuilder(
          animation: wearOs,
          builder: (context, _) => _buildWatchDisplay(
            wearOs,
            user,
            strings,
            provider,
            watchDiameter,
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
              elevation: 0,
              centerTitle: true,
              leading: IconButton(
                icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
                onPressed: () => Navigator.of(context).pop(),
              ),
              title: Column(
                children: [
                  const Text(
                    'SAMSUNG GALAXY WATCH 5',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.2,
                    ),
                  ),
                  Text(
                    'WearOS 4.0 · One UI Watch · BioActive Sensor',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.6),
                      fontSize: 10,
                    ),
                  ),
                ],
              ),
              actions: [
                IconButton(
                  tooltip: 'Chuyển sang giả lập đầy đủ',
                  icon: const Icon(Icons.tune_rounded, color: Color(0xFF38BDF8), size: 20),
                  onPressed: () => Navigator.of(context).pushReplacementNamed('/watch-simulator'),
                ),
              ],
            ),
      body: SafeArea(
        child: Center(
          child: AnimatedBuilder(
            animation: wearOs,
            builder: (context, _) {
              return Stack(
                alignment: Alignment.center,
                children: [
                  // Khung kim loại viền đồng hồ Galaxy Watch 5 (nếu xem trên điện thoại)
                  Container(
                    width: watchDiameter + 36,
                    height: watchDiameter + 36,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFF1E293B),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.6),
                          blurRadius: 28,
                          spreadRadius: 6,
                        ),
                        BoxShadow(
                          color: const Color(0xFF0284C7).withValues(alpha: 0.15),
                          blurRadius: 36,
                          spreadRadius: 2,
                        ),
                      ],
                      border: Border.all(
                        color: const Color(0xFF334155),
                        width: 4,
                      ),
                    ),
                  ),

                  // Màn hình cảm ứng tròn AMOLED Black (Circular Display)
                  ClipOval(
                    child: _buildWatchDisplay(wearOs, user, strings, provider, watchDiameter),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  /// Khung hiển thị màn hình đồng hồ tròn với hệ thống điều hướng vuốt cử chỉ 5 trang
  Widget _buildWatchDisplay(
    WearOsService wearOs,
    User? user,
    AppStrings strings,
    AppProvider provider,
    double watchDiameter,
  ) {
    final screens = [
      _buildWatchFaceScreen(wearOs, user, strings, watchDiameter),
      _buildBioActiveSensorScreen(wearOs, strings, watchDiameter),
      _buildFallMotionScreen(wearOs, strings, watchDiameter),
      _buildMedicalIdScreen(provider, strings, watchDiameter),
      _buildDeviceSettingsScreen(wearOs, user, strings, watchDiameter),
      _buildEmergencyCountdownOverlay(wearOs, user, watchDiameter),
    ];

    final activeIndex = wearOs.isCountdownActive
        ? 5
        : _currentPage.clamp(0, screens.length - 1);

    return Container(
      width: watchDiameter,
      height: watchDiameter,
      color: Colors.black,
      child: RepaintBoundary(
        key: _watchBoundaryKey,
        child: Container(
          width: watchDiameter,
          height: watchDiameter,
          color: Colors.black,
          child: Stack(
            fit: StackFit.expand,
            children: [
              // Các trang chức năng điều hướng bằng vuốt ngang
              Positioned.fill(
                child: GestureDetector(
                  key: const Key('watch_gesture_detector'),
                  behavior: HitTestBehavior.opaque,
                  onHorizontalDragStart: (_) => _dragDelta = 0,
                  onHorizontalDragUpdate: (details) => _dragDelta += details.delta.dx,
                  onHorizontalDragEnd: (details) {
                    final vx = details.primaryVelocity ?? 0;
                    if ((vx < -60 || _dragDelta < -40) && _currentPage < 4) {
                      HapticFeedback.selectionClick();
                      setState(() => _currentPage++);
                    } else if ((vx > 60 || _dragDelta > 40) && _currentPage > 0) {
                      HapticFeedback.selectionClick();
                      setState(() => _currentPage--);
                    }
                    _dragDelta = 0;
                  },
                  child: screens[activeIndex],
                ),
              ),

              // Chấm chỉ báo trang (Page Indicator Dots) ở cạnh dưới (chỉ hiện trên 5 trang chính)
              if (!wearOs.isCountdownActive && activeIndex < 5)
                Positioned(
                  bottom: (watchDiameter <= 240) ? 6 : 12,
                  left: 0,
                  right: 0,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(5, (index) {
                      final isSelected = activeIndex == index;
                      return GestureDetector(
                        onTap: () {
                          HapticFeedback.selectionClick();
                          setState(() => _currentPage = index);
                        },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 250),
                          margin: const EdgeInsets.symmetric(horizontal: 2.5),
                          width: isSelected
                              ? ((watchDiameter <= 240) ? 8 : 12)
                              : ((watchDiameter <= 240) ? 4 : 5),
                          height: (watchDiameter <= 240) ? 3 : 4,
                          decoration: BoxDecoration(
                            color: isSelected
                                ? const Color(0xFF38BDF8)
                                : Colors.white.withValues(alpha: 0.25),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      );
                    }),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  // ===========================================================================
  // MÀN HÌNH 1: MẶT ĐỒNG HỒ CHÍNH (WATCH FACE HOME)
  // ===========================================================================
  Widget _buildWatchFaceScreen(
    WearOsService wearOs,
    User? user,
    AppStrings strings,
    double d,
  ) {
    final isSmall = d <= 240;
    final hourStr = _now.hour.toString().padLeft(2, '0');
    final minStr = _now.minute.toString().padLeft(2, '0');
    final secStr = _now.second.toString().padLeft(2, '0');
    final stepProgress = (wearOs.steps / 6000.0).clamp(0.0, 1.0);

    return Container(
      padding: EdgeInsets.symmetric(horizontal: isSmall ? 16 : 24, vertical: isSmall ? 10 : 20),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Trạng thái pin & Tháo tay ở góc trên
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                wearOs.isOffWrist ? Icons.watch_off_rounded : Icons.battery_charging_full_rounded,
                color: wearOs.isOffWrist ? const Color(0xFFF59E0B) : const Color(0xFF10B981),
                size: isSmall ? 10 : 14,
              ),
              const SizedBox(width: 3),
              Text(
                wearOs.isOffWrist ? 'OFF-WRIST' : '${wearOs.battery}%',
                style: TextStyle(
                  color: wearOs.isOffWrist ? const Color(0xFFF59E0B) : Colors.white70,
                  fontSize: isSmall ? 8 : 10,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(width: 6),
              Container(
                width: isSmall ? 3 : 5,
                height: isSmall ? 3 : 5,
                decoration: const BoxDecoration(color: Color(0xFF0284C7), shape: BoxShape.circle),
              ),
              const SizedBox(width: 6),
              Text(
                'SAFE-SOLO',
                style: TextStyle(
                  color: const Color(0xFF38BDF8),
                  fontSize: isSmall ? 8 : 10,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.0,
                ),
              ),
            ],
          ),

          SizedBox(height: isSmall ? 4 : 8),

          // Đồng hồ số lớn phong cách thể thao AMOLED
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '$hourStr:$minStr',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: isSmall ? 26 : 44,
                  fontWeight: FontWeight.w800,
                  letterSpacing: isSmall ? -1.5 : -1.0,
                  height: 1.0,
                ),
              ),
              const SizedBox(width: 3),
              Text(
                secStr,
                style: TextStyle(
                  color: const Color(0xFF38BDF8),
                  fontSize: isSmall ? 11 : 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),

          SizedBox(height: isSmall ? 6 : 10),

          // Hai đồng hồ đo sinh tồn: Nhịp tim & SpO2
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              Row(
                children: [
                  ScaleTransition(
                    scale: Tween(begin: 0.9, end: 1.15).animate(_pulseController),
                    child: Icon(Icons.favorite_rounded, color: const Color(0xFFF43F5E), size: isSmall ? 13 : 18),
                  ),
                  const SizedBox(width: 4),
                  Text('${wearOs.heartRate}', style: TextStyle(color: Colors.white, fontSize: isSmall ? 12 : 16, fontWeight: FontWeight.bold)),
                  const SizedBox(width: 2),
                  Text('bpm', style: TextStyle(color: Colors.white60, fontSize: isSmall ? 8 : 10)),
                ],
              ),
              Row(
                children: [
                  Icon(Icons.water_drop_rounded, color: wearOs.spO2 < 90 ? const Color(0xFFEF4444) : const Color(0xFF06B6D4), size: isSmall ? 13 : 18),
                  const SizedBox(width: 3),
                  Text('${wearOs.spO2}%', style: TextStyle(color: wearOs.spO2 < 90 ? const Color(0xFFEF4444) : Colors.white, fontSize: isSmall ? 12 : 16, fontWeight: FontWeight.bold)),
                  const SizedBox(width: 2),
                  Text('SpO2', style: TextStyle(color: Colors.white60, fontSize: isSmall ? 8 : 10)),
                ],
              ),
            ],
          ),

          SizedBox(height: isSmall ? 6 : 8),

          // Thanh tiến trình bước chân & Calo
          Padding(
            padding: EdgeInsets.symmetric(horizontal: isSmall ? 4 : 14),
            child: Column(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(3),
                  child: LinearProgressIndicator(
                    value: stepProgress,
                    minHeight: isSmall ? 3 : 5,
                    backgroundColor: const Color(0xFF1E293B),
                    valueColor: const AlwaysStoppedAnimation(Color(0xFF10B981)),
                  ),
                ),
                const SizedBox(height: 3),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(isSmall ? '👟 ${wearOs.steps}' : '👟 ${wearOs.steps} b', style: TextStyle(color: Colors.white70, fontSize: isSmall ? 7.5 : 11)),
                    Text(isSmall ? '🔥 ${wearOs.calories}' : '🔥 ${wearOs.calories} kcal', style: TextStyle(color: Colors.white70, fontSize: isSmall ? 7.5 : 11)),
                  ],
                ),
              ],
            ),
          ),

          SizedBox(height: isSmall ? 8 : 12),

          // Hai phím tắt khẩn cấp: ĐIỂM DANH và SOS
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF059669),
                  foregroundColor: Colors.white,
                  padding: EdgeInsets.symmetric(horizontal: isSmall ? 5 : 12, vertical: isSmall ? 3 : 8),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  visualDensity: VisualDensity.compact,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                icon: Icon(Icons.check_circle_rounded, size: isSmall ? 9 : 14),
                label: Text('ĐIỂM DANH', style: TextStyle(fontSize: isSmall ? 7.5 : 11, fontWeight: FontWeight.bold)),
                onPressed: () async {
                  if (user != null) {
                    final ok = await wearOs.performDeadmanCheckin(userId: user.id);
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          backgroundColor: ok ? const Color(0xFF059669) : Colors.red,
                          content: Text(ok ? 'Đã điểm danh an toàn!' : 'Lỗi kết nối điểm danh.'),
                          duration: const Duration(seconds: 2),
                        ),
                      );
                    }
                  } else {
                    wearOs.measureVitalsNow();
                  }
                },
              ),
              SizedBox(width: isSmall ? 4 : 6),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFDC2626),
                  foregroundColor: Colors.white,
                  padding: EdgeInsets.symmetric(horizontal: isSmall ? 6 : 14, vertical: isSmall ? 3 : 8),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  visualDensity: VisualDensity.compact,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.warning_amber_rounded, size: isSmall ? 9 : 14),
                    const SizedBox(width: 2),
                    Text('SOS', style: TextStyle(fontSize: isSmall ? 7.5 : 11, fontWeight: FontWeight.w900)),
                  ],
                ),
                onPressed: () => wearOs.triggerHardwareSos(userId: user?.id),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // MÀN HÌNH 2: CẢM BIẾN BIOACTIVE SENSOR (PPG & SpO2)
  // ===========================================================================
  Widget _buildBioActiveSensorScreen(
    WearOsService wearOs,
    AppStrings strings,
    double d,
  ) {
    final isSmall = d <= 240;

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: isSmall ? 14 : 24,
        vertical: isSmall ? 8 : 20,
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.sensors_rounded, color: const Color(0xFF38BDF8), size: isSmall ? 10 : 14),
              const SizedBox(width: 4),
              Text(
                'CẢM BIẾN BIOACTIVE PPG',
                style: TextStyle(
                  color: const Color(0xFF38BDF8),
                  fontSize: isSmall ? 7.0 : 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: isSmall ? -0.2 : 0.8,
                ),
              ),
            ],
          ),
          SizedBox(height: isSmall ? 4 : 10),

          // Khung vẽ sóng xung mạch PPG thời gian thực
          Container(
            height: isSmall ? 36 : 60,
            width: double.infinity,
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A),
              borderRadius: BorderRadius.circular(isSmall ? 8 : 12),
              border: Border.all(color: const Color(0xFF1E293B)),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(isSmall ? 8 : 12),
              child: CustomPaint(
                size: Size(double.infinity, isSmall ? 36 : 60),
                painter: _PpgWavePainter(
                  pulseAnimation: _pulseController.value,
                  heartRate: wearOs.heartRate,
                ),
              ),
            ),
          ),

          SizedBox(height: isSmall ? 5 : 12),

          // Chỉ số chi tiết
          Row(
            children: [
              Expanded(
                child: Column(
                  children: [
                    Text(
                      'NHỊP TIM',
                      style: TextStyle(color: Colors.white54, fontSize: isSmall ? 7.5 : 10),
                    ),
                    Text(
                      '${wearOs.heartRate} BPM',
                      style: TextStyle(
                        color: const Color(0xFFF43F5E),
                        fontSize: isSmall ? 11 : 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      isSmall ? 'Butterworth' : 'Butterworth 0.5-5Hz',
                      style: TextStyle(color: Colors.white38, fontSize: isSmall ? 6.5 : 8),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              Container(width: 1, height: isSmall ? 22 : 32, color: const Color(0xFF334155)),
              Expanded(
                child: Column(
                  children: [
                    Text(
                      isSmall ? 'SpO2' : 'OXY MÁU (SpO2)',
                      style: TextStyle(color: Colors.white54, fontSize: isSmall ? 7.5 : 10),
                    ),
                    Text(
                      '${wearOs.spO2}%',
                      style: TextStyle(
                        color: wearOs.spO2 < 90 ? Colors.red : const Color(0xFF06B6D4),
                        fontSize: isSmall ? 11 : 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      isSmall ? 'Beer-Lambert' : 'Beer-Lambert Optic',
                      style: TextStyle(color: Colors.white38, fontSize: isSmall ? 6.5 : 8),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),

          SizedBox(height: isSmall ? 6 : 14),

          // Nút bấm tương tác đo ngay hoặc kích hoạt thử nghiệm
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Flexible(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF38BDF8),
                    side: const BorderSide(color: Color(0xFF0284C7)),
                    padding: EdgeInsets.symmetric(horizontal: isSmall ? 4 : 10, vertical: isSmall ? 2 : 6),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    visualDensity: VisualDensity.compact,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  icon: Icon(Icons.refresh_rounded, size: isSmall ? 9 : 12),
                  label: Text('ĐO NGAY', style: TextStyle(fontSize: isSmall ? 7.0 : 10, fontWeight: FontWeight.bold), overflow: TextOverflow.ellipsis),
                  onPressed: wearOs.measureVitalsNow,
                ),
              ),
              SizedBox(width: isSmall ? 3 : 6),
              Flexible(
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF7F1D1D),
                    foregroundColor: const Color(0xFFFCA5A5),
                    padding: EdgeInsets.symmetric(horizontal: isSmall ? 4 : 10, vertical: isSmall ? 2 : 6),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    visualDensity: VisualDensity.compact,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: Text('HẠ SpO2 86%', style: TextStyle(fontSize: isSmall ? 7.0 : 10, fontWeight: FontWeight.bold), overflow: TextOverflow.ellipsis),
                  onPressed: wearOs.simulateCriticalSpO2,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // MÀN HÌNH 3: PHÁT HIỆN TÉ NGÃ & GIA TỐC KẾ (KINEMATIC FALL & MOTION)
  // ===========================================================================
  Widget _buildFallMotionScreen(
    WearOsService wearOs,
    AppStrings strings,
    double d,
  ) {
    final isSmall = d <= 240;

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: isSmall ? 14 : 24,
        vertical: isSmall ? 8 : 20,
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.shield_rounded, color: const Color(0xFF10B981), size: isSmall ? 10 : 14),
              const SizedBox(width: 4),
              Text(
                wearOs.isFallMonitoringActive ? 'GIÁM SÁT NGÃ: BẬT' : 'GIÁM SÁT: TẮT',
                style: TextStyle(
                  color: wearOs.isFallMonitoringActive
                      ? const Color(0xFF10B981)
                      : const Color(0xFF94A3B8),
                  fontSize: isSmall ? 8.5 : 11,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          SizedBox(height: isSmall ? 4 : 10),

          // Hiển thị chỉ số SVM gia tốc và Góc nghiêng
          Container(
            padding: EdgeInsets.symmetric(horizontal: isSmall ? 4 : 10, vertical: isSmall ? 4 : 10),
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A),
              borderRadius: BorderRadius.circular(isSmall ? 8 : 12),
              border: Border.all(color: const Color(0xFF1E293B)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    children: [
                      Text(isSmall ? 'SVM' : 'GIA TỐC SVM', style: TextStyle(color: Colors.white54, fontSize: isSmall ? 7.5 : 9)),
                      const SizedBox(height: 2),
                      Text(
                        '${wearOs.currentSvmG} g',
                        style: TextStyle(
                          color: const Color(0xFF38BDF8),
                          fontSize: isSmall ? 13 : 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        isSmall ? '≥${wearOs.fallSensitivityG}g' : 'Ngưỡng: ≥${wearOs.fallSensitivityG}g',
                        style: TextStyle(color: Colors.white38, fontSize: isSmall ? 6.5 : 8),
                      ),
                    ],
                  ),
                ),
                Container(width: 1, height: isSmall ? 24 : 36, color: const Color(0xFF334155)),
                Expanded(
                  child: Column(
                    children: [
                      Text(isSmall ? 'GÓC θ' : 'GÓC NGHIÊNG θ', style: TextStyle(color: Colors.white54, fontSize: isSmall ? 7.5 : 9)),
                      const SizedBox(height: 2),
                      Text(
                        '${wearOs.currentTiltAngle}°',
                        style: TextStyle(
                          color: const Color(0xFFF59E0B),
                          fontSize: isSmall ? 13 : 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        isSmall ? '≥60°' : 'Nằm bệt: ≥60°',
                        style: TextStyle(color: Colors.white38, fontSize: isSmall ? 6.5 : 8),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          SizedBox(height: isSmall ? 4 : 10),

          // Nút đổi độ nhạy
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              ChoiceChip(
                label: Text(isSmall ? '2.5g' : '2.5g (Chuẩn)', style: TextStyle(fontSize: isSmall ? 7.5 : 10)),
                selected: wearOs.fallSensitivityG == 2.5,
                selectedColor: const Color(0xFF0284C7),
                backgroundColor: const Color(0xFF1E293B),
                labelStyle: TextStyle(
                  color: wearOs.fallSensitivityG == 2.5 ? Colors.white : Colors.white70,
                ),
                padding: EdgeInsets.symmetric(horizontal: isSmall ? 2 : 4),
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                visualDensity: VisualDensity.compact,
                onSelected: (_) => wearOs.setFallSensitivity(2.5),
              ),
              const SizedBox(width: 6),
              ChoiceChip(
                label: Text(isSmall ? '2.0g' : '2.0g (Nhạy)', style: TextStyle(fontSize: isSmall ? 7.5 : 10)),
                selected: wearOs.fallSensitivityG == 2.0,
                selectedColor: const Color(0xFF0284C7),
                backgroundColor: const Color(0xFF1E293B),
                labelStyle: TextStyle(
                  color: wearOs.fallSensitivityG == 2.0 ? Colors.white : Colors.white70,
                ),
                padding: EdgeInsets.symmetric(horizontal: isSmall ? 2 : 4),
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                visualDensity: VisualDensity.compact,
                onSelected: (_) => wearOs.setFallSensitivity(2.0),
              ),
            ],
          ),

          SizedBox(height: isSmall ? 4 : 10),

          // Nút thử nghiệm ngã 4.8g
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
              padding: EdgeInsets.symmetric(horizontal: isSmall ? 8 : 14, vertical: isSmall ? 3 : 6),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
            icon: Icon(Icons.personal_injury_rounded, size: isSmall ? 10 : 14),
            label: Text(
              'MÔ PHỎNG NGÃ 4.8G',
              style: TextStyle(fontSize: isSmall ? 7.5 : 10, fontWeight: FontWeight.bold),
            ),
            onPressed: wearOs.simulateFall,
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // MÀN HÌNH 4: HỒ SƠ Y TẾ KHẨN CẤP (MEDICAL ID CARD)
  // ===========================================================================
  Widget _buildMedicalIdScreen(
    AppProvider provider,
    AppStrings strings,
    double d,
  ) {
    final isSmall = d <= 240;
    final medical = provider.medical;
    final user = provider.user;
    final guardian = user?.emergencyContacts.isNotEmpty == true
        ? user!.emergencyContacts.first
        : null;

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: isSmall ? 14 : 24,
        vertical: isSmall ? 8 : 20,
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.medical_services_rounded, color: const Color(0xFFF43F5E), size: isSmall ? 10 : 14),
              const SizedBox(width: 4),
              Text(
                'HỒ SƠ Y TẾ KHẨN CẤP',
                style: TextStyle(
                  color: const Color(0xFFF43F5E),
                  fontSize: isSmall ? 7.0 : 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: isSmall ? -0.2 : 0.8,
                ),
              ),
            ],
          ),
          SizedBox(height: isSmall ? 4 : 10),

          // Thẻ tóm tắt nhóm máu & bệnh lý
          Container(
            padding: EdgeInsets.symmetric(horizontal: isSmall ? 8 : 10, vertical: isSmall ? 4 : 10),
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A),
              borderRadius: BorderRadius.circular(isSmall ? 8 : 12),
              border: Border.all(color: const Color(0xFF1E293B)),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Nhóm máu:', style: TextStyle(color: Colors.white60, fontSize: isSmall ? 8 : 11)),
                    Container(
                      padding: EdgeInsets.symmetric(horizontal: isSmall ? 4 : 8, vertical: isSmall ? 1 : 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF43F5E).withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: const Color(0xFFF43F5E)),
                      ),
                      child: Text(
                        medical.bloodType.isNotEmpty ? medical.bloodType : 'O+',
                        style: TextStyle(
                          color: const Color(0xFFF43F5E),
                          fontSize: isSmall ? 8.5 : 11,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                SizedBox(height: isSmall ? 3 : 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Dị ứng:', style: TextStyle(color: Colors.white60, fontSize: isSmall ? 8 : 11)),
                    Flexible(
                      child: Text(
                        medical.allergies.isNotEmpty ? medical.allergies : 'Không có',
                        style: TextStyle(color: Colors.white, fontSize: isSmall ? 8 : 11),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                SizedBox(height: isSmall ? 3 : 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Bệnh nền:', style: TextStyle(color: Colors.white60, fontSize: isSmall ? 8 : 11)),
                    Flexible(
                      child: Text(
                        medical.conditions.isNotEmpty ? medical.conditions : 'Bình thường',
                        style: TextStyle(color: Colors.white, fontSize: isSmall ? 8 : 11),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          SizedBox(height: isSmall ? 4 : 10),

          // Người bảo hộ khẩn cấp
          if (guardian != null)
            Container(
              padding: EdgeInsets.symmetric(horizontal: isSmall ? 6 : 10, vertical: isSmall ? 3 : 6),
              decoration: BoxDecoration(
                color: const Color(0xFF0284C7).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(isSmall ? 8 : 10),
                border: Border.all(color: const Color(0xFF0284C7).withValues(alpha: 0.4)),
              ),
              child: Row(
                children: [
                  Icon(Icons.phone_in_talk_rounded, color: const Color(0xFF38BDF8), size: isSmall ? 10 : 14),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${guardian.name} (${guardian.relation})',
                          style: TextStyle(color: Colors.white, fontSize: isSmall ? 7.5 : 10, fontWeight: FontWeight.bold),
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          guardian.phone,
                          style: TextStyle(color: const Color(0xFF38BDF8), fontSize: isSmall ? 7.5 : 10),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            )
          else
            Text(
              'Chưa gán người bảo hộ',
              style: TextStyle(color: Colors.white38, fontSize: isSmall ? 7.5 : 10),
            ),
        ],
      ),
    );
  }

  // ===========================================================================
  // MÀN HÌNH 5: CÀI ĐẶT THIẾT BỊ & ĐỒNG BỘ CLOUD (DEVICE SETTINGS)
  // ===========================================================================
  Widget _buildDeviceSettingsScreen(
    WearOsService wearOs,
    User? user,
    AppStrings strings,
    double d,
  ) {
    final isSmall = d <= 240;

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: isSmall ? 14 : 24,
        vertical: isSmall ? 8 : 20,
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.watch_rounded, color: const Color(0xFF38BDF8), size: isSmall ? 10 : 14),
              const SizedBox(width: 4),
              Text(
                'THIẾT BỊ WEAR OS',
                style: TextStyle(
                  color: const Color(0xFF38BDF8),
                  fontSize: isSmall ? 8.5 : 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.8,
                ),
              ),
            ],
          ),
          SizedBox(height: isSmall ? 4 : 10),

          // Tên model
          Text(
            wearOs.watchModel,
            style: TextStyle(color: Colors.white, fontSize: isSmall ? 8.5 : 11, fontWeight: FontWeight.bold),
            textAlign: TextAlign.center,
          ),

          SizedBox(height: isSmall ? 4 : 10),

          // Nút chuyển tháo vòng tay (Off-wrist switch)
          InkWell(
            onTap: () {
              HapticFeedback.selectionClick();
              wearOs.setOffWrist(!wearOs.isOffWrist);
            },
            borderRadius: BorderRadius.circular(isSmall ? 8 : 10),
            child: Container(
              padding: EdgeInsets.symmetric(horizontal: isSmall ? 8 : 12, vertical: isSmall ? 4 : 8),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                borderRadius: BorderRadius.circular(isSmall ? 8 : 10),
                border: Border.all(
                  color: wearOs.isOffWrist ? const Color(0xFFF59E0B) : const Color(0xFF10B981),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      wearOs.isOffWrist
                          ? (isSmall ? 'Tháo tay' : 'Trạng thái: Tháo tay')
                          : (isSmall ? 'Đang đeo' : 'Trạng thái: Đang đeo'),
                      style: TextStyle(
                        color: wearOs.isOffWrist ? const Color(0xFFF59E0B) : const Color(0xFF10B981),
                        fontSize: isSmall ? 8 : 10,
                        fontWeight: FontWeight.bold,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Icon(
                    wearOs.isOffWrist ? Icons.toggle_off_rounded : Icons.toggle_on_rounded,
                    color: wearOs.isOffWrist ? const Color(0xFFF59E0B) : const Color(0xFF10B981),
                    size: isSmall ? 16 : 20,
                  ),
                ],
              ),
            ),
          ),

          SizedBox(height: isSmall ? 4 : 10),

          // Nút ép đồng bộ mây (Force Cloud Sync)
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0284C7),
              foregroundColor: Colors.white,
              padding: EdgeInsets.symmetric(horizontal: isSmall ? 8 : 14, vertical: isSmall ? 4 : 8),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
            icon: wearOs.isSyncing
                ? SizedBox(
                    width: isSmall ? 9 : 12,
                    height: isSmall ? 9 : 12,
                    child: const CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : Icon(Icons.cloud_upload_rounded, size: isSmall ? 10 : 14),
            label: Text(
              wearOs.isSyncing ? 'Đang đồng bộ...' : 'ĐỒNG BỘ ĐÁM MÂY',
              style: TextStyle(fontSize: isSmall ? 7.5 : 10, fontWeight: FontWeight.bold),
            ),
            onPressed: user != null ? () => wearOs.syncVitalsToCloud(user.id) : null,
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // MÀN HÌNH ĐẾM NGƯỢC KHẨN CẤP (CIRCULAR EMERGENCY COUNTDOWN OVERLAY)
  // ===========================================================================
  Widget _buildEmergencyCountdownOverlay(
    WearOsService wearOs,
    User? user,
    double d,
  ) {
    final isSmall = d <= 240;
    final progress = (wearOs.countdownSeconds / 30.0).clamp(0.0, 1.0);

    return Container(
      color: Colors.black.withValues(alpha: 0.94),
      padding: EdgeInsets.all(isSmall ? 10 : 22),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Tiêu đề cảnh báo
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.warning_amber_rounded, color: const Color(0xFFEF4444), size: isSmall ? 12 : 16),
              const SizedBox(width: 4),
              Flexible(
                child: Text(
                  wearOs.emergencyTitle ?? 'CẢNH BÁO NGUY CẤP',
                  style: TextStyle(
                    color: const Color(0xFFEF4444),
                    fontSize: isSmall ? 8.5 : 11,
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),

          SizedBox(height: isSmall ? 4 : 12),

          // Vòng đếm ngược hình tròn
          Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(
                width: isSmall ? 60 : 100,
                height: isSmall ? 60 : 100,
                child: CircularProgressIndicator(
                  value: progress,
                  strokeWidth: isSmall ? 5 : 8,
                  backgroundColor: const Color(0xFF450A0A),
                  valueColor: const AlwaysStoppedAnimation(Color(0xFFDC2626)),
                ),
              ),
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '${wearOs.countdownSeconds}',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: isSmall ? 20 : 34,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  Text(
                    'GIÂY',
                    style: TextStyle(
                      color: const Color(0xFFF87171),
                      fontSize: isSmall ? 7 : 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ],
          ),

          SizedBox(height: isSmall ? 6 : 14),

          // Hai nút: "TÔI ỔN (HỦY)" và "CỨU HỘ NGAY"
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Flexible(
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF10B981),
                    foregroundColor: Colors.white,
                    padding: EdgeInsets.symmetric(horizontal: isSmall ? 4 : 14, vertical: isSmall ? 3 : 8),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    visualDensity: VisualDensity.compact,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  onPressed: wearOs.cancelEmergency,
                  child: Text(
                    'TÔI ỔN (HỦY)',
                    style: TextStyle(fontSize: isSmall ? 7.0 : 10, fontWeight: FontWeight.bold),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
              SizedBox(width: isSmall ? 3 : 6),
              Flexible(
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFDC2626),
                    foregroundColor: Colors.white,
                    padding: EdgeInsets.symmetric(horizontal: isSmall ? 4 : 12, vertical: isSmall ? 3 : 8),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    visualDensity: VisualDensity.compact,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  onPressed: () => wearOs.forceEmergencyDispatch(userId: user?.id),
                  child: Text(
                    'CỨU HỘ NGAY',
                    style: TextStyle(fontSize: isSmall ? 7.0 : 10, fontWeight: FontWeight.w900),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Custom painter vẽ đồ thị sóng xung mạch PPG thời gian thực
class _PpgWavePainter extends CustomPainter {
  final double pulseAnimation;
  final int heartRate;

  _PpgWavePainter({
    required this.pulseAnimation,
    required this.heartRate,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF38BDF8)
      ..strokeWidth = 2.0
      ..style = PaintingStyle.stroke;

    final path = Path();
    final midY = size.height / 2;
    path.moveTo(0, midY);

    final points = 80;
    for (int i = 0; i <= points; i++) {
      final x = (i / points) * size.width;
      // Dạng sóng xung mạch PPG kết hợp đỉnh tâm thu (Systolic Peak) và rãnh Dicrotic
      final phase = (i / points) * 4 * math.pi + (pulseAnimation * 2 * math.pi);
      final systolic = math.sin(phase);
      final dicrotic = 0.4 * math.sin(2 * phase + 0.5);
      final y = midY - (systolic + dicrotic) * (size.height * 0.35);

      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _PpgWavePainter oldDelegate) {
    return oldDelegate.pulseAnimation != pulseAnimation ||
        oldDelegate.heartRate != heartRate;
  }
}
