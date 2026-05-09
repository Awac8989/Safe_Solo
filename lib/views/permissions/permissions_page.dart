import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';

import '../../core/app_strings.dart';
import '../../core/app_theme.dart';
import '../../core/providers/app_provider.dart';
import '../../core/widgets/app_shell.dart';

class PermissionsPage extends StatefulWidget {
  const PermissionsPage({super.key});

  @override
  State<PermissionsPage> createState() => _PermissionsPageState();
}

class _PermissionsPageState extends State<PermissionsPage> {
  late final AppLifecycleListener _lifecycleListener;
  bool _locationGranted = false;
  bool _notificationGranted = false;
  bool _microphoneGranted = false;
  bool _contactsGranted = false;
  bool _hasPermanentlyDeniedPermission = false;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _lifecycleListener = AppLifecycleListener(
      onResume: _checkPermissions,
    );
    _checkPermissions();
  }

  @override
  void dispose() {
    _lifecycleListener.dispose();
    super.dispose();
  }

  Future<void> _checkPermissions() async {
    final statuses = await _readStatuses();
    if (!mounted) {
      return;
    }
    setState(() {
      _applyStatuses(statuses);
    });
  }

  Future<Map<Permission, PermissionStatus>> _readStatuses() async {
    return {
      Permission.location: await Permission.location.status,
      Permission.notification: await Permission.notification.status,
      Permission.microphone: await Permission.microphone.status,
      Permission.contacts: await Permission.contacts.status,
    };
  }

  void _applyStatuses(Map<Permission, PermissionStatus> statuses) {
    _locationGranted = statuses[Permission.location]?.isGranted ?? false;
    _notificationGranted = statuses[Permission.notification]?.isGranted ?? false;
    _microphoneGranted = statuses[Permission.microphone]?.isGranted ?? false;
    _contactsGranted = statuses[Permission.contacts]?.isGranted ?? false;
    _hasPermanentlyDeniedPermission = statuses.values.any(
      (status) => status.isPermanentlyDenied,
    );
  }

  AppStrings _stringsSnapshot() {
    final language = context.read<AppProvider>().language;
    return AppStrings(language);
  }

  Future<void> _requestSinglePermission(Permission permission) async {
    final strings = _stringsSnapshot();
    final currentStatus = await permission.status;

    if (currentStatus.isPermanentlyDenied) {
      if (!mounted) {
        return;
      }
      setState(() => _hasPermanentlyDeniedPermission = true);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            strings.text(
              'Quyền này đã bị từ chối vĩnh viễn. Hãy mở cài đặt ứng dụng để bật lại.',
              'This permission was permanently denied. Open app settings to enable it again.',
            ),
          ),
          action: SnackBarAction(
            label: strings.text('Mở cài đặt', 'Open settings'),
            onPressed: openAppSettings,
          ),
        ),
      );
      return;
    }

    final result = await permission.request();
    if (!mounted) {
      return;
    }

    await _checkPermissions();
    if (!mounted) {
      return;
    }

    if (!result.isGranted && result.isPermanentlyDenied) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            strings.text(
              'Android đã chặn hộp thoại xin quyền. Hãy mở cài đặt ứng dụng để cấp quyền thủ công.',
              'Android blocked the permission dialog. Open app settings to grant it manually.',
            ),
          ),
          action: SnackBarAction(
            label: strings.text('Mở cài đặt', 'Open settings'),
            onPressed: openAppSettings,
          ),
        ),
      );
    }

    await _completeIfReady();
  }

  Future<void> _handleContinue() async {
    final strings = _stringsSnapshot();
    setState(() => _isLoading = true);

    final results = await [
      if (!_locationGranted) Permission.location,
      if (!_notificationGranted) Permission.notification,
      if (!_microphoneGranted) Permission.microphone,
      if (!_contactsGranted) Permission.contacts,
    ].request();

    if (!mounted) {
      return;
    }

    final statuses = await _readStatuses();
    if (!mounted) {
      return;
    }
    setState(() {
      _applyStatuses({...statuses, ...results});
      _isLoading = false;
    });

    if (!_locationGranted || !_microphoneGranted || !_contactsGranted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            strings.text(
              'SafeSolo cần quyền vị trí, micro và danh bạ để hoạt động đầy đủ.',
              'SafeSolo needs location, microphone, and contacts permissions to work fully.',
            ),
          ),
          action: _hasPermanentlyDeniedPermission
              ? SnackBarAction(
                  label: strings.text('Mở cài đặt', 'Open settings'),
                  onPressed: openAppSettings,
                )
              : null,
        ),
      );
      return;
    }

    await _completeIfReady();
  }

  Future<void> _completeIfReady() async {
    if (_locationGranted && _microphoneGranted && _contactsGranted) {
      if (!mounted) {
        return;
      }
      await context.read<AppProvider>().grantPermissions();
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);

    return Scaffold(
      body: AppPage(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 22),
            Text(
              strings.text('Cấp quyền hệ thống', 'Grant system permissions'),
              style: AppTextStyles.h1.copyWith(fontSize: 34),
            ),
            const SizedBox(height: 12),
            Text(
              strings.text(
                'Để SafeSolo bảo vệ bạn khi cần, ứng dụng cần các quyền sau:',
                'For SafeSolo to protect you when needed, it requires these permissions:',
              ),
              style: AppTextStyles.bodyLarge.copyWith(
                color: AppColors.textSecondary,
                height: 1.55,
              ),
            ),
            const SizedBox(height: 28),
            _PermissionCard(
              icon: Icons.location_on_outlined,
              title: strings.text('Vị trí', 'Location'),
              description: strings.text(
                'Gửi tọa độ chính xác cho người bảo hộ và bản đồ SOS.',
                'Share precise coordinates with guardians and SOS maps.',
              ),
              granted: _locationGranted,
              onTap: () => _requestSinglePermission(Permission.location),
            ),
            const SizedBox(height: 16),
            _PermissionCard(
              icon: Icons.mic_none_rounded,
              title: strings.text('Micro', 'Microphone'),
              description: strings.text(
                'Thu âm ghi chú khẩn cấp và push-to-talk.',
                'Record emergency voice notes and push-to-talk audio.',
              ),
              granted: _microphoneGranted,
              onTap: () => _requestSinglePermission(Permission.microphone),
            ),
            const SizedBox(height: 16),
            _PermissionCard(
              icon: Icons.notifications_active_outlined,
              title: strings.text('Thông báo', 'Notifications'),
              description: strings.text(
                'Nhận nhắc check-in và thông báo SOS gần bạn.',
                'Receive check-in reminders and nearby SOS alerts.',
              ),
              granted: _notificationGranted,
              onTap: () => _requestSinglePermission(Permission.notification),
            ),
            const SizedBox(height: 16),
            _PermissionCard(
              icon: Icons.contacts_outlined,
              title: strings.text('Danh bạ', 'Contacts'),
              description: strings.text(
                'Thêm nhanh người bảo hộ và liên hệ khẩn cấp.',
                'Quickly add guardians and emergency contacts.',
              ),
              granted: _contactsGranted,
              onTap: () => _requestSinglePermission(Permission.contacts),
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
                    : Text(strings.text('Cho phép tất cả', 'Allow all')),
              ),
            ),
            if (_hasPermanentlyDeniedPermission) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: openAppSettings,
                  child: Text(strings.text('Mở cài đặt ứng dụng', 'Open app settings')),
                ),
              ),
            ],
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
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String description;
  final bool granted;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.xl),
        child: AppCard(
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
              Column(
                children: [
                  Icon(
                    granted ? Icons.check_rounded : Icons.add_rounded,
                    color: granted ? AppColors.primary : AppColors.textMuted,
                    size: 24,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    granted ? 'OK' : 'Cấp',
                    style: AppTextStyles.caption.copyWith(
                      color: granted ? AppColors.primary : AppColors.textMuted,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
