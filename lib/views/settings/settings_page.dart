import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/providers/app_provider.dart';

class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final appProvider = context.watch<AppProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Cài đặt'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Grace hours setting
          ListTile(
            title: const Text('Thời gian ân hạn'),
            subtitle: Text('${appProvider.graceHours} giờ'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _showGraceHoursDialog(context),
          ),
          const Divider(),
          // High contrast mode
          SwitchListTile(
            title: const Text('Chế độ tương phản cao'),
            value: appProvider.highContrast,
            onChanged: (value) => context.read<AppProvider>().setHighContrast(value),
          ),
          const Divider(),
          // Vacation mode
          ListTile(
            title: const Text('Chế độ nghỉ phép'),
            subtitle: appProvider.isVacation
                ? Text('Kết thúc: ${appProvider.vacationUntil}')
                : const Text('Tắt'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _showVacationDialog(context),
          ),
        ],
      ),
    );
  }

  void _showGraceHoursDialog(BuildContext context) {
    final appProvider = context.read<AppProvider>();
    int selectedHours = appProvider.graceHours;

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Thời gian ân hạn'),
        content: DropdownButtonFormField<int>(
          value: selectedHours,
          items: [12, 24, 48, 72].map((hours) => DropdownMenuItem(
            value: hours,
            child: Text('$hours giờ'),
          )).toList(),
          onChanged: (value) => selectedHours = value ?? 24,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Hủy'),
          ),
          ElevatedButton(
            onPressed: () {
              context.read<AppProvider>().setGraceHours(selectedHours);
              Navigator.pop(context);
            },
            child: const Text('Lưu'),
          ),
        ],
      ),
    );
  }

  void _showVacationDialog(BuildContext context) {
    final appProvider = context.read<AppProvider>();
    int selectedDays = 7;

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Chế độ nghỉ phép'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (appProvider.isVacation) ...[
              const Text('Bạn đang trong chế độ nghỉ phép.'),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () {
                  context.read<AppProvider>().endVacation();
                  Navigator.pop(context);
                },
                style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                child: const Text('Kết thúc nghỉ phép'),
              ),
            ] else ...[
              DropdownButtonFormField<int>(
                value: selectedDays,
                decoration: const InputDecoration(labelText: 'Số ngày nghỉ'),
                items: [1, 3, 7, 14, 30].map((days) => DropdownMenuItem(
                  value: days,
                  child: Text('$days ngày'),
                )).toList(),
                onChanged: (value) => selectedDays = value ?? 7,
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () {
                  context.read<AppProvider>().startVacation(selectedDays);
                  Navigator.pop(context);
                },
                child: const Text('Bắt đầu nghỉ phép'),
              ),
            ],
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Đóng'),
          ),
        ],
      ),
    );
  }
}