import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_strings.dart';
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
    final strings = AppStrings.of(context);

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
                strings.text('Đăng nhập hoặc tạo hồ sơ', 'Sign in or create profile'),
                style: AppTextStyles.h1.copyWith(fontSize: 32),
              ),
              const SizedBox(height: 10),
              Text(
                strings.text(
                  'Ứng dụng sẽ tự động nhận diện tài khoản theo số điện thoại. Nếu chưa có hồ sơ, SafeSolo sẽ tạo mới và khởi động luồng kiểm tra an toàn cho bạn.',
                  'The app identifies your account by phone number. If no profile exists, SafeSolo creates one and starts your safety check-in flow.',
                ),
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
                      decoration: InputDecoration(
                        labelText: strings.text('Họ và tên', 'Full name'),
                        prefixIcon: const Icon(Icons.person_outline_rounded),
                      ),
                      validator: (value) => (value == null || value.trim().isEmpty)
                          ? strings.text('Nhập họ và tên', 'Enter your full name')
                          : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _phoneController,
                      textInputAction: TextInputAction.next,
                      keyboardType: TextInputType.phone,
                      decoration: InputDecoration(
                        labelText: strings.text('Số điện thoại', 'Phone number'),
                        prefixIcon: const Icon(Icons.phone_outlined),
                      ),
                      validator: (value) => (value == null || value.trim().length < 8)
                          ? strings.text('Nhập số điện thoại hợp lệ', 'Enter a valid phone number')
                          : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _emailController,
                      textInputAction: TextInputAction.next,
                      keyboardType: TextInputType.emailAddress,
                      decoration: InputDecoration(
                        labelText: strings.text('Email (tùy chọn)', 'Email (optional)'),
                        prefixIcon: const Icon(Icons.mail_outline_rounded),
                      ),
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _emergencyNameController,
                      textInputAction: TextInputAction.next,
                      decoration: InputDecoration(
                        labelText: strings.text('Người liên hệ khẩn cấp', 'Emergency contact'),
                        prefixIcon: const Icon(Icons.family_restroom_outlined),
                      ),
                      validator: (value) => (value == null || value.trim().isEmpty)
                          ? strings.text('Nhập tên người liên hệ', 'Enter the contact name')
                          : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _emergencyPhoneController,
                      keyboardType: TextInputType.phone,
                      decoration: InputDecoration(
                        labelText: strings.text('Số điện thoại khẩn cấp', 'Emergency phone number'),
                        prefixIcon: const Icon(Icons.contact_phone_outlined),
                      ),
                      validator: (value) => (value == null || value.trim().length < 8)
                          ? strings.text(
                              'Nhập số điện thoại khẩn cấp',
                              'Enter the emergency phone number',
                            )
                          : null,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              Text(
                strings.text('Chu kỳ check-in mặc định', 'Default check-in cycle'),
                style: AppTextStyles.title,
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [180, 360, 720, 1440]
                    .map(
                      (minutes) => ChoiceChip(
                        label: Text(
                          minutes == 1440
                              ? strings.text('24 giờ', '24 hours')
                              : strings.text('${minutes ~/ 60} giờ', '${minutes ~/ 60} hours'),
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
                      : Text(strings.text('Tiếp tục vào SafeSolo', 'Continue to SafeSolo')),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                strings.text(
                  'Nếu số điện thoại đã tồn tại, SafeSolo sẽ đăng nhập và đồng bộ dữ liệu backend. Nếu chưa tồn tại, hệ thống sẽ tạo hồ sơ mới và mốc check-in đầu tiên cho bạn.',
                  'If the phone number already exists, SafeSolo signs in and syncs backend data. Otherwise, it creates a new profile and your first check-in deadline.',
                ),
                style: AppTextStyles.body.copyWith(color: AppColors.textMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
