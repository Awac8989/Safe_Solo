import 'package:flutter_test/flutter_test.dart';
import 'package:safesolo/models/watch_protocol.dart';
import 'package:safesolo/services/journey_anomaly_service.dart';
import 'package:safesolo/services/watch_sync_manager.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Nhóm 3 — Route Deviation (>300m) & Stationary (>3m) + Watch 5 Prompt', () {
    test('Route deviation >300m triggers Watch 5 prompt and Watch safe-ack clears it', () {
      var fakeNow = DateTime(2026, 11, 25, 22, 0, 0);
      final detector = JourneyAnomalyService.testable(clock: () => fakeNow);

      JourneyAnomalyKind? triggeredKind;
      double triggeredMeters = 0;
      String? confirmedSource;

      detector.onTriggerWatchPrompt = ({
        required String journeyId,
        required JourneyAnomalyKind kind,
        required String reason,
        required double deviationMeters,
        required int stationarySeconds,
      }) {
        triggeredKind = kind;
        triggeredMeters = deviationMeters;
      };
      detector.onConfirmedSafe = (_, source) {
        confirmedSource = source;
      };

      // Tuyến đường dự kiến: (10.7769, 106.7009) -> (10.7900, 106.7009)
      detector.startMonitoring(
        journeyId: 'j_route_1',
        startLat: 10.7769,
        startLng: 106.7009,
        destLat: 10.7900,
        destLng: 106.7009,
      );

      // Đi đúng tuyến ~500m dọc theo trục Bắc-Nam -> Không báo động
      fakeNow = fakeNow.add(const Duration(seconds: 40));
      detector.ingestPosition(lat: 10.7815, lng: 106.7011, timestamp: fakeNow, startCountdownTimer: false);
      expect(detector.phase, JourneyAnomalyPhase.monitoring);

      // Lệch ngang về hướng Đông ~650m (>300m) -> Đẩy ping hỏi Watch 5 "Bạn ổn chứ?"
      fakeNow = fakeNow.add(const Duration(seconds: 30));
      detector.ingestPosition(lat: 10.7815, lng: 106.7070, timestamp: fakeNow, startCountdownTimer: false);

      expect(detector.phase, JourneyAnomalyPhase.awaitingWatchConfirm);
      expect(triggeredKind, JourneyAnomalyKind.routeDeviation);
      expect(triggeredMeters, greaterThan(300));
      expect(detector.confirmRemainingSeconds, 30);

      // Watch 5 bấm "Tôi ổn" trong 30 giây -> Xác nhận an toàn
      detector.confirmWellbeing(source: 'WATCH_5');
      expect(detector.phase, JourneyAnomalyPhase.safeConfirmed);
      expect(confirmedSource, 'WATCH_5');
    });

    test('Stationary outside safe zone >180s triggers Watch check and 30s timeout escalates SOS', () {
      var fakeNow = DateTime(2026, 11, 25, 22, 10, 0);
      final detector = JourneyAnomalyService.testable(clock: () => fakeNow);

      JourneyAnomalyKind? triggeredKind;
      var escalated = false;
      String? escalateReason;

      detector.onTriggerWatchPrompt = ({
        required String journeyId,
        required JourneyAnomalyKind kind,
        required String reason,
        required double deviationMeters,
        required int stationarySeconds,
      }) {
        triggeredKind = kind;
      };
      detector.onEscalateTimeout = ({
        required String journeyId,
        required JourneyAnomalyKind kind,
        required String reason,
        required double deviationMeters,
        required int stationarySeconds,
      }) {
        escalated = true;
        escalateReason = reason;
      };

      detector.startMonitoring(
        journeyId: 'j_stat_1',
        startLat: 10.7769,
        startLng: 106.7009,
        destLat: 10.7900,
        destLng: 106.7009,
      );

      // Di chuyển tới giữa đường (cách đích > 120m) rồi đứng im tại chỗ trong 190 giây (> 3 phút)
      fakeNow = fakeNow.add(const Duration(seconds: 30));
      detector.ingestPosition(lat: 10.7820, lng: 106.7009, timestamp: fakeNow, startCountdownTimer: false);
      fakeNow = fakeNow.add(const Duration(seconds: 190));
      detector.ingestPosition(lat: 10.78202, lng: 106.70091, timestamp: fakeNow, startCountdownTimer: false);

      expect(detector.phase, JourneyAnomalyPhase.awaitingWatchConfirm);
      expect(triggeredKind, JourneyAnomalyKind.stationaryOutsideSafeZone);

      // Quá 30s Watch 5 không phản hồi -> Leo thang cảnh báo TOC & người thân
      detector.escalateNow();
      expect(detector.phase, JourneyAnomalyPhase.escalated);
      expect(escalated, isTrue);
      expect(escalateReason, isNotNull);
    });
  });

  group('WatchSyncManager Journey Check Packet Handlers', () {
    test('Bidirectional ROUTE_DEVIATION_CHECK & JOURNEY_CHECK_SAFE callbacks fire', () async {
      final mgr = WatchSyncManager.instance;
      mgr.initialize();
      String? promptText;
      var safeAckReceived = false;

      mgr.onRouteDeviationCheckReceived = (payload) {
        promptText = payload['prompt']?.toString();
      };
      mgr.onJourneyCheckSafeReceived = (_) {
        safeAckReceived = true;
      };

      mgr.setIsRunningOnWatch(true);
      mgr.sendRouteDeviationCheck(
        journeyId: 'j_123',
        reason: 'Lệch tuyến 420m',
        deviationMeters: 420,
      );
      await Future<void>.delayed(Duration.zero);
      expect(promptText, 'Bạn ổn chứ?');

      mgr.setIsRunningOnWatch(false);
      mgr.emitJourneyCheckSafe(journeyId: 'j_123', userId: 'usr-01');
      await Future<void>.delayed(Duration.zero);
      expect(safeAckReceived, isTrue);
    });
  });
}
