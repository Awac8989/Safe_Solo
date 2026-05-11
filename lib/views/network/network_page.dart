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
    final contacts = appProvider.user?.emergencyContacts ?? const [];

    return Scaffold(
      appBar: AppBar(
        title: Text(strings.text('Người bảo hộ', 'Guardians')),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            strings.text(
              'Tối đa 3 người bảo hộ có thể nhận cảnh báo và liên hệ nhanh khi cần.',
              'Up to 3 guardians can receive alerts and reach you quickly when needed.',
            ),
            style: AppTextStyles.body.copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 18),
          for (final contact in contacts) ...[
            _GuardianCard(
              contact: contact,
              onDelete: () => _deleteGuardian(context, contact),
            ),
            const SizedBox(height: 12),
          ],
          if (contacts.length < 3)
            OutlinedButton.icon(
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

  Future<void> _openGuardianDialog(BuildContext context) async {
    final strings = _strings(context);
    final nameController = TextEditingController();
    final phoneController = TextEditingController();
    final relationController = TextEditingController();

    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(strings.text('Thêm người bảo hộ', 'Add guardian')),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              decoration: InputDecoration(
                labelText: strings.text('Họ và tên', 'Full name'),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: phoneController,
              keyboardType: TextInputType.phone,
              decoration: InputDecoration(
                labelText: strings.text('Số điện thoại', 'Phone number'),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: relationController,
              decoration: InputDecoration(
                labelText: strings.text('Quan hệ', 'Relationship'),
              ),
            ),
          ],
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
              current.add(
                EmergencyContact(
                  name: name,
                  phone: phone,
                  relation: relation,
                ),
              );
              await appProvider.setEmergencyContacts(current.take(3).toList());
              if (dialogContext.mounted) {
                Navigator.pop(dialogContext);
              }
            },
            child: Text(strings.text('Lưu', 'Save')),
          ),
        ],
      ),
    );
  }
}

class _GuardianCard extends StatelessWidget {
  const _GuardianCard({
    required this.contact,
    required this.onDelete,
  });

  final EmergencyContact contact;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadius.xl),
        boxShadow: AppShadows.card,
      ),
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
              contact.name.substring(0, 1).toUpperCase(),
              style: AppTextStyles.h3.copyWith(color: AppColors.primary),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(contact.name, style: AppTextStyles.title),
                const SizedBox(height: 4),
                Text(contact.relation, style: AppTextStyles.caption),
                const SizedBox(height: 4),
                Text(contact.phone, style: AppTextStyles.body),
              ],
            ),
          ),
          IconButton(
            onPressed: onDelete,
            icon: const Icon(Icons.delete_outline_rounded),
          ),
        ],
      ),
    );
  }
}
