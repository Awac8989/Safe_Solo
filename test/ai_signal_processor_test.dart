import 'package:flutter_test/flutter_test.dart';
import 'package:safesolo/services/ai_signal_processor.dart';

void main() {
  group('AiSignalProcessor Algorithms Suite', () {
    final ai = AiSignalProcessor.instance;

    test('1. Butterworth Bandpass Filter processes PPG sample', () {
      final sample = ai.filterPpgSample(1.5);
      expect(sample, isA<double>());
    });

    test('2. Moving Average Filter N=5 smooths signal', () {
      ai.movingAverage(10.0);
      ai.movingAverage(20.0);
      ai.movingAverage(30.0);
      ai.movingAverage(40.0);
      final avg = ai.movingAverage(50.0);
      expect(avg, equals(30.0));
    });

    test('3. Ratio of Ratios (R) calculates SpO2 accurately', () {
      // Normal healthy ratio
      final normalSpO2 = ai.calculateSpO2(
        acRed: 0.1,
        dcRed: 2.0,
        acIr: 0.12,
        dcIr: 2.0,
      );
      expect(normalSpO2, inInclusiveRange(85.0, 100.0));

      // Hypoxia high ratio
      final lowSpO2 = ai.calculateSpO2(
        acRed: 0.4,
        dcRed: 1.0,
        acIr: 0.2,
        dcIr: 1.0,
      );
      expect(lowSpO2, lessThan(90.0));
    });

    test('4. Kinematic SVM Thresholding detects 4.8g Hard Fall with >60 deg Tilt', () {
      // Normal walking: 1.0g along Z axis, 0 tilt
      final walk = ai.evaluateKinematicFall(ax: 0.1, ay: 0.2, az: 1.0);
      expect(walk.isFallDetected, isFalse);

      // Hard Fall: high impact 4.8g and lying orientation (az ~ 0, ax/ay high)
      final fall = ai.evaluateKinematicFall(ax: 3.5, ay: 3.2, az: 0.3, thresholdG: 2.5);
      expect(fall.svmG, greaterThan(2.5));
      expect(fall.tiltAngleDegrees, greaterThan(60.0));
      expect(fall.isFallDetected, isTrue);
    });

    test('5. Machine Learning SVM Classifier separates true fall from fast sit', () {
      final trueFall = ai.classifyFallWithAi(
        peakG: 4.8,
        postImpactTilt: 75.0,
        impactDurationMs: 140.0,
        postImpactMobility: 0.05, // Almost still
      );
      expect(trueFall, isTrue);

      final fastSit = ai.classifyFallWithAi(
        peakG: 1.8,
        postImpactTilt: 15.0,
        impactDurationMs: 60.0,
        postImpactMobility: 1.2, // Still moving
      );
      expect(fastSit, isFalse);
    });

    test('6. Survival Risk Score (SRS) calculates risk levels', () {
      // Normal vitals
      final normal = ai.calculateSurvivalRisk(spO2: 98, heartRate: 72);
      expect(normal.level, contains('NORMAL'));
      expect(normal.score, lessThan(30));

      // Critical vitals: SpO2 82% + Tachycardia + Hard Fall
      final critical = ai.calculateSurvivalRisk(
        spO2: 82,
        heartRate: 145,
        isFallOccurred: true,
      );
      expect(critical.level, contains('CRITICAL'));
      expect(critical.score, greaterThanOrEqualTo(60));
    });

    test('7. Shake-to-SOS detects rapid shaking', () {
      // 1-3 shakes -> false
      expect(ai.registerShakeEvent(25.0), isFalse);
      expect(ai.registerShakeEvent(26.0), isFalse);
      expect(ai.registerShakeEvent(28.0), isFalse);
      // 4th shake in quick succession -> true!
      expect(ai.registerShakeEvent(27.0), isTrue);
    });

    test('8. AI Voice Keyword Spotting detects distress phrases', () {
      expect(ai.matchEmergencyVoiceKeyword('Cứu tôi với tôi bị ngã'), isTrue);
      expect(ai.matchEmergencyVoiceKeyword('Help me please'), isTrue);
      expect(ai.matchEmergencyVoiceKeyword('Hôm nay thời tiết đẹp quá'), isFalse);
    });
  });
}
