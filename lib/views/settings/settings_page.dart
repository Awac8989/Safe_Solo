import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/providers/app_provider.dart';
import '../../core/widgets/app_shell.dart';

class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final appProvider = context.watch<AppProvider>();
    final user = appProvider.user;

    return AppPage(
      child: ListView(
        padding: const EdgeInsets.only(top: 18, bottom: 24),
        children: [
          Text('Cai dat', style: AppTextStyles.h2.copyWith(fontSize: 28)),
          const SizedBox(height: 8),
          Text(
            'Dieu chinh chu ky check-in, quiet hours, alert policy va cac tuy chon an toan.',
            style: AppTextStyles.bodyLarge.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 18),
          AppCard(
            child: Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: const BoxDecoration(
                    color: AppColors.primarySoft,
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    (user?.name.isNotEmpty == true ? user!.name : 'U')
                        .substring(0, 1)
                        .toUpperCase(),
                    style: AppTextStyles.h3.copyWith(color: AppColors.primary),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(user?.name ?? 'Nguoi dung', style: AppTextStyles.title),
                      const SizedBox(height: 4),
                      Text(
                        user?.email.isNotEmpty == true
                            ? user!.email
                            : user?.phoneNumber ?? '',
                        style: AppTextStyles.body,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _SettingTile(
            icon: Icons.schedule_rounded,
            title: 'Chu ky check-in',
            subtitle: _formatHours(appProvider.graceHours),
            onTap: () => _showGraceHoursDialog(context),
          ),
          const SizedBox(height: 12),
          _SettingTile(
            icon: Icons.dark_mode_outlined,
            title: 'Quiet hours',
            subtitle: user == null
                ? '--'
                : '${user.quietHoursStart} - ${user.quietHoursEnd} · grace ${user.falseAlertGraceMinutes} phut',
            onTap: () => _showQuietHoursDialog(context),
          ),
          const SizedBox(height: 12),
          _SettingTile(
            icon: Icons.notification_important_outlined,
            title: 'Alert policy',
            subtitle: appProvider.alertPolicy == null
                ? 'Mac dinh'
                : 'L1 ${appProvider.alertPolicy!.level1Minutes}p · L2 ${appProvider.alertPolicy!.level2Minutes}p · L3 ${appProvider.alertPolicy!.level3Minutes}p',
            onTap: () => _showAlertPolicyDialog(context),
          ),
          const SizedBox(height: 12),
          _SwitchTile(
            icon: Icons.contrast_rounded,
            title: 'Giao dien trang den',
            value: appProvider.highContrast,
            onChanged: (value) => context.read<AppProvider>().setHighContrast(value),
          ),
          const SizedBox(height: 12),
          _SettingTile(
            icon: Icons.hotel_outlined,
            title: 'Sleep mode',
            subtitle: appProvider.isVacation
                ? 'Tam dung den ${_formatDateTime(user?.sleepModeUntil)}'
                : 'Dang tat',
            onTap: () => _showSleepModeDialog(context),
          ),
          const SizedBox(height: 12),
          _SettingTile(
            icon: Icons.health_and_safety_outlined,
            title: 'Thong tin y te',
            subtitle: 'Cap nhat Medical ID va bao hiem',
            onTap: () => Navigator.pushNamed(context, '/medical'),
          ),
          const SizedBox(height: 12),
          _SettingTile(
            icon: Icons.groups_2_outlined,
            title: 'Guardians',
            subtitle: 'Quan ly toi da 3 nguoi than tin cay',
            onTap: () => Navigator.pushNamed(context, '/network'),
          ),
          const SizedBox(height: 12),
          _SettingTile(
            icon: Icons.lock_open_outlined,
            title: 'Vault',
            subtitle: 'Tai lieu nhay cam duoc mo bang PIN',
            onTap: () => Navigator.pushNamed(context, '/vault'),
          ),
          const SizedBox(height: 12),
          _SettingTile(
            icon: Icons.workspace_premium_outlined,
            title: 'Huy hieu',
            subtitle: 'Theo doi thanh tuu va chuoi ngay check-in',
            onTap: () => Navigator.pushNamed(context, '/achievements'),
          ),
          const SizedBox(height: 12),
          _SettingTile(
            icon: Icons.lock_outline_rounded,
            title: 'Bao mat',
            subtitle: 'PIN that, duress PIN va auto wipe',
            onTap: () => Navigator.pushNamed(context, '/security'),
          ),
          const SizedBox(height: 12),
          _SettingTile(
            icon: Icons.logout_rounded,
            title: 'Dang xuat',
            subtitle: 'Xoa phien hien tai khoi thiet bi nay',
            destructive: true,
            onTap: () => context.read<AppProvider>().signOut(),
          ),
        ],
      ),
    );
  }

  void _showGraceHoursDialog(BuildContext context) {
    final appProvider = context.read<AppProvider>();
    double selectedHours = appProvider.graceHours.clamp(1, 72).toDouble();

    showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setState) {
            final displayHours = selectedHours.round();

            return AlertDialog(
              title: const Text('Chu ky check-in'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Text(
                      _formatHours(displayHours),
                      style: AppTextStyles.h2.copyWith(
                        fontSize: 34,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Keo de chon thoi gian check-in tu 1 gio den 72 gio.',
                    style: AppTextStyles.body.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 18),
                  Slider(
                    min: 1,
                    max: 72,
                    divisions: 71,
                    value: selectedHours,
                    label: '$displayHours gio',
                    onChanged: (value) {
                      setState(() => selectedHours = value);
                    },
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('1 gio', style: AppTextStyles.caption),
                      Text('72 gio', style: AppTextStyles.caption),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [1, 3, 6, 12, 24, 48, 72].map((hours) {
                      final selected = displayHours == hours;
                      return ChoiceChip(
                        label: Text('$hours gio'),
                        selected: selected,
                        onSelected: (_) {
                          setState(() => selectedHours = hours.toDouble());
                        },
                      );
                    }).toList(),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext),
                  child: const Text('Huy'),
                ),
                ElevatedButton(
                  onPressed: () async {
                    Navigator.pop(dialogContext);
                    try {
                      await appProvider.setGraceHours(displayHours);
                    } catch (error) {
                      if (!context.mounted) {
                        return;
                      }
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(error.toString())),
                      );
                    }
                  },
                  child: const Text('Luu'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showQuietHoursDialog(BuildContext context) {
    final appProvider = context.read<AppProvider>();
    final user = appProvider.user;
    if (user == null) {
      return;
    }

    TimeOfDay selectedStart = _parseTimeOfDay(user.quietHoursStart);
    TimeOfDay selectedEnd = _parseTimeOfDay(user.quietHoursEnd);
    int selectedGrace = user.falseAlertGraceMinutes;

    showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              title: const Text('Quiet hours'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Dat khung thoi gian khong lam phien va do tre cho canh bao gia.',
                    style: AppTextStyles.body.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 16),
                  _TimePickerRow(
                    label: 'Bat dau',
                    value: _formatTimeOfDay(selectedStart),
                    onTap: () async {
                      final picked = await showTimePicker(
                        context: context,
                        initialTime: selectedStart,
                        builder: (context, child) {
                          return MediaQuery(
                            data: MediaQuery.of(context).copyWith(
                              alwaysUse24HourFormat: true,
                            ),
                            child: child!,
                          );
                        },
                      );
                      if (picked != null) {
                        setState(() => selectedStart = picked);
                      }
                    },
                  ),
                  const SizedBox(height: 12),
                  _TimePickerRow(
                    label: 'Ket thuc',
                    value: _formatTimeOfDay(selectedEnd),
                    onTap: () async {
                      final picked = await showTimePicker(
                        context: context,
                        initialTime: selectedEnd,
                        builder: (context, child) {
                          return MediaQuery(
                            data: MediaQuery.of(context).copyWith(
                              alwaysUse24HourFormat: true,
                            ),
                            child: child!,
                          );
                        },
                      );
                      if (picked != null) {
                        setState(() => selectedEnd = picked);
                      }
                    },
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'False-alert grace: $selectedGrace phut',
                    style: AppTextStyles.bodyStrong,
                  ),
                  Slider(
                    min: 0,
                    max: 30,
                    divisions: 30,
                    value: selectedGrace.toDouble(),
                    label: '$selectedGrace phut',
                    onChanged: (value) {
                      setState(() => selectedGrace = value.round());
                    },
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext),
                  child: const Text('Huy'),
                ),
                ElevatedButton(
                  onPressed: () async {
                    Navigator.pop(dialogContext);
                    try {
                      await appProvider.setQuietHours(
                        start: _formatTimeOfDay(selectedStart),
                        end: _formatTimeOfDay(selectedEnd),
                        falseAlertGraceMinutes: selectedGrace,
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
                  child: const Text('Cap nhat'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showAlertPolicyDialog(BuildContext context) {
    final appProvider = context.read<AppProvider>();
    final policy = appProvider.alertPolicy;
    if (policy == null) {
      return;
    }

    int level1Minutes = policy.level1Minutes;
    int level2Minutes = policy.level2Minutes;
    int level3Minutes = policy.level3Minutes;
    bool level4Enabled = policy.level4Enabled;

    showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              title: const Text('Alert policy'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    DropdownButtonFormField<int>(
                      initialValue: level1Minutes,
                      decoration: const InputDecoration(labelText: 'L1 reminder truoc han'),
                      items: [5, 10, 15, 30, 45, 60]
                          .map((value) => DropdownMenuItem(value: value, child: Text('$value phut')))
                          .toList(),
                      onChanged: (value) => setState(() => level1Minutes = value ?? level1Minutes),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<int>(
                      initialValue: level2Minutes,
                      decoration: const InputDecoration(labelText: 'L2 alarm sau tre han'),
                      items: [3, 5, 10, 15, 20]
                          .map((value) => DropdownMenuItem(value: value, child: Text('$value phut')))
                          .toList(),
                      onChanged: (value) => setState(() => level2Minutes = value ?? level2Minutes),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<int>(
                      initialValue: level3Minutes,
                      decoration: const InputDecoration(labelText: 'L3 SOS sau tre han'),
                      items: [10, 15, 20, 30, 45]
                          .map((value) => DropdownMenuItem(value: value, child: Text('$value phut')))
                          .toList(),
                      onChanged: (value) => setState(() => level3Minutes = value ?? level3Minutes),
                    ),
                    const SizedBox(height: 12),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Bat L4 rescue call'),
                      value: level4Enabled,
                      onChanged: (value) => setState(() => level4Enabled = value),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext),
                  child: const Text('Huy'),
                ),
                ElevatedButton(
                  onPressed: () async {
                    Navigator.pop(dialogContext);
                    try {
                      await appProvider.updateAlertPolicy(
                        level1Minutes: level1Minutes,
                        level2Minutes: level2Minutes,
                        level3Minutes: level3Minutes,
                        level4Enabled: level4Enabled,
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
                  child: const Text('Cap nhat'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showSleepModeDialog(BuildContext context) {
    final appProvider = context.read<AppProvider>();
    double selectedHours = 8;

    showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setState) {
            final displayHours = selectedHours.round();

            return AlertDialog(
              title: const Text('Sleep mode'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (appProvider.isVacation) ...[
                    Text(
                      'Dang tam dung canh bao den ${_formatDateTime(appProvider.user?.sleepModeUntil)}.',
                      style: AppTextStyles.bodyLarge,
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () async {
                          Navigator.pop(dialogContext);
                          await appProvider.endVacation();
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.destructive,
                        ),
                        child: const Text('Tat sleep mode'),
                      ),
                    ),
                  ] else ...[
                    Text(
                      'Tam dung thong bao va escalation trong khoang 1 den 24 gio.',
                      style: AppTextStyles.body.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 18),
                    Center(
                      child: Text(
                        '$displayHours gio',
                        style: AppTextStyles.h2.copyWith(
                          fontSize: 34,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Slider(
                      min: 1,
                      max: 24,
                      divisions: 23,
                      value: selectedHours,
                      label: '$displayHours gio',
                      onChanged: (value) {
                        setState(() => selectedHours = value);
                      },
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [1, 4, 8, 12, 24].map((hours) {
                        return ChoiceChip(
                          label: Text('$hours gio'),
                          selected: displayHours == hours,
                          onSelected: (_) {
                            setState(() => selectedHours = hours.toDouble());
                          },
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 18),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () async {
                          Navigator.pop(dialogContext);
                          await appProvider.setSleepModeHours(displayHours);
                        },
                        child: const Text('Bat dau'),
                      ),
                    ),
                  ],
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext),
                  child: const Text('Dong'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  static String _formatHours(int hours) {
    final days = hours ~/ 24;
    final remainHours = hours % 24;
    if (days == 0) {
      return '$hours gio';
    }
    if (remainHours == 0) {
      return '$days ngay';
    }
    return '$days ngay $remainHours gio';
  }

  static TimeOfDay _parseTimeOfDay(String value) {
    final parts = value.split(':');
    if (parts.length != 2) {
      return const TimeOfDay(hour: 23, minute: 0);
    }
    return TimeOfDay(
      hour: int.tryParse(parts[0]) ?? 23,
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
      return 'khong xac dinh';
    }
    final hour = value.hour.toString().padLeft(2, '0');
    final minute = value.minute.toString().padLeft(2, '0');
    final day = value.day.toString().padLeft(2, '0');
    final month = value.month.toString().padLeft(2, '0');
    return '$hour:$minute $day/$month/${value.year}';
  }
}

class _SettingTile extends StatelessWidget {
  const _SettingTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.destructive = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final titleColor = destructive ? AppColors.destructive : AppColors.textPrimary;

    return GestureDetector(
      onTap: onTap,
      child: AppCard(
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: destructive ? const Color(0xFFFFEEEE) : AppColors.primarySoft,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: titleColor),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: AppTextStyles.title.copyWith(color: titleColor),
                  ),
                  const SizedBox(height: 4),
                  Text(subtitle, style: AppTextStyles.body),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}

class _SwitchTile extends StatelessWidget {
  const _SwitchTile({
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
    return AppCard(
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: AppColors.primary),
          ),
          const SizedBox(width: 14),
          Expanded(child: Text(title, style: AppTextStyles.title)),
          Switch(
            value: value,
            onChanged: onChanged,
            activeThumbColor: AppColors.primary,
          ),
        ],
      ),
    );
  }
}

class _TimePickerRow extends StatelessWidget {
  const _TimePickerRow({
    required this.label,
    required this.value,
    required this.onTap,
  });

  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AppCard(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        color: AppColors.accent,
        shadow: const [],
        border: Border.all(color: AppColors.border),
        radius: AppRadius.lg,
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: AppTextStyles.caption),
                  const SizedBox(height: 4),
                  Text(value, style: AppTextStyles.title),
                ],
              ),
            ),
            const Icon(Icons.access_time_rounded, color: AppColors.textSecondary),
          ],
        ),
      ),
    );
  }
}
