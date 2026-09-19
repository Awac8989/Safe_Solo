import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/views/home/home_page.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  Widget createTestWidget(AppProvider provider) {
    return ChangeNotifierProvider<AppProvider>.value(
      value: provider,
      child: const MaterialApp(
        home: HomePage(),
      ),
    );
  }

  group('HomePage Check-in UI Automated Test Suite', () {
    testWidgets('[TC-ORB-01 & TC-TIMER-01] Renders Safe Orb and Countdown Timer', (tester) async {
      final provider = AppProvider();
      await tester.binding.setSurfaceSize(const Size(800, 1600));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(createTestWidget(provider));
      await tester.pump();

      // Verify Orb title & subtitle
      expect(find.text('✓ Đã điểm danh'), findsOneWidget);
      expect(find.text('Bạn đang an toàn'), findsOneWidget);

      // Verify Countdown Timer section
      expect(find.text('CÒN LẠI'), findsOneWidget);
      expect(find.byType(ListView), findsOneWidget);
    });

    testWidgets('[TC-TIMER-02] Renders Vacation Mode when paused', (tester) async {
      final provider = AppProvider();
      await tester.binding.setSurfaceSize(const Size(800, 1600));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      // Put into vacation mode
      provider.setUserForTest(
        User(
          id: 'test-user',
          name: 'Người dùng',
          email: 'user@safesolo.app',
          phoneNumber: '0901234567',
          timerIntervalMinutes: 720,
          currentStatus: 'SAFE',
          quietHoursStart: '22:00',
          quietHoursEnd: '07:00',
          falseAlertGraceMinutes: 15,
          emergencyContacts: const [],
          sleepModeUntil: DateTime.now().add(const Duration(days: 3)),
        ),
      );

      await tester.pumpWidget(createTestWidget(provider));
      await tester.pump();

      // Expect --:--:-- timer
      expect(find.text('--:--:--'), findsOneWidget);
      expect(find.text('Chế độ nghỉ dưỡng đang bật. Đồng hồ điểm danh đang được tạm dừng.'), findsOneWidget);
    });

    testWidgets('[TC-GUARDIAN-01] Renders Guardians Online Card when contacts exist', (tester) async {
      final provider = AppProvider();
      await tester.binding.setSurfaceSize(const Size(800, 1600));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      provider.setUserForTest(
        User(
          id: 'user-with-guardians',
          name: 'Bình An',
          email: 'binhan@safesolo.app',
          phoneNumber: '0909000111',
          timerIntervalMinutes: 720,
          currentStatus: 'SAFE',
          quietHoursStart: '22:00',
          quietHoursEnd: '07:00',
          falseAlertGraceMinutes: 15,
          emergencyContacts: const [
            EmergencyContact(name: 'Mẹ Lan', phone: '0912345678', relation: 'Mẹ ruột'),
          ],
        ),
      );

      await tester.pumpWidget(createTestWidget(provider));
      await tester.pump();

      expect(find.text('Người bảo hộ đang online'), findsOneWidget);
      expect(find.text('Mẹ Lan'), findsOneWidget);
      expect(find.text('Mẹ ruột'), findsOneWidget);
    });

    testWidgets('[TC-MOOD-01] Quick Mood ActionChips render and are tappable', (tester) async {
      final provider = AppProvider();
      await tester.binding.setSurfaceSize(const Size(800, 1600));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(createTestWidget(provider));
      await tester.pump();

      expect(find.text('Trạng thái nhanh'), findsOneWidget);
      expect(find.text('Bình an'), findsOneWidget);
      expect(find.text('Tích cực'), findsOneWidget);
      expect(find.text('Hơi mệt'), findsOneWidget);

      // Tap one mood chip
      await tester.tap(find.text('Bình an'));
      await tester.pump();
      await tester.pump(const Duration(seconds: 3));

      // Verify a post was created in circle
      expect(provider.circlePosts.any((post) => post.message.contains('Bình an')), true);
    });

    testWidgets('[TC-HEALTH-01 & 02] Renders Status, Quiet Hours, and Meds cards', (tester) async {
      final provider = AppProvider();
      await tester.binding.setSurfaceSize(const Size(800, 1600));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(createTestWidget(provider));
      await tester.pump();

      expect(find.text('TRẠNG THÁI'), findsOneWidget);
      expect(find.text('GIỜ YÊN LẶNG'), findsOneWidget);
      expect(find.text('THUỐC'), findsOneWidget);
    });
  });
}
