import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/app_strings.dart';
import '../../core/app_theme.dart';
import '../../core/providers/app_provider.dart';
import '../../core/widgets/app_shell.dart';

class MedicalPage extends StatefulWidget {
  const MedicalPage({super.key});

  @override
  State<MedicalPage> createState() => _MedicalPageState();
}

class _MedicalPageState extends State<MedicalPage> {
  static const List<String> _bloodTypes = [
    'Chưa cập nhật',
    'A+',
    'A-',
    'B+',
    'B-',
    'AB+',
    'AB-',
    'O+',
    'O-',
  ];

  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _fullNameController;
  late final TextEditingController _birthYearController;
  late final TextEditingController _citizenIdController;
  late final TextEditingController _permanentAddressController;
  late final TextEditingController _bloodTypeController;
  late final TextEditingController _allergiesController;
  late final TextEditingController _conditionsController;
  late final TextEditingController _medicationsController;
  late final TextEditingController _emergencyPhoneController;
  late final TextEditingController _insuranceProviderController;
  late final TextEditingController _insuranceNumberController;

  @override
  void initState() {
    super.initState();
    final medical = context.read<AppProvider>().medical;
    _fullNameController = TextEditingController(text: medical.fullName);
    _birthYearController = TextEditingController(text: medical.birthYear);
    _citizenIdController = TextEditingController(text: medical.citizenId);
    _permanentAddressController = TextEditingController(
      text: medical.permanentAddress,
    );
    _bloodTypeController = TextEditingController(
      text: medical.bloodType.trim().isEmpty ? 'Chưa cập nhật' : medical.bloodType,
    );
    _allergiesController = TextEditingController(text: medical.allergies);
    _conditionsController = TextEditingController(text: medical.conditions);
    _medicationsController = TextEditingController(text: medical.medications);
    _emergencyPhoneController = TextEditingController(text: medical.emergencyPhone);
    _insuranceProviderController = TextEditingController(
      text: medical.insuranceProvider,
    );
    _insuranceNumberController = TextEditingController(
      text: medical.insuranceNumber,
    );
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _birthYearController.dispose();
    _citizenIdController.dispose();
    _permanentAddressController.dispose();
    _bloodTypeController.dispose();
    _allergiesController.dispose();
    _conditionsController.dispose();
    _medicationsController.dispose();
    _emergencyPhoneController.dispose();
    _insuranceProviderController.dispose();
    _insuranceNumberController.dispose();
    super.dispose();
  }

  AppStrings _strings() => AppStrings(context.read<AppProvider>().language);

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(strings.text('Thông tin y tế', 'Medical ID')),
        actions: [
          TextButton(
            onPressed: _showQrCode,
            child: Text(strings.text('Tạo QR', 'Create QR')),
          ),
          TextButton(
            onPressed: _saveMedicalInfo,
            child: Text(strings.text('Lưu', 'Save')),
          ),
        ],
      ),
      body: AppPage(
        safeBottom: true,
        child: Form(
          key: _formKey,
          child: ListView(
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.only(top: 8, bottom: 120),
            children: [
              AppCard(
                color: AppColors.cardSoft,
                shadow: const [],
                border: Border.all(color: AppColors.border),
                child: Text(
                  strings.text(
                    'Thông tin này được dùng để hỗ trợ nhanh trong tình huống khẩn cấp. Mã QR sẽ được tối ưu để dễ quét hơn trên điện thoại.',
                    'This information is used for faster support in emergencies. The QR code is optimized to be easier to scan on phones.',
                  ),
                  style: AppTextStyles.bodyLarge.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
              const SizedBox(height: 18),
              _SectionTitle(strings.text('Thông tin cá nhân', 'Personal information')),
              const SizedBox(height: 10),
              AppCard(
                child: Column(
                  children: [
                    TextFormField(
                      controller: _fullNameController,
                      textCapitalization: TextCapitalization.words,
                      decoration: InputDecoration(
                        labelText: strings.text('Họ và tên', 'Full name'),
                        prefixIcon: const Icon(Icons.person_outline_rounded),
                      ),
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _birthYearController,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: strings.text('Năm sinh', 'Birth year'),
                        prefixIcon: const Icon(Icons.cake_outlined),
                      ),
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _citizenIdController,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: strings.text('CCCD', 'Citizen ID'),
                        prefixIcon: const Icon(Icons.badge_outlined),
                      ),
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _permanentAddressController,
                      maxLines: 2,
                      decoration: InputDecoration(
                        labelText: strings.text('Địa chỉ thường trú', 'Permanent address'),
                        prefixIcon: const Icon(Icons.home_work_outlined),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              _SectionTitle(strings.text('Thông tin y tế', 'Medical information')),
              const SizedBox(height: 10),
              AppCard(
                child: Column(
                  children: [
                    DropdownButtonFormField<String>(
                      initialValue: _normalizedBloodType,
                      decoration: InputDecoration(
                        labelText: strings.text('Nhóm máu', 'Blood type'),
                        prefixIcon: const Icon(Icons.bloodtype_outlined),
                      ),
                      items: _bloodTypes
                          .map(
                            (type) => DropdownMenuItem<String>(
                              value: type,
                              child: Text(type, style: AppTextStyles.bodyLarge),
                            ),
                          )
                          .toList(),
                      onChanged: (value) =>
                          _bloodTypeController.text = value ?? 'Chưa cập nhật',
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _allergiesController,
                      maxLines: 2,
                      decoration: InputDecoration(
                        labelText: strings.text('Dị ứng', 'Allergies'),
                        prefixIcon: const Icon(Icons.warning_amber_rounded),
                      ),
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _conditionsController,
                      maxLines: 2,
                      decoration: InputDecoration(
                        labelText: strings.text('Bệnh nền', 'Conditions'),
                        prefixIcon: const Icon(Icons.favorite_border_rounded),
                      ),
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _medicationsController,
                      maxLines: 2,
                      decoration: InputDecoration(
                        labelText: strings.text('Thuốc đang dùng', 'Current medications'),
                        prefixIcon: const Icon(Icons.medication_outlined),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              _SectionTitle(strings.text('Liên hệ khẩn cấp', 'Emergency contact')),
              const SizedBox(height: 10),
              AppCard(
                child: TextFormField(
                  controller: _emergencyPhoneController,
                  keyboardType: TextInputType.phone,
                  decoration: InputDecoration(
                    labelText: strings.text(
                      'Số điện thoại khẩn cấp',
                      'Emergency phone number',
                    ),
                    prefixIcon: const Icon(Icons.phone_in_talk_outlined),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              _SectionTitle(strings.text('Thông tin bảo hiểm', 'Insurance information')),
              const SizedBox(height: 10),
              AppCard(
                child: Column(
                  children: [
                    TextFormField(
                      controller: _insuranceProviderController,
                      decoration: InputDecoration(
                        labelText: strings.text('Nhà bảo hiểm', 'Insurance provider'),
                        prefixIcon: const Icon(Icons.shield_outlined),
                      ),
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _insuranceNumberController,
                      decoration: InputDecoration(
                        labelText: strings.text('Số hợp đồng', 'Policy number'),
                        prefixIcon: const Icon(Icons.confirmation_number_outlined),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String get _normalizedBloodType {
    final value = _bloodTypeController.text.trim();
    if (value.isEmpty || !_bloodTypes.contains(value)) {
      return 'Chưa cập nhật';
    }
    return value;
  }

  String _fallback(String value, String fallback) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? fallback : trimmed;
  }

  String _qrPayload() {
    final strings = _strings();
    final notUpdated = strings.text('Chưa cập nhật', 'Not updated');
    final none = strings.text('Không', 'None');
    final blood = _normalizedBloodType == 'Chưa cập nhật'
        ? notUpdated
        : _normalizedBloodType;

    if (strings.isVietnamese) {
      return [
        'THẺ THÔNG TIN Y TẾ SOS',
        'Họ và tên: ${_fallback(_fullNameController.text.toUpperCase(), notUpdated)}',
        'Năm sinh: ${_fallback(_birthYearController.text, notUpdated)}',
        'CCCD: ${_fallback(_citizenIdController.text, notUpdated)}',
        'Địa chỉ thường trú: ${_fallback(_permanentAddressController.text, notUpdated)}',
        'Nhóm máu: $blood',
        'Dị ứng: ${_fallback(_allergiesController.text, none)}',
        'Bệnh nền: ${_fallback(_conditionsController.text, none)}',
        'Thuốc đang dùng: ${_fallback(_medicationsController.text, none)}',
        'Số điện thoại khẩn cấp: ${_fallback(_emergencyPhoneController.text, notUpdated)}',
        'Nhà bảo hiểm: ${_fallback(_insuranceProviderController.text, none)}',
        'Số hợp đồng: ${_fallback(_insuranceNumberController.text, none)}',
        'Thông tin này hỗ trợ cho tình huống khẩn cấp.',
      ].join('\n');
    }

    return [
      'SOS MEDICAL INFO CARD',
      'Full name: ${_fallback(_fullNameController.text.toUpperCase(), notUpdated)}',
      'Birth year: ${_fallback(_birthYearController.text, notUpdated)}',
      'Citizen ID: ${_fallback(_citizenIdController.text, notUpdated)}',
      'Permanent address: ${_fallback(_permanentAddressController.text, notUpdated)}',
      'Blood type: $blood',
      'Allergies: ${_fallback(_allergiesController.text, none)}',
      'Conditions: ${_fallback(_conditionsController.text, none)}',
      'Current medications: ${_fallback(_medicationsController.text, none)}',
      'Emergency phone number: ${_fallback(_emergencyPhoneController.text, notUpdated)}',
      'Insurance provider: ${_fallback(_insuranceProviderController.text, none)}',
      'Policy number: ${_fallback(_insuranceNumberController.text, none)}',
      'This information supports emergency assistance.',
    ].join('\n');
  }

  Future<void> _saveMedicalInfo() async {
    final medical = MedicalId(
      fullName: _fullNameController.text.trim(),
      birthYear: _birthYearController.text.trim(),
      citizenId: _citizenIdController.text.trim(),
      permanentAddress: _permanentAddressController.text.trim(),
      bloodType: _normalizedBloodType == 'Chưa cập nhật' ? '' : _normalizedBloodType,
      allergies: _allergiesController.text.trim(),
      conditions: _conditionsController.text.trim(),
      medications: _medicationsController.text.trim(),
      emergencyPhone: _emergencyPhoneController.text.trim(),
      insuranceProvider: _insuranceProviderController.text.trim(),
      insuranceNumber: _insuranceNumberController.text.trim(),
    );

    await context.read<AppProvider>().setMedical(medical);
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          _strings().text('Đã lưu thông tin y tế.', 'Medical information saved.'),
        ),
      ),
    );
    Navigator.pop(context);
  }

  Future<void> _showQrCode() async {
    final strings = _strings();
    final payload = _qrPayload();

    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(strings.text('Mã QR cấp cứu', 'Emergency QR')),
        content: SizedBox(
          width: 280,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  border: Border.all(color: AppColors.border),
                ),
                child: QrImageView(
                  data: payload,
                  size: 220,
                  backgroundColor: Colors.white,
                  version: QrVersions.auto,
                  gapless: false,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                strings.text(
                  'Mã QR này đã được rút gọn để điện thoại quét dễ hơn nhưng vẫn hiển thị đủ thông tin cứu hộ.',
                  'This QR has been shortened to scan more easily while still showing key emergency details.',
                ),
                textAlign: TextAlign.center,
                style: AppTextStyles.body,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text(strings.text('Đóng', 'Close')),
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: AppTextStyles.title.copyWith(fontSize: 19),
    );
  }
}
