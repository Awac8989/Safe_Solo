import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/models/fake_call_config.dart';
import 'package:safesolo/services/fake_call_service.dart';
import 'package:safesolo/views/audio/fake_call_screen.dart';
import 'package:safesolo/views/audio/fake_call_setup_sheet.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('FakeCallService Tests', () {
    final service = FakeCallService.instance;

    tearDown(() {
      service.endCall();
    });

    test('Initial default config has Papa preset and dialogue', () {
      expect(service.config.callerName, 'Bố');
      expect(service.config.callerNumber, '+84 912 345 678');
      expect(service.config.scenarioDialogue.isNotEmpty, true);
    });

    test('scheduleFakeCall triggers ringing immediately if delay is 0', () {
      var ringingFired = false;
      service.scheduleFakeCall(
        customConfig: const FakeCallConfig(
          callerName: 'Công an Phường',
          callerNumber: '113',
          delaySeconds: 0,
        ),
        onRinging: () {
          ringingFired = true;
        },
      );

      expect(service.status, FakeCallStatus.ringing);
      expect(ringingFired, true);
      expect(service.config.callerName, 'Công an Phường');
    });

    test('acceptCall transitions status to inCall and increments duration', () {
      service.scheduleFakeCall(
        customConfig: const FakeCallConfig(delaySeconds: 0),
      );
      service.acceptCall();

      expect(service.status, FakeCallStatus.inCall);
      expect(service.callDurationSeconds, 0);
    });

    test('endCall cancels call and cleans timers', () {
      service.scheduleFakeCall(
        customConfig: const FakeCallConfig(delaySeconds: 0),
      );
      service.acceptCall();
      service.endCall();

      expect(service.status, FakeCallStatus.finished);
    });
  });

  group('Fake Call Widgets Test', () {
    testWidgets('renders FakeCallSetupSheet with presets and start button', (tester) async {
      await tester.pumpWidget(
        ChangeNotifierProvider(
          create: (_) => AppProvider(),
          child: const MaterialApp(
            home: Scaffold(
              body: FakeCallSetupSheet(),
            ),
          ),
        ),
      );

      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Cuộc gọi Thoát hiểm Ngụy trang'), findsOneWidget);
      expect(find.text('Bố'), findsWidgets);
      expect(find.text('ĐỔ CHUÔNG NGAY BÂY GIỜ'), findsOneWidget);
    });

    testWidgets('renders FakeCallScreen in ringing state with Accept/Decline', (tester) async {
      FakeCallService.instance.scheduleFakeCall(
        customConfig: const FakeCallConfig(
          callerName: 'Đội Trọng Án 113',
          callerNumber: '024 113',
          delaySeconds: 0,
        ),
      );

      await tester.pumpWidget(
        ChangeNotifierProvider(
          create: (_) => AppProvider(),
          child: const MaterialApp(
            home: FakeCallScreen(),
          ),
        ),
      );

      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Đội Trọng Án 113'), findsOneWidget);
      expect(find.text('Cuộc gọi đến...'), findsOneWidget);
      expect(find.text('Từ chối'), findsOneWidget);
      expect(find.text('Trả lời'), findsOneWidget);

      FakeCallService.instance.endCall();
      // Pump past the 500ms delayed reset timer in endCall()
      await tester.pump(const Duration(milliseconds: 600));
    });
  });
}
