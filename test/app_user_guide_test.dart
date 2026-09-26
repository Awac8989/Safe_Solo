import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/views/settings/app_user_guide_page.dart';
import 'package:safesolo/views/settings/settings_page.dart';

void main() {
  testWidgets('SettingsPage renders Help & Guides section and opens AppUserGuidePage', (tester) async {
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
        child: MaterialApp(
          routes: {
            '/user-guide': (_) => const AppUserGuidePage(),
          },
          home: const Scaffold(
            body: SettingsPage(),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // 1. Verify Trợ giúp & Hướng dẫn section exists
    expect(find.text('TRỢ GIÚP & HƯỚNG DẪN'), findsOneWidget);
    expect(find.text('Hướng dẫn sử dụng SafeSolo'), findsOneWidget);
    expect(find.text('Cẩm nang an toàn tình huống'), findsOneWidget);
    expect(find.text('Cẩm nang sơ cứu khẩn cấp'), findsOneWidget);

    // 2. Tap on Hướng dẫn sử dụng SafeSolo to navigate
    await tester.tap(find.text('Hướng dẫn sử dụng SafeSolo'));
    await tester.pumpAndSettle();

    // 3. Verify AppUserGuidePage is rendered
    expect(find.text('Hướng dẫn sử dụng SafeSolo'), findsWidgets);
    expect(find.text('Sổ tay Hướng dẫn SafeSolo'), findsOneWidget);
    expect(find.text('Tất cả'), findsOneWidget);
    expect(find.text('Điểm danh & Quả cầu'), findsOneWidget);
    expect(find.text('Vòng tròn & Hộ tống'), findsOneWidget);
    expect(find.text('SOS & Hiệp sĩ'), findsOneWidget);
    expect(find.text('Thoát hiểm & Bảo mật'), findsOneWidget);
    expect(find.text('Sơ cứu & Đồng hồ'), findsOneWidget);
    expect(find.text('Hỏi đáp'), findsOneWidget);

    // 4. Verify guide cards exist
    expect(find.text('SafeSolo là gì? Cơ chế Công tắc An toàn'), findsOneWidget);
    expect(find.text('Quả cầu An toàn & Ý nghĩa các màu sắc'), findsOneWidget);

    // 5. Verify Emergency Hotline section is rendered
    expect(find.text('Đường dây nóng Khẩn cấp Quốc gia'), findsOneWidget);
    expect(find.text('115'), findsOneWidget);
    expect(find.text('113'), findsOneWidget);
    expect(find.text('114'), findsOneWidget);
  });

  testWidgets('AppUserGuidePage search filters guide topics properly', (tester) async {
    final appProvider = AppProvider();

    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      ChangeNotifierProvider<AppProvider>.value(
        value: appProvider,
        child: const MaterialApp(
          home: AppUserGuidePage(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Type "CPR" in the search box
    await tester.enterText(find.byType(TextField), 'CPR');
    await tester.pumpAndSettle();

    // Check that CPR guide is visible and other unrelated guides are filtered out
    expect(find.text('Trợ lý Sơ cứu Khẩn cấp & Ép tim CPR'), findsOneWidget);
    expect(find.text('Cuộc gọi Thoát hiểm Giả lập (Fake Call)'), findsNothing);

    // Clear search
    await tester.enterText(find.byType(TextField), '');
    await tester.pumpAndSettle();

    // All should be visible again
    expect(find.text('SafeSolo là gì? Cơ chế Công tắc An toàn'), findsOneWidget);
  });
}
