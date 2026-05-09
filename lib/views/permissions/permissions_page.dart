import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/providers/app_provider.dart';
import '../../core/widgets/app_shell.dart';

class PermissionsPage extends StatefulWidget {
  const PermissionsPage({super.key});

  @override
  State<PermissionsPage> createState() => _PermissionsPageState();
}

class _PermissionsPageState extends State<PermissionsPage> {
  bool _locationGranted = false;
  bool _notificationGranted = false;
  bool _microphoneGranted = false;
  bool _contactsGranted = false;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _checkPermissions();
  }

  Future<void> _checkPermissions() async {
    final location = await Permission.location.status;
    final notification = await Permission.notification.status;
    final microphone = await Permission.microphone.status;
    final contacts = await Permission.contacts.status;
    if (!mounted) {
      return;
    }
    setState(() {
      _locationGranted = location.isGranted;
      _notificationGranted = notification.isGranted;
      _microphoneGranted = microphone.isGranted;
      _contactsGranted = contacts.isGranted;
    });
  }

  Future<void> _handleContinue() async {
    setState(() => _isLoading = true);

    final location = await Permission.location.request();
    final notification = await Permission.notification.request();
    final microphone = await Permission.microphone.request();
    final contacts = await Permission.contacts.request();

    if (!mounted) {
      return;
    }

    setState(() {
      _locationGranted = location.isGranted;
      _notificationGranted = notification.isGranted;
      _microphoneGranted = microphone.isGranted;
      _contactsGranted = contacts.isGranted;
      _isLoading = false;
    });

    if (!_locationGranted || !_microphoneGranted || !_contactsGranted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'SafeSolo can quyen vi tri, mic va danh ba de hoat dong day du.',
          ),
        ),
      );
      return;
    }

    context.read<AppProvider>().grantPermissions();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AppPage(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 22),
            Text(
              'Cap quyen he thong',
              style: AppTextStyles.h1.copyWith(fontSize: 34),
            ),
            const SizedBox(height: 12),
            Text(
              'De SafeSolo bao ve ban khi can, ung dung can cac quyen sau:',
              style: AppTextStyles.bodyLarge.copyWith(
                color: AppColors.textSecondary,
                height: 1.55,
              ),
            ),
            const SizedBox(height: 28),
            _PermissionCard(
              icon: Icons.location_on_outlined,
              title: 'Vi tri',
              description: 'Gui toa do chinh xac cho guardian va SOS maps.',
              granted: _locationGranted,
            ),
            const SizedBox(height: 16),
            _PermissionCard(
              icon: Icons.mic_none_rounded,
              title: 'Microphone',
              description: 'Thu am voice memo khan cap va push-to-talk.',
              granted: _microphoneGranted,
            ),
            const SizedBox(height: 16),
            _PermissionCard(
              icon: Icons.notifications_active_outlined,
              title: 'Thong bao',
              description: 'Nhan nhac check-in va demo push SOS gan ban.',
              granted: _notificationGranted,
            ),
            const SizedBox(height: 16),
            _PermissionCard(
              icon: Icons.contacts_outlined,
              title: 'Danh ba',
              description: 'Them nhanh guardians va lien he khan cap.',
              granted: _contactsGranted,
            ),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isLoading ? null : _handleContinue,
                child: _isLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      )
                    : const Text('Cho phep tat ca'),
              ),
            ),
            const SizedBox(height: 18),
          ],
        ),
      ),
    );
  }
}

class _PermissionCard extends StatelessWidget {
  const _PermissionCard({
    required this.icon,
    required this.title,
    required this.description,
    required this.granted,
  });

  final IconData icon;
  final String title;
  final String description;
  final bool granted;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: AppColors.primary, size: 24),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: AppTextStyles.title),
                const SizedBox(height: 6),
                Text(
                  description,
                  style: AppTextStyles.body.copyWith(height: 1.55),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Icon(
            granted ? Icons.check_rounded : Icons.add_rounded,
            color: granted ? AppColors.primary : AppColors.textMuted,
            size: 24,
          ),
        ],
      ),
    );
  }
}
