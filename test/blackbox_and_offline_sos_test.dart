import 'package:flutter_test/flutter_test.dart';
import 'package:safesolo/services/offline_sos_service.dart';
import 'package:safesolo/services/blackbox_service.dart';

void main() {
  group('OfflineSosService Tests', () {
    final service = OfflineSosService.instance;

    test('formatEmergencySms creates compact SMS message with vitals and Google Maps link', () {
      final sms = service.formatEmergencySms(
        victimName: 'Minh Quan',
        lat: 10.77692,
        lng: 106.70091,
        heartRate: 135,
        spO2: 88,
        batteryLevel: 22,
        reason: 'TE NGA KHAN CAP',
      );

      expect(sms.contains('SAFESOLO SOS!'), isTrue);
      expect(sms.contains('Minh Quan'), isTrue);
      expect(sms.contains('HR:135'), isTrue);
      expect(sms.contains('SpO2:88%'), isTrue);
      expect(sms.contains('Pin:22%'), isTrue);
      expect(sms.contains('10.77692,106.70091'), isTrue);
      expect(sms.length, lessThan(160)); // Under single SMS limit
    });

    test('buildSmsUri correctly formats telephone and query params', () {
      final uri = service.buildSmsUri(
        phoneNumber: '0901-234-567',
        message: 'Can giup do!',
      );

      expect(uri.scheme, 'sms');
      expect(uri.path, '0901234567');
      expect(uri.queryParameters['body'], 'Can giup do!');
    });

    test('sendEmergencySms completes safely in test environment', () async {
      final result = await service.sendEmergencySms(
        phoneNumber: '0901234567',
        message: 'Test offline alert',
      );
      // In non-mobile mock environment, cannot launch SMS app directly but shouldn't crash
      expect(result, isA<bool>());
    });
  });

  group('BlackboxService Tests', () {
    test('BlackboxService executes capture without crashing', () async {
      final service = BlackboxService.instance;

      expect(service.isRecording, isFalse);

      final result = await service.captureAndUploadEvidence(
        userId: 'user_test_blackbox',
        triggerSource: 'DURESS_PIN',
      );

      expect(result, isNotNull);
      expect(service.isRecording, isFalse);
    });
  });
}
