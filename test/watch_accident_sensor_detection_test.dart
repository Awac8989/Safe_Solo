import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/core/widgets/top_toast.dart';
import 'package:safesolo/models/watch_protocol.dart';
import 'package:safesolo/services/ai_signal_processor.dart';
import 'package:safesolo/services/watch_sync_manager.dart';
import 'package:safesolo/services/wear_os_service.dart';
import 'package:safesolo/views/emergency/watch_accident_alert_dialog.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Watch Accident & Risk Detection Algorithm Tests', () {
    final ai = AiSignalProcessor.instance;

    test('High-G vehicular crash detection calculates SVM correctly and flags severe impact', () {
      // 5.5g on X, 3.5g on Y -> SVM = sqrt(5.5^2 + 3.5^2) = ~6.52g
      final result = ai.evaluateVehicularCrash(
        ax: 5.5,
        ay: 3.5,
        az: 1.0,
      );

      expect(result.isSevereCrash, isTrue);
      expect(result.svmG, greaterThanOrEqualTo(6.5));
      expect(result.accidentType, equals('VEHICULAR_HIGH_G_CRASH'));
      expect(result.impactSeverityScore, greaterThanOrEqualTo(90.0));
    });

    test('Normal everyday motion does not trigger crash alert', () {
      final result = ai.evaluateVehicularCrash(
        ax: 0.2,
        ay: 0.1,
        az: 0.98,
      );

      expect(result.isSevereCrash, isFalse);
      expect(result.accidentType, equals('NONE'));
    });

    test('Free-fall phase preceding impact correctly triggers FREE_FALL_IMPACT', () {
      final result = ai.evaluateFreeFallImpact(
        ax: 3.5,
        ay: 2.5,
        az: 1.0,
        hadFreeFallPhase: true,
      );

      expect(result.isSevereCrash, isTrue);
      expect(result.accidentType, equals('FREE_FALL_IMPACT'));
      expect(result.impactSeverityScore, equals(90.0));
    });

    test('Acute vitals risk flags hypoxia when SpO2 drops under 88%', () {
      final result = ai.evaluateAcuteVitalsRisk(
        heartRate: 152,
        spO2: 85,
      );

      expect(result.isCritical, isTrue);
      expect(result.riskType, equals('HYPOXIA_CRITICAL'));
      expect(result.riskScore, greaterThanOrEqualTo(90));
    });

    test('Acute vitals risk flags tachycardia when heart rate exceeds 145 BPM', () {
      final result = ai.evaluateAcuteVitalsRisk(
        heartRate: 156,
        spO2: 97,
      );

      expect(result.isCritical, isTrue);
      expect(result.riskType, equals('TACHYCARDIA_ACUTE'));
    });
  });

  group('WearOsService & WatchSyncManager Accident Emitter Tests', () {
    test('simulateAccidentCrash emits ACCIDENT_CRASH packet and starts countdown', () {
      final wear = WearOsService.instance;
      wear.simulateAccidentCrash();

      expect(wear.isCountdownActive, isTrue);
      expect(wear.currentSvmG, equals(6.5));
      expect(wear.emergencySignalType, equals('WATCH_ACCIDENT_CRASH'));

      final lastPacket = WatchSyncManager.instance.lastPacket;
      expect(lastPacket, isNotNull);
      expect(lastPacket!.action, equals(WatchAction.accidentCrash));
      expect(lastPacket.payload['svmG'], equals(6.5));

      // Cleanup
      wear.cancelEmergency();
      expect(wear.isCountdownActive, isFalse);
    });

    test('simulateFreeFall emits FREE_FALL_IMPACT packet and starts countdown', () {
      final wear = WearOsService.instance;
      wear.simulateFreeFall();

      expect(wear.isCountdownActive, isTrue);
      expect(wear.currentSvmG, equals(5.2));
      expect(wear.emergencySignalType, equals('WATCH_FREE_FALL_IMPACT'));

      final lastPacket = WatchSyncManager.instance.lastPacket;
      expect(lastPacket, isNotNull);
      expect(lastPacket!.action, equals(WatchAction.freeFallImpact));

      // Cleanup
      wear.cancelEmergency();
    });
  });

  group('WatchAccidentAlertDialog Widget Tests', () {
    testWidgets('Renders all telemetry metrics and allows dismissing safely', (tester) async {
      bool? dialogResult;

      await tester.pumpWidget(
        ChangeNotifierProvider(
          create: (_) => AppProvider(),
          child: MaterialApp(
            home: Scaffold(
              body: Builder(
                builder: (context) => ElevatedButton(
                  onPressed: () async {
                    dialogResult = await WatchAccidentAlertDialog.show(
                      context,
                      signalType: 'WATCH_ACCIDENT_CRASH',
                      title: '🚨 PHÁT HIỆN TAI NẠN VA CHẠM GIAO THÔNG',
                      message: 'Va chạm 6.5g phát hiện từ Galaxy Watch 5',
                      payload: {
                        'svmG': 6.5,
                        'tiltAngle': 78.0,
                        'heartRate': 138,
                        'spO2': 86,
                      },
                      initialSeconds: 30,
                    );
                  },
                  child: const Text('Open Modal'),
                ),
              ),
            ),
          ),
        ),
      );

      // Render widget
      await tester.pump();

      // Open the modal
      await tester.tap(find.text('Open Modal'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      // Check header and badge
      expect(find.text('SAMSUNG GALAXY WATCH 5 (SM-R900)'), findsOneWidget);
      expect(find.text('🚨 PHÁT HIỆN TAI NẠN VA CHẠM GIAO THÔNG'), findsOneWidget);

      // Check telemetry metrics
      expect(find.text('6.5g'), findsOneWidget);
      expect(find.text('78.0°'), findsOneWidget);
      expect(find.text('138 bpm'), findsOneWidget);
      expect(find.text('86%'), findsOneWidget);

      // Check countdown and action buttons
      expect(find.text('30'), findsOneWidget);
      expect(find.text('TÔI ỔN - HỦY BÁO ĐỘNG (I AM SAFE)'), findsOneWidget);
      expect(find.text('🚨 CẤP CỨU SOS NGAY (GỌI 115 & NGƯỜI THÂN)'), findsOneWidget);

      // Tap "TÔI ỔN"
      await tester.tap(find.text('TÔI ỔN - HỦY BÁO ĐỘNG (I AM SAFE)'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      // Dialog dismissed with false (safe)
      expect(dialogResult, isFalse);
      TopToast.dismiss();
      await tester.pump(const Duration(milliseconds: 300));
    });

    testWidgets('Tapping SOS button confirms emergency immediately', (tester) async {
      bool? dialogResult;

      await tester.pumpWidget(
        ChangeNotifierProvider(
          create: (_) => AppProvider(),
          child: MaterialApp(
            home: Scaffold(
              body: Builder(
                builder: (context) => ElevatedButton(
                  onPressed: () async {
                    dialogResult = await WatchAccidentAlertDialog.show(
                      context,
                      signalType: 'WATCH_ACCIDENT_CRASH',
                      title: '🚨 PHÁT HIỆN TAI NẠN VA CHẠM GIAO THÔNG',
                      payload: {
                        'svmG': 6.5,
                        'tiltAngle': 78.0,
                        'heartRate': 138,
                        'spO2': 86,
                      },
                      initialSeconds: 30,
                    );
                  },
                  child: const Text('Open Modal'),
                ),
              ),
            ),
          ),
        ),
      );

      await tester.pump();
      await tester.tap(find.text('Open Modal'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      // Tap "CẤP CỨU SOS NGAY"
      await tester.tap(find.text('🚨 CẤP CỨU SOS NGAY (GỌI 115 & NGƯỜI THÂN)'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      expect(dialogResult, isTrue);
      TopToast.dismiss();
      await tester.pump(const Duration(milliseconds: 300));
    });
  });
}
