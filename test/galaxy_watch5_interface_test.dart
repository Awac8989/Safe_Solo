import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/views/wear_os/wear_os_watch_page.dart';

void main() {
  group('Samsung Galaxy Watch 5 Interface Comprehensive Tests', () {
    testWidgets('Watch Face renders athletic clock, TÔI AN TOÀN button and SafeSolo pill',
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
      await tester.pump(const Duration(milliseconds: 300));

      // Check Galaxy Watch 5 hardware header & title
      expect(find.text('SAMSUNG GALAXY WATCH 5'), findsOneWidget);
      expect(find.text('SAFE-SOLO'), findsOneWidget);
      expect(find.text('14:32 đến hạn'), findsOneWidget);
      expect(find.text('TÔI\nAN TOÀN'), findsOneWidget);
      expect(find.text('WATCH FACE'), findsOneWidget);
    });

    testWidgets('Quick jump chip navigates to Dashboard screen', (WidgetTester tester) async {
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
      await tester.pump(const Duration(milliseconds: 300));

      // Tap quick jump chip for Dashboard
      await tester.tap(find.text('Dashboard'));
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.text('ĐẾN HẠN ĐIỂM DANH'), findsOneWidget);
      expect(find.text('Hạn chót: 14:00'), findsOneWidget);
      expect(find.text('ĐIỂM DANH'), findsOneWidget);
      expect(find.text('SOS KHẨN'), findsOneWidget);
    });

    testWidgets('Mood Check-in screen renders 4 emotional choices and completes check-in',
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
      await tester.pump(const Duration(milliseconds: 300));

      // Tap Quick jump link for Mood Check-in
      await tester.tap(find.text('Mood Check-in'));
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.text('CẢM XÚC HÔM NAY?'), findsOneWidget);
      expect(find.text('Tuyệt vời'), findsOneWidget);
      expect(find.text('Bình thường'), findsOneWidget);
      expect(find.text('Mệt mỏi'), findsOneWidget);
      expect(find.text('Bất an'), findsOneWidget);

      // Tap "Tuyệt vời" mood card
      await tester.tap(find.text('Tuyệt vời'));
      await tester.pump(const Duration(milliseconds: 700));

      expect(find.text('Đã điểm danh!'), findsOneWidget);
      expect(find.text('Bộ đếm đã reset'), findsOneWidget);

      // Drain checkin return timer
      await tester.pump(const Duration(milliseconds: 1500));
    });

    testWidgets('Active SOS screen renders GPS lock, dispatch checklist and PIN pad overlay',
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
      await tester.pump(const Duration(milliseconds: 300));

      // Jump to Active SOS
      await tester.tap(find.text('Active SOS'));
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.text('🆘 SOS ĐANG HOẠT ĐỘNG'), findsOneWidget);
      expect(find.text('📍 Đã chốt tọa độ GPS'), findsOneWidget);
      expect(find.textContaining('10.7769° N'), findsOneWidget);
      expect(find.text('Hủy báo động (cần PIN)'), findsOneWidget);

      // Open PIN mode
      await tester.tap(find.text('Hủy báo động (cần PIN)'));
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.text('NHẬP MÃ PIN'), findsOneWidget);
      expect(find.text('1'), findsOneWidget);
      expect(find.text('0'), findsOneWidget);

      // Enter digits 1-2-3-4
      await tester.tap(find.text('1'));
      await tester.pump(const Duration(milliseconds: 50));
      await tester.tap(find.text('2'));
      await tester.pump(const Duration(milliseconds: 50));
      await tester.tap(find.text('3'));
      await tester.pump(const Duration(milliseconds: 50));
      await tester.tap(find.text('4'));
      await tester.pump(const Duration(milliseconds: 400));
    });

    testWidgets('Medical ID screen renders QR code and emergency contact',
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
      await tester.pump(const Duration(milliseconds: 300));

      // Jump to Medical ID
      await tester.tap(find.text('Medical ID'));
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.text('THẺ Y TẾ KHẨN CẤP'), findsOneWidget);
      expect(find.text('Nhóm máu'), findsOneWidget);
      expect(find.textContaining('Gọi người bảo hộ'), findsOneWidget);
    });
  });
}
