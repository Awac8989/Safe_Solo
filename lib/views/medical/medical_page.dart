import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

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
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Thông tin y tế'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          TextButton(
            onPressed: _saveMedicalInfo,
            child: const Text('Lưu', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Thông tin này sẽ được chia sẻ khi có sự cố khẩn cấp',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.grey.shade600,
                  ),
            ),
            const SizedBox(height: 24),
            TextFormField(
              controller: _fullNameController,
              decoration: const InputDecoration(
                labelText: 'Họ và tên',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _birthYearController,
              decoration: const InputDecoration(
                labelText: 'Năm sinh',
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _bloodTypeController.text.isEmpty ? 'O+' : _bloodTypeController.text,
              decoration: const InputDecoration(
                labelText: 'Nhóm máu',
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
                labelText: 'Dị ứng',
                border: OutlineInputBorder(),
                hintText: 'Ví dụ: Penicillin, hải sản...',
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _conditionsController,
              decoration: const InputDecoration(
                labelText: 'Bệnh lý nền',
                border: OutlineInputBorder(),
                hintText: 'Ví dụ: Tiểu đường, cao huyết áp...',
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _medicationsController,
              decoration: const InputDecoration(
                labelText: 'Thuốc đang dùng',
                border: OutlineInputBorder(),
                hintText: 'Ví dụ: Insulin, huyết áp...',
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _emergencyPhoneController,
              decoration: const InputDecoration(
                labelText: 'Số điện thoại khẩn cấp',
                border: OutlineInputBorder(),
                hintText: 'Số điện thoại người thân',
              ),
              keyboardType: TextInputType.phone,
            ),
          ],
        ),
      ),
    );
  }

  void _saveMedicalInfo() {
    if (_formKey.currentState?.validate() ?? false) {
      final medical = MedicalId(
        fullName: _fullNameController.text.trim(),
        birthYear: _birthYearController.text.trim(),
        bloodType: _bloodTypeController.text.trim(),
        allergies: _allergiesController.text.trim(),
        conditions: _conditionsController.text.trim(),
        medications: _medicationsController.text.trim(),
        emergencyPhone: _emergencyPhoneController.text.trim(),
      );

      context.read<AppProvider>().setMedical(medical);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đã lưu thông tin y tế')),
      );
      Navigator.pop(context);
    }
  }
}