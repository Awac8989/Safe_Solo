import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/services/watch_sync_manager.dart';
import 'package:safesolo/services/wear_os_service.dart';
import 'package:safesolo/services/real_watch_task_engine.dart';
import 'package:safesolo/views/watch/smartwatch_connection_page.dart';
import 'package:safesolo/views/wear_os/wear_os_watch_page.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Samsung Galaxy Watch 5 - Real Hardware & Task Engine Tests', () {
    setUp(() {
      WatchSyncManager.instance.unpairDevice();
    });

    tearDown(() {
      WatchSyncManager.instance.stopPeriodicChecks();
      RealWatchTaskEngine.instance.stopEngine();
    });

    testWidgets('Native Wear OS Watch Face renders athletic clock and 1-touch checkin on 384x384 AMOLED',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(384, 384);
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

      // Native Watch Face displays athletic clock & instant checkin button
      expect(find.text('14:32 đến hạn'), findsOneWidget);
      expect(find.text('TÔI\nAN TOÀN'), findsOneWidget);

      // Perform 1-touch instant checkin
      await tester.tap(find.text('TÔI\nAN TOÀN'));
      await tester.pump(const Duration(milliseconds: 200));

      expect(find.text('ĐÃ ĐIỂM DANH AN TOÀN'), findsOneWidget);

      await tester.pumpWidget(const SizedBox());
      await tester.pump();
    });

    testWidgets('Native Wear OS gesture navigation navigates across tiles smoothly',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(384, 384);
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

      // Swipe left to navigate to Tile 2: Dashboard
      await tester.drag(find.byKey(const Key('watch_gesture_detector')), const Offset(-120, 0));
      await tester.pumpAndSettle();

      expect(find.text('ĐẾN HẠN ĐIỂM DANH'), findsOneWidget);
      expect(find.text('ĐIỂM DANH'), findsOneWidget);
      expect(find.text('SOS KHẨN'), findsOneWidget);

      // Swipe left to navigate to Tile 3: Check-in
      await tester.drag(find.byKey(const Key('watch_gesture_detector')), const Offset(-120, 0));
      await tester.pumpAndSettle();

      expect(find.text('CẢM XÚC HÔM NAY?'), findsOneWidget);
      expect(find.text('Tuyệt vời'), findsOneWidget);

      await tester.pumpWidget(const SizedBox());
      await tester.pump();
    });

    test('RealWatchTaskEngine manages 5 real-world autonomous tasks', () {
      final engine = RealWatchTaskEngine.instance;
      expect(engine.isEngineRunning, isFalse);

      engine.startEngine();
      expect(engine.isEngineRunning, isTrue);

      final tasks = engine.tasks;
      expect(tasks.length, equals(5));

      // Verify Task 1: PPG BioActive
      final vitalsTask = tasks.firstWhere((t) => t.id == 'vitals_bioactive');
      expect(vitalsTask.title, contains('BioActive'));
      expect(vitalsTask.status, equals(WatchTaskStatus.active));

      // Verify Task 2: IMU Fall & Crash
      final fallTask = tasks.firstWhere((t) => t.id == 'fall_crash_imu');
      expect(fallTask.title, contains('Té ngã'));

      // Verify Task 3: Dead-man Countdown
      final deadmanTask = tasks.firstWhere((t) => t.id == 'deadman_countdown');
      expect(deadmanTask.title, contains('Bộ đếm'));

      // Verify Task 4: Two-way Sync
      final syncTask = tasks.firstWhere((t) => t.id == 'bidirectional_sync');
      expect(syncTask.title, contains('Đồng bộ'));

      // Verify Task 5: SOS & Duress
      final sosTask = tasks.firstWhere((t) => t.id == 'emergency_duress');
      expect(sosTask.title, contains('SOS'));

      engine.stopEngine();
      expect(engine.isEngineRunning, isFalse);
    });

    test('WearOsService processes high-G accident crash simulation correctly', () {
      final wearOs = WearOsService.instance;
      expect(wearOs.isCountdownActive, isFalse);

      // Simulate crash: SVM 6.5g, tilt 78 degrees
      wearOs.simulateAccidentCrash();
      expect(wearOs.currentSvmG, greaterThanOrEqualTo(6.5));
      expect(wearOs.currentTiltAngle, equals(78.0));
      expect(wearOs.isCountdownActive, isTrue);

      // User cancels emergency
      wearOs.cancelEmergency();
      expect(wearOs.isCountdownActive, isFalse);
    });

    testWidgets('SmartwatchConnectionPage on Phone renders real management UI without virtual watch bezel',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 1920);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        ChangeNotifierProvider(
          create: (_) => AppProvider(),
          child: const MaterialApp(
            home: SmartwatchConnectionPage(),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      // Confirms phone app header
      expect(find.text('Thiết bị đeo & Đồng hồ'), findsOneWidget);
      expect(find.text('Samsung Galaxy Watch 5 · Sẵn sàng bảo vệ'), findsOneWidget);

      // Confirms NO virtual watch bezel simulator exists
      expect(find.text('SAMSUNG GALAXY WATCH 5 · SAFE-SOLO'), findsNothing);
      expect(find.text('XEM MÀN HÌNH ĐỒNG HỒ'), findsNothing);

      // Confirms Real Watch Tasks section is displayed
      expect(find.text('TÁC VỤ ĐỘC LẬP TRÊN ĐỒNG HỒ THẬT'), findsOneWidget);
      expect(find.textContaining('BioActive PPG'), findsOneWidget);
      expect(find.textContaining('Phát hiện Té ngã'), findsOneWidget);
      expect(find.textContaining('Bộ đếm Điểm danh'), findsOneWidget);

      await tester.pumpWidget(const SizedBox());
      await tester.pump();
    });
  });
}
