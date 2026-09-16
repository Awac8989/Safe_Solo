import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/services/offline_resilience_service.dart';
import 'package:safesolo/views/emergency/offline_emergency_sheet.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('OfflineResilienceService Unit Tests', () {
    final service = OfflineResilienceService.instance;

    setUp(() {
      service.recordGpsPosition(
        lat: 10.7769,
        lng: 106.7009,
        address: '18 Lê Lợi, Bến Nghé, Quận 1',
        pressureHpa: 1013.25,
      );
      service.stopAcousticRescueSiren();
    });

    test('Initial GPS position recording and LKL status', () {
      expect(service.hasGpsSignal, true);
      expect(service.lastKnownLat, 10.7769);
      expect(service.lastKnownLng, 106.7009);
      expect(service.stepsSinceGpsLoss, 0);
    });

    test('Mark GPS lost and record indoor movement calculates PDR', () {
      service.markGpsLost();
      expect(service.hasGpsSignal, false);

      // Đi 100 bước hướng Đông (90 độ)
      service.recordIndoorMovement(newSteps: 100, headingDegrees: 90.0);
      expect(service.stepsSinceGpsLoss, 100);

      final pdr = service.calculatePdrEstimate();
      expect(pdr.stepsFromGpsLost, 100);
      expect(pdr.estimatedDistanceMeters, 72.0); // 100 * 0.72m
      expect(pdr.headingDegrees, 90.0);
      expect(pdr.estimatedLng > pdr.lastKnownLng, true); // Đi về phía Đông -> kinh độ tăng
    });

    test('estimateFloor accurately calculates basements vs upper floors', () {
      // Áp suất tăng (xuống sâu dưới hầm): P > P0 -> deltaP < 0
      final basementFloor = service.estimateFloor(
        pressureHpa: 1014.0, // Cao hơn chuẩn 0.75 hPa -> sâu khoảng 6.2m
        baselineHpa: 1013.25,
      );
      expect(basementFloor.contains('Tầng hầm'), true);

      // Áp suất giảm (lên tầng cao): P < P0 -> deltaP > 0
      final highFloor = service.estimateFloor(
        pressureHpa: 1010.0, // Thấp hơn chuẩn 3.25 hPa -> cao khoảng 27m
        baselineHpa: 1013.25,
      );
      expect(highFloor.contains('Tầng cao'), true);

      // Bằng áp suất chuẩn -> Mặt đất
      final groundFloor = service.estimateFloor(
        pressureHpa: 1013.25,
        baselineHpa: 1013.25,
      );
      expect(groundFloor.contains('Mặt đất'), true);
    });

    test('Comprehensive offline SMS payload formatting', () {
      service.markGpsLost();
      service.recordIndoorMovement(newSteps: 50, headingDegrees: 180.0);

      final sms = service.formatComprehensiveOfflineSms(
        victimName: 'Nguyễn Văn An',
        bloodType: 'O+',
        criticalAllergy: 'Penicillin',
        heartRate: 115,
        spO2: 97,
        batteryLevel: 68,
      );

      expect(sms.contains('SOS SAFESOLO!'), true);
      expect(sms.contains('Máu:O+'), true);
      expect(sms.contains('Dị ứng:Penicillin'), true);
      expect(sms.contains('HR:115'), true);
      expect(sms.contains('SpO2:97%'), true);
      expect(sms.contains('PDR:'), true);
      expect(sms.length <= 160, true); // Đảm bảo đóng gói gọn trong 1 tin nhắn SMS
    });

    test('Acoustic rescue siren start and stop toggle', () {
      expect(service.isSirenActive, false);

      service.startAcousticRescueSiren();
      expect(service.isSirenActive, true);
      expect(service.sirenNotifier.value, true);

      service.stopAcousticRescueSiren();
      expect(service.isSirenActive, false);
      expect(service.sirenNotifier.value, false);
    });
  });

  group('OfflineEmergencySheet Widget Tests', () {
    testWidgets('renders tactical offline sheet with PDR, siren and SMS button', (tester) async {
      await tester.pumpWidget(
        ChangeNotifierProvider(
          create: (_) => AppProvider(),
          child: const MaterialApp(
            home: Scaffold(
              body: OfflineEmergencySheet(),
            ),
          ),
        ),
      );

      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Cứu Hộ Ngoại Tuyến (Offline & 0-GPS)'), findsOneWidget);
      expect(find.text('ƯỚC TÍNH VỊ TRÍ TRONG NHÀ / HẦM (PDR)'), findsOneWidget);
      expect(find.text('BẬT CÒI CỨU HỘ ÂM HỌC ĐỊNH VỊ 115dB'), findsOneWidget);
      expect(find.text('GỬI SMS CỨU HỘ NGOẠI TUYẾN (KÈM PDR & Y TẾ)'), findsOneWidget);

      OfflineResilienceService.instance.stopAcousticRescueSiren();
    });
  });
}
