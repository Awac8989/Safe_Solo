import 'package:flutter_test/flutter_test.dart';
import 'package:safesolo/core/constants.dart';
import 'package:safesolo/models/watch_protocol.dart';
import 'package:safesolo/services/pedometer_service.dart';
import 'package:safesolo/services/wear_os_service.dart';
import 'package:safesolo/services/watch_sync_manager.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Smartwatch Precision Measurement & Host Connectivity Tests', () {
    late WearOsService wearOs;
    late WatchSyncManager sync;

    setUp(() {
      wearOs = WearOsService.instance;
      sync = WatchSyncManager.instance;
      sync.initialize();
      sync.stopPeriodicChecks();
      wearOs.cancelPrecisionMeasurement();
    });

    tearDown(() {
      sync.stopPeriodicChecks();
      wearOs.cancelPrecisionMeasurement();
    });

    test('1. AppConstants.setHostIp configures custom LAN IP dynamically', () async {
      await AppConstants.setHostIp('192.168.1.55', port: 4000);
      expect(AppConstants.backendBaseUrl, equals('http://192.168.1.55:4000/api'));

      // Test with existing port in string
      await AppConstants.setHostIp('192.168.2.100:5000');
      expect(AppConstants.backendBaseUrl, equals('http://192.168.2.100:5000/api'));

      // Clean up back to default empty custom URL
      await AppConstants.setCustomBaseUrl('');
    });

    test('2. Precision measurement is rejected when watch is off wrist', () {
      wearOs.setOffWrist(true);
      expect(wearOs.isOffWrist, isTrue);

      wearOs.startPrecisionMeasurement();
      expect(wearOs.isPrecisionMeasuring, isFalse);
      expect(wearOs.precisionMeasureStatus, contains('Hãy đeo sát cổ tay'));
    });

    test('3. WatchSyncManager sends findPhonePing packet accurately', () async {
      WatchPacket? capturedPacket;
      final sub = sync.packetStream.listen((p) {
        if (p.action == WatchAction.findPhonePing) {
          capturedPacket = p;
        }
      });

      sync.sendFindPhonePing();
      await Future.delayed(const Duration(milliseconds: 50));

      expect(capturedPacket, isNotNull);
      expect(capturedPacket!.action, equals(WatchAction.findPhonePing));
      expect(capturedPacket!.sender, equals(WatchSender.watch));
      expect(capturedPacket!.payload['action'], equals('RING_PHONE_NOW'));

      await sub.cancel();
    });

    test('4. WatchSyncManager emits precisionMeasureResult and updates PedometerService', () async {
      WatchPacket? capturedPacket;
      final sub = sync.packetStream.listen((p) {
        if (p.action == WatchAction.precisionMeasureResult) {
          capturedPacket = p;
        }
      });

      sync.emitPrecisionMeasureResult(heartRate: 75, spO2: 99);
      await Future.delayed(const Duration(milliseconds: 50));

      expect(capturedPacket, isNotNull);
      expect(capturedPacket!.payload['heartRate'], equals(75));
      expect(capturedPacket!.payload['spO2'], equals(99));
      expect(capturedPacket!.payload['protocol'], equals('BIOACTIVE_CLINICAL_10S'));

      expect(wearOs.heartRate, equals(75));
      expect(wearOs.spO2, equals(99));
      expect(PedometerService.instance.heartRate, equals(75));
      expect(PedometerService.instance.spO2, equals(99));

      await sub.cancel();
    });

    test('5. Baseline vitals are medically stable and zero out when off-wrist', () {
      wearOs.setOffWrist(false);
      wearOs.updateMetrics(heartRate: 74, spO2: 98, isOffWrist: false);

      expect(wearOs.heartRate, equals(74));
      expect(wearOs.spO2, equals(98));

      // Tháo đồng hồ khỏi tay
      wearOs.setOffWrist(true);
      expect(wearOs.isOffWrist, isTrue);

      wearOs.updateMetrics(heartRate: 0, spO2: 0, isOffWrist: true);
      expect(wearOs.heartRate, equals(0));
      expect(wearOs.spO2, equals(0));
    });

    test('6. Bidirectional Dead-man check-in emits and resets status', () async {
      WatchPacket? capturedPacket;
      final sub = sync.packetStream.listen((p) {
        if (p.action == WatchAction.deadmanCheckin) {
          capturedPacket = p;
        }
      });

      sync.emitDeadmanCheckin(mood: 'Tôi an toàn');
      await Future.delayed(const Duration(milliseconds: 50));

      expect(capturedPacket, isNotNull);
      expect(capturedPacket!.payload['mood'], equals('Tôi an toàn'));
      expect(capturedPacket!.sender, equals(WatchSender.watch));

      await sub.cancel();
    });
  });
}
