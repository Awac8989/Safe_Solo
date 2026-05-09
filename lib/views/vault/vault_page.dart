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

  static const _docs = [
    ('CCCD mat truoc', Icons.badge_outlined),
    ('CCCD mat sau', Icons.credit_card_rounded),
    ('Di chuc', Icons.description_outlined),
    ('Hop dong bao hiem', Icons.folder_shared_outlined),
  ];

  Future<void> _unlock() async {
    final controller = TextEditingController();
    final security = context.read<AppProvider>().security;
    final validPin = security.realPin.isEmpty ? '1909' : security.realPin;

    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Mo ket'),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          obscureText: true,
          decoration: const InputDecoration(
            labelText: 'Nhap PIN',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Huy'),
          ),
          ElevatedButton(
            onPressed: () {
              if (controller.text.trim() == validPin) {
                setState(() => _unlocked = true);
                Navigator.pop(dialogContext);
              }
            },
            child: const Text('Xac thuc'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Vault'),
        actions: [
          TextButton(
            onPressed: _unlocked ? () => setState(() => _unlocked = false) : _unlock,
            child: Text(_unlocked ? 'Khoa' : 'Mo'),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: GridView.builder(
          itemCount: _docs.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: 14,
            crossAxisSpacing: 14,
            childAspectRatio: 0.95,
          ),
          itemBuilder: (context, index) {
            final item = _docs[index];
            return ClipRRect(
              borderRadius: BorderRadius.circular(AppRadius.xl),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Container(
                    decoration: BoxDecoration(
                      gradient: index.isEven ? AppColors.safeGradient : AppColors.warnGradient,
                    ),
                  ),
                  BackdropFilter(
                    filter: ImageFilter.blur(
                      sigmaX: _unlocked ? 0 : 9,
                      sigmaY: _unlocked ? 0 : 9,
                    ),
                    child: Container(color: Colors.white.withValues(alpha: _unlocked ? 0.08 : 0.45)),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(item.$2, size: 28, color: Colors.white),
                        const Spacer(),
                        Text(
                          item.$1,
                          style: AppTextStyles.title.copyWith(color: Colors.white),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _unlocked ? 'Da mo xem' : 'Duoc an cho den khi nhap PIN',
                          style: AppTextStyles.caption.copyWith(color: Colors.white),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}
