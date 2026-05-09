import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/constants.dart';
import '../../core/widgets/main_navigation.dart';
import '../../services/api_service.dart';

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _contactNameController = TextEditingController();
  final _contactPhoneController = TextEditingController();
  final _api = ApiService();

  int _timer = 720;
  bool _loading = false;
  final List<int> _timerOptions = const [180, 360, 720, 1440];

  @override
  void initState() {
    super.initState();
    _autoNavigateIfRegistered();
  }

  Future<void> _autoNavigateIfRegistered() async {
    final prefs = await SharedPreferences.getInstance();
    final savedUserId = prefs.getString(AppConstants.userIdStorageKey);
    if (!mounted || savedUserId == null || savedUserId.isEmpty) {
      return;
    }
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const MainNavigation()),
    );
  }

  Future<void> _register() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _loading = true);
    try {
      final user = await _api.registerUser(
        fullName: _nameController.text.trim(),
        phoneNumber: _phoneController.text.trim(),
        timerIntervalMinutes: _timer,
        emergencyName: _contactNameController.text.trim(),
        emergencyPhone: _contactPhoneController.text.trim(),
      );

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(AppConstants.userIdStorageKey, user.id);

      if (!mounted) {
        return;
      }
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const MainNavigation()),
      );
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Dang ky that bai: $error')));
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _contactNameController.dispose();
    _contactPhoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: SafeArea(
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [colorScheme.primaryContainer, Colors.white],
            ),
          ),
          child: Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const SizedBox(height: 8),
                Text(
                  'SafeSolo',
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Dang ky nhanh de bat dau che do giam sat an toan',
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const SizedBox(height: 18),
                Card(
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                    side: BorderSide(color: colorScheme.outlineVariant),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        TextFormField(
                          controller: _nameController,
                          textInputAction: TextInputAction.next,
                          decoration: const InputDecoration(
                            labelText: 'Ho va ten',
                            prefixIcon: Icon(Icons.person_outline),
                          ),
                          validator: (value) =>
                              value == null || value.trim().isEmpty
                              ? 'Nhap ho ten'
                              : null,
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _phoneController,
                          textInputAction: TextInputAction.next,
                          keyboardType: TextInputType.phone,
                          decoration: const InputDecoration(
                            labelText: 'So dien thoai',
                            prefixIcon: Icon(Icons.phone_outlined),
                          ),
                          validator: (value) =>
                              value == null || value.trim().isEmpty
                              ? 'Nhap so dien thoai'
                              : null,
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _contactNameController,
                          textInputAction: TextInputAction.next,
                          decoration: const InputDecoration(
                            labelText: 'Ten nguoi than',
                            prefixIcon: Icon(Icons.family_restroom_outlined),
                          ),
                          validator: (value) =>
                              value == null || value.trim().isEmpty
                              ? 'Nhap ten nguoi than'
                              : null,
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _contactPhoneController,
                          keyboardType: TextInputType.phone,
                          decoration: const InputDecoration(
                            labelText: 'SĐT nguoi than',
                            prefixIcon: Icon(Icons.contact_phone_outlined),
                          ),
                          validator: (value) =>
                              value == null || value.trim().isEmpty
                              ? 'Nhap sdt nguoi than'
                              : null,
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  'Chu ky check-in',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _timerOptions
                      .map(
                        (minute) => ChoiceChip(
                          label: Text('${minute ~/ 60} gio'),
                          selected: _timer == minute,
                          onSelected: (_) => setState(() => _timer = minute),
                        ),
                      )
                      .toList(),
                ),
                const SizedBox(height: 24),
                FilledButton.icon(
                  onPressed: _loading ? null : _register,
                  icon: _loading
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.verified_user_outlined),
                  label: Text(
                    _loading ? 'Dang xu ly...' : 'Dang ky va bat dau',
                  ),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(double.infinity, 54),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Muc tieu: canh bao khan cap khi ban bo lo check-in.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
