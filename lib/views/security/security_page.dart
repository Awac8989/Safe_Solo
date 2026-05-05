import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/providers/app_provider.dart';

class SecurityPage extends StatefulWidget {
  const SecurityPage({super.key});

  @override
  State<SecurityPage> createState() => _SecurityPageState();
}

class _SecurityPageState extends State<SecurityPage> {
  final _realPinController = TextEditingController();
  final _duressPinController = TextEditingController();
  bool _stealthMode = false;
  int _autoWipeDays = 0;

  @override
  void initState() {
    super.initState();
    final security = context.read<AppProvider>().security;
    _realPinController.text = security.realPin;
    _duressPinController.text = security.duressPin;
    _stealthMode = security.stealthMode;
    _autoWipeDays = security.autoWipeDays;
  }

  @override
  void dispose() {
    _realPinController.dispose();
    _duressPinController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bảo mật'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          TextButton(
            onPressed: _saveSecuritySettings,
            child: const Text('Lưu', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Cài đặt bảo mật nâng cao',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Text(
            'Những cài đặt này giúp bảo vệ thông tin cá nhân của bạn',
            style: TextStyle(color: Colors.grey.shade600),
          ),
          const SizedBox(height: 24),

          // Real PIN
          TextFormField(
            controller: _realPinController,
            decoration: const InputDecoration(
              labelText: 'Mật khẩu thật',
              border: OutlineInputBorder(),
              hintText: 'Mật khẩu để mở khóa thông tin',
            ),
            obscureText: true,
          ),
          const SizedBox(height: 16),

          // Duress PIN
          TextFormField(
            controller: _duressPinController,
            decoration: const InputDecoration(
              labelText: 'Mật khẩu duress',
              border: OutlineInputBorder(),
              hintText: 'Mật khẩu giả khi bị ép buộc',
            ),
            obscureText: true,
          ),
          const SizedBox(height: 16),

          // Stealth mode
          SwitchListTile(
            title: const Text('Chế độ ẩn danh'),
            subtitle: const Text('Ẩn ứng dụng khỏi danh sách ứng dụng'),
            value: _stealthMode,
            onChanged: (value) => setState(() => _stealthMode = value),
          ),
          const Divider(),

          // Auto wipe
          ListTile(
            title: const Text('Tự động xóa dữ liệu'),
            subtitle: Text(_autoWipeDays == 0 ? 'Không bao giờ' : 'Sau $_autoWipeDays ngày'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _showAutoWipeDialog(context),
          ),

          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.blue.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.blue.shade200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.info, color: Colors.blue.shade700),
                    const SizedBox(width: 8),
                    Text(
                      'Lưu ý bảo mật',
                      style: TextStyle(
                        color: Colors.blue.shade700,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  '• Mật khẩu duress sẽ hiển thị thông tin giả\n'
                  '• Chế độ ẩn danh giúp bảo vệ quyền riêng tư\n'
                  '• Tự động xóa dữ liệu sau thời gian không hoạt động',
                  style: TextStyle(color: Colors.blue.shade700),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showAutoWipeDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Tự động xóa dữ liệu'),
        content: DropdownButtonFormField<int>(
          value: _autoWipeDays,
          items: [0, 7, 30, 90, 365].map((days) => DropdownMenuItem(
            value: days,
            child: Text(days == 0 ? 'Không bao giờ' : '$days ngày'),
          )).toList(),
          onChanged: (value) => setState(() => _autoWipeDays = value ?? 0),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Hủy'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  void _saveSecuritySettings() {
    final security = Security(
      realPin: _realPinController.text.trim(),
      duressPin: _duressPinController.text.trim(),
      stealthMode: _stealthMode,
      autoWipeDays: _autoWipeDays,
    );

    context.read<AppProvider>().setSecurity(security);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Đã lưu cài đặt bảo mật')),
    );
    Navigator.pop(context);
  }
}