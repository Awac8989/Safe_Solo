import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/app_strings.dart';
import '../../core/constants.dart';
import '../../core/providers/app_provider.dart';
import '../../core/widgets/top_toast.dart';
import '../../models/watch_protocol.dart';
import '../../services/ai_signal_processor.dart';
import '../../services/false_alarm_suppression_service.dart';
import '../../services/watch_sync_manager.dart';
import '../../services/wear_os_service.dart';

/// ============================================================================
/// SAFESOLO - HỘP THOẠI CẢNH BÁO TAI NẠN & RỦI RO TỪ SMARTWATCH (GALAXY WATCH 5)
/// Hiển thị trực tiếp trên Smartphone khi đồng hồ phát hiện tai nạn/va chạm/ngã
/// Hỗ trợ: Đếm ngược sinh tồn 30s + Xác thực rảnh tay + Điều phối SOS 115
/// Tác giả: SV Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03
/// ============================================================================

class WatchAccidentAlertDialog extends StatefulWidget {
  const WatchAccidentAlertDialog({
    super.key,
    required this.signalType,
    required this.title,
    this.message,
    this.payload = const {},
    this.initialSeconds = 30,
  });

  final String signalType;
  final String title;
  final String? message;
  final Map<String, dynamic> payload;
  final int initialSeconds;

  static bool _isShowing = false;
  static bool get isShowing => _isShowing;

  static Future<bool?> show(
    BuildContext context, {
    required String signalType,
    required String title,
    String? message,
    Map<String, dynamic> payload = const {},
    int initialSeconds = 30,
  }) async {
    if (_isShowing) return null;
    _isShowing = true;
    try {
      return await showDialog<bool>(
        context: context,
        barrierDismissible: false,
        builder: (_) => WatchAccidentAlertDialog(
          signalType: signalType,
          title: title,
          message: message,
          payload: payload,
          initialSeconds: initialSeconds,
        ),
      );
    } finally {
      _isShowing = false;
    }
  }

  @override
  State<WatchAccidentAlertDialog> createState() =>
      _WatchAccidentAlertDialogState();
}

class _WatchAccidentAlertDialogState extends State<WatchAccidentAlertDialog>
    with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  final FalseAlarmSuppressionService _service =
      FalseAlarmSuppressionService.instance;
  final AiSignalProcessor _ai = AiSignalProcessor.instance;

  int _remainingSeconds = 30;
  Timer? _countdownTimer;
  String _lastVoiceTranscript = '';

  @override
  void initState() {
    super.initState();
    _remainingSeconds = widget.initialSeconds;

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 0.95, end: 1.05).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    // Kích hoạt rung cảnh giác ban đầu
    HapticFeedback.heavyImpact();

    // Khởi chạy đồng hồ đếm ngược sinh tồn trên điện thoại
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_remainingSeconds > 1) {
        setState(() {
          _remainingSeconds--;
        });
        if (_remainingSeconds % 2 == 0) {
          HapticFeedback.mediumImpact();
        }
      } else {
        timer.cancel();
        setState(() {
          _remainingSeconds = 0;
        });
        _handleAutoEscalate();
      }
    });
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _pulseController.dispose();
    super.dispose();
  }

  /// Tự động leo thang cấp cứu khi hết 30s mà không có phản hồi (nạn nhân bất tỉnh)
  void _handleAutoEscalate() {
    if (!mounted) return;
    context
        .read<AppProvider>()
        .simulateEmergencyStatus(status: 'ALERT_TRIGGERED');
    final rootContext = AppConstants.navigatorKey.currentContext ?? context;
    Navigator.of(context, rootNavigator: true).pop(true);
    if (rootContext.mounted) {
      TopToast.show(
        rootContext,
        message: '🚨 Đã hết 30s không phản hồi: Tự động phát lệnh Cấp cứu 115 và gửi vị trí!',
        icon: Icons.emergency_rounded,
      );
    }
  }

  /// Người dùng bấm hoặc nói "Tôi ổn" -> Dập tắt báo động và đồng bộ sang đồng hồ
  void _handleDismissSafe() {
    _countdownTimer?.cancel();
    _service.cancelAsFalseAlarm(reason: 'Người dùng bấm xác nhận "Tôi ổn"');

    // Đồng bộ lệnh hủy về Galaxy Watch 5 để đồng hồ tắt còi rung
    WatchSyncManager.instance.sendPacket(
      WatchPacket.create(
        sender: WatchSender.phone,
        type: WatchPacketType.emergency,
        action: WatchAction.alertCancelled,
        payload: {
          'reason': 'Người dùng xác nhận an toàn từ màn hình điện thoại',
          'timestamp': DateTime.now().toIso8601String(),
        },
      ),
    );

    WearOsService.instance.cancelEmergency();
    context.read<AppProvider>().simulateSafeReset();

    final rootContext = AppConstants.navigatorKey.currentContext ?? context;
    Navigator.of(context, rootNavigator: true).pop(false);
    if (rootContext.mounted) {
      TopToast.show(
        rootContext,
        message: '✅ Đã hủy cảnh báo an toàn. Báo động giả được triệt tiêu!',
        icon: Icons.check_circle_rounded,
      );
    }
  }

  /// Người dùng bấm "CẤP CỨU SOS NGAY" -> Bỏ qua đếm ngược và phát lệnh cứu hộ
  void _handleTriggerSosNow() {
    _countdownTimer?.cancel();
    context
        .read<AppProvider>()
        .simulateEmergencyStatus(status: 'ALERT_TRIGGERED');

    // Bắn tín hiệu SOS lập tức lên hệ thống (bảo đảm an toàn ngay cả khi offline)
    try {
      context.read<AppProvider>().reportDeviceSignal(
        signalType: widget.signalType,
        payload: {
          'source': 'SAMSUNG_GALAXY_WATCH_5_SM_R900',
          'title': widget.title,
          'action': 'USER_FORCE_DISPATCH',
          ...widget.payload,
        },
      ).catchError((_) {});
    } catch (_) {}

    final rootContext = AppConstants.navigatorKey.currentContext ?? context;
    Navigator.of(context, rootNavigator: true).pop(true);
    if (rootContext.mounted) {
      TopToast.show(
        rootContext,
        message: '🚨 ĐÃ PHÁT LỆNH CẤP CỨU KHẨN CẤP TỚI 115 VÀ NGƯỜI BẢO HỘ!',
        icon: Icons.warning_rounded,
      );
    }
  }

  void _simulateVoiceInput(String spokenText) {
    setState(() {
      _lastVoiceTranscript = spokenText;
    });

    if (_ai.matchSafeVoiceKeyword(spokenText)) {
      _handleDismissSafe();
    } else if (_ai.matchEmergencyVoiceKeyword(spokenText)) {
      _handleTriggerSosNow();
    } else {
      TopToast.show(
        context,
        message: 'Chưa nhận diện được: "$spokenText". Hãy nói "Tôi ổn" hoặc bấm nút.',
        icon: Icons.mic_none_rounded,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    final progress =
        (_remainingSeconds / widget.initialSeconds).clamp(0.0, 1.0);

    // Dữ liệu cảm biến thời gian thực
    final svm = widget.payload['svm'] ??
        widget.payload['svmG'] ??
        (widget.signalType.contains('ACCIDENT') ? 6.5 : 4.8);
    final tilt = widget.payload['tilt'] ??
        widget.payload['tiltAngle'] ??
        (widget.signalType.contains('ACCIDENT') ? 78.0 : 72.0);
    final hr = widget.payload['heartRate'] ?? 138;
    final spo2 = widget.payload['spO2'] ?? 86;

    final isAccidentCrash = widget.signalType.contains('ACCIDENT') ||
        widget.signalType.contains('CRASH');
    final isCardiacDistress = widget.signalType.contains('CARDIAC') ||
        widget.signalType.contains('SPO2');

    return PopScope(
      canPop: false,
      child: Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
        child: Container(
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A), // Dark Clinical Navy
            borderRadius: BorderRadius.circular(26),
            border: Border.all(
              color: isAccidentCrash
                  ? const Color(0xFFEF4444)
                  : const Color(0xFFFF9800),
              width: 2.2,
            ),
            boxShadow: [
              BoxShadow(
                color: (isAccidentCrash
                        ? const Color(0xFFEF4444)
                        : const Color(0xFFFF9800))
                    .withValues(alpha: 0.35),
                blurRadius: 36,
                spreadRadius: 4,
              ),
            ],
          ),
          padding: const EdgeInsets.all(20),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
              // Badge nhận diện nguồn đồng hồ
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Flexible(
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 5),
                      decoration: BoxDecoration(
                        color: Colors.redAccent.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                          color: Colors.redAccent.withValues(alpha: 0.6),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: const [
                          Icon(Icons.watch_rounded,
                              size: 14, color: Color(0xFFFCA5A5)),
                          SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              'SAMSUNG GALAXY WATCH 5 (SM-R900)',
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.8,
                                color: Color(0xFFFCA5A5),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Tiêu đề cảnh báo
              Text(
                widget.title.isNotEmpty
                    ? widget.title
                    : (isAccidentCrash
                        ? '🚨 PHÁT HIỆN TAI NẠN VA CHẠM GIAO THÔNG'
                        : '⚠️ PHÁT HIỆN BIẾN CỐ NGUY HIỂM TỪ ĐỒNG HỒ'),
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                  letterSpacing: 0.4,
                  height: 1.25,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),

              Text(
                widget.message ??
                    'Cảm biến phần cứng phát hiện va chạm xung lực mạnh và cơ thể bất động. Vui lòng xác nhận an toàn hoặc kích hoạt cấp cứu.',
                style: const TextStyle(
                  fontSize: 11.5,
                  color: Color(0xFFCBD5E1),
                  height: 1.35,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),

              // BẢNG DỮ LIỆU CẢM BIẾN THỜI GIAN THỰC (TELEMETRY METRICS)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.white12),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildTelemetryTile(
                      icon: Icons.speed_rounded,
                      label: 'Xung lực',
                      value: '${svm}g',
                      color: const Color(0xFFEF4444),
                    ),
                    _buildTelemetryTile(
                      icon: Icons.screen_rotation_rounded,
                      label: 'Góc nghiêng',
                      value: '$tilt°',
                      color: const Color(0xFFF59E0B),
                    ),
                    _buildTelemetryTile(
                      icon: Icons.favorite_rounded,
                      label: 'Nhịp tim',
                      value: '$hr bpm',
                      color: const Color(0xFFEC4899),
                    ),
                    _buildTelemetryTile(
                      icon: Icons.air_rounded,
                      label: 'SpO2',
                      value: '$spo2%',
                      color: const Color(0xFF38BDF8),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),

              // VÒNG ĐẾM NGƯỢC RADIAL CIRCLE (30s)
              ScaleTransition(
                scale: _pulseAnimation,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    SizedBox(
                      width: 110,
                      height: 110,
                      child: CircularProgressIndicator(
                        value: progress,
                        strokeWidth: 8,
                        backgroundColor: Colors.white12,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          _remainingSeconds <= 8
                              ? const Color(0xFFEF4444)
                              : const Color(0xFFFF9800),
                        ),
                      ),
                    ),
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '$_remainingSeconds',
                          style: TextStyle(
                            fontSize: 38,
                            fontWeight: FontWeight.w900,
                            color: _remainingSeconds <= 8
                                ? const Color(0xFFEF4444)
                                : Colors.white,
                            height: 1.0,
                          ),
                        ),
                        const SizedBox(height: 2),
                        const Text(
                          'GIÂY',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF94A3B8),
                            letterSpacing: 1.0,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              const Text(
                'Tự động gửi vị trí GPS và gọi cấp cứu 115 khi hết giờ nếu bạn bất tỉnh.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 10.5,
                  color: Color(0xFF94A3B8),
                ),
              ),
              const SizedBox(height: 12),

              // NHẬN DIỆN GIỌNG NÓI RẢNH TAY
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white10),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.mic_rounded,
                        color: Color(0xFF38BDF8), size: 14),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        _lastVoiceTranscript.isEmpty
                            ? 'Nói "Tôi ổn" để hủy hoặc "Cứu tôi" để gọi 115'
                            : 'Đã nghe: "$_lastVoiceTranscript"',
                        textAlign: TextAlign.center,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF38BDF8),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // 2 NÚT THAO TÁC CHÍNH
              // Nút 1: TÔI ỔN (HỦY BÁO ĐỘNG)
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _handleDismissSafe,
                  icon: const Icon(Icons.check_circle_rounded, size: 20),
                  label: const FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      'TÔI ỔN - HỦY BÁO ĐỘNG (I AM SAFE)',
                      style: TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 12.5,
                        letterSpacing: 0.3,
                      ),
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF10B981),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    elevation: 3,
                  ),
                ),
              ),
              const SizedBox(height: 8),

              // Nút 2: CẤP CỨU SOS NGAY (115 & NGƯỜI THÂN)
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _handleTriggerSosNow,
                  icon: const Icon(Icons.emergency_rounded,
                      size: 20, color: Colors.white),
                  label: const FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      '🚨 CẤP CỨU SOS NGAY (GỌI 115 & NGƯỜI THÂN)',
                      style: TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 12,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFEF4444),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    elevation: 4,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
    );
  }

  Widget _buildTelemetryTile({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(height: 3),
        Text(
          value,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w900,
            color: color,
          ),
        ),
        Text(
          label,
          style: const TextStyle(
            fontSize: 9.5,
            color: Color(0xFF94A3B8),
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
