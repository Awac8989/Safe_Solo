import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:safesolo/core/app_theme.dart';
import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/views/home/home_page.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({
      'safesolo_state_v3': jsonEncode({
        'onboarded': true,
        'permissionsGranted': true,
      }),
    });
  });

  final viewports = <String, Size>{
    'Small_Phone_360x640': const Size(360, 640),
    'Galaxy_A71_392x825': const Size(392, 825),
    'Galaxy_A53_412x915': const Size(412, 915),
    'Narrow_Screen_320x568': const Size(320, 568),
  };

  for (final entry in viewports.entries) {
    testWidgets('Verify Mood Checkin Dialog on ${entry.key} with standard and large fonts', (tester) async {
      tester.view.physicalSize = entry.value;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      final provider = AppProvider();
      provider.setUserForTest(
        User(
          id: 'test-user',
          name: 'Đoàn Minh Quân',
          email: 'quan@safesolo.vn',
          phoneNumber: '0901234567',
          timerIntervalMinutes: 120,
          currentStatus: 'SAFE',
          quietHoursStart: '22:00',
          quietHoursEnd: '06:00',
          falseAlertGraceMinutes: 3,
        ),
      );

      // Test with large text scale factor 1.3 (Accessibility / Big Font on Samsung)
      await tester.pumpWidget(
        ChangeNotifierProvider<AppProvider>.value(
          value: provider,
          child: MaterialApp(
            theme: AppTheme.dark,
            routes: {
              '/auth': (_) => const Scaffold(body: Text('Auth')),
            },
            home: MediaQuery(
              data: const MediaQueryData().copyWith(
                size: entry.value,
                textScaler: const TextScaler.linear(1.3),
              ),
              child: const Scaffold(body: HomePage()),
            ),
          ),
        ),
      );
      await tester.pump();

      // Find Check-in Orb and tap it to open Mood Dialog
      final orbFinder = find.text('✓ Đã điểm danh');
      expect(orbFinder, findsOneWidget);
      await tester.tap(orbFinder, warnIfMissed: false);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));

      // Verify Dialog appeared
      expect(find.text('Điểm danh & Trạng thái'), findsOneWidget);
      expect(find.text('Vui vẻ'), findsOneWidget);
      expect(find.text('Khoảnh khắc'), findsOneWidget);
      expect(find.text('Điểm danh nhanh'), findsOneWidget);

      // Verify no overflow occurred
      expect(tester.takeException(), isNull);

      // Dismiss dialog by tapping 'Điểm danh nhanh'
      await tester.tap(find.text('Điểm danh nhanh'), warnIfMissed: false);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
    });
  }
}
