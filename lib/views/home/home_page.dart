import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/app_strings.dart';
import '../../core/app_theme.dart';
import '../../core/providers/app_provider.dart';
import '../../core/widgets/app_shell.dart';
import '../../core/widgets/top_toast.dart';
import '../community_radar/community_radar_page.dart';
import '../sos_map/sos_map_page.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> with SingleTickerProviderStateMixin {
  static const _demoPushKey = 'safesolo_demo_push_v1';

  late final AnimationController _pulseController = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1500),
  )..repeat(reverse: true);

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
    _pulseController.dispose();
    _ticker?.cancel();
    _demoPushTimer?.cancel();
    _holdTimer?.cancel();
    super.dispose();
  }

  Future<void> _handleCheckIn(Mood? mood) async {
    final strings = AppStrings(context.read<AppProvider>().language);
    if (context.read<AppProvider>().user == null) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            strings.text(
              'Chưa có hồ sơ đăng nhập. Vui lòng đăng nhập lại trước khi điểm danh.',
              'No signed-in profile found. Please sign in again before checking in.',
            ),
          ),
        ),
      );
      Navigator.pushNamedAndRemoveUntil(context, '/auth', (_) => false);
      return;
    }

    try {
      await context.read<AppProvider>().checkIn(mood: mood);
      if (!mounted) {
        return;
      }
      TopToast.show(
        context,
        message: strings.text('Đã điểm danh và cập nhật an toàn.', 'Check-in completed and safety status updated.'),
      );
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
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
          builder: (_) => const SosMapPage(victimName: 'Hồ Văn Tài'),
        ),
      );
    });
  }

  void _cancelHoldSos() {
    _holdTimer?.cancel();
  }

  Future<void> _handleCircleTap() async {
    debugPrint('[HomePage] check-in circle tapped');
    if (context.read<AppProvider>().isBusy) {
      return;
    }
    await _openMoodPrompt();
  }

  Future<void> _shareMood(Mood mood) async {
    final strings = AppStrings(context.read<AppProvider>().language);
    await context.read<AppProvider>().createCirclePost(
      message: strings.text(
        'Trạng thái nhanh hôm nay: ${strings.moodLabel(mood)}.',
        'Quick status today: ${strings.moodLabel(mood)}.',
      ),
      mood: mood,
      scope: CircleScope.family,
    );
    if (!mounted) {
      return;
    }
    TopToast.show(
      context,
      message: strings.text('Đã chia sẻ trạng thái với gia đình.', 'Status shared with family.'),
      icon: Icons.favorite_rounded,
    );
  }

  @override
  Widget build(BuildContext context) {
    final appProvider = context.watch<AppProvider>();
    final strings = AppStrings.of(context);
    final user = appProvider.user;
    final userName = user?.name ?? strings.text('Bạn', 'You');
    final lastCheckIn = user?.lastCheckinTime ?? DateTime.now();
    final nextDeadline =
        user?.nextDeadline ?? lastCheckIn.add(const Duration(hours: 12));
    final remaining = nextDeadline.difference(_now);
    final state = _buttonState(remaining, appProvider.isVacation);
    final guardians = user?.emergencyContacts.take(3).toList() ?? const [];
    final mood = appProvider.mood;
    final pulse = 1 + (_pulseController.value * state.pulseStrength);

    return AppPage(
      child: ListView(
        physics: const BouncingScrollPhysics(),
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
                      _formatDate(_now, strings),
                      style: AppTextStyles.bodyStrong.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      strings.text('Xin chào,\n$userName!', 'Hello,\n$userName!'),
                      style: AppTextStyles.h2.copyWith(fontSize: 28, height: 1.05),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              Column(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
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
                  const SizedBox(height: 10),
                  AppRoundIconButton(
                    icon: Icons.account_circle_outlined,
                    onPressed: () => Navigator.pushNamed(context, '/settings'),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 18),
          if (appProvider.isVacation) ...[
            MaterialBanner(
              backgroundColor: const Color(0xFFE8F1FF),
              content: Text(
                strings.text(
                  'Chế độ nghỉ dưỡng đang bật. Đồng hồ điểm danh đang được tạm dừng.',
                  'Vacation mode is on. The check-in countdown is currently paused.',
                ),
              ),
              leading: const Icon(Icons.hotel_rounded, color: Color(0xFF3A7AFE)),
              actions: const [SizedBox.shrink()],
            ),
            const SizedBox(height: 14),
          ],
          if (guardians.isNotEmpty)
            AppCard(
              color: const Color(0xFFFFFBF4),
              child: Row(
                children: [
                  const Icon(Icons.phone_outlined, color: AppColors.primary),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      strings.text(
                        'Liên hệ khẩn cấp: ${guardians.first.name}',
                        'Emergency contact: ${guardians.first.name}',
                      ),
                      style: AppTextStyles.bodyStrong,
                    ),
                  ),
                  Text(guardians.first.phone, style: AppTextStyles.caption),
                ],
              ),
            ),
          if (guardians.isNotEmpty) const SizedBox(height: 22),
          Center(
            child: SizedBox(
              width: 340,
              height: 340,
              child: AnimatedBuilder(
                animation: _pulseController,
                builder: (context, child) {
                  return Stack(
                    alignment: Alignment.center,
                    children: [
                      for (final ring in [0.0, 0.18, 0.36, 0.54])
                        _PulseRing(
                          progress: (_pulseController.value + ring) % 1,
                          color: _statusStripColor(state),
                        ),
                      Transform.scale(scale: pulse, child: child),
                      SizedBox(
                        width: 292,
                        height: 292,
                        child: GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: _handleCircleTap,
                          onTapDown: (_) => _startHoldSos(),
                          onTapUp: (_) => _cancelHoldSos(),
                          onTapCancel: _cancelHoldSos,
                          child: const SizedBox.expand(),
                        ),
                      ),
                    ],
                  );
                },
                child: Container(
                  width: 292,
                  height: 292,
                  decoration: BoxDecoration(
                    gradient: state.gradient,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.85),
                      width: 6,
                    ),
                    boxShadow: state.shadow,
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (appProvider.isBusy)
                        const SizedBox(
                          width: 38,
                          height: 38,
                          child: CircularProgressIndicator(
                            strokeWidth: 3,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      else
                        Icon(
                          state.icon,
                          size: 68,
                          color: Colors.white,
                        ),
                      const SizedBox(height: 12),
                      Text(
                        state.title(strings),
                        style: AppTextStyles.h2.copyWith(
                          color: Colors.white,
                          fontSize: 22,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        state.subtitle(strings),
                        textAlign: TextAlign.center,
                        style: AppTextStyles.bodyLarge.copyWith(
                          color: Colors.white.withValues(alpha: 0.94),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 22),
          Center(
            child: Text(
              strings.text('CÒN LẠI', 'REMAINING'),
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
              appProvider.isVacation ? '--:--:--' : _formatDuration(remaining),
              style: AppTextStyles.timer.copyWith(fontSize: 54),
            ),
          ),
          const SizedBox(height: 10),
          Center(
            child: Text(
              strings.text(
                'Lần điểm danh cuối: ${_formatTime(lastCheckIn)}${mood == null ? '' : ' · Tâm trạng ${_emojiForMood(mood)}'}',
                'Last check-in: ${_formatTime(lastCheckIn)}${mood == null ? '' : ' · Mood ${_emojiForMood(mood)}'}',
              ),
              style: AppTextStyles.bodyLarge.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
          ),
          const SizedBox(height: 14),
          AppCard(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            color: _statusStripColor(state).withValues(alpha: 0.12),
            border: Border.all(
              color: _statusStripColor(state).withValues(alpha: 0.24),
            ),
            shadow: const [],
            child: Row(
              children: [
                Icon(
                  mood == null ? Icons.info_outline_rounded : _moodIcon(mood),
                  color: _statusStripColor(state),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    mood == null
                        ? strings.text(
                            'Chạm nút lớn để điểm danh và chọn cảm xúc hôm nay.',
                            'Tap the main button to check in and choose today’s mood.',
                          )
                        : strings.text(
                            'Tâm trạng hiện tại: ${strings.moodLabel(mood)}',
                            'Current mood: ${strings.moodLabel(mood)}',
                          ),
                    style: AppTextStyles.bodyStrong.copyWith(
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          if (guardians.isNotEmpty)
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    strings.text('Người bảo hộ đang online', 'Guardians online'),
                    style: AppTextStyles.title,
                  ),
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
                        const Icon(
                          Icons.battery_5_bar_rounded,
                          size: 18,
                          color: AppColors.primary,
                        ),
                        const SizedBox(width: 4),
                        Text(_guardianBattery(guardian.phone), style: AppTextStyles.caption),
                        const SizedBox(width: 8),
                        const CircleAvatar(
                          radius: 5,
                          backgroundColor: AppColors.success,
                        ),
                      ],
                    ),
                    if (guardian != guardians.last) const SizedBox(height: 10),
                  ],
                ],
              ),
            ),
          if (guardians.isNotEmpty) const SizedBox(height: 24),
          Text(
            strings.text('Trạng thái nhanh', 'Quick status'),
            style: AppTextStyles.title,
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: Mood.values
                .map(
                  (moodValue) => ActionChip(
                    label: Text(strings.moodLabel(moodValue)),
                    avatar: Text(_emojiForMood(moodValue)),
                    onPressed: () => _shareMood(moodValue),
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
                  label: strings.text('TRẠNG THÁI', 'STATUS'),
                  value: _statusLabel(strings, state),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _StatCard(
                  icon: Icons.schedule_rounded,
                  label: strings.text('GIỜ YÊN LẶNG', 'QUIET HOURS'),
                  value: user == null
                      ? '--'
                      : '${user.quietHoursStart}-${user.quietHoursEnd}',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _StatCard(
                  icon: Icons.medication_outlined,
                  label: strings.text('THUỐC', 'MEDS'),
                  value: appProvider.automation.pillReminder
                      ? appProvider.automation.pillTime
                      : strings.text('Tắt', 'Off'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _openMoodPrompt() async {
    final strings = AppStrings.of(context);
    final selected = await showDialog<Mood?>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.28),
      builder: (dialogContext) {
        return Dialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.xl),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 22, 20, 18),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  strings.text('Hôm nay bạn cảm thấy thế nào?', 'How are you feeling today?'),
                  style: AppTextStyles.h3.copyWith(fontSize: 20),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  strings.text(
                    'Người bảo hộ sẽ thấy tâm trạng của bạn',
                    'Your guardians will see your current mood',
                  ),
                  style: AppTextStyles.bodyLarge.copyWith(
                    color: AppColors.textSecondary,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Expanded(
                      child: _MoodOption(
                        emoji: '😊',
                        label: strings.text('Vui vẻ', 'Happy'),
                        onTap: () => Navigator.pop(dialogContext, Mood.happy),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _MoodOption(
                        emoji: '😐',
                        label: strings.text('Bình thường', 'Normal'),
                        onTap: () => Navigator.pop(dialogContext, Mood.calm),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _MoodOption(
                        emoji: '🤒',
                        label: strings.text('Mệt / Ốm', 'Tired / Sick'),
                        onTap: () => Navigator.pop(dialogContext, Mood.sick),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext, null),
                  child: Text(strings.text('Bỏ qua', 'Skip')),
                ),
              ],
            ),
          ),
        );
      },
    );

    await _handleCheckIn(selected);
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
      TopToast.show(
        context,
        message: '🚨 ${AppStrings.of(context).text('SOS gần bạn · 800m', 'Nearby SOS · 800m')}',
        icon: Icons.notifications_active_rounded,
        duration: const Duration(seconds: 3),
      );
      await prefs.setBool(_demoPushKey, true);
      if (!mounted) {
        return;
      }
      await Navigator.push(
        context,
        MaterialPageRoute<void>(builder: (_) => const CommunityRadarPage()),
      );
    });
  }

  _CheckinButtonState _buttonState(Duration remaining, bool isVacation) {
    if (isVacation) {
      return _CheckinButtonState(
        gradient: AppColors.safeGradient,
        shadow: AppShadows.safe,
        icon: Icons.hotel_rounded,
        pulseStrength: 0.01,
        title: (strings) => strings.text('Đang nghỉ phép', 'Vacation mode'),
        subtitle: (strings) => strings.text(
          'Điểm danh tạm dừng',
          'Check-in paused',
        ),
      );
    }
    if (remaining.isNegative) {
      return _CheckinButtonState(
        gradient: AppColors.dangerGradient,
        shadow: AppShadows.danger,
        icon: Icons.priority_high_rounded,
        pulseStrength: 0.035,
        title: (strings) => strings.text('Cần điểm danh', 'Check-in needed'),
        subtitle: (strings) => strings.text(
          'Bạn đã quá hạn check-in',
          'You are overdue',
        ),
      );
    }
    if (remaining.inHours < 1) {
      return _CheckinButtonState(
        gradient: AppColors.warnGradient,
        shadow: AppShadows.warn,
        icon: Icons.schedule_rounded,
        pulseStrength: 0.025,
        title: (strings) => strings.text('Sắp đến hạn', 'Almost due'),
        subtitle: (strings) => strings.text(
          'Chạm để xác nhận bạn vẫn ổn',
          'Tap to confirm you are safe',
        ),
      );
    }
    return _CheckinButtonState(
      gradient: AppColors.safeGradient,
      shadow: AppShadows.safe,
      icon: Icons.check_rounded,
      pulseStrength: 0.015,
      title: (strings) => strings.text('✓ Đã điểm danh', '✓ Checked in'),
      subtitle: (strings) => strings.text(
        'Bạn đang an toàn',
        'You are safe',
      ),
    );
  }

  Color _statusStripColor(_CheckinButtonState state) {
    if (state.gradient == AppColors.dangerGradient) {
      return AppColors.destructive;
    }
    if (state.gradient == AppColors.warnGradient) {
      return AppColors.warning;
    }
    return AppColors.primary;
  }

  String _statusLabel(AppStrings strings, _CheckinButtonState state) {
    if (state.gradient == AppColors.dangerGradient) {
      return strings.text('Quá hạn', 'Overdue');
    }
    if (state.gradient == AppColors.warnGradient) {
      return strings.text('Cận hạn', 'Due soon');
    }
    return strings.text('An toàn', 'Safe');
  }

  String _formatDate(DateTime date, AppStrings strings) {
    const viWeekdays = [
      'Thứ hai',
      'Thứ ba',
      'Thứ tư',
      'Thứ năm',
      'Thứ sáu',
      'Thứ bảy',
      'Chủ nhật',
    ];
    const enWeekdays = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];
    final weekday = strings.isVietnamese
        ? viWeekdays[date.weekday - 1]
        : enWeekdays[date.weekday - 1];
    return strings.text(
      '$weekday, ${date.day}/${date.month}/${date.year}',
      '$weekday, ${date.month}/${date.day}/${date.year}',
    );
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

  String _emojiForMood(Mood mood) {
    switch (mood) {
      case Mood.happy:
        return '😊';
      case Mood.calm:
        return '😐';
      case Mood.sick:
        return '🤒';
      case Mood.tired:
        return '😴';
      case Mood.focused:
        return '🧠';
    }
  }

  IconData _moodIcon(Mood mood) {
    switch (mood) {
      case Mood.calm:
        return Icons.sentiment_neutral_rounded;
      case Mood.happy:
        return Icons.sentiment_satisfied_alt_rounded;
      case Mood.tired:
        return Icons.nightlight_round;
      case Mood.sick:
        return Icons.healing_rounded;
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
    return '${35 + math.min(last * 6, 60)}%';
  }
}

class _MoodOption extends StatelessWidget {
  const _MoodOption({
    required this.emoji,
    required this.label,
    required this.onTap,
  });

  final String emoji;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: Ink(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.secondary,
          borderRadius: BorderRadius.circular(AppRadius.lg),
        ),
        child: Column(
          children: [
            Text(emoji, style: const TextStyle(fontSize: 30)),
            const SizedBox(height: 8),
            Text(
              label,
              textAlign: TextAlign.center,
              style: AppTextStyles.bodyStrong,
            ),
          ],
        ),
      ),
    );
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

class _PulseRing extends StatelessWidget {
  const _PulseRing({
    required this.progress,
    required this.color,
  });

  final double progress;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final scale = 0.92 + (progress * 0.42);
    final opacity = (1 - progress).clamp(0.0, 1.0) * 0.22;
    final size = 292.0 * scale;

    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(
            color: color.withValues(alpha: opacity),
            width: 10 - (progress * 5),
          ),
        ),
      ),
    );
  }
}

class _CheckinButtonState {
  const _CheckinButtonState({
    required this.gradient,
    required this.shadow,
    required this.icon,
    required this.pulseStrength,
    required this.title,
    required this.subtitle,
  });

  final LinearGradient gradient;
  final List<BoxShadow> shadow;
  final IconData icon;
  final double pulseStrength;
  final String Function(AppStrings strings) title;
  final String Function(AppStrings strings) subtitle;
}
