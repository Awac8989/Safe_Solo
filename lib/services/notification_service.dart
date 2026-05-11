import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class NotificationService {
  NotificationService._();

  static final NotificationService instance = NotificationService._();

  final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();
  bool _initialized = false;

  static const AndroidNotificationChannel _alertsChannel =
      AndroidNotificationChannel(
        'safesolo_alerts',
        'SafeSolo Alerts',
        description: 'Safety alerts, SOS escalation, and overdue check-ins',
        importance: Importance.max,
      );

  static const AndroidNotificationChannel _remindersChannel =
      AndroidNotificationChannel(
        'safesolo_reminders',
        'SafeSolo Reminders',
        description: 'Daily reminders, medication prompts, and automation events',
        importance: Importance.high,
      );

  Future<void> initialize() async {
    if (_initialized) {
      return;
    }

    try {
      const androidSettings = AndroidInitializationSettings(
        '@mipmap/ic_launcher',
      );
      const settings = InitializationSettings(android: androidSettings);
      await _plugin.initialize(settings: settings);

      final androidImplementation =
          _plugin.resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >();
      await androidImplementation?.createNotificationChannel(_alertsChannel);
      await androidImplementation?.createNotificationChannel(_remindersChannel);
      await androidImplementation?.requestNotificationsPermission();
    } catch (_) {
      if (kDebugMode) {
        debugPrint(
          'NotificationService initialize skipped in current environment.',
        );
      }
    }

    _initialized = true;
  }

  Future<void> showOverdueCheckIn({required bool isVietnamese}) async {
    await _show(
      id: 3101,
      title: isVietnamese ? 'Cần điểm danh' : 'Check-in needed',
      body: isVietnamese
          ? 'Bạn đã quá hạn check-in. Hãy xác nhận an toàn ngay bây giờ.'
          : 'Your check-in is overdue. Please confirm you are safe now.',
      channelId: _alertsChannel.id,
      channelName: _alertsChannel.name,
      channelDescription: _alertsChannel.description ?? '',
    );
  }

  Future<void> showDailyReminder(
    String hhmm, {
    required bool isVietnamese,
  }) async {
    await _show(
      id: 3201,
      title: isVietnamese ? 'Nhắc điểm danh hằng ngày' : 'Daily check-in reminder',
      body: isVietnamese
          ? 'Đã đến giờ $hhmm. Hãy mở SafeSolo và xác nhận bạn vẫn ổn.'
          : 'It is $hhmm. Open SafeSolo and confirm you are okay.',
      channelId: _remindersChannel.id,
      channelName: _remindersChannel.name,
      channelDescription: _remindersChannel.description ?? '',
    );
  }

  Future<void> showMedicationReminder(
    String hhmm, {
    required bool isVietnamese,
  }) async {
    await _show(
      id: 3202,
      title: isVietnamese ? 'Nhắc uống thuốc' : 'Medication reminder',
      body: isVietnamese
          ? 'Đã đến giờ $hhmm. Hãy kiểm tra thuốc và cập nhật trạng thái.'
          : 'It is $hhmm. Please check your medication and update your status.',
      channelId: _remindersChannel.id,
      channelName: _remindersChannel.name,
      channelDescription: _remindersChannel.description ?? '',
    );
  }

  Future<void> showHomeArrivalAutoCheckIn({
    required bool isVietnamese,
  }) async {
    await _show(
      id: 3203,
      title: isVietnamese ? 'Đã về vùng an toàn' : 'Back in your safe zone',
      body: isVietnamese
          ? 'SafeSolo đã phát hiện bạn về gần nhà và gửi check-in tự động.'
          : 'SafeSolo detected that you are back near home and sent an automatic check-in.',
      channelId: _remindersChannel.id,
      channelName: _remindersChannel.name,
      channelDescription: _remindersChannel.description ?? '',
    );
  }

  Future<void> showFallDetected({required bool isVietnamese}) async {
    await _show(
      id: 3204,
      title: isVietnamese ? 'Phát hiện té ngã' : 'Fall detected',
      body: isVietnamese
          ? 'SafeSolo đã ghi nhận va chạm mạnh và đang kích hoạt quy trình an toàn.'
          : 'SafeSolo detected a strong impact and is starting the safety flow.',
      channelId: _alertsChannel.id,
      channelName: _alertsChannel.name,
      channelDescription: _alertsChannel.description ?? '',
    );
  }

  Future<void> showShakeSosTriggered({required bool isVietnamese}) async {
    await _show(
      id: 3205,
      title: isVietnamese
          ? 'Đã kích hoạt SOS bằng lắc máy'
          : 'Shake SOS triggered',
      body: isVietnamese
          ? 'SafeSolo đã gửi tín hiệu SOS khẩn cấp từ cảm biến thiết bị.'
          : 'SafeSolo sent an emergency SOS signal from the device sensor.',
      channelId: _alertsChannel.id,
      channelName: _alertsChannel.name,
      channelDescription: _alertsChannel.description ?? '',
    );
  }

  Future<void> _show({
    required int id,
    required String title,
    required String body,
    required String channelId,
    required String channelName,
    required String channelDescription,
  }) async {
    await initialize();
    try {
      final details = NotificationDetails(
        android: AndroidNotificationDetails(
          channelId,
          channelName,
          channelDescription: channelDescription,
          importance: Importance.max,
          priority: Priority.high,
        ),
      );
      await _plugin.show(
        id: id,
        title: title,
        body: body,
        notificationDetails: details,
      );
    } catch (_) {
      if (kDebugMode) {
        debugPrint('NotificationService show skipped in current environment.');
      }
    }
  }
}
