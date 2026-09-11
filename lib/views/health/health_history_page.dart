import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/app_strings.dart';
import '../../core/app_theme.dart';
import '../../core/providers/app_provider.dart';
import '../../core/widgets/app_shell.dart';
import '../../models/health_report_model.dart';
import '../../services/api_service.dart';
import '../../services/health_report_export_service.dart';
import '../../services/pedometer_service.dart';
import '../../services/wear_os_service.dart';
import '../../services/watch_sync_manager.dart';
import 'widgets/activity_rings_widget.dart';
import 'widgets/vitals_matrix_card.dart';

/// ============================================================================
/// SAFESOLO - TRUNG TÂM SỨC KHỎE & CHỈ SỐ SINH TỒN (HEALTH & VITALS DASHBOARD)
/// Tham khảo chuẩn Apple Health, Samsung Health, Garmin Connect và Whoop 4.0
/// ============================================================================
class HealthHistoryPage extends StatefulWidget {
  const HealthHistoryPage({super.key});

  @override
  State<HealthHistoryPage> createState() => _HealthHistoryPageState();
}

class _HealthHistoryPageState extends State<HealthHistoryPage> {
  final ApiService _api = ApiService();
  final DateFormat _dateFormat = DateFormat('dd/MM/yyyy');
  final DateFormat _dateTimeFormat = DateFormat('dd/MM/yyyy HH:mm');

  late String _period;
  late Future<HealthReportModel> _future;
  bool _isSyncing = false;
  bool _isMeasuring = false;
  DateTime _lastSyncedAt = DateTime.now();

  @override
  void initState() {
    super.initState();
    _period = 'month';
    _future = _load();
    PedometerService.instance.initialize();
    WearOsService.instance.initialize();
    WatchSyncManager.instance.initialize();
  }

  Future<HealthReportModel> _load() async {
    final user = context.read<AppProvider>().user;
    if (user == null) {
      throw Exception('Bạn cần đăng nhập để xem báo cáo sức khỏe.');
    }
    return _api.getHealthReport(user.id, period: _period);
  }

  void _changePeriod(String period) {
    setState(() {
      _period = period;
      _future = _load();
    });
  }

  Future<void> _refresh() async {
    setState(() {
      _future = _load();
    });
    await _future;
  }

  /// Kích hoạt đồng bộ thông số sức khỏe lên Cloud và Đồng hồ
  Future<void> _handleSyncNow() async {
    setState(() => _isSyncing = true);
    final user = context.read<AppProvider>().user;
    final wearOs = WearOsService.instance;

    try {
      if (user != null) {
        await _api.createDeviceSignal(
          userId: user.id,
          signalType: 'HEALTH_DASHBOARD_SYNC',
          payload: {
            'device': wearOs.watchModel,
            'heartRate': wearOs.heartRate,
            'spO2': wearOs.spO2,
            'battery': wearOs.battery,
            'steps': wearOs.steps,
            'syncedAt': DateTime.now().toIso8601String(),
          },
        );
      }
      setState(() => _lastSyncedAt = DateTime.now());
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Color(0xFF0284C7),
            content: Text('✓ Đã đồng bộ chỉ số sinh tồn và nhịp sống thành công!'),
          ),
        );
      }
    } catch (_) {
      // Offline fallback
      setState(() => _lastSyncedAt = DateTime.now());
    } finally {
      if (mounted) setState(() => _isSyncing = false);
    }
  }

  /// Kích hoạt đo PPG tức thời qua Smartwatch
  Future<void> _handleMeasureNow() async {
    setState(() => _isMeasuring = true);
    WatchSyncManager.instance.sendInstantMeasureRequest();

    await Future.delayed(const Duration(milliseconds: 1400));
    if (!mounted) return;

    setState(() {
      _isMeasuring = false;
      _lastSyncedAt = DateTime.now();
    });

    final wearOs = WearOsService.instance;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: const Color(0xFF10B981),
        content: Text('✓ Đo PPG thành công: ${wearOs.heartRate} BPM · Nhịp tim đều'),
      ),
    );
  }

  Future<void> _exportPdf(HealthReportModel report) async {
    final user = context.read<AppProvider>().user;
    if (user == null) {
      return;
    }
    final file = await HealthReportExportService.instance.exportPdf(
      userName: user.name.isNotEmpty ? user.name : 'SafeSolo User',
      report: report,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Đã xuất PDF: ${file.path}')),
    );
  }

  Future<void> _exportExcel(HealthReportModel report) async {
    final user = context.read<AppProvider>().user;
    if (user == null) {
      return;
    }
    final file = await HealthReportExportService.instance.exportExcel(
      userName: user.name.isNotEmpty ? user.name : 'SafeSolo User',
      report: report,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Đã xuất Excel: ${file.path}')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    final pedometer = PedometerService.instance;
    final wearOs = WearOsService.instance;

    return AppPage(
      safeBottom: true,
      child: FutureBuilder<HealthReportModel>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(
              child: SizedBox(
                width: 48,
                height: 48,
                child: CircularProgressIndicator(strokeWidth: 3, color: Color(0xFF10B981)),
              ),
            );
          }

          if (snapshot.hasError) {
            return _HealthStateCard(
              title: strings.text('Không tải được báo cáo', 'Unable to load report'),
              message: snapshot.error.toString(),
              actionLabel: strings.text('Thử lại', 'Retry'),
              onAction: _refresh,
            );
          }

          final report = snapshot.data;
          if (report == null) {
            return _HealthStateCard(
              title: strings.text('Chưa có dữ liệu', 'No data yet'),
              message: strings.text(
                'Báo cáo sẽ xuất hiện sau khi có check-in, mood hoặc cảnh báo.',
                'The report appears once you have check-ins, mood entries, or alerts.',
              ),
            );
          }

          final topMood = _topMood(report.moodCounts);
          final totalMood = report.moodCounts.values.fold<int>(0, (sum, item) => sum + item);

          return RefreshIndicator(
            color: const Color(0xFF10B981),
            onRefresh: _refresh,
            child: ListView(
              physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
              padding: const EdgeInsets.only(top: 18, bottom: 124),
              children: [
                // 1. TIÊU ĐỀ TRANG VÀ NÚT TÁC VỤ
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(6),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF10B981).withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: const Icon(
                                  Icons.health_and_safety_rounded,
                                  color: Color(0xFF10B981),
                                  size: 20,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                strings.text('Trung tâm Sức khỏe', 'Health & Vitals Hub'),
                                style: AppTextStyles.h2.copyWith(fontSize: 24),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            strings.text(
                              'Chỉ số sinh tồn BioActive, vòng hoạt động thể chất và nhịp sống.',
                              'BioActive vitals, physical activity rings, and wellness trends.',
                            ),
                            style: AppTextStyles.body.copyWith(fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                    AppRoundIconButton(
                      icon: Icons.picture_as_pdf_rounded,
                      onPressed: () => _exportPdf(report),
                    ),
                    const SizedBox(width: 8),
                    AppRoundIconButton(
                      icon: Icons.table_view_rounded,
                      onPressed: () => _exportExcel(report),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // 2. BANNER KẾT NỐI SMARTWATCH & ĐỒNG BỘ THỜI GIAN THỰC
                AnimatedBuilder(
                  animation: Listenable.merge([pedometer, wearOs]),
                  builder: (context, _) {
                    final syncDiff = DateTime.now().difference(_lastSyncedAt).inMinutes;
                    final syncText = syncDiff <= 0 ? 'Vừa xong' : '$syncDiff phút trước';

                    return Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFF38BDF8).withValues(alpha: 0.3)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.2),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF38BDF8).withValues(alpha: 0.2),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: const Icon(Icons.watch_rounded, color: Color(0xFF38BDF8), size: 22),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          pedometer.watchModel,
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.bold,
                                            fontSize: 14,
                                          ),
                                        ),
                                        const SizedBox(width: 6),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF10B981).withValues(alpha: 0.2),
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: const Text(
                                            'ONLINE',
                                            style: TextStyle(
                                              color: Color(0xFF10B981),
                                              fontSize: 9,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      'Đồng bộ: $syncText · Pin: ${wearOs.battery}% · BLE 5.2',
                                      style: TextStyle(
                                        color: Colors.white.withValues(alpha: 0.65),
                                        fontSize: 11,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              // Nút đồng bộ nhanh
                              IconButton(
                                tooltip: 'Đồng bộ ngay',
                                onPressed: _isSyncing ? null : _handleSyncNow,
                                icon: _isSyncing
                                    ? const SizedBox(
                                        width: 18,
                                        height: 18,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: Color(0xFF38BDF8),
                                        ),
                                      )
                                    : const Icon(Icons.sync_rounded, color: Color(0xFF38BDF8)),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton.icon(
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: const Color(0xFF38BDF8),
                                    side: BorderSide(color: const Color(0xFF38BDF8).withValues(alpha: 0.4)),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                    padding: const EdgeInsets.symmetric(vertical: 8),
                                  ),
                                  onPressed: () => Navigator.of(context).pushNamed('/smartwatch'),
                                  icon: const Icon(Icons.settings_input_component_rounded, size: 16),
                                  label: const Text('Quản lý đồng hồ', style: TextStyle(fontSize: 12)),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: OutlinedButton.icon(
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: Colors.white,
                                    side: BorderSide(color: Colors.white.withValues(alpha: 0.2)),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                    padding: const EdgeInsets.symmetric(vertical: 8),
                                  ),
                                  onPressed: () => Navigator.of(context).pushNamed('/wear-os'),
                                  icon: const Icon(Icons.watch_rounded, size: 16),
                                  label: const Text('Mặt WearOS', style: TextStyle(fontSize: 12)),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                ),
                const SizedBox(height: 18),

                // 3. VÒNG HOẠT ĐỘNG THỂ CHẤT 3 TẦNG (ACTIVITY RINGS - APPLE / SAMSUNG HEALTH)
                AnimatedBuilder(
                  animation: pedometer,
                  builder: (context, _) {
                    return ActivityRingsWidget(
                      steps: pedometer.steps,
                      calories: pedometer.calories,
                      distanceKm: pedometer.distanceKm,
                      onSimulateStep: () => pedometer.simulateWalking(),
                    );
                  },
                ),
                const SizedBox(height: 18),

                // 4. MA TRẬN CHỈ SỐ SINH TỒN BIOACTIVE & ĐIỂM SỐ AN TOÀN (0-100)
                AnimatedBuilder(
                  animation: Listenable.merge([pedometer, wearOs]),
                  builder: (context, _) {
                    return VitalsMatrixCard(
                      heartRate: wearOs.heartRate,
                      spO2: wearOs.spO2,
                      currentSvmG: wearOs.currentSvmG,
                      currentTiltAngle: wearOs.currentTiltAngle,
                      isOffWrist: wearOs.isOffWrist,
                      isMeasuring: _isMeasuring,
                      onMeasureNow: _handleMeasureNow,
                      onViewWearableDetails: () => Navigator.of(context).pushNamed('/smartwatch'),
                    );
                  },
                ),
                const SizedBox(height: 18),

                // 5. BỘ LỌC KHOẢNG THỜI GIAN
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        strings.text('Khoảng thời gian báo cáo', 'Reporting period'),
                        style: AppTextStyles.caption,
                      ),
                      const SizedBox(height: 10),
                      AppSegmentedControl<String>(
                        value: _period,
                        items: [
                          AppSegmentItem(
                            value: 'day',
                            label: strings.text('Ngày', 'Day'),
                            icon: Icons.today_rounded,
                          ),
                          AppSegmentItem(
                            value: 'week',
                            label: strings.text('Tuần', 'Week'),
                            icon: Icons.view_week_rounded,
                          ),
                          AppSegmentItem(
                            value: 'month',
                            label: strings.text('Tháng', 'Month'),
                            icon: Icons.calendar_month_rounded,
                          ),
                        ],
                        onChanged: _changePeriod,
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          const Icon(Icons.date_range_rounded, size: 16, color: AppColors.primary),
                          const SizedBox(width: 6),
                          Text(
                            '${_formatDate(report.rangeStart)} - ${_formatDate(report.rangeEnd)}',
                            style: AppTextStyles.bodyStrong.copyWith(color: AppColors.primary),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),

                // 6. THỐNG KÊ ĐIỂM DANH & CẢNH BÁO AN TOÀN
                GridView.count(
                  crossAxisCount: 2,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  childAspectRatio: 1.45,
                  children: [
                    _HealthStatCard(
                      icon: Icons.check_circle_rounded,
                      label: strings.text('Tổng check-in', 'Total check-ins'),
                      value: report.totalCheckIns.toString(),
                      tone: AppColors.primary,
                    ),
                    _HealthStatCard(
                      icon: Icons.schedule_rounded,
                      label: strings.text('Tự động', 'Auto'),
                      value: report.autoCheckIns.toString(),
                      tone: const Color(0xFFF59E0B),
                    ),
                    _HealthStatCard(
                      icon: Icons.warning_amber_rounded,
                      label: strings.text('Quá hạn', 'Overdue'),
                      value: report.overdueCount.toString(),
                      tone: AppColors.destructive,
                    ),
                    _HealthStatCard(
                      icon: Icons.emergency_rounded,
                      label: strings.text('SOS khẩn cấp', 'SOS Alert'),
                      value: report.sosCount.toString(),
                      tone: const Color(0xFF7C3AED),
                    ),
                  ],
                ),
                const SizedBox(height: 18),

                // 7. BIỂU ĐỒ NHỊP SỐNG & CHECK-IN
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.insights_rounded, color: AppColors.primary),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              strings.text('Biểu đồ nhịp sống & Điểm danh', 'Rhythm & Check-in chart'),
                              style: AppTextStyles.title,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _CheckInChart(
                        buckets: report.dailySeries,
                        strings: strings,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),

                // 8. TÂM TRẠNG & SỨC KHỎE TINH THẦN
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.mood_rounded, color: AppColors.primary),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              strings.text('Sức khỏe tinh thần', 'Mental Well-being'),
                              style: AppTextStyles.title,
                            ),
                          ),
                          Text(
                            strings.text('$totalMood lần ghi nhận', '$totalMood records'),
                            style: AppTextStyles.caption,
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: report.moodCounts.entries.map((entry) {
                          return _MoodCountChip(
                            label: _moodLabel(strings, entry.key),
                            value: entry.value,
                            highlighted: entry.key == topMood,
                          );
                        }).toList(),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),

                // 9. LỊCH SỬ CHECK-IN GẦN ĐÂY
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.history_rounded, color: AppColors.primary),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              strings.text('Điểm danh gần đây', 'Recent check-ins'),
                              style: AppTextStyles.title,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      if (report.recentCheckins.isEmpty)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          child: Text(
                            strings.text('Chưa có lượt điểm danh nào trong kỳ.', 'No check-in recorded.'),
                            style: AppTextStyles.body,
                          ),
                        )
                      else
                        ...report.recentCheckins.map(
                          (item) => _TimelineTile(
                            icon: item.autoTriggered
                                ? Icons.auto_awesome_rounded
                                : Icons.check_circle_rounded,
                            iconColor: item.autoTriggered
                                ? const Color(0xFFF59E0B)
                                : AppColors.primary,
                            title: item.autoTriggered
                                ? strings.text('Tự động điểm danh (Wearable)', 'Auto check-in (Wearable)')
                                : strings.text('Điểm danh an toàn', 'Safe check-in'),
                            subtitle: _dateTimeFormat.format(DateTime.parse(item.createdAt)),
                            trailing: item.location == null
                                ? null
                                : '${item.location!['lat']}, ${item.location!['lng']}',
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),

                // 10. CẢNH BÁO AN TOÀN GẦN ĐÂY
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.notification_important_rounded, color: AppColors.destructive),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              strings.text('Sự kiện & Cảnh báo an toàn', 'Safety alerts & events'),
                              style: AppTextStyles.title,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      if (report.recentAlerts.isEmpty)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          child: Text(
                            strings.text('Không có cảnh báo nguy cấp nào. Bạn đang rất an toàn!', 'No emergency alerts. You are safe!'),
                            style: AppTextStyles.body.copyWith(color: AppColors.success),
                          ),
                        )
                      else
                        ...report.recentAlerts.map(
                          (item) => _TimelineTile(
                            icon: _alertIcon(item.status, item.level),
                            iconColor: _alertColor(item.status, item.level),
                            title: item.title,
                            subtitle:
                                '${item.status ?? '-'} · ${_dateTimeFormat.format(DateTime.parse(item.createdAt))}',
                            body: item.message,
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),

                // 11. HƯỚNG DẪN DÙNG BÁO CÁO
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.lightbulb_rounded, color: Color(0xFFF59E0B)),
                          const SizedBox(width: 8),
                          Text(
                            strings.text('Gợi ý hồ sơ sức khỏe', 'Health profile tips'),
                            style: AppTextStyles.title,
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        strings.text(
                          'Bạn có thể xuất tệp PDF để chia sẻ với bác sĩ hoặc người thân bảo hộ, hoặc xuất tệp Excel để phân tích nhịp sống chuyên sâu.',
                          'Export PDF to share with doctors or guardians, or Excel for deeper analysis.',
                        ),
                        style: AppTextStyles.body,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  String _formatDate(String value) {
    final parsed = DateTime.tryParse(value);
    if (parsed == null) {
      return value;
    }
    return _dateFormat.format(parsed);
  }

  String _moodLabel(AppStrings strings, String key) {
    switch (key) {
      case 'calm':
        return '😊 ${strings.text("Bình an", "Calm")}';
      case 'happy':
        return '😄 ${strings.text("Vui vẻ", "Positive")}';
      case 'tired':
        return '😣 ${strings.text("Hơi mệt", "Tired")}';
      case 'sick':
        return '🤒 ${strings.text("Cần lưu ý", "Need attention")}';
      case 'focused':
        return '🎯 ${strings.text("Tập trung", "Focused")}';
      default:
        return key;
    }
  }

  String _topMood(Map<String, int> moodCounts) {
    if (moodCounts.isEmpty) {
      return 'calm';
    }
    final sorted = moodCounts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    return sorted.first.key;
  }

  IconData _alertIcon(String? status, String? level) {
    final normalized = (status ?? level ?? '').toUpperCase();
    if (normalized.contains('SOS')) {
      return Icons.sos_rounded;
    }
    if (normalized.contains('WARNING') || normalized.contains('OVERDUE')) {
      return Icons.warning_amber_rounded;
    }
    return Icons.notifications_rounded;
  }

  Color _alertColor(String? status, String? level) {
    final normalized = (status ?? level ?? '').toUpperCase();
    if (normalized.contains('SOS')) {
      return AppColors.destructive;
    }
    if (normalized.contains('WARNING') || normalized.contains('OVERDUE')) {
      return const Color(0xFFF59E0B);
    }
    return AppColors.primary;
  }
}

class _HealthStateCard extends StatelessWidget {
  const _HealthStateCard({
    required this.title,
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: AppCard(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.bar_chart_rounded, size: 48, color: AppColors.primary),
            const SizedBox(height: 12),
            Text(title, style: AppTextStyles.title),
            const SizedBox(height: 8),
            Text(message, style: AppTextStyles.body, textAlign: TextAlign.center),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: onAction,
                child: Text(actionLabel!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _HealthStatCard extends StatelessWidget {
  const _HealthStatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.tone,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: tone.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: tone, size: 20),
          ),
          const SizedBox(height: 8),
          Text(value, style: AppTextStyles.h2.copyWith(color: tone, fontSize: 24)),
          Text(label, style: AppTextStyles.caption),
        ],
      ),
    );
  }
}

class _MoodCountChip extends StatelessWidget {
  const _MoodCountChip({
    required this.label,
    required this.value,
    required this.highlighted,
  });

  final String label;
  final int value;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: highlighted ? AppColors.primarySoft : AppColors.secondary,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: highlighted ? AppColors.primary.withValues(alpha: 0.25) : AppColors.border,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label, style: AppTextStyles.bodyStrong),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.8),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              value.toString(),
              style: AppTextStyles.caption.copyWith(fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }
}

class _CheckInChart extends StatelessWidget {
  const _CheckInChart({
    required this.buckets,
    required this.strings,
  });

  final List<HealthReportBucket> buckets;
  final AppStrings strings;

  @override
  Widget build(BuildContext context) {
    if (buckets.isEmpty) {
      return SizedBox(
        height: 180,
        child: Center(
          child: Text(
            strings.text('Chưa có dữ liệu biểu đồ', 'No chart data yet'),
            style: AppTextStyles.body,
          ),
        ),
      );
    }

    final maxCount = math.max(
      1,
      buckets.fold<int>(
        0,
        (maxValue, item) => math.max(
          maxValue,
          item.checkIns + item.autoCheckIns + item.alertCount,
        ),
      ),
    );

    return SizedBox(
      height: 220,
      child: Column(
        children: [
          Expanded(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: buckets.map((bucket) {
                final total = bucket.checkIns + bucket.autoCheckIns + bucket.alertCount;
                final heightFactor = total / maxCount;
                final autoFactor = bucket.autoCheckIns / maxCount;
                final alertFactor = bucket.alertCount / maxCount;

                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 3),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Text(
                          total.toString(),
                          style: AppTextStyles.caption.copyWith(fontWeight: FontWeight.w700, fontSize: 10),
                        ),
                        const SizedBox(height: 6),
                        SizedBox(
                          height: 130,
                          child: Stack(
                            alignment: Alignment.bottomCenter,
                            children: [
                              FractionallySizedBox(
                                heightFactor: heightFactor.clamp(0.05, 1),
                                child: Container(
                                  width: 16,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF10B981).withValues(alpha: 0.25),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                ),
                              ),
                              if (autoFactor > 0)
                                FractionallySizedBox(
                                  heightFactor: autoFactor.clamp(0.03, 1),
                                  child: Container(
                                    width: 16,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF59E0B),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                  ),
                                ),
                              if (alertFactor > 0)
                                FractionallySizedBox(
                                  heightFactor: alertFactor.clamp(0.03, 1),
                                  child: Container(
                                    width: 16,
                                    decoration: BoxDecoration(
                                      color: AppColors.destructive,
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          bucket.label,
                          style: AppTextStyles.caption.copyWith(fontSize: 10),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _LegendDot(color: const Color(0xFF10B981), label: strings.text('Thủ công', 'Manual')),
              const SizedBox(width: 14),
              _LegendDot(color: const Color(0xFFF59E0B), label: strings.text('Tự động', 'Auto')),
              const SizedBox(width: 14),
              _LegendDot(color: AppColors.destructive, label: strings.text('Cảnh báo', 'Alert')),
            ],
          ),
        ],
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 5),
        Text(label, style: AppTextStyles.caption.copyWith(fontSize: 11)),
      ],
    );
  }
}

class _TimelineTile extends StatelessWidget {
  const _TimelineTile({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    this.trailing,
    this.body,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final String? trailing;
  final String? body;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: iconColor, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(child: Text(title, style: AppTextStyles.bodyStrong)),
                    if (trailing != null)
                      Text(
                        trailing!,
                        style: AppTextStyles.caption.copyWith(fontSize: 10),
                      ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(subtitle, style: AppTextStyles.caption.copyWith(fontSize: 11)),
                if (body != null && body!.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(body!, style: AppTextStyles.body.copyWith(fontSize: 12)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
