import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';

import '../../core/app_language.dart';
import '../../core/app_strings.dart';
import '../../core/app_theme.dart';
import '../../core/providers/app_provider.dart';
import '../../core/widgets/app_shell.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  double? _graceHoursDraft;
  double? _autoWipeDaysDraft;

  AppStrings _snapshotStrings() {
    final language = context.read<AppProvider>().language;
    return AppStrings(language);
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AppProvider>();
    final user = provider.user;
    final strings = AppStrings.of(context);
    final automation = provider.automation;
    final security = provider.security;
    final graceValue = _graceHoursDraft ?? provider.graceHours.toDouble();
    final autoWipeValue = _autoWipeDaysDraft ?? security.autoWipeDays.toDouble();

    return AppPage(
      safeBottom: true,
      child: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.only(top: 18, bottom: 120),
        children: [
          Text(
            strings.text('Cài đặt', 'Settings'),
            style: AppTextStyles.h2.copyWith(fontSize: 28),
          ),
          const SizedBox(height: 18),
          _ProfileCard(
            name: user?.name.isNotEmpty == true
                ? user!.name
                : strings.text('Người dùng', 'User'),
            subtitle: user?.email.isNotEmpty == true
                ? user!.email
                : (user?.phoneNumber ?? ''),
          ),
          const SizedBox(height: 22),
          AppSectionLabel(strings.text('Điểm danh hằng ngày', 'Daily check-in')),
          const SizedBox(height: 10),
          _SectionCard(
            children: [
              _SliderRow(
                icon: Icons.access_time_rounded,
                title: strings.text('Thời gian ân hạn', 'Grace window'),
                valueText: _formatHours(strings, graceValue.round()),
                minLabel: '1h',
                maxLabel: '72h',
                min: 1,
                max: 72,
                divisions: 71,
                value: graceValue.clamp(1, 72),
                onChanged: (value) => setState(() => _graceHoursDraft = value),
                onChangeEnd: (value) async {
                  await _runGuarded(
                    () => context.read<AppProvider>().setGraceHours(value.round()),
                  );
                  if (mounted) {
                    setState(() => _graceHoursDraft = null);
                  }
                },
              ),
              const _SectionDivider(),
              _ActionRow(
                icon: Icons.notifications_active_outlined,
                title: strings.text('Nhắc nhở mỗi ngày', 'Daily reminder'),
                valueText: automation.dailyReminderTime,
                onTap: () => _pickReminderTime(context),
              ),
              const _SectionDivider(),
              _ActionRow(
                icon: Icons.flight_takeoff_rounded,
                title: strings.text('Chế độ nghỉ phép', 'Vacation mode'),
                valueText: provider.isVacation
                    ? strings.text('Đang bật', 'On')
                    : strings.text('Đang tắt', 'Off'),
                onTap: () => _showVacationDialog(context),
              ),
              const _SectionDivider(),
              _SwitchRow(
                icon: Icons.directions_walk_rounded,
                title: strings.text('Đếm bước chân & calo', 'Steps & calories'),
                value: automation.stepTrackingEnabled,
                onChanged: (value) => _toggleStepTracking(provider, value),
              ),
            ],
          ),
          const SizedBox(height: 22),
          AppSectionLabel(strings.text('Tự động hóa và cảm biến', 'Automation & sensors')),
          const SizedBox(height: 10),
          _SectionCard(
            children: [
              _SwitchRow(
                icon: Icons.monitor_heart_outlined,
                title: strings.text('Phát hiện té ngã', 'Fall detection'),
                value: automation.fallDetection,
                onChanged: (value) => _saveAutomation(provider, fallDetection: value),
              ),
              const _SectionDivider(),
              _SwitchRow(
                icon: Icons.vibration_rounded,
                title: strings.text('Lắc máy tạo SOS', 'Shake for SOS'),
                value: automation.shakeSos,
                onChanged: (value) => _saveAutomation(provider, shakeSos: value),
              ),
              const _SectionDivider(),
              _SwitchRow(
                icon: Icons.home_work_outlined,
                title: strings.text('Tự check-in khi về nhà', 'Auto check-in at home'),
                value: automation.geofenceAutoCheckin,
                onChanged: (value) => _saveAutomation(provider, geofenceAutoCheckin: value),
              ),
              const _SectionDivider(),
              _SwitchRow(
                icon: Icons.medication_liquid_outlined,
                title: strings.text('Nhắc uống thuốc', 'Medication reminder'),
                value: automation.pillReminder,
                onChanged: (value) => _saveAutomation(provider, pillReminder: value),
              ),
            ],
          ),
          const SizedBox(height: 22),
          AppSectionLabel(strings.text('Hồ sơ và thành tựu', 'Profile & achievements')),
          const SizedBox(height: 10),
          _SectionCard(
            children: [
              _ActionRow(
                icon: Icons.favorite_border_rounded,
                title: strings.text('Hồ sơ y tế khẩn cấp', 'Emergency medical profile'),
                onTap: () => Navigator.pushNamed(context, '/medical'),
              ),
              const _SectionDivider(),
              _ActionRow(
                icon: Icons.groups_2_outlined,
                title: strings.text('Người bảo hộ', 'Guardians'),
                onTap: () => Navigator.pushNamed(context, '/network'),
              ),
              const _SectionDivider(),
              _ActionRow(
                icon: Icons.workspace_premium_outlined,
                title: strings.text('Huy hiệu của tôi', 'My achievements'),
                onTap: () => Navigator.pushNamed(context, '/achievements'),
              ),
            ],
          ),
          const SizedBox(height: 22),
          AppSectionLabel(strings.text('Trợ năng', 'Accessibility')),
          const SizedBox(height: 10),
          _SectionCard(
            children: [
              _SwitchRow(
                icon: Icons.contrast_rounded,
                title: strings.text('Tương phản cao (WCAG AAA)', 'High contrast (WCAG AAA)'),
                value: provider.highContrast,
                onChanged: (value) => _runGuarded(
                  () => context.read<AppProvider>().setHighContrast(value),
                ),
              ),
              const _SectionDivider(),
              _ActionRow(
                icon: Icons.translate_rounded,
                title: strings.text('Ngôn ngữ', 'Language'),
                valueText: provider.language == AppLanguage.vi ? 'Tiếng Việt' : 'English',
                onTap: () => _showLanguageDialog(context),
              ),
            ],
          ),
          const SizedBox(height: 22),
          AppSectionLabel(strings.text('Bảo mật nâng cao', 'Advanced security')),
          const SizedBox(height: 10),
          _SectionCard(
            children: [
              _ActionRow(
                icon: Icons.key_rounded,
                title: strings.text('Mã PIN thật và PIN giả', 'Real PIN & duress PIN'),
                onTap: () => Navigator.pushNamed(context, '/security'),
              ),
              const _SectionDivider(),
              _SwitchRow(
                icon: Icons.auto_awesome_rounded,
                title: strings.text('Chế độ ẩn danh (Calculator)', 'Stealth mode (Calculator)'),
                value: security.stealthMode,
                onChanged: (value) => _saveSecurity(provider, stealthMode: value),
              ),
              const _SectionDivider(),
              _SliderRow(
                icon: Icons.delete_sweep_outlined,
                title: strings.text('Tự hủy Két sắt', 'Vault auto-wipe'),
                valueText: autoWipeValue.round() == 0
                    ? strings.text('Tắt', 'Off')
                    : strings.text('${autoWipeValue.round()} ngày', '${autoWipeValue.round()} days'),
                minLabel: strings.text('Tắt', 'Off'),
                maxLabel: strings.text('60 ngày', '60 days'),
                min: 0,
                max: 60,
                divisions: 60,
                value: autoWipeValue.clamp(0, 60),
                onChanged: (value) => setState(() => _autoWipeDaysDraft = value),
                onChangeEnd: (value) async {
                  await _saveSecurity(provider, autoWipeDays: value.round());
                  if (mounted) {
                    setState(() => _autoWipeDaysDraft = null);
                  }
                },
              ),
              const _SectionDivider(),
              _ActionRow(
                icon: Icons.lock_person_outlined,
                title: strings.text('Mã hóa AES-256 E2E', 'AES-256 E2E encryption'),
                valueText: provider.security.encryptionEnabled
                    ? strings.text('Đang bật', 'Enabled')
                    : strings.text('Đang tắt', 'Disabled'),
                onTap: () => Navigator.pushNamed(context, '/vault'),
              ),
              const _SectionDivider(),
              _ActionRow(
                icon: Icons.inventory_2_outlined,
                title: strings.text('Két sắt sinh tử', 'Life vault'),
                onTap: () => Navigator.pushNamed(context, '/vault'),
              ),
            ],
          ),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: () => context.read<AppProvider>().signOut(),
            icon: const Icon(Icons.logout_rounded),
            label: Text(strings.text('Đăng xuất', 'Sign out')),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.destructive,
              side: const BorderSide(color: Color(0xFFFFB8B8)),
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppRadius.lg),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _pickReminderTime(BuildContext context) async {
    final provider = context.read<AppProvider>();
    final current = _parseTimeOfDay(provider.automation.dailyReminderTime);
    final picked = await showTimePicker(
      context: context,
      initialTime: current,
      builder: (context, child) {
        return MediaQuery(
          data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
          child: child!,
        );
      },
    );
    if (picked == null) {
      return;
    }

    await _saveAutomation(provider, dailyReminderTime: _formatTimeOfDay(picked));
  }

  Future<void> _showVacationDialog(BuildContext context) async {
    final provider = context.read<AppProvider>();
    final strings = _snapshotStrings();
    double selectedHours = provider.isVacation ? 24 : 12;

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              title: Text(
                provider.isVacation
                    ? strings.text('Chế độ nghỉ phép', 'Vacation mode')
                    : strings.text('Bật nghỉ phép', 'Turn on vacation mode'),
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (provider.isVacation) ...[
                    Text(
                      strings.text(
                        'Đang tạm dừng cảnh báo đến ${_formatDateTime(provider.user?.sleepModeUntil)}.',
                        'Alerts are paused until ${_formatDateTime(provider.user?.sleepModeUntil)}.',
                      ),
                      style: AppTextStyles.body,
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () async {
                          Navigator.pop(dialogContext);
                          await _runGuarded(() => provider.endVacation());
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.destructive,
                        ),
                        child: Text(strings.text('Tắt nghỉ phép', 'Turn off')),
                      ),
                    ),
                  ] else ...[
                    Text(
                      strings.text(
                        'Tạm dừng countdown và escalation trong khoảng thời gian bạn chọn.',
                        'Pause countdown and escalation for the selected duration.',
                      ),
                      style: AppTextStyles.body,
                    ),
                    const SizedBox(height: 18),
                    Text(
                      _formatHours(strings, selectedHours.round()),
                      style: AppTextStyles.h2.copyWith(
                        fontSize: 32,
                        color: AppColors.primary,
                      ),
                    ),
                    Slider(
                      value: selectedHours,
                      min: 1,
                      max: 24,
                      divisions: 23,
                      onChanged: (value) => setState(() => selectedHours = value),
                    ),
                  ],
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext),
                  child: Text(strings.text('Đóng', 'Close')),
                ),
                if (!provider.isVacation)
                  ElevatedButton(
                    onPressed: () async {
                      Navigator.pop(dialogContext);
                      await _runGuarded(
                        () => provider.setSleepModeHours(selectedHours.round()),
                      );
                    },
                    child: Text(strings.text('Bắt đầu', 'Start')),
                  ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _showLanguageDialog(BuildContext context) async {
    final provider = context.read<AppProvider>();
    final strings = _snapshotStrings();

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: Text(strings.text('Ngôn ngữ', 'Language')),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _LanguageOption(
                label: 'Tiếng Việt',
                selected: provider.language == AppLanguage.vi,
                onTap: () async {
                  await provider.setLanguage(AppLanguage.vi);
                  if (dialogContext.mounted) {
                    Navigator.pop(dialogContext);
                  }
                },
              ),
              _LanguageOption(
                label: 'English',
                selected: provider.language == AppLanguage.en,
                onTap: () async {
                  await provider.setLanguage(AppLanguage.en);
                  if (dialogContext.mounted) {
                    Navigator.pop(dialogContext);
                  }
                },
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _saveAutomation(
    AppProvider provider, {
    bool? shakeSos,
    int? shakeSensitivity,
    bool? fallDetection,
    bool? geofenceAutoCheckin,
    String? dailyReminderTime,
    bool? pillReminder,
    String? pillTime,
    bool? stepTrackingEnabled,
  }) async {
    final current = provider.automation;
    await _runGuarded(
      () => provider.setAutomation(
        Automation(
          dailyReminderTime: dailyReminderTime ?? current.dailyReminderTime,
          shakeSos: shakeSos ?? current.shakeSos,
          shakeSensitivity: shakeSensitivity ?? current.shakeSensitivity,
          fallDetection: fallDetection ?? current.fallDetection,
          geofenceAutoCheckin: geofenceAutoCheckin ?? current.geofenceAutoCheckin,
          pillReminder: pillReminder ?? current.pillReminder,
          pillTime: pillTime ?? current.pillTime,
          stepTrackingEnabled:
              stepTrackingEnabled ?? current.stepTrackingEnabled,
        ),
      ),
    );
  }

  Future<void> _toggleStepTracking(
    AppProvider provider,
    bool enabled,
  ) async {
    final strings = _snapshotStrings();
    if (!enabled) {
      await _saveAutomation(provider, stepTrackingEnabled: false);
      return;
    }

    var status = await Permission.activityRecognition.status;
    if (!status.isGranted) {
      status = await Permission.activityRecognition.request();
    }

    if (!status.isGranted) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            strings.text(
              'SafeSolo cần quyền nhận diện hoạt động để đếm bước chân.',
              'SafeSolo needs activity recognition permission to count steps.',
            ),
          ),
          action: status.isPermanentlyDenied
              ? SnackBarAction(
                  label: strings.text('Mở cài đặt', 'Open settings'),
                  onPressed: openAppSettings,
                )
              : null,
        ),
      );
      return;
    }

    await _saveAutomation(provider, stepTrackingEnabled: true);
  }

  Future<void> _saveSecurity(
    AppProvider provider, {
    String? realPin,
    String? duressPin,
    bool? stealthMode,
    int? autoWipeDays,
  }) async {
    final current = provider.security;
    await _runGuarded(
      () => provider.setSecurity(
        Security(
          realPin: realPin ?? current.realPin,
          duressPin: duressPin ?? current.duressPin,
          stealthMode: stealthMode ?? current.stealthMode,
          autoWipeDays: autoWipeDays ?? current.autoWipeDays,
          encryptionEnabled: current.encryptionEnabled,
        ),
      ),
    );
  }

  Future<void> _runGuarded(Future<void> Function() action) async {
    try {
      await action();
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    }
  }

  static String _formatHours(AppStrings strings, int hours) {
    final days = hours ~/ 24;
    final remainHours = hours % 24;
    if (days == 0) {
      return '${hours}h';
    }
    if (remainHours == 0) {
      return strings.text('$days ngày', '$days days');
    }
    return strings.text('$days ngày $remainHours h', '$days days $remainHours h');
  }

  static TimeOfDay _parseTimeOfDay(String value) {
    final parts = value.split(':');
    if (parts.length != 2) {
      return const TimeOfDay(hour: 8, minute: 0);
    }
    return TimeOfDay(
      hour: int.tryParse(parts[0]) ?? 8,
      minute: int.tryParse(parts[1]) ?? 0,
    );
  }

  static String _formatTimeOfDay(TimeOfDay time) {
    final hour = time.hour.toString().padLeft(2, '0');
    final minute = time.minute.toString().padLeft(2, '0');
    return '$hour:$minute';
  }

  static String _formatDateTime(DateTime? value) {
    if (value == null) {
      return '--';
    }
    final hour = value.hour.toString().padLeft(2, '0');
    final minute = value.minute.toString().padLeft(2, '0');
    final day = value.day.toString().padLeft(2, '0');
    final month = value.month.toString().padLeft(2, '0');
    return '$hour:$minute $day/$month/${value.year}';
  }
}

class _ProfileCard extends StatelessWidget {
  const _ProfileCard({required this.name, required this.subtitle});

  final String name;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Row(
        children: [
          Container(
            width: 50,
            height: 50,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: AppColors.safeGradient,
            ),
            alignment: Alignment.center,
            child: Text(
              name.substring(0, 1).toUpperCase(),
              style: AppTextStyles.h3.copyWith(color: Colors.white),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: AppTextStyles.title),
                const SizedBox(height: 4),
                Text(subtitle, style: AppTextStyles.body),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(children: children),
    );
  }
}

class _SectionDivider extends StatelessWidget {
  const _SectionDivider();

  @override
  Widget build(BuildContext context) {
    return const Divider(height: 1, thickness: 1, color: AppColors.border);
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.icon,
    required this.title,
    this.valueText,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String? valueText;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            _LeadingIcon(icon: icon),
            const SizedBox(width: 14),
            Expanded(child: Text(title, style: AppTextStyles.title)),
            if (valueText != null) ...[
              Flexible(
                child: Text(
                  valueText!,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.bodyStrong.copyWith(color: AppColors.primary),
                ),
              ),
              const SizedBox(width: 6),
            ],
            const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}

class _SwitchRow extends StatelessWidget {
  const _SwitchRow({
    required this.icon,
    required this.title,
    required this.value,
    required this.onChanged,
  });

  final IconData icon;
  final String title;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          _LeadingIcon(icon: icon),
          const SizedBox(width: 14),
          Expanded(child: Text(title, style: AppTextStyles.title)),
          Switch.adaptive(value: value, onChanged: onChanged),
        ],
      ),
    );
  }
}

class _SliderRow extends StatelessWidget {
  const _SliderRow({
    required this.icon,
    required this.title,
    required this.valueText,
    required this.minLabel,
    required this.maxLabel,
    required this.min,
    required this.max,
    required this.divisions,
    required this.value,
    required this.onChanged,
    required this.onChangeEnd,
  });

  final IconData icon;
  final String title;
  final String valueText;
  final String minLabel;
  final String maxLabel;
  final double min;
  final double max;
  final int divisions;
  final double value;
  final ValueChanged<double> onChanged;
  final ValueChanged<double> onChangeEnd;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
      child: Column(
        children: [
          Row(
            children: [
              _LeadingIcon(icon: icon),
              const SizedBox(width: 14),
              Expanded(child: Text(title, style: AppTextStyles.title)),
              Text(
                valueText,
                style: AppTextStyles.title.copyWith(color: AppColors.primary),
              ),
            ],
          ),
          SliderTheme(
            data: SliderTheme.of(context).copyWith(
              activeTrackColor: AppColors.primary,
              inactiveTrackColor: AppColors.border,
              thumbColor: Colors.white,
              overlayColor: AppColors.primary.withValues(alpha: 0.12),
              trackHeight: 4,
            ),
            child: Slider(
              value: value,
              min: min,
              max: max,
              divisions: divisions,
              onChanged: onChanged,
              onChangeEnd: onChangeEnd,
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(minLabel, style: AppTextStyles.caption),
              Text(maxLabel, style: AppTextStyles.caption),
            ],
          ),
        ],
      ),
    );
  }
}

class _LeadingIcon extends StatelessWidget {
  const _LeadingIcon({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 42,
      height: 42,
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Icon(icon, color: AppColors.primary),
    );
  }
}

class _LanguageOption extends StatelessWidget {
  const _LanguageOption({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        child: Row(
          children: [
            Expanded(child: Text(label, style: AppTextStyles.bodyLarge)),
            Icon(
              selected
                  ? Icons.check_circle_rounded
                  : Icons.radio_button_unchecked_rounded,
              color: selected ? AppColors.primary : AppColors.textMuted,
            ),
          ],
        ),
      ),
    );
  }
}
