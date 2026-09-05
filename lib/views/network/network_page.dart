import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_strings.dart';
import '../../core/app_theme.dart';
import '../../core/providers/app_provider.dart';

class NetworkPage extends StatelessWidget {
  const NetworkPage({super.key});

  AppStrings _strings(BuildContext context) =>
      AppStrings(context.read<AppProvider>().language);

  @override
  Widget build(BuildContext context) {
    final appProvider = context.watch<AppProvider>();
    final strings = _strings(context);
    final rawContacts = appProvider.user?.emergencyContacts ?? const [];
    // Sort by priority ascending (1 -> 2 -> 3)
    final contacts = [...rawContacts]..sort((a, b) => a.priority.compareTo(b.priority));

    return Scaffold(
      appBar: AppBar(
        title: Text(strings.text('Người bảo hộ & Khẩn cấp', 'Guardians & Contacts')),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.primarySoft.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(AppRadius.lg),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
            ),
            child: Row(
              children: [
                const Icon(Icons.shield_outlined, color: AppColors.primary, size: 22),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    strings.text(
                      'Tối đa 3 người bảo hộ được phân cấp ưu tiên (Cấp 1 là người đầu tiên nhận SMS & cuộc gọi cứu hộ).',
                      'Up to 3 guardians prioritized (Priority 1 receives emergency SMS & rescue call first).',
                    ),
                    style: AppTextStyles.body.copyWith(fontSize: 12, color: AppColors.textPrimary),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          for (final contact in contacts) ...[
            _GuardianCard(
              contact: contact,
              onEdit: () => _openGuardianDialog(context, existingContact: contact),
              onDelete: () => _deleteGuardian(context, contact),
            ),
            const SizedBox(height: 12),
          ],
          if (contacts.length < 3)
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.lg)),
              ),
              onPressed: () => _openGuardianDialog(context),
              icon: const Icon(Icons.person_add_alt_1_rounded),
              label: Text(strings.text('Thêm người bảo hộ', 'Add guardian')),
            ),
        ],
      ),
    );
  }

  Future<void> _deleteGuardian(
    BuildContext context,
    EmergencyContact contact,
  ) async {
    final strings = _strings(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(strings.text('Xóa người bảo hộ', 'Remove guardian')),
        content: Text(
          strings.text(
            'Bạn có chắc muốn xóa ${contact.name} khỏi mạng bảo vệ?',
            'Are you sure you want to remove ${contact.name} from your safety network?',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(strings.text('Hủy', 'Cancel')),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text(strings.text('Xóa', 'Remove')),
          ),
        ],
      ),
    );

    if (confirmed != true || !context.mounted) {
      return;
    }

    final appProvider = context.read<AppProvider>();
    final next = [...?appProvider.user?.emergencyContacts]
      ..removeWhere((item) => item.phone == contact.phone);
    await appProvider.setEmergencyContacts(next);
  }

  Future<void> _openGuardianDialog(
    BuildContext context, {
    EmergencyContact? existingContact,
  }) async {
    final strings = _strings(context);
    final isEditing = existingContact != null;
    final nameController = TextEditingController(text: existingContact?.name ?? '');
    final phoneController = TextEditingController(text: existingContact?.phone ?? '');
    final relationController = TextEditingController(text: existingContact?.relation ?? '');
    int selectedPriority = existingContact?.priority ?? 1;

    await showDialog<void>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: Text(
            isEditing
                ? strings.text('Chỉnh sửa người bảo hộ', 'Edit guardian')
                : strings.text('Thêm người bảo hộ', 'Add guardian'),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: nameController,
                  decoration: InputDecoration(
                    labelText: strings.text('Họ và tên', 'Full name'),
                    prefixIcon: const Icon(Icons.person_outline),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: phoneController,
                  keyboardType: TextInputType.phone,
                  decoration: InputDecoration(
                    labelText: strings.text('Số điện thoại', 'Phone number'),
                    prefixIcon: const Icon(Icons.phone_outlined),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: relationController,
                  decoration: InputDecoration(
                    labelText: strings.text('Quan hệ (Bố, mẹ, vợ, bạn...)', 'Relationship'),
                    prefixIcon: const Icon(Icons.family_restroom_outlined),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  strings.text('Mức độ ưu tiên cảnh báo:', 'Alert priority level:'),
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<int>(
                  initialValue: selectedPriority,
                  decoration: InputDecoration(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppRadius.md)),
                  ),
                  items: [
                    DropdownMenuItem(
                      value: 1,
                      child: Text(
                        strings.text('Cấp 1 - Chính (Liên hệ đầu tiên)', 'Priority 1 - Primary (First contact)'),
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0284C7)),
                      ),
                    ),
                    DropdownMenuItem(
                      value: 2,
                      child: Text(
                        strings.text('Cấp 2 (Liên hệ thứ hai)', 'Priority 2 (Second contact)'),
                        style: const TextStyle(fontSize: 13, color: Color(0xFF8B5CF6)),
                      ),
                    ),
                    DropdownMenuItem(
                      value: 3,
                      child: Text(
                        strings.text('Cấp 3 (Liên hệ dự phòng)', 'Priority 3 (Backup contact)'),
                        style: const TextStyle(fontSize: 13, color: Colors.grey),
                      ),
                    ),
                  ],
                  onChanged: (val) {
                    if (val != null) setState(() => selectedPriority = val);
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: Text(strings.text('Hủy', 'Cancel')),
            ),
            ElevatedButton(
              onPressed: () async {
                final name = nameController.text.trim();
                final phone = phoneController.text.trim();
                final relation = relationController.text.trim();
                if (name.isEmpty || phone.isEmpty || relation.isEmpty) {
                  return;
                }

                final appProvider = context.read<AppProvider>();
                final current = [...?appProvider.user?.emergencyContacts];

                final updated = EmergencyContact(
                  name: name,
                  phone: phone,
                  relation: relation,
                  priority: selectedPriority,
                );

                if (isEditing) {
                  final index = current.indexWhere((item) => item.phone == existingContact.phone);
                  if (index != -1) {
                    current[index] = updated;
                  } else {
                    current.add(updated);
                  }
                } else {
                  // Replace if phone already exists, otherwise append
                  current.removeWhere((item) => item.phone == phone);
                  current.add(updated);
                }

                // Sort by priority and cap at 3
                current.sort((a, b) => a.priority.compareTo(b.priority));
                await appProvider.setEmergencyContacts(current.take(3).toList());
                if (dialogContext.mounted) {
                  Navigator.pop(dialogContext);
                }
              },
              child: Text(strings.text('Lưu', 'Save')),
            ),
          ],
        ),
      ),
    );
  }
}

class _GuardianCard extends StatelessWidget {
  const _GuardianCard({
    required this.contact,
    required this.onEdit,
    required this.onDelete,
  });

  final EmergencyContact contact;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  Color _priorityColor() {
    switch (contact.priority) {
      case 1:
        return const Color(0xFF0284C7); // Sky / Primary
      case 2:
        return const Color(0xFF8B5CF6); // Purple / Secondary
      default:
        return const Color(0xFF64748B); // Slate / Tertiary
    }
  }

  String _priorityText() {
    switch (contact.priority) {
      case 1:
        return 'ƯU TIÊN 1 (CHÍNH)';
      case 2:
        return 'ƯU TIÊN 2';
      default:
        return 'ƯU TIÊN 3';
    }
  }

  @override
  Widget build(BuildContext context) {
    final priorityColor = _priorityColor();

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadius.xl),
        boxShadow: AppShadows.card,
        border: Border.all(
          color: contact.priority == 1 ? priorityColor.withValues(alpha: 0.3) : Colors.transparent,
          width: 1.5,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: priorityColor.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              contact.name.isNotEmpty ? contact.name.substring(0, 1).toUpperCase() : 'G',
              style: AppTextStyles.h3.copyWith(color: priorityColor),
            ),
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
                        contact.name,
                        style: AppTextStyles.title.copyWith(fontSize: 15),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: priorityColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: priorityColor.withValues(alpha: 0.3)),
                      ),
                      child: Text(
                        _priorityText(),
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          color: priorityColor,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  '${contact.relation} · ${contact.phone}',
                  style: AppTextStyles.body.copyWith(fontSize: 12, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Sửa thông tin',
            icon: const Icon(Icons.edit_outlined, size: 20, color: Color(0xFF0284C7)),
            onPressed: onEdit,
          ),
          IconButton(
            tooltip: 'Xóa người bảo hộ',
            icon: const Icon(Icons.delete_outline_rounded, size: 20, color: Colors.redAccent),
            onPressed: onDelete,
          ),
        ],
      ),
    );
  }
}
