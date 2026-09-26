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
import '../../services/pedometer_service.dart';
import '../../services/wear_os_service.dart';
import '../../services/watch_sync_manager.dart';
import '../../services/ai_signal_processor.dart';
import '../../services/hrv_stroke_service.dart';
import '../community_radar/community_radar_page.dart';
import '../health/health_history_page.dart';
import '../sos_map/sos_map_page.dart';
import '../watch/widgets/add_smartwatch_sheet.dart';
import '../journey/widgets/home_journey_card.dart';
import '../emergency/first_aid_guide_page.dart';
import '../emergency/offline_emergency_sheet.dart';
import '../emergency/solocare_ai_sheet.dart';
import '../heroes/hero_workspace_page.dart';
import 'widgets/disaster_alert_card.dart';
import 'widgets/disaster_live_feed_section.dart';

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
    PedometerService.instance.initialize();
    WearOsService.instance.initialize();
    if (!WatchSyncManager.kIsTesting) {
      _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) {
          setState(() => _now = DateTime.now());
        }
      });
      _scheduleDemoPush();
    }
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _ticker?.cancel();
    _demoPushTimer?.cancel();
    _holdTimer?.cancel();
    super.dispose();
  }

  AppStrings _snapshotStrings() {
    return AppStrings(context.read<AppProvider>().language);
  }

  Future<void> _handleCheckIn(Mood? mood) async {
    final strings = _snapshotStrings();
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
    final strings = _snapshotStrings();
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
    debugPrint('--> HOMEPAGE BUILD: userName=$userName, guardians=${guardians.length}, isVacation=${appProvider.isVacation}');

    return AppPage(
      child: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.only(top: 20, bottom: 140),
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
          if (appProvider.activeDisasterAlerts.isNotEmpty) ...[
            DisasterAlertCard(alerts: appProvider.activeDisasterAlerts),
            const SizedBox(height: 10),
          ],
          if (appProvider.isFindPhoneActive) ...[
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFF0284C7),
                borderRadius: BorderRadius.circular(16),
                boxShadow: const [BoxShadow(color: Color(0x660284C7), blurRadius: 12)],
              ),
              child: Row(
                children: [
                  const Icon(Icons.ring_volume_rounded, color: Colors.white, size: 26),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          strings.text('ĐỒNG HỒ ĐANG TÌM BẠN!', 'WATCH IS FINDING PHONE!'),
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                        Text(
                          strings.text('Galaxy Watch 5 đang phát chuông rung tìm điện thoại.', 'Galaxy Watch 5 is ringing this phone.'),
                          style: const TextStyle(color: Colors.white70, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                  TextButton(
                    style: TextButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: const Color(0xFF0284C7),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    ),
                    onPressed: () => appProvider.dismissFindPhoneAlert(),
                    child: Text(
                      strings.text('TÔI ĐÂY', 'DISMISS'),
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
          ],
          _buildFamilyPingBanner(context, appProvider, strings),
          if (appProvider.isVacation) ...[
            MaterialBanner(
              backgroundColor: Theme.of(context).brightness == Brightness.dark
                  ? const Color(0xFF132238)
                  : const Color(0xFFE8F1FF),
              content: Text(
                strings.text(
                  'Chế độ nghỉ dưỡng đang bật. Đồng hồ điểm danh đang được tạm dừng.',
                  'Vacation mode is on. The check-in countdown is currently paused.',
                ),
                style: TextStyle(
                  color: Theme.of(context).brightness == Brightness.dark
                      ? AppDarkColors.textPrimary
                      : AppColors.textPrimary,
                ),
              ),
              leading: const Icon(Icons.hotel_rounded, color: Color(0xFF3A7AFE)),
              actions: const [SizedBox.shrink()],
            ),
            const SizedBox(height: 14),
          ],
          if (guardians.isNotEmpty)
            AppCard(
              color: Theme.of(context).brightness == Brightness.dark
                  ? AppDarkColors.card
                  : const Color(0xFFFFFBF4),
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
                  Text(
                    guardians.first.phone,
                    style: AppTextStyles.caption.copyWith(
                      color: Theme.of(context).brightness == Brightness.dark
                          ? AppDarkColors.textSecondary
                          : AppColors.textMuted,
                    ),
                  ),
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
          const SizedBox(height: 12),
          _buildQuickCheckInActionBar(context, appProvider, strings),
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
                            guardian.name.trim().isNotEmpty
                                ? guardian.name.trim().substring(0, 1).toUpperCase()
                                : '?',
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
          if (appProvider.automation.stepTrackingEnabled) ...[
            const SizedBox(height: 16),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.directions_walk_rounded,
                        color: AppColors.primary,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          strings.text('Vận động hôm nay', 'Today’s activity'),
                          style: AppTextStyles.title,
                        ),
                      ),
                      TextButton(
                        style: TextButton.styleFrom(
                          foregroundColor: AppColors.primary,
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const HealthHistoryPage()),
                          );
                        },
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              strings.text('Chi tiết', 'Details'),
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                            ),
                            const SizedBox(width: 2),
                            const Icon(Icons.arrow_forward_ios_rounded, size: 10),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: _StatCard(
                          icon: Icons.hiking_rounded,
                          label: strings.text('BƯỚC CHÂN', 'STEPS'),
                          value: _formatStepCount(appProvider.stepsToday, strings),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _StatCard(
                          icon: Icons.local_fire_department_rounded,
                          label: strings.text('CALO', 'CALORIES'),
                          value:
                              '${appProvider.caloriesBurnedToday.toStringAsFixed(0)} kcal',
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 18),
          _buildWatchHealthGlanceCard(context, strings),
          const HomeJourneyCard(),
          const SizedBox(height: 10),
          _buildSoloCareAiCard(context, strings),
          if (appProvider.isKycVerified) ...[
            const SizedBox(height: 10),
            _buildHeroDutyStatusCard(context, strings),
          ],
          const SizedBox(height: 10),
          _buildTacticalEmergencyTools(context, strings),
          const SizedBox(height: 14),
          const DisasterLiveFeedSection(),
          const SizedBox(height: 14),
          _buildAccidentReportingBanner(context, strings),
        ],
      ),
    );
  }

  Future<void> _openMoodPrompt() async {
    final strings = _snapshotStrings();
    final appProvider = context.read<AppProvider>();

    final result = await showDialog<Map<String, dynamic>?>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.28),
      builder: (dialogContext) {
        return Dialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.xl),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      strings.text('Điểm danh & Trạng thái', 'Check-in & Status'),
                      style: AppTextStyles.h3.copyWith(fontSize: 18),
                    ),
                    // Secret Duress gesture button (Long press 3s triggers Duress SOS silently)
                    Tooltip(
                      message: strings.text('Bảo mật', 'Security'),
                      child: GestureDetector(
                        onLongPress: () {
                          Navigator.pop(dialogContext, {'action': 'DURESS'});
                        },
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: const BoxDecoration(
                            color: AppColors.cardSoft,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.verified_user_outlined,
                            size: 18,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  strings.text(
                    'Chọn tâm trạng hoặc thói quen để hoàn tất điểm danh:',
                    'Select your mood or routine to complete check-in:',
                  ),
                  style: AppTextStyles.body.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 14),
                // Mood options
                Row(
                  children: [
                    Expanded(
                      child: _MoodOption(
                        emoji: '😊',
                        label: strings.text('Vui vẻ', 'Happy'),
                        onTap: () => Navigator.pop(dialogContext, {'action': 'MOOD', 'mood': Mood.happy}),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _MoodOption(
                        emoji: '😐',
                        label: strings.text('Bình an', 'Calm'),
                        onTap: () => Navigator.pop(dialogContext, {'action': 'MOOD', 'mood': Mood.calm}),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _MoodOption(
                        emoji: '😴',
                        label: strings.text('Hơi mệt', 'Tired'),
                        onTap: () => Navigator.pop(dialogContext, {'action': 'MOOD', 'mood': Mood.tired}),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _MoodOption(
                        emoji: '🤒',
                        label: strings.text('Cần lưu ý', 'Sick'),
                        onTap: () => Navigator.pop(dialogContext, {'action': 'MOOD', 'mood': Mood.sick}),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                // Routine Quick Chips
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      ActionChip(
                        avatar: const Text('💊', style: TextStyle(fontSize: 14)),
                        label: Text(strings.text('Đã uống thuốc', 'Took medicine')),
                        onPressed: () => Navigator.pop(dialogContext, {'action': 'ROUTINE', 'routine': 'MEDICATION'}),
                      ),
                      const SizedBox(width: 8),
                      ActionChip(
                        avatar: const Text('🚶', style: TextStyle(fontSize: 14)),
                        label: Text(strings.text('Đi bộ sáng', 'Morning walk')),
                        onPressed: () => Navigator.pop(dialogContext, {'action': 'ROUTINE', 'routine': 'MORNING_WALK'}),
                      ),
                      const SizedBox(width: 8),
                      ActionChip(
                        avatar: const Text('⏰', style: TextStyle(fontSize: 14)),
                        label: Text(strings.text('Hoãn 30p', 'Snooze 30m')),
                        onPressed: () => Navigator.pop(dialogContext, {'action': 'SNOOZE', 'minutes': 30}),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    TextButton.icon(
                      onPressed: () => Navigator.pop(dialogContext, {'action': 'MOMENT'}),
                      icon: const Icon(Icons.camera_alt_outlined, size: 16),
                      label: Text(strings.text('Khoảnh khắc', 'Moment')),
                    ),
                    TextButton(
                      onPressed: () => Navigator.pop(dialogContext, null),
                      child: Text(strings.text('Điểm danh nhanh', 'Quick Check-in')),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );

    if (result == null) {
      await _handleCheckIn(null);
      return;
    }

    final action = result['action'] as String?;
    if (action == 'DURESS') {
      try {
        await appProvider.performDuressCheckIn();
        if (!mounted) return;
        TopToast.show(
          context,
          message: strings.text('Đã điểm danh và cập nhật an toàn.', 'Check-in completed and safety status updated.'),
        );
      } catch (_) {
        if (!mounted) return;
        TopToast.show(context, message: 'Đã điểm danh thành công.');
      }
      return;
    }

    if (action == 'SNOOZE') {
      try {
        await appProvider.performSnooze(minutes: (result['minutes'] as int?) ?? 30);
        if (!mounted) return;
        TopToast.show(
          context,
          message: strings.text('Đã hoãn điểm danh thêm 30 phút.', 'Check-in snoozed for 30 minutes.'),
          icon: Icons.snooze_rounded,
        );
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      }
      return;
    }

    if (action == 'ROUTINE') {
      final routine = (result['routine'] as String?) ?? 'CUSTOM';
      try {
        await appProvider.performRoutineCheckIn(routineType: routine);
        if (!mounted) return;
        TopToast.show(
          context,
          message: strings.text('Đã ghi nhận thói quen & điểm danh an toàn!', 'Routine recorded & check-in confirmed!'),
          icon: Icons.check_circle_outline,
        );
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      }
      return;
    }

    if (action == 'MOMENT') {
      if (!mounted) return;
      _showEmotionalMomentSheet(context, appProvider, strings);
      return;
    }

    final mood = result['mood'] as Mood?;
    await _handleCheckIn(mood);
  }

  Widget _buildFamilyPingBanner(BuildContext context, AppProvider provider, AppStrings strings) {
    final pings = provider.user?.pendingFamilyPings ?? const [];
    final activePing = pings.firstWhere(
      (p) => p['status'] == 'PENDING',
      orElse: () => const <String, dynamic>{},
    );
    if (activePing.isEmpty) return const SizedBox.shrink();

    final pingId = activePing['_id'] ?? activePing['id'] ?? '';
    final fromName = activePing['fromName'] ?? 'Người thân';
    final message = activePing['message'] ?? 'Gửi cái ôm ấm áp! Bạn vẫn khỏe chứ?';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF831843), Color(0xFF500724)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF43F5E).withValues(alpha: 0.5)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFF43F5E).withValues(alpha: 0.2),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFF43F5E).withValues(alpha: 0.25),
              shape: BoxShape.circle,
            ),
            child: const Text('🤗', style: TextStyle(fontSize: 22)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$fromName ${strings.text('vừa gửi lời hỏi thăm', 'sent a check-in ping')}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 13.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '"$message"',
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 12,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFF43F5E),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () async {
              await provider.respondToFamilyPing(
                pingId: pingId.toString(),
                responseMessage: 'Vẫn khỏe, cảm ơn lời hỏi thăm nhé!',
              );
              if (context.mounted) {
                TopToast.show(
                  context,
                  message: strings.text(
                    'Đã gửi phản hồi và cập nhật an toàn!',
                    'Responded and safety updated!',
                  ),
                  icon: Icons.favorite_rounded,
                );
              }
            },
            child: Text(
              strings.text('Vẫn khỏe', 'I\'m fine'),
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickCheckInActionBar(BuildContext context, AppProvider provider, AppStrings strings) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              side: BorderSide(color: AppColors.primary.withValues(alpha: 0.3)),
            ),
            icon: const Icon(Icons.snooze_rounded, size: 16, color: AppColors.primary),
            label: Text(
              strings.text('Hoãn 30p', 'Snooze 30m'),
              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600),
            ),
            onPressed: () async {
              try {
                await provider.performSnooze(minutes: 30);
                if (context.mounted) {
                  TopToast.show(
                    context,
                    message: strings.text('Đã hoãn điểm danh thêm 30 phút.', 'Check-in snoozed for 30 minutes.'),
                    icon: Icons.snooze_rounded,
                  );
                }
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
                }
              }
            },
          ),
          const SizedBox(width: 8),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              side: BorderSide(color: const Color(0xFF10B981).withValues(alpha: 0.4)),
            ),
            icon: const Icon(Icons.camera_alt_outlined, size: 16, color: Color(0xFF10B981)),
            label: Text(
              strings.text('Khoảnh khắc', 'Moment'),
              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(0xFF10B981)),
            ),
            onPressed: () => _showEmotionalMomentSheet(context, provider, strings),
          ),
          const SizedBox(width: 8),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              side: BorderSide(color: const Color(0xFFF59E0B).withValues(alpha: 0.4)),
            ),
            icon: const Icon(Icons.medication_outlined, size: 16, color: Color(0xFFF59E0B)),
            label: Text(
              strings.text('Đã uống thuốc', 'Took medicine'),
              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(0xFFF59E0B)),
            ),
            onPressed: () async {
              try {
                await provider.performRoutineCheckIn(routineType: 'MEDICATION');
                if (context.mounted) {
                  TopToast.show(
                    context,
                    message: strings.text('Đã ghi nhận uống thuốc & cập nhật an toàn!', 'Medication recorded & safety updated!'),
                    icon: Icons.check_circle_outline,
                  );
                }
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
                }
              }
            },
          ),
        ],
      ),
    );
  }

  void _showEmotionalMomentSheet(BuildContext context, AppProvider provider, AppStrings strings) {
    final noteController = TextEditingController();
    Mood selectedMood = Mood.happy;

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Padding(
              padding: EdgeInsets.fromLTRB(
                20,
                20,
                20,
                MediaQuery.of(context).viewInsets.bottom + 20,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        strings.text('Khoảnh khắc gia đình', 'Family Moment'),
                        style: AppTextStyles.h3.copyWith(fontSize: 18),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => Navigator.pop(sheetContext),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    strings.text(
                      'Gửi ảnh hoặc vài chữ để người thân an tâm:',
                      'Send a quick note or photo to keep family relieved:',
                    ),
                    style: AppTextStyles.caption,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: noteController,
                    decoration: InputDecoration(
                      hintText: strings.text(
                        'Ví dụ: "Con vừa tới nơi làm việc an toàn!"',
                        'E.g.: "Arrived safely at work!"',
                      ),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                      prefixIcon: const Icon(Icons.edit_note_rounded),
                    ),
                    maxLines: 2,
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 46,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      icon: const Icon(Icons.send_rounded, size: 18),
                      label: Text(
                        strings.text('Gửi & Hoàn tất điểm danh', 'Send & Complete Check-in'),
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      onPressed: () async {
                        Navigator.pop(sheetContext);
                        final note = noteController.text.trim();
                        try {
                          await provider.performEmotionalCheckIn(
                            mood: selectedMood,
                            note: note.isNotEmpty ? note : 'Vẫn bình an!',
                          );
                          if (context.mounted) {
                            TopToast.show(
                              context,
                              message: strings.text('Đã gửi khoảnh khắc và điểm danh!', 'Moment sent & check-in confirmed!'),
                              icon: Icons.favorite_rounded,
                            );
                          }
                        } catch (e) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
                          }
                        }
                      },
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _scheduleDemoPush() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    if (prefs.getBool(_demoPushKey) == true) {
      return;
    }

    _demoPushTimer = Timer(const Duration(seconds: 4), () async {
      if (!mounted) {
        return;
      }
      TopToast.show(
        context,
        message: '🚨 ${_snapshotStrings().text('SOS gần bạn · 800m', 'Nearby SOS · 800m')}',
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
          'Bạn đã quá hạn điểm danh',
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

  String _formatStepCount(int steps, AppStrings strings) {
    final raw = steps.toString();
    final buffer = StringBuffer();
    for (var i = 0; i < raw.length; i++) {
      final reverseIndex = raw.length - i;
      buffer.write(raw[i]);
      if (reverseIndex > 1 && reverseIndex % 3 == 1) {
        buffer.write(',');
      }
    }
    return '$buffer ${strings.text('bước', 'steps')}';
  }

  /// Thẻ Trợ lý SoloCare AI: Tư vấn vết thương, thuốc & tâm lý (Qwen 3.8)
  Widget _buildSoloCareAiCard(BuildContext context, AppStrings strings) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () => SoloCareAiSheet.show(context),
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF064E3B), Color(0xFF0F172A)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: const Color(0xFF10B981).withValues(alpha: 0.5),
              width: 1.2,
            ),
            boxShadow: const [
              BoxShadow(
                color: Color(0x1810B981),
                blurRadius: 10,
                offset: Offset(0, 3),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(9),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withValues(alpha: 0.2),
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xFF10B981), width: 1.5),
                ),
                child: const Icon(Icons.psychology_rounded, color: Color(0xFF34D399), size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            strings.text('SoloCare AI Sơ cứu & Tâm lý', 'SoloCare First Aid & Calm AI'),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13.5,
                              fontWeight: FontWeight.bold,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFF10B981).withValues(alpha: 0.25),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            strings.text('Trợ lý 24/7', '24/7 Helper'),
                            style: const TextStyle(color: Color(0xFF6EE7B7), fontSize: 9.5, fontWeight: FontWeight.w700),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      strings.text(
                        'Tư vấn vết thương · Kiểm tra dị ứng thuốc · Trấn an hoảng sợ',
                        'Wound care · Drug allergy check · Calming support',
                      ),
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.7),
                        fontSize: 11,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.chat_bubble_outline_rounded, color: Colors.white70, size: 16),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Công cụ Khẩn cấp Tác chiến: SOS Ngoại tuyến & Sơ cứu CPR
  Widget _buildTacticalEmergencyTools(BuildContext context, AppStrings strings) {
    return Row(
      children: [
        // 1. SOS Ngoại Tuyến (Offline SOS)
        Expanded(
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () => OfflineEmergencySheet.show(context),
              child: Ink(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: const Color(0xFFF59E0B).withValues(alpha: 0.35),
                    width: 1.2,
                  ),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x18F59E0B),
                      blurRadius: 8,
                      offset: Offset(0, 2),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF59E0B).withValues(alpha: 0.2),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.wifi_off_rounded,
                        color: Color(0xFFF59E0B),
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            strings.text('SOS Ngoại tuyến', 'Offline SOS'),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            strings.text('PDR · Còi · SMS', 'PDR · Siren · SMS'),
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.6),
                              fontSize: 10.5,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: 10),
        // 2. Sơ cứu & CPR (First Aid & CPR)
        Expanded(
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute<void>(builder: (_) => const FirstAidGuidePage()),
                );
              },
              child: Ink(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: const Color(0xFF10B981).withValues(alpha: 0.35),
                    width: 1.2,
                  ),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x1810B981),
                      blurRadius: 8,
                      offset: Offset(0, 2),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981).withValues(alpha: 0.2),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.medical_services_rounded,
                        color: Color(0xFF10B981),
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            strings.text('Sơ cứu & CPR', 'First Aid & CPR'),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            strings.text('10 Cẩm nang · Nhịp', '10 Guides · Pace'),
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.6),
                              fontSize: 10.5,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// Thanh tóm tắt sức khỏe & đồng hồ thông minh thời gian thực (Live Health & Watch Glance)
  Widget _buildWatchHealthGlanceCard(BuildContext context, AppStrings strings) {
    final pedometer = PedometerService.instance;
    final wearOs = WearOsService.instance;
    final sync = WatchSyncManager.instance;
    final hrv = HrvStrokeService.instance;

    return AnimatedBuilder(
      animation: Listenable.merge([pedometer, wearOs, sync, hrv]),
      builder: (context, _) {
        final isConnected = wearOs.isPaired && sync.isPaired;

        // KHI CHƯA KẾT NỐI: ẨN TOÀN BỘ CHỈ SỐ SINH TỒN & HIỂN THỊ NÚT "+ THÊM ĐỒNG HỒ"
        if (!isConnected) {
          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(22),
              border: Border.all(
                color: const Color(0xFF334155),
                width: 1.2,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.16),
                  blurRadius: 14,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(22),
                onTap: () => AddSmartwatchSheet.show(context),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: const Color(0xFF38BDF8).withValues(alpha: 0.12),
                          border: Border.all(color: const Color(0xFF38BDF8).withValues(alpha: 0.4), width: 1.5),
                        ),
                        child: const Icon(Icons.watch_outlined, color: Color(0xFF38BDF8), size: 24),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              strings.text(
                                'Chưa kết nối đồng hồ thông minh',
                                'No Smartwatch Connected',
                              ),
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              strings.text(
                                'Thêm Galaxy Watch 5 để theo dõi nhịp tim, SpO2 & SOS',
                                'Add Galaxy Watch 5 for vitals & auto-SOS',
                              ),
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.6),
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF0284C7),
                          foregroundColor: Colors.white,
                          minimumSize: const Size(64, 36),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          elevation: 0,
                        ),
                        onPressed: () => AddSmartwatchSheet.show(context),
                        icon: const Icon(Icons.add_rounded, size: 16),
                        label: Text(
                          strings.text('Thêm', 'Add'),
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        }

        // KHI ĐÃ KẾT NỐI: HIỂN THỊ ĐẦY ĐỦ THÔNG SỐ ĐỒNG BỘ THỜI GIAN THỰC TỪ ĐỒNG HỒ
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(
              color: const Color(0xFF38BDF8).withValues(alpha: 0.4),
              width: 1.2,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0284C7).withValues(alpha: 0.15),
                blurRadius: 14,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(22),
              onTap: () {
                Navigator.pushNamed(context, '/smartwatch');
              },
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Stack(
                          alignment: Alignment.center,
                          children: [
                            Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: const Color(0xFF38BDF8).withValues(alpha: 0.18),
                              ),
                              child: const Icon(Icons.watch_rounded, color: Color(0xFF38BDF8), size: 22),
                            ),
                            Positioned(
                              top: 2,
                              right: 2,
                              child: Container(
                                width: 9,
                                height: 9,
                                decoration: BoxDecoration(
                                  color: const Color(0xFF10B981),
                                  shape: BoxShape.circle,
                                  border: Border.all(color: const Color(0xFF0F172A), width: 1.5),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      pedometer.watchModel,
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 13,
                                        fontWeight: FontWeight.bold,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  const Icon(Icons.bluetooth_connected_rounded, size: 14, color: Color(0xFF10B981)),
                                ],
                              ),
                              const SizedBox(height: 2),
                              Text(
                                strings.text(
                                  'Đã kết nối · Đang đồng bộ thời gian thực',
                                  'Connected · Live real-time sync',
                                ),
                                style: const TextStyle(
                                  color: Color(0xFF34D399),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          tooltip: 'Quản lý thiết bị',
                          icon: const Icon(Icons.tune_rounded, color: Colors.white54, size: 18),
                          onPressed: () => AddSmartwatchSheet.show(context),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    const Divider(color: Colors.white12, height: 1),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _buildGlanceMetric(
                          icon: Icons.favorite_rounded,
                          color: const Color(0xFFF43F5E),
                          value: '${wearOs.heartRate}',
                          unit: 'BPM',
                        ),
                        _buildGlanceMetric(
                          icon: Icons.bloodtype_rounded,
                          color: const Color(0xFF06B6D4),
                          value: '${wearOs.spO2}%',
                          unit: 'SpO2',
                        ),
                        _buildGlanceMetric(
                          icon: Icons.directions_walk_rounded,
                          color: const Color(0xFF10B981),
                          value: '${wearOs.steps}',
                          unit: strings.text('bước', 'steps'),
                        ),
                        _buildGlanceMetric(
                          icon: Icons.battery_charging_full_rounded,
                          color: const Color(0xFF38BDF8),
                          value: '${wearOs.battery}%',
                          unit: 'PIN',
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: (hrv.assessment.level == HrvRiskLevel.critical
                                ? const Color(0xFFEF4444)
                                : hrv.assessment.level == HrvRiskLevel.moderate
                                    ? const Color(0xFFF59E0B)
                                    : const Color(0xFF10B981))
                            .withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: (hrv.assessment.level == HrvRiskLevel.critical
                                  ? const Color(0xFFEF4444)
                                  : hrv.assessment.level == HrvRiskLevel.moderate
                                      ? const Color(0xFFF59E0B)
                                      : const Color(0xFF10B981))
                              .withValues(alpha: 0.35),
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.graphic_eq_rounded,
                            size: 14,
                            color: hrv.assessment.level == HrvRiskLevel.critical
                                ? const Color(0xFFEF4444)
                                : hrv.assessment.level == HrvRiskLevel.moderate
                                    ? const Color(0xFFF59E0B)
                                    : const Color(0xFF10B981),
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              'HRV: ${hrv.metrics.rmssdMs}ms · ${hrv.assessment.title}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            '${hrv.assessment.riskPercent}% rủi ro',
                            style: TextStyle(
                              color: hrv.assessment.level == HrvRiskLevel.critical
                                  ? const Color(0xFFEF4444)
                                  : const Color(0xFF38BDF8),
                              fontSize: 10.5,
                              fontWeight: FontWeight.bold,
                            ),
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
      },
    );
  }

  Widget _buildGlanceMetric({
    required IconData icon,
    required Color color,
    required String value,
    required String unit,
  }) {
    return Column(
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: color, size: 14),
            const SizedBox(width: 4),
            Text(
              value,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 13,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        const SizedBox(height: 2),
        Text(
          unit,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.5),
            fontSize: 10,
          ),
        ),
      ],
    );
  }

  Widget _buildAccidentReportingBanner(BuildContext context, AppStrings strings) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppDarkColors.card : AppColors.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(
          color: isDark ? AppDarkColors.border : AppColors.border,
          width: 1.2,
        ),
        boxShadow: isDark ? const [] : AppShadows.card,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          onTap: () => Navigator.pushNamed(context, '/report-accident'),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF3B1219) : const Color(0xFFFEF2F2),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: isDark ? const Color(0xFF6B1D28) : const Color(0xFFFECDD3),
                          width: 1.2,
                        ),
                      ),
                      child: const Icon(
                        Icons.camera_enhance_rounded,
                        color: Color(0xFFE11D48),
                        size: 22,
                      ),
                    ),
                    Positioned(
                      bottom: -2,
                      right: -2,
                      child: Container(
                        padding: const EdgeInsets.all(2.5),
                        decoration: BoxDecoration(
                          color: isDark ? AppDarkColors.surface : Colors.white,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: isDark ? AppDarkColors.border : const Color(0xFFE2E8F0),
                            width: 1,
                          ),
                        ),
                        child: const Icon(
                          Icons.verified_rounded,
                          color: Color(0xFF0284C7),
                          size: 11,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              strings.text(
                                'Báo cáo tai nạn',
                                'Accident Report',
                              ),
                              style: AppTextStyles.bodyStrong.copyWith(
                                fontSize: 13.5,
                                color: isDark ? AppDarkColors.textPrimary : AppColors.textPrimary,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: isDark ? const Color(0xFF351518) : const Color(0xFFFEF2F2),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(
                                color: isDark ? const Color(0xFF6B2028) : const Color(0xFFFCA5A5),
                                width: 0.8,
                              ),
                            ),
                            child: const Text(
                              'TIMEMARK 115',
                              style: TextStyle(
                                color: Color(0xFFDC2626),
                                fontSize: 9,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.2,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(
                        strings.text(
                          'Chụp ảnh đóng dấu GPS & thời gian thực gửi cấp cứu',
                          'Snap verified GPS & time-stamped photo to dispatch',
                        ),
                        style: AppTextStyles.caption.copyWith(
                          color: isDark ? AppDarkColors.textSecondary : AppColors.textSecondary,
                          fontSize: 11.5,
                          height: 1.25,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: isDark ? AppDarkColors.surface : AppColors.cardSoft,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.arrow_forward_ios_rounded,
                    color: isDark ? AppDarkColors.primaryGlow : AppColors.primary,
                    size: 13,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeroDutyStatusCard(BuildContext context, AppStrings strings) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0F172A), Color(0xFF064E3B)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: const Color(0xFF10B981).withValues(alpha: 0.6),
          width: 1.4,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF10B981).withValues(alpha: 0.2),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute<void>(builder: (_) => const HeroWorkspacePage()),
            );
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Stack(
                  alignment: Alignment.center,
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: const Color(0xFF10B981).withValues(alpha: 0.2),
                        border: Border.all(color: const Color(0xFF10B981), width: 1.5),
                      ),
                      child: const Icon(Icons.shield_rounded, color: Color(0xFF10B981), size: 24),
                    ),
                    Positioned(
                      top: 1,
                      right: 1,
                      child: Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF59E0B),
                          shape: BoxShape.circle,
                          border: Border.all(color: const Color(0xFF0F172A), width: 1.5),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Expanded(
                            child: Text(
                              'CHẾ ĐỘ HIỆP SĨ TRỰC CHIẾN',
                              style: TextStyle(
                                color: Color(0xFF34D399),
                                fontSize: 11.5,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 0.2,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF59E0B).withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: const Color(0xFFF59E0B), width: 0.8),
                            ),
                            child: const Text(
                              'ĐÃ XÁC THỰC',
                              style: TextStyle(color: Color(0xFFF59E0B), fontSize: 8.5, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 3),
                      const Text(
                        'Đang trực thám ca SOS bán kính 3km · Chạm mở Bàn Tác Chiến',
                        style: TextStyle(color: Colors.white70, fontSize: 11),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF10B981),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 16),
                ),
              ],
            ),
          ),
        ),
      ),
    );
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
