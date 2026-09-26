import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/core/widgets/top_toast.dart';
import 'package:safesolo/services/offline_resilience_service.dart';
import 'package:safesolo/services/watch_sync_manager.dart';
import 'package:safesolo/services/wear_os_service.dart';
import 'package:safesolo/views/settings/defense_demo_sandbox_page.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    WearOsService.instance.cancelEmergency();
    WearOsService.instance.resetVitals();
    OfflineResilienceService.instance.stopAcousticRescueSiren();
  });

  tearDown(() {
    TopToast.dismiss();
    WatchSyncManager.instance.stopPeriodicChecks();
    WearOsService.instance.cancelEmergency();
    WearOsService.instance.resetVitals();
    OfflineResilienceService.instance.stopAcousticRescueSiren();
  });

  testWidgets('DefenseDemoSandboxPage renders HUD, tabs, and injected actions properly',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final appProvider = AppProvider();
    appProvider.setUserForTest(
      User(
        id: 'test-user-defense',
        name: 'Đoàn Minh Quân',
        email: 'quan@safesolo.app',
        phoneNumber: '0901234567',
        timerIntervalMinutes: 720,
        currentStatus: 'SAFE',
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        falseAlertGraceMinutes: 15,
        lastCheckinTime: DateTime.now(),
        nextDeadline: DateTime.now().add(const Duration(hours: 12)),
      ),
    );

    await tester.pumpWidget(
      ChangeNotifierProvider<AppProvider>.value(
        value: appProvider,
        child: const MaterialApp(
          home: DefenseDemoSandboxPage(),
        ),
      ),
    );

    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    // Verify Title & Badges
    expect(find.text('DEFENSE DEMO SANDBOX'), findsOneWidget);
    expect(find.text('KTPM03'), findsOneWidget);
    expect(find.text('TRẠNG THÁI: SYSTEM_SAFE (Bình thường)'), findsOneWidget);

    // Verify 4 Telemetry Metrics
    expect(find.text('NHỊP TIM'), findsOneWidget);
    expect(find.text('OXY MÁU SpO2'), findsOneWidget);
    expect(find.text('GIA TỐC SVM'), findsOneWidget);
    expect(find.text('GÓC NGHIÊNG'), findsOneWidget);

    // Verify Tab 1 Scenarios
    expect(find.text('1. Giả lập Té ngã chấn thương (Hard Fall)'), findsOneWidget);
    expect(find.text('2. Giả lập Loạn nhịp AFib & Thiếu Oxy (Hypoxia)'), findsOneWidget);
    expect(find.text('3. Giả lập Quá hạn Điểm danh (Dead-man Timeout)'), findsOneWidget);
    expect(find.text('4. Giả lập Báo động Ngầm Cưỡng bức (Duress PIN)'), findsOneWidget);

    // Test Action: Inject Hard Fall
    final fallButton = find.text('💥 Bơm Tín Hiệu Té Ngã');
    expect(fallButton, findsOneWidget);
    await tester.tap(fallButton);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));

    expect(WearOsService.instance.isCountdownActive, isTrue);
    expect(find.text('PHÁT HIỆN TÉ NGÃ TỪ GALAXY WATCH 5'), findsOneWidget);
    expect(find.text('HỦY'), findsOneWidget);

    // Test Action: Cancel / Reset
    WearOsService.instance.cancelEmergency();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(WearOsService.instance.isCountdownActive, isFalse);

    // Test Action: Inject Deadman Timeout
    final deadmanButton = find.text('⏳ Tua Quá Hạn Điểm Danh');
    expect(deadmanButton, findsOneWidget);
    await tester.tap(deadmanButton);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));

    expect(appProvider.user?.currentStatus, equals('CHECKIN_OVERDUE'));
    expect(find.text('TRẠNG THÁI: CHECKIN_OVERDUE'), findsOneWidget);

    // Test Action: Safe Reset
    final safeResetButton = find.text('🔄 KHÔI PHỤC TRẠNG THÁI BÌNH THƯỜNG (SAFE RESET)');
    expect(safeResetButton, findsOneWidget);
    await tester.tap(safeResetButton);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));

    expect(appProvider.user?.currentStatus, equals('SAFE'));
    expect(find.text('TRẠNG THÁI: SYSTEM_SAFE (Bình thường)'), findsOneWidget);

    // Test Tab 2: Switch to Tactical Tools
    await tester.tap(find.text('🛠️ Công cụ Thực địa'));
    await tester.pumpAndSettle();

    expect(find.text('Còi Cứu Hộ Âm Học (115dB Morse SOS)'), findsOneWidget);
    expect(find.text('Bắn SMS Cứu Hộ GSM Ngoại Tuyến'), findsOneWidget);
    expect(find.text('Cuộc Gọi Thoát Hiểm Giả Lập (Fake Call)'), findsOneWidget);
    expect(find.text('Chụp Bằng Chứng Hộp Đen (Blackbox)'), findsOneWidget);

    // Test Siren Toggle
    final sirenButton = find.text('BẬT CÒI HÚ');
    expect(sirenButton, findsOneWidget);
    await tester.tap(sirenButton);
    await tester.pump();
    expect(OfflineResilienceService.instance.isSirenActive, isTrue);
    expect(find.text('TẮT CÒI'), findsOneWidget);

    await tester.tap(find.text('TẮT CÒI'));
    await tester.pump();
    expect(OfflineResilienceService.instance.isSirenActive, isFalse);

    // Test Tab 3: Switch to Defense Metrics
    await tester.tap(find.text('📊 Số liệu Khoa học'));
    await tester.pumpAndSettle();

    expect(find.text('CHỈ SỐ THỰC NGHIỆM ĐỒ ÁN TỐT NGHIỆP'), findsOneWidget);
    expect(find.text('Mô hình Nhận diện Té ngã (SVM Kinematics)'), findsOneWidget);
    expect(find.text('Precision 97.4% • Recall 96.8% • F1 97.1%'), findsOneWidget);

    // Verify Terminal Log Console is present
    expect(find.text('NHẬT KÝ SỰ KIỆN TÁC CHIẾN (LIVE CONSOLE)'), findsOneWidget);

    TopToast.dismiss();
    await tester.pump(const Duration(seconds: 3));
  });
}
