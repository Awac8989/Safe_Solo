import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/providers/app_provider.dart';
import '../../core/widgets/app_shell.dart';

class AuthPage extends StatefulWidget {
  const AuthPage({super.key});

  @override
  State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _emergencyNameController = TextEditingController();
  final _emergencyPhoneController = TextEditingController();

  int _timerInterval = 720;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _emergencyNameController.dispose();
    _emergencyPhoneController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    final provider = context.read<AppProvider>();
    try {
      await provider.authenticate(
        fullName: _nameController.text.trim(),
        phoneNumber: _phoneController.text.trim(),
        email: _emailController.text.trim(),
        emergencyName: _emergencyNameController.text.trim(),
        emergencyPhone: _emergencyPhoneController.text.trim(),
        timerIntervalMinutes: _timerInterval,
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

  @override
  Widget build(BuildContext context) {
    final appProvider = context.watch<AppProvider>();

    return Scaffold(
      body: AppPage(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.only(top: 24, bottom: 24),
            children: [
              const SizedBox(height: 12),
              Row(
                children: [
                  Icon(Icons.shield_outlined, size: 24, color: AppColors.primary),
                  const SizedBox(width: 8),
                  Text(
                    'SafeSolo',
                    style: AppTextStyles.title.copyWith(color: AppColors.primary),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Text(
                'Dang nhap hoac tao ho so',
                style: AppTextStyles.h1.copyWith(fontSize: 32),
              ),
              const SizedBox(height: 10),
              Text(
                'Ung dung se tu dong nhan dien tai khoan theo so dien thoai. Neu chua co ho so, SafeSolo se tao moi va khoi dong dead man switch cho ban.',
                style: AppTextStyles.bodyLarge.copyWith(
                  color: AppColors.textSecondary,
                  height: 1.55,
                ),
              ),
              const SizedBox(height: 24),
              AppCard(
                child: Column(
                  children: [
                    TextFormField(
                      controller: _nameController,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Ho va ten',
                        prefixIcon: Icon(Icons.person_outline_rounded),
                      ),
                      validator: (value) => (value == null || value.trim().isEmpty)
                          ? 'Nhap ho va ten'
                          : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _phoneController,
                      textInputAction: TextInputAction.next,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(
                        labelText: 'So dien thoai',
                        prefixIcon: Icon(Icons.phone_outlined),
                      ),
                      validator: (value) => (value == null || value.trim().length < 8)
                          ? 'Nhap so dien thoai hop le'
                          : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _emailController,
                      textInputAction: TextInputAction.next,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(
                        labelText: 'Email (tuy chon)',
                        prefixIcon: Icon(Icons.mail_outline_rounded),
                      ),
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _emergencyNameController,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Nguoi lien he khan cap',
                        prefixIcon: Icon(Icons.family_restroom_outlined),
                      ),
                      validator: (value) => (value == null || value.trim().isEmpty)
                          ? 'Nhap ten nguoi lien he'
                          : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _emergencyPhoneController,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(
                        labelText: 'So dien thoai khan cap',
                        prefixIcon: Icon(Icons.contact_phone_outlined),
                      ),
                      validator: (value) => (value == null || value.trim().length < 8)
                          ? 'Nhap so dien thoai khan cap'
                          : null,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              Text(
                'Chu ky check-in mac dinh',
                style: AppTextStyles.title,
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: const [180, 360, 720, 1440]
                    .map(
                      (minutes) => _TimerChoiceData(
                        minutes: minutes,
                        label: minutes == 1440
                            ? '24 gio'
                            : '${minutes ~/ 60} gio',
                      ),
                    )
                    .map(
                      (item) => ChoiceChip(
                        label: Text(item.label),
                        selected: false,
                      ),
                    )
                    .toList(),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [180, 360, 720, 1440]
                    .map(
                      (minutes) => ChoiceChip(
                        label: Text(
                          minutes == 1440 ? '24 gio' : '${minutes ~/ 60} gio',
                        ),
                        selected: _timerInterval == minutes,
                        onSelected: (_) {
                          setState(() => _timerInterval = minutes);
                        },
                      ),
                    )
                    .toList(),
              ),
              if (appProvider.lastError != null) ...[
                const SizedBox(height: 18),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF3F0),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFFFC6BB)),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.error_outline_rounded,
                        color: AppColors.destructive,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          appProvider.lastError!,
                          style: AppTextStyles.body.copyWith(
                            color: AppColors.destructive,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: appProvider.isBusy ? null : _handleSubmit,
                  child: appProvider.isBusy
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : const Text('Tiep tuc vao SafeSolo'),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Neu so dien thoai da ton tai, SafeSolo se dang nhap va dong bo du lieu backend. Neu chua ton tai, he thong se tao moi ho so va deadline check-in dau tien cho ban.',
                style: AppTextStyles.body.copyWith(color: AppColors.textMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TimerChoiceData {
  const _TimerChoiceData({
    required this.minutes,
    required this.label,
  });

  final int minutes;
  final String label;
}
