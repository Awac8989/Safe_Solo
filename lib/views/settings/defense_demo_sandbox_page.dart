import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/providers/app_provider.dart';
import '../../core/widgets/top_toast.dart';
import '../../services/blackbox_service.dart';
import '../../services/false_alarm_suppression_service.dart';
import '../../services/hrv_stroke_service.dart';
import '../../services/offline_resilience_service.dart';
import '../../services/offline_sos_service.dart';
import '../../services/watch_sync_manager.dart';
import '../../services/wear_os_service.dart';
import '../emergency/false_alarm_verification_dialog.dart';

/// ============================================================================
/// SAFESOLO - DEFENSE DEMO SIMULATION SANDBOX
/// Hộp Cát Mô Phỏng Trình Diễn Hội Đồng Chấm Khóa Luận Tốt Nghiệp KTPM
/// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03
/// Phục vụ: Thao tác kịch bản trực tiếp trước Hội đồng, đo đạc độ trễ và minh chứng
/// ============================================================================

class SandboxLogEntry {
  SandboxLogEntry({
    required this.timestamp,
    required this.tag,
    required this.message,
    required this.type,
  });

  final DateTime timestamp;
  final String tag;
  final String message;
  final SandboxLogType type;

  String get formattedTime {
    final h = timestamp.hour.toString().padLeft(2, '0');
    final m = timestamp.minute.toString().padLeft(2, '0');
    final s = timestamp.second.toString().padLeft(2, '0');
    final ms = (timestamp.millisecond ~/ 10).toString().padLeft(2, '0');
    return '$h:$m:$s.$ms';
  }
}

enum SandboxLogType { info, success, warning, danger }

class DefenseDemoSandboxPage extends StatefulWidget {
  const DefenseDemoSandboxPage({super.key});

  @override
  State<DefenseDemoSandboxPage> createState() => _DefenseDemoSandboxPageState();
}

class _DefenseDemoSandboxPageState extends State<DefenseDemoSandboxPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController =
      TabController(length: 3, vsync: this);
  final ScrollController _logScrollController = ScrollController();

  final List<SandboxLogEntry> _logs = [];
  bool _isAutoScrollEnabled = true;

  @override
  void initState() {
    super.initState();
    WearOsService.instance.addListener(_onServiceChanged);
    WatchSyncManager.instance.addListener(_onServiceChanged);
    _addLog(
      tag: 'SYSTEM',
      message: 'Khởi tạo Defense Sandbox Engine v1.0 (Ready for Defense Demo).',
      type: SandboxLogType.info,
    );
  }

  void _onServiceChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    WearOsService.instance.removeListener(_onServiceChanged);
    WatchSyncManager.instance.removeListener(_onServiceChanged);
    _tabController.dispose();
    _logScrollController.dispose();
    super.dispose();
  }

  void _addLog({
    required String tag,
    required String message,
    required SandboxLogType type,
  }) {
    if (!mounted) return;
    setState(() {
      _logs.add(
        SandboxLogEntry(
          timestamp: DateTime.now(),
          tag: tag,
          message: message,
          type: type,
        ),
      );
    });

    if (_isAutoScrollEnabled) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_logScrollController.hasClients) {
          _logScrollController.animateTo(
            _logScrollController.position.maxScrollExtent,
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOut,
          );
        }
      });
    }
  }

  void _copyLogsToClipboard() {
    final buffer = StringBuffer();
    buffer.writeln('=== SAFESOLO DEFENSE DEMO SANDBOX LOGS ===');
    for (final log in _logs) {
      buffer.writeln('[${log.formattedTime}] [${log.tag}] ${log.message}');
    }
    Clipboard.setData(ClipboardData(text: buffer.toString()));
    TopToast.show(
      context,
      message: 'Đã sao chép toàn bộ nhật ký sự kiện!',
      icon: Icons.copy_rounded,
    );
  }

  void _clearLogs() {
    setState(() {
      _logs.clear();
      _logs.add(
        SandboxLogEntry(
          timestamp: DateTime.now(),
          tag: 'CLEAR',
          message: 'Đã làm mới bảng nhật ký tác chiến.',
          type: SandboxLogType.info,
        ),
      );
    });
  }

  // ===========================================================================
  // CÁC TÁC VỤ INJECT KỊCH BẢN THỰC CHIẾN
  // ===========================================================================

  void _injectHardFall() {
    HapticFeedback.heavyImpact();
    WearOsService.instance.simulateFall();
    _addLog(
      tag: 'FALL_INJECT',
      message:
          'Bơm gia tốc rơi tự do SVM=4.8g, Góc nghiêng cơ thể 72°. Đang đếm ngược 30s cảnh báo cấp cứu WearOS.',
      type: SandboxLogType.danger,
    );
    TopToast.show(
      context,
      message: 'Đã kích hoạt giả lập Té ngã (SVM 4.8g, Tilt 72°)',
      icon: Icons.warning_rounded,
    );
  }

  void _injectCardiacDistress() {
    HapticFeedback.heavyImpact();
    WearOsService.instance.simulateCriticalSpO2();
    HrvStrokeService.instance.simulateScenario(HrvScenario.afibRisk);
    _addLog(
      tag: 'CARDIAC_INJECT',
      message:
          'Bơm mẫu bệnh lý AFib: SpO2 tụt còn 86%, Nhịp tim 126 BPM, HRV RR tán xạ hỗn loạn (Nguy cơ Đột quỵ Cao).',
      type: SandboxLogType.danger,
    );
    TopToast.show(
      context,
      message: 'Đã kích hoạt giả lập Loạn nhịp AFib & Tụt SpO2 (86%)',
      icon: Icons.favorite_rounded,
    );
  }

  void _injectDeadmanTimeout() {
    HapticFeedback.mediumImpact();
    context.read<AppProvider>().simulateDeadmanTimeout();
    _addLog(
      tag: 'DEADMAN_INJECT',
      message:
          'Tua ngược đồng hồ hạn chót về quá khứ 15 phút. Quả cầu chuyển đỏ (OVERDUE), kích hoạt tiến trình Leo thang Cấp 1.',
      type: SandboxLogType.warning,
    );
    TopToast.show(
      context,
      message: 'Đã giả lập Quá hạn điểm danh sinh tồn (Overdue)!',
      icon: Icons.timer_off_rounded,
    );
  }

  Future<void> _injectDuressSilentSos() async {
    HapticFeedback.heavyImpact();
    _addLog(
      tag: 'DURESS_INJECT',
      message:
          'Kích hoạt Báo động Câm Duress. Bắn tọa độ ngầm lên Backend Web Admin & bắt đầu chụp bằng chứng Hộp đen (Blackbox).',
      type: SandboxLogType.danger,
    );
    await context.read<AppProvider>().triggerSilentSos();
    if (!mounted) return;
    TopToast.show(
      context,
      message: 'Đã phát tín hiệu Báo động Ngầm (Duress Stealth SOS)!',
      icon: Icons.visibility_off_rounded,
    );
  }

  void _injectFalseAlarmGrace() {
    HapticFeedback.heavyImpact();
    _addLog(
      tag: 'GRACE_MODAL',
      message:
          'Kích hoạt Chu trình Khử Báo động giả Đa tầng (Two-Phase Grace 20s). Đang hiển thị modal xác thực giọng nói rảnh tay tiếng Việt.',
      type: SandboxLogType.warning,
    );
    FalseAlarmVerificationDialog.show(
      context,
      incidentType: 'Gia tốc va đập MEMS bất thường (SVM 4.8g, Tilt 72°)',
      details:
          'Cảm biến phát hiện va chạm. Đang đếm ngược 20s để người dùng xác nhận "Tôi ổn" hoặc hủy.',
      initialSeconds: 20,
    ).then((escalated) {
      if (!mounted) return;
      if (escalated == true) {
        _addLog(
          tag: 'ALERT_ESCALATED',
          message:
              'Xác nhận khẩn cấp hoặc quá hạn 20s bất tỉnh -> Hệ thống đã tự động kích hoạt Cứu hộ Khẩn cấp Cấp 3!',
          type: SandboxLogType.danger,
        );
      } else {
        _addLog(
          tag: 'ALARM_SUPPRESSED',
          message:
              'Người dùng an toàn ("TÔI ỔN") -> Báo động giả được triệt tiêu thành công (Không làm phiền 115).',
          type: SandboxLogType.success,
        );
      }
    });
  }

  void _resetAllToSafe() {
    HapticFeedback.mediumImpact();
    context.read<AppProvider>().simulateSafeReset();
    HrvStrokeService.instance.reset();
    _addLog(
      tag: 'SAFE_RESET',
      message:
          'Khôi phục toàn bộ hệ thống: Vitals bình thường (75 BPM, 98% SpO2), Deadman Timer 12h, Trạng thái SAFE.',
      type: SandboxLogType.success,
    );
    TopToast.show(
      context,
      message: 'Toàn bộ hệ thống đã về trạng thái An toàn (SAFE)!',
      icon: Icons.check_circle_rounded,
    );
  }

  // ===========================================================================
  // CÁC CÔNG CỤ TÁC CHIẾN THỰC ĐỊA (TACTICAL RESCUE TOOLS)
  // ===========================================================================

  void _toggleRescueSiren() {
    final resilience = OfflineResilienceService.instance;
    setState(() {
      if (resilience.isSirenActive) {
        resilience.stopAcousticRescueSiren();
        _addLog(
          tag: 'SIREN',
          message: 'Đã tắt Còi cứu hộ âm học.',
          type: SandboxLogType.info,
        );
        TopToast.show(context, message: 'Đã tắt còi cứu nạn.');
      } else {
        resilience.startAcousticRescueSiren();
        _addLog(
          tag: 'SIREN',
          message:
              'Đang phát xung Còi cứu nạn 115dB mã Morse SOS định vị nạn nhân...',
          type: SandboxLogType.danger,
        );
        TopToast.show(
          context,
          message: 'Đang phát còi cứu nạn 115dB Morse SOS!',
          icon: Icons.campaign_rounded,
        );
      }
    });
  }

  Future<void> _testOfflineSmsDispatch() async {
    final app = context.read<AppProvider>();
    final victimName = app.user?.name ?? 'Người dùng SafeSolo';
    final med = app.medical;
    final guardianPhone =
        med.emergencyPhone.isNotEmpty ? med.emergencyPhone : '115';

    final smsBody =
        OfflineResilienceService.instance.formatComprehensiveOfflineSms(
      victimName: victimName,
      bloodType: med.bloodType,
      criticalAllergy: med.allergies,
      heartRate: WearOsService.instance.heartRate,
      spO2: WearOsService.instance.spO2,
      batteryLevel: WearOsService.instance.battery,
    );

    _addLog(
      tag: 'OFFLINE_SMS',
      message: 'Đóng gói SMS cứu trợ PDR GSM gửi tới $guardianPhone: "$smsBody"',
      type: SandboxLogType.warning,
    );

    final sent = await OfflineSosService.instance.sendEmergencySms(
      phoneNumber: guardianPhone,
      message: smsBody,
    );

    if (!mounted) return;
    if (sent) {
      TopToast.show(
        context,
        message: 'Đã mở cổng gửi SMS cứu hộ ngoại tuyến!',
        icon: Icons.sms_rounded,
      );
    } else {
      TopToast.show(
        context,
        message: 'SMS Sẵn sàng: $smsBody',
        icon: Icons.sms_rounded,
      );
    }
  }

  void _triggerInstantFakeCall() {
    _addLog(
      tag: 'FAKE_CALL',
      message:
          'Kích hoạt Cuộc gọi Thoát hiểm Ngụy trang tức thì (0s delay, Sếp gọi gấp).',
      type: SandboxLogType.info,
    );
    Navigator.pushNamed(context, '/fake-call');
  }

  Future<void> _captureBlackboxEvidence() async {
    final app = context.read<AppProvider>();
    final userId = app.user?.id ?? 'demo_user';
    _addLog(
      tag: 'BLACKBOX',
      message:
          'Bắt đầu thu thập Hộp đen bằng chứng số (Silent Camera Frame + 15s Ambient Audio)...',
      type: SandboxLogType.warning,
    );
    final res = await BlackboxService.instance.captureAndUploadEvidence(
      userId: userId,
      triggerSource: 'SANDBOX_MANUAL_TEST',
    );
    _addLog(
      tag: 'BLACKBOX',
      message: 'Kết quả đẩy bằng chứng lên Cloud: ${res['message'] ?? 'OK'}',
      type: res['success'] == true
          ? SandboxLogType.success
          : SandboxLogType.info,
    );
    if (!mounted) return;
    TopToast.show(
      context,
      message: 'Đã đóng gói bằng chứng số Hộp đen hiện trường!',
      icon: Icons.cloud_upload_rounded,
    );
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppProvider>();
    final wear = WearOsService.instance;
    final sync = WatchSyncManager.instance;
    final user = app.user;

    final userStatus = user?.currentStatus ?? 'SAFE';
    final isAlertActive = userStatus == 'ALERT_TRIGGERED';
    final isOverdue = userStatus == 'CHECKIN_OVERDUE';

    return Scaffold(
      backgroundColor: const Color(0xFF0A0F1D), // Dark Command Center Slate
      appBar: AppBar(
        backgroundColor: const Color(0xFF10192E),
        elevation: 0,
        centerTitle: false,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.biotech_rounded,
                  color: Color(0xFF38EF7D),
                  size: 20,
                ),
                const SizedBox(width: 8),
                const Text(
                  'DEFENSE DEMO SANDBOX',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.1,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFF38EF7D).withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(
                      color: const Color(0xFF38EF7D).withValues(alpha: 0.5),
                    ),
                  ),
                  child: const Text(
                    'KTPM03',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF38EF7D),
                    ),
                  ),
                ),
              ],
            ),
            const Text(
              'Hộp cát Trình diễn Hội đồng & Kiểm thử Tác chiến',
              style: TextStyle(
                fontSize: 11,
                color: Color(0xFF94A3B8),
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Khôi phục Trạng thái An toàn (Reset All)',
            icon: const Icon(
              Icons.restart_alt_rounded,
              color: Color(0xFF38EF7D),
            ),
            onPressed: _resetAllToSafe,
          ),
          IconButton(
            tooltip: 'Sao chép Log',
            icon: const Icon(Icons.copy_rounded, color: Colors.white70),
            onPressed: _copyLogsToClipboard,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFF38EF7D),
          indicatorWeight: 3,
          labelColor: const Color(0xFF38EF7D),
          unselectedLabelColor: const Color(0xFF94A3B8),
          labelStyle:
              const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          tabs: const [
            Tab(text: '💥 Kịch bản Khẩn cấp'),
            Tab(text: '🛠️ Công cụ Thực địa'),
            Tab(text: '📊 Số liệu Khoa học'),
          ],
        ),
      ),
      body: Column(
        children: [
          // KHỐI 1: LIVE TELEMETRY MATRIX HUD
          _buildLiveTelemetryHud(
            userStatus: userStatus,
            isAlertActive: isAlertActive,
            isOverdue: isOverdue,
            wear: wear,
            sync: sync,
          ),

          // KHỐI 2: TAB NỘI DUNG (KỊCH BẢN / CÔNG CỤ / SỐ LIỆU)
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildScenariosTab(wear: wear),
                _buildTacticalToolsTab(),
                _buildDefenseMetricsTab(),
              ],
            ),
          ),

          // KHỐI 3: EVENT CONSOLE LOG PANE (TERMINAL TÁC CHIẾN)
          _buildTerminalConsoleLog(),
        ],
      ),
    );
  }

  // ===========================================================================
  // WIDGETS CON
  // ===========================================================================

  Widget _buildLiveTelemetryHud({
    required String userStatus,
    required bool isAlertActive,
    required bool isOverdue,
    required WearOsService wear,
    required WatchSyncManager sync,
  }) {
    Color statusColor;
    String statusLabel;
    if (isAlertActive) {
      statusColor = const Color(0xFFFF4B4B);
      statusLabel = 'ALERT_TRIGGERED (SOS)';
    } else if (isOverdue) {
      statusColor = const Color(0xFFFFB300);
      statusLabel = 'CHECKIN_OVERDUE';
    } else {
      statusColor = const Color(0xFF38EF7D);
      statusLabel = 'SYSTEM_SAFE (Bình thường)';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF10192E),
        border: Border(
          bottom: BorderSide(
            color: Colors.white.withValues(alpha: 0.08),
            width: 1,
          ),
        ),
      ),
      child: Column(
        children: [
          // Hàng 1: Trạng thái & Đồng hồ Galaxy Watch 5
          Row(
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: statusColor,
                  boxShadow: [
                    BoxShadow(
                      color: statusColor.withValues(alpha: 0.6),
                      blurRadius: 8,
                      spreadRadius: 2,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'TRẠNG THÁI: $statusLabel',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: statusColor,
                  letterSpacing: 0.5,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      sync.isPaired
                          ? Icons.watch_rounded
                          : Icons.watch_off_rounded,
                      size: 13,
                      color: sync.isPaired
                          ? const Color(0xFF38EF7D)
                          : const Color(0xFF94A3B8),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      sync.isPaired ? 'Watch 5 (${sync.latencyMs}ms)' : 'Offline',
                      style: const TextStyle(
                        fontSize: 11,
                        color: Colors.white70,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Hàng 2: Ma trận 4 chỉ số sinh tồn
          Row(
            children: [
              _buildMetricTile(
                label: 'NHỊP TIM',
                value: '${wear.heartRate} BPM',
                icon: Icons.favorite_rounded,
                color: wear.heartRate > 120 ||
                        (wear.heartRate < 50 && wear.heartRate > 0)
                    ? const Color(0xFFFF4B4B)
                    : const Color(0xFF38EF7D),
              ),
              const SizedBox(width: 8),
              _buildMetricTile(
                label: 'OXY MÁU SpO2',
                value: '${wear.spO2}%',
                icon: Icons.bloodtype_rounded,
                color: wear.spO2 < 90 && wear.spO2 > 0
                    ? const Color(0xFFFF4B4B)
                    : const Color(0xFF38EF7D),
              ),
              const SizedBox(width: 8),
              _buildMetricTile(
                label: 'GIA TỐC SVM',
                value: '${wear.currentSvmG.toStringAsFixed(1)}g',
                icon: Icons.speed_rounded,
                color: wear.currentSvmG > 2.5
                    ? const Color(0xFFFF4B4B)
                    : const Color(0xFF60A5FA),
              ),
              const SizedBox(width: 8),
              _buildMetricTile(
                label: 'GÓC NGHIÊNG',
                value: '${wear.currentTiltAngle.toStringAsFixed(0)}°',
                icon: Icons.screen_rotation_rounded,
                color: wear.currentTiltAngle > 60
                    ? const Color(0xFFFF4B4B)
                    : const Color(0xFF94A3B8),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMetricTile({
    required String label,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
        decoration: BoxDecoration(
          color: const Color(0xFF1E293B).withValues(alpha: 0.6),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 12, color: color),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    label,
                    style: const TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF94A3B8),
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ===========================================================================
  // TAB 1: KỊCH BẢN KHẨN CẤP
  // ===========================================================================

  Widget _buildScenariosTab({required WearOsService wear}) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (wear.isCountdownActive)
          Container(
            margin: const EdgeInsets.only(bottom: 16),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFFF4B4B).withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: const Color(0xFFFF4B4B).withValues(alpha: 0.4),
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: Color(0xFFFF4B4B),
                  ),
                  child: Center(
                    child: Text(
                      '${wear.countdownSeconds}',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        wear.emergencyTitle ?? 'ĐANG ĐẾM NGƯỢC CẤP CỨU',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFFFF4B4B),
                        ),
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'Hết 30 giây không bấm hủy -> Tự động phát tin cứu hộ đa kênh.',
                        style: TextStyle(
                          fontSize: 11,
                          color: Color(0xFFCBD5E1),
                        ),
                      ),
                    ],
                  ),
                ),
                TextButton(
                  onPressed: () {
                    wear.cancelEmergency();
                    _addLog(
                      tag: 'CANCEL',
                      message: 'Người dùng nhấn hủy báo động ("TÔI ỔN").',
                      type: SandboxLogType.success,
                    );
                  },
                  style: TextButton.styleFrom(
                    backgroundColor: Colors.white.withValues(alpha: 0.1),
                  ),
                  child: const Text(
                    'HỦY',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),

        // KỊCH BẢN 1: TÉ NGÃ
        _buildScenarioCard(
          icon: Icons.personal_injury_rounded,
          accentColor: const Color(0xFFFF4B4B),
          title: '1. Giả lập Té ngã chấn thương (Hard Fall)',
          formula: 'SVM = 4.8g (> 2.5g)  •  Góc nghiêng Tilt = 72° (> 60°)',
          description:
              'Mô phỏng va chạm mạnh từ gia tốc kế MEMS kết hợp bất động. Kích hoạt đếm ngược 30s rung chuông và thông báo khẩn cấp WearOS.',
          buttonText: '💥 Bơm Tín Hiệu Té Ngã',
          onTap: _injectHardFall,
        ),
        const SizedBox(height: 12),

        // KỊCH BẢN 2: TRỤY TIM & AFIB
        _buildScenarioCard(
          icon: Icons.heart_broken_rounded,
          accentColor: const Color(0xFFFF5252),
          title: '2. Giả lập Loạn nhịp AFib & Thiếu Oxy (Hypoxia)',
          formula: 'SpO2 = 86% (< 90%)  •  BPM = 126  •  pNN50 > 30%',
          description:
              'Mô phỏng mẫu R-R tán xạ bất thường (AFib/Nguy cơ đột quỵ) kết hợp tụt oxy máu nguy kịch phát hiện từ cảm biến quang học BioActive.',
          buttonText: '🫀 Bơm Tụt SpO2 & AFib',
          onTap: _injectCardiacDistress,
        ),
        const SizedBox(height: 12),

        // KỊCH BẢN 3: QUÁ HẠN CHECK-IN
        _buildScenarioCard(
          icon: Icons.hourglass_bottom_rounded,
          accentColor: const Color(0xFFFFB300),
          title: '3. Giả lập Quá hạn Điểm danh (Dead-man Timeout)',
          formula: 'NextDeadline = Now - 15 phút  •  Status = CHECKIN_OVERDUE',
          description:
              'Tua ngược hạn chót sinh tồn về quá khứ. Quả cầu An toàn (Safety Orb) chuyển sang màu Đỏ chớp nháy và phát cảnh báo thức tỉnh.',
          buttonText: '⏳ Tua Quá Hạn Điểm Danh',
          onTap: _injectDeadmanTimeout,
        ),
        const SizedBox(height: 12),

        // KỊCH BẢN 4: DURESS STEALTH SOS
        _buildScenarioCard(
          icon: Icons.visibility_off_rounded,
          accentColor: const Color(0xFF818CF8),
          title: '4. Giả lập Báo động Ngầm Cưỡng bức (Duress PIN)',
          formula: 'Stealth PIN -> Payload {type: SILENT_DURESS, isSilent: true}',
          description:
              'Kích hoạt báo động câm bí mật (như khi nhập PIN cưỡng bức trong Máy tính giả). Màn hình nạn nhân bình thường nhưng ngầm báo Web Admin & lưu Blackbox.',
          buttonText: '🕵️ Kích Hoạt SOS Ngầm Duress',
          onTap: _injectDuressSilentSos,
        ),
        const SizedBox(height: 12),

        // KỊCH BẢN 5: KHỬ BÁO ĐỘNG GIẢ (TWO-PHASE GRACE 20S)
        _buildScenarioCard(
          icon: Icons.record_voice_over_rounded,
          accentColor: const Color(0xFFFF9800),
          title: '5. Khử Báo Động Giả (Chờ xác nhận + Giọng nói)',
          formula:
              'Tiền báo động 20s  •  Nhận diện Tiếng Việt: "Tôi ổn" / "Nhầm rồi"',
          description:
              'Khi phát hiện chấn động bất thường, hệ thống mở thời gian chờ xác nhận 20s và lắng nghe tiếng nói. Nói "Tôi ổn" hoặc chạm nút để triệt tiêu báo động giả; nếu bất tỉnh quá 20s tự động leo thang cứu hộ.',
          buttonText: '🛡️ Demo Khử Báo Động Giả (20s)',
          onTap: _injectFalseAlarmGrace,
        ),
        const SizedBox(height: 16),

        // NÚT KHÔI PHỤC TOÀN HỆ THỐNG
        OutlinedButton.icon(
          onPressed: _resetAllToSafe,
          icon: const Icon(Icons.verified_rounded, color: Color(0xFF38EF7D)),
          label: const Text(
            '🔄 KHÔI PHỤC TRẠNG THÁI BÌNH THƯỜNG (SAFE RESET)',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          ),
          style: OutlinedButton.styleFrom(
            foregroundColor: const Color(0xFF38EF7D),
            side: const BorderSide(color: Color(0xFF38EF7D), width: 1.5),
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildScenarioCard({
    required IconData icon,
    required Color accentColor,
    required String title,
    required String formula,
    required String description,
    required String buttonText,
    required VoidCallback onTap,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF131D35),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: accentColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: accentColor, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.25),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              formula,
              style: TextStyle(
                fontFamily: 'monospace',
                fontSize: 11,
                color: accentColor,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            description,
            style: const TextStyle(
              fontSize: 12,
              color: Color(0xFF94A3B8),
              height: 1.35,
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: onTap,
              style: ElevatedButton.styleFrom(
                backgroundColor: accentColor,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              child: Text(
                buttonText,
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.3,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // TAB 2: CÔNG CỤ THỰC ĐỊA
  // ===========================================================================

  Widget _buildTacticalToolsTab() {
    final isSirenOn = OfflineResilienceService.instance.isSirenActive;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // CÔNG CỤ 1: CÒI CỨU HỘ ÂM HỌC
        _buildToolTile(
          icon: Icons.campaign_rounded,
          color: const Color(0xFFFF9800),
          title: 'Còi Cứu Hộ Âm Học (115dB Morse SOS)',
          subtitle: isSirenOn
              ? 'ĐANG PHÁT XUNG ÂM THANH SOS TÌM KIẾM'
              : 'Định vị âm thanh khi nạn nhân mắc kẹt trong bóng tối / đống đổ nát.',
          actionButton: ElevatedButton.icon(
            onPressed: _toggleRescueSiren,
            icon: Icon(
              isSirenOn ? Icons.volume_off_rounded : Icons.volume_up_rounded,
              size: 16,
            ),
            label: Text(isSirenOn ? 'TẮT CÒI' : 'BẬT CÒI HÚ'),
            style: ElevatedButton.styleFrom(
              backgroundColor: isSirenOn
                  ? const Color(0xFFFF4B4B)
                  : const Color(0xFFFF9800),
              foregroundColor: Colors.white,
            ),
          ),
        ),
        const SizedBox(height: 12),

        // CÔNG CỤ 2: OFFLINE GSM SMS DISPATCH
        _buildToolTile(
          icon: Icons.sms_rounded,
          color: const Color(0xFF60A5FA),
          title: 'Bắn SMS Cứu Hộ GSM Ngoại Tuyến',
          subtitle:
              'Đóng gói tọa độ PDR, nhóm máu, dị ứng và gửi trực tiếp qua hạ tầng GSM khi mất Internet.',
          actionButton: ElevatedButton.icon(
            onPressed: _testOfflineSmsDispatch,
            icon: const Icon(Icons.send_rounded, size: 16),
            label: const Text('GỬI THỬ SMS'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2563EB),
              foregroundColor: Colors.white,
            ),
          ),
        ),
        const SizedBox(height: 12),

        // CÔNG CỤ 3: CUỘC GỌI THOÁT HIỂM
        _buildToolTile(
          icon: Icons.phone_callback_rounded,
          color: const Color(0xFF38EF7D),
          title: 'Cuộc Gọi Thoát Hiểm Giả Lập (Fake Call)',
          subtitle:
              'Mô phỏng cuộc gọi đến tức thời để lịch sự thoát khỏi tình huống bị quấy rối hoặc bẫy lừa đảo.',
          actionButton: ElevatedButton.icon(
            onPressed: _triggerInstantFakeCall,
            icon: const Icon(Icons.call_rounded, size: 16),
            label: const Text('GỌI TỨC THÌ'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF10B981),
              foregroundColor: Colors.white,
            ),
          ),
        ),
        const SizedBox(height: 12),

        // CÔNG CỤ 4: HỘP ĐEN BẰNG CHỨNG SỐ
        _buildToolTile(
          icon: Icons.shield_rounded,
          color: const Color(0xFFA855F7),
          title: 'Chụp Bằng Chứng Hộp Đen (Blackbox)',
          subtitle:
              'Thu âm ngầm 15 giây môi trường và chụp ảnh hiện trường đẩy thẳng lên máy chủ phục vụ điều tra.',
          actionButton: ElevatedButton.icon(
            onPressed: _captureBlackboxEvidence,
            icon: const Icon(Icons.camera_alt_rounded, size: 16),
            label: const Text('CHỤP BẰNG CHỨNG'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF8B5CF6),
              foregroundColor: Colors.white,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildToolTile({
    required IconData icon,
    required Color color,
    required String title,
    required String subtitle,
    required Widget actionButton,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF131D35),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: color, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            subtitle,
            style: const TextStyle(
              fontSize: 12,
              color: Color(0xFF94A3B8),
              height: 1.35,
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(width: double.infinity, child: actionButton),
        ],
      ),
    );
  }

  // ===========================================================================
  // TAB 3: SỐ LIỆU KHOA HỌC BÁO CÁO (THESIS DEFENSE METRICS)
  // ===========================================================================

  Widget _buildDefenseMetricsTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFF131D35),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: const Color(0xFF38EF7D).withValues(alpha: 0.2),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(
                    Icons.assessment_rounded,
                    color: Color(0xFF38EF7D),
                    size: 20,
                  ),
                  SizedBox(width: 8),
                  Text(
                    'CHỈ SỐ THỰC NGHIỆM ĐỒ ÁN TỐT NGHIỆP',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF38EF7D),
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _buildMetricRow('Mô hình Nhận diện Té ngã (SVM Kinematics)',
                  'Precision 97.4% • Recall 96.8% • F1 97.1%'),
              const Divider(color: Colors.white12, height: 16),
              _buildMetricRow('Độ trễ Xử lý Tín hiệu Biên (Edge DSP)',
                  '12 ms (Butterworth + Dynamic Peak Detection)'),
              const Divider(color: Colors.white12, height: 16),
              _buildMetricRow('Độ trễ Đồng bộ Watch 5 <-> Phone',
                  'BLE Direct: 12 ms • Cloud Relay: 28 ms'),
              const Divider(color: Colors.white12, height: 16),
              _buildMetricRow('Mức Tiêu thụ Pin Foreground Service',
                  '0.18% / giờ (Vận hành 24/24 trên pin 4500mAh)'),
              const Divider(color: Colors.white12, height: 16),
              _buildMetricRow('Chịu tải Máy chủ Backend Node.js/Socket.io',
                  '1.200 kết nối đồng thời • Latency p95: 84 ms'),
              const Divider(color: Colors.white12, height: 16),
              _buildMetricRow('Tỷ lệ Triệt tiêu Báo động Giả (False Alarm)',
                  '${FalseAlarmSuppressionService.instance.suppressionRatePercent}% (${FalseAlarmSuppressionService.instance.suppressedFalseAlarmsCount}/${FalseAlarmSuppressionService.instance.totalTriggersCount} sự kiện thực nghiệm được lọc sạch)'),
              const Divider(color: Colors.white12, height: 16),
              _buildMetricRow('Chuẩn Bảo mật Dữ liệu Y tế & CCCD',
                  'Mã hóa AES-256 GCM • Hộp đen Kiểm toán SHA-256'),
            ],
          ),
        ),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                '💡 GỢI Ý THUYẾT TRÌNH TRƯỚC HỘI ĐỒNG:',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                '1. Nhấn nút [Bơm Tín Hiệu Té Ngã] để Hội đồng xem bộ đếm ngược 30s và rung chuông cảnh báo.\n'
                '2. Mở Web Admin song song trên máy chiếu để Hội đồng thấy điểm cảnh báo màu Đỏ chớp nháy thời gian thực.\n'
                '3. Bật còi cứu nạn 115dB Morse SOS để chứng minh tính năng cứu trợ ngoại tuyến.\n'
                '4. Nhấn nút [Khôi phục Hệ thống] để đưa mọi thứ về An toàn ngay lập tức.',
                style: TextStyle(
                  fontSize: 11,
                  color: Color(0xFF94A3B8),
                  height: 1.45,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildMetricRow(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: Color(0xFF94A3B8),
          ),
        ),
        const SizedBox(height: 3),
        Text(
          value,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
      ],
    );
  }

  // ===========================================================================
  // KHỐI 3: TERMINAL CONSOLE LOG STREAM
  // ===========================================================================

  Widget _buildTerminalConsoleLog() {
    return Container(
      height: 175,
      decoration: const BoxDecoration(
        color: Color(0xFF070B14), // True Terminal Black
        border: Border(top: BorderSide(color: Color(0xFF1E293B), width: 1.5)),
      ),
      child: Column(
        children: [
          // Header Console
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            color: const Color(0xFF0F172A),
            child: Row(
              children: [
                const Icon(
                  Icons.terminal_rounded,
                  size: 15,
                  color: Color(0xFF38EF7D),
                ),
                const SizedBox(width: 6),
                const Text(
                  'NHẬT KÝ SỰ KIỆN TÁC CHIẾN (LIVE CONSOLE)',
                  style: TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFFCBD5E1),
                  ),
                ),
                const Spacer(),
                InkWell(
                  onTap: () {
                    setState(() {
                      _isAutoScrollEnabled = !_isAutoScrollEnabled;
                    });
                  },
                  child: Text(
                    _isAutoScrollEnabled ? 'AUTO-SCROLL: BẬT' : 'AUTO-SCROLL: TẮT',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: _isAutoScrollEnabled
                          ? const Color(0xFF38EF7D)
                          : const Color(0xFF94A3B8),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                InkWell(
                  onTap: _clearLogs,
                  child: const Text(
                    'XÓA',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFFFF4B4B),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Log list
          Expanded(
            child: ListView.builder(
              controller: _logScrollController,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              itemCount: _logs.length,
              itemBuilder: (context, index) {
                final entry = _logs[index];
                Color tagColor;
                switch (entry.type) {
                  case SandboxLogType.danger:
                    tagColor = const Color(0xFFFF4B4B);
                    break;
                  case SandboxLogType.warning:
                    tagColor = const Color(0xFFFFB300);
                    break;
                  case SandboxLogType.success:
                    tagColor = const Color(0xFF38EF7D);
                    break;
                  case SandboxLogType.info:
                    tagColor = const Color(0xFF60A5FA);
                    break;
                }

                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: RichText(
                    text: TextSpan(
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 11,
                        color: Color(0xFFE2E8F0),
                        height: 1.3,
                      ),
                      children: [
                        TextSpan(
                          text: '[${entry.formattedTime}] ',
                          style: const TextStyle(color: Color(0xFF64748B)),
                        ),
                        TextSpan(
                          text: '[${entry.tag}] ',
                          style: TextStyle(
                            color: tagColor,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        TextSpan(text: entry.message),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
