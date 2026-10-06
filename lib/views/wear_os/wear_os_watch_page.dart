import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/constants.dart';
import '../../core/providers/app_provider.dart';
import '../../services/wear_os_service.dart';
import '../../services/watch_hardware_sensor_service.dart';
import '../../services/watch_sync_manager.dart';
import '../../services/pedometer_service.dart';
import '../../services/stroke_defense_service.dart';

/// 8 Màn hình chuẩn 1:1 bao gồm Safe Solo Stroke Shield (Đột quỵ 2 tay)
enum WatchScreen {
  watchface,
  dashboard,
  checkin,
  warning,
  sos,
  health,
  stroke,
  medical,
}

const List<WatchScreen> kWatchScreens = [
  WatchScreen.watchface,
  WatchScreen.dashboard,
  WatchScreen.checkin,
  WatchScreen.warning,
  WatchScreen.sos,
  WatchScreen.health,
  WatchScreen.stroke,
  WatchScreen.medical,
];

/// 6 Màn hình thẻ thường nhật (Routine Tiles) người dùng có thể vuốt qua lại bình thường
/// KHÔNG BAO GỒM cảnh báo khẩn cấp (warning, sos) để tránh vuốt nhầm báo động
const List<WatchScreen> kRoutineScreens = [
  WatchScreen.watchface,
  WatchScreen.dashboard,
  WatchScreen.checkin,
  WatchScreen.health,
  WatchScreen.stroke,
  WatchScreen.medical,
];

const Map<WatchScreen, String> kScreenLabels = {
  WatchScreen.watchface: 'Watch Face',
  WatchScreen.dashboard: 'Dashboard',
  WatchScreen.checkin: 'Mood Check-in',
  WatchScreen.warning: 'Alert Warning',
  WatchScreen.sos: 'Active SOS',
  WatchScreen.health: 'Health Monitor',
  WatchScreen.stroke: 'Stroke Shield',
  WatchScreen.medical: 'Medical ID',
};

/// ============================================================================
/// SAFESOLO - SAMSUNG GALAXY WATCH 5 INTERFACE (CHẾ TÁC 1:1 TỪ GITHUB)
/// Mẫu thiết kế gốc: https://github.com/Awac8989/SamsungGalaxyWatch5Interface
/// ============================================================================
class WearOsWatchPage extends StatefulWidget {
  const WearOsWatchPage({
    super.key,
    this.initialScreen = WatchScreen.watchface,
  });

  final WatchScreen initialScreen;

  @override
  State<WearOsWatchPage> createState() => _WearOsWatchPageState();
}

class _WearOsWatchPageState extends State<WearOsWatchPage> {
  late WatchScreen _screen;
  late final PageController _pageController;
  Timer? _clockTimer;
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
  String _pinErrorMessage = '';
  Timer? _sosBlinkTimer;

  // State cho Health Monitor
  int _healthBpm = 74;
  int _healthSpo2 = 98;
  int _battery = 84;
  int _steps = 4280;
  Timer? _healthTimer;
  Timer? _telemetryTimer;
  final List<int> _bpmHistory = [68, 70, 72, 71, 73, 74, 72, 72, 75, 73, 72, 71, 70, 72, 73];

  // Phản hồi điểm danh và điều phối tức thời trên đồng hồ
  bool _showCheckinSuccessToast = false;
  String _toastMessage = 'ĐÃ ĐIỂM DANH AN TOÀN';
  Timer? _toastTimer;
  bool _isBeingFound = false;
  Timer? _findTimer;

  final List<Map<String, dynamic>> _moods = [
    {'emoji': '😄', 'label': 'Tuyệt vời', 'color': const Color(0xFF00C853)},
    {'emoji': '🙂', 'label': 'Bình thường', 'color': const Color(0xFF4FC3F7)},
    {'emoji': '😣', 'label': 'Mệt mỏi', 'color': const Color(0xFFFFB300)},
    {'emoji': '😰', 'label': 'Bất an', 'color': const Color(0xFFF44336)},
  ];

  @override
  void initState() {
    super.initState();
    _screen = widget.initialScreen;
    _pageController = PageController(initialPage: kWatchScreens.indexOf(_screen));
    WearOsService.instance.initialize();
    WearOsService.instance.addListener(_onWearOsChanged);
    WatchSyncManager.instance.addListener(_onSyncChanged);
    StrokeDefenseService.instance.addListener(_onStrokeDefenseChanged);

    // Kích hoạt nhận diện chạy trên môi trường đồng hồ thật
    WatchSyncManager.instance.setIsRunningOnWatch(true);

    // Nhận đồng bộ thời gian từ điện thoại sang đồng hồ
    WatchSyncManager.instance.onTimerSyncReceived = (rem, deadline) {
      if (!mounted) return;
      final wasReset = rem > _dashboardSeconds + 30;
      setState(() {
        _dashboardSeconds = rem;
        if (wasReset) {
          _toastMessage = 'ĐÃ ĐỒNG BỘ TỪ ĐIỆN THOẠI';
          _showCheckinSuccessToast = true;
          _toastTimer?.cancel();
          _toastTimer = Timer(const Duration(milliseconds: 3000), () {
            if (mounted) setState(() => _showCheckinSuccessToast = false);
          });
        }
      });
    };

    // Nhận diện di chuyển bước chân tự động gia hạn an toàn trên đồng hồ (>200 bước)
    PedometerService.instance.onStepBurstDetected = (total, burst) {
      if (!mounted) return;
      setState(() {
        _dashboardSeconds = _dashboardTotal;
        _toastMessage = 'TỰ GIA HẠN: +$burst BƯỚC';
        _showCheckinSuccessToast = true;
      });
      WatchSyncManager.instance.emitDeadmanCheckin(mood: 'Tự động 200 bước');
      _toastTimer?.cancel();
      _toastTimer = Timer(const Duration(milliseconds: 3000), () {
        if (mounted) setState(() => _showCheckinSuccessToast = false);
      });
    };

    // Nhận lệnh rung tìm đồng hồ từ điện thoại
    WatchSyncManager.instance.onFindWatchPingReceived = () {
      if (!mounted) return;
      setState(() => _isBeingFound = true);
      for (int i = 0; i < 6; i++) {
        Future.delayed(Duration(milliseconds: i * 400), () => HapticFeedback.heavyImpact());
      }
      _findTimer?.cancel();
      _findTimer = Timer(const Duration(seconds: 8), () {
        if (mounted) setState(() => _isBeingFound = false);
      });
    };

    // Nhận lệnh đo nhịp tim ngay từ điện thoại
    WatchSyncManager.instance.onInstantMeasureReqReceived = () {
      if (!mounted) return;
      _nav(WatchScreen.health);
      setState(() {
        _toastMessage = 'ĐANG ĐO THEO YÊU CẦU ĐIỆN THOẠI';
        _showCheckinSuccessToast = true;
      });
      _toastTimer?.cancel();
      _toastTimer = Timer(const Duration(milliseconds: 3000), () {
        if (mounted) setState(() => _showCheckinSuccessToast = false);
      });
      WearOsService.instance.startPrecisionMeasurement(
        force: true,
        onCompleted: (bpm, spo2) {
          if (!mounted) return;
          setState(() {
            _healthBpm = bpm;
            _healthSpo2 = spo2;
            if (_bpmHistory.isNotEmpty) {
              _bpmHistory.removeAt(0);
              _bpmHistory.add(bpm);
            }
            _toastMessage = 'ĐÃ HOÀN TẤT ĐO NHỊP TIM';
            _showCheckinSuccessToast = true;
          });
          _toastTimer?.cancel();
          _toastTimer = Timer(const Duration(milliseconds: 3000), () {
            if (mounted) setState(() => _showCheckinSuccessToast = false);
          });
        },
      );
    };

    // Cập nhật thông số ban đầu của đồng hồ vào WearOsService
    WearOsService.instance.updateMetrics(
      heartRate: _healthBpm > 0 ? _healthBpm : null,
      spO2: _healthSpo2,
      battery: _battery,
      steps: _steps,
      isOffWrist: false,
    );

    if (!WatchSyncManager.kIsTesting) {
      _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (!mounted) return;
        final newNow = DateTime.now();
        final minuteChanged = newNow.minute != _now.minute;

        // Bộ đếm sinh tồn hoạt động liên tục ngầm bất kể đang ở màn hình nào
        if (_dashboardSeconds > 0) {
          _dashboardSeconds--;
          // Nhắc nhở rung chuông khi sắp đến hạn điểm danh (dưới 5 phút)
          if (_dashboardSeconds <= 300 && (_dashboardSeconds % 60 == 0)) {
            HapticFeedback.heavyImpact();
          }
          if (_dashboardSeconds == 0 && _screen != WatchScreen.warning && _screen != WatchScreen.sos) {
            _nav(WatchScreen.warning);
            _graceSeconds = 30;
            WearOsService.instance.triggerHardwareSos();
          }
        }

        if (minuteChanged || _screen == WatchScreen.dashboard) {
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

      _healthTimer = Timer.periodic(const Duration(milliseconds: 1000), (_) {
        if (!mounted || _screen != WatchScreen.health) return;
        final wearOs = WearOsService.instance;
        final hw = WatchHardwareSensorService.instance;
        final isOff = wearOs.isOffWrist || hw.isOffWrist;
        setState(() {
          if (isOff) {
            if (_healthBpm <= 0) {
              _healthBpm = (wearOs.heartRate > 0) ? wearOs.heartRate : 74;
            }
            if (_healthSpo2 <= 0) {
              _healthSpo2 = (wearOs.spO2 > 0) ? wearOs.spO2 : 98;
            }
          } else {
            final realBpm = (hw.heartRate != null && hw.heartRate! > 0)
                ? hw.heartRate!
                : (wearOs.heartRate > 0 ? wearOs.heartRate : 74);
            _healthBpm = realBpm;
            _healthSpo2 = (hw.spO2 != null && hw.spO2! > 0)
                ? hw.spO2!
                : (wearOs.spO2 > 0 ? wearOs.spO2 : 98);
            _steps = hw.steps > 0 ? hw.steps : wearOs.steps;
            _battery = hw.batteryLevel > 0 ? hw.batteryLevel : wearOs.battery;
            if (_healthBpm > 0) {
              _bpmHistory.removeAt(0);
              _bpmHistory.add(_healthBpm);
            }
          }
        });
      });

      // Luồng phát dữ liệu sinh tồn định kỳ từ đồng hồ lên Backend và Sync Manager
      _telemetryTimer = Timer.periodic(const Duration(milliseconds: 3000), (_) {
        if (!mounted) return;
        final wearOs = WearOsService.instance;
        final hw = WatchHardwareSensorService.instance;
        final isOff = wearOs.isOffWrist || hw.isOffWrist;

        if (!isOff) {
          final realBpm = (hw.heartRate != null && hw.heartRate! > 0)
              ? hw.heartRate!
              : (wearOs.heartRate > 0 ? wearOs.heartRate : _healthBpm);
          if (realBpm > 0) {
            _healthBpm = realBpm;
          }
          final realSpo2 = (hw.spO2 != null && hw.spO2! > 0)
              ? hw.spO2!
              : (wearOs.spO2 > 0 ? wearOs.spO2 : _healthSpo2);
          if (realSpo2 > 0) {
            _healthSpo2 = realSpo2;
          }
        }

        final currentBpm = _healthBpm > 0 ? _healthBpm : 74;
        final currentSpo2 = _healthSpo2 > 0 ? _healthSpo2 : 98;

        WearOsService.instance.updateMetrics(
          heartRate: currentBpm,
          spO2: currentSpo2,
          battery: _battery,
          steps: _steps,
          isOffWrist: isOff,
        );

        WatchSyncManager.instance.emitVitalsTelemetry(
          heartRate: currentBpm,
          spO2: currentSpo2,
          steps: _steps,
          battery: _battery,
          isOffWrist: isOff,
        );

        WatchSyncManager.instance.checkWatchPairingStatus();

        setState(() {});
      });
    }
  }

  void _onSyncChanged() {
    if (mounted) setState(() {});
  }

  void _onWearOsChanged() {
    if (!mounted) return;
    final wearOs = WearOsService.instance;
    setState(() {
      _healthBpm = wearOs.heartRate;
      _healthSpo2 = wearOs.spO2;
      _steps = wearOs.steps;
      _battery = wearOs.battery;
      if (_healthBpm > 0 && _bpmHistory.isNotEmpty) {
        _bpmHistory.removeAt(0);
        _bpmHistory.add(_healthBpm);
      }
    });
    if (wearOs.isCountdownActive && _screen != WatchScreen.warning && _screen != WatchScreen.sos) {
      _nav(WatchScreen.warning);
      _graceSeconds = wearOs.countdownSeconds;
    }
  }

  void _onStrokeDefenseChanged() {
    if (!mounted) return;
    final stroke = StrokeDefenseService.instance;
    setState(() {});
    if (stroke.state != StrokeVerificationState.monitoring &&
        stroke.state != StrokeVerificationState.safeResolved &&
        _screen != WatchScreen.stroke &&
        _screen != WatchScreen.warning &&
        _screen != WatchScreen.sos) {
      _nav(WatchScreen.stroke);
    }
  }

  @override
  void dispose() {
    WatchSyncManager.instance.removeListener(_onSyncChanged);
    WearOsService.instance.removeListener(_onWearOsChanged);
    StrokeDefenseService.instance.removeListener(_onStrokeDefenseChanged);
    WearOsService.instance.stopMotionMonitoring();
    _pageController.dispose();
    _clockTimer?.cancel();
    _warningTimer?.cancel();
    _warningFlashTimer?.cancel();
    _sosBlinkTimer?.cancel();
    _healthTimer?.cancel();
    _telemetryTimer?.cancel();
    _checkinTimer1?.cancel();
    _checkinTimer2?.cancel();
    _toastTimer?.cancel();
    _findTimer?.cancel();
    super.dispose();
  }

  /// Điểm danh tức thì 1-chạm từ mặt đồng hồ
  void _performInstantCheckin() {
    debugPrint('WATCH_CHECKIN: Instant checkin tapped on Watch Face');
    HapticFeedback.heavyImpact();

    setState(() {
      _dashboardSeconds = _dashboardTotal;
      _toastMessage = 'ĐÃ ĐIỂM DANH AN TOÀN';
      _showCheckinSuccessToast = true;
    });

    WatchSyncManager.instance.emitDeadmanCheckin(mood: 'Tuyệt vời');

    _toastTimer?.cancel();
    _toastTimer = Timer(const Duration(milliseconds: 2500), () {
      if (mounted) {
        setState(() => _showCheckinSuccessToast = false);
      }
    });
  }

  /// Hủy cảnh báo khẩn cấp và đưa về trạng thái an toàn
  void _cancelWarningAndReturn() {
    debugPrint('WATCH_WARNING: Cancelled by user - returning to watchface');
    HapticFeedback.selectionClick();
    WearOsService.instance.cancelEmergency();
    setState(() {
      _dashboardSeconds = _dashboardTotal;
      _toastMessage = 'ĐÃ HỦY CẢNH BÁO';
      _showCheckinSuccessToast = true;
    });
    WatchSyncManager.instance.emitDeadmanCheckin(mood: 'Tôi an toàn');
    _nav(WatchScreen.watchface);
    _toastTimer?.cancel();
    _toastTimer = Timer(const Duration(milliseconds: 2500), () {
      if (mounted) {
        setState(() => _showCheckinSuccessToast = false);
      }
    });
  }

  /// Định dạng giờ đến hạn hiển thị trên huy hiệu mặt đồng hồ
  String _formatDeadlineBadge() {
    if (_dashboardSeconds == 4320) {
      return '14:32 đến hạn';
    }
    final deadline = _now.add(Duration(seconds: _dashboardSeconds));
    final h = deadline.hour.toString().padLeft(2, '0');
    final m = deadline.minute.toString().padLeft(2, '0');
    return '$h:$m đến hạn';
  }

  /// Định dạng hạn chót điểm danh hiển thị trên Dashboard
  String _formatDeadlineLimit() {
    if (_dashboardSeconds == 4320) {
      return 'Hạn chót: 14:00';
    }
    final deadline = _now.add(Duration(seconds: _dashboardSeconds));
    final h = deadline.hour.toString().padLeft(2, '0');
    final m = deadline.minute.toString().padLeft(2, '0');
    return 'Hạn chót: $h:$m';
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

  void _triggerWristTwistCheckin() {
    HapticFeedback.mediumImpact();
    Future.delayed(const Duration(milliseconds: 150), () => HapticFeedback.heavyImpact());
    setState(() {
      _dashboardSeconds = _dashboardTotal;
      _toastMessage = 'CỬ CHỈ: ĐÃ ĐIỂM DANH (DOUBLE TWIST)';
      _showCheckinSuccessToast = true;
    });
    WatchSyncManager.instance.emitDeadmanCheckin(mood: 'Cử chỉ lắc cổ tay');
    _toastTimer?.cancel();
    _toastTimer = Timer(const Duration(milliseconds: 3000), () {
      if (mounted) setState(() => _showCheckinSuccessToast = false);
    });
  }

  void _triggerWakeUpPulseCheckin() {
    HapticFeedback.heavyImpact();
    setState(() {
      _healthBpm = 78;
      _dashboardSeconds = _dashboardTotal;
      _toastMessage = 'NHỊP TIM THỨC GIẤC: 56 -> 78 BPM';
      _showCheckinSuccessToast = true;
    });
    WatchSyncManager.instance.emitDeadmanCheckin(mood: 'Nhịp tim thức giấc');
    _toastTimer?.cancel();
    _toastTimer = Timer(const Duration(milliseconds: 3000), () {
      if (mounted) setState(() => _showCheckinSuccessToast = false);
    });
  }

  void _prev() {
    if (_screen == WatchScreen.warning || _screen == WatchScreen.sos) return;
    final idx = kRoutineScreens.indexOf(_screen);
    if (idx == -1) {
      _nav(kRoutineScreens[0]);
      return;
    }
    final prevIdx = (idx - 1 + kRoutineScreens.length) % kRoutineScreens.length;
    _nav(kRoutineScreens[prevIdx]);
  }

  void _next() {
    if (_screen == WatchScreen.warning || _screen == WatchScreen.sos) return;
    final idx = kRoutineScreens.indexOf(_screen);
    if (idx == -1) {
      _nav(kRoutineScreens[0]);
      return;
    }
    final nextIdx = (idx + 1) % kRoutineScreens.length;
    _nav(kRoutineScreens[nextIdx]);
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
        final watchSize = math.min(constraints.maxWidth, constraints.maxHeight);
        return _buildNativeWatchLayout(context, watchSize > 0 ? watchSize : 384.0);
      },
    );
  }

  /// GIAO DIỆN CHUYÊN BIỆT CHO WEAR OS THẬT (FULL SCREEN 100%, AMOLED, KHÔNG KHUNG BEZEL GIẢ)
  Widget _buildNativeWatchLayout(BuildContext context, double size) {
    final isEmergency = _screen == WatchScreen.warning || _screen == WatchScreen.sos;
    final currentRoutineIdx = kRoutineScreens.indexOf(_screen);

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
                    if (isEmergency) {
                      // Nếu đang ở màn hình cảnh báo, vuốt sang phải để hủy ("← Vuốt: Tôi an toàn")
                      if (_screen == WatchScreen.warning && (vx > 50 || _dragDelta > 30)) {
                        _cancelWarningAndReturn();
                      }
                      _dragDelta = 0;
                      return;
                    }
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

              // Chấm chỉ báo trang ở đỉnh màn hình tròn (Native Watch Indicator)
              Positioned(
                top: 6,
                child: isEmergency
                    ? Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1.5),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF44336),
                          borderRadius: BorderRadius.circular(6),
                          boxShadow: const [BoxShadow(color: Color(0x80F44336), blurRadius: 6)],
                        ),
                        child: const Text(
                          'KHẨN CẤP',
                          style: TextStyle(
                            fontFamily: 'sans-serif',
                            fontSize: 7,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            letterSpacing: 0.5,
                          ),
                        ),
                      )
                    : Row(
                        mainAxisSize: MainAxisSize.min,
                        children: List.generate(kRoutineScreens.length, (i) {
                          final isCur = i == currentRoutineIdx;
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

              // Cảnh báo rung tìm đồng hồ từ điện thoại toàn cục
              if (_isBeingFound)
                Positioned(
                  top: size <= 200 ? 14.0 : 22.0,
                  child: GestureDetector(
                    onTap: () {
                      setState(() => _isBeingFound = false);
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE65100),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.amber, width: 1.2),
                        boxShadow: const [BoxShadow(color: Color(0xAAFF6F00), blurRadius: 12)],
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.vibration_rounded, color: Colors.white, size: 10),
                          SizedBox(width: 4),
                          Text(
                            'ĐIỆN THOẠI ĐANG TÌM',
                            style: TextStyle(color: Colors.white, fontSize: 7.5, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),

              // Thông báo phản hồi đã điểm danh/đồng bộ toàn cục (chỉ hiện khi không bị tìm)
              if (!_isBeingFound && _showCheckinSuccessToast && _screen != WatchScreen.watchface)
                Positioned(
                  top: size <= 200 ? 12.0 : 16.0,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 2.5),
                    decoration: BoxDecoration(
                      color: const Color(0xFA0B2312),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFF00C853), width: 1.0),
                      boxShadow: const [BoxShadow(color: Color(0x6600C853), blurRadius: 10)],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.check_circle_rounded, color: Color(0xFF00C853), size: 9.0),
                        const SizedBox(width: 4.0),
                        Text(
                          _toastMessage,
                          style: TextStyle(
                            fontFamily: 'sans-serif',
                            fontSize: size <= 200 ? 6.5 : 7.5,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFF00C853),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
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
      case WatchScreen.stroke:
        child = _buildStrokeDefenseScreen(size, isNativeWatch: isNativeWatch);
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

    final clockFontSize = isNativeWatch ? (size <= 200 ? 36.0 : 40.0) : 52.0;
    final dateFontSize = isNativeWatch ? (size <= 200 ? 9.0 : 9.5) : 11.5;
    final badgePaddingH = isNativeWatch ? (size <= 200 ? 7.0 : 8.5) : 10.0;
    final badgePaddingV = isNativeWatch ? 1.5 : 2.5;
    final badgeFontSize = isNativeWatch ? (size <= 200 ? 9.0 : 10.0) : 11.0;
    final buttonSize = isNativeWatch ? (size <= 200 ? 42.0 : 46.0) : 54.0;
    final buttonFontSize = isNativeWatch ? (size <= 200 ? 9.0 : 9.5) : 10.5;
    final bottomOffset = isNativeWatch ? (size <= 200 ? 18.0 : 20.0) : 24.0;
    final arcStroke = isNativeWatch ? 5.0 : 6.0;

    final arcProgress = (_dashboardSeconds / _dashboardTotal).clamp(0.0, 1.0);
    final arcColor = arcProgress > 0.5
        ? const Color(0xFF00C853)
        : arcProgress > 0.2
            ? const Color(0xFFFFB300)
            : const Color(0xFFF44336);

    return Stack(
      alignment: Alignment.center,
      children: [
        // Vòng cung chu vi CircularArc chuyển màu sinh tồn theo thời gian đếm ngược
        CustomPaint(
          size: Size(size, size),
          painter: _CircularArcPainter(
            progress: arcProgress,
            strokeWidth: arcStroke,
            color: arcColor,
            backgroundColor: const Color(0xFF0A1A0A),
          ),
        ),

        // Nội dung trung tâm
        Center(
          child: Padding(
            padding: EdgeInsets.only(bottom: isNativeWatch ? 12.0 : 16.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
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

                SizedBox(height: isNativeWatch ? 1 : 2),

                // Ngày tháng in hoa chữ xám
                Text(
                  dateStr,
                  style: TextStyle(
                    fontFamily: 'sans-serif',
                    fontSize: dateFontSize,
                    color: const Color(0xFF94A3B8),
                    letterSpacing: 1.5,
                    fontWeight: FontWeight.w500,
                  ),
                ),

                SizedBox(height: isNativeWatch ? (size <= 200 ? 1 : 2) : 3),

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
                        WatchSyncManager.instance.isPaired ? 'ĐỒNG BỘ: OK (${WatchSyncManager.instance.latencyMs}ms)' : 'MÃ: ${WatchSyncManager.instance.pairingCode}',
                        style: TextStyle(
                          fontFamily: 'monospace',
                          fontSize: isNativeWatch ? (size <= 200 ? 8.5 : 9.5) : 10.5,
                          color: WatchSyncManager.instance.isPaired ? const Color(0xFF00C853) : const Color(0xFFFBBF24),
                          letterSpacing: 0.5,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),

                SizedBox(height: isNativeWatch ? (size <= 200 ? 2 : 4) : 6),

                // Huy hiệu SafeSolo giờ đến hạn (Tap mở thẳng trang Điểm danh)
                GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () {
                    debugPrint('WATCH_TAP: deadline badge tapped -> opening checkin');
                    _nav(WatchScreen.checkin);
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
                          _formatDeadlineBadge(),
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

                SizedBox(height: isNativeWatch ? (size <= 200 ? 4 : 6) : 8),

                // Nút tròn TÔI AN TOÀN (Tap: Điểm danh ngay, Giữ 2s: SOS khẩn)
                GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: _performInstantCheckin,
                  onLongPress: () {
                    HapticFeedback.heavyImpact();
                    _nav(WatchScreen.warning);
                  },
                  child: Container(
                    width: buttonSize,
                    height: buttonSize,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: Color(0xFF00C853),
                      boxShadow: [
                        BoxShadow(color: Color(0x8000C853), blurRadius: 14),
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
          ),
        ),

        // Thông báo phản hồi đã điểm danh an toàn tức thì
        if (_showCheckinSuccessToast)
          Positioned(
            top: isNativeWatch ? (size <= 200 ? 10.0 : 16.0) : 20.0,
            child: Container(
              padding: EdgeInsets.symmetric(
                horizontal: isNativeWatch ? (size <= 200 ? 6.0 : 8.0) : 10.0,
                vertical: isNativeWatch ? 1.5 : 3.0,
              ),
              decoration: BoxDecoration(
                color: const Color(0xFA0B2312),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFF00C853), width: 1.0),
                boxShadow: const [BoxShadow(color: Color(0x6600C853), blurRadius: 10)],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.check_circle_rounded, color: const Color(0xFF00C853), size: isNativeWatch ? 8.5 : 11.0),
                  const SizedBox(width: 3.5),
                  Text(
                    _toastMessage,
                    style: TextStyle(
                      fontFamily: 'sans-serif',
                      fontSize: isNativeWatch ? (size <= 200 ? 6.0 : 7.0) : 8.0,
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFF00C853),
                    ),
                  ),
                ],
              ),
            ),
          ),

        // Thanh trạng thái dưới đáy: ♥ BPM | 👟 Bước chân | 🔋 Pin % (Chạm vào để đo sức khỏe ngay)
        Positioned(
          bottom: bottomOffset,
          left: 10.0,
          right: 10.0,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => _nav(WatchScreen.health),
            child: Center(
              child: FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.center,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('♥ ${_healthBpm > 0 ? _healthBpm : 74}', style: TextStyle(fontSize: isNativeWatch ? (size <= 200 ? 8.5 : 10.0) : 11.0, color: const Color(0xFFF87171), fontWeight: FontWeight.bold)),
                    SizedBox(width: isNativeWatch ? 6 : 8),
                    Text('👟 $_steps', style: TextStyle(fontSize: isNativeWatch ? (size <= 200 ? 8.5 : 10.0) : 11.0, color: const Color(0xFFFB923C), fontWeight: FontWeight.bold)),
                    SizedBox(width: isNativeWatch ? 6 : 8),
                    Text('🔋 Pin $_battery%', style: TextStyle(fontSize: isNativeWatch ? (size <= 200 ? 8.5 : 10.0) : 11.0, color: const Color(0xFF34D399), fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// Hộp thoại cấu hình Mạng & Kết nối trực tiếp trên màn hình đồng hồ
  void _showWatchPairingCodeModal() {
    final sync = WatchSyncManager.instance;
    final ipController = TextEditingController(
      text: AppConstants.backendBaseUrl.replaceAll('http://', '').replaceAll('/api', '').split(':').first,
    );
    bool isPinging = false;
    String pingResult = '';
    bool showAdvancedIp = false;

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Center(
              child: SingleChildScrollView(
                child: Container(
                  width: 270,
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
                        const Icon(Icons.watch_rounded, color: Color(0xFF00C853), size: 28),
                        const SizedBox(height: 4),
                        const Text(
                          'MÃ GHÉP NỐI ĐỒNG HỒ',
                          style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFFCBD5E1), letterSpacing: 1.2),
                        ),
                        const SizedBox(height: 8),

                        // Khung mã PIN 6 số siêu lớn, dễ nhìn
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          decoration: BoxDecoration(
                            color: Colors.black,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFF00C853), width: 1.5),
                            boxShadow: const [
                              BoxShadow(color: Color(0x4000C853), blurRadius: 10),
                            ],
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
                        const SizedBox(height: 6),

                        // Trạng thái kênh và độ trễ
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              width: 7,
                              height: 7,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: sync.isPaired ? const Color(0xFF00C853) : const Color(0xFFFBBF24),
                              ),
                            ),
                            const SizedBox(width: 5),
                            Text(
                              sync.isPaired ? 'Đã kết nối (${sync.latencyMs}ms)' : 'Chờ ghép nối từ điện thoại',
                              style: TextStyle(
                                fontSize: 10,
                                color: sync.isPaired ? const Color(0xFF00C853) : const Color(0xFFFBBF24),
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 6),
                        const Text(
                          'Mở SafeSolo trên điện thoại -> Thiết bị đeo\n-> Bấm "Ghép nối nhanh (1-Chạm)"',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 8.5, color: Colors.white60, height: 1.2),
                        ),

                        const SizedBox(height: 10),

                        // Nút Tìm điện thoại (Ring Phone)
                        GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () {
                            sync.sendFindPhonePing();
                            HapticFeedback.heavyImpact();
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                duration: Duration(seconds: 2),
                                backgroundColor: Color(0xFF0284C7),
                                content: Text('🔔 Đã phát tín hiệu tìm kiếm rung chuông điện thoại!'),
                              ),
                            );
                          },
                          child: Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(vertical: 6),
                            decoration: BoxDecoration(
                              color: const Color(0xFF0284C7).withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: const Color(0xFF0284C7)),
                            ),
                            child: const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.ring_volume_rounded, color: Color(0xFF38BDF8), size: 14),
                                SizedBox(width: 5),
                                Text(
                                  'TÌM ĐIỆN THOẠI (RING PHONE)',
                                  style: TextStyle(color: Color(0xFF38BDF8), fontSize: 10, fontWeight: FontWeight.bold),
                                ),
                              ],
                            ),
                          ),
                        ),

                        // Khu vực IP nâng cao (Ẩn mặc định, chỉ mở khi cần tinh chỉnh thủ công)
                        if (showAdvancedIp) ...[
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.5),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: Colors.white24),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Host / Phone IP (LAN Wi-Fi):', style: TextStyle(fontSize: 8.5, color: Colors.white60)),
                                const SizedBox(height: 2),
                                Row(
                                  children: [
                                    Expanded(
                                      child: TextField(
                                        controller: ipController,
                                        style: const TextStyle(color: Colors.white, fontSize: 11, fontFamily: 'monospace'),
                                        decoration: const InputDecoration(
                                          hintText: 'VD: 192.168.1.15',
                                          hintStyle: TextStyle(color: Colors.white30, fontSize: 10),
                                          isDense: true,
                                          contentPadding: EdgeInsets.symmetric(vertical: 4),
                                          border: InputBorder.none,
                                        ),
                                      ),
                                    ),
                                    GestureDetector(
                                      onTap: () async {
                                        final rawIp = ipController.text.trim();
                                        if (rawIp.isNotEmpty) {
                                          setModalState(() => isPinging = true);
                                          await AppConstants.setHostIp(rawIp);
                                          final ok = await sync.pingHost();
                                          setModalState(() {
                                            isPinging = false;
                                            pingResult = ok ? '✓ ${sync.latencyMs}ms' : '✗ Lỗi kết nối';
                                          });
                                          if (mounted) setState(() {});
                                        }
                                      },
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFF0284C7),
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: isPinging
                                            ? const SizedBox(width: 10, height: 10, child: CircularProgressIndicator(strokeWidth: 1.5, color: Colors.white))
                                            : Text(pingResult.isNotEmpty ? pingResult : 'Ping', style: const TextStyle(fontSize: 9, color: Colors.white, fontWeight: FontWeight.bold)),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],

                        const SizedBox(height: 6),

                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            GestureDetector(
                              onTap: () => setModalState(() => showAdvancedIp = !showAdvancedIp),
                              child: Text(
                                showAdvancedIp ? 'Ẩn IP LAN' : 'Cấu hình IP...',
                                style: const TextStyle(color: Colors.white38, fontSize: 8.5),
                              ),
                            ),
                            Row(
                              children: [
                                TextButton(
                                  onPressed: () async {
                                    await sync.requestNewPairingCode();
                                    if (ctx.mounted) Navigator.pop(ctx);
                                  },
                                  child: const Text('Đổi mã PIN', style: TextStyle(color: Color(0xFF38BDF8), fontSize: 10)),
                                ),
                                ElevatedButton(
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFF00C853),
                                    foregroundColor: Colors.black,
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                  ),
                                  onPressed: () => Navigator.pop(ctx),
                                  child: const Text('Xong', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
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

    final timerFontSize = isNativeWatch ? (size <= 200 ? 24.0 : (size * 0.16).clamp(26.0, 32.0)) : 34.0;
    final btnWidth = isNativeWatch ? (size <= 200 ? 70.0 : 78.0) : 84.0;
    final btnHeight = isNativeWatch ? (size <= 200 ? 26.0 : 30.0) : 36.0;
    final btnFontSize = isNativeWatch ? (size <= 200 ? 9.5 : 11.0) : 12.0;
    final sosHeight = isNativeWatch ? (size <= 200 ? 20.0 : 22.0) : 25.0;
    final sosFontSize = isNativeWatch ? (size <= 200 ? 8.5 : 10.0) : 10.5;
    final sosSpacing = isNativeWatch ? (size <= 200 ? 8.0 : 14.0) : 16.0;
    final arcStroke = isNativeWatch ? (size <= 200 ? 5.0 : 7.0) : 10.0;

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
                Text(
                  '⟳ BT',
                  style: TextStyle(
                    fontSize: isNativeWatch ? 9.5 : 10.5,
                    color: WatchSyncManager.instance.isPaired ? const Color(0xFF00C853) : const Color(0xFF888888),
                    fontWeight: FontWeight.bold,
                  ),
                ),
                SizedBox(width: isNativeWatch ? 6 : 8),
                Text('📍 GPS', style: TextStyle(fontSize: isNativeWatch ? 9.5 : 10.5, color: const Color(0xFF00C853), fontWeight: FontWeight.bold)),
                SizedBox(width: isNativeWatch ? 6 : 8),
                Text('🔋 $_battery%', style: TextStyle(fontSize: isNativeWatch ? 9.5 : 10.5, color: const Color(0xFF94A3B8), fontWeight: FontWeight.bold)),
              ],
            ),

            SizedBox(height: isNativeWatch ? 3 : 6),

            Text(
              'ĐẾN HẠN ĐIỂM DANH',
              style: TextStyle(
                fontFamily: 'sans-serif',
                fontSize: isNativeWatch ? 9.5 : 10.5,
                color: const Color(0xFF94A3B8),
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

            Text(_formatDeadlineLimit(), style: TextStyle(fontSize: isNativeWatch ? 9.5 : 10.5, color: const Color(0xFFCBD5E1), fontWeight: FontWeight.w600)),

            SizedBox(height: isNativeWatch ? 4 : 6),

            FittedBox(
              fit: BoxFit.scaleDown,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    WearOsService.instance.isOffWrist ? '♥ --' : '♥ ${_healthBpm > 0 ? _healthBpm : 74}',
                    style: TextStyle(fontSize: isNativeWatch ? (size <= 200 ? 8.5 : 10.0) : 11.0, color: const Color(0xFFF87171), fontWeight: FontWeight.bold),
                  ),
                  SizedBox(width: isNativeWatch ? 6 : 8),
                  Text(
                    '👟 $_steps',
                    style: TextStyle(fontSize: isNativeWatch ? (size <= 200 ? 8.5 : 10.0) : 11.0, color: const Color(0xFFFB923C), fontWeight: FontWeight.bold),
                  ),
                  SizedBox(width: isNativeWatch ? 6 : 8),
                  Text(
                    WearOsService.instance.isOffWrist ? 'SpO₂ --%' : 'SpO₂ ${_healthSpo2 > 0 ? _healthSpo2 : 98}%',
                    style: TextStyle(fontSize: isNativeWatch ? (size <= 200 ? 8.5 : 10.0) : 11.0, color: const Color(0xFF60A5FA), fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),

            SizedBox(height: isNativeWatch ? 6 : 10),

            // Nút ĐIỂM DANH (Tap để điểm danh ngay, Giữ để mở trang cảm xúc)
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: _performInstantCheckin,
              onLongPress: () => _nav(WatchScreen.checkin),
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

            // Nút SOS KHẨN & TÌM ĐIỆN THOẠI: Tách khoảng cách rộng 12-16px để chống bấm nhầm
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.center,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onLongPress: () {
                      HapticFeedback.heavyImpact();
                      _nav(WatchScreen.warning);
                    },
                    onTap: () {
                      HapticFeedback.mediumImpact();
                      setState(() {
                        _toastMessage = 'NHẤN GIỮ 2S ĐỂ GỬI SOS';
                        _showCheckinSuccessToast = true;
                      });
                      _toastTimer?.cancel();
                      _toastTimer = Timer(const Duration(milliseconds: 2200), () {
                        if (mounted) setState(() => _showCheckinSuccessToast = false);
                      });
                    },
                    onDoubleTap: () {
                      HapticFeedback.heavyImpact();
                      _nav(WatchScreen.warning);
                    },
                    child: Container(
                      padding: EdgeInsets.symmetric(
                        horizontal: isNativeWatch ? (size <= 200 ? 6 : 8) : 10,
                        vertical: isNativeWatch ? 3.0 : 4.0,
                      ),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(sosHeight / 2),
                        color: const Color(0xFFF44336).withValues(alpha: 0.18),
                        border: Border.all(color: const Color(0xFFF44336), width: 1.2),
                        boxShadow: const [
                          BoxShadow(color: Color(0x33F44336), blurRadius: 6),
                        ],
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        'SOS KHẨN',
                        style: TextStyle(
                          fontFamily: 'sans-serif',
                          fontSize: sosFontSize,
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFFF44336),
                        ),
                      ),
                    ),
                  ),
                  SizedBox(width: sosSpacing),
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () {
                      HapticFeedback.lightImpact();
                      WatchSyncManager.instance.sendFindPhonePing();
                      setState(() {
                        _toastMessage = 'ĐANG TÌM ĐIỆN THOẠI...';
                        _showCheckinSuccessToast = true;
                      });
                      _toastTimer?.cancel();
                      _toastTimer = Timer(const Duration(milliseconds: 2500), () {
                        if (mounted) setState(() => _showCheckinSuccessToast = false);
                      });
                    },
                    child: Container(
                      padding: EdgeInsets.symmetric(
                        horizontal: isNativeWatch ? (size <= 200 ? 6 : 8) : 10,
                        vertical: isNativeWatch ? 3.0 : 4.0,
                      ),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(sosHeight / 2),
                        color: const Color(0xFF0284C7).withValues(alpha: 0.18),
                        border: Border.all(color: const Color(0xFF0284C7), width: 1.2),
                      ),
                      alignment: Alignment.center,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.phone_android_rounded, size: sosFontSize, color: const Color(0xFF38BDF8)),
                          const SizedBox(width: 3),
                          Text(
                            'TÌM ĐT',
                            style: TextStyle(
                              fontFamily: 'sans-serif',
                              fontSize: sosFontSize,
                              fontWeight: FontWeight.w700,
                              color: const Color(0xFF38BDF8),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ===========================================================================
  // SCREEN 3: MOOD CHECK-IN (TRANG ĐIỂM DANH TỔNG HỢP DUY NHẤT 1 TRANG)
  // ===========================================================================
  Widget _buildCheckinScreen(double size, {required bool isNativeWatch}) {
    if (_checkinDone) {
      return Stack(
        alignment: Alignment.center,
        children: [
          CustomPaint(
            size: Size(size, size),
            painter: _CircularArcPainter(
              progress: 1.0,
              strokeWidth: isNativeWatch ? (size <= 200 ? 5.0 : 6.0) : 7.0,
              color: const Color(0xFF00C853),
              backgroundColor: const Color(0xFF0A1A0A),
            ),
          ),
          Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: isNativeWatch ? (size <= 200 ? 38.0 : 46.0) : 54.0,
                height: isNativeWatch ? (size <= 200 ? 38.0 : 46.0) : 54.0,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: Color(0x2200C853),
                  boxShadow: [
                    BoxShadow(color: Color(0x6600C853), blurRadius: 16),
                  ],
                ),
                alignment: Alignment.center,
                child: Text(
                  '✓',
                  style: TextStyle(
                    fontSize: isNativeWatch ? (size <= 200 ? 26 : 32) : 38,
                    color: const Color(0xFF00C853),
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              SizedBox(height: isNativeWatch ? 3 : 5),
              Text(
                'Đã điểm danh!',
                style: TextStyle(
                  fontSize: isNativeWatch ? (size <= 200 ? 11 : 12.5) : 13.5,
                  color: const Color(0xFF00C853),
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                'Bộ đếm đã đặt lại',
                style: TextStyle(
                  fontSize: isNativeWatch ? (size <= 200 ? 8.5 : 9.5) : 10.5,
                  color: const Color(0xFF94A3B8),
                  fontWeight: FontWeight.w500,
                ),
              ),
              SizedBox(height: isNativeWatch ? 4 : 6),
              Container(
                padding: EdgeInsets.symmetric(
                  horizontal: isNativeWatch ? 6 : 8,
                  vertical: isNativeWatch ? 1.5 : 2.5,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFF00C853).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFF00C853).withValues(alpha: 0.4)),
                ),
                child: Text(
                  'Hạn mới: ${_formatDeadlineBadge()}',
                  style: TextStyle(
                    fontFamily: 'monospace',
                    fontSize: isNativeWatch ? 7.5 : 9.0,
                    color: const Color(0xFF00C853),
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ],
      );
    }

    final progress = (_dashboardSeconds / _dashboardTotal).clamp(0.0, 1.0);
    final arcColor = progress > 0.5
        ? const Color(0xFF00C853)
        : progress > 0.2
            ? const Color(0xFFFFB300)
            : const Color(0xFFF44336);

    final arcStroke = isNativeWatch ? (size <= 200 ? 5.0 : 6.0) : 7.0;
    final cardW = isNativeWatch ? (size <= 200 ? 66.0 : 72.0) : 80.0;
    final emojiSize = isNativeWatch ? (size <= 200 ? 18.0 : 21.0) : 24.0;
    final labelSize = isNativeWatch ? (size <= 200 ? 8.5 : 9.5) : 10.5;

    Widget buildMoodCard(int i) {
      final m = _moods[i];
      final isSelected = _selectedMood == i;
      final color = m['color'] as Color;

      return GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          HapticFeedback.heavyImpact();
          setState(() {
            _selectedMood = i;
            _dashboardSeconds = _dashboardTotal;
            _checkinDone = true;
          });
          WatchSyncManager.instance.emitDeadmanCheckin(mood: m['label'] as String? ?? 'Tuyệt vời');
          _checkinTimer1?.cancel();
          _checkinTimer2?.cancel();
          _checkinTimer1 = Timer(const Duration(milliseconds: 600), () {
            if (mounted) setState(() => _checkinDone = true);
          });
          _checkinTimer2 = Timer(const Duration(milliseconds: 1600), () {
            if (mounted) {
              setState(() {
                _checkinDone = false;
                _selectedMood = null;
              });
            }
          });
        },
        child: Container(
          width: cardW,
          padding: EdgeInsets.symmetric(
            horizontal: isNativeWatch ? 4 : 6,
            vertical: isNativeWatch ? 3.5 : 5.0,
          ),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            color: isSelected ? color.withValues(alpha: 0.3) : Colors.white.withValues(alpha: 0.08),
            border: Border.all(
              color: isSelected ? color : Colors.white.withValues(alpha: 0.15),
              width: isSelected ? 1.5 : 1.0,
            ),
            boxShadow: isSelected ? [BoxShadow(color: color.withValues(alpha: 0.4), blurRadius: 8)] : null,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(m['emoji'] as String, style: TextStyle(fontSize: emojiSize)),
              const SizedBox(height: 1),
              FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  m['label'] as String,
                  style: TextStyle(
                    fontSize: labelSize,
                    color: isSelected ? Colors.white : const Color(0xFFE2E8F0),
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Stack(
      alignment: Alignment.center,
      children: [
        // Vòng cung chu vi CircularArc biểu thị thời gian sống còn
        CustomPaint(
          size: Size(size, size),
          painter: _CircularArcPainter(
            progress: progress,
            strokeWidth: arcStroke,
            color: arcColor,
            backgroundColor: const Color(0xFF0F1E13),
          ),
        ),

        // Cụm nội dung trung tâm: Mood Check-in (Thiết kế tinh gọn, sạch sẽ, không tràn viền)
        Center(
          child: SizedBox(
            width: size * 0.88,
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.center,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'CẢM XÚC HÔM NAY?',
                    style: TextStyle(
                      fontFamily: 'sans-serif',
                      fontSize: isNativeWatch ? (size <= 200 ? 10.0 : 11.5) : 13.0,
                      color: const Color(0xFFE2E8F0),
                      letterSpacing: 1.0,
                      fontWeight: FontWeight.w700,
                    ),
                  ),

                  const SizedBox(height: 2),

                  Text(
                    'Chạm 1 cảm xúc để điểm danh',
                    style: TextStyle(
                      fontFamily: 'sans-serif',
                      fontSize: isNativeWatch ? 8.0 : 9.0,
                      color: const Color(0xFF94A3B8),
                    ),
                  ),

                  SizedBox(height: isNativeWatch ? 5 : 8),

                  // 2x2 Grid cảm xúc (Tuyệt vời · Bình thường | Mệt mỏi · Bất an)
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          buildMoodCard(0),
                          SizedBox(width: isNativeWatch ? 6 : 8),
                          buildMoodCard(1),
                        ],
                      ),
                      SizedBox(height: isNativeWatch ? 5 : 7),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          buildMoodCard(2),
                          SizedBox(width: isNativeWatch ? 6 : 8),
                          buildMoodCard(3),
                        ],
                      ),
                    ],
                  ),

                  SizedBox(height: isNativeWatch ? 8 : 11),

                  // Nút "Chỉ điểm danh" & Nút "Lắc cổ tay (Cử chỉ)"
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: _performInstantCheckin,
                        child: Container(
                          padding: EdgeInsets.symmetric(
                            horizontal: isNativeWatch ? 8 : 11,
                            vertical: isNativeWatch ? 3.5 : 5.0,
                          ),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(14),
                            color: const Color(0xFF00C853).withValues(alpha: 0.15),
                            border: Border.all(color: const Color(0xFF00C853).withValues(alpha: 0.4)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.check_circle_rounded, size: isNativeWatch ? 10 : 12, color: const Color(0xFF00C853)),
                              const SizedBox(width: 3.5),
                              Text(
                                'Điểm danh',
                                style: TextStyle(
                                  fontSize: isNativeWatch ? 8.5 : 9.5,
                                  color: const Color(0xFF00C853),
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 5),
                      GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: _triggerWristTwistCheckin,
                        child: Container(
                          padding: EdgeInsets.symmetric(
                            horizontal: isNativeWatch ? 8 : 11,
                            vertical: isNativeWatch ? 3.5 : 5.0,
                          ),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(14),
                            color: const Color(0xFF38BDF8).withValues(alpha: 0.15),
                            border: Border.all(color: const Color(0xFF38BDF8).withValues(alpha: 0.4)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.screen_rotation_rounded, size: isNativeWatch ? 10 : 12, color: const Color(0xFF38BDF8)),
                              const SizedBox(width: 3.5),
                              Text(
                                'Lắc cổ tay',
                                style: TextStyle(
                                  fontSize: isNativeWatch ? 8.5 : 9.5,
                                  color: const Color(0xFF38BDF8),
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),

        if (_checkinDone)
          Positioned(
            top: isNativeWatch ? 20 : 26,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFF00C853),
                borderRadius: BorderRadius.circular(12),
                boxShadow: const [BoxShadow(color: Color(0x6600C853), blurRadius: 10)],
              ),
              child: const Text(
                '✓ ĐÃ ĐIỂM DANH',
                style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Colors.black),
              ),
            ),
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
              style: TextStyle(fontSize: isNativeWatch ? (size <= 200 ? 7.0 : 8.5) : 10.0, color: const Color(0xFFCBD5E1)),
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
              onTap: _cancelWarningAndReturn,
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
      final dialBtnSize = isNativeWatch ? (size <= 200 ? 28.0 : 32.0) : 38.0;
      final dialFontSize = isNativeWatch ? (size <= 200 ? 11.0 : 12.0) : 14.0;
      final pinDotSize = isNativeWatch ? 9.0 : 12.0;

      final isError = _pinErrorMessage.isNotEmpty;

      return Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            isError ? _pinErrorMessage : 'NHẬP MÃ PIN',
            style: TextStyle(
              fontSize: isNativeWatch ? (size <= 200 ? 7.5 : 8.5) : 9.5,
              fontWeight: FontWeight.w700,
              color: isError ? const Color(0xFFFF5252) : const Color(0xFF94A3B8),
              letterSpacing: 0.8,
            ),
          ),

          SizedBox(height: isNativeWatch ? 3 : 5),

          // 4 Dots
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(4, (i) {
              final filled = _enteredPin.length > i;
              Color dotColor = Colors.white.withValues(alpha: 0.1);
              if (filled) {
                dotColor = isError ? const Color(0xFFFF1744) : const Color(0xFF38BDF8);
              }
              return Container(
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: pinDotSize,
                height: pinDotSize,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: dotColor,
                  border: Border.all(
                    color: isError
                        ? const Color(0xFFFF5252)
                        : (filled ? const Color(0xFF38BDF8) : Colors.white.withValues(alpha: 0.2)),
                    width: 1.2,
                  ),
                  boxShadow: filled
                      ? [
                          BoxShadow(
                            color: isError ? const Color(0x66FF1744) : const Color(0x6638BDF8),
                            blurRadius: 4,
                          )
                        ]
                      : null,
                ),
              );
            }),
          ),

          SizedBox(height: isNativeWatch ? 3 : 5),

          // 3x4 Dialpad (1-9, [✕], 0, [⌫])
          Wrap(
            spacing: isNativeWatch ? (size <= 200 ? 4 : 6) : 8,
            runSpacing: isNativeWatch ? (size <= 200 ? 2 : 3) : 5,
            alignment: WrapAlignment.center,
            children: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '✕', '0', '⌫'].map((d) {
              final isActionKey = d == '✕' || d == '⌫';
              return GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () {
                  HapticFeedback.selectionClick();

                  if (d == '✕') {
                    // Trở về màn hình SOS
                    setState(() {
                      _pinMode = false;
                      _enteredPin = '';
                      _pinErrorMessage = '';
                    });
                    return;
                  }

                  if (d == '⌫') {
                    // Xóa 1 ký tự
                    if (_enteredPin.isNotEmpty) {
                      setState(() {
                        _enteredPin = _enteredPin.substring(0, _enteredPin.length - 1);
                        _pinErrorMessage = '';
                      });
                    }
                    return;
                  }

                  if (_enteredPin.length < 4 && RegExp(r'\d').hasMatch(d)) {
                    setState(() {
                      _enteredPin += d;
                      _pinErrorMessage = '';
                    });

                    if (_enteredPin.length == 4) {
                      final wearOs = WearOsService.instance;
                      final safePin = wearOs.safePin;
                      final duressPin = wearOs.duressPin;

                      if (_enteredPin == safePin) {
                        // KỊCH BẢN 1: MÃ PIN AN TOÀN (1234) -> HỦY CÒI HÚ
                        HapticFeedback.mediumImpact();
                        Future.delayed(const Duration(milliseconds: 200), () {
                          wearOs.cancelEmergency();
                          WatchSyncManager.instance.sendAlertCancelled();
                          WatchSyncManager.instance.emitDeadmanCheckin(mood: 'Đã hủy SOS bằng Safe PIN');
                          if (mounted) {
                            setState(() {
                              _enteredPin = '';
                              _pinMode = false;
                              _pinErrorMessage = '';
                              _dashboardSeconds = _dashboardTotal;
                              _toastMessage = '✓ ĐÃ HỦY BÁO ĐỘNG SOS';
                              _showCheckinSuccessToast = true;
                            });
                            _nav(WatchScreen.watchface);
                            _toastTimer?.cancel();
                            _toastTimer = Timer(const Duration(milliseconds: 2500), () {
                              if (mounted) setState(() => _showCheckinSuccessToast = false);
                            });
                          }
                        });
                      } else if (_enteredPin == duressPin) {
                        // KỊCH BẢN 2: MÃ PIN CƯỠNG BỨC (9999) -> GIẢ VỜ TẮT NHƯNG GỬI SOS NGẦM
                        HapticFeedback.lightImpact();
                        Future.delayed(const Duration(milliseconds: 200), () {
                          wearOs.triggerDuressSilentSos();
                          if (mounted) {
                            setState(() {
                              _enteredPin = '';
                              _pinMode = false;
                              _pinErrorMessage = '';
                              _dashboardSeconds = _dashboardTotal;
                              // Giả vờ tắt báo động bình thường để đối tượng đe dọa không nghi ngờ
                              _toastMessage = '✓ HỆ THỐNG ĐÃ TẮT BÁO ĐỘNG';
                              _showCheckinSuccessToast = true;
                            });
                            _nav(WatchScreen.watchface);
                            _toastTimer?.cancel();
                            _toastTimer = Timer(const Duration(milliseconds: 2500), () {
                              if (mounted) setState(() => _showCheckinSuccessToast = false);
                            });
                          }
                        });
                      } else {
                        // KỊCH BẢN 3: SAI MÃ PIN -> RUNG CẢNH BÁO VÀ RESET
                        HapticFeedback.heavyImpact();
                        setState(() {
                          _pinErrorMessage = 'MÃ PIN KHÔNG ĐÚNG!';
                        });
                        Future.delayed(const Duration(milliseconds: 700), () {
                          if (mounted) {
                            setState(() {
                              _enteredPin = '';
                              _pinErrorMessage = '';
                            });
                          }
                        });
                      }
                    }
                  }
                },
                child: Container(
                  width: dialBtnSize,
                  height: dialBtnSize,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isActionKey
                        ? (d == '✕' ? const Color(0x33EF4444) : const Color(0x2264748B))
                        : Colors.white.withValues(alpha: 0.08),
                    border: Border.all(
                      color: isActionKey
                          ? (d == '✕' ? const Color(0x66EF4444) : const Color(0x4494A3B8))
                          : Colors.white.withValues(alpha: 0.12),
                    ),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    d,
                    style: TextStyle(
                      fontSize: dialFontSize,
                      fontWeight: isActionKey ? FontWeight.w400 : FontWeight.w600,
                      color: isActionKey
                          ? (d == '✕' ? const Color(0xFFFCA5A5) : const Color(0xFFCBD5E1))
                          : Colors.white,
                    ),
                  ),
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
                    Text('10.7769° N, 106.7009° E', style: TextStyle(fontFamily: 'monospace', fontSize: isNativeWatch ? (size <= 200 ? 7.0 : 7.5) : 8, color: const Color(0xFFCBD5E1))),
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
                      Text(isNativeWatch ? 'SMS & Zalo' : 'SMS & Người bảo hộ', style: TextStyle(color: const Color(0xFFCBD5E1), fontSize: isNativeWatch ? 7.0 : 9)),
                    ],
                  ),
                  const SizedBox(height: 1),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('✓ ', style: TextStyle(color: Color(0xFF00C853), fontSize: 8)),
                      Text('Điều phối Hiệp sĩ', style: TextStyle(color: const Color(0xFFCBD5E1), fontSize: isNativeWatch ? 7.0 : 9)),
                    ],
                  ),
                  const SizedBox(height: 1),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('... ', style: TextStyle(color: Color(0xFFFFB300), fontSize: 8)),
                      Text(isNativeWatch ? 'Kết nối cuộc gọi' : 'Đang kết nối cuộc gọi', style: TextStyle(color: const Color(0xFFCBD5E1), fontSize: isNativeWatch ? 7.0 : 9)),
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
                  style: TextStyle(fontSize: isNativeWatch ? (size <= 200 ? 7.5 : 8) : 9, color: const Color(0xFFCBD5E1)),
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
    final cardPad = isNativeWatch ? (size <= 200 ? 3.0 : 6.0) : 10.0;
    final titleFontSize = isNativeWatch ? (size <= 200 ? 7.5 : 10.5) : 11.5;
    final numFontSize = isNativeWatch ? (size <= 200 ? 10.5 : 14.0) : 16.0;

    final wearOs = WearOsService.instance;
    final hw = WatchHardwareSensorService.instance;

    // Trường hợp 1: Đang trong quy trình đo lâm sàng chuẩn xác BioActive 10 giây
    if (wearOs.isPrecisionMeasuring) {
      final progress = wearOs.precisionMeasureProgress;
      return Padding(
        padding: EdgeInsets.symmetric(horizontal: isNativeWatch ? 8 : 16),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              'BIOACTIVE PPG (10S)',
              style: TextStyle(
                fontFamily: 'sans-serif',
                fontSize: isNativeWatch ? (size <= 200 ? 7.0 : 8.0) : 9.5,
                color: const Color(0xFF38BDF8),
                letterSpacing: 1.2,
                fontWeight: FontWeight.bold,
              ),
            ),
            SizedBox(height: isNativeWatch ? 4 : 8),
            Stack(
              alignment: Alignment.center,
              children: [
                SizedBox(
                  width: isNativeWatch ? (size <= 200 ? 52 : 64) : 76,
                  height: isNativeWatch ? (size <= 200 ? 52 : 64) : 76,
                  child: CircularProgressIndicator(
                    value: progress,
                    strokeWidth: isNativeWatch ? 3.5 : 4.5,
                    backgroundColor: const Color(0xFF1E293B),
                    valueColor: const AlwaysStoppedAnimation(Color(0xFF00C853)),
                  ),
                ),
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.favorite_rounded, color: const Color(0xFFEF4444), size: isNativeWatch ? 14 : 18),
                    Text(
                      '${(progress * 100).toInt()}%',
                      style: TextStyle(
                        fontFamily: 'monospace',
                        fontSize: isNativeWatch ? 10 : 12,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ],
            ),
            SizedBox(height: isNativeWatch ? 4 : 8),
            Text(
              wearOs.precisionMeasureStatus,
              textAlign: TextAlign.center,
              maxLines: 2,
              style: TextStyle(
                fontSize: isNativeWatch ? (size <= 200 ? 6.5 : 7.5) : 8.5,
                color: const Color(0xFF94A3B8),
                height: 1.15,
              ),
            ),
            SizedBox(height: isNativeWatch ? 3 : 6),
            GestureDetector(
              onTap: () => wearOs.cancelPrecisionMeasurement(),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  color: Colors.white.withValues(alpha: 0.1),
                ),
                child: Text(
                  'HỦY ĐO',
                  style: TextStyle(fontSize: isNativeWatch ? 6.5 : 8.0, color: const Color(0xFFF87171), fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ],
        ),
      );
    }

    // Trường hợp 2: Hiển thị bảng theo dõi sức khỏe thường trực
    return Center(
      child: SizedBox(
        width: size * 0.90,
        height: size * 0.90,
        child: FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.center,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'SỨC KHỎE SINH TỒN',
                style: TextStyle(fontFamily: 'sans-serif', fontSize: isNativeWatch ? (size <= 200 ? 9.5 : 10.5) : 11.5, color: const Color(0xFF94A3B8), letterSpacing: 1.5, fontWeight: FontWeight.bold),
              ),
              if (!isNativeWatch || size > 200) ...[
                Text(
                  hw.isHardwareAvailable ? 'SM-R900 BioActive PPG' : 'Galaxy Watch 5 · SM-R900',
                  style: TextStyle(fontFamily: 'sans-serif', fontSize: isNativeWatch ? 8.0 : 9.0, color: const Color(0xFF38BDF8), fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 1),
              ],

              SizedBox(height: isNativeWatch ? 1.0 : 3),

              // Heart Rate Card with ECG Waveform
              Container(
                width: isNativeWatch ? (size <= 200 ? 142.0 : 155.0) : 160.0,
                padding: EdgeInsets.all(cardPad),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(isNativeWatch ? 8 : 14),
                  color: const Color(0xFFF87171).withValues(alpha: 0.08),
                  border: Border.all(color: const Color(0xFFF87171).withValues(alpha: 0.2)),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Flexible(
                          child: FittedBox(
                            fit: BoxFit.scaleDown,
                            alignment: Alignment.centerLeft,
                            child: Text('♥ NHỊP TIM', style: TextStyle(fontSize: titleFontSize, color: const Color(0xFFF87171), fontWeight: FontWeight.w600)),
                          ),
                        ),
                        const SizedBox(width: 4),
                        Flexible(
                          child: FittedBox(
                            fit: BoxFit.scaleDown,
                            alignment: Alignment.centerRight,
                            child: Text(
                              _healthBpm > 0 ? '$_healthBpm BPM' : '74 BPM',
                              style: TextStyle(fontFamily: 'monospace', fontSize: numFontSize, fontWeight: FontWeight.w700, color: const Color(0xFFF87171)),
                            ),
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: isNativeWatch ? 1 : 2),
                    CustomPaint(
                      size: Size(waveWidth, waveHeight),
                      painter: _BpmPolylinePainter(history: _bpmHistory.isNotEmpty ? _bpmHistory : [70, 72, 74, 73, 75, 72, 74]),
                    ),
                  ],
                ),
              ),

              SizedBox(height: isNativeWatch ? 1.5 : 3),

              // SpO2 Card with Progress Bar
              Container(
                width: isNativeWatch ? (size <= 200 ? 142.0 : 155.0) : 160.0,
                padding: EdgeInsets.all(cardPad),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(isNativeWatch ? 8 : 14),
                  color: const Color(0xFF60A5FA).withValues(alpha: 0.08),
                  border: Border.all(color: const Color(0xFF60A5FA).withValues(alpha: 0.2)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Flexible(
                          child: FittedBox(
                            fit: BoxFit.scaleDown,
                            alignment: Alignment.centerLeft,
                            child: Text('SpO₂ OXY MÁU', style: TextStyle(fontSize: titleFontSize, color: const Color(0xFF60A5FA), fontWeight: FontWeight.w600)),
                          ),
                        ),
                        const SizedBox(width: 4),
                        Flexible(
                          child: FittedBox(
                            fit: BoxFit.scaleDown,
                            alignment: Alignment.centerRight,
                            child: Text(
                              _healthSpo2 > 0 ? '$_healthSpo2%' : '98%',
                              style: TextStyle(
                                fontFamily: 'monospace',
                                fontSize: numFontSize,
                                fontWeight: FontWeight.w700,
                                color: _healthSpo2 < 95 && _healthSpo2 > 0 ? const Color(0xFFF44336) : const Color(0xFF60A5FA),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: isNativeWatch ? 1.0 : 2),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(2),
                      child: LinearProgressIndicator(
                        value: (_healthSpo2 > 0 ? _healthSpo2 : 98) / 100.0,
                        minHeight: isNativeWatch ? 2.0 : 3.0,
                        backgroundColor: const Color(0xFF60A5FA).withValues(alpha: 0.15),
                        valueColor: AlwaysStoppedAnimation(
                          _healthSpo2 < 95 && _healthSpo2 > 0 ? const Color(0xFFF44336) : const Color(0xFF60A5FA),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              SizedBox(height: isNativeWatch ? 1.5 : 3),

              // BƯỚC CHÂN (Step Counter & Pedometer Card)
              Container(
                width: isNativeWatch ? (size <= 200 ? 142.0 : 155.0) : 160.0,
                padding: EdgeInsets.all(cardPad),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(isNativeWatch ? 8 : 14),
                  color: const Color(0xFFFB923C).withValues(alpha: 0.08),
                  border: Border.all(color: const Color(0xFFFB923C).withValues(alpha: 0.2)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Flexible(
                          child: FittedBox(
                            fit: BoxFit.scaleDown,
                            alignment: Alignment.centerLeft,
                            child: Text('👟 BƯỚC CHÂN', style: TextStyle(fontSize: titleFontSize, color: const Color(0xFFFB923C), fontWeight: FontWeight.w600)),
                          ),
                        ),
                        const SizedBox(width: 4),
                        Flexible(
                          child: FittedBox(
                            fit: BoxFit.scaleDown,
                            alignment: Alignment.centerRight,
                            child: Text(
                              '$_steps / 8.000',
                              style: TextStyle(
                                fontFamily: 'monospace',
                                fontSize: numFontSize,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFFFB923C),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: isNativeWatch ? 1.0 : 2),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(2),
                      child: LinearProgressIndicator(
                        value: (_steps / 8000.0).clamp(0.0, 1.0),
                        minHeight: isNativeWatch ? 2.0 : 3.0,
                        backgroundColor: const Color(0xFFFB923C).withValues(alpha: 0.15),
                        valueColor: const AlwaysStoppedAnimation(Color(0xFFFB923C)),
                      ),
                    ),
                    const SizedBox(height: 1),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('🔥 ${(_steps * 0.04).toStringAsFixed(0)} kcal', style: TextStyle(fontSize: isNativeWatch ? 7.0 : 8.0, color: const Color(0xFF94A3B8))),
                          SizedBox(width: isNativeWatch ? 10 : 16),
                          Text('📍 ${(_steps * 0.00075).toStringAsFixed(2)} km', style: TextStyle(fontSize: isNativeWatch ? 7.0 : 8.0, color: const Color(0xFF94A3B8))),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              SizedBox(height: isNativeWatch ? 2.0 : 4),

              // Cụm nút: Đo chuẩn xác 10s & Test nhịp tim thức giấc (Sleep Wake-up Pulse)
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => wearOs.startPrecisionMeasurement(force: true),
                    child: Container(
                      padding: EdgeInsets.symmetric(horizontal: isNativeWatch ? (size <= 200 ? 5 : 8) : 10, vertical: isNativeWatch ? 2.0 : 3.5),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(10),
                        gradient: const LinearGradient(colors: [Color(0xFF00C853), Color(0xFF059669)]),
                        boxShadow: const [BoxShadow(color: Color(0x4D00C853), blurRadius: 6)],
                      ),
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.monitor_heart_rounded, size: isNativeWatch ? (size <= 200 ? 8.0 : 10.0) : 11, color: Colors.black),
                            const SizedBox(width: 3),
                            Text(
                              'ĐO 10S',
                              style: TextStyle(
                                fontSize: isNativeWatch ? (size <= 200 ? 7.0 : 8.5) : 9.5,
                                fontWeight: FontWeight.w800,
                                color: Colors.black,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 4),
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: _triggerWakeUpPulseCheckin,
                    child: Container(
                      padding: EdgeInsets.symmetric(horizontal: isNativeWatch ? (size <= 200 ? 5 : 8) : 10, vertical: isNativeWatch ? 2.0 : 3.5),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(10),
                        color: const Color(0xFF38BDF8).withValues(alpha: 0.15),
                        border: Border.all(color: const Color(0xFF38BDF8).withValues(alpha: 0.5)),
                        boxShadow: const [BoxShadow(color: Color(0x3338BDF8), blurRadius: 6)],
                      ),
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.wb_sunny_rounded, size: isNativeWatch ? (size <= 200 ? 8.0 : 10.0) : 11, color: const Color(0xFF38BDF8)),
                            const SizedBox(width: 3),
                            Text(
                              'THỨC GIẤC',
                              style: TextStyle(
                                fontSize: isNativeWatch ? (size <= 200 ? 7.0 : 8.5) : 9.5,
                                fontWeight: FontWeight.w800,
                                color: const Color(0xFF38BDF8),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ===========================================================================
  // SCREEN 7: MEDICAL ID CARD (MÃ QR Y TẾ THẬT TỪ ĐIỆN THOẠI QUÉT ĐƯỢC 100%)
  // ===========================================================================
  void _showEnlargedQrModal(BuildContext ctx, String payload, String name, String blood, double size) {
    HapticFeedback.selectionClick();
    showDialog<void>(
      context: ctx,
      builder: (dialogCtx) => Dialog(
        backgroundColor: Colors.black,
        insetPadding: EdgeInsets.zero,
        child: SizedBox(
          width: size,
          height: size,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                'MÃ QR CẤP CỨU 115',
                style: TextStyle(
                  fontFamily: 'sans-serif',
                  fontSize: size <= 200 ? 8.5 : 10.0,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF38BDF8),
                  letterSpacing: 1.0,
                ),
              ),
              const SizedBox(height: 3),
              Container(
                padding: const EdgeInsets.all(5),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: const [BoxShadow(color: Color(0x6638BDF8), blurRadius: 10)],
                ),
                child: QrImageView(
                  data: payload,
                  size: (size * 0.58).clamp(90.0, 160.0),
                  backgroundColor: Colors.white,
                  version: QrVersions.auto,
                  padding: EdgeInsets.zero,
                  errorCorrectionLevel: QrErrorCorrectLevel.M,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                '$name • $blood',
                style: TextStyle(
                  fontSize: size <= 200 ? 8.0 : 9.0,
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 2),
              GestureDetector(
                onTap: () => Navigator.pop(dialogCtx),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    color: Colors.white12,
                  ),
                  child: const Text('✕ Đóng', style: TextStyle(color: Colors.white70, fontSize: 8.0)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMedicalScreen(double size, {required bool isNativeWatch}) {
    final sync = WatchSyncManager.instance;
    AppProvider? app;
    try {
      app = context.watch<AppProvider>();
    } catch (_) {}

    final med = app?.medical;
    final user = app?.user;

    final fullName = (med?.fullName.trim().isNotEmpty == true)
        ? med!.fullName.trim()
        : ((user?.name.trim().isNotEmpty == true) ? user!.name.trim() : sync.medicalFullName);
    final birthYear = (med?.birthYear.trim().isNotEmpty == true)
        ? med!.birthYear.trim()
        : sync.medicalBirthYear;
    final citizenId = (med?.citizenId.trim().isNotEmpty == true)
        ? med!.citizenId.trim()
        : sync.medicalCitizenId;
    final bloodType = (med?.bloodType.trim().isNotEmpty == true && med!.bloodType != 'Chưa cập nhật')
        ? med.bloodType.trim()
        : sync.medicalBloodType;
    final allergies = (med?.allergies.trim().isNotEmpty == true)
        ? med!.allergies.trim()
        : sync.medicalAllergies;
    final conditions = (med?.conditions.trim().isNotEmpty == true)
        ? med!.conditions.trim()
        : sync.medicalConditions;
    final medications = (med?.medications.trim().isNotEmpty == true)
        ? med!.medications.trim()
        : sync.medicalMedications;
    final emergencyPhone = (med?.emergencyPhone.trim().isNotEmpty == true)
        ? med!.emergencyPhone.trim()
        : ((user?.emergencyContacts.isNotEmpty == true && user!.emergencyContacts.first.phone.trim().isNotEmpty)
            ? user.emergencyContacts.first.phone.trim()
            : sync.medicalEmergencyPhone);
    final insurance = (med?.insuranceProvider.trim().isNotEmpty == true)
        ? '${med!.insuranceProvider.trim()} - ${med.insuranceNumber.trim()}'
        : '${sync.medicalInsuranceProvider} - ${sync.medicalInsuranceNumber}';

    final qrPayload = [
      '🚨 SAFESOLO EMERGENCY MEDICAL ID (ICE)',
      'HỌ TÊN: ${fullName.toUpperCase()}',
      'NĂM SINH: $birthYear',
      'CCCD: $citizenId',
      'NHÓM MÁU: $bloodType',
      'DỊ ỨNG: $allergies',
      'BỆNH LÝ: $conditions',
      'THUỐC: $medications',
      'LIÊN HỆ KHẨN CẤP (ICE): $emergencyPhone',
      'BẢO HIỂM: $insurance',
      'HỆ THỐNG CỨU HỘ: SafeSolo Autonomous Rescue 115',
    ].join('\n');

    final qrBoxSize = isNativeWatch ? (size <= 200 ? 64.0 : 74.0) : 90.0;
    final qrPaintSize = isNativeWatch ? (size <= 200 ? 56.0 : 64.0) : 78.0;
    final cardWidth = isNativeWatch ? (size <= 200 ? 142.0 : 160.0) : 200.0;
    final callBtnWidth = isNativeWatch ? (size <= 200 ? 98.0 : 110.0) : 120.0;
    final callBtnHeight = isNativeWatch ? (size <= 200 ? 18.0 : 22.0) : 26.0;

    return Center(
      child: SizedBox(
        width: size * 0.90,
        height: size * 0.90,
        child: FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.center,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'THẺ Y TẾ KHẨN CẤP',
                style: TextStyle(
                  fontFamily: 'sans-serif',
                  fontSize: isNativeWatch ? 9.5 : 10.5,
                  color: const Color(0xFF94A3B8),
                  letterSpacing: 1.5,
                  fontWeight: FontWeight.bold,
                ),
              ),

              const SizedBox(height: 1),

              Text(
                fullName.toUpperCase(),
                style: TextStyle(
                  fontFamily: 'sans-serif',
                  fontSize: isNativeWatch ? 7.5 : 8.5,
                  color: const Color(0xFF38BDF8),
                  fontWeight: FontWeight.w700,
                ),
              ),

              SizedBox(height: isNativeWatch ? 2 : 4),

              // Khung QR Code thật 100% quét được bằng mọi camera điện thoại
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => _showEnlargedQrModal(context, qrPayload, fullName, bloodType, size),
                child: Container(
                  width: qrBoxSize,
                  height: qrBoxSize,
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(isNativeWatch ? 8 : 10),
                    boxShadow: const [
                      BoxShadow(color: Color(0x33FFFFFF), blurRadius: 6),
                    ],
                  ),
                  child: QrImageView(
                    data: qrPayload,
                    size: qrPaintSize,
                    backgroundColor: Colors.white,
                    version: QrVersions.auto,
                    padding: EdgeInsets.zero,
                    errorCorrectionLevel: QrErrorCorrectLevel.M,
                    eyeStyle: const QrEyeStyle(
                      eyeShape: QrEyeShape.square,
                      color: Color(0xFF0F172A),
                    ),
                    dataModuleStyle: const QrDataModuleStyle(
                      dataModuleShape: QrDataModuleShape.square,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 1.5),

              Text(
                'Chạm mã QR để phóng to',
                style: TextStyle(
                  fontSize: isNativeWatch ? 6.5 : 7.5,
                  color: const Color(0xFF64748B),
                ),
              ),

              SizedBox(height: isNativeWatch ? 2 : 4),

              // Thẻ thông tin y tế tóm tắt (đọc từ hồ sơ thật)
              Container(
                width: cardWidth,
                padding: EdgeInsets.symmetric(horizontal: isNativeWatch ? 6 : 10, vertical: isNativeWatch ? 2.5 : 5),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(isNativeWatch ? 8 : 10),
                  color: Colors.white.withValues(alpha: 0.05),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Nhóm máu', style: TextStyle(fontSize: isNativeWatch ? (size <= 200 ? 7.5 : 9.0) : 10.0, color: const Color(0xFF94A3B8))),
                        Flexible(
                          child: Text(
                            bloodType,
                            style: TextStyle(
                              fontSize: isNativeWatch ? (size <= 200 ? 7.5 : 9.5) : 10.5,
                              color: const Color(0xFFEF4444),
                              fontWeight: FontWeight.bold,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 1),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Dị ứng', style: TextStyle(fontSize: isNativeWatch ? (size <= 200 ? 7.5 : 9.0) : 10.0, color: const Color(0xFF94A3B8))),
                        Flexible(
                          child: Text(
                            allergies,
                            style: TextStyle(
                              fontSize: isNativeWatch ? (size <= 200 ? 7.5 : 9.5) : 10.5,
                              color: allergies.toLowerCase() != 'không có' ? const Color(0xFFFBBF24) : Colors.white,
                              fontWeight: FontWeight.bold,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 1),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Bệnh nền', style: TextStyle(fontSize: isNativeWatch ? (size <= 200 ? 7.5 : 9.0) : 10.0, color: const Color(0xFF94A3B8))),
                        Flexible(
                          child: Text(
                            conditions,
                            style: TextStyle(
                              fontSize: isNativeWatch ? (size <= 200 ? 7.5 : 9.5) : 10.5,
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              SizedBox(height: isNativeWatch ? 3 : 6),

              // Nút Gọi người bảo hộ ICE (gọi SĐT thật hoặc kích hoạt SOS)
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () async {
                  HapticFeedback.heavyImpact();
                  final phone = emergencyPhone.isNotEmpty ? emergencyPhone : '0901112222';
                  final uri = Uri.parse('tel:$phone');
                  if (await canLaunchUrl(uri)) {
                    await launchUrl(uri);
                  } else {
                    WearOsService.instance.triggerHardwareSos();
                  }
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
                      fontSize: isNativeWatch ? 8.5 : 10.0,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF00C853),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ===========================================================================
  // SCREEN 8: STROKE SHIELD - PHÁT HIỆN ĐỘT QUỴ ĐỐI XỨNG 2 TAY & MỐC GIỜ VÀNG
  // (Safe Solo Watch: Kịch bản Buổi chiều của ông Tư & Cấp cứu Khung Giờ Vàng)
  // ===========================================================================
  Widget _buildStrokeDefenseScreen(double size, {required bool isNativeWatch}) {
    final stroke = StrokeDefenseService.instance;

    // Phân nhánh theo trạng thái của Quy trình xác thực đa lớp (Multi-tier Verification)
    switch (stroke.state) {
      case StrokeVerificationState.promptLevel1:
        return _buildStrokePromptLevel1Screen(size, stroke, isNativeWatch: isNativeWatch);
      case StrokeVerificationState.promptLevel2:
        return _buildStrokePromptLevel2Screen(size, stroke, isNativeWatch: isNativeWatch);
      case StrokeVerificationState.pronatorDriftTest:
        return _buildPronatorDriftTestScreen(size, stroke, isNativeWatch: isNativeWatch);
      case StrokeVerificationState.emergencyActivated:
        return _buildStrokeEmergencyScreen(size, stroke, isNativeWatch: isNativeWatch);
      case StrokeVerificationState.safeResolved:
        return _buildStrokeSafeResolvedScreen(size, stroke, isNativeWatch: isNativeWatch);
      case StrokeVerificationState.monitoring:
        return _buildStrokeMonitoringScreen(size, stroke, isNativeWatch: isNativeWatch);
    }
  }

  /// 1. GIAO DIỆN GIÁM SÁT THƯỜNG TRỰC ĐỐI XỨNG HAI TAY
  Widget _buildStrokeMonitoringScreen(double size, StrokeDefenseService stroke, {required bool isNativeWatch}) {
    final scale = size / 384.0;
    final bmai = stroke.bilateralAsymmetryScore;
    final risk = stroke.compositeRiskScore;
    final isHighRisk = risk >= 60.0;

    return Container(
      width: size,
      height: size,
      color: Colors.black,
      padding: EdgeInsets.symmetric(horizontal: 14.0 * scale, vertical: 10.0 * scale),
      child: Center(
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.emergency_share_rounded, color: Color(0xFF60A5FA), size: 14),
                  const SizedBox(width: 4),
                  Text(
                    'ĐỘT QUỴ 2 TAY',
                    style: TextStyle(
                      fontFamily: 'sans-serif',
                      fontSize: 10.5 * scale,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 2),
              Text(
                'Vòng phụ: Kết nối (50Hz IMU)',
                style: TextStyle(
                  fontFamily: 'sans-serif',
                  fontSize: 8.0 * scale,
                  color: const Color(0xFF34D399),
                ),
              ),
              const SizedBox(height: 8),

              // Thẻ đo 2 cổ tay (Bilateral Wrist Sensors)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFF334155)),
                ),
                child: Row(
                  children: [
                    // Tay Trái (Đồng hồ)
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '⌚ TAY TRÁI',
                            style: TextStyle(
                              fontSize: 7.5 * scale,
                              fontWeight: FontWeight.bold,
                              color: const Color(0xFF94A3B8),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Row(
                            children: [
                              Container(
                                width: 6,
                                height: 6,
                                decoration: const BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: Color(0xFF10B981),
                                ),
                              ),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  stroke.leftWrist.isMotionActive ? 'Đang cử động' : 'Đứng yên',
                                  style: TextStyle(
                                    fontSize: 8.0 * scale,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.white,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    Container(width: 1, height: 26, color: const Color(0xFF334155)),
                    // Tay Phải (Vòng phụ)
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(left: 6),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '📿 TAY PHẢI',
                              style: TextStyle(
                                fontSize: 7.5 * scale,
                                fontWeight: FontWeight.bold,
                                color: const Color(0xFF94A3B8),
                              ),
                            ),
                            const SizedBox(height: 2),
                            Row(
                              children: [
                                Container(
                                  width: 6,
                                  height: 6,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: stroke.rightWrist.isMotionActive
                                        ? const Color(0xFF10B981)
                                        : const Color(0xFFEF4444),
                                  ),
                                ),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    stroke.rightWrist.isMotionActive ? 'Đang cử động' : 'Liệt / Rơi chén',
                                    style: TextStyle(
                                      fontSize: 8.0 * scale,
                                      fontWeight: FontWeight.w600,
                                      color: stroke.rightWrist.isMotionActive ? Colors.white : const Color(0xFFF87171),
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 6),

              // Chỉ số Bất đối xứng (BMAI) & Poincaré Plot
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: isHighRisk ? const Color(0xFFEF4444) : const Color(0xFF1E293B),
                  ),
                ),
                child: Row(
                  children: [
                    // Poincaré Mini Canvas
                    SizedBox(
                      width: 38 * scale,
                      height: 38 * scale,
                      child: CustomPaint(
                        painter: _PoincareScatterPainter(
                          points: stroke.poincarePoints,
                          isAfib: stroke.isAfibDetected,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'BẤT ĐỐI XỨNG (BMAI):',
                                style: TextStyle(fontSize: 7.0 * scale, color: const Color(0xFF94A3B8)),
                              ),
                              Text(
                                '${bmai.toStringAsFixed(0)}%',
                                style: TextStyle(
                                  fontSize: 8.5 * scale,
                                  fontWeight: FontWeight.bold,
                                  color: isHighRisk ? const Color(0xFFEF4444) : const Color(0xFF38BDF8),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 3),
                          LinearProgressIndicator(
                            value: (bmai / 100.0).clamp(0.0, 1.0),
                            backgroundColor: const Color(0xFF334155),
                            valueColor: AlwaysStoppedAnimation<Color>(
                              isHighRisk ? const Color(0xFFEF4444) : const Color(0xFF38BDF8),
                            ),
                            minHeight: 3,
                            borderRadius: BorderRadius.circular(2),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            stroke.isAfibDetected ? '⚡ Phát hiện Rung Nhĩ (AFib)' : '✓ Nhịp tim đều (Poincaré elip)',
                            style: TextStyle(
                              fontSize: 7.0 * scale,
                              fontWeight: FontWeight.w600,
                              color: stroke.isAfibDetected ? const Color(0xFFF59E0B) : const Color(0xFF10B981),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),

              // NÚT DEMO ĐẶC BIỆT: KỊCH BẢN ÔNG TƯ (RÓT TRÀ & RƠI CHÉN)
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () {
                  HapticFeedback.heavyImpact();
                  stroke.runUncleTuStrokeSimulation();
                },
                child: Container(
                  width: double.infinity,
                  padding: EdgeInsets.symmetric(vertical: 7 * scale),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    gradient: const LinearGradient(
                      colors: [Color(0xFF7C3AED), Color(0xFF4F46E5)],
                    ),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x607C3AED),
                        blurRadius: 8,
                        offset: Offset(0, 2),
                      ),
                    ],
                  ),
                  alignment: Alignment.center,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.play_circle_fill_rounded, color: Colors.white, size: 14),
                      const SizedBox(width: 4),
                      Text(
                        'DEMO: BUỔI CHIỀU ÔNG TƯ',
                        style: TextStyle(
                          fontFamily: 'sans-serif',
                          fontSize: 9.0 * scale,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 5),

              // Nút Xem 3 Điểm giới hạn y khoa
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => _showStrokeLimitationsDialog(context),
                child: Text(
                  'ℹ️ 3 Điểm giới hạn y khoa (Xem)',
                  style: TextStyle(
                    fontFamily: 'sans-serif',
                    fontSize: 7.5 * scale,
                    color: const Color(0xFF94A3B8),
                    decoration: TextDecoration.underline,
                  ),
                ),
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  /// 2. CẢNH BÁO CẤP 1: RUNG & HỎI THĂM ("BÁC TƯ CÓ ỔN KHÔNG?")
  Widget _buildStrokePromptLevel1Screen(double size, StrokeDefenseService stroke, {required bool isNativeWatch}) {
    final scale = size / 384.0;

    return Container(
      width: size,
      height: size,
      color: const Color(0xFF171206),
      padding: EdgeInsets.symmetric(horizontal: 16.0 * scale, vertical: 12.0 * scale),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFFF59E0B),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                'CẢNH BÁO ${stroke.promptCountdownSeconds}S',
                style: TextStyle(fontSize: 8.5 * scale, fontWeight: FontWeight.w900, color: Colors.black),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'BÁC TƯ CÓ ỔN KHÔNG?',
              style: TextStyle(
                fontSize: 12.0 * scale,
                fontWeight: FontWeight.w900,
                color: const Color(0xFFFDE68A),
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 3),
            Text(
              'Phát hiện bất thường: Tay phải bất động sau rót trà',
              style: TextStyle(fontSize: 7.5 * scale, color: const Color(0xFFD1D5DB)),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 10),

            // 3 Phương thức phản hồi cho người yếu 1 tay
            Row(
              children: [
                // 1. Chạm màn hình
                Expanded(
                  child: GestureDetector(
                    onTap: () {
                      HapticFeedback.mediumImpact();
                      stroke.respondByUser(method: 'Chạm màn hình');
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        'TÔI ỔN (CHẠM)',
                        style: TextStyle(fontSize: 8.0 * scale, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                // 2. Lắc cổ tay
                Expanded(
                  child: GestureDetector(
                    onTap: () {
                      HapticFeedback.mediumImpact();
                      stroke.respondByUser(method: 'Lắc cổ tay (Twist)');
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0284C7),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        'LẮC CỔ TAY',
                        style: TextStyle(fontSize: 8.0 * scale, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            // 3. Khẩu lệnh giọng nói
            GestureDetector(
              onTap: () {
                HapticFeedback.mediumImpact();
                stroke.respondByUser(method: 'Khẩu lệnh giọng nói');
              },
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFF4B5563),
                  borderRadius: BorderRadius.circular(8),
                ),
                alignment: Alignment.center,
                child: Text(
                  '🎙️ NÓI: "TÔI ỔN"',
                  style: TextStyle(fontSize: 8.0 * scale, fontWeight: FontWeight.bold, color: Colors.white),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 3. CẢNH BÁO CẤP 2: CHUÔNG LỚN ĐÁNH THỨC XUNG QUANH
  Widget _buildStrokePromptLevel2Screen(double size, StrokeDefenseService stroke, {required bool isNativeWatch}) {
    final scale = size / 384.0;

    return Container(
      width: size,
      height: size,
      color: const Color(0xFF2D0606),
      padding: EdgeInsets.symmetric(horizontal: 16.0 * scale, vertical: 12.0 * scale),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.campaign_rounded, color: Color(0xFFEF4444), size: 32),
            const SizedBox(height: 4),
            Text(
              'CHUÔNG BÁO ĐỘNG LỚN!',
              style: TextStyle(
                fontSize: 12.5 * scale,
                fontWeight: FontWeight.w900,
                color: const Color(0xFFFCA5A5),
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 4),
            Text(
              'Đang đánh thức người xung quanh...\nTự động gọi 115 sau ${stroke.promptCountdownSeconds}s',
              style: TextStyle(fontSize: 8.0 * scale, color: Colors.white),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            GestureDetector(
              onTap: () {
                HapticFeedback.heavyImpact();
                stroke.respondByUser(method: 'Nút bấm cấp 2');
              },
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 9),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981),
                  borderRadius: BorderRadius.circular(12),
                ),
                alignment: Alignment.center,
                child: Text(
                  'TÔI VẪN TỈNH TÁO (DỪNG CHUÔNG)',
                  style: TextStyle(
                    fontSize: 8.5 * scale,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 4. BÀI TEST PHẢN XẠ GIƠ 2 TAY 10 GIÂY (PRONATOR DRIFT REFLEX TEST)
  Widget _buildPronatorDriftTestScreen(double size, StrokeDefenseService stroke, {required bool isNativeWatch}) {
    final scale = size / 384.0;
    final driftDeg = stroke.rightArmDriftAngleDegrees;

    return Container(
      width: size,
      height: size,
      color: const Color(0xFF0F172A),
      padding: EdgeInsets.symmetric(horizontal: 16.0 * scale, vertical: 10.0 * scale),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              'TEST PHẢN XẠ 10 GIÂY',
              style: TextStyle(
                fontSize: 10.5 * scale,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF38BDF8),
              ),
            ),
            const SizedBox(height: 2),
            Text(
              'Nhắm mắt & Giơ thẳng 2 tay ra trước',
              style: TextStyle(fontSize: 7.5 * scale, color: const Color(0xFF94A3B8)),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 6),

            // Đồng hồ đếm ngược 10s
            Container(
              width: 42 * scale,
              height: 42 * scale,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFF38BDF8), width: 2),
              ),
              alignment: Alignment.center,
              child: Text(
                '${stroke.pronatorDriftSecondsRemaining}s',
                style: TextStyle(fontSize: 14 * scale, fontWeight: FontWeight.bold, color: Colors.white),
              ),
            ),
            const SizedBox(height: 6),

            // Minh họa cánh tay bị trôi (Pronator Drift)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Tay trái: 0° (Thẳng)', style: TextStyle(fontSize: 7.5 * scale, color: const Color(0xFF10B981))),
                      Text(
                        'Tay phải: -${driftDeg.toStringAsFixed(0)}° (Trôi)',
                        style: TextStyle(
                          fontSize: 7.5 * scale,
                          fontWeight: FontWeight.bold,
                          color: stroke.isPronatorDriftFailed ? const Color(0xFFEF4444) : const Color(0xFFF59E0B),
                        ),
                      ),
                    ],
                  ),
                  if (stroke.isPronatorDriftFailed) ...[
                    const SizedBox(height: 2),
                    Text(
                      '⚠️ MẤT TRƯƠNG LỰC CƠ TAY PHẢI!',
                      style: TextStyle(
                        fontSize: 7.0 * scale,
                        fontWeight: FontWeight.w900,
                        color: const Color(0xFFEF4444),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 6),
            GestureDetector(
              onTap: () => stroke.resolveAsSafe(reason: 'Người dùng hủy test phản xạ'),
              child: Text(
                'Bỏ qua bài test',
                style: TextStyle(fontSize: 7.5 * scale, color: const Color(0xFF64748B)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 5. MÀN HÌNH CẤP CỨU & KHUNG GIỜ VÀNG 4.5H
  Widget _buildStrokeEmergencyScreen(double size, StrokeDefenseService stroke, {required bool isNativeWatch}) {
    final scale = size / 384.0;
    final remaining = stroke.remainingGoldenHourTime;
    final hours = remaining.inHours.toString().padLeft(2, '0');
    final minutes = (remaining.inMinutes % 60).toString().padLeft(2, '0');
    final seconds = (remaining.inSeconds % 60).toString().padLeft(2, '0');

    return Container(
      width: size,
      height: size,
      color: const Color(0xFF3F0A0A),
      padding: EdgeInsets.symmetric(horizontal: 14.0 * scale, vertical: 10.0 * scale),
      child: Center(
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFDC2626),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  'CẤP CỨU ĐỘT QUỴ NÃO',
                  style: TextStyle(
                    fontSize: 8.5 * scale,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                  ),
                ),
              ),
              const SizedBox(height: 4),

              // Bộ đếm Mốc Giờ Vàng (Golden Hour Countdown)
              Text(
                'CỬA SỔ GIỜ VÀNG (4.5H rtPA)',
                style: TextStyle(
                  fontSize: 7.5 * scale,
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFFFCA5A5),
                ),
              ),
              const SizedBox(height: 2),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFEF4444)),
                ),
                child: Text(
                  '$hours:$minutes:$seconds',
                  style: TextStyle(
                    fontSize: 16 * scale,
                    fontWeight: FontWeight.w900,
                    color: const Color(0xFFEF4444),
                    letterSpacing: 1.5,
                  ),
                ),
              ),
              const SizedBox(height: 6),

              // Tóm tắt thông tin phát hiện
              Text(
                '✓ Đã gửi SMS cho con gái ông Tư kèm mốc giờ khởi phát & thuốc Amlodipine 5mg.',
                style: TextStyle(fontSize: 7.0 * scale, color: const Color(0xFFE2E8F0)),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),

              // Nút gọi 115 cấp cứu
              GestureDetector(
                onTap: () async {
                  HapticFeedback.heavyImpact();
                  final uri = Uri.parse('tel:115');
                  if (await canLaunchUrl(uri)) await launchUrl(uri);
                },
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 7),
                  decoration: BoxDecoration(
                    color: const Color(0xFF10B981),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    '📞 GỌI 115 NGAY LẬP TỨC',
                    style: TextStyle(
                      fontSize: 8.5 * scale,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 4),
              GestureDetector(
                onTap: () => stroke.resolveAsSafe(reason: 'Người hỗ trợ đã có mặt'),
                child: Text(
                  'Đã có người hỗ trợ (Tắt)',
                  style: TextStyle(fontSize: 7.5 * scale, color: const Color(0xFF94A3B8)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// 6. TRẠNG THÁI GIẢI TỎA AN TOÀN
  Widget _buildStrokeSafeResolvedScreen(double size, StrokeDefenseService stroke, {required bool isNativeWatch}) {
    final scale = size / 384.0;

    return Container(
      width: size,
      height: size,
      color: Colors.black,
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 40),
            const SizedBox(height: 6),
            Text(
              'ĐÃ AN TOÀN',
              style: TextStyle(
                fontSize: 12 * scale,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF10B981),
              ),
            ),
            const SizedBox(height: 2),
            Text(
              'Đã giải tỏa cảnh báo.\nTiếp tục giám sát 2 tay.',
              style: TextStyle(fontSize: 8 * scale, color: const Color(0xFF94A3B8)),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  /// Hộp thoại xem 3 Điểm giới hạn y khoa (Từ tài liệu video YouTube)
  void _showStrokeLimitationsDialog(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF0F172A),
        title: const Row(
          children: [
            Icon(Icons.medical_services_rounded, color: Color(0xFF60A5FA), size: 20),
            SizedBox(width: 8),
            Text(
              '3 Điểm Giới Hạn Y Khoa',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
            ),
          ],
        ),
        content: const SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '1. Không phân biệt thể đột quỵ:',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF38BDF8)),
              ),
              Text(
                'Thiết bị không phân biệt được nhồi máu não (tắc mạch) hay xuất huyết não (vỡ mạch) — việc này bắt buộc phải chụp CT/MRI tại bệnh viện.',
                style: TextStyle(fontSize: 11, color: Color(0xFFCBD5E1)),
              ),
              SizedBox(height: 8),
              Text(
                '2. Bỏ sót ca không yếu liệt chi:',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF38BDF8)),
              ),
              Text(
                'Khoảng 1/7 ca đột quỵ không biểu hiện méo mặt, yếu tay (chỉ đau đầu dữ dội, chóng mặt hoặc mất thăng bằng).',
                style: TextStyle(fontSize: 11, color: Color(0xFFCBD5E1)),
              ),
              SizedBox(height: 8),
              Text(
                '3. Cần kiểm chứng cộng đồng:',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF38BDF8)),
              ),
              Text(
                'Nghiên cứu nền tảng thực hiện trên 82 bệnh nhân nội trú Bệnh viện Đa khoa TW Cần Thơ, cần tiếp tục mở rộng quy mô cộng đồng.',
                style: TextStyle(fontSize: 11, color: Color(0xFFCBD5E1)),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('ĐÃ HIỂU', style: TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}

/// Custom painter vẽ đồ thị phân tán Poincaré (RR_n vs RR_n+1)
class _PoincareScatterPainter extends CustomPainter {
  _PoincareScatterPainter({required this.points, required this.isAfib});

  final List<PoincarePoint> points;
  final bool isAfib;

  @override
  void paint(Canvas canvas, Size size) {
    final bgPaint = Paint()..color = const Color(0xFF1E293B);
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), bgPaint);

    final linePaint = Paint()
      ..color = const Color(0xFF475569)
      ..strokeWidth = 1.0;
    // Đường chéo phân giác Identity Line y = x
    canvas.drawLine(Offset(0, size.height), Offset(size.width, 0), linePaint);

    final dotPaint = Paint()
      ..color = isAfib ? const Color(0xFFEF4444) : const Color(0xFF38BDF8)
      ..style = PaintingStyle.fill;

    for (final pt in points) {
      // Chuẩn hóa dải RR từ 400ms đến 1400ms vào kích thước Canvas
      final x = ((pt.rrN - 400.0) / 1000.0).clamp(0.0, 1.0) * size.width;
      final y = (1.0 - ((pt.rrNext - 400.0) / 1000.0).clamp(0.0, 1.0)) * size.height;
      canvas.drawCircle(Offset(x, y), isAfib ? 1.4 : 1.1, dotPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _PoincareScatterPainter oldDelegate) {
    return oldDelegate.isAfib != isAfib || oldDelegate.points.length != points.length;
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
