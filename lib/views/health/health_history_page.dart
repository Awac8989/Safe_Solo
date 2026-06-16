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

  @override
  void initState() {
    super.initState();
    _period = 'month';
    _future = _load();
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

    return AppPage(
      safeBottom: true,
      child: FutureBuilder<HealthReportModel>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
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
            onRefresh: _refresh,
            child: ListView(
              physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
              padding: const EdgeInsets.only(top: 18, bottom: 124),
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            strings.text('Lịch sử sức khỏe', 'Health history'),
                            style: AppTextStyles.h2.copyWith(fontSize: 28),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            strings.text(
                              'Biểu đồ check-in, tâm trạng và cảnh báo theo thời gian.',
                              'Check-in, mood, and alert trends over time.',
                            ),
                            style: AppTextStyles.body,
                          ),
                        ],
                      ),
                    ),
                    AppRoundIconButton(
                      icon: Icons.picture_as_pdf_rounded,
                      onPressed: () => _exportPdf(report),
                    ),
                    const SizedBox(width: 10),
                    AppRoundIconButton(
                      icon: Icons.table_view_rounded,
                      onPressed: () => _exportExcel(report),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        strings.text('Khoảng thời gian', 'Time range'),
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
                      Text(
                        '${_formatDate(report.rangeStart)} - ${_formatDate(report.rangeEnd)}',
                        style: AppTextStyles.bodyStrong.copyWith(color: AppColors.primary),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
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
                      label: strings.text('SOS', 'SOS'),
                      value: report.sosCount.toString(),
                      tone: const Color(0xFF7C3AED),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
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
                              strings.text('Biểu đồ check-in', 'Check-in chart'),
                              style: AppTextStyles.title,
                            ),
                          ),
                          Text(
                            strings.text('Nhịp sống', 'Life rhythm'),
                            style: AppTextStyles.caption,
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
                              strings.text('Tâm trạng', 'Mood'),
                              style: AppTextStyles.title,
                            ),
                          ),
                          Text(
                            strings.text('$totalMood lần', '$totalMood times'),
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
                              strings.text('Check-in gần đây', 'Recent check-ins'),
                              style: AppTextStyles.title,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      ...report.recentCheckins.map(
                        (item) => _TimelineTile(
                          icon: item.autoTriggered
                              ? Icons.auto_awesome_rounded
                              : Icons.check_circle_rounded,
                          iconColor: item.autoTriggered
                              ? const Color(0xFFF59E0B)
                              : AppColors.primary,
                          title: item.autoTriggered
                              ? strings.text('Tự check-in', 'Auto check-in')
                              : strings.text('Điểm danh', 'Check-in'),
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
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.notification_important_rounded, color: AppColors.primary),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              strings.text('Cảnh báo gần đây', 'Recent alerts'),
                              style: AppTextStyles.title,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
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
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        strings.text('Gợi ý dùng báo cáo', 'How to use the report'),
                        style: AppTextStyles.title,
                      ),
                      const SizedBox(height: 10),
                      Text(
                        strings.text(
                          'Bạn có thể xuất PDF để gửi cho người thân/bác sĩ hoặc xuất Excel để lọc và thống kê chi tiết.',
                          'Export PDF for family/doctor or Excel for deeper filtering and analysis.',
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
        return strings.text('Bình an', 'Calm');
      case 'happy':
        return strings.text('Tích cực', 'Positive');
      case 'tired':
        return strings.text('Hơi mệt', 'Tired');
      case 'sick':
        return strings.text('Cần lưu ý', 'Need attention');
      case 'focused':
        return strings.text('Đang tập trung', 'Focused');
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
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: tone.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: tone),
          ),
          const SizedBox(height: 10),
          Text(value, style: AppTextStyles.h2.copyWith(color: tone)),
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
          Text(value.toString(), style: AppTextStyles.caption),
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
      height: 240,
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
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Text(
                          total.toString(),
                          style: AppTextStyles.caption.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 6),
                        SizedBox(
                          height: 150,
                          child: Stack(
                            alignment: Alignment.bottomCenter,
                            children: [
                              FractionallySizedBox(
                                heightFactor: heightFactor.clamp(0.05, 1),
                                child: Container(
                                  width: 18,
                                  decoration: BoxDecoration(
                                    color: AppColors.primarySoft,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                ),
                              ),
                              if (autoFactor > 0)
                                FractionallySizedBox(
                                  heightFactor: autoFactor.clamp(0.03, 1),
                                  child: Container(
                                    width: 18,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF59E0B),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                  ),
                                ),
                              if (alertFactor > 0)
                                Positioned(
                                  top: 0,
                                  child: Container(
                                    width: 8,
                                    height: 8,
                                    decoration: const BoxDecoration(
                                      color: AppColors.destructive,
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          bucket.label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.caption,
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
              _LegendDot(color: AppColors.primarySoft, label: strings.text('Check-in', 'Check-in')),
              const SizedBox(width: 12),
              _LegendDot(color: const Color(0xFFF59E0B), label: strings.text('Tự động', 'Auto')),
              const SizedBox(width: 12),
              _LegendDot(color: AppColors.destructive, label: strings.text('Cảnh báo', 'Alerts')),
            ],
          ),
        ],
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({
    required this.color,
    required this.label,
  });

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text(label, style: AppTextStyles.caption),
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
    this.body,
    this.trailing,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final String? body;
  final String? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.secondary,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: iconColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: iconColor, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(child: Text(title, style: AppTextStyles.title)),
                      if (trailing != null) Text(trailing!, style: AppTextStyles.caption),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(subtitle, style: AppTextStyles.caption),
                  if (body != null && body!.trim().isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(body!, style: AppTextStyles.body),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
