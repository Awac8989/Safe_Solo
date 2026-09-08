import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/views/watch/watch_simulator_page.dart';

void main() {
  testWidgets('SmartwatchConnectionPage renders device telemetry and controls', (WidgetTester tester) async {
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

    // Verify Title and Device Info
    expect(find.text('Thiết bị đeo & Đồng hồ thông minh'), findsOneWidget);
    expect(find.text('Samsung Galaxy Watch 5'), findsWidgets);
    expect(find.text('ĐÃ KẾT NỐI'), findsOneWidget);

    // Verify Direct Telemetry Metrics
    expect(find.text('Nhịp tim PPG'), findsOneWidget);
    expect(find.text('Oxy máu SpO2'), findsOneWidget);
    expect(find.text('Pin đồng hồ'), findsOneWidget);

    // Verify Direct Controls
    expect(find.text('Đo nhịp tim tức thì'), findsOneWidget);
    expect(find.text('Tìm đồng hồ (Rung)'), findsOneWidget);
    expect(find.text('KÍCH HOẠT SOS KHẨN CẤP TỪ ĐỒNG HỒ'), findsOneWidget);
  });

  testWidgets('WatchSimulatorPage redirects properly to SmartwatchConnectionPage', (WidgetTester tester) async {
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
          home: WatchSimulatorPage(),
        ),
      ),
    );

    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('Thiết bị đeo & Đồng hồ thông minh'), findsOneWidget);
    expect(find.text('Samsung Galaxy Watch 5'), findsWidgets);
  });
}
