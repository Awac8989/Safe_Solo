import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/services/pedometer_service.dart';
import 'package:safesolo/services/wear_os_service.dart';
import 'package:safesolo/views/wear_os/wear_os_watch_page.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('WearOsService Unit Tests', () {
    late WearOsService service;

    setUp(() {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
        const MethodChannel('dev.fluttercommunity.plus/sensors/method'),
        (MethodCall methodCall) async => null,
      );
      service = WearOsService.instance;
      service.cancelEmergency();
      service.setOffWrist(false);
      service.setFallSensitivity(2.5);
    });

    tearDown(() {
      service.cancelEmergency();
    });

    test('Initial properties and hardware defaults', () {
      expect(service.watchModel, contains('Samsung Galaxy Watch 5'));
      expect(service.battery, inInclusiveRange(1, 100));
      expect(service.heartRate, inInclusiveRange(40, 200));
      expect(service.spO2, inInclusiveRange(70, 100));
      expect(service.isOffWrist, isFalse);
      expect(service.isCountdownActive, isFalse);
    });

    test('Sensitivity adjustment works', () {
      service.setFallSensitivity(2.0);
      expect(service.fallSensitivityG, equals(2.0));
      service.setFallSensitivity(2.5);
      expect(service.fallSensitivityG, equals(2.5));
    });

    test('Off-wrist toggle toggles monitoring status', () {
      service.setOffWrist(true);
      expect(service.isOffWrist, isTrue);
      expect(service.isFallMonitoringActive, isFalse);

      service.setOffWrist(false);
      expect(service.isOffWrist, isFalse);
      expect(service.isFallMonitoringActive, isTrue);
    });

    test('Simulate fall triggers 30s countdown and event emission', () async {
      Map<String, dynamic>? receivedEvent;
      final sub = service.watchEventStream.listen((event) {
        receivedEvent = event;
      });

      service.simulateFall();

      expect(service.isCountdownActive, isTrue);
      expect(service.countdownSeconds, equals(30));
      expect(service.currentSvmG, greaterThanOrEqualTo(2.5));
      expect(service.emergencyTitle, contains('TÉ NGÃ'));

      await Future<void>.delayed(const Duration(milliseconds: 100));
      expect(receivedEvent, isNotNull);
      expect(receivedEvent!['type'], equals('WATCH_FALL_DETECTED'));

      await sub.cancel();
    });

    test('Simulate critical SpO2 triggers emergency countdown', () async {
      Map<String, dynamic>? receivedEvent;
      final sub = service.watchEventStream.listen((event) {
        receivedEvent = event;
      });

      service.simulateCriticalSpO2();

      expect(service.isCountdownActive, isTrue);
      expect(service.spO2, equals(86));
      expect(service.countdownSeconds, equals(30));

      await Future<void>.delayed(const Duration(milliseconds: 100));
      expect(receivedEvent, isNotNull);
      expect(receivedEvent!['type'], equals('WATCH_CRITICAL_SPO2'));

      await sub.cancel();
    });

    test('Cancel emergency resets countdown and vitals', () {
      service.simulateFall();
      expect(service.isCountdownActive, isTrue);

      service.cancelEmergency();
      expect(service.isCountdownActive, isFalse);
      expect(service.emergencyTitle, isNull);
      expect(service.spO2, greaterThanOrEqualTo(95));
    });

    test('Force emergency dispatch triggers SOS event', () async {
      Map<String, dynamic>? receivedEvent;
      final sub = service.watchEventStream.listen((event) {
        receivedEvent = event;
      });

      service.forceEmergencyDispatch(userId: 'test-user-123');

      await Future<void>.delayed(const Duration(milliseconds: 100));
      expect(receivedEvent, isNotNull);
      expect(receivedEvent!['type'], equals('WATCH_EMERGENCY_SOS'));

      await sub.cancel();
    });
  });

  group('WearOsWatchPage Widget Tests', () {
    testWidgets('WearOsWatchPage renders circular watch interface and controls',
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
            home: WearOsWatchPage(),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      // Check AppBar or Header
      expect(find.text('SAMSUNG GALAXY WATCH 5'), findsOneWidget);
      expect(find.text('SAFE-SOLO'), findsOneWidget);

      // Check Watch face buttons
      expect(find.text('ĐIỂM DANH'), findsOneWidget);
      expect(find.text('SOS'), findsOneWidget);
    });

    testWidgets('WearOsWatchPage renders on Wear OS Small Round 384x384 (DPR 2.0 = 192x192 dp)',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(384, 384);
      tester.view.devicePixelRatio = 2.0;
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
      await tester.pump(const Duration(milliseconds: 400));

      // In native watch mode, the phone AppBar is omitted
      expect(find.text('SAFE-SOLO'), findsOneWidget);

      // Page 1: Watch Face Home
      expect(find.text('ĐIỂM DANH'), findsOneWidget);
      expect(find.text('SOS'), findsOneWidget);

      // Swipe to Page 2: BioActive PPG
      await tester.drag(find.byKey(const Key('watch_gesture_detector')), const Offset(-100, 0));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('CẢM BIẾN BIOACTIVE PPG'), findsOneWidget);
      expect(find.text('ĐO NGAY'), findsOneWidget);

      // Swipe to Page 3: Kinematic Fall & Motion
      await tester.drag(find.byKey(const Key('watch_gesture_detector')), const Offset(-100, 0));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.textContaining('GIÁM SÁT'), findsOneWidget);
      expect(find.text('MÔ PHỎNG NGÃ 4.8G'), findsOneWidget);

      // Swipe to Page 4: Medical ID
      await tester.drag(find.byKey(const Key('watch_gesture_detector')), const Offset(-100, 0));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('HỒ SƠ Y TẾ KHẨN CẤP'), findsOneWidget);

      // Swipe to Page 5: Device Settings
      await tester.drag(find.byKey(const Key('watch_gesture_detector')), const Offset(-100, 0));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('THIẾT BỊ WEAR OS'), findsOneWidget);
      expect(find.text('ĐỒNG BỘ ĐÁM MÂY'), findsOneWidget);

      // Test Emergency Countdown Overlay on 384x384
      WearOsService.instance.simulateFall();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('TÔI ỔN (HỦY)'), findsOneWidget);
      expect(find.text('CỨU HỘ NGAY'), findsOneWidget);
      WearOsService.instance.cancelEmergency();
      await tester.pump(const Duration(milliseconds: 300));
    });

    testWidgets('WearOsWatchPage renders on Wear OS 384x384 (DPR 1.0 = 384x384 dp)',
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
      await tester.pump(const Duration(milliseconds: 400));

      expect(find.text('SAFE-SOLO'), findsOneWidget);
      expect(find.text('ĐIỂM DANH'), findsOneWidget);
      expect(find.text('SOS'), findsOneWidget);
    });
  });

  group('Watch and Phone App Integration Tests', () {
    test('Watch hardware SOS emits emergency alert to phone PedometerService stream', () async {
      final wearOs = WearOsService.instance;
      final pedometer = PedometerService.instance;
      pedometer.setHeartRate(78);
      pedometer.setBattery(88);
      wearOs.initialize();

      Map<String, dynamic>? phoneReceivedAlert;
      final sub = pedometer.watchAlertStream.listen((alert) {
        phoneReceivedAlert = alert;
      });

      // Kích hoạt SOS từ đồng hồ Galaxy Watch 5
      wearOs.triggerHardwareSos(userId: 'usr_test_phone_123');

      await Future<void>.delayed(const Duration(milliseconds: 100));

      // Kiểm tra điện thoại nhận được sự kiện khẩn cấp tức thì từ đồng hồ
      expect(phoneReceivedAlert, isNotNull);
      expect(phoneReceivedAlert!['type'], equals('WATCH_EMERGENCY_SOS'));
      expect(phoneReceivedAlert!['heartRate'], equals(78));
      expect(phoneReceivedAlert!['battery'], equals(88));

      await sub.cancel();
    });

    test('Watch fall event synchronizes vitals and emits countdown event', () async {
      final pedometer = PedometerService.instance;
      final wearOs = WearOsService.instance;
      wearOs.initialize();

      wearOs.simulateFall();

      // Kiểm tra nhịp tim sau va chạm được đồng bộ sang PedometerService
      expect(pedometer.heartRate, equals(118));
      expect(wearOs.isCountdownActive, isTrue);
      expect(wearOs.emergencyTitle, contains('TÉ NGÃ'));

      wearOs.cancelEmergency();
      expect(wearOs.isCountdownActive, isFalse);
    });

    test('Watch vital metrics update synchronizes to phone pedometer service', () async {
      final pedometer = PedometerService.instance;
      final wearOs = WearOsService.instance;
      wearOs.initialize();

      wearOs.updateMetrics(
        steps: 5400,
        heartRate: 85,
        spO2: 97,
        battery: 92,
      );

      expect(pedometer.steps, equals(5400));
      expect(pedometer.heartRate, equals(85));
      expect(pedometer.spO2, equals(97));
      expect(pedometer.battery, equals(92));
    });
  });
}
