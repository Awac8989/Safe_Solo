import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/core/widgets/top_toast.dart';
import 'package:safesolo/services/false_alarm_suppression_service.dart';
import 'package:safesolo/views/emergency/false_alarm_verification_dialog.dart';

/// ============================================================================
/// KIỂM THỬ TÍNH NĂNG 2: CƠ CHẾ KHỬ BÁO ĐỘNG GIẢ ĐA TẦNG (TWO-PHASE GRACE + VOICE)
/// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03
/// ============================================================================

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('FalseAlarmSuppressionService Unit Tests', () {
    final service = FalseAlarmSuppressionService.instance;

    setUp(() {
      service.reset();
      service.resetMetrics();
    });

    tearDown(() {
      service.reset();
    });

    test('Initial state is idle and metrics are zero after reset', () {
      expect(service.state, VerificationState.idle);
      expect(service.isVerificationActive, false);
      expect(service.countdownSeconds, 20);
      expect(service.totalTriggersCount, 0);
      expect(service.suppressedFalseAlarmsCount, 0);
      expect(service.confirmedEmergenciesCount, 0);
      expect(service.suppressionRatePercent, 0.0);
    });

    test('startGraceVerification transitions to graceCountdown and counts down', () {
      service.startGraceVerification(
        incidentType: 'Té ngã va đập mạnh',
        details: 'SVM 4.8g',
        initialSeconds: 15,
      );

      expect(service.state, VerificationState.graceCountdown);
      expect(service.isVerificationActive, true);
      expect(service.incidentType, 'Té ngã va đập mạnh');
      expect(service.incidentDetails, 'SVM 4.8g');
      expect(service.countdownSeconds, 15);
      expect(service.totalTriggersCount, 1);
    });

    test('cancelAsFalseAlarm suppresses alarm and updates metrics', () {
      service.startGraceVerification(
        incidentType: 'Rung lắc xe bus',
        initialSeconds: 20,
      );

      service.cancelAsFalseAlarm(reason: 'Người dùng bấm nút Tôi ổn');

      expect(service.state, VerificationState.suppressed);
      expect(service.isVerificationActive, false);
      expect(service.lastResolutionReason, 'Người dùng bấm nút Tôi ổn');
      expect(service.suppressedFalseAlarmsCount, 1);
      expect(service.suppressionRatePercent, 100.0);
    });

    test('confirmEmergencyNow escalates alarm immediately and triggers callback', () {
      var callbackTriggered = false;
      service.startGraceVerification(
        incidentType: 'Tai nạn ngã cầu thang',
        initialSeconds: 20,
        onAutoEscalate: () {
          callbackTriggered = true;
        },
      );

      service.confirmEmergencyNow(reason: 'Người dùng xác nhận cần cấp cứu 115');

      expect(service.state, VerificationState.escalated);
      expect(service.isVerificationActive, false);
      expect(service.confirmedEmergenciesCount, 1);
      expect(callbackTriggered, true);
    });

    test('evaluateVoiceResponse recognizes safe phrases and cancels alarm', () {
      service.startGraceVerification(
        incidentType: 'Điện thoại rơi từ bàn',
        initialSeconds: 20,
      );

      final handled = service.evaluateVoiceResponse('Tôi ổn không sao đâu');
      expect(handled, true);
      expect(service.state, VerificationState.suppressed);
      expect(service.suppressedFalseAlarmsCount, 1);
    });

    test('evaluateVoiceResponse recognizes "nhầm rồi" and cancels alarm', () {
      service.startGraceVerification(
        incidentType: 'Bỏ điện thoại vào túi xách mạnh',
        initialSeconds: 20,
      );

      final handled = service.evaluateVoiceResponse('Bấm nhầm rồi hủy đi');
      expect(handled, true);
      expect(service.state, VerificationState.suppressed);
    });

    test('evaluateVoiceResponse recognizes emergency phrase and escalates', () {
      var callbackTriggered = false;
      service.startGraceVerification(
        incidentType: 'Ngất xỉu trong phòng tắm',
        initialSeconds: 20,
        onAutoEscalate: () {
          callbackTriggered = true;
        },
      );

      final handled = service.evaluateVoiceResponse('Cứu tôi với cấp cứu');
      expect(handled, true);
      expect(service.state, VerificationState.escalated);
      expect(callbackTriggered, true);
      expect(service.confirmedEmergenciesCount, 1);
    });

    test('evaluateVoiceResponse ignores unrelated phrases', () {
      service.startGraceVerification(
        incidentType: 'Cử động tay mạnh',
        initialSeconds: 20,
      );

      final handled = service.evaluateVoiceResponse('Hôm nay trời đẹp quá');
      expect(handled, false);
      expect(service.state, VerificationState.graceCountdown);
    });
  });

  group('FalseAlarmVerificationDialog Widget Tests', () {
    late AppProvider appProvider;

    setUp(() {
      appProvider = AppProvider();
      FalseAlarmSuppressionService.instance.reset();
    });

    tearDown(() {
      TopToast.dismiss();
      FalseAlarmSuppressionService.instance.reset();
    });

    Widget createTestWidget(Widget child) {
      return MultiProvider(
        providers: [
          ChangeNotifierProvider<AppProvider>.value(value: appProvider),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: child,
          ),
        ),
      );
    }

    testWidgets('Renders countdown dialog with title, type, and buttons',
        (tester) async {
      await tester.pumpWidget(
        createTestWidget(
          Builder(
            builder: (context) {
              return ElevatedButton(
                onPressed: () {
                  FalseAlarmVerificationDialog.show(
                    context,
                    incidentType: 'Gia tốc va chạm 4.8g',
                    initialSeconds: 20,
                  );
                },
                child: const Text('SHOW_DIALOG'),
              );
            },
          ),
        ),
      );

      await tester.tap(find.text('SHOW_DIALOG'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.text('CƠ CHẾ KHỬ BÁO ĐỘNG GIẢ ĐA TẦNG'), findsOneWidget);
      expect(find.text('BẠN CÓ AN TOÀN KHÔNG?'), findsOneWidget);
      expect(find.textContaining('Gia tốc va chạm 4.8g'), findsOneWidget);
      expect(find.text('TÔI ỔN - HỦY BÁO ĐỘNG (I AM SAFE)'), findsOneWidget);
      expect(find.text('BỎ QUA CHỜ - PHÁT LỆNH CẤP CỨU NGAY'), findsOneWidget);

      TopToast.dismiss();
      await tester.pump(const Duration(seconds: 3));
    });

    testWidgets('Tapping "TÔI ỔN" button suppresses alarm and dismisses dialog',
        (tester) async {
      bool? result;

      await tester.pumpWidget(
        createTestWidget(
          Builder(
            builder: (context) {
              return ElevatedButton(
                onPressed: () async {
                  result = await FalseAlarmVerificationDialog.show(
                    context,
                    incidentType: 'Rơi tự do',
                    initialSeconds: 20,
                  );
                },
                child: const Text('SHOW_DIALOG'),
              );
            },
          ),
        ),
      );

      await tester.tap(find.text('SHOW_DIALOG'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // Bấm nút TÔI ỔN
      await tester.tap(find.text('TÔI ỔN - HỦY BÁO ĐỘNG (I AM SAFE)'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(result, false);
      expect(FalseAlarmSuppressionService.instance.state,
          VerificationState.suppressed);

      TopToast.dismiss();
      await tester.pump(const Duration(seconds: 3));
    });

    testWidgets('Tapping "BỎ QUA CHỜ" triggers instant emergency escalation',
        (tester) async {
      bool? result;

      await tester.pumpWidget(
        createTestWidget(
          Builder(
            builder: (context) {
              return ElevatedButton(
                onPressed: () async {
                  result = await FalseAlarmVerificationDialog.show(
                    context,
                    incidentType: 'Chấn thương nghiêm trọng',
                    initialSeconds: 20,
                  );
                },
                child: const Text('SHOW_DIALOG'),
              );
            },
          ),
        ),
      );

      await tester.tap(find.text('SHOW_DIALOG'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // Bấm nút BỎ QUA CHỜ
      await tester.tap(find.text('BỎ QUA CHỜ - PHÁT LỆNH CẤP CỨU NGAY'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(result, true);
      expect(FalseAlarmSuppressionService.instance.state,
          VerificationState.escalated);

      TopToast.dismiss();
      await tester.pump(const Duration(seconds: 3));
    });

    testWidgets('Tapping voice chip "Tôi ổn" cancels alarm via voice simulation',
        (tester) async {
      bool? result;

      await tester.pumpWidget(
        createTestWidget(
          Builder(
            builder: (context) {
              return ElevatedButton(
                onPressed: () async {
                  result = await FalseAlarmVerificationDialog.show(
                    context,
                    incidentType: 'Rung lắc xe đạp',
                    initialSeconds: 20,
                  );
                },
                child: const Text('SHOW_DIALOG'),
              );
            },
          ),
        ),
      );

      await tester.tap(find.text('SHOW_DIALOG'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // Chạm chip giả lập giọng nói: "Tôi ổn"
      await tester.tap(find.text('🗣️ "Tôi ổn"'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(result, false);
      expect(FalseAlarmSuppressionService.instance.state,
          VerificationState.suppressed);

      TopToast.dismiss();
      await tester.pump(const Duration(seconds: 3));
    });
  });
}
