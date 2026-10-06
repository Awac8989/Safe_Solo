import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:safesolo/core/app_theme.dart';
import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/models/circle_orbit_member.dart';
import 'package:safesolo/models/disaster_alert_model.dart';
import 'package:safesolo/models/live_journey_model.dart';
import 'package:safesolo/models/medical_profile_model.dart';

// View imports
import 'package:safesolo/views/onboarding/onboarding_page.dart';
import 'package:safesolo/views/permissions/permissions_page.dart';
import 'package:safesolo/views/auth/auth_page.dart';
import 'package:safesolo/views/auth/profile_setup_page.dart';
import 'package:safesolo/views/home/home_page.dart';
import 'package:safesolo/views/circle/circle_page.dart';
import 'package:safesolo/views/journey/active_journey_page.dart';
import 'package:safesolo/views/health/health_history_page.dart';
import 'package:safesolo/views/watch/smartwatch_connection_page.dart';
import 'package:safesolo/views/medical/medical_page.dart';
import 'package:safesolo/views/medical/lockscreen_medical_card_page.dart';
import 'package:safesolo/views/emergency/first_aid_guide_page.dart';
import 'package:safesolo/views/sos_map/sos_map_page.dart';
import 'package:safesolo/views/community_radar/community_radar_page.dart';
import 'package:safesolo/views/community/hazard_feed_page.dart';
import 'package:safesolo/views/community/accident_report_page.dart';
import 'package:safesolo/views/community/safety_guides_page.dart';
import 'package:safesolo/views/heroes/heroes_page.dart';
import 'package:safesolo/views/heroes/hero_workspace_page.dart';
import 'package:safesolo/views/stealth/stealth_page.dart';
import 'package:safesolo/views/audio/fake_call_screen.dart';
import 'package:safesolo/views/vault/vault_page.dart';
import 'package:safesolo/views/messenger/messenger_page.dart';
import 'package:safesolo/views/network/network_page.dart';
import 'package:safesolo/views/achievements/achievements_page.dart';
import 'package:safesolo/views/settings/settings_page.dart';
import 'package:safesolo/views/settings/defense_demo_sandbox_page.dart';
import 'package:safesolo/views/settings/app_user_guide_page.dart';
import 'package:safesolo/views/wear_os/wear_os_watch_page.dart';

AppProvider createMockProvider() {
  final p = AppProvider();
  p.setUserForTest(
    User(
      id: 'usr-safesolo-01',
      name: 'Nguyễn Văn An',
      email: 'an.nguyen@safesolo.vn',
      phoneNumber: '0987654321',
      timerIntervalMinutes: 120,
      currentStatus: 'SAFE',
      quietHoursStart: '22:00',
      quietHoursEnd: '06:00',
      falseAlertGraceMinutes: 3,
      isProfileSetup: true,
      isKycVerified: true,
      lastCheckinTime: DateTime.now().subtract(const Duration(minutes: 25)),
      nextDeadline: DateTime.now().add(const Duration(minutes: 95)),
      emergencyContacts: const [
        EmergencyContact(name: 'Mẹ Lan', phone: '0912345678', relation: 'Mẹ ruột', priority: 1),
        EmergencyContact(name: 'Anh Hùng', phone: '0988776655', relation: 'Anh trai', priority: 2),
      ],
    ),
  );
  p.setMedicalForTest(
    MedicalId(
      fullName: 'Nguyễn Văn An',
      birthYear: '1998',
      bloodType: 'O+',
      allergies: 'Dị ứng Penicillin, Sốt phấn hoa',
      conditions: 'Huyết áp bình thường',
      medications: 'Không dùng thuốc thường xuyên',
      emergencyPhone: '0912345678',
      insuranceProvider: 'BHYT Quân Đội',
      insuranceNumber: 'DN4790123456789',
      permanentAddress: 'Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    ),
  );
  p.setActiveJourneyForTest(
    LiveJourneyModel(
      id: 'journey-mock-01',
      destinationLabel: 'Nhà riêng (Quận 1)',
      durationMinutes: 30,
      startedAt: DateTime.now().subtract(const Duration(minutes: 10)),
      expectedArrivalAt: DateTime.now().add(const Duration(minutes: 20)),
      status: 'IN_TRANSIT',
      shareToken: 'safe_track_9988',
      currentLat: 10.7769,
      currentLng: 106.7009,
      destinationLat: 10.7850,
      destinationLng: 106.7100,
      remainingSeconds: 1200,
    ),
  );
  p.setDisasterAlertsForTest([
    DisasterAlertModel(
      id: 'disaster-01',
      title: 'Cảnh báo ngập úng triều cường',
      description: 'Mực nước dâng cao tại khu vực đường Nguyễn Hữu Cảnh và chân cầu Thủ Thiêm.',
      severity: DisasterSeverity.warning,
      category: DisasterCategory.flooding,
      lat: 10.7820,
      lng: 106.7050,
      radiusMeters: 1500,
      createdAt: DateTime.now().subtract(const Duration(minutes: 30)),
      status: 'ACTIVE',
      address: 'Quận Bình Thạnh, TP.HCM',
      safetyAdvice: 'Tránh di chuyển qua các điểm ngập sâu trên 0.5m',
    ),
  ]);
  return p;
}

final Map<String, List<String>> overflowReport = {};
String currentTestingScreen = '';

Future<void> runOverflowCheck(
  WidgetTester tester,
  Widget widget,
  String screenName, {
  Size size = const Size(392, 825),
  bool isWatch = false,
}) async {
  currentTestingScreen = screenName;
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1.0;

  final p = createMockProvider();
  final theme = isWatch
      ? ThemeData.dark().copyWith(scaffoldBackgroundColor: Colors.black)
      : AppTheme.dark;

  await tester.pumpWidget(
    ChangeNotifierProvider<AppProvider>.value(
      value: p,
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: theme,
        home: Scaffold(body: widget),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 200));
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    SharedPreferences.setMockInitialValues({
      'safesolo_state_v3': jsonEncode({
        'onboarded': true,
        'permissionsGranted': true,
        'streak': 15,
        'badges': <String>['first_checkin', 'shield_master', 'hero_bronze'],
      }),
    });

    FlutterError.onError = (FlutterErrorDetails details) {
      final msg = details.toString();
      if (msg.contains('overflowed by') || msg.contains('A RenderFlex overflowed')) {
        final match = RegExp(r'overflowed by ([0-9\.]+) pixels (.*)').firstMatch(msg);
        final detail = match != null ? '${match.group(1)} px (${match.group(2)?.split('\n').first})' : 'overflowed';
        overflowReport.putIfAbsent(currentTestingScreen, () => []).add(detail);
        print('🚨 [$currentTestingScreen] OVERFLOW: $detail');
        return; // Suppress to allow tests to complete and collect all data
      }
      if (msg.contains('setState() or markNeedsBuild()') || msg.contains('HTTP requests will return status code 400')) {
        return;
      }
      FlutterError.presentError(details);
    };
  });

  group('Check Mobile Screens (Galaxy A71 392x825)', () {
    final screens = <String, Widget Function()>{
      '01_OnboardingPage': () => const OnboardingPage(),
      '02_PermissionsPage': () => const PermissionsPage(),
      '03_AuthPage': () => const AuthPage(),
      '04_ProfileSetupPage': () => const ProfileSetupPage(),
      '05_HomePage': () => const HomePage(),
      '06_CirclePage': () => const CirclePage(),
      '07_ActiveJourneyPage': () => const ActiveJourneyPage(),
      '08_HealthHistoryPage': () => const HealthHistoryPage(),
      '09_SmartwatchConnectionPage': () => const SmartwatchConnectionPage(),
      '10_MedicalPage': () => const MedicalPage(),
      '11_LockscreenMedicalCardPage': () => const LockscreenMedicalCardPage(),
      '12_FirstAidGuidePage': () => const FirstAidGuidePage(),
      '13_SosMapPage': () => const SosMapPage(),
      '14_CommunityRadarPage': () => const CommunityRadarPage(),
      '15_HazardFeedPage': () => const HazardFeedPage(),
      '16_AccidentReportPage': () => const AccidentReportPage(),
      '17_SafetyGuidesPage': () => const SafetyGuidesPage(),
      '18_HeroesPage': () => const HeroesPage(),
      '19_StealthPage': () => const StealthPage(),
      '20_FakeCallScreen': () => const FakeCallScreen(),
      '21_VaultPage': () => const VaultPage(),
      '22_MessengerPage': () => const MessengerPage(),
      '23_NetworkPage': () => const NetworkPage(),
      '24_AchievementsPage': () => const AchievementsPage(),
      '25_SettingsPage': () => const SettingsPage(),
      '26_DefenseDemoSandboxPage': () => const DefenseDemoSandboxPage(),
      '27_AppUserGuidePage': () => const AppUserGuidePage(),
    };

    for (final entry in screens.entries) {
      testWidgets('Check ${entry.key}', (tester) async {
        await runOverflowCheck(tester, entry.value(), entry.key);
      });
    }
  });

  group('Check Wear OS Watch Screens (Galaxy Watch SM-R900 396x396)', () {
    final watchScreens = <String, WatchScreen>{
      'Watch_01_Face': WatchScreen.watchface,
      'Watch_02_Dashboard': WatchScreen.dashboard,
      'Watch_03_Checkin': WatchScreen.checkin,
      'Watch_04_Warning': WatchScreen.warning,
      'Watch_05_Sos': WatchScreen.sos,
      'Watch_06_Health': WatchScreen.health,
      'Watch_07_Medical': WatchScreen.medical,
    };

    for (final entry in watchScreens.entries) {
      testWidgets('Check ${entry.key}', (tester) async {
        await runOverflowCheck(
          tester,
          WearOsWatchPage(initialScreen: entry.value),
          entry.key,
          size: const Size(396, 396),
          isWatch: true,
        );
      });
    }
  });

  tearDownAll(() {
    print('\n' + '=' * 70);
    print('           KẾT QUẢ QUÉT TOÀN DIỆN LỖI PIXEL TRÊN MỌI MÀN HÌNH');
    print('=' * 70);
    if (overflowReport.isEmpty) {
      print('✅ XUẤT SẮC: Không phát hiện bất kỳ lỗi tràn Pixel nào trên toàn bộ 34 màn hình!');
    } else {
      print('⚠️ TỔNG CỘNG ${overflowReport.length} MÀN HÌNH CÓ LỖI PIXEL OVERFLOW:');
      overflowReport.forEach((screen, errors) {
        print('\n📌 [$screen] có ${errors.length} điểm tràn:');
        for (final err in errors) {
          print('   -> $err');
        }
      });
    }
    print('=' * 70 + '\n');
  });
}
