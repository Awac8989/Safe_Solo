import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/models/watch_protocol.dart';
import 'package:safesolo/services/pedometer_service.dart';
import 'package:safesolo/services/wear_os_service.dart';
import 'package:safesolo/services/watch_sync_manager.dart';
import 'package:safesolo/views/home/home_page.dart';
import 'package:safesolo/views/wear_os/wear_os_watch_page.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Watch Connection & Real-time Sync Tests', () {
    setUp(() {
      WatchSyncManager.instance.stopPeriodicChecks();
      WatchSyncManager.instance.unpairDevice();
      WearOsService.instance.setPaired(false);
      PedometerService.instance.setPaired(false);
    });

    tearDown(() {
      WatchSyncManager.instance.stopPeriodicChecks();
    });

    test('Initial state is unpaired and disconnected', () {
      expect(WatchSyncManager.instance.isPaired, false);
      expect(WearOsService.instance.isPaired, false);
      expect(PedometerService.instance.isPaired, false);
    });

    testWidgets('Home page hides vitals and shows Add Watch button when disconnected',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        ChangeNotifierProvider(
          create: (_) => AppProvider(),
          child: const MaterialApp(
            home: HomePage(),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // Thẻ chưa kết nối phải hiển thị
      expect(find.text('Chưa kết nối đồng hồ thông minh'), findsOneWidget);
      expect(find.text('Thêm'), findsOneWidget);

      // Tuyệt đối KHÔNG hiển thị các số liệu sinh tồn tĩnh khi chưa kết nối
      expect(find.text('BPM'), findsNothing);
      expect(find.text('SpO2'), findsNothing);
      expect(find.text('PIN'), findsNothing);

      // Dispose widget and timers cleanly
      await tester.pumpWidget(const SizedBox());
      await tester.pump();
    });

    test('Quick pair connects watch and updates state to paired', () async {
      final sync = WatchSyncManager.instance;
      expect(sync.isPaired, false);

      final ok = await sync.quickPairDevice(userId: 'test_user_123');
      expect(ok, true);
      expect(sync.isPaired, true);
      expect(WearOsService.instance.isPaired, true);
      expect(PedometerService.instance.isPaired, true);

      // Hủy kết nối
      await sync.unpairDevice();
      sync.stopPeriodicChecks();
      expect(sync.isPaired, false);
      expect(WearOsService.instance.isPaired, false);
      expect(PedometerService.instance.isPaired, false);
    });

    testWidgets('WearOsWatchPage renders dynamic vitals and checkin screen properly',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(320, 320);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        ChangeNotifierProvider(
          create: (_) => AppProvider(),
          child: const MaterialApp(
            home: WearOsWatchPage(),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // WatchFace ban đầu trên Native Watch Layout
      expect(find.text('TÔI\nAN TOÀN'), findsOneWidget);

      // Dispose widget cleanly
      await tester.pumpWidget(const SizedBox());
      await tester.pump();
    });

    test('WatchProtocol parses TOC sender and bi-directional ACK actions', () {
      final raw = WatchPacket(
        messageId: 'toc_123',
        timestamp: DateTime.now(),
        sender: WatchSender.toc,
        type: WatchPacketType.command,
        action: WatchAction.tocDispatchAck,
        payload: {'ambulanceUnit': 'Xe 115 BV Chợ Rẫy', 'deviceId': 'watch_galaxy_5'},
      ).serialize();

      final decoded = WatchPacket.deserialize(raw);
      expect(decoded, isNotNull);
      expect(decoded!.sender, WatchSender.toc);
      expect(decoded.action, WatchAction.tocDispatchAck);
      expect(decoded.payload['ambulanceUnit'], 'Xe 115 BV Chợ Rẫy');
    });

    testWidgets('WearOsWatchPage reacts to Web Admin TOC dispatch ACK packet', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(396, 396);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final sync = WatchSyncManager.instance;
      sync.setActiveUserId('usr-safesolo-01');
      expect(sync.pairedUserId, 'usr-safesolo-01');

      await tester.pumpWidget(
        ChangeNotifierProvider(
          create: (_) => AppProvider(),
          child: const MaterialApp(
            home: WearOsWatchPage(),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));

      await sync.sendPacket(
        WatchPacket.create(
          sender: WatchSender.toc,
          type: WatchPacketType.command,
          action: WatchAction.tocDispatchAck,
          payload: {'ambulanceUnit': 'Kíp 115 TDMU'},
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));

      expect(find.textContaining('CỨU HỘ ĐANG TỚI'), findsOneWidget);

      await tester.pumpWidget(const SizedBox());
      await tester.pump();
    });

    test('1-to-1 Watch binding resets phone pairing when switching to another account', () async {
      final sync = WatchSyncManager.instance;
      sync.setIsRunningOnWatch(false);
      await sync.quickPairDevice(userId: 'victim_account_01', deviceId: 'watch_r900_001122');
      expect(sync.isPaired, true);
      expect(sync.pairedUserId, 'victim_account_01');
      expect(sync.deviceId, 'watch_r900_001122');

      // Chuyển sang tài khoản Hiệp sĩ khác -> điện thoại tự hủy ghép 1-1 của tài khoản cũ
      sync.setActiveUserId('hero_account_99');
      expect(sync.isPaired, false);
      expect(WearOsService.instance.isPaired, false);
      expect(sync.pairedUserId, 'hero_account_99');
    });

    test('configureHardwareIdentity sets unique Watch SM-R900 identity and ignores placeholder userId', () {
      final sync = WatchSyncManager.instance;
      sync.configureHardwareIdentity(
        deviceId: 'watch_r900_a1b2c3',
        deviceModel: 'Samsung Galaxy Watch 5 (SM-R900)',
        isWatch: true,
      );
      expect(sync.isRunningOnWatch, true);
      expect(sync.deviceId, 'watch_r900_a1b2c3');

      sync.setActiveUserId('real_victim_id_01');
      expect(sync.pairedUserId, 'real_victim_id_01');
      // Placeholder sandbox_user không bao giờ được ghi đè chủ sở hữu thật
      sync.setActiveUserId('sandbox_user');
      expect(sync.pairedUserId, 'real_victim_id_01');
      expect(WatchSyncManager.isPlaceholderUserId('sandbox_user'), true);

      sync.setIsRunningOnWatch(false);
    });
  });
}
