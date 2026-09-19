import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/views/settings/settings_page.dart';

void main() {
  testWidgets('SettingsPage hides dev features by default and unlocks via 7 taps', (tester) async {
    final appProvider = AppProvider();

    tester.view.physicalSize = const Size(1080, 3800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      ChangeNotifierProvider<AppProvider>.value(
        value: appProvider,
        child: const MaterialApp(
          home: Scaffold(
            body: SettingsPage(),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Verify header
    expect(find.text('Cài đặt'), findsOneWidget);

    // 1. By default, API server URL and WearOS Watch Face simulator should NOT be visible
    expect(find.text('Địa chỉ máy chủ API'), findsNothing);
    expect(find.text('Mặt đồng hồ WearOS (Galaxy Watch 5)'), findsNothing);
    expect(find.text('FCM push thật'), findsNothing);

    // 2. User-friendly terms are displayed
    expect(find.text('Thông báo đẩy khẩn cấp'), findsOneWidget);
    expect(find.text('Giám sát an toàn chạy ngầm'), findsOneWidget);
    expect(find.text('Tối ưu pin nền 24/7'), findsOneWidget);

    // 3. Footer version is present
    final inkWellFinder = find.byKey(const ValueKey('version_footer_inkwell'));
    expect(inkWellFinder, findsOneWidget);

    // 4. Tap version 7 times to enable developer mode
    for (int i = 0; i < 7; i++) {
      await tester.tap(inkWellFinder);
      await tester.pump(const Duration(milliseconds: 100));
    }
    await tester.pumpAndSettle();

    // 5. Developer options should now be visible
    expect(find.text('TÙY CHỌN NHÀ PHÁT TRIỂN'), findsOneWidget);
    expect(find.text('Địa chỉ máy chủ API'), findsOneWidget);
    expect(find.text('Giả lập WearOS (Galaxy Watch 5)'), findsOneWidget);

    // 6. Tap "Ẩn chế độ Dev"
    final hideDevFinder = find.text('Ẩn chế độ Dev');
    expect(hideDevFinder, findsOneWidget);
    await tester.tap(hideDevFinder);
    await tester.pumpAndSettle();

    // 7. Developer options should be hidden again
    expect(find.text('TÙY CHỌN NHÀ PHÁT TRIỂN'), findsNothing);
    expect(find.text('Địa chỉ máy chủ API'), findsNothing);
    expect(find.text('Giả lập WearOS (Galaxy Watch 5)'), findsNothing);
  });
}
