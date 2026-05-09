import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/providers/app_provider.dart';

class VaultPage extends StatefulWidget {
  const VaultPage({super.key});

  @override
  State<VaultPage> createState() => _VaultPageState();
}

class _VaultPageState extends State<VaultPage> {
  bool _unlocked = false;

  static const _icons = <String, IconData>{
    'checklist': Icons.task_alt_rounded,
    'farewell': Icons.favorite_outline_rounded,
    'passwords': Icons.key_rounded,
    'funeral': Icons.local_florist_outlined,
    'medical': Icons.medical_information_outlined,
    'pets': Icons.pets_outlined,
    'insurance': Icons.shield_outlined,
    'assets': Icons.account_balance_wallet_outlined,
    'other': Icons.note_alt_outlined,
  };

  Future<void> _unlock() async {
    final controller = TextEditingController();
    final security = context.read<AppProvider>().security;
    final validPin = security.realPin.isEmpty ? '1909' : security.realPin;
    var wrongPin = false;

    await showDialog<void>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Mở két sắt sinh tử'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: controller,
                keyboardType: TextInputType.number,
                obscureText: true,
                decoration: InputDecoration(
                  labelText: 'Nhập PIN chính',
                  errorText: wrongPin ? 'PIN không đúng.' : null,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Két chỉ mở bằng real PIN. Duress PIN không có tác dụng ở đây.',
                style: AppTextStyles.caption,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Huỷ'),
            ),
            ElevatedButton(
              onPressed: () {
                if (controller.text.trim() == validPin) {
                  setState(() => _unlocked = true);
                  Navigator.pop(dialogContext);
                  return;
                }
                setDialogState(() => wrongPin = true);
              },
              child: const Text('Xác thực'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _editEntry(VaultEntry entry) async {
    if (!_unlocked) {
      await _unlock();
      if (!_unlocked || !mounted) {
        return;
      }
    }

    final controller = TextEditingController(text: entry.content);
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 16,
            bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 16,
          ),
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(AppRadius.xl),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(entry.title, style: AppTextStyles.h3),
                const SizedBox(height: 8),
                Text(entry.hint, style: AppTextStyles.body),
                const SizedBox(height: 16),
                TextField(
                  controller: controller,
                  minLines: 6,
                  maxLines: 12,
                  decoration: InputDecoration(
                    hintText: 'Nhập nội dung cần Guardian nhận được...',
                    filled: true,
                    fillColor: AppColors.backgroundAlt,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () async {
                      await context.read<AppProvider>().saveVaultEntry(
                        entryId: entry.id,
                        content: controller.text,
                      );
                      if (sheetContext.mounted) {
                        Navigator.pop(sheetContext);
                      }
                    },
                    child: const Text('Lưu vào két'),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppProvider>();
    final user = app.user;
    final guardians = user?.emergencyContacts.length ?? 0;
    final entries = app.vaultEntries;
    final releaseAt = app.vaultUnlockAt;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Két sắt sinh tử'),
        actions: [
          TextButton(
            onPressed: _unlocked ? () => setState(() => _unlocked = false) : _unlock,
            child: Text(_unlocked ? 'Khoá' : 'Mở'),
          ),
        ],
      ),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            _VaultSummaryCard(
              unlocked: _unlocked,
              guardians: guardians,
              graceHours: app.graceHours,
              lastCheckIn: user?.lastCheckinTime,
              releaseAt: releaseAt,
              releasedAt: app.vaultReleaseAt,
              autoWipeAt: app.vaultAutoWipeAt,
              isVacation: app.isVacation,
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Cơ chế dead-man switch', style: AppTextStyles.title),
                    const SizedBox(height: 8),
                    Text(
                      'Mỗi lần bạn check-in, đồng hồ an toàn được reset. Nếu quá ${app.graceHours} giờ mà không check-in và không ở chế độ nghỉ dưỡng, hệ thống coi là mất liên lạc. Sau 72 giờ mất liên lạc liên tiếp, két tự mở và gửi nội dung cho Guardian.',
                      style: AppTextStyles.body,
                    ),
                  ],
                ),
              ),
            ),
            if (app.isVaultAutoWiped) ...[
              const SizedBox(height: 16),
              Card(
                color: AppColors.destructive.withValues(alpha: 0.08),
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.warning_amber_rounded, color: AppColors.destructive),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Auto-wipe đã xoá dữ liệu nhạy cảm cục bộ trên máy vào ${_formatDateTime(app.vaultAutoWipeAt)}. Nội dung mới cần được nhập lại nếu bạn muốn lưu tiếp.',
                          style: AppTextStyles.bodyStrong.copyWith(color: AppColors.destructive),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
            const SizedBox(height: 16),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: entries.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 14,
                crossAxisSpacing: 14,
                childAspectRatio: 0.92,
              ),
              itemBuilder: (context, index) {
                final entry = entries[index];
                final accent = index % 3 == 0
                    ? AppColors.safeGradient
                    : index % 3 == 1
                    ? AppColors.warnGradient
                    : AppColors.dangerGradient;
                return InkWell(
                  borderRadius: BorderRadius.circular(AppRadius.xl),
                  onTap: () => _editEntry(entry),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadius.xl),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        Container(decoration: BoxDecoration(gradient: accent)),
                        BackdropFilter(
                          filter: ImageFilter.blur(
                            sigmaX: _unlocked ? 0 : 10,
                            sigmaY: _unlocked ? 0 : 10,
                          ),
                          child: Container(
                            color: Colors.white.withValues(alpha: _unlocked ? 0.08 : 0.44),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(
                                _icons[entry.id] ?? Icons.folder_outlined,
                                size: 28,
                                color: Colors.white,
                              ),
                              const Spacer(),
                              Text(
                                entry.title,
                                style: AppTextStyles.title.copyWith(color: Colors.white),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                _unlocked
                                    ? (entry.hasContent ? entry.content : entry.hint)
                                    : 'Nội dung được mã hoá cho đến khi nhập đúng PIN.',
                                maxLines: 4,
                                overflow: TextOverflow.ellipsis,
                                style: AppTextStyles.caption.copyWith(
                                  color: Colors.white.withValues(alpha: 0.96),
                                ),
                              ),
                              const SizedBox(height: 10),
                              Text(
                                _unlocked
                                    ? (entry.updatedAt == null
                                        ? 'Chưa có dữ liệu'
                                        : 'Cập nhật ${_formatDateTime(entry.updatedAt)}')
                                    : 'Chạm để mở kho',
                                style: AppTextStyles.caption.copyWith(color: Colors.white),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _VaultSummaryCard extends StatelessWidget {
  const _VaultSummaryCard({
    required this.unlocked,
    required this.guardians,
    required this.graceHours,
    required this.lastCheckIn,
    required this.releaseAt,
    required this.releasedAt,
    required this.autoWipeAt,
    required this.isVacation,
  });

  final bool unlocked;
  final int guardians;
  final int graceHours;
  final DateTime? lastCheckIn;
  final DateTime? releaseAt;
  final DateTime? releasedAt;
  final DateTime? autoWipeAt;
  final bool isVacation;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    gradient: AppColors.dangerGradient,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: const Icon(Icons.lock_clock_outlined, color: Colors.white),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Vault trạng thái', style: AppTextStyles.title),
                      const SizedBox(height: 4),
                      Text(
                        releasedAt != null
                            ? 'Đã phát hành cho Guardian'
                            : unlocked
                            ? 'Đã mở cục bộ bằng PIN chính'
                            : 'Đang khoá và chờ điều kiện mở',
                        style: AppTextStyles.body,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                _StatusPill(label: 'Guardian', value: '$guardians người'),
                _StatusPill(label: 'Grace', value: '$graceHours giờ'),
                _StatusPill(
                  label: 'Check-in cuối',
                  value: lastCheckIn == null ? 'Chưa có' : _formatDateTime(lastCheckIn),
                ),
                _StatusPill(
                  label: 'Tự mở',
                  value: isVacation
                      ? 'Đang tạm dừng'
                      : releaseAt == null
                      ? 'Chưa xác định'
                      : _formatDateTime(releaseAt),
                ),
                if (autoWipeAt != null)
                  _StatusPill(label: 'Auto-wipe', value: _formatDateTime(autoWipeAt)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.cardSoft,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label, style: AppTextStyles.caption),
          const SizedBox(height: 4),
          Text(value, style: AppTextStyles.bodyStrong),
        ],
      ),
    );
  }
}

String _formatDateTime(DateTime? value) {
  if (value == null) {
    return 'Chưa có';
  }
  final hour = value.hour.toString().padLeft(2, '0');
  final minute = value.minute.toString().padLeft(2, '0');
  final day = value.day.toString().padLeft(2, '0');
  final month = value.month.toString().padLeft(2, '0');
  return '$hour:$minute $day/$month/${value.year}';
}
