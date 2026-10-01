import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/views/auth/auth_page.dart';

void main() {
  testWidgets('Real Auth and Registration Portal UI Tests', (tester) async {
    final appProvider = AppProvider();

    await tester.pumpWidget(
      ChangeNotifierProvider<AppProvider>.value(
        value: appProvider,
        child: const MaterialApp(
          home: AuthPage(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // 1. Check top segmented switcher has both Login and Register tabs
    expect(find.text('ĐĂNG NHẬP'), findsOneWidget);
    expect(find.text('ĐĂNG KÝ TÀI KHOẢN'), findsOneWidget);

    // 2. Default is Login: shows login subtabs
    expect(find.text('Điện thoại'), findsOneWidget);
    expect(find.text('Mật khẩu'), findsOneWidget);
    expect(find.text('Gmail / Google'), findsOneWidget);
    expect(find.text('Telegram Bot'), findsOneWidget);

    // 3. Switch to ĐĂNG KÝ TÀI KHOẢN
    await tester.tap(find.text('ĐĂNG KÝ TÀI KHOẢN'));
    await tester.pumpAndSettle();

    // Verify registration headers and fields are rendered
    expect(find.text('Tạo tài khoản SafeSolo'), findsOneWidget);
    expect(find.text('Thông tin cá nhân'), findsOneWidget);
    expect(find.text('Mật khẩu bảo mật'), findsOneWidget);
    expect(find.text('Người bảo hộ khẩn cấp (ICE)'), findsOneWidget);
    expect(find.text('Chu kỳ an toàn Dead-man Switch'), findsOneWidget);
    expect(find.text('TẠO TÀI KHOẢN & KÍCH HOẠT'), findsOneWidget);

    // 4. Test validation on empty submit (scroll into view first)
    final submitFinder = find.text('TẠO TÀI KHOẢN & KÍCH HOẠT');
    await tester.ensureVisible(submitFinder);
    await tester.pumpAndSettle();
    await tester.tap(submitFinder);
    await tester.pumpAndSettle();

    // Scroll up to check validation messages
    final nameValFinder = find.text('Vui lòng nhập họ và tên');
    await tester.ensureVisible(nameValFinder);
    await tester.pumpAndSettle();
    expect(nameValFinder, findsOneWidget);

    // 5. Test switching back to Đăng nhập via bottom link
    final switchBackFinder = find.text('Đăng nhập ngay');
    await tester.ensureVisible(switchBackFinder);
    await tester.pumpAndSettle();
    await tester.tap(switchBackFinder);
    await tester.pumpAndSettle();

    // Scroll back to top so top elements are rendered
    await tester.drag(find.byType(ListView), const Offset(0, 1000));
    await tester.pumpAndSettle();

    expect(find.text('ĐĂNG NHẬP'), findsOneWidget);
    expect(find.text('ĐĂNG KÝ TÀI KHOẢN'), findsOneWidget);
  });
}
