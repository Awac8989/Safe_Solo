import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:safesolo/models/live_journey_model.dart';
import 'package:safesolo/core/providers/app_provider.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  SharedPreferences.setMockInitialValues({});

  group('LiveJourneyModel Unit Tests', () {
    test('LiveJourneyModel initializes correctly and calculates remainingFormatted', () {
      final now = DateTime.now();
      final expected = now.add(const Duration(minutes: 20));

      final journey = LiveJourneyModel(
        id: 'journey_123',
        destinationLabel: 'Nhà riêng',
        durationMinutes: 20,
        startedAt: now,
        expectedArrivalAt: expected,
        status: 'IN_TRANSIT',
        shareToken: 'token_abc',
        currentLat: 10.7769,
        currentLng: 106.7009,
        remainingSeconds: 1200,
      );

      expect(journey.isInTransit, isTrue);
      expect(journey.isOverdue, isFalse);
      expect(journey.isArrived, isFalse);
      expect(journey.remainingFormatted, '20:00');
    });

    test('LiveJourneyModel detects overdue status when past deadline', () {
      final past = DateTime.now().subtract(const Duration(minutes: 5));
      final journey = LiveJourneyModel(
        id: 'journey_overdue',
        destinationLabel: 'Về nhà muộn',
        durationMinutes: 15,
        startedAt: past.subtract(const Duration(minutes: 15)),
        expectedArrivalAt: past,
        status: 'OVERDUE_ALARM',
        shareToken: 'token_xyz',
      );

      expect(journey.isOverdue, isTrue);
      expect(journey.remainingFormatted, '00:00');
    });

    test('LiveJourneyModel serialization and deserialization preserves all fields', () {
      final now = DateTime.now();
      final model = LiveJourneyModel(
        id: 'j_999',
        destinationLabel: 'Công ty',
        destinationLat: 10.8,
        destinationLng: 106.6,
        durationMinutes: 30,
        startedAt: now,
        expectedArrivalAt: now.add(const Duration(minutes: 30)),
        status: 'ARRIVED_SAFE',
        shareToken: 'token_test_999',
        currentLat: 10.8,
        currentLng: 106.6,
        batteryLevel: 85,
      );

      final json = model.toJson();
      final restored = LiveJourneyModel.fromJson(json);

      expect(restored.id, 'j_999');
      expect(restored.destinationLabel, 'Công ty');
      expect(restored.durationMinutes, 30);
      expect(restored.isArrived, isTrue);
      expect(restored.shareToken, 'token_test_999');
      expect(restored.batteryLevel, 85);
    });
  });

  group('AppProvider Live Journey Lifecycle Tests', () {
    test('AppProvider starts, extends, finishes, and cancels live journey', () async {
      final provider = AppProvider();

      // Start journey
      final journey = await provider.startLiveJourney(
        destination: 'Ký túc xá Đại học',
        durationMinutes: 25,
      );

      expect(journey, isNotNull);
      expect(provider.activeJourney, isNotNull);
      expect(provider.activeJourney!.destinationLabel, 'Ký túc xá Đại học');
      expect(provider.activeJourney!.isInTransit, isTrue);

      // Extend journey
      final initialDeadline = provider.activeJourney!.expectedArrivalAt;
      await provider.extendLiveJourney(minutes: 10);
      expect(
        provider.activeJourney!.expectedArrivalAt.isAfter(initialDeadline),
        isTrue,
      );

      // Finish journey
      await provider.finishLiveJourney();
      expect(provider.activeJourney!.isArrived, isTrue);

      // Cancel journey
      await provider.cancelLiveJourney();
      expect(provider.activeJourney, isNull);
    });
  });
}
