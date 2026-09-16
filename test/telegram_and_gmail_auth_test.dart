import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/views/auth/auth_page.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({
      'safesolo_state_v3': jsonEncode({
        'onboarded': false,
        'permissionsGranted': true,
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

  Widget buildTestWidget({AppProvider? provider}) {
    return ChangeNotifierProvider<AppProvider>(
      create: (_) => provider ?? AppProvider(),
      child: const MaterialApp(
        home: AuthPage(),
      ),
    );
  }

  group('Telegram & Gmail Auth UI Tests', () {
    testWidgets('Renders all 3 tabs: Phone, Gmail/Google, Telegram Bot', (WidgetTester tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.text('Điện thoại'), findsOneWidget);
      expect(find.text('Gmail / Google'), findsOneWidget);
      expect(find.text('Telegram Bot'), findsOneWidget);

      // Default tab is Phone
      expect(find.text('Tiếp tục vào SafeSolo'), findsOneWidget);
    });

    testWidgets('Switching to Gmail tab renders Google Portal and Gmail OTP form', (WidgetTester tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      // Tap on Gmail / Google tab
      await tester.tap(find.text('Gmail / Google'));
      await tester.pumpAndSettle();

      expect(find.text('Cổng đăng nhập Google'), findsOneWidget);
      expect(find.text('Tiếp tục với tài khoản Google'), findsOneWidget);
      expect(find.text('HOẶC NHẬN MÃ QUA GMAIL'), findsOneWidget);
      expect(find.text('Gửi mã xác thực qua Gmail'), findsOneWidget);
    });

    testWidgets('Switching to Telegram tab renders @SafeSoloGuardianBot and OTP form', (WidgetTester tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      // Tap on Telegram Bot tab
      await tester.tap(find.text('Telegram Bot'));
      await tester.pumpAndSettle();

      expect(find.text('@SFESOLOBot'), findsOneWidget);
      expect(find.text('Gửi mã OTP qua Telegram'), findsOneWidget);
      expect(find.text('Live / Sandbox'), findsOneWidget);
    });

    testWidgets('AppProvider authenticateWithGoogle signs in user', (WidgetTester tester) async {
      final provider = AppProvider();
      await tester.pumpWidget(buildTestWidget(provider: provider));
      await tester.pumpAndSettle();

      await provider.authenticateWithGoogle(
        email: 'alex.guardian@gmail.com',
        name: 'Alex Guardian',
      );

      expect(provider.user, isNotNull);
      expect(provider.user!.email, 'alex.guardian@gmail.com');
      expect(provider.user!.name, 'Alex Guardian');
    });

    testWidgets('AppProvider verifyTelegramOtp signs in user', (WidgetTester tester) async {
      final provider = AppProvider();
      await tester.pumpWidget(buildTestWidget(provider: provider));
      await tester.pumpAndSettle();

      await provider.verifyTelegramOtp(
        identifier: '@guardian_tele',
        otp: '123456',
        name: 'Alex Telegram',
      );

      expect(provider.user, isNotNull);
      expect(provider.user!.name, 'Alex Telegram');
    });

    testWidgets('AppProvider verifyGmailOtp signs in user', (WidgetTester tester) async {
      final provider = AppProvider();
      await tester.pumpWidget(buildTestWidget(provider: provider));
      await tester.pumpAndSettle();

      await provider.verifyGmailOtp(
        email: 'safety.test@gmail.com',
        otp: '654321',
        name: 'Safety User',
      );

      expect(provider.user, isNotNull);
      expect(provider.user!.email, 'safety.test@gmail.com');
    });
  });
}
