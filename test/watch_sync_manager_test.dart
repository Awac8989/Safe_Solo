import 'package:flutter_test/flutter_test.dart';
import 'package:safesolo/models/watch_protocol.dart';
import 'package:safesolo/services/watch_sync_manager.dart';

void main() {
  group('SafeSolo Watch Protocol (SSWP) & WatchSyncManager Tests', () {
    tearDown(() {
      WatchSyncManager.instance.stopPeriodicChecks();
    });

    test('WatchPacket serializes and deserializes accurately', () {
      final packet = WatchPacket.create(
        sender: WatchSender.watch,
        type: WatchPacketType.emergency,
        action: WatchAction.fallDetected,
        payload: {
          'svmG': 4.8,
          'tiltAngle': 72.0,
          'isSimulated': true,
        },
      );

      final rawJson = packet.serialize();
      expect(rawJson, contains('SAFESOLO_WATCH_V1'));
      expect(rawJson, contains('FALL_DETECTED'));
      expect(rawJson, contains('4.8'));

      final parsed = WatchPacket.deserialize(rawJson);
      expect(parsed, isNotNull);
      expect(parsed!.sender, equals(WatchSender.watch));
      expect(parsed.type, equals(WatchPacketType.emergency));
      expect(parsed.action, equals(WatchAction.fallDetected));
      expect(parsed.payload['svmG'], equals(4.8));
      expect(parsed.payload['tiltAngle'], equals(72.0));
    });

    test('WatchPacket handles command and telemetry packets', () {
      final cmd = WatchPacket.create(
        sender: WatchSender.phone,
        type: WatchPacketType.command,
        action: WatchAction.findWatchPing,
        payload: {'vibratePattern': [500, 200, 500]},
      );

      expect(cmd.sender, equals(WatchSender.phone));
      expect(cmd.action, equals(WatchAction.findWatchPing));

      final telemetry = WatchPacket.create(
        sender: WatchSender.watch,
        type: WatchPacketType.telemetry,
        action: WatchAction.vitalsUpdate,
        payload: {
          'heartRate': 85,
          'spO2': 98,
          'battery': 88,
        },
      );

      expect(telemetry.sender, equals(WatchSender.watch));
      expect(telemetry.payload['heartRate'], equals(85));
    });

    test('WatchSyncManager pairing code request and verification flow', () async {
      final sync = WatchSyncManager.instance;
      sync.initialize();

      // Request pairing code (fallback in-memory)
      final code = await sync.requestNewPairingCode(deviceId: 'galaxy_watch_test');
      expect(code, isNotEmpty);
      expect(code, contains('-'));
      expect(code.length, equals(7)); // "XXX-XXX"

      // Verify code
      final verified = await sync.verifyPairingCode(code, userId: 'test_user_123');
      expect(verified, isTrue);
      expect(sync.isPaired, isTrue);
      expect(sync.pairedUserId, equals('test_user_123'));
    });

    test('WatchSyncManager broadcasts packets through packetStream', () async {
      final sync = WatchSyncManager.instance;
      final emittedPackets = <WatchPacket>[];

      final sub = sync.packetStream.listen((pkt) {
        emittedPackets.add(pkt);
      });

      sync.emitHardwareSos(userId: 'test_user_123');
      sync.sendFindWatchPing();
      sync.sendInstantMeasureRequest();

      await Future<void>.delayed(const Duration(milliseconds: 50));

      expect(emittedPackets.length, greaterThanOrEqualTo(3));
      expect(emittedPackets.any((p) => p.action == WatchAction.hardwareSos), isTrue);
      expect(emittedPackets.any((p) => p.action == WatchAction.findWatchPing), isTrue);
      expect(emittedPackets.any((p) => p.action == WatchAction.instantMeasureReq), isTrue);

      await sub.cancel();
    });
  });
}
