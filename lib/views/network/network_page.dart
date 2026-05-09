import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/providers/app_provider.dart';

class NetworkPage extends StatelessWidget {
  const NetworkPage({super.key});

  @override
  Widget build(BuildContext context) {
    final appProvider = context.watch<AppProvider>();
    final contacts = appProvider.user?.emergencyContacts ?? const [];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Guardians'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Toi da 3 guardians co the nhan canh bao va lien he nhanh khi can.',
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
              label: const Text('Them guardian'),
            ),
        ],
      ),
    );
  }

  Future<void> _deleteGuardian(BuildContext context, EmergencyContact contact) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Xoa guardian'),
        content: Text('Ban co chac muon xoa ${contact.name} khoi mang bao ve?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Huy'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Xoa'),
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
    final nameController = TextEditingController();
    final phoneController = TextEditingController();
    final relationController = TextEditingController();

    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Them guardian'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              decoration: const InputDecoration(labelText: 'Ho ten'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: phoneController,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'So dien thoai'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: relationController,
              decoration: const InputDecoration(labelText: 'Quan he'),
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
            child: const Text('Luu'),
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
