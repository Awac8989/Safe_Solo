import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/models/rescue_incident_model.dart';
import 'package:safesolo/services/survival_siren_service.dart';
import 'package:safesolo/views/emergency/emergency_ice_sheet.dart';
import 'package:safesolo/views/sos_map/sos_map_page.dart';

import 'package:flutter/services.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('xyz.luan/audioplayers.global'),
      (MethodCall methodCall) async => 1,
    );
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('xyz.luan/audioplayers'),
      (MethodCall methodCall) async => 1,
    );
  });

  group('RescueIncidentModel Tests', () {
    test('Model instantiation, status titles and color', () {
      final incident = RescueIncidentModel(
        id: 'INC-101',
        victimId: 'user-01',
        victimName: 'Trần Văn Nam',
        incidentType: 'FALL_DETECTED_P1',
        status: RescueIncidentStatus.dispatchingR1,
        severityLevel: RescueSeverityLevel.p1Critical,
        exactLat: 10.7626,
        exactLng: 106.6601,
        fuzzedLat: 10.7626,
        fuzzedLng: 106.6601,
        bloodType: 'AB+',
        allergies: ['Penicillin'],
        chronicConditions: ['Cao huyết áp'],
        createdAt: DateTime.now(),
      );

      expect(incident.isActive, isTrue);
      expect(incident.isHeroAssigned, isFalse);
      expect(incident.statusTitleVi, contains('ĐANG QUÉT HIỆP SĨ'));
      expect(incident.bloodType, 'AB+');
      expect(incident.allergies, contains('Penicillin'));

      // copyWith status update
      final enRouteIncident = incident.copyWith(
        status: RescueIncidentStatus.enRoute,
        assignedVolunteerId: 'hero-01',
        assignedVolunteerName: 'Nguyễn Văn Hero',
        assignedVolunteerPhone: '0909123456',
        heroDistanceMeters: 450,
        heroEtaMinutes: 2,
      );

      expect(enRouteIncident.isHeroAssigned, isTrue);
      expect(enRouteIncident.statusTitleVi, contains('HIỆP SĨ ĐANG TIẾP CẬN'));
      expect(enRouteIncident.assignedVolunteerName, 'Nguyễn Văn Hero');
    });

    test('Json serialization and deserialization', () {
      final json = {
        '_id': 'INC-999',
        'victimId': 'victim-123',
        'victimName': 'Lê Thị Mai',
        'incidentType': 'CARDIAC_ARREST_P1',
        'status': 'ACCEPTED',
        'severityLevel': 'P1_CRITICAL',
        'exactLat': 10.7766,
        'exactLng': 106.7009,
        'batteryLevel': 92,
        'assignedVolunteerName': 'Hiệp sĩ Tuấn',
        'medicalSnapshot': {
          'bloodType': 'O+',
          'allergies': ['Hải sản'],
          'chronicConditions': ['Đái tháo đường'],
        },
      };

      final parsed = RescueIncidentModel.fromJson(json);
      expect(parsed.id, 'INC-999');
      expect(parsed.status, RescueIncidentStatus.accepted);
      expect(parsed.bloodType, 'O+');
      expect(parsed.batteryLevel, 92);
      expect(parsed.assignedVolunteerName, 'Hiệp sĩ Tuấn');
    });
  });

  group('SurvivalSirenService Tests', () {
    test('Toggle Siren and Strobe states', () async {
      final siren = SurvivalSirenService.instance;
      expect(siren.isSirenActive, isFalse);
      expect(siren.isStrobeActive, isFalse);
      expect(siren.isBystanderVoiceActive, isFalse);

      await siren.startSiren();
      expect(siren.isSirenActive, isTrue);
      expect(siren.sirenActiveNotifier.value, isTrue);

      siren.startStrobe();
      expect(siren.isStrobeActive, isTrue);

      await siren.startBystanderBroadcast();
      expect(siren.isBystanderVoiceActive, isTrue);
      expect(siren.bystanderVoiceNotifier.value, isTrue);

      await siren.stopAll();
      expect(siren.isSirenActive, isFalse);
      expect(siren.isStrobeActive, isFalse);
      expect(siren.isBystanderVoiceActive, isFalse);
      expect(siren.bystanderVoiceNotifier.value, isFalse);
    });
  });

  group('Emergency ICE Sheet Widget Tests', () {
    testWidgets('Renders ICE medical sheet and SBAR info', (tester) async {
      final provider = AppProvider();
      provider.medical.bloodType = 'B+';
      provider.medical.allergies = 'Penicillin, Aspirin';
      provider.medical.conditions = 'Hen suyễn';

      await tester.pumpWidget(
        ChangeNotifierProvider<AppProvider>.value(
          value: provider,
          child: const MaterialApp(
            home: Scaffold(
              body: EmergencyIceSheet(),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('THẺ Y TẾ SINH TỒN (I.C.E)'), findsOneWidget);
      expect(find.text('B+'), findsOneWidget);
      expect(find.text('MÃ QR BÀN GIAO SBAR CHO KÍP 115'), findsOneWidget);
    });
  });

  group('SosMapPage Tactical War Room Widget Tests', () {
    testWidgets('Renders War Room header, stepper and safe resolve button', (tester) async {
      final provider = AppProvider();
      final incident = RescueIncidentModel(
        id: 'INC-DEMO',
        victimId: 'user-me',
        victimName: 'Nguyễn Văn Minh',
        incidentType: 'MANUAL_SOS_P1',
        status: RescueIncidentStatus.enRoute,
        exactLat: 10.7766,
        exactLng: 106.7009,
        fuzzedLat: 10.7766,
        fuzzedLng: 106.7009,
        assignedVolunteerName: 'Hiệp sĩ Cứu Hộ Hoàng',
        createdAt: DateTime.now(),
      );

      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        ChangeNotifierProvider<AppProvider>.value(
          value: provider,
          child: MaterialApp(
            home: SosMapPage(
              victimName: 'Nguyễn Văn Minh',
              incident: incident,
            ),
          ),
        ),
      );

      await tester.pump();

      // Check header
      expect(find.text('Nguyễn Văn Minh'), findsOneWidget);
      expect(find.textContaining('T+'), findsOneWidget);

      // Check AED Proximity HUD Banner
      expect(find.text('TỦ SỐC TIM AED GẦN NHẤT'), findsOneWidget);
      expect(find.text('MÃ MỞ: 1150'), findsOneWidget);
      expect(find.text('Chỉ đường'), findsOneWidget);

      // Drag sheet up to reveal all tactical tools
      await tester.drag(find.byType(ListView), const Offset(0, -300));
      await tester.pump();

      // Check Safe Resolve button
      expect(find.text('TÔI ĐÃ AN TOÀN (NHẬP PIN HỦY SOS)'), findsOneWidget);

      // Check War Room title
      expect(find.text('KÊNH THÔNG TIN TÁC CHIẾN (WAR ROOM)'), findsOneWidget);
    });
  });
}
