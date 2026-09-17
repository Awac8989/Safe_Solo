import 'dart:async';
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
  int _selectedTab = 0; // 0: Phone, 1: Gmail/Google, 2: Telegram Bot

  // Phone Form Controllers
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _emergencyNameController = TextEditingController();
  final _emergencyPhoneController = TextEditingController();
  int _timerInterval = 720;

  // Gmail Form Controllers
  final _gmailFormKey = GlobalKey<FormState>();
  final _gmailEmailController = TextEditingController(text: 'user.safesolo@gmail.com');
  final _gmailNameController = TextEditingController();

  // Telegram Form Controllers
  final _telegramFormKey = GlobalKey<FormState>();
  final _telegramIdentifierController = TextEditingController(text: '@safesolo_user');
  final _telegramNameController = TextEditingController();

  bool _isSendingOtp = false;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _emergencyNameController.dispose();
    _emergencyPhoneController.dispose();
    _gmailEmailController.dispose();
    _gmailNameController.dispose();
    _telegramIdentifierController.dispose();
    _telegramNameController.dispose();
    super.dispose();
  }

  Future<void> _handlePhoneSubmit() async {
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
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    }
  }

  Future<void> _handleGoogleSignIn() async {
    final email = _gmailEmailController.text.trim().isNotEmpty
        ? _gmailEmailController.text.trim()
        : 'user.safesolo@gmail.com';
    final name = _gmailNameController.text.trim().isNotEmpty
        ? _gmailNameController.text.trim()
        : 'Google User';

    final provider = context.read<AppProvider>();
    try {
      await provider.authenticateWithGoogle(
        email: email,
        name: name,
        avatar: 'https://lh3.googleusercontent.com/a/default-user=s96-c',
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    }
  }

  Future<void> _handleSendGmailOtp() async {
    if (!(_gmailFormKey.currentState?.validate() ?? false)) return;

    final email = _gmailEmailController.text.trim();
    final name = _gmailNameController.text.trim();

    setState(() => _isSendingOtp = true);
    final provider = context.read<AppProvider>();
    try {
      final res = await provider.sendGmailOtp(email);
      if (!mounted) return;
      final previewOtp = (res['data'] is Map ? res['data']['otpPreview'] : null) ?? res['otpPreview'];
      _showOtpDialog(
        context: context,
        targetIdentifier: email,
        isTelegram: false,
        previewOtp: previewOtp?.toString(),
        displayName: name.isNotEmpty ? name : 'Gmail User',
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    } finally {
      if (mounted) setState(() => _isSendingOtp = false);
    }
  }

  Future<void> _handleSendTelegramOtp() async {
    if (!(_telegramFormKey.currentState?.validate() ?? false)) return;

    final identifier = _telegramIdentifierController.text.trim();
    final name = _telegramNameController.text.trim();

    setState(() => _isSendingOtp = true);
    final provider = context.read<AppProvider>();
    try {
      final res = await provider.sendTelegramOtp(identifier);
      if (!mounted) return;
      final previewOtp = (res['data'] is Map ? res['data']['otpPreview'] : null) ?? res['otpPreview'];
      _showOtpDialog(
        context: context,
        targetIdentifier: identifier,
        isTelegram: true,
        previewOtp: previewOtp?.toString(),
        displayName: name.isNotEmpty ? name : 'Telegram User',
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    } finally {
      if (mounted) setState(() => _isSendingOtp = false);
    }
  }

  Future<void> _showOtpDialog({
    required BuildContext context,
    required String targetIdentifier,
    required bool isTelegram,
    String? previewOtp,
    String? displayName,
  }) async {
    final otpController = TextEditingController(text: previewOtp ?? '');
    final strings = AppStrings.of(context);
    bool isVerifying = false;
    String? dialogError;

    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogCtx) {
        return StatefulBuilder(
          builder: (dialogCtx, setDialogState) {
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              titlePadding: const EdgeInsets.fromLTRB(24, 24, 24, 12),
              contentPadding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
              title: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: isTelegram
                          ? const Color(0xFF229ED9).withValues(alpha: 0.15)
                          : const Color(0xFFEA4335).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      isTelegram ? Icons.send_rounded : Icons.mail_rounded,
                      color: isTelegram ? const Color(0xFF229ED9) : const Color(0xFFEA4335),
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      isTelegram
                          ? strings.text('Xác thực Telegram', 'Telegram Verification')
                          : strings.text('Xác thực Gmail', 'Gmail Verification'),
                      style: AppTextStyles.title.copyWith(fontSize: 18),
                    ),
                  ),
                ],
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      strings.text(
                        'Mã xác minh gồm 6 số đã được gửi tới: ',
                        'A 6-digit verification code has been sent to: ',
                      ),
                      style: AppTextStyles.body.copyWith(color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppColors.backgroundAlt,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        targetIdentifier,
                        style: AppTextStyles.body.copyWith(
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                    if (previewOtp != null) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.primarySoft,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.primaryGlow),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.info_outline, size: 18, color: AppColors.primary),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                strings.text(
                                  'Mã Sandbox: $previewOtp (tự điền sẵn)',
                                  'Sandbox Code: $previewOtp (pre-filled)',
                                ),
                                style: AppTextStyles.caption.copyWith(
                                  color: AppColors.textPrimary,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),
                    Text(
                      strings.text('Nhập mã OTP (6 số)', 'Enter OTP Code (6 digits)'),
                      style: AppTextStyles.caption.copyWith(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: otpController,
                      keyboardType: TextInputType.number,
                      textAlign: TextAlign.center,
                      maxLength: 6,
                      style: AppTextStyles.h1.copyWith(
                        letterSpacing: 10,
                        fontSize: 26,
                        color: AppColors.primary,
                      ),
                      decoration: InputDecoration(
                        counterText: '',
                        hintText: '000000',
                        hintStyle: TextStyle(
                          letterSpacing: 10,
                          color: Colors.grey.shade400,
                        ),
                        contentPadding: const EdgeInsets.symmetric(vertical: 12),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                    if (dialogError != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        dialogError!,
                        style: AppTextStyles.caption.copyWith(color: AppColors.destructive),
                      ),
                    ],
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: isVerifying ? null : () => Navigator.of(dialogCtx).pop(),
                  child: Text(strings.text('Hủy', 'Cancel')),
                ),
                ElevatedButton(
                  onPressed: isVerifying
                      ? null
                      : () async {
                          final code = otpController.text.trim();
                          if (code.length != 6) {
                            setDialogState(() {
                              dialogError = strings.text(
                                'Vui lòng nhập đúng 6 số OTP',
                                'Please enter full 6-digit OTP',
                              );
                            });
                            return;
                          }

                          setDialogState(() {
                            isVerifying = true;
                            dialogError = null;
                          });

                          try {
                            final prov = context.read<AppProvider>();
                            if (isTelegram) {
                              await prov.verifyTelegramOtp(
                                identifier: targetIdentifier,
                                otp: code,
                                name: displayName,
                              );
                            } else {
                              await prov.verifyGmailOtp(
                                email: targetIdentifier,
                                otp: code,
                                name: displayName,
                              );
                            }
                            if (dialogCtx.mounted) {
                              Navigator.of(dialogCtx).pop();
                            }
                          } catch (err) {
                            setDialogState(() {
                              dialogError = err.toString();
                              isVerifying = false;
                            });
                          }
                        },
                  child: isVerifying
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : Text(strings.text('Xác minh & Đăng nhập', 'Verify & Sign In')),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final appProvider = context.watch<AppProvider>();
    final strings = AppStrings.of(context);

    return Scaffold(
      body: AppPage(
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
            const SizedBox(height: 8),
            Text(
              strings.text(
                'Chọn phương thức đăng nhập tiện lợi nhất cho bạn: Số điện thoại, Gmail hoặc Chatbot Telegram.',
                'Choose your preferred sign-in method: Phone, Gmail, or Telegram Chatbot.',
              ),
              style: AppTextStyles.bodyLarge.copyWith(
                color: AppColors.textSecondary,
                height: 1.45,
              ),
            ),
            const SizedBox(height: 20),

            // Modern Tab Selector
            Container(
              decoration: BoxDecoration(
                color: AppColors.backgroundAlt,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              padding: const EdgeInsets.all(4),
              child: Row(
                children: [
                  _buildTabItem(0, Icons.phone_android_rounded, strings.text('Điện thoại', 'Phone')),
                  _buildTabItem(1, Icons.mail_outline_rounded, strings.text('Gmail / Google', 'Gmail / Google')),
                  _buildTabItem(2, Icons.send_rounded, strings.text('Telegram Bot', 'Telegram Bot')),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Tab Content
            if (_selectedTab == 0)
              _buildPhoneForm(strings, appProvider)
            else if (_selectedTab == 1)
              _buildGmailTab(strings, appProvider)
            else
              _buildTelegramTab(strings, appProvider),

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
          ],
        ),
      ),
    );
  }

  Widget _buildTabItem(int index, IconData icon, String label) {
    final isSelected = _selectedTab == index;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedTab = index),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.surface : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: 18,
                color: isSelected ? AppColors.primary : AppColors.textMuted,
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: AppTextStyles.caption.copyWith(
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  color: isSelected ? AppColors.primary : AppColors.textSecondary,
                  fontSize: 12,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPhoneForm(AppStrings strings, AppProvider appProvider) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
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
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: appProvider.isBusy ? null : _handlePhoneSubmit,
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
    );
  }

  Widget _buildGmailTab(AppStrings strings, AppProvider appProvider) {
    return Form(
      key: _gmailFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1-Tap Google Portal Sign-in Card
          AppCard(
            child: Column(
              children: [
                Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.grey.shade200),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.04),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: const Center(
                        child: Text(
                          'G',
                          style: TextStyle(
                            fontSize: 26,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF4285F4),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            strings.text('Cổng đăng nhập Google', 'Google Login Portal'),
                            style: AppTextStyles.title.copyWith(fontSize: 16),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            strings.text(
                              'Xác thực an toàn qua tài khoản Google',
                              'Secure authentication with Google account',
                            ),
                            style: AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      side: const BorderSide(color: Color(0xFF4285F4), width: 1.5),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: appProvider.isBusy ? null : _handleGoogleSignIn,
                    icon: const Icon(Icons.account_circle_outlined, color: Color(0xFF4285F4)),
                    label: Text(
                      strings.text('Tiếp tục với tài khoản Google', 'Continue with Google Account'),
                      style: AppTextStyles.title.copyWith(
                        color: const Color(0xFF4285F4),
                        fontSize: 15,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Divider OR
          Row(
            children: [
              const Expanded(child: Divider()),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Text(
                  strings.text('HOẶC NHẬN MÃ QUA GMAIL', 'OR VERIFY VIA GMAIL OTP'),
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.textMuted,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const Expanded(child: Divider()),
            ],
          ),
          const SizedBox(height: 20),

          // Gmail OTP Form
          AppCard(
            child: Column(
              children: [
                TextFormField(
                  controller: _gmailEmailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: InputDecoration(
                    labelText: strings.text('Địa chỉ Gmail của bạn', 'Your Gmail address'),
                    prefixIcon: const Icon(Icons.mail_outline_rounded, color: Color(0xFFEA4335)),
                    hintText: 'example@gmail.com',
                  ),
                  validator: (value) {
                    if (value == null || value.trim().isEmpty || !value.contains('@')) {
                      return strings.text('Nhập địa chỉ email hợp lệ', 'Enter a valid email');
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _gmailNameController,
                  decoration: InputDecoration(
                    labelText: strings.text('Họ và tên (tùy chọn)', 'Full name (optional)'),
                    prefixIcon: const Icon(Icons.badge_outlined),
                  ),
                ),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFEA4335),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    onPressed: (_isSendingOtp || appProvider.isBusy) ? null : _handleSendGmailOtp,
                    icon: _isSendingOtp
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                            ),
                          )
                        : const Icon(Icons.send_rounded, size: 18),
                    label: Text(
                      strings.text('Gửi mã xác thực qua Gmail', 'Send Verification Code to Gmail'),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTelegramTab(AppStrings strings, AppProvider appProvider) {
    return Form(
      key: _telegramFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Telegram Bot Hero Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF229ED9), Color(0xFF1B82B4)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF229ED9).withValues(alpha: 0.25),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.smart_toy_rounded,
                        color: Colors.white,
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            '@SFESOLOBot',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                            ),
                          ),
                          Text(
                            strings.text(
                              'Chatbot bảo vệ & xác thực Telegram',
                              'Telegram Safety & Verification Chatbot',
                            ),
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.85),
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.25),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Text(
                        'Live / Sandbox',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  strings.text(
                    'Bot Telegram sẽ gửi mã OTP 6 số để xác thực tài khoản tức thì, đồng thời là kênh tiếp nhận phát tín hiệu SOS khẩn cấp đến người thân của bạn.',
                    'The Telegram Bot sends 6-digit OTP codes for instant verification, and acts as an emergency alert dispatch channel for SOS.',
                  ),
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.95),
                    fontSize: 13,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),

          // Telegram Input Form
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextFormField(
                  controller: _telegramIdentifierController,
                  decoration: InputDecoration(
                    labelText: strings.text(
                      'Telegram Username hoặc Chat ID',
                      'Telegram Username or Chat ID',
                    ),
                    prefixIcon: const Icon(Icons.alternate_email_rounded, color: Color(0xFF229ED9)),
                    hintText: '@username hoặc ID số (VD: 658291)',
                  ),
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return strings.text(
                        'Vui lòng nhập Telegram username hoặc Chat ID',
                        'Please enter Telegram username or Chat ID',
                      );
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _telegramNameController,
                  decoration: InputDecoration(
                    labelText: strings.text('Họ và tên hiển thị (tùy chọn)', 'Display name (optional)'),
                    prefixIcon: const Icon(Icons.badge_outlined),
                  ),
                ),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF229ED9),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    onPressed: (_isSendingOtp || appProvider.isBusy) ? null : _handleSendTelegramOtp,
                    icon: _isSendingOtp
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                            ),
                          )
                        : const Icon(Icons.send_rounded, size: 18),
                    label: Text(
                      strings.text('Gửi mã OTP qua Telegram', 'Send OTP via Telegram Bot'),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Text(
            strings.text(
              '💡 Mẹo: Bạn có thể bắt đầu chat với bot trên Telegram tại t.me/SFESOLOBot bằng lệnh /start để nhận ID kết nối.',
              '💡 Tip: You can start the bot on Telegram at t.me/SFESOLOBot using /start to get your connection ID.',
            ),
            style: AppTextStyles.caption.copyWith(color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }
}
