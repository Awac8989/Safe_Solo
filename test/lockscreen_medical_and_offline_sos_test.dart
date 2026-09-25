import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/core/widgets/top_toast.dart';
import 'package:safesolo/services/offline_resilience_service.dart';
import 'package:safesolo/services/offline_sos_service.dart';
import 'package:safesolo/views/emergency/offline_emergency_sheet.dart';
import 'package:safesolo/views/medical/lockscreen_medical_card_page.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  tearDown(() {
    TopToast.dismiss();
    OfflineResilienceService.instance.stopAcousticRescueSiren();
  });

  group('Lockscreen Medical Card & Offline SOS Tests', () {
    testWidgets('LockscreenMedicalCardPage renders clinical ICE data and QR code',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final appProvider = AppProvider();
      appProvider.setUserForTest(
        User(
          id: 'user-ice-01',
          name: 'Đoàn Minh Quân',
          email: 'quan@safesolo.app',
          phoneNumber: '0901234567',
          timerIntervalMinutes: 720,
          currentStatus: 'SAFE',
          quietHoursStart: '22:00',
          quietHoursEnd: '07:00',
          falseAlertGraceMinutes: 15,
          emergencyContacts: const [
            EmergencyContact(
              name: 'Mẹ Lan',
              phone: '0909999888',
              relation: 'Mẹ ruột',
              priority: 1,
            ),
          ],
        ),
      );

      appProvider.setMedicalForTest(
        MedicalId(
          fullName: 'Đoàn Minh Quân',
          birthYear: '2004',
          bloodType: 'O+',
          allergies: 'Dị ứng Penicillin, Sốc phản vệ hải sản',
          conditions: 'Tăng huyết áp, Đặt Stent',
          medications: 'Aspirin 81mg, Amlodipine 5mg',
          emergencyPhone: '0909999888',
          insuranceProvider: 'Bảo hiểm Y tế Quốc gia',
          insuranceNumber: 'DN4790123456789',
          permanentAddress: '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM',
        ),
      );

      await tester.pumpWidget(
        ChangeNotifierProvider<AppProvider>.value(
          value: appProvider,
          child: const MaterialApp(
            home: LockscreenMedicalCardPage(),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // 1. Verify Header & Title
      expect(find.text('THẺ Y TẾ CẤP CỨU 115'), findsOneWidget);
      expect(find.text('In Case of Emergency (ICE) • Chuẩn Y Tế'), findsOneWidget);

      // 2. Verify Patient Details & Blood Type Badge
      expect(find.text('ĐOÀN MINH QUÂN'), findsOneWidget);
      expect(find.text('NHÓM MÁU'), findsOneWidget);
      expect(find.text('O+'), findsOneWidget);

      // 3. Verify Direct Call Buttons
      expect(find.text('GỌI 115 CẤP CỨU'), findsOneWidget);
      expect(find.text('GỌI Mẹ Lan'), findsOneWidget);

      // 4. Verify Critical Allergy Box
      expect(find.text('⚠️ CẢNH BÁO DỊ ỨNG NGUY HIỂM (KHÔNG TIÊM THUỐC)'), findsOneWidget);
      expect(find.text('Dị ứng Penicillin, Sốc phản vệ hải sản'), findsOneWidget);

      // 5. Verify Conditions & Medications
      expect(find.text('Tăng huyết áp, Đặt Stent'), findsOneWidget);
      expect(find.text('Aspirin 81mg, Amlodipine 5mg'), findsOneWidget);

      // 6. Verify QR Code Widget
      expect(find.text('QUÉT MÃ QR CẤP CỨU 115'), findsOneWidget);
      expect(find.byType(QrImageView), findsOneWidget);

      // 7. Verify Share Button
      expect(find.text('CHIA SẺ HỒ SƠ CẤP CỨU CHO NGƯỜI THÂN'), findsOneWidget);

      TopToast.dismiss();
      await tester.pump(const Duration(seconds: 3));
    });

    testWidgets('OfflineEmergencySheet formats GSM SMS and toggles acoustic siren',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final appProvider = AppProvider();
      appProvider.setUserForTest(
        User(
          id: 'user-offline-test',
          name: 'Đoàn Minh Quân',
          email: 'quan@safesolo.app',
          phoneNumber: '0901234567',
          timerIntervalMinutes: 720,
          currentStatus: 'SAFE',
          quietHoursStart: '22:00',
          quietHoursEnd: '07:00',
          falseAlertGraceMinutes: 15,
          emergencyContacts: const [
            EmergencyContact(name: 'Ba Dũng', phone: '0912345678', relation: 'Bố'),
          ],
        ),
      );

      // Verify offline SMS formatter
      final sms = OfflineSosService.instance.formatEmergencySms(
        victimName: 'Đoàn Minh Quân',
        lat: 10.7769,
        lng: 106.7009,
        heartRate: 118,
        spO2: 89,
        batteryLevel: 72,
        reason: 'TE NGA BAT DONG',
      );

      expect(sms.contains('SAFESOLO SOS!'), isTrue);
      expect(sms.contains('Đoàn Minh Quân'), isTrue);
      expect(sms.contains('TE NGA BAT DONG'), isTrue);
      expect(sms.contains('HR:118'), isTrue);
      expect(sms.contains('SpO2:89%'), isTrue);
      expect(sms.contains('Pin:72%'), isTrue);
      expect(sms.contains('https://maps.google.com/?q=10.77690,106.70090'), isTrue);

      await tester.pumpWidget(
        ChangeNotifierProvider<AppProvider>.value(
          value: appProvider,
          child: const MaterialApp(
            home: Scaffold(
              body: OfflineEmergencySheet(),
            ),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.text('Cứu Hộ Ngoại Tuyến (Offline & 0-GPS)'), findsOneWidget);
      expect(find.text('Mạng: Mất Internet (Dùng SMS)'), findsOneWidget);
      expect(find.text('ƯỚC TÍNH VỊ TRÍ TRONG NHÀ / HẦM (PDR)'), findsOneWidget);

      // Verify Siren Toggle
      expect(find.text('BẬT CÒI CỨU HỘ ÂM HỌC ĐỊNH VỊ 115dB'), findsOneWidget);
      final sirenBtn = find.text('BẬT CÒI CỨU HỘ ÂM HỌC ĐỊNH VỊ 115dB');
      await tester.tap(sirenBtn);
      await tester.pump();

      expect(OfflineResilienceService.instance.isSirenActive, isTrue);
      expect(find.text('ĐANG PHÁT CÒI CỨU HỘ 115dB (CHẠM ĐỂ TẮT)'), findsOneWidget);

      // Turn off siren
      await tester.tap(find.text('ĐANG PHÁT CÒI CỨU HỘ 115dB (CHẠM ĐỂ TẮT)'));
      await tester.pump();
      expect(OfflineResilienceService.instance.isSirenActive, isFalse);

      TopToast.dismiss();
      await tester.pump(const Duration(seconds: 3));
    });
  });
}
