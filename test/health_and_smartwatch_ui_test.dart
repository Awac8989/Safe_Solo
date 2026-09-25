import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/services/watch_sync_manager.dart';
import 'package:safesolo/views/health/widgets/activity_rings_widget.dart';
import 'package:safesolo/views/health/widgets/vitals_matrix_card.dart';
import 'package:safesolo/views/home/home_page.dart';
import 'package:safesolo/models/health_report_model.dart';
import 'package:safesolo/views/watch/smartwatch_connection_page.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Health & Smartwatch UI Tests', () {
    tearDown(() {
      WatchSyncManager.instance.stopPeriodicChecks();
    });

    testWidgets('ActivityRingsWidget renders 3 concentric rings and stats correctly',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ActivityRingsWidget(
              steps: 4280,
              calories: 171.2,
              distanceKm: 3.21,
              stepGoal: 6000,
              calorieGoal: 300,
              distanceGoal: 5.0,
              onSimulateStep: () {},
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('VÒNG HOẠT ĐỘNG HÔM NAY'), findsOneWidget);
      expect(find.text('Mục tiêu vận động sinh tồn'), findsOneWidget);
      expect(find.text('+25 bước'), findsOneWidget);
      expect(find.text('Bước chân'), findsOneWidget);
      expect(find.text('Calo tiêu thụ'), findsOneWidget);
      expect(find.text('Quãng đường'), findsOneWidget);
      expect(
        find.byWidgetPredicate((w) => w is RichText && w.text.toPlainText().contains('4280')),
        findsOneWidget,
      );
    });

    testWidgets('VitalsMatrixCard renders Safety Score, Heart Rate PPG, SpO2, and IMU Motion',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: VitalsMatrixCard(
                heartRate: 78,
                spO2: 98,
                currentSvmG: 1.05,
                currentTiltAngle: 14.2,
                isOffWrist: false,
                isMeasuring: false,
                onMeasureNow: () {},
              ),
            ),
          ),
        ),
      );

      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Chỉ số Sinh tồn SafeSolo'), findsOneWidget);
      expect(find.text('TỐI ƯU · AN TOÀN CAO'), findsOneWidget);
      expect(find.text('NHỊP TIM PPG'), findsOneWidget);
      expect(find.text('78'), findsOneWidget);
      expect(find.text('OXY MÁU SpO2'), findsOneWidget);
      expect(find.text('98'), findsOneWidget);
      expect(find.text('CẢM BIẾN GIA TỐC & TÉ NGÃ'), findsOneWidget);
      expect(find.text('Bảo vệ 24/7'), findsOneWidget);

      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('SmartwatchConnectionPage renders 3 tabs and can switch tabs',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2200);
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
      await tester.pump(const Duration(milliseconds: 100));

      // Check App Bar and Tab headers
      expect(find.text('Thiết bị đeo & Đồng hồ'), findsOneWidget);
      expect(find.text('Samsung Galaxy Watch 5'), findsWidgets);
      expect(find.text('Sức khỏe'), findsOneWidget);
      expect(find.text('Phát hiện ngã'), findsOneWidget);
      expect(find.text('Kết nối & Đồng bộ'), findsOneWidget);

      // Check Tab 1 elements (Mặc định khi chưa kết nối)
      expect(find.text('CHƯA KẾT NỐI'), findsOneWidget);
      expect(find.text('CHỈ SỐ SỨC KHỎE TRỰC TIẾP'), findsOneWidget);

      // Switch to Tab 2 (Phát hiện ngã)
      await tester.tap(find.text('Phát hiện ngã'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('THỬ NGHIỆM TÍNH NĂNG BÁO NGÃ'), findsOneWidget);
      expect(find.text('CÀI ĐẶT CẢNH BÁO AN TOÀN'), findsOneWidget);

      // Switch to Tab 3 (Kết nối & Đồng bộ)
      await tester.tap(find.text('Kết nối & Đồng bộ'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('CÁCH THỨC TRAO ĐỔI DỮ LIỆU'), findsOneWidget);

      WatchSyncManager.instance.stopPeriodicChecks();
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('HomePage renders Live Health & Watch Glance card with metrics',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final provider = AppProvider();

      await tester.pumpWidget(
        ChangeNotifierProvider.value(
          value: provider,
          child: const MaterialApp(
            home: HomePage(),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // 1. Khi chưa kết nối: Phải hiển thị thẻ "Chưa kết nối đồng hồ thông minh" và nút Thêm
      expect(find.text('Chưa kết nối đồng hồ thông minh'), findsOneWidget);
      expect(find.text('Thêm'), findsOneWidget);
      expect(find.text('BPM'), findsNothing);

      // 2. Khi đã kết nối thành công: Phải hiển thị thẻ trực tiếp và các chỉ số sinh tồn
      await WatchSyncManager.instance.quickPairDevice(userId: 'test_user');
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.text('Đã kết nối · Đang đồng bộ thời gian thực'), findsOneWidget);
      expect(find.text('BPM'), findsWidgets);
      expect(find.text('SpO2'), findsWidgets);

      WatchSyncManager.instance.stopPeriodicChecks();
      await tester.pumpWidget(const SizedBox());
      await tester.pump();
    });

    test('HealthReportModel handles both checkinTime and createdAt gracefully', () {
      final json = {
        'period': 'month',
        'range': {'start': '2026-09-01T00:00:00.000Z', 'end': '2026-09-30T23:59:59.999Z'},
        'summary': {'totalCheckIns': 5, 'autoCheckIns': 2, 'overdueCount': 0, 'sosCount': 0},
        'dailySeries': [],
        'recentCheckins': [
          {
            'id': 'chk1',
            'checkinTime': '2026-09-18T03:00:00.000Z',
            'isSystemAutoTriggered': true,
          },
          {
            'id': 'chk2',
            'createdAt': '2026-09-18T02:00:00.000Z',
            'isSystemAutoTriggered': false,
          },
          {
            'id': 'chk3',
            'isSystemAutoTriggered': false,
          }
        ],
        'recentAlerts': [
          {
            'id': 'alt1',
            'createdAt': '2026-09-18T01:00:00.000Z',
            'title': 'Test alert',
            'message': 'Test message'
          }
        ]
      };

      final report = HealthReportModel.fromJson(json);
      expect(report.recentCheckins.length, 3);
      expect(report.recentCheckins[0].createdAt, '2026-09-18T03:00:00.000Z');
      expect(report.recentCheckins[1].createdAt, '2026-09-18T02:00:00.000Z');
      expect(report.recentCheckins[2].createdAt, '');
      expect(report.recentAlerts.length, 1);
    });
  });
}
