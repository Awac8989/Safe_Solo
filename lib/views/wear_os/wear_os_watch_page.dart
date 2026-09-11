import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../services/wear_os_service.dart';
import '../../services/watch_sync_manager.dart';

/// 7 Màn hình chuẩn 1:1 theo mẫu thiết kế SamsungGalaxyWatch5Interface trên GitHub
enum WatchScreen {
  watchface,
  dashboard,
  checkin,
  warning,
  sos,
  health,
  medical,
}

const List<WatchScreen> kWatchScreens = [
  WatchScreen.watchface,
  WatchScreen.dashboard,
  WatchScreen.checkin,
  WatchScreen.warning,
  WatchScreen.sos,
  WatchScreen.health,
  WatchScreen.medical,
];

const Map<WatchScreen, String> kScreenLabels = {
  WatchScreen.watchface: 'Watch Face',
  WatchScreen.dashboard: 'Dashboard',
  WatchScreen.checkin: 'Mood Check-in',
  WatchScreen.warning: 'Alert Warning',
  WatchScreen.sos: 'Active SOS',
  WatchScreen.health: 'Health Monitor',
  WatchScreen.medical: 'Medical ID',
};

/// ============================================================================
/// SAFESOLO - SAMSUNG GALAXY WATCH 5 INTERFACE (CHẾ TÁC 1:1 TỪ GITHUB)
/// Mẫu thiết kế gốc: https://github.com/Awac8989/SamsungGalaxyWatch5Interface
/// ============================================================================
class WearOsWatchPage extends StatefulWidget {
  const WearOsWatchPage({super.key});

  @override
  State<WearOsWatchPage> createState() => _WearOsWatchPageState();
}

class _WearOsWatchPageState extends State<WearOsWatchPage> {
  WatchScreen _screen = WatchScreen.watchface;
  late final PageController _pageController;
  late Timer _clockTimer;
  DateTime _now = DateTime.now();
  double _dragDelta = 0;

  // State cho Dashboard countdown (4320s / 7200s)
  int _dashboardSeconds = 4320;
  final int _dashboardTotal = 7200;

  // State cho Mood Check-in
  int? _selectedMood;
  bool _checkinDone = false;
  Timer? _checkinTimer1;
  Timer? _checkinTimer2;

  // State cho Warning screen
  bool _warningFlash = true;
  int _graceSeconds = 45;
  Timer? _warningTimer;
  Timer? _warningFlashTimer;

  // State cho SOS screen & PIN Mode
  bool _sosBlink = true;
  bool _pinMode = false;
  String _enteredPin = '';
  Timer? _sosBlinkTimer;

  // State cho Health Monitor
  int _healthBpm = 72;
  int _healthSpo2 = 98;
  Timer? _healthTimer;
  final List<int> _bpmHistory = [68, 70, 72, 71, 73, 74, 72, 72, 75, 73, 72, 71, 70, 72, 73];

  final List<Map<String, dynamic>> _moods = [
    {'emoji': '😄', 'label': 'Tuyệt vời', 'color': const Color(0xFF00C853)},
    {'emoji': '🙂', 'label': 'Bình thường', 'color': const Color(0xFF4FC3F7)},
    {'emoji': '😣', 'label': 'Mệt mỏi', 'color': const Color(0xFFFFB300)},
    {'emoji': '😰', 'label': 'Bất an', 'color': const Color(0xFFF44336)},
  ];

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: kWatchScreens.indexOf(_screen));
    WearOsService.instance.initialize();
    WearOsService.instance.addListener(_onWearOsChanged);
    WatchSyncManager.instance.addListener(_onSyncChanged);

    _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      final newNow = DateTime.now();
      final minuteChanged = newNow.minute != _now.minute;
      final isDashboard = _screen == WatchScreen.dashboard;

      if (isDashboard && _dashboardSeconds > 0) {
        _dashboardSeconds--;
      }

      if (minuteChanged || isDashboard) {
        setState(() {
          _now = newNow;
        });
      }
    });

    _warningFlashTimer = Timer.periodic(const Duration(milliseconds: 500), (_) {
      if (mounted && _screen == WatchScreen.warning) {
        setState(() => _warningFlash = !_warningFlash);
      }
    });

    _sosBlinkTimer = Timer.periodic(const Duration(milliseconds: 800), (_) {
      if (mounted && _screen == WatchScreen.sos) {
        setState(() => _sosBlink = !_sosBlink);
      }
    });

    _warningTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && _screen == WatchScreen.warning && _graceSeconds > 0) {
        setState(() {
          _graceSeconds--;
          if (_graceSeconds == 0) {
            _nav(WatchScreen.sos);
          }
        });
      }
    });

    _healthTimer = Timer.periodic(const Duration(milliseconds: 1500), (_) {
      if (mounted && _screen == WatchScreen.health) {
        final rnd = math.Random();
        setState(() {
          _healthBpm = (_healthBpm + (rnd.nextInt(5) - 2)).clamp(55, 120);
          _healthSpo2 = (_healthSpo2 + (rnd.nextInt(3) - 1)).clamp(92, 100);
          _bpmHistory.removeAt(0);
          _bpmHistory.add(_healthBpm);
        });
      }
    });
  }

  void _onSyncChanged() {
    if (mounted) setState(() {});
  }

  void _onWearOsChanged() {
    if (!mounted) return;
    final wearOs = WearOsService.instance;
    if (wearOs.isCountdownActive && _screen != WatchScreen.warning && _screen != WatchScreen.sos) {
      _nav(WatchScreen.warning);
      _graceSeconds = wearOs.countdownSeconds;
    }
  }

  @override
  void dispose() {
    WatchSyncManager.instance.removeListener(_onSyncChanged);
    WearOsService.instance.removeListener(_onWearOsChanged);
    _pageController.dispose();
    _clockTimer.cancel();
    _warningTimer?.cancel();
    _warningFlashTimer?.cancel();
    _sosBlinkTimer?.cancel();
    _healthTimer?.cancel();
    _checkinTimer1?.cancel();
    _checkinTimer2?.cancel();
    super.dispose();
  }

  void _nav(WatchScreen s) {
    debugPrint('WATCH_NAV: navigating to $s');
    HapticFeedback.selectionClick();
    setState(() {
      _screen = s;
      _pinMode = false;
      _enteredPin = '';
      if (s == WatchScreen.warning) _graceSeconds = 45;
    });

    final targetIndex = kWatchScreens.indexOf(s);
    if (_pageController.hasClients && _pageController.page?.round() != targetIndex) {
      _pageController.animateToPage(
        targetIndex,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeInOut,
      );
    }
  }

  void _prev() {
    final idx = kWatchScreens.indexOf(_screen);
    final prevIdx = (idx - 1 + kWatchScreens.length) % kWatchScreens.length;
    _nav(kWatchScreens[prevIdx]);
  }

  void _next() {
    final idx = kWatchScreens.indexOf(_screen);
    final nextIdx = (idx + 1) % kWatchScreens.length;
    _nav(kWatchScreens[nextIdx]);
  }

  @override
  Widget build(BuildContext context) {
    final wearOs = WearOsService.instance;

    // Tự động chuyển qua SOS nếu WearOsService kích hoạt đếm ngược khẩn cấp
    if (wearOs.isCountdownActive && _screen != WatchScreen.warning && _screen != WatchScreen.sos) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _nav(WatchScreen.warning);
      });
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final isNativeWatch = constraints.maxWidth <= 454 &&
            constraints.maxHeight <= 454 &&
            (constraints.maxWidth / constraints.maxHeight >= 0.8) &&
            (constraints.maxWidth / constraints.maxHeight <= 1.25);
        if (isNativeWatch) {
          final watchSize = math.min(constraints.maxWidth, constraints.maxHeight);
          return _buildNativeWatchLayout(context, watchSize > 0 ? watchSize : 192.0);
        }

        return _buildSimulatorLayout(context, constraints);
      },
    );
  }

  /// GIAO DIỆN CHUYÊN BIỆT CHO WEAR OS THẬT (FULL SCREEN 100%, AMOLED, KHÔNG KHUNG BEZEL GIẢ)
  Widget _buildNativeWatchLayout(BuildContext context, double size) {
    final currentIdx = kWatchScreens.indexOf(_screen);

    return Scaffold(
      backgroundColor: Colors.black,
      body: Center(
        child: SizedBox(
          width: size,
          height: size,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Swipe gesture detector for horizontal swipe between screens
              Positioned.fill(
                child: GestureDetector(
                  key: const Key('watch_gesture_detector'),
                  behavior: HitTestBehavior.opaque,
                  onHorizontalDragStart: (_) => _dragDelta = 0,
                  onHorizontalDragUpdate: (details) => _dragDelta += details.delta.dx,
                  onHorizontalDragEnd: (details) {
                    final vx = details.primaryVelocity ?? 0;
                    if (vx < -50 || _dragDelta < -30) {
                      _next();
                    } else if (vx > 50 || _dragDelta > 30) {
                      _prev();
                    }
                    _dragDelta = 0;
                  },
                  child: ClipOval(
                    child: Container(
                      width: size,
                      height: size,
                      color: Colors.black,
                      child: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 200),
                        transitionBuilder: (child, animation) => FadeTransition(opacity: animation, child: child),
                        child: KeyedSubtree(
                          key: ValueKey(_screen),
                          child: SizedBox(
                            width: size,
                            height: size,
                            child: _buildScreenContent(_screen, size, isNativeWatch: true),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),

              // 7 Chấm chỉ báo trang ở đỉnh màn hình tròn (Native Watch Indicator)
              Positioned(
                top: 6,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: List.generate(kWatchScreens.length, (i) {
                    final isCur = i == currentIdx;
                    return AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      margin: const EdgeInsets.symmetric(horizontal: 1.5),
                      width: isCur ? 10 : 3,
                      height: 3,
                      decoration: BoxDecoration(
                        color: isCur ? const Color(0xFF00C853) : Colors.white24,
                        borderRadius: BorderRadius.circular(1.5),
                        boxShadow: isCur ? const [BoxShadow(color: Color(0x9900C853), blurRadius: 4)] : null,
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

  /// GIAO DIỆN SIMULATOR TRÊN WEB / DESKTOP / PHONE THEO FIGMA GITHUB (CÓ KHUNG BEZEL & CROWN)
  Widget _buildSimulatorLayout(BuildContext context, BoxConstraints constraints) {
    Widget content = _buildFullGalaxyWatch5Layout(context);
    if (constraints.maxWidth < 460) {
      content = FittedBox(
        fit: BoxFit.contain,
        alignment: Alignment.center,
        child: SizedBox(
          width: 460,
          child: content,
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF0A0A0A), Color(0xFF111111), Color(0xFF0D0D0D)],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: SizedBox(
                width: constraints.maxWidth < 460 ? constraints.maxWidth : 460,
                child: content,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFullGalaxyWatch5Layout(BuildContext context) {
    final currentIdx = kWatchScreens.indexOf(_screen);

    return Column(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        // Thanh tiêu đề trên cùng (theo mẫu GitHub Figma)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (Navigator.of(context).canPop())
                IconButton(
                  icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF555555), size: 14),
                  onPressed: () => Navigator.of(context).maybePop(),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
                ),
              const Text(
                'SAMSUNG GALAXY WATCH 5',
                style: TextStyle(
                  fontFamily: 'sans-serif',
                  fontSize: 10,
                  color: Color(0xFF555555),
                  letterSpacing: 1.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Text(
                ' · ',
                style: TextStyle(fontSize: 10, color: Color(0xFF555555)),
              ),
              const Text(
                'SAFE-SOLO',
                style: TextStyle(
                  fontFamily: 'sans-serif',
                  fontSize: 10,
                  color: Color(0xFF555555),
                  letterSpacing: 1.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // Cụm đồng hồ Galaxy Watch 5 và 2 phím điều hướng Left/Right
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Nút lùi trang trái
            GestureDetector(
              onTap: _prev,
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.04),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                ),
                alignment: Alignment.center,
                child: const Text('‹', style: TextStyle(color: Color(0xFF555555), fontSize: 20, height: 1)),
              ),
            ),

            const SizedBox(width: 20),

            // WatchFrame: Khung bezel 340px & Màn hình 300px (chuẩn mẫu GitHub)
            _buildWatchFrame(340, 300),

            const SizedBox(width: 20),

            // Nút tới trang phải
            GestureDetector(
              onTap: _next,
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.04),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                ),
                alignment: Alignment.center,
                child: const Text('›', style: TextStyle(color: Color(0xFF555555), fontSize: 20, height: 1)),
              ),
            ),
          ],
        ),

        const SizedBox(height: 20),

        // Tên màn hình hiện tại (SCREEN_LABELS)
        Text(
          (kScreenLabels[_screen] ?? '').toUpperCase(),
          style: const TextStyle(
            fontFamily: 'sans-serif',
            fontSize: 11,
            color: Color(0xFF555555),
            letterSpacing: 1.5,
            fontWeight: FontWeight.bold,
          ),
        ),

        const SizedBox(height: 12),

        // 7 Chấm chỉ báo màn hình (Screen Dots)
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(kWatchScreens.length, (i) {
            final isCurrent = i == currentIdx;
            return GestureDetector(
              onTap: () => _nav(kWatchScreens[i]),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                margin: const EdgeInsets.symmetric(horizontal: 4),
                width: isCurrent ? 20 : 6,
                height: 6,
                decoration: BoxDecoration(
                  color: isCurrent ? const Color(0xFF00C853) : Colors.white.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(3),
                  boxShadow: isCurrent
                      ? [
                          const BoxShadow(
                            color: Color(0x8000C853),
                            blurRadius: 8,
                          ),
                        ]
                      : null,
                ),
              ),
            );
          }),
        ),

        const SizedBox(height: 14),

        // Danh sách liên kết chuyển màn hình nhanh (Screen Guide Links)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Wrap(
            spacing: 16,
            runSpacing: 6,
            alignment: WrapAlignment.center,
            children: kWatchScreens.map((s) {
              final isCurrent = _screen == s;
              return GestureDetector(
                onTap: () => _nav(s),
                child: Text(
                  kScreenLabels[s] ?? '',
                  style: TextStyle(
                    fontFamily: 'sans-serif',
                    fontSize: 10,
                    color: isCurrent ? const Color(0xFF00C853) : const Color(0xFF444444),
                    fontWeight: isCurrent ? FontWeight.bold : FontWeight.w500,
                    letterSpacing: 0.5,
                  ),
                ),
              );
            }).toList(),
          ),
        ),

        const SizedBox(height: 16),
      ],
    );
  }

  /// Khung viền kim loại Galaxy Watch 5 Bezel với 2 phím Crown bên phải (chuẩn 340px / 300px)
  Widget _buildWatchFrame(double outerSize, double innerSize) {
    return SizedBox(
      width: outerSize,
      height: outerSize,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.center,
        children: [
          // Vành Bezel kim loại tròn 340px
          Container(
            width: outerSize,
            height: outerSize,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF2A2A2A), Color(0xFF111111), Color(0xFF1E1E1E)],
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.9),
                  blurRadius: 36,
                  spreadRadius: 8,
                  offset: const Offset(0, 16),
                ),
                const BoxShadow(color: Color(0xFF333333), spreadRadius: 3),
                const BoxShadow(color: Color(0xFF1A1A1A), spreadRadius: 6),
              ],
              border: Border.all(color: const Color(0xFF333333), width: 1.5),
            ),
          ),

          // Phím Crown trên (Home/Power Button)
          Positioned(
            right: -4,
            top: (outerSize / 2) - 16,
            child: GestureDetector(
              onTap: () => _nav(WatchScreen.watchface),
              child: Container(
                width: 8,
                height: 32,
                decoration: BoxDecoration(
                  borderRadius: const BorderRadius.horizontal(right: Radius.circular(2)),
                  gradient: const LinearGradient(
                    colors: [Color(0xFF333333), Color(0xFF555555), Color(0xFF333333)],
                  ),
                  border: const Border(
                    top: BorderSide(color: Color(0xFFEF4444), width: 1),
                    right: BorderSide(color: Color(0xFFEF4444), width: 1),
                    bottom: BorderSide(color: Color(0xFFEF4444), width: 1),
                  ),
                ),
              ),
            ),
          ),

          // Phím Crown dưới (Back Button)
          Positioned(
            right: -4,
            top: (outerSize / 2) + 26,
            child: GestureDetector(
              onTap: _prev,
              child: Container(
                width: 8,
                height: 20,
                decoration: const BoxDecoration(
                  borderRadius: BorderRadius.horizontal(right: Radius.circular(2)),
                  gradient: LinearGradient(
                    colors: [Color(0xFF333333), Color(0xFF555555), Color(0xFF333333)],
                  ),
                ),
              ),
            ),
          ),

          // Màn hình cảm ứng tròn AMOLED Black 300px
          SizedBox(
            width: innerSize,
            height: innerSize,
            child: Listener(
              onPointerSignal: (signal) {
                if (signal is PointerScrollEvent) {
                  if (signal.scrollDelta.dy > 0) {
                    _next();
                  } else if (signal.scrollDelta.dy < 0) {
                    _prev();
                  }
                }
              },
              child: GestureDetector(
                key: const Key('watch_gesture_detector'),
                behavior: HitTestBehavior.opaque,
                onHorizontalDragStart: (_) => _dragDelta = 0,
                onHorizontalDragUpdate: (details) => _dragDelta += details.delta.dx,
                onHorizontalDragEnd: (details) {
                  final vx = details.primaryVelocity ?? 0;
                  if (vx < -50 || _dragDelta < -35) {
                    _next();
                  } else if (vx > 50 || _dragDelta > 35) {
                    _prev();
                  }
                  _dragDelta = 0;
                },
                child: ClipOval(
                  child: Container(
                    width: innerSize,
                    height: innerSize,
                    color: Colors.black,
                    child: RepaintBoundary(
                      child: SizedBox(
                        width: innerSize,
                        height: innerSize,
                        child: _buildScreenContent(_screen, innerSize, isNativeWatch: false),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildScreenContent(WatchScreen screen, double size, {required bool isNativeWatch}) {
    Widget child;
    switch (screen) {
      case WatchScreen.watchface:
        child = _buildWatchFaceScreen(size, isNativeWatch: isNativeWatch);
        break;
      case WatchScreen.dashboard:
        child = _buildDashboardScreen(size, isNativeWatch: isNativeWatch);
        break;
      case WatchScreen.checkin:
        child = _buildCheckinScreen(size, isNativeWatch: isNativeWatch);
        break;
      case WatchScreen.warning:
        child = _buildWarningScreen(size, isNativeWatch: isNativeWatch);
        break;
      case WatchScreen.sos:
        child = _buildSosScreen(size, isNativeWatch: isNativeWatch);
        break;
      case WatchScreen.health:
        child = _buildHealthScreen(size, isNativeWatch: isNativeWatch);
        break;
      case WatchScreen.medical:
        child = _buildMedicalScreen(size, isNativeWatch: isNativeWatch);
        break;
    }

    return SizedBox(
      width: size,
      height: size,
      child: child,
    );
  }

  // ===========================================================================
  // SCREEN 1: WATCH FACE (CHUẨN TỪNG CHI TIẾT TỪ GITHUB FIGMA)
  // ===========================================================================
  Widget _buildWatchFaceScreen(double size, {required bool isNativeWatch}) {
    final hh = _now.hour.toString().padLeft(2, '0');
    final mm = _now.minute.toString().padLeft(2, '0');
    final daysOfWeek = ['THỨ HAI', 'THỨ BA', 'THỨ TƯ', 'THỨ NĂM', 'THỨ SÁU', 'THỨ BẢY', 'CHỦ NHẬT'];
    final weekdayStr = daysOfWeek[(_now.weekday - 1).clamp(0, 6)];
    final dateStr = '$weekdayStr, ${_now.day} THG ${_now.month}';

    final clockFontSize = isNativeWatch ? (size <= 200 ? 38.0 : 44.0) : 54.0;
    final dateFontSize = isNativeWatch ? (size <= 200 ? 8.0 : 9.5) : 11.0;
    final badgePaddingH = isNativeWatch ? (size <= 200 ? 7.0 : 8.0) : 12.0;
    final badgePaddingV = isNativeWatch ? 1.5 : 3.0;
    final badgeFontSize = isNativeWatch ? (size <= 200 ? 7.5 : 8.5) : 10.0;
    final buttonSize = isNativeWatch ? (size <= 200 ? 46.0 : 52.0) : 60.0;
    final buttonFontSize = isNativeWatch ? (size <= 200 ? 8.0 : 8.5) : 9.0;
    final bottomOffset = isNativeWatch ? (size <= 200 ? 8.0 : 14.0) : 22.0;
    final arcStroke = isNativeWatch ? 5.0 : 6.0;

    return Stack(
      alignment: Alignment.center,
      children: [
        // Vòng cung chu vi CircularArc 0.72 (#00C853, bg #0a1a0a)
        CustomPaint(
          size: Size(size, size),
          painter: _CircularArcPainter(
            progress: 0.72,
            strokeWidth: arcStroke,
            color: const Color(0xFF00C853),
            backgroundColor: const Color(0xFF0A1A0A),
          ),
        ),

        // Nội dung trung tâm
        Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Đồng hồ số lớn JetBrains Mono
            Text(
              '$hh:$mm',
              style: TextStyle(
                fontFamily: 'monospace',
                fontSize: clockFontSize,
                fontWeight: FontWeight.w700,
                color: Colors.white,
                height: 1.0,
                letterSpacing: -1.0,
              ),
            ),

            SizedBox(height: isNativeWatch ? 2 : 4),

            // Ngày tháng in hoa chữ xám
            Text(
              dateStr,
              style: TextStyle(
                fontFamily: 'sans-serif',
                fontSize: dateFontSize,
                color: const Color(0xFF666666),
                letterSpacing: 2,
                fontWeight: FontWeight.w500,
              ),
            ),

            SizedBox(height: isNativeWatch ? (size <= 200 ? 2 : 3) : 4),

            // Trạng thái đồng bộ Smartwatch & Mã PIN (Tap để xem/đổi mã)
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: _showWatchPairingCodeModal,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    WatchSyncManager.instance.isPaired ? Icons.bluetooth_connected_rounded : Icons.sync_problem_rounded,
                    size: isNativeWatch ? (size <= 200 ? 8.0 : 9.0) : 10.0,
                    color: WatchSyncManager.instance.isPaired ? const Color(0xFF00C853) : const Color(0xFFFBBF24),
                  ),
                  const SizedBox(width: 3),
                  Text(
                    WatchSyncManager.instance.isPaired ? 'ĐỒNG BỘ: OK' : 'MÃ: ${WatchSyncManager.instance.pairingCode}',
                    style: TextStyle(
                      fontFamily: 'monospace',
                      fontSize: isNativeWatch ? (size <= 200 ? 6.5 : 7.5) : 8.5,
                      color: WatchSyncManager.instance.isPaired ? const Color(0xFF00C853) : const Color(0xFFFBBF24),
                      letterSpacing: 0.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),

            SizedBox(height: isNativeWatch ? (size <= 200 ? 4 : 6) : 8),

            // Huy hiệu SafeSolo 14:32 đến hạn
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () {
                debugPrint('WATCH_TAP: 14:32 chip tapped');
                _nav(WatchScreen.dashboard);
              },
              child: Container(
                padding: EdgeInsets.symmetric(horizontal: badgePaddingH, vertical: badgePaddingV),
                decoration: BoxDecoration(
                  color: const Color(0xFF00C853).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF00C853).withValues(alpha: 0.3)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: isNativeWatch ? 6 : 8,
                      height: isNativeWatch ? 6 : 8,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: Color(0xFF00C853),
                        boxShadow: [BoxShadow(color: Color(0xFF00C853), blurRadius: 6)],
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      '14:32 đến hạn',
                      style: TextStyle(
                        fontFamily: 'sans-serif',
                        fontSize: badgeFontSize,
                        color: const Color(0xFF00C853),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            SizedBox(height: isNativeWatch ? (size <= 200 ? 6 : 10) : 14),

            // Nút tròn TÔI AN TOÀN
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () {
                debugPrint('WATCH_TAP: TÔI AN TOÀN button tapped');
                _nav(WatchScreen.dashboard);
              },
              child: Container(
                width: buttonSize,
                height: buttonSize,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: Color(0xFF00C853),
                  boxShadow: [
                    BoxShadow(color: Color(0x8000C853), blurRadius: 18),
                  ],
                ),
                alignment: Alignment.center,
                child: Text(
                  'TÔI\nAN TOÀN',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontFamily: 'sans-serif',
                    fontSize: buttonFontSize,
                    fontWeight: FontWeight.w800,
                    color: Colors.black,
                    height: 1.15,
                  ),
                ),
              ),
            ),
          ],
        ),

        // Thanh trạng thái dưới đáy: ♥ 72   SpO₂ 98%   🔋 84%
        Positioned(
          bottom: bottomOffset,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('♥ 72', style: TextStyle(fontSize: isNativeWatch ? (size <= 200 ? 7.5 : 8.5) : 10, color: const Color(0xFF666666), fontWeight: FontWeight.w600)),
              SizedBox(width: isNativeWatch ? 8 : 12),
              Text('SpO₂ 98%', style: TextStyle(fontSize: isNativeWatch ? (size <= 200 ? 7.5 : 8.5) : 10, color: const Color(0xFF666666), fontWeight: FontWeight.w600)),
              SizedBox(width: isNativeWatch ? 8 : 12),
              Text('🔋 84%', style: TextStyle(fontSize: isNativeWatch ? (size <= 200 ? 7.5 : 8.5) : 10, color: const Color(0xFF666666), fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ],
    );
  }

  /// Hộp thoại xem và đổi mã ghép nối trực tiếp trên màn hình đồng hồ
  void _showWatchPairingCodeModal() {
    final sync = WatchSyncManager.instance;
    showDialog(
      context: context,
      builder: (ctx) {
        return Center(
          child: Container(
            width: 250,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF151922),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: const Color(0xFF00C853).withValues(alpha: 0.5), width: 1.5),
              boxShadow: const [
                BoxShadow(color: Color(0x6600C853), blurRadius: 20),
              ],
            ),
            child: Material(
              color: Colors.transparent,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.sync_alt_rounded, color: Color(0xFF00C853), size: 28),
                  const SizedBox(height: 6),
                  const Text(
                    'ĐỒNG BỘ VỚI ĐIỆN THOẠI',
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF888888), letterSpacing: 1.2),
                  ),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.black,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFF00C853)),
                    ),
                    child: Text(
                      sync.pairingCode,
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF00C853),
                        letterSpacing: 4,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Kênh: ${sync.connectionStatusLabel}',
                    style: const TextStyle(fontSize: 9, color: Color(0xFFAAAAAA)),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      TextButton(
                        onPressed: () async {
                          await sync.requestNewPairingCode();
                          if (ctx.mounted) Navigator.pop(ctx);
                        },
                        child: const Text('Đổi mã', style: TextStyle(color: Color(0xFF38BDF8), fontSize: 11)),
                      ),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF00C853),
                          foregroundColor: Colors.black,
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        ),
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text('Đóng', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  // ===========================================================================
  // SCREEN 2: DASHBOARD (DEAD-MAN COUNTDOWN THEO GITHUB FIGMA)
  // ===========================================================================
  Widget _buildDashboardScreen(double size, {required bool isNativeWatch}) {
    final progress = (_dashboardSeconds / _dashboardTotal).clamp(0.0, 1.0);
    final arcColor = progress > 0.5
        ? const Color(0xFF00C853)
        : progress > 0.2
            ? const Color(0xFFFFB300)
            : const Color(0xFFF44336);

    final hh = (_dashboardSeconds ~/ 3600).toString().padLeft(2, '0');
    final mm = ((_dashboardSeconds % 3600) ~/ 60).toString().padLeft(2, '0');
    final ss = (_dashboardSeconds % 60).toString().padLeft(2, '0');

    final timerFontSize = isNativeWatch ? (size * 0.16).clamp(26.0, 32.0) : 34.0;
    final btnWidth = isNativeWatch ? 74.0 : 80.0;
    final btnHeight = isNativeWatch ? 30.0 : 36.0;
    final btnFontSize = isNativeWatch ? 10.0 : 11.0;
    final sosWidth = isNativeWatch ? 50.0 : 52.0;
    final sosHeight = isNativeWatch ? 18.0 : 20.0;
    final sosFontSize = isNativeWatch ? 8.0 : 9.0;
    final arcStroke = isNativeWatch ? 7.0 : 10.0;

    return Stack(
      alignment: Alignment.center,
      children: [
        CustomPaint(
          size: Size(size, size),
          painter: _CircularArcPainter(
            progress: progress,
            strokeWidth: arcStroke,
            color: arcColor,
            backgroundColor: const Color(0xFF111111),
          ),
        ),

        Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Status bar
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('⟳ BT', style: TextStyle(fontSize: isNativeWatch ? 8 : 9, color: const Color(0xFF555555), fontWeight: FontWeight.w500)),
                SizedBox(width: isNativeWatch ? 6 : 8),
                Text('📍 GPS', style: TextStyle(fontSize: isNativeWatch ? 8 : 9, color: const Color(0xFF00C853), fontWeight: FontWeight.bold)),
                SizedBox(width: isNativeWatch ? 6 : 8),
                Text('🔋 84%', style: TextStyle(fontSize: isNativeWatch ? 8 : 9, color: const Color(0xFF555555), fontWeight: FontWeight.w500)),
              ],
            ),

            SizedBox(height: isNativeWatch ? 3 : 6),

            Text(
              'ĐẾN HẠN ĐIỂM DANH',
              style: TextStyle(
                fontFamily: 'sans-serif',
                fontSize: isNativeWatch ? 8.5 : 9,
                color: const Color(0xFF666666),
                letterSpacing: 1.5,
                fontWeight: FontWeight.bold,
              ),
            ),

            SizedBox(height: isNativeWatch ? 1 : 2),

            Text(
              '$hh:$mm:$ss',
              style: TextStyle(
                fontFamily: 'monospace',
                fontSize: timerFontSize,
                fontWeight: FontWeight.w700,
                color: Colors.white,
                height: 1.0,
                letterSpacing: -1.0,
              ),
            ),

            SizedBox(height: isNativeWatch ? 2 : 3),

            Text('Hạn chót: 14:00', style: TextStyle(fontSize: isNativeWatch ? 8.5 : 10, color: const Color(0xFF666666))),

            SizedBox(height: isNativeWatch ? 4 : 6),

            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('♥ 72 BPM', style: TextStyle(fontSize: isNativeWatch ? 8.5 : 10, color: const Color(0xFFF87171), fontWeight: FontWeight.bold)),
                SizedBox(width: isNativeWatch ? 8 : 10),
                Text('SpO₂ 98%', style: TextStyle(fontSize: isNativeWatch ? 8.5 : 10, color: const Color(0xFF60A5FA), fontWeight: FontWeight.bold)),
              ],
            ),

            SizedBox(height: isNativeWatch ? 6 : 10),

            // Nút ĐIỂM DANH
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => _nav(WatchScreen.checkin),
              child: Container(
                width: btnWidth,
                height: btnHeight,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(btnHeight / 2),
                  color: const Color(0xFF00C853),
                  boxShadow: const [BoxShadow(color: Color(0x6600C853), blurRadius: 16)],
                ),
                alignment: Alignment.center,
                child: Text(
                  'ĐIỂM DANH',
                  style: TextStyle(
                    fontFamily: 'sans-serif',
                    fontSize: btnFontSize,
                    fontWeight: FontWeight.w700,
                    color: Colors.black,
                  ),
                ),
              ),
            ),

            SizedBox(height: isNativeWatch ? 4 : 6),

            // Nút SOS KHẨN mini
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => _nav(WatchScreen.warning),
              child: Container(
                width: sosWidth,
                height: sosHeight,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(sosHeight / 2),
                  color: const Color(0xFFF44336).withValues(alpha: 0.15),
                  border: Border.all(color: const Color(0xFFF44336).withValues(alpha: 0.5)),
                ),
                alignment: Alignment.center,
                child: Text(
                  'SOS KHẨN',
                  style: TextStyle(
                    fontFamily: 'sans-serif',
                    fontSize: sosFontSize,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFFF44336),
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ===========================================================================
  // SCREEN 3: MOOD CHECK-IN (4 CẢM XÚC THEO GITHUB FIGMA)
  // ===========================================================================
  Widget _buildCheckinScreen(double size, {required bool isNativeWatch}) {
    if (_checkinDone) {
      return Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text('✓', style: TextStyle(fontSize: isNativeWatch ? 34 : 40, color: const Color(0xFF00C853), fontWeight: FontWeight.bold)),
          SizedBox(height: isNativeWatch ? 4 : 6),
          Text('Đã điểm danh!', style: TextStyle(fontSize: isNativeWatch ? 12 : 13, color: const Color(0xFF00C853), fontWeight: FontWeight.w600)),
          const SizedBox(height: 2),
          Text('Bộ đếm đã reset', style: TextStyle(fontSize: isNativeWatch ? 9 : 10, color: const Color(0xFF666666))),
        ],
      );
    }

    final cardSize = isNativeWatch ? 52.0 : 62.0;
    final emojiSize = isNativeWatch ? 18.0 : 22.0;
    final labelSize = isNativeWatch ? 7.5 : 8.0;

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          'CẢM XÚC HÔM NAY?',
          style: TextStyle(fontFamily: 'sans-serif', fontSize: isNativeWatch ? 10 : 11, color: const Color(0xFF888888), letterSpacing: 1),
        ),

        SizedBox(height: isNativeWatch ? 8 : 12),

        // Grid 2x2: 4 Moods
        Wrap(
          spacing: isNativeWatch ? 8 : 10,
          runSpacing: isNativeWatch ? 8 : 10,
          children: List.generate(_moods.length, (i) {
            final m = _moods[i];
            final isSelected = _selectedMood == i;
            final color = m['color'] as Color;

            return GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () {
                HapticFeedback.selectionClick();
                setState(() => _selectedMood = i);
                WatchSyncManager.instance.emitDeadmanCheckin(mood: m['label'] as String? ?? 'Tuyệt vời');
                _checkinTimer1?.cancel();
                _checkinTimer2?.cancel();
                _checkinTimer1 = Timer(const Duration(milliseconds: 600), () {
                  if (mounted) setState(() => _checkinDone = true);
                });
                _checkinTimer2 = Timer(const Duration(milliseconds: 1600), () {
                  if (mounted) _nav(WatchScreen.dashboard);
                });
              },
              child: Container(
                width: cardSize,
                height: cardSize,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(isNativeWatch ? 14 : 16),
                  color: isSelected ? color.withValues(alpha: 0.15) : Colors.white.withValues(alpha: 0.05),
                  border: Border.all(
                    color: isSelected ? color : Colors.white.withValues(alpha: 0.08),
                  ),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(m['emoji'] as String, style: TextStyle(fontSize: emojiSize)),
                    const SizedBox(height: 2),
                    Text(m['label'] as String, style: TextStyle(fontSize: labelSize, color: const Color(0xFFAAAAAA))),
                  ],
                ),
              ),
            );
          }),
        ),

        SizedBox(height: isNativeWatch ? 8 : 12),

        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => _nav(WatchScreen.dashboard),
          child: Text('Chỉ check-in', style: TextStyle(fontSize: isNativeWatch ? 9 : 10, color: const Color(0xFF666666))),
        ),
      ],
    );
  }

  // ===========================================================================
  // SCREEN 4: ALERT WARNING (CẢNH BÁO TIỀN KHẨN CẤP 45S THEO GITHUB FIGMA)
  // ===========================================================================
  Widget _buildWarningScreen(double size, {required bool isNativeWatch}) {
    final progress = _graceSeconds / 45.0;
    final arcStroke = isNativeWatch ? 6.0 : 8.0;

    return Stack(
      alignment: Alignment.center,
      children: [
        // Flashing border
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: _warningFlash ? const Color(0xFFF44336) : Colors.transparent,
              width: isNativeWatch ? 4 : 6,
            ),
            boxShadow: _warningFlash
                ? [
                    BoxShadow(color: const Color(0x66F44336), blurRadius: isNativeWatch ? 20 : 30),
                  ]
                : null,
          ),
        ),

        // CircularArc countdown 45s
        CustomPaint(
          size: Size(size, size),
          painter: _CircularArcPainter(
            progress: progress,
            strokeWidth: arcStroke,
            color: const Color(0xFFF44336),
            backgroundColor: const Color(0xFF1A0808),
          ),
        ),

        Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              '⚠ CẢNH BÁO KHẨN CẤP',
              style: TextStyle(
                fontFamily: 'sans-serif',
                fontSize: isNativeWatch ? (size <= 200 ? 8.0 : 9.0) : 10.0,
                color: _warningFlash ? const Color(0xFFF44336) : const Color(0xFFCC3333),
                fontWeight: FontWeight.w700,
                letterSpacing: 1.5,
              ),
            ),

            const SizedBox(height: 1),

            Text(
              'Đang kích hoạt SOS tự động...',
              style: TextStyle(fontSize: isNativeWatch ? (size <= 200 ? 7.0 : 8.5) : 10.0, color: const Color(0xFF888888)),
            ),

            SizedBox(height: isNativeWatch ? 2 : 6),

            // Grace period seconds in JetBrains Mono
            Text(
              '${_graceSeconds}s',
              style: TextStyle(
                fontFamily: 'monospace',
                fontSize: isNativeWatch ? (size <= 200 ? 24.0 : 34.0) : 42.0,
                fontWeight: FontWeight.w700,
                color: const Color(0xFFF44336),
                shadows: const [BoxShadow(color: Color(0x99F44336), blurRadius: 16)],
              ),
            ),

            SizedBox(height: isNativeWatch ? 3 : 8),

            // Nút "← Vuốt: Tôi an toàn"
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () {
                WearOsService.instance.cancelEmergency();
                _nav(WatchScreen.dashboard);
              },
              child: Container(
                width: isNativeWatch ? (size <= 200 ? 116.0 : 134.0) : 160.0,
                height: isNativeWatch ? (size <= 200 ? 24.0 : 30.0) : 36.0,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(isNativeWatch ? 12 : 18),
                  color: Colors.white.withValues(alpha: 0.06),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                ),
                alignment: Alignment.center,
                child: Text(
                  '← Vuốt: Tôi an toàn',
                  style: TextStyle(fontSize: isNativeWatch ? (size <= 200 ? 8.0 : 9.0) : 10.0, color: const Color(0xFF00C853), fontWeight: FontWeight.w600),
                ),
              ),
            ),

            SizedBox(height: isNativeWatch ? 3 : 8),

            // Nút "GỬI SOS NGAY"
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () {
                WearOsService.instance.triggerHardwareSos();
                _nav(WatchScreen.sos);
              },
              child: Container(
                width: isNativeWatch ? (size <= 200 ? 76.0 : 88.0) : 100.0,
                height: isNativeWatch ? (size <= 200 ? 20.0 : 24.0) : 28.0,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(isNativeWatch ? 10 : 14),
                  color: const Color(0xFFF44336),
                  boxShadow: const [BoxShadow(color: Color(0x80F44336), blurRadius: 14)],
                ),
                alignment: Alignment.center,
                child: Text(
                  'GỬI SOS NGAY',
                  style: TextStyle(fontSize: isNativeWatch ? (size <= 200 ? 8.0 : 9.0) : 10.0, fontWeight: FontWeight.w700, color: Colors.white),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ===========================================================================
  // SCREEN 5: ACTIVE SOS & BÀN PHÍM PIN (CHUẨN TỪ GITHUB FIGMA)
  // ===========================================================================
  Widget _buildSosScreen(double size, {required bool isNativeWatch}) {
    if (_pinMode) {
      final dialBtnSize = isNativeWatch ? 30.0 : 38.0;
      final dialFontSize = isNativeWatch ? 12.0 : 14.0;
      final pinDotSize = isNativeWatch ? 11.0 : 14.0;

      return Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text('NHẬP MÃ PIN', style: TextStyle(fontSize: isNativeWatch ? 9 : 10, color: const Color(0xFF888888))),

          SizedBox(height: isNativeWatch ? 4 : 8),

          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(4, (i) {
              final filled = _enteredPin.length > i;
              return Container(
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: pinDotSize,
                height: pinDotSize,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: filled ? const Color(0xFFF44336) : Colors.white.withValues(alpha: 0.1),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
                ),
              );
            }),
          ),

          SizedBox(height: isNativeWatch ? 4 : 8),

          // 3x4 Dialpad
          Wrap(
            spacing: isNativeWatch ? 6 : 8,
            runSpacing: isNativeWatch ? 4 : 6,
            alignment: WrapAlignment.center,
            children: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((d) {
              return GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () {
                  HapticFeedback.selectionClick();
                  if (RegExp(r'\d').hasMatch(d) && _enteredPin.length < 4) {
                    setState(() {
                      _enteredPin += d;
                      if (_enteredPin.length == 4) {
                        Future.delayed(const Duration(milliseconds: 300), () {
                          WearOsService.instance.cancelEmergency();
                          setState(() {
                            _enteredPin = '';
                            _pinMode = false;
                          });
                          _nav(WatchScreen.dashboard);
                        });
                      }
                    });
                  }
                },
                child: Container(
                  width: dialBtnSize,
                  height: dialBtnSize,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white.withValues(alpha: 0.06),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                  ),
                  alignment: Alignment.center,
                  child: Text(d, style: TextStyle(fontSize: dialFontSize, fontWeight: FontWeight.w600, color: Colors.white)),
                ),
              );
            }).toList(),
          ),
        ],
      );
    }

    final pttSize = isNativeWatch ? (size <= 200 ? 32.0 : 42.0) : 52.0;
    final pttIconSize = isNativeWatch ? (size <= 200 ? 14.0 : 18.0) : 22.0;

    return Stack(
      alignment: Alignment.center,
      children: [
        // Blinking border
        Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: _sosBlink ? const Color(0xFFF44336) : const Color(0xFF8B0000),
              width: isNativeWatch ? 4 : 5,
            ),
            boxShadow: _sosBlink
                ? [
                    BoxShadow(color: const Color(0x4DF44336), blurRadius: isNativeWatch ? 24 : 40),
                  ]
                : null,
          ),
        ),

        Padding(
          padding: EdgeInsets.symmetric(horizontal: isNativeWatch ? (size <= 200 ? 8 : 12) : 20),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                '🆘 SOS ĐANG HOẠT ĐỘNG',
                style: TextStyle(
                  fontFamily: 'sans-serif',
                  fontSize: isNativeWatch ? (size <= 200 ? 8.5 : 9.5) : 11,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFFF44336),
                  letterSpacing: 1.5,
                  shadows: const [BoxShadow(color: Color(0xCCF44336), blurRadius: 10)],
                ),
              ),

              SizedBox(height: isNativeWatch ? 2 : 6),

              // GPS Box
              Container(
                padding: EdgeInsets.symmetric(horizontal: isNativeWatch ? 6 : 10, vertical: isNativeWatch ? 1.5 : 4),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  color: Colors.white.withValues(alpha: 0.05),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                ),
                child: Column(
                  children: [
                    Text('📍 Đã chốt tọa độ GPS', style: TextStyle(fontSize: isNativeWatch ? (size <= 200 ? 7.5 : 8) : 9, color: const Color(0xFF00C853), fontWeight: FontWeight.w600)),
                    const SizedBox(height: 1),
                    Text('10.7769° N, 106.7009° E', style: TextStyle(fontFamily: 'monospace', fontSize: isNativeWatch ? (size <= 200 ? 7.0 : 7.5) : 8, color: const Color(0xFF666666))),
                  ],
                ),
              ),

              SizedBox(height: isNativeWatch ? 2 : 6),

              // Checklist
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('✓ ', style: TextStyle(color: Color(0xFF00C853), fontSize: 8)),
                      Text(isNativeWatch ? 'SMS & Zalo' : 'SMS & Zalo Guardian', style: TextStyle(color: const Color(0xFFAAAAAA), fontSize: isNativeWatch ? 7.0 : 9)),
                    ],
                  ),
                  const SizedBox(height: 1),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('✓ ', style: TextStyle(color: Color(0xFF00C853), fontSize: 8)),
                      Text('Điều phối Hiệp sĩ', style: TextStyle(color: const Color(0xFFAAAAAA), fontSize: isNativeWatch ? 7.0 : 9)),
                    ],
                  ),
                  const SizedBox(height: 1),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('... ', style: TextStyle(color: Color(0xFFFFB300), fontSize: 8)),
                      Text(isNativeWatch ? 'Kết nối cuộc gọi' : 'Đang kết nối cuộc gọi', style: TextStyle(color: const Color(0xFFAAAAAA), fontSize: isNativeWatch ? 7.0 : 9)),
                    ],
                  ),
                ],
              ),

              SizedBox(height: isNativeWatch ? 2 : 8),

              // Mic Push-to-Talk button
              Container(
                width: pttSize,
                height: pttSize,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFF44336).withValues(alpha: 0.2),
                  border: Border.all(color: const Color(0xFFF44336), width: 2),
                  boxShadow: const [BoxShadow(color: Color(0x4DF44336), blurRadius: 18)],
                ),
                alignment: Alignment.center,
                child: Text('🎙', style: TextStyle(fontSize: pttIconSize)),
              ),

              SizedBox(height: isNativeWatch ? 2 : 6),

              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => setState(() => _pinMode = true),
                child: Text(
                  'Hủy báo động (cần PIN)',
                  style: TextStyle(fontSize: isNativeWatch ? (size <= 200 ? 7.5 : 8) : 9, color: const Color(0xFF666666)),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ===========================================================================
  // SCREEN 6: HEALTH MONITOR (VẼ SÓNG ECG THEO GITHUB FIGMA)
  // ===========================================================================
  Widget _buildHealthScreen(double size, {required bool isNativeWatch}) {
    final waveWidth = isNativeWatch ? (size <= 200 ? 104.0 : 124.0) : 140.0;
    final waveHeight = isNativeWatch ? (size <= 200 ? 18.0 : 24.0) : 32.0;
    final cardPad = isNativeWatch ? (size <= 200 ? 4.0 : 6.0) : 10.0;
    final titleFontSize = isNativeWatch ? (size <= 200 ? 7.0 : 8.0) : 9.0;
    final numFontSize = isNativeWatch ? (size <= 200 ? 10.5 : 12.0) : 15.0;

    return Padding(
      padding: EdgeInsets.symmetric(horizontal: isNativeWatch ? 8 : 20),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            'SỨC KHỎE SINH TỒN',
            style: TextStyle(fontFamily: 'sans-serif', fontSize: isNativeWatch ? 8.0 : 10, color: const Color(0xFF666666), letterSpacing: 1.5),
          ),

          SizedBox(height: isNativeWatch ? 3 : 8),

          // Heart Rate Card with ECG Waveform
          Container(
            padding: EdgeInsets.all(cardPad),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(isNativeWatch ? 10 : 16),
              color: const Color(0xFFF87171).withValues(alpha: 0.08),
              border: Border.all(color: const Color(0xFFF87171).withValues(alpha: 0.2)),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('♥ NHỊP TIM', style: TextStyle(fontSize: titleFontSize, color: const Color(0xFFF87171), fontWeight: FontWeight.w600)),
                    Text('$_healthBpm BPM', style: TextStyle(fontFamily: 'monospace', fontSize: numFontSize, fontWeight: FontWeight.w700, color: const Color(0xFFF87171))),
                  ],
                ),
                SizedBox(height: isNativeWatch ? 1 : 4),
                CustomPaint(
                  size: Size(waveWidth, waveHeight),
                  painter: _BpmPolylinePainter(history: _bpmHistory),
                ),
              ],
            ),
          ),

          SizedBox(height: isNativeWatch ? 3 : 8),

          // SpO2 Card with Progress Bar
          Container(
            padding: EdgeInsets.all(cardPad),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(isNativeWatch ? 10 : 16),
              color: const Color(0xFF60A5FA).withValues(alpha: 0.08),
              border: Border.all(color: const Color(0xFF60A5FA).withValues(alpha: 0.2)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('SpO₂ OXY MÁU', style: TextStyle(fontSize: titleFontSize, color: const Color(0xFF60A5FA), fontWeight: FontWeight.w600)),
                    Text(
                      '$_healthSpo2%',
                      style: TextStyle(
                        fontFamily: 'monospace',
                        fontSize: numFontSize,
                        fontWeight: FontWeight.w700,
                        color: _healthSpo2 < 95 ? const Color(0xFFF44336) : const Color(0xFF60A5FA),
                      ),
                    ),
                  ],
                ),
                SizedBox(height: isNativeWatch ? 2 : 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(2),
                  child: LinearProgressIndicator(
                    value: _healthSpo2 / 100.0,
                    minHeight: isNativeWatch ? 2.5 : 4,
                    backgroundColor: const Color(0xFF60A5FA).withValues(alpha: 0.15),
                    valueColor: AlwaysStoppedAnimation(
                      _healthSpo2 < 95 ? const Color(0xFFF44336) : const Color(0xFF60A5FA),
                    ),
                  ),
                ),
                if (_healthSpo2 < 95)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text('⚠ Dưới ngưỡng an toàn', style: TextStyle(fontSize: isNativeWatch ? 7 : 8, color: const Color(0xFFF44336))),
                  ),
              ],
            ),
          ),

          SizedBox(height: isNativeWatch ? 4 : 8),

          // Wrist Status
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: isNativeWatch ? 6 : 8,
                height: isNativeWatch ? 6 : 8,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: Color(0xFF00C853),
                  boxShadow: [BoxShadow(color: Color(0xFF00C853), blurRadius: 6)],
                ),
              ),
              const SizedBox(width: 5),
              Text(isNativeWatch ? 'Đeo tay: OK' : 'Cảm biến đeo tay: OK', style: TextStyle(fontSize: isNativeWatch ? 7.5 : 9, color: const Color(0xFF666666))),
            ],
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // SCREEN 7: MEDICAL ID CARD (VẼ MÃ QR 110PX THEO GITHUB FIGMA)
  // ===========================================================================
  Widget _buildMedicalScreen(double size, {required bool isNativeWatch}) {
    final qrBoxSize = isNativeWatch ? (size <= 200 ? 56.0 : 70.0) : 90.0;
    final qrPaintSize = isNativeWatch ? (size <= 200 ? 46.0 : 60.0) : 78.0;
    final cardWidth = isNativeWatch ? (size <= 200 ? 140.0 : 160.0) : 200.0;
    final callBtnWidth = isNativeWatch ? (size <= 200 ? 96.0 : 110.0) : 120.0;
    final callBtnHeight = isNativeWatch ? (size <= 200 ? 18.0 : 22.0) : 26.0;

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          'THẺ Y TẾ KHẨN CẤP',
          style: TextStyle(fontFamily: 'sans-serif', fontSize: isNativeWatch ? 8.0 : 9, color: const Color(0xFF666666), letterSpacing: 1.5),
        ),

        SizedBox(height: isNativeWatch ? 3 : 6),

        // Khung QR Code nền trắng
        Container(
          width: qrBoxSize,
          height: qrBoxSize,
          padding: EdgeInsets.all(isNativeWatch ? 4 : 6),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(isNativeWatch ? 8 : 10),
          ),
          child: CustomPaint(
            size: Size(qrPaintSize, qrPaintSize),
            painter: _FigmaQrCodePainter(),
          ),
        ),

        SizedBox(height: isNativeWatch ? 4 : 8),

        // Thẻ thông tin y tế tóm tắt
        Container(
          width: cardWidth,
          padding: EdgeInsets.symmetric(horizontal: isNativeWatch ? 6 : 10, vertical: isNativeWatch ? 2 : 6),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(isNativeWatch ? 8 : 10),
            color: Colors.white.withValues(alpha: 0.04),
            border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
          ),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Nhóm máu', style: TextStyle(fontSize: isNativeWatch ? 7.0 : 8, color: const Color(0xFF666666))),
                  Text('O+', style: TextStyle(fontSize: isNativeWatch ? 7.0 : 8, color: const Color(0xFFCCCCCC), fontWeight: FontWeight.w600)),
                ],
              ),
              const SizedBox(height: 1),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Dị ứng', style: TextStyle(fontSize: isNativeWatch ? 7.0 : 8, color: const Color(0xFF666666))),
                  Text('Penicillin', style: TextStyle(fontSize: isNativeWatch ? 7.0 : 8, color: const Color(0xFFCCCCCC), fontWeight: FontWeight.w600)),
                ],
              ),
              const SizedBox(height: 1),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Bệnh nền', style: TextStyle(fontSize: isNativeWatch ? 7.0 : 8, color: const Color(0xFF666666))),
                  Flexible(
                    child: Text(
                      'Tăng HA',
                      style: TextStyle(fontSize: isNativeWatch ? 7.0 : 8, color: const Color(0xFFCCCCCC), fontWeight: FontWeight.w600),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),

        SizedBox(height: isNativeWatch ? 5 : 8),

        // Nút Gọi người bảo hộ
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () {
            HapticFeedback.heavyImpact();
            WearOsService.instance.triggerHardwareSos();
          },
          child: Container(
            width: callBtnWidth,
            height: callBtnHeight,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(callBtnHeight / 2),
              color: const Color(0xFF00C853).withValues(alpha: 0.15),
              border: Border.all(color: const Color(0xFF00C853).withValues(alpha: 0.4)),
            ),
            alignment: Alignment.center,
            child: Text(
              '📞 Gọi người bảo hộ',
              style: TextStyle(
                fontFamily: 'sans-serif',
                fontSize: isNativeWatch ? 7.5 : 9,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF00C853),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Custom painter vẽ vòng cung chu vi (CircularArc)
class _CircularArcPainter extends CustomPainter {
  final double progress;
  final double strokeWidth;
  final Color color;
  final Color backgroundColor;

  _CircularArcPainter({
    required this.progress,
    required this.strokeWidth,
    required this.color,
    required this.backgroundColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - strokeWidth) / 2;

    // Vòng tròn nền
    final bgPaint = Paint()
      ..color = backgroundColor
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke;
    canvas.drawCircle(center, radius, bgPaint);

    // Vòng cung tiến trình
    final sweepAngle = 2 * math.pi * progress.clamp(0.0, 1.0);
    final arcPaint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -math.pi / 2,
      sweepAngle,
      false,
      arcPaint,
    );
  }

  @override
  bool shouldRepaint(covariant _CircularArcPainter oldDelegate) {
    return oldDelegate.progress != progress ||
        oldDelegate.color != color ||
        oldDelegate.strokeWidth != strokeWidth;
  }
}

/// Custom painter vẽ polyline nhịp tim ECG động
class _BpmPolylinePainter extends CustomPainter {
  final List<int> history;

  _BpmPolylinePainter({required this.history});

  @override
  void paint(Canvas canvas, Size size) {
    if (history.length < 2) return;

    final paint = Paint()
      ..color = const Color(0xFFF87171)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final minVal = history.reduce(math.min);
    final maxVal = history.reduce(math.max);
    final diff = math.max(maxVal - minVal, 1);

    final path = Path();
    for (int i = 0; i < history.length; i++) {
      final x = (i / (history.length - 1)) * size.width;
      final y = size.height - ((history[i] - minVal) / diff) * size.height;
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _BpmPolylinePainter oldDelegate) => true;
}

/// Custom painter vẽ mã QR cứu nạn 9x9 (chuẩn từ SVG trong React app)
class _FigmaQrCodePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.black
      ..style = PaintingStyle.fill;

    final step = size.width / 9.0;

    // Lưới 9x9 với công thức (row + col + row * col) % 3 == 0
    for (int row = 0; row < 9; row++) {
      for (int col = 0; col < 9; col++) {
        // Tránh 3 góc định vị
        if ((row < 3 && col < 3) || (row < 3 && col > 5) || (row > 5 && col < 3)) {
          continue;
        }
        if ((row + col + row * col) % 3 == 0) {
          canvas.drawRRect(
            RRect.fromRectAndRadius(
              Rect.fromLTWH(col * step + 0.5, row * step + 0.5, step - 1.0, step - 1.0),
              const Radius.circular(1),
            ),
            paint,
          );
        }
      }
    }

    // 3 góc định vị (Corner Markers)
    _drawCornerMarker(canvas, const Offset(0, 0), step * 3);
    _drawCornerMarker(canvas, Offset(size.width - step * 3, 0), step * 3);
    _drawCornerMarker(canvas, Offset(0, size.height - step * 3), step * 3);
  }

  void _drawCornerMarker(Canvas canvas, Offset offset, double s) {
    final strokePaint = Paint()
      ..color = Colors.black
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.22;

    final fillPaint = Paint()
      ..color = Colors.black
      ..style = PaintingStyle.fill;

    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(offset.dx + s * 0.1, offset.dy + s * 0.1, s * 0.8, s * 0.8),
        const Radius.circular(2),
      ),
      strokePaint,
    );

    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(offset.dx + s * 0.3, offset.dy + s * 0.3, s * 0.4, s * 0.4),
        const Radius.circular(1.5),
      ),
      fillPaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
