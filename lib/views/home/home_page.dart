import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/app_theme.dart';
import '../../core/providers/app_provider.dart';
import '../../core/widgets/app_shell.dart';
import '../community_radar/community_radar_page.dart';
import '../sos_map/sos_map_page.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  static const _demoPushKey = 'safesolo_demo_push_v1';
  Timer? _ticker;
  Timer? _demoPushTimer;
  Timer? _holdTimer;
  DateTime _now = DateTime.now();

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() => _now = DateTime.now());
      }
    });
    _scheduleDemoPush();
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _demoPushTimer?.cancel();
    _holdTimer?.cancel();
    super.dispose();
  }

  Future<void> _handleCheckIn(Mood mood) async {
    try {
      await context.read<AppProvider>().checkIn(mood: mood);
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Check-in thanh cong va da cap nhat vi tri.')),
      );
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  void _startHoldSos() {
    _holdTimer?.cancel();
    _holdTimer = Timer(const Duration(seconds: 3), () async {
      if (!mounted) {
        return;
      }
      await Navigator.push(
        context,
        MaterialPageRoute<void>(
          builder: (_) => const SosMapPage(victimName: 'Ho Van Tai'),
        ),
      );
    });
  }

  void _cancelHoldSos() {
    _holdTimer?.cancel();
  }

  Future<void> _shareMood(Mood mood) async {
    await context.read<AppProvider>().createCirclePost(
      message: 'Trang thai nhanh hom nay: ${_moodText(mood)}.',
      mood: mood,
      scope: CircleScope.family,
    );
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Da chia se trang thai nhanh.')));
  }

  @override
  Widget build(BuildContext context) {
    final appProvider = context.watch<AppProvider>();
    final user = appProvider.user;
    final userName = user?.name ?? 'Ban';
    final lastCheckIn = user?.lastCheckinTime ?? DateTime.now();
    final nextDeadline = user?.nextDeadline ?? lastCheckIn.add(const Duration(hours: 12));
    final remaining = nextDeadline.difference(_now);
    final safe = !remaining.isNegative && (user?.currentStatus ?? 'SAFE') == 'SAFE';
    final guardians = user?.emergencyContacts.take(3).toList() ?? const [];

    return AppPage(
      child: ListView(
        padding: const EdgeInsets.only(top: 20, bottom: 28),
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _formatDate(_now),
                      style: AppTextStyles.bodyStrong.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            'Xin chao, $userName!',
                            style: AppTextStyles.h2.copyWith(fontSize: 30),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFF1D7),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.local_fire_department_rounded,
                                color: AppColors.warning,
                                size: 16,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                '${appProvider.streak}',
                                style: AppTextStyles.bodyStrong.copyWith(
                                  color: AppColors.warning,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              AppRoundIconButton(
                icon: Icons.account_circle_outlined,
                onPressed: () => Navigator.pushNamed(context, '/settings'),
              ),
            ],
          ),
          const SizedBox(height: 20),
          if (appProvider.isVacation)
            MaterialBanner(
              backgroundColor: const Color(0xFFE8F1FF),
              content: const Text(
                'Che do nghi duong dang bat. Countdown tam dung cho den khi ban tat sleep mode.',
              ),
              leading: const Icon(Icons.hotel_rounded, color: Color(0xFF3A7AFE)),
              actions: const [SizedBox.shrink()],
            ),
          if (appProvider.isVacation) const SizedBox(height: 14),
          AppCard(
            child: Row(
              children: [
                const Icon(Icons.wb_sunny_outlined, color: AppColors.warning),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text(
                    'Chao buoi sang. Xac nhan ban da xem de he thong ghi nhan tuong tac som nay.',
                  ),
                ),
                const SizedBox(width: 10),
                TextButton(
                  onPressed: appProvider.isBusy
                      ? null
                      : () async {
                          try {
                            await context.read<AppProvider>().acknowledgeReminder();
                            if (!context.mounted) {
                              return;
                            }
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Da ghi nhan tuong tac buoi sang.')),
                            );
                          } catch (error) {
                            if (!context.mounted) {
                              return;
                            }
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(error.toString())),
                            );
                          }
                        },
                  child: const Text('Da xem'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          AppCard(
            color: const Color(0xFFFFFBF4),
            child: Row(
              children: [
                const Icon(Icons.phone_outlined, color: AppColors.primary),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    user == null
                        ? 'Chua co ho so'
                        : 'Lien he khan cap: ${user.emergencyContacts.isEmpty ? 'chua cap nhat' : user.emergencyContacts.first.name}',
                    style: AppTextStyles.bodyStrong,
                  ),
                ),
                if (user != null && user.emergencyContacts.isNotEmpty)
                  Text(
                    user.emergencyContacts.first.phone,
                    style: AppTextStyles.caption,
                  ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          GestureDetector(
            onTap: appProvider.isBusy
                ? null
                : () => _openMoodPrompt(),
            onTapDown: (_) => _startHoldSos(),
            onTapUp: (_) => _cancelHoldSos(),
            onTapCancel: _cancelHoldSos,
            child: Center(
              child: Container(
                width: 290,
                height: 290,
                decoration: BoxDecoration(
                  gradient: safe ? AppColors.safeGradient : AppColors.dangerGradient,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.primarySoft, width: 2),
                  boxShadow: safe ? AppShadows.safe : AppShadows.danger,
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (appProvider.isBusy)
                      const SizedBox(
                        width: 40,
                        height: 40,
                        child: CircularProgressIndicator(
                          strokeWidth: 3,
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      )
                    else
                      Icon(
                        safe ? Icons.check_rounded : Icons.priority_high_rounded,
                        size: 78,
                        color: Colors.white,
                      ),
                    const SizedBox(height: 10),
                    Text(
                      safe ? 'Da diem danh' : 'Can check-in',
                      style: AppTextStyles.h3.copyWith(color: Colors.white),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      safe
                          ? 'Cham de gui vi tri va xac nhan an toan'
                          : 'Deadline dang den gan, hay xac nhan ban van on',
                      textAlign: TextAlign.center,
                      style: AppTextStyles.bodyLarge.copyWith(
                        color: Colors.white.withValues(alpha: 0.92),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 18),
          if (guardians.isNotEmpty)
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Guardians online', style: AppTextStyles.title),
                  const SizedBox(height: 12),
                  for (final guardian in guardians) ...[
                    Row(
                      children: [
                        Container(
                          width: 42,
                          height: 42,
                          decoration: const BoxDecoration(
                            color: AppColors.primarySoft,
                            shape: BoxShape.circle,
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            guardian.name.substring(0, 1).toUpperCase(),
                            style: AppTextStyles.bodyStrong.copyWith(
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(guardian.name, style: AppTextStyles.bodyStrong),
                              Text(guardian.relation, style: AppTextStyles.caption),
                            ],
                          ),
                        ),
                        const Icon(Icons.battery_5_bar_rounded, size: 18, color: AppColors.primary),
                        const SizedBox(width: 4),
                        Text(
                          _guardianBattery(guardian.phone),
                          style: AppTextStyles.caption,
                        ),
                        const SizedBox(width: 8),
                        const CircleAvatar(radius: 5, backgroundColor: AppColors.success),
                      ],
                    ),
                    if (guardian != guardians.last) const SizedBox(height: 10),
                  ],
                ],
              ),
            ),
          const SizedBox(height: 28),
          Center(
            child: Text(
              'CON LAI',
              style: AppTextStyles.caption.copyWith(
                color: AppColors.textSecondary,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(height: 6),
          Center(
            child: Text(
              _formatDuration(remaining),
              style: AppTextStyles.timer.copyWith(fontSize: 54),
            ),
          ),
          const SizedBox(height: 10),
          Center(
            child: Text(
              'Lan check-in cuoi: ${_formatTime(lastCheckIn)}',
              style: AppTextStyles.bodyLarge.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
          ),
          const SizedBox(height: 24),
          Text('Trang thai nhanh', style: AppTextStyles.title),
          const SizedBox(height: 10),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: Mood.values
                .map(
                  (mood) => ActionChip(
                    label: Text(_moodText(mood)),
                    avatar: Icon(_moodIcon(mood), size: 18),
                    onPressed: () => _shareMood(mood),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: _StatCard(
                  icon: Icons.monitor_heart_outlined,
                  label: 'STATUS',
                  value: user?.currentStatus ?? 'SAFE',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _StatCard(
                  icon: Icons.schedule_rounded,
                  label: 'QUIET HOURS',
                  value: user == null
                      ? '--'
                      : '${user.quietHoursStart}-${user.quietHoursEnd}',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _StatCard(
                  icon: Icons.medication_outlined,
                  label: 'THUOC',
                  value: appProvider.automation.pillReminder
                      ? appProvider.automation.pillTime
                      : 'Tat',
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (user?.lastKnownLocation != null)
            AppCard(
              child: Row(
                children: [
                  const Icon(Icons.my_location_rounded, color: AppColors.primary),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Vi tri cuoi: ${user!.lastKnownLocation!.lat.toStringAsFixed(5)}, ${user.lastKnownLocation!.lng.toStringAsFixed(5)}',
                      style: AppTextStyles.bodyStrong,
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 14),
          if (appProvider.alertPolicy != null)
            AppCard(
              child: Row(
                children: [
                  const Icon(Icons.warning_amber_rounded, color: AppColors.warning),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Policy: nhac truoc ${appProvider.alertPolicy!.level1Minutes}p, bao dong sau ${appProvider.alertPolicy!.level2Minutes}p, SOS sau ${appProvider.alertPolicy!.level3Minutes}p.',
                      style: AppTextStyles.bodyStrong,
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 14),
          if (appProvider.interactionEvents.isNotEmpty) ...[
            Text('Lich su tuong tac', style: AppTextStyles.title),
            const SizedBox(height: 10),
            for (final item in appProvider.interactionEvents.take(4)) ...[
              AppCard(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                child: Row(
                  children: [
                    const Icon(Icons.bolt_rounded, color: AppColors.primary),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            appProvider.formatInteractionType(item.type),
                            style: AppTextStyles.bodyStrong,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _formatEventTime(item.createdAt),
                            style: AppTextStyles.caption,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
            ],
          ],
        ],
      ),
    );
  }

  Future<void> _openMoodPrompt() async {
    final selected = await showModalBottomSheet<Mood>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xxl)),
      ),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Ban dang the nao?', style: AppTextStyles.h3),
              const SizedBox(height: 16),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  _MoodChoice(mood: Mood.happy, label: 'Khoe'),
                  _MoodChoice(mood: Mood.calm, label: 'Binh thuong'),
                  _MoodChoice(mood: Mood.sick, label: 'Met'),
                ].map((item) {
                  return ChoiceChip(
                    label: Text(item.label),
                    avatar: Text(item.emoji, style: const TextStyle(fontSize: 18)),
                    selected: false,
                    onSelected: (_) => Navigator.pop(context, item.mood),
                  );
                }).toList(),
              ),
              const SizedBox(height: 20),
            ],
          ),
        );
      },
    );

    if (selected != null) {
      await _handleCheckIn(selected);
    }
  }

  Future<void> _scheduleDemoPush() async {
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(_demoPushKey) == true) {
      return;
    }

    _demoPushTimer = Timer(const Duration(seconds: 4), () async {
      if (!mounted) {
        return;
      }
      final opened = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => Dialog(
          backgroundColor: Colors.transparent,
          child: GestureDetector(
            onTap: () => Navigator.pop(dialogContext, true),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: AppColors.dangerGradient,
                borderRadius: BorderRadius.circular(AppRadius.xl),
                boxShadow: AppShadows.danger,
              ),
              child: Row(
                children: [
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.18),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.notifications_active_rounded, color: Colors.white),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'SOS gan ban · 800m',
                          style: AppTextStyles.bodyStrong.copyWith(color: Colors.white),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Cham de mo Community Radar va xem yeu cau ho tro khan.',
                          style: AppTextStyles.body.copyWith(color: Colors.white),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
      await prefs.setBool(_demoPushKey, true);
      if (opened == true && mounted) {
        await Navigator.push(
          context,
          MaterialPageRoute<void>(
            builder: (_) => const CommunityRadarPage(),
          ),
        );
      }
    });
  }

  String _formatDate(DateTime date) {
    const weekdays = [
      'Thu hai',
      'Thu ba',
      'Thu tu',
      'Thu nam',
      'Thu sau',
      'Thu bay',
      'Chu nhat',
    ];
    return '${weekdays[date.weekday - 1]}, ${date.day}/${date.month}/${date.year}';
  }

  String _formatTime(DateTime date) {
    final hour = date.hour.toString().padLeft(2, '0');
    final minute = date.minute.toString().padLeft(2, '0');
    return '$hour:$minute';
  }

  String _formatDuration(Duration duration) {
    if (duration.isNegative) {
      return '00:00:00';
    }
    final hours = duration.inHours.toString().padLeft(2, '0');
    final minutes = (duration.inMinutes % 60).toString().padLeft(2, '0');
    final seconds = (duration.inSeconds % 60).toString().padLeft(2, '0');
    return '$hours:$minutes:$seconds';
  }

  String _formatEventTime(DateTime value) {
    final hour = value.hour.toString().padLeft(2, '0');
    final minute = value.minute.toString().padLeft(2, '0');
    final day = value.day.toString().padLeft(2, '0');
    final month = value.month.toString().padLeft(2, '0');
    return '$hour:$minute - $day/$month';
  }

  String _moodText(Mood mood) {
    switch (mood) {
      case Mood.calm:
        return 'Binh an';
      case Mood.happy:
        return 'Tich cuc';
      case Mood.tired:
        return 'Hoi met';
      case Mood.sick:
        return 'Can luu y';
      case Mood.focused:
        return 'Dang tap trung';
    }
  }

  IconData _moodIcon(Mood mood) {
    switch (mood) {
      case Mood.calm:
        return Icons.favorite_border_rounded;
      case Mood.happy:
        return Icons.sentiment_satisfied_alt_rounded;
      case Mood.tired:
        return Icons.nightlight_round;
      case Mood.sick:
        return Icons.medication_outlined;
      case Mood.focused:
        return Icons.psychology_alt_outlined;
    }
  }

  String _guardianBattery(String phone) {
    final digits = phone.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.isEmpty) {
      return '67%';
    }
    final last = int.tryParse(digits.substring(digits.length - 1)) ?? 5;
    return '${35 + (last * 6).clamp(0, 60)}%';
  }
}

class _MoodChoice {
  const _MoodChoice({
    required this.mood,
    required this.label,
  });

  final Mood mood;
  final String label;

  String get emoji {
    return switch (mood) {
      Mood.happy => '😊',
      Mood.calm => '😐',
      Mood.sick => '🤒',
      Mood.tired => '😴',
      Mood.focused => '🧠',
    };
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: AppColors.textSecondary),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(value, style: AppTextStyles.h3.copyWith(fontSize: 18)),
        ],
      ),
    );
  }
}
