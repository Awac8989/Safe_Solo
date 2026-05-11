import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_strings.dart';
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

  AppStrings _strings(BuildContext context) =>
      AppStrings(context.read<AppProvider>().language);

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
    final strings = _strings(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(strings.text('Bảo mật', 'Security')),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          TextButton(
            onPressed: _saveSecuritySettings,
            child: Text(
              strings.text('Lưu', 'Save'),
              style: const TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            strings.text('Cài đặt bảo mật nâng cao', 'Advanced security settings'),
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Text(
            strings.text(
              'Lưu ý: PIN giả có thể dùng để mở app trong tình huống bị ép buộc.',
              'Note: the duress PIN can be used to open the app in coercive situations.',
            ),
            style: TextStyle(color: Colors.grey.shade600),
          ),
          const SizedBox(height: 24),
          TextFormField(
            controller: _realPinController,
            decoration: InputDecoration(
              labelText: strings.text('PIN thật', 'Real PIN'),
              border: const OutlineInputBorder(),
              hintText: strings.text(
                'PIN để mở thông tin thật',
                'PIN to open the real SafeSolo app',
              ),
            ),
            obscureText: true,
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _duressPinController,
            decoration: InputDecoration(
              labelText: strings.text('PIN giả', 'Duress PIN'),
              border: const OutlineInputBorder(),
              hintText: strings.text(
                'PIN giả để kích hoạt chế độ ngụy trang',
                'Fallback PIN to trigger the covert safety flow',
              ),
            ),
            obscureText: true,
          ),
          const SizedBox(height: 16),
          SwitchListTile(
            title: Text(strings.text('Chế độ ẩn danh', 'Stealth mode')),
            subtitle: Text(
              strings.text(
                'Rút gọn giao diện khi mở app từ màn hình nguỵ trang.',
                'Keeps the disguised calculator flow when opening the app.',
              ),
            ),
            value: _stealthMode,
            onChanged: (value) => setState(() => _stealthMode = value),
          ),
          const Divider(),
          ListTile(
            title: Text(strings.text('Tự huỷ dữ liệu', 'Auto wipe')),
            subtitle: Text(
              _autoWipeDays == 0
                  ? strings.text('Không bao giờ', 'Never')
                  : strings.text('Sau $_autoWipeDays ngày', 'After $_autoWipeDays days'),
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
                      strings.text('Ghi chú', 'Note'),
                      style: TextStyle(
                        color: Colors.blue.shade700,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  strings.text(
                    'Chế độ ẩn danh chỉ đổi giao diện hiện tại. Nếu muốn ẩn hoàn toàn biểu tượng app, cần can thiệp thêm ở mức native Android.',
                    'Stealth mode only changes the current interface. Fully hiding the app icon still requires extra native Android work.',
                  ),
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
    final strings = _strings(context);
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(strings.text('Tự huỷ dữ liệu', 'Auto wipe')),
        content: DropdownButtonFormField<int>(
          initialValue: _autoWipeDays,
          items: [0, 7, 30, 90, 365]
              .map(
                (days) => DropdownMenuItem(
                  value: days,
                  child: Text(
                    days == 0
                        ? strings.text('Không bao giờ', 'Never')
                        : strings.text('$days ngày', '$days days'),
                  ),
                ),
              )
              .toList(),
          onChanged: (value) => setState(() => _autoWipeDays = value ?? 0),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text(strings.text('Hủy', 'Cancel')),
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
    final strings = _strings(context);
    final security = Security(
      realPin: _realPinController.text.trim(),
      duressPin: _duressPinController.text.trim(),
      stealthMode: _stealthMode,
      autoWipeDays: _autoWipeDays,
      encryptionEnabled: context.read<AppProvider>().security.encryptionEnabled,
    );

    await context.read<AppProvider>().setSecurity(security);
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          strings.text(
            'Đã lưu cài đặt bảo mật',
            'Security settings saved',
          ),
        ),
      ),
    );
    Navigator.pop(context);
  }
}
