import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/services/pedometer_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('Passive Smart Check-in Tests', () {
    test('PedometerService detects step burst > 200 steps and triggers onStepBurstDetected', () {
      final pedometer = PedometerService.instance;
      pedometer.resetBurstCheckpoint(pedometer.steps);

      int detectedTotal = 0;
      int detectedBurst = 0;
      pedometer.onStepBurstDetected = (total, burst) {
        detectedTotal = total;
        detectedBurst = burst;
      };

      final startSteps = pedometer.steps;
      // Increase steps by 210 (> 200 threshold)
      pedometer.simulateWalkingBurst(burstSteps: 210);

      expect(detectedBurst, 210);
      expect(detectedTotal, startSteps + 210);
      expect(pedometer.lastBurstCheckpoint, detectedTotal);
    });

    test('PedometerService does not trigger burst when under 200 steps', () {
      final pedometer = PedometerService.instance;
      pedometer.resetBurstCheckpoint(pedometer.steps);

      bool triggered = false;
      pedometer.onStepBurstDetected = (total, burst) {
        triggered = true;
      };

      // Increase steps by only 25
      pedometer.simulateWalking();

      expect(triggered, isFalse);
    });

    test('AppProvider executes smart passive check-in and resets deadline to full cycle', () async {
      final provider = AppProvider();

      // Seed mock user with 12h interval (720 minutes)
      final initialDeadline = DateTime.now().add(const Duration(minutes: 15));
      provider.setUserForTest(
        User(
          id: 'test_user_smart_passive',
          name: 'Nguyen Van An',
          email: 'an@safesolo.vn',
          phoneNumber: '0901234567',
          timerIntervalMinutes: 720,
          currentStatus: 'SAFE',
          quietHoursStart: '22:00',
          quietHoursEnd: '07:00',
          falseAlertGraceMinutes: 15,
          nextDeadline: initialDeadline,
        ),
      );

      // Perform smart passive check-in via PEDOMETER_BURST
      await provider.performSmartPassiveCheckIn(
        source: 'PEDOMETER_BURST',
        metadata: {'burstSteps': 210, 'totalSteps': 4490},
      );

      expect(provider.user, isNotNull);
      expect(provider.user!.currentStatus, 'SAFE');
      // After smart passive checkin, next deadline should be extended into the future
      expect(
        provider.user!.nextDeadline?.isAfter(DateTime.now().add(const Duration(hours: 1))) ?? false,
        isTrue,
      );
    });

    test('AppProvider morning charger unplug triggers smart passive check-in', () async {
      final provider = AppProvider();
      provider.setUserForTest(
        User(
          id: 'test_user_charger',
          name: 'Tran Thi Binh',
          email: 'binh@safesolo.vn',
          phoneNumber: '0909876543',
          timerIntervalMinutes: 1440, // 24h
          currentStatus: 'SAFE',
          quietHoursStart: '22:00',
          quietHoursEnd: '07:00',
          falseAlertGraceMinutes: 15,
          nextDeadline: DateTime.now().add(const Duration(minutes: 30)),
        ),
      );

      await provider.performSmartPassiveCheckIn(
        source: 'CHARGER_UNPLUGGED',
        metadata: {'morningRoutine': true},
      );

      expect(provider.user!.currentStatus, 'SAFE');
      expect(
        provider.user!.nextDeadline?.isAfter(DateTime.now().add(const Duration(hours: 1))) ?? false,
        isTrue,
      );
    });
  });

  group('Journey Check-in (Check-in theo lộ trình) Tests', () {
    test('AppProvider starts 30-minute quick protection journey with correct metadata', () async {
      final provider = AppProvider();

      final journey = await provider.startLiveJourney(
        destination: 'Đi làm ca đêm qua đoạn vắng',
        durationMinutes: 30,
      );

      expect(journey, isNotNull);
      expect(provider.activeJourney, isNotNull);
      expect(provider.activeJourney!.destinationLabel, 'Đi làm ca đêm qua đoạn vắng');
      expect(provider.activeJourney!.durationMinutes, 30);
      expect(provider.activeJourney!.isInTransit, isTrue);
      expect(provider.hasEscalatedJourneyOverdue, isFalse);
    });

    test('AppProvider automatically escalates overdue journey to emergency SOS distress', () async {
      final provider = AppProvider();

      // Start journey
      await provider.startLiveJourney(
        destination: 'Về nhà muộn',
        durationMinutes: 30,
      );

      expect(provider.hasEscalatedJourneyOverdue, isFalse);

      // Trigger automatic overdue escalation (simulating countdown timer hit 0)
      await provider.escalateOverdueJourney();

      expect(provider.hasEscalatedJourneyOverdue, isTrue);
      expect(provider.activeJourney!.isOverdue, isTrue);
    });

    test('Finishing journey marks ARRIVED_SAFE and concludes protection', () async {
      final provider = AppProvider();

      await provider.startLiveJourney(
        destination: 'Về nhà an toàn',
        durationMinutes: 45,
      );

      expect(provider.activeJourney!.isInTransit, isTrue);

      await provider.finishLiveJourney();

      expect(provider.activeJourney!.isArrived, isTrue);
      expect(provider.activeJourney!.isInTransit, isFalse);
    });
  });

  group('7 Advanced Survival Check-in Mechanisms Tests', () {
    late AppProvider provider;
    late User testUser;

    setUp(() {
      provider = AppProvider();
      testUser = User(
        id: 'test_user_7_arsenal',
        name: 'Đoàn Minh Quân',
        email: 'quan@safesolo.vn',
        phoneNumber: '0901234567',
        timerIntervalMinutes: 720, // 12 hours
        currentStatus: 'SAFE',
        quietHoursStart: '23:00',
        quietHoursEnd: '06:00',
        falseAlertGraceMinutes: 15,
        nextDeadline: DateTime.now().add(const Duration(minutes: 20)),
      );
      provider.setUserForTest(testUser);
    });

    test('1. Sleep Wake-up Pulse Check-in renews safe cycle (+12h)', () async {
      await provider.performWakeUpPulseCheckin(
        restingBpm: 56,
        wakeBpm: 79,
        movementDetected: true,
      );

      expect(provider.user, isNotNull);
      expect(provider.user!.currentStatus, 'SAFE');
      expect(
        provider.user!.nextDeadline?.isAfter(DateTime.now().add(const Duration(hours: 1))) ?? false,
        isTrue,
      );
    });

    test('1b. Evaluates abnormal sleep pulse health after 9:30 AM', () async {
      // Normal pulse after 9:30 AM -> True (Safe)
      final normal = await provider.evaluateSleepPulseHealth(
        currentBpm: 74,
        time: DateTime(2026, 10, 1, 9, 45),
      );
      expect(normal, isTrue);

      // Dangerous pulse (<55 bpm) after 9:30 AM -> False (Critical alert)
      final critical = await provider.evaluateSleepPulseHealth(
        currentBpm: 46,
        time: DateTime(2026, 10, 1, 9, 45),
      );
      expect(critical, isFalse);
    });

    test('2. Home Wi-Fi & Docking Anchor activates Quiet Hours rest mode', () async {
      expect(provider.isQuietHoursMode, isFalse);

      await provider.handleHomeArrivalAndDocking(
        isHomeWifi: true,
        isCharging: true,
        ssid: 'SafeSolo_Home_5G',
      );

      expect(provider.isQuietHoursMode, isTrue);
      expect(provider.user!.currentStatus, 'SAFE');
      expect(
        provider.user!.nextDeadline?.isAfter(DateTime.now().add(const Duration(hours: 1))) ?? false,
        isTrue,
      );
    });

    test('3. Wear OS Double Wrist-Twist Gesture performs check-in', () async {
      await provider.performWristTwistCheckin();

      expect(provider.user!.currentStatus, 'SAFE');
      expect(
        provider.user!.nextDeadline?.isAfter(DateTime.now().add(const Duration(hours: 1))) ?? false,
        isTrue,
      );
    });

    test('4. Hardware Key Combo performs silent check-in', () async {
      await provider.performHardwareKeyComboCheckin();

      expect(provider.user!.currentStatus, 'SAFE');
      expect(
        provider.user!.nextDeadline?.isAfter(DateTime.now().add(const Duration(hours: 1))) ?? false,
        isTrue,
      );
    });

    test('5a. Voice Check-in with normal safe phrase renews timer', () async {
      final result = await provider.processVoiceCheckinPhrase('SafeSolo, tôi an toàn');

      expect(result.success, isTrue);
      expect(result.isDuress, isFalse);
      expect(result.message.contains('an toàn'), isTrue);
      expect(provider.user!.currentStatus, 'SAFE');
    });

    test('5b. Voice Check-in with stealth duress word triggers secret SOS deception', () async {
      final result = await provider.processVoiceCheckinPhrase('Tôi đang rất bận');

      // UI deceives intruder with success message
      expect(result.success, isTrue);
      // Secretly marked as duress
      expect(result.isDuress, isTrue);
    });

    test('6. Buddy / Couple Cross Check-in confirms mutual safety', () async {
      await provider.performBuddyCrossCheckin(
        buddyId: 'user_mom_002',
        buddyName: 'Mẹ Lan (ICE)',
      );

      expect(provider.user!.currentStatus, 'SAFE');
      expect(
        provider.user!.nextDeadline?.isAfter(DateTime.now().add(const Duration(hours: 1))) ?? false,
        isTrue,
      );
    });

    test('7. Medication Vision Check-in records medical compliance and safety', () async {
      await provider.performMedicationVisionCheckin(
        pillName: 'Amlodipine 5mg',
        note: 'Đã uống 1 viên sáng theo toa',
      );

      expect(provider.user!.currentStatus, 'SAFE');
      expect(
        provider.user!.nextDeadline?.isAfter(DateTime.now().add(const Duration(hours: 1))) ?? false,
        isTrue,
      );
    });
  });
}
