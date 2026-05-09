import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/providers/app_provider.dart';

class MedicalPage extends StatefulWidget {
  const MedicalPage({super.key});

  @override
  State<MedicalPage> createState() => _MedicalPageState();
}

class _MedicalPageState extends State<MedicalPage> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _fullNameController;
  late TextEditingController _birthYearController;
  late TextEditingController _bloodTypeController;
  late TextEditingController _allergiesController;
  late TextEditingController _conditionsController;
  late TextEditingController _medicationsController;
  late TextEditingController _emergencyPhoneController;
  late TextEditingController _insuranceProviderController;
  late TextEditingController _insuranceNumberController;

  @override
  void initState() {
    super.initState();
    final medical = context.read<AppProvider>().medical;
    _fullNameController = TextEditingController(text: medical.fullName);
    _birthYearController = TextEditingController(text: medical.birthYear);
    _bloodTypeController = TextEditingController(text: medical.bloodType);
    _allergiesController = TextEditingController(text: medical.allergies);
    _conditionsController = TextEditingController(text: medical.conditions);
    _medicationsController = TextEditingController(text: medical.medications);
    _emergencyPhoneController = TextEditingController(text: medical.emergencyPhone);
    _insuranceProviderController = TextEditingController(text: medical.insuranceProvider);
    _insuranceNumberController = TextEditingController(text: medical.insuranceNumber);
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _birthYearController.dispose();
    _bloodTypeController.dispose();
    _allergiesController.dispose();
    _conditionsController.dispose();
    _medicationsController.dispose();
    _emergencyPhoneController.dispose();
    _insuranceProviderController.dispose();
    _insuranceNumberController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Thong tin y te'),
        actions: [
          TextButton(
            onPressed: _showQrCode,
            child: const Text('Tao QR'),
          ),
          TextButton(
            onPressed: _saveMedicalInfo,
            child: const Text('Luu'),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Thong tin nay duoc dung khi co tinh huong khan cap.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Colors.grey.shade600,
              ),
            ),
            const SizedBox(height: 24),
            TextFormField(
              controller: _fullNameController,
              decoration: const InputDecoration(
                labelText: 'Ho va ten',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _birthYearController,
              decoration: const InputDecoration(
                labelText: 'Nam sinh',
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              initialValue: _bloodTypeController.text.isEmpty ? 'O+' : _bloodTypeController.text,
              decoration: const InputDecoration(
                labelText: 'Nhom mau',
                border: OutlineInputBorder(),
              ),
              items: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
                  .map((type) => DropdownMenuItem(value: type, child: Text(type)))
                  .toList(),
              onChanged: (value) => _bloodTypeController.text = value ?? 'O+',
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _allergiesController,
              decoration: const InputDecoration(
                labelText: 'Di ung',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _conditionsController,
              decoration: const InputDecoration(
                labelText: 'Benh nen',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _medicationsController,
              decoration: const InputDecoration(
                labelText: 'Thuoc dang dung',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _emergencyPhoneController,
              decoration: const InputDecoration(
                labelText: 'So dien thoai khan cap',
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.phone,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _insuranceProviderController,
              decoration: const InputDecoration(
                labelText: 'Nha bao hiem',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _insuranceNumberController,
              decoration: const InputDecoration(
                labelText: 'So hop dong bao hiem',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _saveMedicalInfo() async {
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    final medical = MedicalId(
      fullName: _fullNameController.text.trim(),
      birthYear: _birthYearController.text.trim(),
      bloodType: _bloodTypeController.text.trim(),
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
      const SnackBar(content: Text('Da luu thong tin y te')),
    );
    Navigator.pop(context);
  }

  Future<void> _showQrCode() async {
    final payload = {
      'fullName': _fullNameController.text.trim(),
      'bloodType': _bloodTypeController.text.trim(),
      'allergies': _allergiesController.text.trim(),
      'conditions': _conditionsController.text.trim(),
      'medications': _medicationsController.text.trim(),
      'emergencyPhone': _emergencyPhoneController.text.trim(),
    };

    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('QR cap cuu'),
        content: SizedBox(
          width: 260,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              QrImageView(
                data: payload.toString(),
                size: 220,
                backgroundColor: Colors.white,
              ),
              const SizedBox(height: 12),
              const Text(
                'Dung QR nay de truyen nhanh thong tin y te khi cap cuu.',
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Dong'),
          ),
        ],
      ),
    );
  }
}
