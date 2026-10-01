import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_strings.dart';
import '../../core/app_theme.dart';
import '../../core/providers/app_provider.dart';
import '../../core/widgets/app_shell.dart';
import '../../models/user_model.dart';

class AuthPage extends StatefulWidget {
  const AuthPage({super.key});

  @override
  State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  int _authMode = 0; // 0: Đăng nhập (Sign In), 1: Đăng ký tài khoản (Register)
  int _selectedTab = 0; // 0: Phone, 1: Password, 2: Gmail/Google, 3: Telegram Bot

  // Registration Form State
  final _regFormKey = GlobalKey<FormState>();
  final _regFullNameController = TextEditingController();
  final _regPhoneController = TextEditingController();
  final _regEmailController = TextEditingController();
  final _regPasswordController = TextEditingController();
  final _regConfirmPasswordController = TextEditingController();
  final _regEmergencyNameController = TextEditingController();
  final _regEmergencyPhoneController = TextEditingController();
  int _regTimerInterval = 720;
  bool _regObscurePassword = true;
  bool _regObscureConfirmPassword = true;
  bool _isRegistering = false;
  String? _regErrorMessage;

  // Phone 2-Step Auth State
  int _phoneStep = 0; // 0: Nhập SĐT & Preset Demo, 1: Nhập OTP 6 số, 2: Hoàn tất hồ sơ mới
  final _phoneInputController = TextEditingController(text: '0913843958');
  final _otpInputController = TextEditingController();
  UserModel? _matchedExistingUser;
  int _otpCountdown = 60;
  Timer? _otpTimer;
  bool _isCheckingPhone = false;
  bool _isVerifyingOtp = false;
  String? _otpErrorMessage;

  // Phone Form Controllers (Dành cho Bước 2: Hoàn tất hồ sơ nếu là tài khoản mới)
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _emergencyNameController = TextEditingController();
  final _emergencyPhoneController = TextEditingController();
  int _timerInterval = 720;

  // Gmail Form Controllers
  final _gmailFormKey = GlobalKey<FormState>();
  final _gmailEmailController = TextEditingController(text: 'minhquandoan66@gmail.com');
  final _gmailNameController = TextEditingController(text: 'Đoàn Minh Quân');

  // Telegram Form Controllers
  final _telegramFormKey = GlobalKey<FormState>();
  final _telegramIdentifierController = TextEditingController(text: '@safesolo_user');
  final _telegramNameController = TextEditingController();

  bool _isSendingOtp = false;

  // Password Login State
  final _pwdIdentifierController = TextEditingController(text: '0913843958');
  final _pwdPasswordController = TextEditingController(text: '123456');
  bool _obscurePassword = true;
  bool _rememberMe = true;
  bool _isLoggingInPassword = false;
  String? _passwordError;
  int? _lockoutSecondsRemaining;
  Timer? _lockoutTimer;

  // Forgot Password State
  final _forgotIdentifierController = TextEditingController();
  final _forgotOtpController = TextEditingController();
  final _forgotNewPasswordController = TextEditingController();
  bool _obscureForgotNewPassword = true;
  int _forgotStep = 0;
  bool _isForgotSubmitting = false;
  String? _forgotError;

  @override
  void dispose() {
    _otpTimer?.cancel();
    _lockoutTimer?.cancel();
    _phoneInputController.dispose();
    _otpInputController.dispose();
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _emergencyNameController.dispose();
    _emergencyPhoneController.dispose();
    _gmailEmailController.dispose();
    _gmailNameController.dispose();
    _telegramIdentifierController.dispose();
    _telegramNameController.dispose();
    _pwdIdentifierController.dispose();
    _pwdPasswordController.dispose();
    _forgotIdentifierController.dispose();
    _forgotOtpController.dispose();
    _forgotNewPasswordController.dispose();
    _regFullNameController.dispose();
    _regPhoneController.dispose();
    _regEmailController.dispose();
    _regPasswordController.dispose();
    _regConfirmPasswordController.dispose();
    _regEmergencyNameController.dispose();
    _regEmergencyPhoneController.dispose();
    super.dispose();
  }

  void _startOtpCountdown() {
    _otpCountdown = 60;
    _otpTimer?.cancel();
    _otpTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_otpCountdown > 0) {
        if (mounted) setState(() => _otpCountdown--);
      } else {
        timer.cancel();
      }
    });
  }

  Future<void> _handlePhoneNext() async {
    final rawPhone = _phoneInputController.text.trim().replaceAll(' ', '');
    if (rawPhone.isEmpty || rawPhone.length < 9) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng nhập số điện thoại hợp lệ (từ 9-11 số)')),
      );
      return;
    }

    setState(() {
      _isCheckingPhone = true;
      _otpErrorMessage = null;
    });

    final provider = context.read<AppProvider>();
    try {
      final matched = await provider.findUserByPhone(rawPhone);
      _matchedExistingUser = matched;

      final normalizedPhone = rawPhone.startsWith('+84')
          ? '0${rawPhone.substring(3)}'
          : (rawPhone.startsWith('84') ? '0${rawPhone.substring(2)}' : rawPhone);
      _phoneController.text = normalizedPhone;

      if (matched != null) {
        _nameController.text = matched.fullName;
      }

      setState(() {
        _phoneStep = 1;
        _otpInputController.text = '';
      });
      _startOtpCountdown();
    } catch (_) {
      _matchedExistingUser = null;
      _phoneController.text = rawPhone;
      setState(() {
        _phoneStep = 1;
        _otpInputController.text = '';
      });
      _startOtpCountdown();
    } finally {
      if (mounted) setState(() => _isCheckingPhone = false);
    }
  }

  Future<void> _handleSelectDemoPhone({
    required String phone,
    required String name,
    required String role,
  }) async {
    _phoneInputController.text = phone;
    await _handlePhoneNext();
    // Tự động điền mã OTP demo 888888 để thao tác nhanh nhất
    if (mounted) {
      setState(() {
        _otpInputController.text = '888888';
      });
    }
  }

  Future<void> _handleVerifyPhoneOtp() async {
    final otp = _otpInputController.text.trim();
    if (otp.length != 6) {
      setState(() => _otpErrorMessage = 'Vui lòng nhập đủ 6 chữ số mã OTP');
      return;
    }

    setState(() {
      _isVerifyingOtp = true;
      _otpErrorMessage = null;
    });

    final provider = context.read<AppProvider>();
    try {
      await Future.delayed(const Duration(milliseconds: 350));

      if (_matchedExistingUser != null) {
        // Tài khoản đã có trong hệ thống -> Đăng nhập trực tiếp và đồng bộ
        await provider.signInWithExistingUser(_matchedExistingUser!);
        if (_phoneInputController.text.contains('0913843958') || _matchedExistingUser!.personaType == 'HERO' || _matchedExistingUser!.isKycVerified) {
          await provider.setKycVerified(true);
        }
      } else {
        // Tài khoản hoàn toàn mới -> Sang bước 2 hoàn tất thông tin người thân
        setState(() {
          _phoneStep = 2;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _otpErrorMessage = 'Lỗi xác thực: $e');
      }
    } finally {
      if (mounted) setState(() => _isVerifyingOtp = false);
    }
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
    await _showGoogleAccountChooserSheet(context);
  }

  Future<void> _handleAppleSignIn() async {
    final strings = _snapshotStrings();
    try {
      final provider = context.read<AppProvider>();
      await provider.authenticateWithGoogle(
        email: 'user.apple@icloud.com',
        name: 'Apple SafeSolo User',
        avatar: '',
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: Colors.black87,
            content: Text(strings.text('Đăng nhập bằng Apple ID thành công!', 'Signed in with Apple ID!')),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Lỗi: $e')));
      }
    }
  }

  Future<void> _handleMicrosoftSignIn() async {
    final strings = _snapshotStrings();
    try {
      final provider = context.read<AppProvider>();
      await provider.authenticateWithGoogle(
        email: 'user.ms@outlook.com',
        name: 'Microsoft 365 User',
        avatar: '',
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF00A4EF),
            content: Text(strings.text('Đăng nhập bằng Microsoft thành công!', 'Signed in with Microsoft!')),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Lỗi: $e')));
      }
    }
  }

  Future<void> _signInWithSpecificGoogleAccount({
    required String email,
    required String name,
    bool isExisting = false,
    bool isHero = false,
  }) async {
    final provider = context.read<AppProvider>();
    try {
      await provider.authenticateWithGoogle(
        email: email,
        name: name,
        avatar: 'https://lh3.googleusercontent.com/a/default-user=s96-c',
      );
      if (isExisting) {
        if (!provider.hasCompletedProfile) {
          await provider.completeProfileSetup(
            fullName: name,
            phoneNumber: isHero ? '0901111004' : '0908889999',
            email: email,
            emergencyName: isHero ? 'Tổng Đài Điều Phối SafeSolo 115' : 'Người giám hộ SafeSolo',
            emergencyPhone: '0901112222',
            emergencyRelation: isHero ? 'Trung tâm điều phối' : 'Người thân',
          );
        }
      }
      if (isHero) {
        await provider.setKycVerified(true);
      }
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    }
  }

  AppStrings _snapshotStrings() {
    final provider = context.read<AppProvider>();
    return AppStrings(provider.language);
  }

  Future<void> _showGoogleAccountChooserSheet(BuildContext context) async {
    final strings = _snapshotStrings();
    final accounts = [
      {
        'name': 'Đoàn Minh Quân',
        'email': 'minhquandoan66@gmail.com',
        'isExisting': true,
        'isHero': false,
        'badge': strings.text('Tài khoản của bạn', 'Your Account'),
      },
      {
        'name': 'SafeSolo Company Admin',
        'email': 'safesolocompanyvn@gmail.com',
        'isExisting': true,
        'isHero': true,
        'badge': strings.text('Quản Trị Viên', 'Admin'),
      },
      {
        'name': 'Đoàn Minh Quân (Hiệp Sĩ SafeSolo)',
        'email': 'hiepsi.safesolo@gmail.com',
        'isExisting': true,
        'isHero': true,
        'badge': strings.text('Hiệp Sĩ KYC', 'Verified Knight'),
      },
      {
        'name': 'Google SafeSolo User',
        'email': 'user.safesolo@gmail.com',
        'isExisting': true,
        'isHero': false,
        'badge': strings.text('Đã có hồ sơ', 'Existing profile'),
      },
      {
        'name': 'Nguyễn Văn Minh',
        'email': 'minh.safesolo@gmail.com',
        'isExisting': false,
        'isHero': false,
        'badge': strings.text('Đăng ký mới', 'New registration'),
      },
      {
        'name': 'Cứu Hộ SafeSolo 115',
        'email': 'rescue.safesolo@gmail.com',
        'isExisting': true,
        'isHero': true,
        'badge': strings.text('Đội Cứu Hộ 115', 'Rescue Team 115'),
      },
    ];

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 4.5,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.grey.shade300),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.04),
                            blurRadius: 4,
                          ),
                        ],
                      ),
                      child: const Center(
                        child: Text(
                          'G',
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF4285F4),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            strings.text('Đăng nhập bằng Google', 'Sign in with Google'),
                            style: AppTextStyles.title.copyWith(fontSize: 17),
                          ),
                          Text(
                            strings.text(
                              'Chọn tài khoản để tiếp tục với SafeSolo',
                              'Choose an account to continue to SafeSolo',
                            ),
                            style: AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                const Divider(height: 1),
                const SizedBox(height: 8),

                // Danh sách tài khoản Google
                for (final acc in accounts) ...[
                  ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 3),
                    leading: CircleAvatar(
                      radius: 20,
                      backgroundColor: (acc['isHero'] as bool? ?? false)
                          ? const Color(0xFFF59E0B).withValues(alpha: 0.15)
                          : const Color(0xFF4285F4).withValues(alpha: 0.12),
                      child: (acc['isHero'] as bool? ?? false)
                          ? const Icon(Icons.shield_rounded, color: Color(0xFFD97706), size: 20)
                          : Text(
                              (acc['name'] as String).substring(0, 1).toUpperCase(),
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF4285F4),
                              ),
                            ),
                    ),
                    title: Text(
                      acc['name'] as String,
                      style: AppTextStyles.bodyStrong.copyWith(fontSize: 14.5),
                    ),
                    subtitle: Row(
                      children: [
                        Expanded(
                          child: Text(
                            acc['email'] as String,
                            overflow: TextOverflow.ellipsis,
                            style: AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                          decoration: BoxDecoration(
                            color: (acc['isHero'] as bool? ?? false)
                                ? const Color(0xFFF59E0B).withValues(alpha: 0.15)
                                : (acc['isExisting'] as bool)
                                    ? const Color(0xFF10B981).withValues(alpha: 0.12)
                                    : const Color(0xFF3B82F6).withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            acc['badge'] as String,
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              color: (acc['isHero'] as bool? ?? false)
                                  ? const Color(0xFFD97706)
                                  : (acc['isExisting'] as bool)
                                      ? const Color(0xFF059669)
                                      : const Color(0xFF2563EB),
                            ),
                          ),
                        ),
                      ],
                    ),
                    trailing: const Icon(Icons.chevron_right_rounded, size: 20, color: AppColors.textMuted),
                    onTap: () async {
                      Navigator.of(sheetContext).pop();
                      await _signInWithSpecificGoogleAccount(
                        email: acc['email'] as String,
                        name: acc['name'] as String,
                        isExisting: acc['isExisting'] as bool,
                        isHero: acc['isHero'] as bool? ?? false,
                      );
                    },
                  ),
                  const Divider(height: 1),
                ],
                ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                  leading: CircleAvatar(
                    radius: 20,
                    backgroundColor: Colors.grey.shade100,
                    child: const Icon(Icons.person_add_alt_1_rounded, color: Colors.grey, size: 20),
                  ),
                  title: Text(
                    strings.text('Sử dụng tài khoản Google khác...', 'Use another Google account...'),
                    style: AppTextStyles.bodyStrong.copyWith(fontSize: 14),
                  ),
                  trailing: const Icon(Icons.chevron_right_rounded, size: 20, color: AppColors.textMuted),
                  onTap: () {
                    Navigator.of(sheetContext).pop();
                    _showCustomGoogleAccountDialog(context);
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _showCustomGoogleAccountDialog(BuildContext context) async {
    final customEmailController = TextEditingController();
    final customNameController = TextEditingController();
    final strings = _snapshotStrings();

    await showDialog<void>(
      context: context,
      builder: (dialogCtx) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: [
              const Icon(Icons.mail_outline_rounded, color: Color(0xFF4285F4)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  strings.text('Nhập tài khoản Google', 'Enter Google Account'),
                  style: AppTextStyles.title.copyWith(fontSize: 17),
                ),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: customEmailController,
                keyboardType: TextInputType.emailAddress,
                decoration: InputDecoration(
                  labelText: strings.text('Địa chỉ Gmail', 'Gmail address'),
                  hintText: 'tenban@gmail.com',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: customNameController,
                decoration: InputDecoration(
                  labelText: strings.text('Họ và tên hiển thị', 'Display name'),
                  hintText: 'Nguyễn Văn A',
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogCtx).pop(),
              child: Text(strings.text('Hủy', 'Cancel')),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF4285F4),
                foregroundColor: Colors.white,
              ),
              onPressed: () async {
                final email = customEmailController.text.trim();
                final name = customNameController.text.trim();
                if (email.isEmpty || !email.contains('@')) {
                  return;
                }
                Navigator.of(dialogCtx).pop();
                await _signInWithSpecificGoogleAccount(
                  email: email,
                  name: name.isNotEmpty ? name : email.split('@').first,
                  isExisting: false,
                );
              },
              child: Text(strings.text('Đăng nhập', 'Sign In')),
            ),
          ],
        );
      },
    );
  }

  Future<void> _showTelegramAccountChooserSheet(BuildContext context) async {
    final strings = _snapshotStrings();
    final teleAccounts = [
      {
        'username': '@safesolo_hero',
        'name': 'Đoàn Minh Quân (Hiệp Sĩ Cứu Hộ)',
        'isExisting': true,
        'isHero': true,
        'badge': strings.text('Hiệp Sĩ KYC', 'Verified Knight'),
      },
      {
        'username': '@safesolo_user',
        'name': 'SafeSolo Telegram User',
        'isExisting': true,
        'isHero': false,
        'badge': strings.text('Đã có hồ sơ', 'Existing profile'),
      },
      {
        'username': '@minh_telegram',
        'name': 'Nguyễn Văn Minh (Tele)',
        'isExisting': false,
        'isHero': false,
        'badge': strings.text('Đăng ký mới', 'New registration'),
      },
    ];

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 44,
                  height: 4.5,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: const Color(0xFF229ED9),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.send_rounded, color: Colors.white, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          strings.text('Đăng nhập với Telegram', 'Sign in with Telegram'),
                          style: AppTextStyles.title.copyWith(fontSize: 17),
                        ),
                        Text(
                          strings.text(
                            'Chọn tài khoản hoặc chatbot @SFESOLOBot',
                            'Select account or @SFESOLOBot chatbot',
                          ),
                          style: AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Divider(height: 1),
              for (final acc in teleAccounts) ...[
                ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 3),
                  leading: CircleAvatar(
                    radius: 20,
                    backgroundColor: (acc['isHero'] as bool? ?? false)
                        ? const Color(0xFFF59E0B).withValues(alpha: 0.15)
                        : const Color(0xFF229ED9).withValues(alpha: 0.15),
                    child: (acc['isHero'] as bool? ?? false)
                        ? const Icon(Icons.shield_rounded, color: Color(0xFFD97706), size: 20)
                        : const Icon(Icons.person_rounded, color: Color(0xFF229ED9), size: 22),
                  ),
                  title: Text(
                    acc['name'] as String,
                    style: AppTextStyles.bodyStrong.copyWith(fontSize: 14.5),
                  ),
                  subtitle: Row(
                    children: [
                      Flexible(
                        child: Text(
                          acc['username'] as String,
                          style: AppTextStyles.caption.copyWith(color: const Color(0xFF229ED9), fontWeight: FontWeight.w600),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                        decoration: BoxDecoration(
                          color: (acc['isHero'] as bool? ?? false)
                              ? const Color(0xFFF59E0B).withValues(alpha: 0.15)
                              : (acc['isExisting'] as bool)
                                  ? const Color(0xFF10B981).withValues(alpha: 0.12)
                                  : const Color(0xFF3B82F6).withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          acc['badge'] as String,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: (acc['isHero'] as bool? ?? false)
                                ? const Color(0xFFD97706)
                                : (acc['isExisting'] as bool)
                                    ? const Color(0xFF059669)
                                    : const Color(0xFF2563EB),
                          ),
                        ),
                      ),
                    ],
                  ),
                  trailing: const Icon(Icons.chevron_right_rounded, size: 20, color: AppColors.textMuted),
                  onTap: () async {
                    Navigator.of(sheetContext).pop();
                    await _signInWithSpecificTelegramAccount(
                      username: acc['username'] as String,
                      name: acc['name'] as String,
                      isExisting: acc['isExisting'] as bool,
                      isHero: acc['isHero'] as bool? ?? false,
                    );
                  },
                ),
                const Divider(height: 1),
              ],
            ],
          ),
        );
      },
    );
  }

  Future<void> _signInWithSpecificTelegramAccount({
    required String username,
    required String name,
    bool isExisting = false,
    bool isHero = false,
  }) async {
    final provider = context.read<AppProvider>();
    try {
      await provider.verifyTelegramOtp(
        identifier: username,
        otp: '123456',
        name: name,
      );
      if (isExisting) {
        if (!provider.hasCompletedProfile) {
          await provider.completeProfileSetup(
            fullName: name,
            phoneNumber: isHero ? '0901111004' : '0907778888',
            email: '$username@tele.safesolo',
            emergencyName: isHero ? 'Tổng Đài Điều Phối SafeSolo 115' : 'Người giám hộ Telegram',
            emergencyPhone: '0901112222',
            emergencyRelation: isHero ? 'Trung tâm điều phối' : 'Người thân',
          );
        }
      }
      if (isHero) {
        await provider.setKycVerified(true);
      }
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
    final strings = _snapshotStrings();
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

  void _startLockoutCountdown(int seconds) {
    _lockoutSecondsRemaining = seconds;
    _lockoutTimer?.cancel();
    _lockoutTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if ((_lockoutSecondsRemaining ?? 0) > 0) {
        if (mounted) {
          setState(() {
            _lockoutSecondsRemaining = (_lockoutSecondsRemaining ?? 0) - 1;
            final mins = (_lockoutSecondsRemaining! / 60).floor();
            final secs = _lockoutSecondsRemaining! % 60;
            _passwordError = 'Tài khoản đang bị tạm khóa an ninh: còn ${mins}p ${secs}s';
          });
        }
      } else {
        timer.cancel();
        if (mounted) {
          setState(() {
            _lockoutSecondsRemaining = null;
            _passwordError = null;
          });
        }
      }
    });
  }

  Future<void> _handlePasswordLogin() async {
    final identifier = _pwdIdentifierController.text.trim();
    final password = _pwdPasswordController.text;

    if (identifier.isEmpty) {
      setState(() => _passwordError = 'Vui lòng nhập Email, Số điện thoại hoặc Tên tài khoản.');
      return;
    }
    if (password.isEmpty) {
      setState(() => _passwordError = 'Vui lòng nhập mật khẩu.');
      return;
    }

    setState(() {
      _isLoggingInPassword = true;
      _passwordError = null;
    });

    final provider = context.read<AppProvider>();
    try {
      await provider.loginWithPassword(
        identifier: identifier,
        password: password,
        rememberMe: _rememberMe,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Color(0xFF10B981),
            content: Row(
              children: [
                Icon(Icons.check_circle_rounded, color: Colors.white),
                SizedBox(width: 8),
                Expanded(
                  child: Text('Đăng nhập thành công! Chào mừng bạn trở lại.'),
                ),
              ],
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        final errText = e.toString().replaceFirst('Exception: ', '');
        setState(() => _passwordError = errText);
        if (errText.contains('tạm khóa')) {
          _startLockoutCountdown(15 * 60);
        }
      }
    } finally {
      if (mounted) {
        setState(() => _isLoggingInPassword = false);
      }
    }
  }

  Future<void> _handleBiometricLogin() async {
    final strings = _snapshotStrings();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        contentPadding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 68,
              height: 68,
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.fingerprint_rounded,
                size: 42,
                color: Color(0xFF10B981),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              strings.text('Xác thực Sinh trắc học', 'Biometric Authentication'),
              style: AppTextStyles.title.copyWith(fontSize: 18),
            ),
            const SizedBox(height: 8),
            Text(
              strings.text(
                'Quét vân tay hoặc Face ID (Passkey) để đăng nhập 1 chạm an toàn.',
                'Scan fingerprint or Face ID (Passkey) for 1-tap secure login.',
              ),
              textAlign: TextAlign.center,
              style: AppTextStyles.caption.copyWith(color: AppColors.textSecondary, height: 1.4),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(strings.text('Hủy', 'Cancel')),
          ),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF10B981),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            icon: const Icon(Icons.check_rounded, size: 18),
            label: Text(strings.text('Xác thực', 'Authenticate')),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      final identifier = _pwdIdentifierController.text.trim().isNotEmpty
          ? _pwdIdentifierController.text.trim()
          : '0913843958';
      setState(() {
        _isLoggingInPassword = true;
        _passwordError = null;
      });
      try {
        final provider = context.read<AppProvider>();
        await provider.loginWithPassword(
          identifier: identifier,
          password: '123456',
          rememberMe: true,
        );
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: const Color(0xFF10B981),
              content: Row(
                children: [
                  const Icon(Icons.fingerprint_rounded, color: Colors.white),
                  const SizedBox(width: 8),
                  Text(strings.text('Đăng nhập Passkey thành công!', 'Passkey sign-in successful!')),
                ],
              ),
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          setState(() => _passwordError = 'Lỗi sinh trắc học: $e');
        }
      } finally {
        if (mounted) setState(() => _isLoggingInPassword = false);
      }
    }
  }

  void _openForgotPasswordDialog() {
    final strings = _snapshotStrings();
    _forgotIdentifierController.text = _pwdIdentifierController.text.trim();
    _forgotOtpController.clear();
    _forgotNewPasswordController.clear();
    _forgotStep = 0;
    _forgotError = null;
    String _forgotChannel = 'email';

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetCtx) => StatefulBuilder(
        builder: (context, setSheetState) {
          return Container(
            padding: EdgeInsets.only(
              left: 20,
              right: 20,
              top: 18,
              bottom: MediaQuery.of(context).viewInsets.bottom + 28,
            ),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 4.5,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.lock_reset_rounded, color: AppColors.primary),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            strings.text('Khôi phục mật khẩu tự phục vụ', 'Self-service Password Reset'),
                            style: AppTextStyles.title.copyWith(fontSize: 17),
                          ),
                          Text(
                            _forgotStep == 0
                                ? strings.text('Bước 1: Nhập Email hoặc SĐT đã đăng ký', 'Step 1: Enter email or phone')
                                : strings.text('Bước 2: Nhập mã OTP và mật khẩu mới', 'Step 2: Enter OTP & new password'),
                            style: AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                if (_forgotError != null) ...[
                  Container(
                    padding: const EdgeInsets.all(10),
                    margin: const EdgeInsets.only(bottom: 14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF3F0),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFFFC6BB)),
                    ),
                    child: Text(
                      _forgotError!,
                      style: AppTextStyles.caption.copyWith(color: AppColors.destructive),
                    ),
                  ),
                ],
                if (_forgotStep == 0) ...[
                  Text(
                    strings.text('Chọn phương thức nhận mã khôi phục:', 'Choose verification channel:'),
                    style: AppTextStyles.bodyStrong.copyWith(fontSize: 13),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: InkWell(
                          onTap: () => setSheetState(() {
                            _forgotChannel = 'email';
                            if (!_forgotIdentifierController.text.contains('@') && _forgotIdentifierController.text.isNotEmpty) {
                              _forgotIdentifierController.text = 'user.safesolo@gmail.com';
                            }
                          }),
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 8),
                            decoration: BoxDecoration(
                              color: _forgotChannel == 'email'
                                  ? const Color(0xFFEA4335).withValues(alpha: 0.12)
                                  : Colors.grey.shade100,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: _forgotChannel == 'email' ? const Color(0xFFEA4335) : Colors.grey.shade300,
                                width: _forgotChannel == 'email' ? 1.5 : 1,
                              ),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.mail_rounded, size: 16, color: Color(0xFFEA4335)),
                                const SizedBox(width: 6),
                                Text(
                                  strings.text('Hộp thư Gmail', 'Gmail Email'),
                                  style: TextStyle(
                                    fontSize: 12.5,
                                    fontWeight: _forgotChannel == 'email' ? FontWeight.bold : FontWeight.normal,
                                    color: _forgotChannel == 'email' ? const Color(0xFFEA4335) : Colors.black87,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: InkWell(
                          onTap: () => setSheetState(() {
                            _forgotChannel = 'telegram';
                            if (!_forgotIdentifierController.text.startsWith('@')) {
                              _forgotIdentifierController.text = '@safesolo_hero';
                            }
                          }),
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 8),
                            decoration: BoxDecoration(
                              color: _forgotChannel == 'telegram'
                                  ? const Color(0xFF229ED9).withValues(alpha: 0.12)
                                  : Colors.grey.shade100,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: _forgotChannel == 'telegram' ? const Color(0xFF229ED9) : Colors.grey.shade300,
                                width: _forgotChannel == 'telegram' ? 1.5 : 1,
                              ),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.send_rounded, size: 16, color: Color(0xFF229ED9)),
                                const SizedBox(width: 6),
                                Text(
                                  strings.text('Telegram Bot', 'Telegram Bot'),
                                  style: TextStyle(
                                    fontSize: 12.5,
                                    fontWeight: _forgotChannel == 'telegram' ? FontWeight.bold : FontWeight.normal,
                                    color: _forgotChannel == 'telegram' ? const Color(0xFF229ED9) : Colors.black87,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _forgotIdentifierController,
                    autofillHints: const [AutofillHints.username],
                    decoration: InputDecoration(
                      labelText: _forgotChannel == 'email'
                          ? strings.text('Địa chỉ Gmail của bạn', 'Your Gmail Address')
                          : (_forgotChannel == 'telegram'
                              ? strings.text('Tài khoản Telegram (@username hoặc Chat ID)', 'Telegram (@username or Chat ID)')
                              : strings.text('Email hoặc Số điện thoại', 'Email or Phone Number')),
                      prefixIcon: Icon(
                        _forgotChannel == 'email'
                            ? Icons.mail_outline_rounded
                            : (_forgotChannel == 'telegram' ? Icons.send_rounded : Icons.person_outline_rounded),
                        color: _forgotChannel == 'email'
                            ? const Color(0xFFEA4335)
                            : (_forgotChannel == 'telegram' ? const Color(0xFF229ED9) : null),
                      ),
                      hintText: _forgotChannel == 'email'
                          ? 'user@gmail.com'
                          : (_forgotChannel == 'telegram' ? '@safesolo_user hoặc 8153057951' : '0913843958 hoặc user@gmail.com'),
                    ),
                  ),
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _forgotChannel == 'telegram'
                            ? const Color(0xFF229ED9)
                            : AppColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      onPressed: _isForgotSubmitting
                          ? null
                          : () async {
                              final id = _forgotIdentifierController.text.trim();
                              if (id.isEmpty) {
                                setSheetState(() => _forgotError = 'Vui lòng nhập thông tin tài khoản');
                                return;
                              }
                              setSheetState(() {
                                _isForgotSubmitting = true;
                                _forgotError = null;
                              });
                              try {
                                final msg = await context.read<AppProvider>().forgotPassword(
                                  identifier: id,
                                  channel: _forgotChannel,
                                );
                                setSheetState(() {
                                  _forgotStep = 1;
                                  _forgotError = null;
                                });
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
                                }
                              } catch (e) {
                                setSheetState(() => _forgotError = e.toString().replaceFirst('Exception: ', ''));
                              } finally {
                                setSheetState(() => _isForgotSubmitting = false);
                              }
                            },
                      child: _isForgotSubmitting
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : Text(
                              _forgotChannel == 'email'
                                  ? strings.text('Gửi mã OTP về Gmail', 'Send OTP to Gmail')
                                  : (_forgotChannel == 'telegram'
                                      ? strings.text('Gửi mã OTP về Telegram', 'Send OTP to Telegram')
                                      : strings.text('Gửi mã xác nhận khôi phục', 'Send Reset Code')),
                            ),
                    ),
                  ),
                ] else ...[
                  TextField(
                    controller: _forgotOtpController,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    decoration: InputDecoration(
                      labelText: strings.text('Mã xác thực OTP (6 chữ số)', 'OTP Code (6 digits)'),
                      prefixIcon: const Icon(Icons.pin_rounded),
                      hintText: '123456',
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _forgotNewPasswordController,
                    obscureText: _obscureForgotNewPassword,
                    autofillHints: const [AutofillHints.newPassword],
                    decoration: InputDecoration(
                      labelText: strings.text('Mật khẩu mới (tối thiểu 6 ký tự)', 'New Password (min 6 chars)'),
                      prefixIcon: const Icon(Icons.lock_outline_rounded),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscureForgotNewPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                        ),
                        onPressed: () => setSheetState(() => _obscureForgotNewPassword = !_obscureForgotNewPassword),
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      onPressed: _isForgotSubmitting
                          ? null
                          : () async {
                              final otp = _forgotOtpController.text.trim();
                              final newPass = _forgotNewPasswordController.text;
                              if (otp.length < 6 || newPass.length < 6) {
                                setSheetState(() => _forgotError = 'Vui lòng nhập đủ 6 số OTP và mật khẩu tối thiểu 6 ký tự');
                                return;
                              }
                              setSheetState(() {
                                _isForgotSubmitting = true;
                                _forgotError = null;
                              });
                              try {
                                await context.read<AppProvider>().resetPassword(
                                  identifier: _forgotIdentifierController.text.trim(),
                                  resetCode: otp,
                                  newPassword: newPass,
                                );
                                Navigator.pop(sheetCtx);
                                _pwdPasswordController.text = newPass;
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      backgroundColor: const Color(0xFF10B981),
                                      content: Text(
                                        strings.text(
                                          'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay.',
                                          'Password reset successful! You can now log in.',
                                        ),
                                      ),
                                    ),
                                  );
                                }
                              } catch (e) {
                                setSheetState(() => _forgotError = e.toString().replaceFirst('Exception: ', ''));
                              } finally {
                                setSheetState(() => _isForgotSubmitting = false);
                              }
                            },
                      child: _isForgotSubmitting
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : Text(strings.text('Đặt lại mật khẩu & Cập nhật', 'Reset Password & Update')),
                    ),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildPasswordTab(AppStrings strings, AppProvider appProvider) {
    final demoPasswordAccounts = [
      {
        'role': 'HIỆP SĨ SAFESOLO (ĐÃ KYC)',
        'name': 'Đoàn Minh Quân',
        'id': '0913843958',
        'pass': '123456',
        'desc': 'MSSV: 2224801030137 - Toàn quyền điều phối cứu hộ 115',
        'icon': Icons.shield_rounded,
        'color': const Color(0xFFF59E0B),
      },
      {
        'role': 'NGƯỜI DÙNG CÁ NHÂN',
        'name': 'Nguyễn Văn An',
        'id': '0908889999',
        'pass': '123456',
        'desc': 'Điểm danh Dead-man switch & Giám sát sức khỏe Galaxy Watch',
        'icon': Icons.person_rounded,
        'color': const Color(0xFF0284C7),
      },
      {
        'role': 'NGƯỜI GIÁM HỘ / BẢO TRỢ',
        'name': 'Trần Thị Mai',
        'id': '0901112222',
        'pass': '123456',
        'desc': 'Người thân ưu tiên 1, nhận cảnh báo SOS & Live Radar',
        'icon': Icons.favorite_rounded,
        'color': const Color(0xFF10B981),
      },
    ];

    return AutofillGroup(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.lock_rounded, color: AppColors.primary, size: 20),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            strings.text('Đăng nhập bằng Mật khẩu', 'Sign in with Password'),
                            style: AppTextStyles.title.copyWith(fontSize: 16),
                          ),
                          Text(
                            strings.text(
                              'Nhập Email, Số điện thoại hoặc Tên tài khoản',
                              'Enter Email, Phone Number, or Username',
                            ),
                            style: AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Trường Tài khoản
                Text(
                  strings.text('Tài khoản / Email / Số điện thoại', 'Account / Email / Phone Number'),
                  style: AppTextStyles.bodyStrong.copyWith(fontSize: 13),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: _pwdIdentifierController,
                  style: const TextStyle(
                    color: Color(0xFF0F172A),
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                  cursorColor: const Color(0xFF0284C7),
                  autofillHints: const [AutofillHints.username, AutofillHints.email, AutofillHints.telephoneNumber],
                  decoration: InputDecoration(
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                    prefixIcon: const Icon(Icons.person_outline_rounded, size: 20, color: Color(0xFF0284C7)),
                    hintText: strings.text('VD: 0913843958 hoặc user@safesolo.vn', 'e.g. 0913843958 or user@safesolo.vn'),
                    hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFFCBD5E1), width: 1.2),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFF0284C7), width: 2.0),
                    ),
                  ),
                ),
                const SizedBox(height: 14),

                // Trường Mật khẩu
                Text(
                  strings.text('Mật khẩu', 'Password'),
                  style: AppTextStyles.bodyStrong.copyWith(fontSize: 13),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: _pwdPasswordController,
                  obscureText: _obscurePassword,
                  style: const TextStyle(
                    color: Color(0xFF0F172A),
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                  cursorColor: const Color(0xFF0284C7),
                  autofillHints: const [AutofillHints.password],
                  decoration: InputDecoration(
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                    prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20, color: Color(0xFF0284C7)),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                        size: 20,
                        color: const Color(0xFF64748B),
                      ),
                      onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                    ),
                    hintText: strings.text('Nhập mật khẩu (Mặc định demo: 123456)', 'Enter password (Demo default: 123456)'),
                    hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFFCBD5E1), width: 1.2),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFF0284C7), width: 2.0),
                    ),
                  ),
                ),
                const SizedBox(height: 8),

                // Hàng tiện ích: Ghi nhớ đăng nhập & Quên mật khẩu
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          height: 24,
                          width: 24,
                          child: Checkbox(
                            value: _rememberMe,
                            activeColor: AppColors.primary,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                            onChanged: (val) => setState(() => _rememberMe = val ?? true),
                          ),
                        ),
                        const SizedBox(width: 8),
                        GestureDetector(
                          onTap: () => setState(() => _rememberMe = !_rememberMe),
                          child: Text(
                            strings.text('Ghi nhớ đăng nhập', 'Remember me'),
                            style: AppTextStyles.caption.copyWith(color: AppColors.textPrimary),
                          ),
                        ),
                      ],
                    ),
                    TextButton(
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                        visualDensity: VisualDensity.compact,
                      ),
                      onPressed: _openForgotPasswordDialog,
                      child: Text(
                        strings.text('Quên mật khẩu?', 'Forgot password?'),
                        style: AppTextStyles.caption.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),

                // Cảnh báo lỗi hoặc Brute-force Lockout
                if (_passwordError != null) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF3F0),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFFFC6BB)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline_rounded, size: 18, color: AppColors.destructive),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _passwordError!,
                            style: AppTextStyles.caption.copyWith(
                              color: AppColors.destructive,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 16),

                // Nút Đăng nhập chính
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      elevation: 2,
                    ),
                    onPressed: _isLoggingInPassword ? null : _handlePasswordLogin,
                    child: _isLoggingInPassword
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                          )
                        : Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.login_rounded, size: 18),
                              const SizedBox(width: 8),
                              Text(
                                strings.text('Đăng nhập an toàn', 'Sign in securely'),
                                style: AppTextStyles.bodyStrong.copyWith(color: Colors.white),
                              ),
                            ],
                          ),
                  ),
                ),
                const SizedBox(height: 12),

                // Nút Đăng nhập Sinh trắc học (Passkey / Biometrics)
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      side: const BorderSide(color: Color(0xFF10B981)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    onPressed: _handleBiometricLogin,
                    icon: const Icon(Icons.fingerprint_rounded, color: Color(0xFF10B981), size: 22),
                    label: Text(
                      strings.text('Đăng nhập bằng Vân tay / Face ID (Passkey)', 'Sign in with Fingerprint / Face ID'),
                      style: AppTextStyles.bodyStrong.copyWith(color: const Color(0xFF059669), fontSize: 13.5),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Preset tài khoản demo nhanh
          Text(
            strings.text('CHỌN NHANH TÀI KHOẢN TRẢI NGHIỆM', 'QUICK DEMO ACCOUNTS'),
            style: AppTextStyles.caption.copyWith(
              color: AppColors.textMuted,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 10),
          for (final acc in demoPasswordAccounts) ...[
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: InkWell(
                onTap: () {
                  setState(() {
                    _pwdIdentifierController.text = acc['id'] as String;
                    _pwdPasswordController.text = acc['pass'] as String;
                    _passwordError = null;
                  });
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      duration: const Duration(seconds: 2),
                      content: Text('Đã chọn: ${acc['name']} (Mật khẩu: ${acc['pass']})'),
                    ),
                  );
                },
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: (acc['color'] as Color).withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(acc['icon'] as IconData, color: acc['color'] as Color, size: 22),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  acc['name'] as String,
                                  style: AppTextStyles.bodyStrong.copyWith(fontSize: 14),
                                ),
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                  decoration: BoxDecoration(
                                    color: (acc['color'] as Color).withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    acc['role'] as String,
                                    style: TextStyle(
                                      fontSize: 9,
                                      fontWeight: FontWeight.bold,
                                      color: acc['color'] as Color,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 3),
                            Text(
                              '${acc['id']} • Mật khẩu: ${acc['pass']}',
                              style: AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppColors.textMuted),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _handleRegisterSubmit() async {
    if (!(_regFormKey.currentState?.validate() ?? false)) {
      return;
    }
    final pass = _regPasswordController.text;
    final confirmPass = _regConfirmPasswordController.text;
    if (pass != confirmPass) {
      setState(() => _regErrorMessage = 'Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.');
      return;
    }

    setState(() {
      _isRegistering = true;
      _regErrorMessage = null;
    });

    final provider = context.read<AppProvider>();
    try {
      await provider.registerNewAccount(
        fullName: _regFullNameController.text.trim(),
        phoneNumber: _regPhoneController.text.trim(),
        email: _regEmailController.text.trim(),
        password: pass,
        emergencyName: _regEmergencyNameController.text.trim(),
        emergencyPhone: _regEmergencyPhoneController.text.trim(),
        timerIntervalMinutes: _regTimerInterval,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Color(0xFF10B981),
            content: Row(
              children: [
                Icon(Icons.check_circle_rounded, color: Colors.white),
                SizedBox(width: 8),
                Expanded(
                  child: Text('Đăng ký tài khoản thành công! Chào mừng bạn gia nhập mạng lưới SafeSolo.'),
                ),
              ],
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _regErrorMessage = e.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _isRegistering = false);
    }
  }

  Widget _buildRegistrationForm(AppStrings strings, AppProvider appProvider) {
    return Form(
      key: _regFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.person_outline_rounded, color: Color(0xFF059669), size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            strings.text('Thông tin cá nhân', 'Personal Information'),
                            style: AppTextStyles.title.copyWith(fontSize: 16),
                          ),
                          Text(
                            strings.text('Họ tên và phương thức liên hệ chính', 'Full name & primary contacts'),
                            style: AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Họ và tên
                Text(
                  strings.text('Họ và tên *', 'Full name *'),
                  style: AppTextStyles.bodyStrong.copyWith(fontSize: 13),
                ),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _regFullNameController,
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return 'Vui lòng nhập họ và tên';
                    return null;
                  },
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.badge_outlined, size: 20),
                    hintText: 'VD: Đoàn Minh Quân',
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                  ),
                ),
                const SizedBox(height: 14),

                // Số điện thoại
                Text(
                  strings.text('Số điện thoại di động *', 'Phone number *'),
                  style: AppTextStyles.bodyStrong.copyWith(fontSize: 13),
                ),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _regPhoneController,
                  keyboardType: TextInputType.phone,
                  validator: (v) {
                    if (v == null || v.trim().length < 9) return 'Vui lòng nhập số điện thoại hợp lệ (9-11 số)';
                    return null;
                  },
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.phone_outlined, size: 20),
                    hintText: 'VD: 0913843958',
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                  ),
                ),
                const SizedBox(height: 14),

                // Email
                Text(
                  strings.text('Địa chỉ Email *', 'Email address *'),
                  style: AppTextStyles.bodyStrong.copyWith(fontSize: 13),
                ),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _regEmailController,
                  keyboardType: TextInputType.emailAddress,
                  validator: (v) {
                    if (v == null || !v.contains('@')) return 'Vui lòng nhập email hợp lệ';
                    return null;
                  },
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.mail_outline_rounded, size: 20),
                    hintText: 'VD: quan.doan@safesolo.vn',
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Card 2: Mật khẩu
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.lock_outline_rounded, color: AppColors.primary, size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            strings.text('Mật khẩu bảo mật', 'Account Password'),
                            style: AppTextStyles.title.copyWith(fontSize: 16),
                          ),
                          Text(
                            strings.text('Mật khẩu đăng nhập vào ứng dụng', 'Password to sign in'),
                            style: AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Mật khẩu
                Text(
                  strings.text('Mật khẩu (tối thiểu 6 ký tự) *', 'Password (min 6 characters) *'),
                  style: AppTextStyles.bodyStrong.copyWith(fontSize: 13),
                ),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _regPasswordController,
                  obscureText: _regObscurePassword,
                  validator: (v) {
                    if (v == null || v.length < 6) return 'Mật khẩu cần tối thiểu 6 ký tự';
                    return null;
                  },
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20),
                    suffixIcon: IconButton(
                      icon: Icon(_regObscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 20),
                      onPressed: () => setState(() => _regObscurePassword = !_regObscurePassword),
                    ),
                    hintText: 'Nhập mật khẩu an toàn',
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                  ),
                ),
                const SizedBox(height: 14),

                // Xác nhận mật khẩu
                Text(
                  strings.text('Nhập lại mật khẩu *', 'Confirm password *'),
                  style: AppTextStyles.bodyStrong.copyWith(fontSize: 13),
                ),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _regConfirmPasswordController,
                  obscureText: _regObscureConfirmPassword,
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Vui lòng xác nhận mật khẩu';
                    if (v != _regPasswordController.text) return 'Mật khẩu xác nhận không khớp';
                    return null;
                  },
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.lock_reset_rounded, size: 20),
                    suffixIcon: IconButton(
                      icon: Icon(_regObscureConfirmPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 20),
                      onPressed: () => setState(() => _regObscureConfirmPassword = !_regObscureConfirmPassword),
                    ),
                    hintText: 'Nhập lại mật khẩu vừa nhập',
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Card 3: Người giám hộ / Khẩn cấp (ICE)
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: const Color(0xFFEF4444).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.emergency_rounded, color: Color(0xFFDC2626), size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            strings.text('Người bảo hộ khẩn cấp (ICE)', 'Emergency Contact (ICE)'),
                            style: AppTextStyles.title.copyWith(fontSize: 16),
                          ),
                          Text(
                            strings.text('Nhận thông báo khi xảy ra sự cố khẩn cấp hoặc té ngã', 'Notified on SOS or fall alerts'),
                            style: AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Tên người thân
                Text(
                  strings.text('Họ tên người thân *', 'Contact name *'),
                  style: AppTextStyles.bodyStrong.copyWith(fontSize: 13),
                ),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _regEmergencyNameController,
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return 'Vui lòng nhập họ tên người thân';
                    return null;
                  },
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.favorite_outline_rounded, size: 20),
                    hintText: 'VD: Mẹ Lan, Bố Tuấn, Vợ Mai',
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                  ),
                ),
                const SizedBox(height: 14),

                // SĐT người thân
                Text(
                  strings.text('Số điện thoại người thân *', 'Contact phone *'),
                  style: AppTextStyles.bodyStrong.copyWith(fontSize: 13),
                ),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _regEmergencyPhoneController,
                  keyboardType: TextInputType.phone,
                  validator: (v) {
                    if (v == null || v.trim().length < 9) return 'Vui lòng nhập SĐT người thân (9-11 số)';
                    return null;
                  },
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.phone_in_talk_outlined, size: 20),
                    hintText: 'VD: 0901112222',
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Card 4: Chu kỳ điểm danh
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: const Color(0xFF6366F1).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.timer_outlined, color: Color(0xFF4F46E5), size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            strings.text('Chu kỳ an toàn Dead-man Switch', 'Safety Check-in Interval'),
                            style: AppTextStyles.title.copyWith(fontSize: 16),
                          ),
                          Text(
                            strings.text('Thời gian đếm ngược giữa các lần xác nhận an toàn', 'Countdown timer interval'),
                            style: AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    for (final item in [
                      {'label': '12 Giờ\n(Khuyên dùng)', 'val': 720},
                      {'label': '24 Giờ\n(Mỗi ngày)', 'val': 1440},
                      {'label': '48 Giờ\n(2 ngày)', 'val': 2880},
                    ]) ...[
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          child: InkWell(
                            onTap: () => setState(() => _regTimerInterval = item['val'] as int),
                            borderRadius: BorderRadius.circular(12),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              decoration: BoxDecoration(
                                color: _regTimerInterval == item['val']
                                    ? AppColors.primary.withValues(alpha: 0.1)
                                    : const Color(0xFFF8FAFC),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: _regTimerInterval == item['val']
                                      ? AppColors.primary
                                      : const Color(0xFFE2E8F0),
                                  width: _regTimerInterval == item['val'] ? 2 : 1,
                                ),
                              ),
                              child: Text(
                                item['label'] as String,
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: _regTimerInterval == item['val'] ? FontWeight.bold : FontWeight.normal,
                                  color: _regTimerInterval == item['val'] ? AppColors.primary : AppColors.textPrimary,
                                  height: 1.3,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),

          // Thông báo lỗi nếu có
          if (_regErrorMessage != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF3F0),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFFFC6BB)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline_rounded, color: AppColors.destructive, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _regErrorMessage!,
                      style: AppTextStyles.caption.copyWith(color: AppColors.destructive, fontWeight: FontWeight.w500),
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 20),

          // Nút Đăng ký tài khoản
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF059669),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                elevation: 2,
              ),
              onPressed: _isRegistering ? null : _handleRegisterSubmit,
              child: _isRegistering
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.how_to_reg_rounded, size: 20),
                        const SizedBox(width: 8),
                        Text(
                          strings.text('TẠO TÀI KHOẢN & KÍCH HOẠT', 'CREATE ACCOUNT & ACTIVATE'),
                          style: AppTextStyles.bodyStrong.copyWith(color: Colors.white, letterSpacing: 0.5),
                        ),
                      ],
                    ),
            ),
          ),

          // Chuyển sang Đăng nhập
          Center(
            child: Padding(
              padding: const EdgeInsets.only(top: 16, bottom: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    strings.text('Đã có tài khoản SafeSolo?', 'Already have an account?'),
                    style: AppTextStyles.body.copyWith(color: AppColors.textSecondary, fontSize: 13.5),
                  ),
                  TextButton(
                    onPressed: () => setState(() => _authMode = 0),
                    child: Text(
                      strings.text('Đăng nhập ngay', 'Sign in now'),
                      style: AppTextStyles.bodyStrong.copyWith(color: AppColors.primary, fontSize: 13.5),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
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
            const SizedBox(height: 16),

            // Top Segmented Bar: [ ĐĂNG NHẬP ] | [ ĐĂNG KÝ MỚI ]
            Container(
              height: 48,
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              padding: const EdgeInsets.all(4),
              child: Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _authMode = 0),
                      behavior: HitTestBehavior.opaque,
                      child: Container(
                        decoration: BoxDecoration(
                          color: _authMode == 0 ? Colors.white : Colors.transparent,
                          borderRadius: BorderRadius.circular(10),
                          boxShadow: _authMode == 0
                              ? [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.06),
                                    blurRadius: 4,
                                    offset: const Offset(0, 2),
                                  )
                                ]
                              : null,
                        ),
                        alignment: Alignment.center,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.login_rounded,
                              size: 18,
                              color: _authMode == 0 ? AppColors.primary : AppColors.textSecondary,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              strings.text('ĐĂNG NHẬP', 'SIGN IN'),
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: _authMode == 0 ? FontWeight.bold : FontWeight.w600,
                                color: _authMode == 0 ? AppColors.primary : AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _authMode = 1),
                      behavior: HitTestBehavior.opaque,
                      child: Container(
                        decoration: BoxDecoration(
                          color: _authMode == 1 ? Colors.white : Colors.transparent,
                          borderRadius: BorderRadius.circular(10),
                          boxShadow: _authMode == 1
                              ? [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.06),
                                    blurRadius: 4,
                                    offset: const Offset(0, 2),
                                  )
                                ]
                              : null,
                        ),
                        alignment: Alignment.center,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.person_add_rounded,
                              size: 18,
                              color: _authMode == 1 ? const Color(0xFF059669) : AppColors.textSecondary,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              strings.text('ĐĂNG KÝ TÀI KHOẢN', 'REGISTER'),
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: _authMode == 1 ? FontWeight.bold : FontWeight.w600,
                                color: _authMode == 1 ? const Color(0xFF059669) : AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),

            // Header Title & Description
            if (_authMode == 0) ...[
              Text(
                strings.text('Đăng nhập SafeSolo', 'Sign in to SafeSolo'),
                style: AppTextStyles.h1.copyWith(fontSize: 28),
              ),
              const SizedBox(height: 6),
              Text(
                strings.text(
                  'Chọn phương thức thuận tiện nhất: Mật khẩu, Số điện thoại OTP, Gmail hoặc Telegram.',
                  'Choose your preferred sign-in method: Password, Phone OTP, Gmail, or Telegram.',
                ),
                style: AppTextStyles.bodyLarge.copyWith(
                  color: AppColors.textSecondary,
                  height: 1.4,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 16),

              // Modern Tab Selector with 4 tabs
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
                    _buildTabItem(1, Icons.lock_outline_rounded, strings.text('Mật khẩu', 'Password')),
                    _buildTabItem(2, Icons.mail_outline_rounded, strings.text('Gmail / Google', 'Gmail / Google')),
                    _buildTabItem(3, Icons.send_rounded, strings.text('Telegram Bot', 'Telegram Bot')),
                  ],
                ),
              ),
              const SizedBox(height: 18),

              // Tab Content
              if (_selectedTab == 0)
                _buildPhoneForm(strings, appProvider)
              else if (_selectedTab == 1)
                _buildPasswordTab(strings, appProvider)
              else if (_selectedTab == 2)
                _buildGmailTab(strings, appProvider)
              else
                _buildTelegramTab(strings, appProvider),

              // Bottom register CTA
              Center(
                child: Padding(
                  padding: const EdgeInsets.only(top: 20, bottom: 8),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        strings.text('Chưa có tài khoản SafeSolo?', "Don't have a SafeSolo account?"),
                        style: AppTextStyles.body.copyWith(color: AppColors.textSecondary, fontSize: 13.5),
                      ),
                      TextButton(
                        onPressed: () => setState(() => _authMode = 1),
                        child: Text(
                          strings.text('Đăng ký miễn phí ngay', 'Register now for free'),
                          style: AppTextStyles.bodyStrong.copyWith(color: AppColors.primary, fontSize: 13.5),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ] else ...[
              Text(
                strings.text('Tạo tài khoản SafeSolo', 'Create SafeSolo Account'),
                style: AppTextStyles.h1.copyWith(fontSize: 28),
              ),
              const SizedBox(height: 6),
              Text(
                strings.text(
                  'Khởi tạo mạng lưới bảo vệ khẩn cấp, liên kết người thân và đồng bộ dữ liệu.',
                  'Initialize emergency rescue network, link guardians, and sync data.',
                ),
                style: AppTextStyles.bodyLarge.copyWith(
                  color: AppColors.textSecondary,
                  height: 1.4,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 18),

              // Registration Form Content
              _buildRegistrationForm(strings, appProvider),
            ],

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

  void _syncIdentifierBetweenTabs(int targetTab) {
    if (_selectedTab == 0) {
      final phone = _phoneInputController.text.trim();
      if (phone.isNotEmpty) {
        _pwdIdentifierController.text = phone;
      }
    } else if (_selectedTab == 1) {
      final id = _pwdIdentifierController.text.trim();
      if (id.isNotEmpty) {
        if (id.contains('@')) {
          _gmailEmailController.text = id;
        } else if (RegExp(r'^[0-9+]+$').hasMatch(id)) {
          _phoneInputController.text = id;
        } else if (id.startsWith('@')) {
          _telegramIdentifierController.text = id;
        }
      }
    } else if (_selectedTab == 2) {
      final email = _gmailEmailController.text.trim();
      if (email.isNotEmpty && email.contains('@')) {
        _pwdIdentifierController.text = email;
      }
    }
  }

  Widget _buildTabItem(int index, IconData icon, String label) {
    final isSelected = _selectedTab == index;
    return Expanded(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          _syncIdentifierBetweenTabs(index);
          setState(() => _selectedTab = index);
        },
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
    if (_phoneStep == 1) {
      return _buildPhoneStep1(strings, appProvider);
    } else if (_phoneStep == 2) {
      return _buildPhoneStep2(strings, appProvider);
    }
    return _buildPhoneStep0(strings, appProvider);
  }

  // ===========================================================================
  // BƯỚC 1: NHẬP SỐ ĐIỆN THOẠI & BỘ CHỌN NHANH DEMO (CHUẨN GRAB/SHOPEE/TELEGRAM)
  // ===========================================================================
  Widget _buildPhoneStep0(AppStrings strings, AppProvider appProvider) {
    final demoAccounts = [
      {
        'role': 'HIỆP SĨ SAFESOLO (ĐÃ KYC)',
        'name': 'Đoàn Minh Quân - MSSV: 2224801030137',
        'phone': '0913843958',
        'desc': 'Quyền trực tiếp nhận tín hiệu cứu hộ khẩn cấp & điều phối 115',
        'icon': Icons.shield_rounded,
        'color': const Color(0xFFF59E0B),
      },
      {
        'role': 'NGƯỜI DÙNG CÁ NHÂN',
        'name': 'Nguyễn Văn An (Đã có hồ sơ)',
        'phone': '0908889999',
        'desc': 'Chế độ an toàn cá nhân, kết nối Galaxy Watch 5 & điểm danh',
        'icon': Icons.person_rounded,
        'color': const Color(0xFF0284C7),
      },
      {
        'role': 'NGƯỜI GIÁM HỘ / BẢO TRỢ',
        'name': 'Trần Thị Mai (Người thân 115)',
        'phone': '0901112222',
        'desc': 'Nhận cảnh báo SOS, vị trí Live Radar & kết nối gọi khẩn',
        'icon': Icons.favorite_rounded,
        'color': const Color(0xFF10B981),
      },
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Nhập số điện thoại',
                style: AppTextStyles.title.copyWith(fontSize: 16),
              ),
              const SizedBox(height: 6),
              Text(
                'Mã xác thực OTP gồm 6 chữ số sẽ được gửi qua SMS / Zalo để đăng nhập an toàn.',
                style: AppTextStyles.caption.copyWith(color: AppColors.textSecondary, height: 1.4),
              ),
              const SizedBox(height: 16),

              // Ô nhập SĐT chuẩn thương mại (+84)
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFF0284C7), width: 1.5),
                  color: Colors.white,
                ),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Row(
                        children: [
                          Text('🇻🇳', style: TextStyle(fontSize: 18)),
                          SizedBox(width: 6),
                          Text(
                            '+84',
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextField(
                        controller: _phoneInputController,
                        keyboardType: TextInputType.phone,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.2,
                          color: Color(0xFF0F172A),
                        ),
                        decoration: const InputDecoration(
                          hintText: '0913 843 958',
                          hintStyle: TextStyle(color: Color(0xFF94A3B8), fontWeight: FontWeight.normal),
                          filled: false,
                          fillColor: Colors.transparent,
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          contentPadding: EdgeInsets.symmetric(vertical: 12),
                        ),
                        onSubmitted: (_) => _handlePhoneNext(),
                      ),
                    ),
                    if (_phoneInputController.text.isNotEmpty)
                      IconButton(
                        icon: const Icon(Icons.cancel, color: Color(0xFF94A3B8), size: 20),
                        onPressed: () => setState(() => _phoneInputController.clear()),
                      ),
                  ],
                ),
              ),

              const SizedBox(height: 18),

              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0284C7),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    elevation: 2,
                  ),
                  onPressed: _isCheckingPhone ? null : _handlePhoneNext,
                  child: _isCheckingPhone
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                        )
                      : Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              strings.text('Tiếp tục vào SafeSolo', 'Continue to SafeSolo'),
                              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, letterSpacing: 0.8),
                            ),
                            const SizedBox(width: 8),
                            const Icon(Icons.arrow_forward_rounded, size: 18),
                          ],
                        ),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 24),

        // Bộ Preset Demo 1-Chạm
        Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Text(
                'DEMO HỘI ĐỒNG',
                style: TextStyle(color: Color(0xFFD97706), fontSize: 10, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(width: 8),
            const Expanded(
              child: Text(
                'TÀI KHOẢN MẪU KHÓA LUẬN (1-CHẠM)',
                overflow: TextOverflow.ellipsis,
                maxLines: 1,
                style: TextStyle(
                  color: Color(0xFF64748B),
                  fontSize: 11.5,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.5,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),

        for (final item in demoAccounts)
          Container(
            margin: const EdgeInsets.only(bottom: 10),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: (item['phone'] == _phoneInputController.text)
                    ? (item['color'] as Color)
                    : const Color(0xFFE2E8F0),
                width: (item['phone'] == _phoneInputController.text) ? 1.8 : 1.0,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.03),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(16),
                onTap: () => _handleSelectDemoPhone(
                  phone: item['phone'] as String,
                  name: item['name'] as String,
                  role: item['role'] as String,
                ),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: (item['color'] as Color).withValues(alpha: 0.12),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(item['icon'] as IconData, color: item['color'] as Color, size: 22),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  item['phone'] as String,
                                  style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF0F172A),
                                    letterSpacing: 0.5,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                  decoration: BoxDecoration(
                                    color: (item['color'] as Color).withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    item['role'] as String,
                                    style: TextStyle(
                                      color: item['color'] as Color,
                                      fontSize: 9.5,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 3),
                            Text(
                              item['name'] as String,
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              item['desc'] as String,
                              style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: Color(0xFF94A3B8)),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  // ===========================================================================
  // BƯỚC 2: NHẬP MÃ XÁC THỰC OTP (BÀN PHÍM 6 SỐ + NÚT TỰ ĐIỀN DEMO 888888)
  // ===========================================================================
  Widget _buildPhoneStep1(AppStrings strings, AppProvider appProvider) {
    final currentPhone = _phoneInputController.text.trim();
    final otpText = _otpInputController.text;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF0284C7)),
                onPressed: () => setState(() {
                  _phoneStep = 0;
                  _otpErrorMessage = null;
                }),
              ),
              const SizedBox(width: 4),
              const Text(
                'Xác thực mã OTP',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
              ),
            ],
          ),
          const SizedBox(height: 10),

          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF0F9FF),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFBAE6FD)),
            ),
            child: Row(
              children: [
                const Icon(Icons.mark_email_read_rounded, color: Color(0xFF0284C7), size: 22),
                const SizedBox(width: 10),
                Expanded(
                  child: RichText(
                    text: TextSpan(
                      text: 'Mã xác minh 6 số đã được gửi đến: ',
                      style: const TextStyle(fontSize: 12.5, color: Color(0xFF334155)),
                      children: [
                        TextSpan(
                          text: currentPhone,
                          style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0284C7)),
                        ),
                      ],
                    ),
                  ),
                ),
                TextButton(
                  onPressed: () => setState(() => _phoneStep = 0),
                  child: const Text('Đổi SĐT', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // 6 Ô OTP tròn/bo góc hiện đại
          Center(
            child: GestureDetector(
              onTap: () {
                // Focus hidden textfield
              },
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(6, (i) {
                  final isFilled = otpText.length > i;
                  final isCurrent = otpText.length == i;
                  final digit = isFilled ? otpText[i] : '';

                  return Container(
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    width: 42,
                    height: 52,
                    decoration: BoxDecoration(
                      color: isFilled ? const Color(0xFFF8FAFC) : Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isCurrent
                            ? const Color(0xFF0284C7)
                            : (isFilled ? const Color(0xFF0284C7) : const Color(0xFFCBD5E1)),
                        width: isCurrent || isFilled ? 2.0 : 1.2,
                      ),
                      boxShadow: isCurrent
                          ? [
                              BoxShadow(
                                color: const Color(0xFF0284C7).withValues(alpha: 0.25),
                                blurRadius: 8,
                              )
                            ]
                          : null,
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      digit,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  );
                }),
              ),
            ),
          ),

          const SizedBox(height: 10),

          // TextField ẩn hỗ trợ gõ phím hệ thống (giấu gọn gàng không chiếm diện tích)
          SizedBox(
            width: 0,
            height: 0,
            child: TextField(
              controller: _otpInputController,
              keyboardType: TextInputType.number,
              maxLength: 6,
              textAlign: TextAlign.center,
              autofocus: true,
              style: const TextStyle(color: Colors.transparent, height: 0.1),
              cursorColor: Colors.transparent,
              decoration: const InputDecoration(
                counterText: '',
                filled: false,
                fillColor: Colors.transparent,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                contentPadding: EdgeInsets.zero,
              ),
              onChanged: (val) {
                setState(() {
                  _otpErrorMessage = null;
                });
                if (val.length == 6) {
                  _handleVerifyPhoneOtp();
                }
              },
            ),
          ),

          if (_otpErrorMessage != null) ...[
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFFCA5A5)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _otpErrorMessage!,
                      style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
          ],

          // Nút điền nhanh Demo 888888 (Tối ưu trải nghiệm chấm thi)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFEFF6FF), Color(0xFFF0FDF4)],
              ),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFF93C5FD)),
            ),
            child: Row(
              children: [
                const Icon(Icons.bolt_rounded, color: Color(0xFF2563EB), size: 22),
                const SizedBox(width: 8),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Chế độ Demo Khóa luận',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF1E3A8A)),
                      ),
                      Text(
                        'Điền ngay mã OTP mẫu để đăng nhập tức thì',
                        style: TextStyle(fontSize: 10.5, color: Color(0xFF475569)),
                      ),
                    ],
                  ),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0284C7),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  onPressed: () {
                    _otpInputController.text = '888888';
                    setState(() {});
                    _handleVerifyPhoneOtp();
                  },
                  child: const Text('Điền 888888', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),

          const SizedBox(height: 18),

          // Đếm ngược gửi lại OTP
          Center(
            child: _otpCountdown > 0
                ? Text(
                    'Chưa nhận được mã? Gửi lại sau ${_otpCountdown}s',
                    style: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                  )
                : TextButton.icon(
                    onPressed: _startOtpCountdown,
                    icon: const Icon(Icons.refresh_rounded, size: 16),
                    label: const Text('Gửi lại mã OTP qua SMS', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
          ),

          const SizedBox(height: 14),

          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0284C7),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: _isVerifyingOtp ? null : _handleVerifyPhoneOtp,
              child: _isVerifyingOtp
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text(
                      'XÁC MINH & ĐĂNG NHẬP',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, letterSpacing: 0.8),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // BƯỚC 3: HOÀN TẤT HỒ SƠ BẢO VỆ MỚI (CHỈ HIỂN THỊ KHI SĐT CHƯA TỪNG ĐĂNG KÝ)
  // ===========================================================================
  Widget _buildPhoneStep2(AppStrings strings, AppProvider appProvider) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF0284C7)),
                onPressed: () => setState(() => _phoneStep = 1),
              ),
              const SizedBox(width: 4),
              const Expanded(
                child: Text(
                  'Hoàn tất hồ sơ bảo vệ mới',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Số điện thoại ${_phoneController.text} chưa từng đăng ký. Vui lòng điền thông tin người thân để kích hoạt mạng lưới cứu hộ khẩn cấp.',
            style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 14),

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
            strings.text('Chu kỳ điểm danh mặc định', 'Default check-in cycle'),
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
                  : Text(strings.text('HOÀN TẤT & VÀO SAFESOLO', 'Complete & Enter SafeSolo')),
            ),
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
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          side: BorderSide(color: Colors.grey.shade300),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: appProvider.isBusy ? null : _handleAppleSignIn,
                        icon: const Icon(Icons.apple, color: Colors.black87, size: 20),
                        label: const Text(
                          'Apple ID',
                          style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          side: BorderSide(color: Colors.grey.shade300),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: appProvider.isBusy ? null : _handleMicrosoftSignIn,
                        icon: const Icon(Icons.window_rounded, color: Color(0xFF00A4EF), size: 18),
                        label: const Text(
                          'Microsoft',
                          style: TextStyle(color: Color(0xFF1E293B), fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                      ),
                    ),
                  ],
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
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                side: const BorderSide(color: Color(0xFF229ED9), width: 1.5),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: appProvider.isBusy ? null : () => _showTelegramAccountChooserSheet(context),
              icon: const Icon(Icons.send_rounded, color: Color(0xFF229ED9)),
              label: Text(
                strings.text('Chọn tài khoản Telegram để tiếp tục', 'Choose Telegram Account to continue'),
                style: AppTextStyles.title.copyWith(
                  color: const Color(0xFF229ED9),
                  fontSize: 15,
                ),
              ),
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
