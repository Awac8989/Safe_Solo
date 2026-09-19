import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/views/auth/auth_page.dart';
import 'package:safesolo/views/auth/profile_setup_page.dart';
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

  group('Auth Portal Redesign & Profile Setup Tests', () {
    testWidgets('Tapping Google login opens Account Chooser with accounts list',
        (WidgetTester tester) async {
      final provider = AppProvider();

      await tester.pumpWidget(
        ChangeNotifierProvider<AppProvider>.value(
          value: provider,
          child: const MaterialApp(home: AuthPage()),
        ),
      );
      await tester.pumpAndSettle();

      // Switch to Gmail tab
      await tester.tap(find.text('Gmail / Google'));
      await tester.pumpAndSettle();

      // Tap on Continue with Google Account
      await tester.tap(find.text('Tiếp tục với tài khoản Google'));
      await tester.pumpAndSettle();

      // Verify Account Chooser Modal Bottom Sheet opened
      expect(find.text('Chọn tài khoản để tiếp tục với SafeSolo'), findsOneWidget);
      expect(find.text('Nguyễn Văn Minh'), findsOneWidget);
      expect(find.text('minh.safesolo@gmail.com'), findsOneWidget);
      expect(find.text('Google SafeSolo User'), findsOneWidget);
      expect(find.descendant(of: find.byType(BottomSheet), matching: find.text('user.safesolo@gmail.com')), findsOneWidget);
      expect(find.text('Cứu Hộ SafeSolo 115'), findsOneWidget);
      expect(find.text('Sử dụng tài khoản Google khác...'), findsOneWidget);

      provider.dispose();
    });

    testWidgets('Tapping Telegram account button opens Telegram Chooser sheet',
        (WidgetTester tester) async {
      final provider = AppProvider();

      await tester.pumpWidget(
        ChangeNotifierProvider<AppProvider>.value(
          value: provider,
          child: const MaterialApp(home: AuthPage()),
        ),
      );
      await tester.pumpAndSettle();

      // Switch to Telegram tab
      await tester.tap(find.text('Telegram Bot'));
      await tester.pumpAndSettle();

      // Tap on Choose Telegram Account
      await tester.tap(find.text('Chọn tài khoản Telegram để tiếp tục'));
      await tester.pumpAndSettle();

      // Verify Telegram Chooser Bottom Sheet opened
      expect(find.text('Đăng nhập với Telegram'), findsOneWidget);
      expect(find.text('SafeSolo Telegram User'), findsOneWidget);
      expect(find.descendant(of: find.byType(BottomSheet), matching: find.text('@safesolo_user')), findsOneWidget);

      provider.dispose();
    });

    testWidgets('New Google user without profile navigates to ProfileSetupPage and can complete profile',
        (WidgetTester tester) async {
      final provider = AppProvider();

      await tester.pumpWidget(
        ChangeNotifierProvider<AppProvider>.value(
          value: provider,
          child: const MaterialApp(home: AuthPage()),
        ),
      );
      await tester.pumpAndSettle();

      // Switch to Gmail tab
      await tester.tap(find.text('Gmail / Google'));
      await tester.pumpAndSettle();

      // Open Google Chooser
      await tester.tap(find.text('Tiếp tục với tài khoản Google'));
      await tester.pumpAndSettle();

      // Tap on new account "Nguyễn Văn Minh"
      await tester.tap(find.text('Nguyễn Văn Minh'));
      await tester.pumpAndSettle();

      // User signed in but profile incomplete
      expect(provider.user, isNotNull);
      expect(provider.user!.email, 'minh.safesolo@gmail.com');
      expect(provider.hasCompletedProfile, isFalse);

      // Now verify ProfileSetupPage handles input and finishes setup
      await tester.pumpWidget(
        ChangeNotifierProvider<AppProvider>.value(
          value: provider,
          child: const MaterialApp(home: ProfileSetupPage()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Thiết lập Hồ sơ An toàn'), findsOneWidget);
      expect(find.text('1. Thông tin cá nhân của bạn'), findsOneWidget);
      expect(find.text('2. Người liên hệ khẩn cấp (Người thân)'), findsOneWidget);

      // Fill required fields
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Số điện thoại của bạn *'),
        '0912345678',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Tên người thân / Người giám hộ *'),
        'Mẹ Lan',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Số điện thoại khẩn cấp *'),
        '0987654321',
      );

      // Scroll to complete button if needed
      await tester.dragUntilVisible(
        find.text('Hoàn tất hồ sơ & Vào SafeSolo'),
        find.byType(ListView),
        const Offset(0, -300),
      );
      await tester.pumpAndSettle();

      // Tap complete profile
      await tester.tap(find.text('Hoàn tất hồ sơ & Vào SafeSolo'));
      await tester.pumpAndSettle();

      // Verify profile is now complete
      expect(provider.hasCompletedProfile, isTrue);
      expect(provider.user!.phoneNumber, '0912345678');
      expect(provider.user!.emergencyContacts.first.name, 'Mẹ Lan');
      expect(provider.user!.emergencyContacts.first.phone, '0987654321');

      provider.dispose();
    });

    testWidgets('Existing Google user with profile enters MainNavigation directly',
        (WidgetTester tester) async {
      final provider = AppProvider();

      await tester.pumpWidget(
        ChangeNotifierProvider<AppProvider>.value(
          value: provider,
          child: const MaterialApp(home: AuthPage()),
        ),
      );
      await tester.pumpAndSettle();

      // Switch to Gmail tab
      await tester.tap(find.text('Gmail / Google'));
      await tester.pumpAndSettle();

      // Open Google Chooser
      await tester.tap(find.text('Tiếp tục với tài khoản Google'));
      await tester.pumpAndSettle();

      // Tap on existing account "Google SafeSolo User"
      await tester.tap(find.text('Google SafeSolo User'));
      await tester.pumpAndSettle();

      // Verify existing user completes profile directly
      expect(provider.user, isNotNull);
      expect(provider.user!.email, 'user.safesolo@gmail.com');
      expect(provider.hasCompletedProfile, isTrue);

      provider.dispose();
    });

    testWidgets('Logging in with Hiệp Sĩ account from Google chooser grants KYC verification',
        (WidgetTester tester) async {
      final provider = AppProvider();

      await tester.pumpWidget(
        ChangeNotifierProvider<AppProvider>.value(
          value: provider,
          child: const MaterialApp(home: AuthPage()),
        ),
      );
      await tester.pumpAndSettle();

      // Switch to Gmail tab
      await tester.tap(find.text('Gmail / Google'));
      await tester.pumpAndSettle();

      // Open Google Chooser
      await tester.tap(find.text('Tiếp tục với tài khoản Google'));
      await tester.pumpAndSettle();

      // Verify Hiệp Sĩ account appears
      expect(find.text('Đoàn Minh Quân (Hiệp Sĩ SafeSolo)'), findsOneWidget);
      expect(find.text('Hiệp Sĩ KYC'), findsWidgets);

      // Tap on Hiệp Sĩ account
      await tester.tap(find.text('Đoàn Minh Quân (Hiệp Sĩ SafeSolo)'));
      await tester.pumpAndSettle();

      // Verify user is logged in, profile complete, and KYC verified
      expect(provider.user, isNotNull);
      expect(provider.user!.name, 'Đoàn Minh Quân (Hiệp Sĩ SafeSolo)');
      expect(provider.user!.email, 'hiepsi.safesolo@gmail.com');
      expect(provider.hasCompletedProfile, isTrue);
      expect(provider.user!.isKycVerified, isTrue);

      provider.dispose();
    });

    testWidgets('Logging in with Hiệp Sĩ account from Telegram chooser grants KYC verification',
        (WidgetTester tester) async {
      final provider = AppProvider();

      await tester.pumpWidget(
        ChangeNotifierProvider<AppProvider>.value(
          value: provider,
          child: const MaterialApp(home: AuthPage()),
        ),
      );
      await tester.pumpAndSettle();

      // Switch to Telegram tab
      await tester.tap(find.text('Telegram Bot'));
      await tester.pumpAndSettle();

      // Open Telegram Chooser
      await tester.tap(find.text('Chọn tài khoản Telegram để tiếp tục'));
      await tester.pumpAndSettle();

      // Verify Hiệp Sĩ account appears
      expect(find.text('Đoàn Minh Quân (Hiệp Sĩ Cứu Hộ)'), findsOneWidget);

      // Tap on Hiệp Sĩ account
      await tester.tap(find.text('Đoàn Minh Quân (Hiệp Sĩ Cứu Hộ)'));
      await tester.pumpAndSettle();

      // Verify user is logged in, profile complete, and KYC verified
      expect(provider.user, isNotNull);
      expect(provider.user!.isKycVerified, isTrue);

      provider.dispose();
    });
  });
}
