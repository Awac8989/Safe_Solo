import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/services/notification_center_service.dart';
import 'package:safesolo/views/notifications/notification_center_page.dart';

void main() {
  setUp(() {
    NotificationCenterService.instance.clearAll();
  });

  group('NotificationCenterService Unit Tests', () {
    test('adds notification and increments unread count', () {
      final service = NotificationCenterService.instance;
      expect(service.unreadCount, 0);
      expect(service.notifications, isEmpty);

      service.addNotification(
        title: 'Cảnh báo SOS',
        body: 'Phát hiện tín hiệu khẩn cấp gần bạn',
        type: 'SOS',
      );

      expect(service.unreadCount, 1);
      expect(service.notifications.length, 1);
      expect(service.notifications.first.title, 'Cảnh báo SOS');
      expect(service.notifications.first.type, 'SOS');
      expect(service.notifications.first.isRead, false);
    });

    test('marks individual notification as read', () {
      final service = NotificationCenterService.instance;
      service.addNotification(
        title: 'Nhắc nhở điểm danh',
        body: 'Đã đến giờ check-in an toàn',
        type: 'CHECKIN',
      );

      final notifId = service.notifications.first.id;
      expect(service.unreadCount, 1);

      service.markAsRead(notifId);
      expect(service.unreadCount, 0);
      expect(service.notifications.first.isRead, true);
    });

    test('marks all notifications as read', () {
      final service = NotificationCenterService.instance;
      service.addNotification(
        title: 'Notif 1',
        body: 'Body 1',
        type: 'SYSTEM',
      );
      service.addNotification(
        title: 'Notif 2',
        body: 'Body 2',
        type: 'GUARDIAN',
      );

      expect(service.unreadCount, 2);

      service.markAllAsRead();
      expect(service.unreadCount, 0);
      expect(service.notifications.every((n) => n.isRead), isTrue);
    });

    test('filters notifications by type correctly', () {
      final service = NotificationCenterService.instance;
      service.addNotification(title: 'SOS 1', body: 'b', type: 'SOS');
      service.addNotification(title: 'Checkin 1', body: 'b', type: 'CHECKIN');
      service.addNotification(title: 'Checkin 2', body: 'b', type: 'CHECKIN');
      service.addNotification(title: 'Sys 1', body: 'b', type: 'SYSTEM');

      expect(service.filterByType('SOS').length, 1);
      expect(service.filterByType('CHECKIN').length, 2);
      expect(service.filterByType('SYSTEM').length, 1);
      expect(service.filterByType('GUARDIAN').length, 0);
    });

    test('deletes notification correctly', () {
      final service = NotificationCenterService.instance;
      service.addNotification(title: 'Item to delete', body: 'b', type: 'SYSTEM');
      final id = service.notifications.first.id;

      service.deleteNotification(id);
      expect(service.notifications, isEmpty);
      expect(service.unreadCount, 0);
    });
  });

  group('NotificationCenterPage Widget Tests', () {
    testWidgets('renders NotificationCenterPage with empty state', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      final appProvider = AppProvider();

      await tester.pumpWidget(
        ChangeNotifierProvider<AppProvider>.value(
          value: appProvider,
          child: const MaterialApp(
            home: NotificationCenterPage(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Thông báo'), findsOneWidget);
      expect(find.text('Không có thông báo nào'), findsOneWidget);
      expect(find.text('Tất cả'), findsOneWidget);
      expect(find.text('Khẩn cấp'), findsOneWidget);
    });

    testWidgets('displays notifications and filters by tab', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      final service = NotificationCenterService.instance;
      service.addNotification(
        title: 'Cảnh báo té ngã',
        body: 'Đồng hồ phát hiện va chạm mạnh',
        type: 'SOS',
      );
      service.addNotification(
        title: 'Nhắc nhở điểm danh',
        body: 'Bạn còn 15 phút để điểm danh',
        type: 'CHECKIN',
      );

      final appProvider = AppProvider();

      await tester.pumpWidget(
        ChangeNotifierProvider<AppProvider>.value(
          value: appProvider,
          child: const MaterialApp(
            home: NotificationCenterPage(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Cảnh báo té ngã'), findsOneWidget);
      expect(find.text('Nhắc nhở điểm danh'), findsOneWidget);

      // Tap on "Khẩn cấp" filter chip
      await tester.tap(find.text('Khẩn cấp'));
      await tester.pumpAndSettle();

      expect(find.text('Cảnh báo té ngã'), findsOneWidget);
      expect(find.text('Nhắc nhở điểm danh'), findsNothing);
    });
  });
}
