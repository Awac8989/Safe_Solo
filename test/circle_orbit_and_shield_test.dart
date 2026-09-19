import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/models/circle_orbit_member.dart';
import 'package:safesolo/views/circle/circle_page.dart';
import 'package:safesolo/views/circle/widgets/night_shield_bar.dart';
import 'package:safesolo/views/circle/widgets/circle_orbit_visualizer.dart';
import 'package:safesolo/views/circle/widgets/live_safety_cockpit_card.dart';
import 'package:safesolo/views/circle/widgets/ai_safety_capsule_card.dart';
import 'package:safesolo/views/circle/widgets/biometric_resonance_sheet.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('Circle Orbit & AI Capsule Models Tests', () {
    test('CircleOrbitMember serializes and calculates colors/labels', () {
      final now = DateTime.now();
      final member = CircleOrbitMember(
        id: 'test-orbit-1',
        name: 'Mẹ Lan',
        relation: 'Mẹ',
        status: OrbitSafetyStatus.home,
        batteryLevel: 88,
        isCharging: true,
        heartRateBpm: 72,
        locationLabel: 'Đà Lạt',
        lastActive: now,
      );

      final json = member.toJson();
      expect(json['id'], 'test-orbit-1');
      expect(json['name'], 'Mẹ Lan');
      expect(json['status'], 'home');
      expect(json['batteryLevel'], 88);
      expect(json['isCharging'], true);

      final fromJson = CircleOrbitMember.fromJson(json);
      expect(fromJson.id, 'test-orbit-1');
      expect(fromJson.status, OrbitSafetyStatus.home);
      expect(fromJson.statusLabelVi, 'Ở nhà an toàn');
      expect(fromJson.auraColor, const Color(0xFF2FAA68));
    });

    test('AiSafetyCapsuleModel serializes and deserializes', () {
      const capsule = AiSafetyCapsuleModel(
        id: 'capsule-1',
        dateLabel: 'Hôm nay',
        summaryMessageVi: 'Hôm nay bạn đã an toàn.',
        summaryMessageEn: 'You were safe today.',
        stepCount: 5000,
        avgHeartRate: 70,
        safeCommuteMinutes: 30,
        batteryHealthPct: 90,
        arrivedHomeTime: '19:00',
        isSentToCircle: false,
      );

      final json = capsule.toJson();
      expect(json['id'], 'capsule-1');
      expect(json['stepCount'], 5000);

      final fromJson = AiSafetyCapsuleModel.fromJson(json);
      expect(fromJson.id, 'capsule-1');
      expect(fromJson.avgHeartRate, 70);
    });
  });

  group('Next-Gen Circle Widgets Tests', () {
    testWidgets('renders NightShieldBar and toggles shield state', (tester) async {
      final provider = AppProvider();

      await tester.pumpWidget(
        ChangeNotifierProvider.value(
          value: provider,
          child: const MaterialApp(
            home: Scaffold(
              body: NightShieldBar(),
            ),
          ),
        ),
      );

      await tester.pump();

      // Initially standby
      expect(find.text('NGHI THỨC BÌNH AN'), findsOneWidget);
      expect(find.text('Khóa đêm'), findsOneWidget);

      // Tap to activate Night Shield
      await tester.tap(find.text('Khóa đêm'));
      await tester.pump();
      await tester.pump(const Duration(seconds: 3));

      expect(provider.isNightShieldActive, true);
      expect(find.text('KHIÊN ĐÊM: ĐANG BẬT'), findsOneWidget);
      expect(find.text('Bình minh'), findsOneWidget);

      // Tap Sunlight Release to check in
      await tester.tap(find.text('Bình minh'));
      await tester.pump();
      await tester.pump(const Duration(seconds: 3));

      expect(provider.isNightShieldActive, false);
      expect(provider.isMorningCheckinDone, true);
    });

    testWidgets('renders CircleOrbitVisualizer with satellites and center node', (tester) async {
      final provider = AppProvider();

      await tester.pumpWidget(
        ChangeNotifierProvider.value(
          value: provider,
          child: const MaterialApp(
            home: Scaffold(
              body: CircleOrbitVisualizer(),
            ),
          ),
        ),
      );

      await tester.pump();

      expect(find.text('QUỸ ĐẠO BÌNH AN (THE ORBIT)'), findsOneWidget);
      expect(find.text('Trực tiếp'), findsOneWidget);
      expect(find.text('Ở nhà'), findsOneWidget);
      expect(find.text('Đi đường'), findsOneWidget);
      expect(find.text('Ngủ'), findsOneWidget);
      expect(find.text('Mẹ Lan'), findsOneWidget);
      expect(find.text('Linh'), findsOneWidget);
    });

    testWidgets('renders LiveSafetyCockpitCard with in-transit journey details', (tester) async {
      final provider = AppProvider();

      await tester.pumpWidget(
        ChangeNotifierProvider.value(
          value: provider,
          child: const MaterialApp(
            home: Scaffold(
              body: LiveSafetyCockpitCard(),
            ),
          ),
        ),
      );

      await tester.pump();

      expect(find.text('BUỒNG LÁI HỘ TỐNG ẢO'), findsOneWidget);
      expect(find.text('ĐANG DI CHUYỂN'), findsOneWidget);
      expect(find.text('42 dB'), findsOneWidget);
      expect(find.text('Bộ đàm nhanh'), findsOneWidget);
      expect(find.text('Cùng ngắm nhìn'), findsOneWidget);
    });

    testWidgets('renders AiSafetyCapsuleCard and triggers publish', (tester) async {
      final provider = AppProvider();

      await tester.pumpWidget(
        ChangeNotifierProvider.value(
          value: provider,
          child: const MaterialApp(
            home: Scaffold(
              body: AiSafetyCapsuleCard(),
            ),
          ),
        ),
      );

      await tester.pump();

      expect(find.text('BƯU THIẾP BÌNH AN 24H (AI CAPSULE)'), findsOneWidget);
      expect(find.text('Gửi bưu thiếp cho gia đình'), findsOneWidget);

      await tester.tap(find.text('Gửi bưu thiếp cho gia đình'));
      await tester.pump();
      await tester.pump(const Duration(seconds: 3));

      expect(provider.dailySafetyCapsule?.isSentToCircle, true);
      expect(find.text('Đã gửi'), findsOneWidget);
    });

    testWidgets('renders BiometricResonanceSheet with heartbeat and quick nudge', (tester) async {
      final provider = AppProvider();
      final member = provider.orbitMembers.first;

      await tester.pumpWidget(
        ChangeNotifierProvider.value(
          value: provider,
          child: MaterialApp(
            home: Scaffold(
              body: BiometricResonanceSheet(member: member),
            ),
          ),
        ),
      );

      await tester.pump();

      expect(find.text('Mẹ Lan'), findsOneWidget);
      expect(find.text('BPM'), findsOneWidget);
      expect(find.text('Chạm giữ để đồng điệu nhịp tim'), findsOneWidget);
      expect(find.text('Gõ cửa hỏi thăm'), findsOneWidget);
      expect(find.text('Nhắn tin'), findsOneWidget);
    });

    testWidgets('renders full CirclePage integrating all next-gen features', (tester) async {
      final provider = AppProvider();

      await tester.binding.setSurfaceSize(const Size(800, 1600));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        ChangeNotifierProvider.value(
          value: provider,
          child: const MaterialApp(
            home: CirclePage(),
          ),
        ),
      );

      await tester.pump();

      expect(find.text('Alive Circle'), findsOneWidget);
      expect(find.text('QUỸ ĐẠO BÌNH AN (THE ORBIT)'), findsOneWidget);
      expect(find.text('BUỒNG LÁI HỘ TỐNG ẢO'), findsOneWidget);
      expect(find.text('BƯU THIẾP BÌNH AN 24H (AI CAPSULE)'), findsOneWidget);
      expect(find.text('Bản tin nguy cơ'), findsOneWidget);
      expect(find.text('Bộ đàm PTT'), findsOneWidget);
    });
  });
}
