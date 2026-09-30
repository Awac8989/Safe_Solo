import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/views/auth/auth_page.dart';
import 'package:safesolo/views/security/security_page.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({
      'safesolo_state_v3': jsonEncode({
        'onboarded': true,
        'permissionsGranted': false,
        'streak': 0,
        'highContrast': false,
        'medical': <String, dynamic>{},
        'automation': <String, dynamic>{},
        'security': <String, dynamic>{},
        'badges': <String>[],
        'circlePosts': <Map<String, dynamic>>[],
        'chatThreads': <Map<String, dynamic>>[],
      }),
    });
  });

  group('Full Auth Portal & Security Architecture Tests', () {
    testWidgets('Password Tab renders fields, eye toggle, remember me and quick presets',
        (WidgetTester tester) async {
      final provider = AppProvider();

      await tester.pumpWidget(
        ChangeNotifierProvider<AppProvider>.value(
          value: provider,
          child: const MaterialApp(home: AuthPage()),
        ),
      );
      await tester.pumpAndSettle();

      // Switch to Password tab
      await tester.tap(find.text('Mật khẩu'));
      await tester.pumpAndSettle();

      // Verify Password Tab UI components
      expect(find.text('Đăng nhập bằng Mật khẩu'), findsOneWidget);
      expect(find.text('Ghi nhớ đăng nhập'), findsOneWidget);
      expect(find.text('Quên mật khẩu?'), findsOneWidget);
      expect(find.text('Đăng nhập an toàn'), findsOneWidget);
      expect(find.text('Đăng nhập bằng Vân tay / Face ID (Passkey)'), findsOneWidget);

      // Verify presets
      expect(find.text('CHỌN NHANH TÀI KHOẢN TRẢI NGHIỆM'), findsOneWidget);
      expect(find.text('Đoàn Minh Quân'), findsOneWidget);
      expect(find.text('Nguyễn Văn An'), findsOneWidget);
      expect(find.text('Trần Thị Mai'), findsOneWidget);

      provider.dispose();
    });

    testWidgets('Tapping show/hide password toggles obscureText',
        (WidgetTester tester) async {
      final provider = AppProvider();

      await tester.pumpWidget(
        ChangeNotifierProvider<AppProvider>.value(
          value: provider,
          child: const MaterialApp(home: AuthPage()),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Mật khẩu'));
      await tester.pumpAndSettle();

      // Find password field
      final passwordFinder = find.byWidgetPredicate(
        (widget) => widget is TextField && widget.obscureText == true,
      );
      expect(passwordFinder, findsOneWidget);

      // Tap on eye icon
      final eyeIconFinder = find.byIcon(Icons.visibility_off_outlined);
      expect(eyeIconFinder, findsOneWidget);
      await tester.tap(eyeIconFinder);
      await tester.pumpAndSettle();

      // Now it should be visible
      expect(find.byIcon(Icons.visibility_outlined), findsOneWidget);

      provider.dispose();
    });

    testWidgets('Tapping Quên mật khẩu opens Self-service recovery bottom sheet',
        (WidgetTester tester) async {
      final provider = AppProvider();

      await tester.pumpWidget(
        ChangeNotifierProvider<AppProvider>.value(
          value: provider,
          child: const MaterialApp(home: AuthPage()),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Mật khẩu'));
      await tester.pumpAndSettle();

      // Tap Quên mật khẩu
      await tester.tap(find.text('Quên mật khẩu?'));
      await tester.pumpAndSettle();

      expect(find.text('Khôi phục mật khẩu tự phục vụ'), findsOneWidget);
      expect(find.text('Bước 1: Nhập Email hoặc SĐT đã đăng ký'), findsOneWidget);
      expect(find.text('Hộp thư Gmail'), findsOneWidget);
      expect(find.text('Gửi mã OTP về Gmail'), findsOneWidget);

      // Switch to Telegram channel
      await tester.tap(find.text('Telegram Bot').last);
      await tester.pumpAndSettle();
      expect(find.text('Gửi mã OTP về Telegram'), findsOneWidget);

      provider.dispose();
    });

    testWidgets('Tapping Biometrics / Passkey button opens biometric dialog',
        (WidgetTester tester) async {
      final provider = AppProvider();

      await tester.pumpWidget(
        ChangeNotifierProvider<AppProvider>.value(
          value: provider,
          child: const MaterialApp(home: AuthPage()),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Mật khẩu'));
      await tester.pumpAndSettle();

      final bioButtonFinder = find.text('Đăng nhập bằng Vân tay / Face ID (Passkey)');
      await tester.ensureVisible(bioButtonFinder);
      await tester.pumpAndSettle();

      // Tap Biometric button
      await tester.tap(bioButtonFinder);
      await tester.pumpAndSettle();

      expect(find.text('Xác thực Sinh trắc học'), findsOneWidget);
      expect(find.text('Quét vân tay hoặc Face ID (Passkey) để đăng nhập 1 chạm an toàn.'), findsOneWidget);
      expect(find.text('Xác thực'), findsOneWidget);

      provider.dispose();
    });

    testWidgets('Gmail Tab displays Google, Apple ID, and Microsoft SSO options',
        (WidgetTester tester) async {
      final provider = AppProvider();

      await tester.pumpWidget(
        ChangeNotifierProvider<AppProvider>.value(
          value: provider,
          child: const MaterialApp(home: AuthPage()),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Gmail / Google'));
      await tester.pumpAndSettle();

      expect(find.text('Tiếp tục với tài khoản Google'), findsOneWidget);
      expect(find.text('Apple ID'), findsOneWidget);
      expect(find.text('Microsoft'), findsOneWidget);

      provider.dispose();
    });

    testWidgets('Seamless switching syncs input between Phone and Password tabs',
        (WidgetTester tester) async {
      final provider = AppProvider();

      await tester.pumpWidget(
        ChangeNotifierProvider<AppProvider>.value(
          value: provider,
          child: const MaterialApp(home: AuthPage()),
        ),
      );
      await tester.pumpAndSettle();

      // Enter custom phone in phone step 0
      final phoneFieldFinder = find.widgetWithText(TextField, '0913843958');
      if (phoneFieldFinder.evaluate().isNotEmpty) {
        await tester.enterText(phoneFieldFinder, '0999888777');
        await tester.pumpAndSettle();
      }

      // Switch to Password tab
      await tester.tap(find.text('Mật khẩu'));
      await tester.pumpAndSettle();

      // Verify the phone number was synced into Password identifier field
      expect(find.text('0999888777'), findsOneWidget);

      provider.dispose();
    });

    testWidgets('SecurityPage renders Active Sessions and Logout other devices button',
        (WidgetTester tester) async {
      final provider = AppProvider();

      tester.view.physicalSize = const Size(800, 1800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        ChangeNotifierProvider<AppProvider>.value(
          value: provider,
          child: const MaterialApp(home: SecurityPage()),
        ),
      );
      await tester.pumpAndSettle();

      // Verify tabs
      expect(find.text('Thiết bị'), findsOneWidget);
      expect(find.text('Tài khoản'), findsOneWidget);
      expect(find.text('Mã PIN'), findsOneWidget);

      // Verify Device & Session management elements
      expect(find.text('Quản lý thiết bị & Phiên đăng nhập'), findsOneWidget);
      expect(find.text('THIẾT BỊ HIỆN TẠI NÀY'), findsOneWidget);
      expect(find.text('Thiết bị này'), findsOneWidget);
      final logoutButtonFinder = find.text('Đăng xuất khỏi tất cả các thiết bị khác');
      expect(logoutButtonFinder, findsOneWidget);

      // Tap logout other devices -> dialog opens
      await tester.tap(logoutButtonFinder);
      await tester.pumpAndSettle();

      expect(find.text('Đăng xuất thiết bị khác?'), findsOneWidget);
      expect(find.text('Đăng xuất ngay'), findsOneWidget);

      // Cancel dialog
      await tester.tap(find.text('Hủy'));
      await tester.pumpAndSettle();

      // Switch to Account tab
      await tester.tap(find.text('Tài khoản'));
      await tester.pumpAndSettle();

      expect(find.text('Mật khẩu tài khoản'), findsOneWidget);
      expect(find.text('Xác thực 2 yếu tố (2FA / MFA)'), findsOneWidget);
      expect(find.text('Chống tấn công Brute-force'), findsOneWidget);
      expect(find.text('Cảnh báo đăng nhập lạ'), findsOneWidget);

      provider.dispose();
    });
  });
}
