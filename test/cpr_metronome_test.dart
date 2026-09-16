import 'package:flutter_test/flutter_test.dart';
import 'package:safesolo/services/cpr_metronome_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('CprMetronomeService Suite', () {
    final service = CprMetronomeService.instance;

    tearDown(() {
      service.stop();
    });

    test('CprMetronomeService initializes with AHA 110 BPM default and idle phase', () {
      expect(service.isRunning, isFalse);
      expect(service.state.phase, CprPhase.idle);
      expect(service.state.bpm, 110);
      expect(service.state.compressionCount, 0);
      expect(service.state.cycleCount, 1);
    });

    test('CprMetronomeService starts compressing and updates state notifier', () {
      service.start(bpm: 110);
      expect(service.isRunning, isTrue);
      expect(service.state.phase, CprPhase.compressing);
      expect(service.state.bpm, 110);
    });

    test('CprMetronomeService stops and resets compression count to zero', () {
      service.start(bpm: 110);
      expect(service.isRunning, isTrue);

      service.stop();
      expect(service.isRunning, isFalse);
      expect(service.state.phase, CprPhase.idle);
      expect(service.state.compressionCount, 0);
    });
  });
}
