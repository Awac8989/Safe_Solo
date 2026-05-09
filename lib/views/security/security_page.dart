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
        title: const Text('Bao mat'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          TextButton(
            onPressed: _saveSecuritySettings,
            child: const Text('Luu', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Cai dat bao mat nang cao',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Text(
            'Luu y: duress PIN co the duoc dung de mo app trong tinh huong bi ep buoc.',
            style: TextStyle(color: Colors.grey.shade600),
          ),
          const SizedBox(height: 24),
          TextFormField(
            controller: _realPinController,
            decoration: const InputDecoration(
              labelText: 'PIN chinh',
              border: OutlineInputBorder(),
              hintText: 'PIN de mo thong tin that',
            ),
            obscureText: true,
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _duressPinController,
            decoration: const InputDecoration(
              labelText: 'Duress PIN',
              border: OutlineInputBorder(),
              hintText: 'PIN gia khi can che do danh lac huong',
            ),
            obscureText: true,
          ),
          const SizedBox(height: 16),
          SwitchListTile(
            title: const Text('Stealth mode'),
            subtitle: const Text('Rut gon giao dien khi mo app tu nhanh'),
            value: _stealthMode,
            onChanged: (value) => setState(() => _stealthMode = value),
          ),
          const Divider(),
          ListTile(
            title: const Text('Auto wipe'),
            subtitle: Text(
              _autoWipeDays == 0 ? 'Khong bao gio' : 'Sau $_autoWipeDays ngay',
            ),
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
                      'Ghi chu',
                      style: TextStyle(
                        color: Colors.blue.shade700,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'Stealth mode chi doi giao dien hien tai. Neu muon an hoan toan icon app, can can thiep them o muc native Android.',
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
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Auto wipe'),
        content: DropdownButtonFormField<int>(
          initialValue: _autoWipeDays,
          items: [0, 7, 30, 90, 365]
              .map(
                (days) => DropdownMenuItem(
                  value: days,
                  child: Text(days == 0 ? 'Khong bao gio' : '$days ngay'),
                ),
              )
              .toList(),
          onChanged: (value) => setState(() => _autoWipeDays = value ?? 0),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Huy'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  Future<void> _saveSecuritySettings() async {
    final security = Security(
      realPin: _realPinController.text.trim(),
      duressPin: _duressPinController.text.trim(),
      stealthMode: _stealthMode,
      autoWipeDays: _autoWipeDays,
    );

    await context.read<AppProvider>().setSecurity(security);
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Da luu cai dat bao mat')));
    Navigator.pop(context);
  }
}
