import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/views/watch/watch_simulator_page.dart';

void main() {
  testWidgets('WatchSimulatorPage renders watch face and controls', (WidgetTester tester) async {
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

    // Verify Title and Subtitle
    expect(find.text('Giả lập Samsung Galaxy Watch 5'), findsOneWidget);
    expect(find.text('Samsung Galaxy Watch 5'), findsWidgets);

    // Verify Action Controls
    expect(find.text('MÔ PHỎNG TÉ NGÃ'), findsOneWidget);
    expect(find.text('BẤM SOS KHẨN CẤP'), findsOneWidget);
    expect(find.text('Cảm biến tháo vòng tay (Off-wrist)'), findsOneWidget);
  });
}
