import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/services/walkie_talkie_service.dart';
import 'package:safesolo/views/audio/walkie_talkie_dialog.dart';
import 'package:provider/provider.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('WalkieTalkieService Tests', () {
    final service = WalkieTalkieService.instance;

    tearDown(() {
      service.stopTalking();
    });

    test('Initial state is idle', () {
      expect(service.state.isIdle, true);
      expect(service.state.isTransmitting, false);
      expect(service.state.isReceiving, false);
    });

    test('Switching channels updates channelId and channelName', () {
      service.joinChannel(channelId: 'channel_family', channelName: 'Kênh Gia Đình');
      expect(service.state.channelId, 'channel_family');
      expect(service.state.channelName, 'Kênh Gia Đình');

      service.joinChannel(channelId: 'channel_emergency_main', channelName: 'Kênh Cứu hộ Tác chiến');
      expect(service.state.channelId, 'channel_emergency_main');
      expect(service.state.channelName, 'Kênh Cứu hộ Tác chiến');
    });

    test('startTalking changes state to transmitting and stopTalking resets to idle', () {
      var notified = false;
      void listener() {
        notified = true;
      }

      service.stateNotifier.addListener(listener);

      service.startTalking(speakerName: 'Bạn');
      expect(service.state.isTransmitting, true);
      expect(service.state.role, WalkieTalkieRole.transmitting);
      expect(notified, true);

      service.stopTalking();
      expect(service.state.isTransmitting, false);
      expect(service.state.isIdle, true);

      service.stateNotifier.removeListener(listener);
    });

    test('Audio wave is populated with values', () {
      expect(service.state.audioWave.isNotEmpty, true);
      for (final val in service.state.audioWave) {
        expect(val >= 0.0 && val <= 1.0, true);
      }
    });
  });

  group('WalkieTalkieDialog Widget Tests', () {
    testWidgets('renders tactical PTT dialog with channels and button', (tester) async {
      await tester.pumpWidget(
        ChangeNotifierProvider(
          create: (_) => AppProvider(),
          child: const MaterialApp(
            home: Scaffold(
              body: WalkieTalkieDialog(),
            ),
          ),
        ),
      );

      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('SafeSolo Walkie-Talkie'), findsOneWidget);
      expect(find.text('GIỮ ĐỂ NÓI'), findsOneWidget);
      expect(find.text('PTT Audio'), findsOneWidget);
    });
  });
}
