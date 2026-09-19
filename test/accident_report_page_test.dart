import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/views/community/accident_report_page.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('AccidentReportPage renders without any RenderFlex overflow on standard mobile',
      (WidgetTester tester) async {
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
        child: const MaterialApp(
          home: AccidentReportPage(),
        ),
      ),
    );

    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    for (final element in find.byType(Flex).evaluate()) {
      final renderFlex = element.renderObject as RenderFlex;
      if (renderFlex.hasSize && renderFlex.size.width > 411.4) {
        debugPrint('ACCIDENT OVERSIZED FLEX: width=${renderFlex.size.width}, widget=${element.widget.runtimeType}');
      }
    }
    expect(find.text('BÁO CÁO TAI NẠN & CẤP CỨU'), findsOneWidget);
    expect(find.text('ẢNH HIỆN TRƯỜNG TIMEMARK'), findsOneWidget);
    expect(find.text('TIMEMARK CERTIFIED'), findsOneWidget);
  });

  testWidgets('AccidentReportPage renders without any RenderFlex overflow on narrow 360dp screen',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(720, 1600);
    tester.view.devicePixelRatio = 2.0; // 360 dp
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final provider = AppProvider();

    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: provider,
        child: const MaterialApp(
          home: AccidentReportPage(),
        ),
      ),
    );

    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(tester.takeException(), isNull);
    expect(find.text('ẢNH HIỆN TRƯỜNG TIMEMARK'), findsOneWidget);
    expect(find.text('TIMEMARK CERTIFIED'), findsOneWidget);
  });

  testWidgets('AccidentReportPage shows real GPS location field and controls',
      (WidgetTester tester) async {
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
        child: const MaterialApp(
          home: AccidentReportPage(),
        ),
      ),
    );

    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    await tester.scrollUntilVisible(
      find.text('VỊ TRÍ HIỆN TRƯỜNG THỰC TẾ'),
      200,
      scrollable: find.byType(Scrollable).first,
    );

    expect(find.text('VỊ TRÍ HIỆN TRƯỜNG THỰC TẾ'), findsOneWidget);
    expect(find.byIcon(Icons.my_location_rounded), findsOneWidget);
    expect(find.byType(TextFormField), findsOneWidget);
  });
}
