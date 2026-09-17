import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:safesolo/core/providers/app_provider.dart';
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
  });
}
