import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_strings.dart';
import '../../core/app_theme.dart';
import '../../core/providers/app_provider.dart';
import '../../core/widgets/app_shell.dart';

class ProfileSetupPage extends StatefulWidget {
  const ProfileSetupPage({super.key});

  @override
  State<ProfileSetupPage> createState() => _ProfileSetupPageState();
}

class _ProfileSetupPageState extends State<ProfileSetupPage> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _emergencyNameController = TextEditingController();
  final _emergencyPhoneController = TextEditingController();
  final _allergiesController = TextEditingController();

  String _selectedRelation = 'Người thân';
  String? _selectedBloodType;
  int _timerIntervalMinutes = 720;
  bool _isSubmitting = false;

  final List<String> _bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  final List<String> _relations = ['Bố / Mẹ', 'Vợ / Chồng', 'Con cái', 'Anh / Chị / Em', 'Bạn thân', 'Người thân'];

  @override
  void initState() {
    super.initState();
    final user = context.read<AppProvider>().user;
    _nameController = TextEditingController(text: user?.name ?? '');
    _emailController.text = user?.email ?? '';
    if (user?.phoneNumber.isNotEmpty ?? false) {
      _phoneController.text = user!.phoneNumber;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _emergencyNameController.dispose();
    _emergencyPhoneController.dispose();
    _allergiesController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    setState(() => _isSubmitting = true);
    final provider = context.read<AppProvider>();
    final strings = AppStrings(provider.language);

    try {
      await provider.completeProfileSetup(
        fullName: _nameController.text.trim(),
        phoneNumber: _phoneController.text.trim(),
        email: _emailController.text.trim(),
        emergencyName: _emergencyNameController.text.trim(),
        emergencyPhone: _emergencyPhoneController.text.trim(),
        emergencyRelation: _selectedRelation,
        bloodType: _selectedBloodType,
        allergies: _allergiesController.text.trim(),
        timerIntervalMinutes: _timerIntervalMinutes,
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            strings.text('Lỗi lưu hồ sơ: $error', 'Failed to save profile: $error'),
          ),
          backgroundColor: AppColors.destructive,
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    final appProvider = context.watch<AppProvider>();

    return Scaffold(
      body: AppPage(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.only(top: 20, bottom: 32),
            children: [
              // Header Badge & Title
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.verified_user_rounded,
                      color: AppColors.primary,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    'SafeSolo Protection',
                    style: AppTextStyles.title.copyWith(
                      color: AppColors.primary,
                      fontSize: 15,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Text(
                strings.text('Thiết lập Hồ sơ An toàn', 'Set Up Safety Profile'),
                style: AppTextStyles.h1.copyWith(fontSize: 28),
              ),
              const SizedBox(height: 8),
              Text(
                strings.text(
                  'Chào mừng bạn đến với SafeSolo! Vui lòng hoàn tất thông tin bảo vệ để hệ thống có thể kết nối cứu hộ và thông báo cho người thân khi bạn gặp sự cố.',
                  'Welcome to SafeSolo! Please complete your protection profile so our emergency network can assist and notify loved ones in distress.',
                ),
                style: AppTextStyles.bodyLarge.copyWith(
                  color: AppColors.textSecondary,
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 24),

              // Card 1: Thông tin cá nhân
              _buildSectionHeader(
                icon: Icons.person_rounded,
                title: strings.text('1. Thông tin cá nhân của bạn', '1. Your Personal Info'),
              ),
              const SizedBox(height: 10),
              AppCard(
                child: Column(
                  children: [
                    TextFormField(
                      controller: _nameController,
                      textInputAction: TextInputAction.next,
                      decoration: InputDecoration(
                        labelText: strings.text('Họ và tên *', 'Full name *'),
                        prefixIcon: const Icon(Icons.badge_outlined),
                      ),
                      validator: (value) => (value == null || value.trim().isEmpty)
                          ? strings.text('Vui lòng nhập họ và tên', 'Please enter full name')
                          : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _phoneController,
                      textInputAction: TextInputAction.next,
                      keyboardType: TextInputType.phone,
                      decoration: InputDecoration(
                        labelText: strings.text('Số điện thoại của bạn *', 'Your phone number *'),
                        prefixIcon: const Icon(Icons.phone_outlined),
                        hintText: '0901234567',
                      ),
                      validator: (value) {
                        if (value == null || value.trim().length < 8) {
                          return strings.text(
                            'Vui lòng nhập số điện thoại hợp lệ',
                            'Please enter a valid phone number',
                          );
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      decoration: InputDecoration(
                        labelText: strings.text('Địa chỉ Email', 'Email address'),
                        prefixIcon: const Icon(Icons.mail_outline_rounded),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Card 2: Người liên hệ khẩn cấp (Guardian / Circle)
              _buildSectionHeader(
                icon: Icons.emergency_rounded,
                title: strings.text(
                  '2. Người liên hệ khẩn cấp (Người thân)',
                  '2. Emergency Contact (Guardian)',
                ),
                isDestructive: true,
              ),
              const SizedBox(height: 10),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      strings.text(
                        'Khi bạn quá hạn điểm danh hoặc bấm SOS, SafeSolo sẽ tự động gửi tọa độ GPS và thông báo đến người này:',
                        'When check-in expires or SOS is pressed, SafeSolo will notify this contact with your live GPS:',
                      ),
                      style: AppTextStyles.caption.copyWith(
                        color: AppColors.textSecondary,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _emergencyNameController,
                      textInputAction: TextInputAction.next,
                      decoration: InputDecoration(
                        labelText: strings.text(
                          'Tên người thân / Người giám hộ *',
                          'Emergency contact name *',
                        ),
                        prefixIcon: const Icon(Icons.family_restroom_outlined),
                        hintText: 'VD: Mẹ, Vợ, Bạn thân...',
                      ),
                      validator: (value) => (value == null || value.trim().isEmpty)
                          ? strings.text(
                              'Vui lòng nhập tên người liên hệ',
                              'Please enter contact name',
                            )
                          : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _emergencyPhoneController,
                      keyboardType: TextInputType.phone,
                      textInputAction: TextInputAction.next,
                      decoration: InputDecoration(
                        labelText: strings.text(
                          'Số điện thoại khẩn cấp *',
                          'Emergency phone number *',
                        ),
                        prefixIcon: const Icon(Icons.contact_phone_outlined),
                        hintText: '0987654321',
                      ),
                      validator: (value) {
                        if (value == null || value.trim().length < 8) {
                          return strings.text(
                            'Vui lòng nhập số điện thoại khẩn cấp',
                            'Please enter valid emergency phone number',
                          );
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 14),
                    DropdownButtonFormField<String>(
                      initialValue: _selectedRelation,
                      decoration: InputDecoration(
                        labelText: strings.text('Mối quan hệ', 'Relationship'),
                        prefixIcon: const Icon(Icons.people_outline_rounded),
                      ),
                      items: _relations.map((relation) {
                        return DropdownMenuItem(
                          value: relation,
                          child: Text(relation),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) setState(() => _selectedRelation = val);
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Card 3: Thông tin y tế & Cứu thương
              _buildSectionHeader(
                icon: Icons.medical_services_outlined,
                title: strings.text('3. Thông tin y tế cơ bản (Tùy chọn)', '3. Medical Info (Optional)'),
              ),
              const SizedBox(height: 10),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      strings.text('Nhóm máu của bạn:', 'Your blood type:'),
                      style: AppTextStyles.bodyStrong.copyWith(fontSize: 13),
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _bloodTypes.map((type) {
                        final isSelected = _selectedBloodType == type;
                        return ChoiceChip(
                          label: Text(type),
                          selected: isSelected,
                          selectedColor: const Color(0xFFEF4444).withValues(alpha: 0.15),
                          labelStyle: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: isSelected ? const Color(0xFFB91C1C) : AppColors.textPrimary,
                          ),
                          onSelected: (selected) {
                            setState(() {
                              _selectedBloodType = selected ? type : null;
                            });
                          },
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _allergiesController,
                      decoration: InputDecoration(
                        labelText: strings.text(
                          'Dị ứng / Bệnh nền cần lưu ý',
                          'Allergies / Conditions',
                        ),
                        prefixIcon: const Icon(Icons.health_and_safety_outlined),
                        hintText: strings.text(
                          'VD: Dị ứng Penicillin, hen suyễn...',
                          'e.g. Penicillin allergy, asthma...',
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Card 4: Chu kỳ điểm danh an toàn
              _buildSectionHeader(
                icon: Icons.timer_outlined,
                title: strings.text('4. Chu kỳ điểm danh SafeSolo', '4. SafeSolo Check-in Interval'),
              ),
              const SizedBox(height: 10),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      strings.text(
                        'Thời gian tối đa giữa các lần chạm điểm danh an toàn:',
                        'Max time between safe check-in taps:',
                      ),
                      style: AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [180, 360, 720, 1440].map((interval) {
                        final hours = (interval / 60).round();
                        final isSelected = _timerIntervalMinutes == interval;
                        return Expanded(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(10),
                              onTap: () => setState(() => _timerIntervalMinutes = interval),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 10),
                                decoration: BoxDecoration(
                                  color: isSelected ? AppColors.primary : AppColors.backgroundAlt,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                    color: isSelected ? AppColors.primary : AppColors.border,
                                  ),
                                ),
                                child: Center(
                                  child: Text(
                                    '${hours}h',
                                    style: TextStyle(
                                      color: isSelected ? Colors.white : AppColors.textPrimary,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),

              // Submit Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    backgroundColor: AppColors.primary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                    ),
                    elevation: 0,
                  ),
                  onPressed: (_isSubmitting || appProvider.isBusy) ? null : _handleSubmit,
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.check_circle_rounded, size: 20, color: Colors.white),
                            const SizedBox(width: 8),
                            Text(
                              strings.text(
                                'Hoàn tất hồ sơ & Vào SafeSolo',
                                'Complete Profile & Enter SafeSolo',
                              ),
                              style: AppTextStyles.title.copyWith(
                                color: Colors.white,
                                fontSize: 16,
                              ),
                            ),
                          ],
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionHeader({
    required IconData icon,
    required String title,
    bool isDestructive = false,
  }) {
    final color = isDestructive ? const Color(0xFFEF4444) : AppColors.primary;
    return Row(
      children: [
        Icon(icon, size: 18, color: color),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            title,
            style: AppTextStyles.bodyStrong.copyWith(
              color: color,
              fontSize: 14,
            ),
          ),
        ),
      ],
    );
  }
}
