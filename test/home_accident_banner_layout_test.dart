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

  testWidgets('HomePage renders Báo cáo tai nạn TimeMark at bottom with no overflow on mobile size',
      (WidgetTester tester) async {
    // Standard phone screen (411.4 x 914.3 dp)
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.625;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final provider = AppProvider();

    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: provider,
        child: MaterialApp(
          routes: {
            '/report-accident': (_) => const Scaffold(body: Text('Accident Report Mock')),
          },
          home: const HomePage(),
        ),
      ),
    );

    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    // Ensure no overflow exception was thrown on initial render
    expect(tester.takeException(), isNull);

    final bannerFinder = find.text('Báo cáo tai nạn');
    await tester.dragUntilVisible(
      bannerFinder,
      find.byType(ListView),
      const Offset(0, -300),
    );
    await tester.pump(const Duration(milliseconds: 200));

    await tester.drag(find.byType(ListView), const Offset(0, -150));
    await tester.pump(const Duration(milliseconds: 200));

    expect(bannerFinder, findsOneWidget);
    expect(find.text('TIMEMARK 115'), findsOneWidget);
    expect(find.text('Chụp ảnh đóng dấu GPS & thời gian thực gửi cấp cứu'), findsOneWidget);
    expect(tester.takeException(), isNull);

    // Verify tapping opens the route
    await tester.tap(bannerFinder);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('Accident Report Mock'), findsOneWidget);
  });

  testWidgets('HomePage renders without overflow even on narrow 360dp screens',
      (WidgetTester tester) async {
    // Narrow 360 x 800 dp screen
    tester.view.physicalSize = const Size(720, 1600);
    tester.view.devicePixelRatio = 2.0;
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

    expect(tester.takeException(), isNull);

    final bannerFinder = find.text('Báo cáo tai nạn');
    await tester.dragUntilVisible(
      bannerFinder,
      find.byType(ListView),
      const Offset(0, -300),
    );
    await tester.pump(const Duration(milliseconds: 200));

    expect(bannerFinder, findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
