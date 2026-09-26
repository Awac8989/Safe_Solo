import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
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
import 'package:safesolo/views/watch/watch_simulator_page.dart';
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

Future<void> loadAllFonts() async {
  // 1. Material Icons
  final iconFile = File(r'C:\flutter\flutter\bin\cache\artifacts\material_fonts\materialicons-regular.otf');
  if (iconFile.existsSync()) {
    final iconData = iconFile.readAsBytesSync();
    for (final name in ['MaterialIcons', 'packages/flutter/MaterialIcons']) {
      final loader = FontLoader(name);
      loader.addFont(Future.value(ByteData.view(iconData.buffer)));
      await loader.load();
    }
  }

  // 2. Segoe UI (Regular, Bold, Semibold) -> Inter, sans-serif, Roboto, Arial, Segoe UI
  final segoeFile = File(r'C:\Windows\Fonts\segoeui.ttf');
  final segoeBoldFile = File(r'C:\Windows\Fonts\segoeuib.ttf');
  final segoeSemiboldFile = File(r'C:\Windows\Fonts\segoeuisb.ttf');

  if (segoeFile.existsSync()) {
    final reg = segoeFile.readAsBytesSync();
    final bold = segoeBoldFile.existsSync() ? segoeBoldFile.readAsBytesSync() : reg;
    final semi = segoeSemiboldFile.existsSync() ? segoeSemiboldFile.readAsBytesSync() : reg;

    for (final family in ['Inter', 'sans-serif', 'Roboto', 'Arial', 'Segoe UI']) {
      final loader = FontLoader(family);
      loader.addFont(Future.value(ByteData.view(reg.buffer)));
      loader.addFont(Future.value(ByteData.view(bold.buffer)));
      loader.addFont(Future.value(ByteData.view(semi.buffer)));
      await loader.load();
    }
  }

  // 3. Consolas (Regular, Bold) -> monospace
  final consolaFile = File(r'C:\Windows\Fonts\consola.ttf');
  final consolaBoldFile = File(r'C:\Windows\Fonts\consolab.ttf');
  if (consolaFile.existsSync()) {
    final reg = consolaFile.readAsBytesSync();
    final bold = consolaBoldFile.existsSync() ? consolaBoldFile.readAsBytesSync() : reg;
    final loader = FontLoader('monospace');
    loader.addFont(Future.value(ByteData.view(reg.buffer)));
    loader.addFont(Future.value(ByteData.view(bold.buffer)));
    await loader.load();
  }

  // 4. Emoji
  final emojiFile = File(r'C:\Windows\Fonts\seguiemj.ttf');
  if (emojiFile.existsSync()) {
    final emojiData = emojiFile.readAsBytesSync();
    final loader = FontLoader('Segoe UI Emoji');
    loader.addFont(Future.value(ByteData.view(emojiData.buffer)));
    await loader.load();
  }
}

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

Future<void> capture(
  WidgetTester tester,
  Widget widget,
  String filename, {
  AppProvider? provider,
  Size size = const Size(1080, 2400),
  double pixelRatio = 2.625,
  bool isWatch = false,
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = pixelRatio;

  final p = provider ?? createMockProvider();
  final key = GlobalKey();

  final theme = isWatch
      ? ThemeData(
          fontFamily: 'sans-serif',
          fontFamilyFallback: const ['Segoe UI Emoji', 'Inter', 'Roboto'],
          brightness: Brightness.dark,
          scaffoldBackgroundColor: Colors.black,
        )
      : AppTheme.dark.copyWith(
          textTheme: AppTheme.dark.textTheme.apply(
            fontFamily: 'Inter',
            fontFamilyFallback: const ['Segoe UI Emoji', 'Arial', 'sans-serif'],
          ),
        );

  await tester.pumpWidget(
    ChangeNotifierProvider<AppProvider>.value(
      value: p,
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: theme,
        home: RepaintBoundary(
          key: key,
          child: widget,
        ),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 300));

  await tester.runAsync(() async {
    final boundary = key.currentContext?.findRenderObject() as RenderRepaintBoundary?;
    if (boundary != null) {
      final image = await boundary.toImage(pixelRatio: pixelRatio);
      final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      if (byteData != null) {
        final f = File('docs/screenshots/$filename');
        f.writeAsBytesSync(byteData.buffer.asUint8List());
        print('Captured $filename -> ${byteData.lengthInBytes} bytes');
      }
    }
  });
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    FlutterError.onError = (details) {
      if (details.toString().contains('overflowed') || details.toString().contains('setState() or markNeedsBuild()')) {
        return;
      }
      FlutterError.presentError(details);
    };

    SharedPreferences.setMockInitialValues({
      'safesolo_state_v3': jsonEncode({
        'onboarded': true,
        'permissionsGranted': true,
        'streak': 15,
        'badges': <String>['first_checkin', 'shield_master', 'hero_bronze'],
      }),
    });
    Directory('docs/screenshots').createSync(recursive: true);

    await loadAllFonts();
  });

  group('Capture All SafeSolo Screens With Real Fonts', () {
    testWidgets('Capture Mobile Screens 01 to 10', (tester) async {
      await capture(tester, const OnboardingPage(), 'app_01_onboarding.png');
      await capture(tester, const PermissionsPage(), 'app_02_permissions.png');
      await capture(tester, const AuthPage(), 'app_03_auth_login.png');
      await capture(tester, const ProfileSetupPage(), 'app_04_profile_setup.png');
      await capture(tester, const HomePage(), 'app_05_home_dashboard.png');
      await capture(tester, const CirclePage(), 'app_06_circle_orbit.png');
      await capture(tester, const ActiveJourneyPage(), 'app_07_live_journey.png');
      await capture(tester, const HealthHistoryPage(), 'app_08_health_vitals_hub.png');
      await capture(tester, const SmartwatchConnectionPage(), 'app_09_smartwatch_companion.png');
      await capture(tester, const WatchSimulatorPage(), 'app_10_watch_simulator.png');
    });

    testWidgets('Capture Mobile Screens 11 to 20', (tester) async {
      await capture(tester, const MedicalPage(), 'app_11_medical_id.png');
      await capture(tester, const LockscreenMedicalCardPage(), 'app_12_lockscreen_medical.png');
      await capture(tester, const FirstAidGuidePage(), 'app_13_first_aid_guide.png');
      await capture(tester, const SosMapPage(), 'app_14_sos_interactive_map.png');
      await capture(tester, const CommunityRadarPage(), 'app_15_community_radar.png');
      await capture(tester, const HazardFeedPage(), 'app_16_hazard_feed.png');
      await capture(tester, const AccidentReportPage(), 'app_17_accident_report.png');
      await capture(tester, const SafetyGuidesPage(), 'app_18_safety_guides.png');
      await capture(tester, const HeroesPage(), 'app_19_heroes_network.png');
      await capture(tester, const HeroWorkspacePage(), 'app_20_hero_workspace.png');
    });

    testWidgets('Capture Mobile Screens 21 to 29', (tester) async {
      await capture(tester, const StealthPage(), 'app_21_stealth_calculator.png');
      await capture(tester, const FakeCallScreen(), 'app_22_fake_call_screen.png');
      await capture(tester, const VaultPage(), 'app_23_safety_vault.png');
      await capture(tester, const MessengerPage(), 'app_24_messenger_walkie_talkie.png');
      await capture(tester, const NetworkPage(), 'app_25_guardian_network.png');
      await capture(tester, const AchievementsPage(), 'app_26_achievements.png');
      await capture(tester, const SettingsPage(), 'app_27_settings_system.png');
      await capture(tester, const DefenseDemoSandboxPage(), 'app_28_defense_demo_sandbox.png');
      await capture(tester, const AppUserGuidePage(), 'app_29_app_user_guide.png');
    });

    testWidgets('Capture Wear OS Smartwatch Screens 01 to 07', (tester) async {
      const watchSize = Size(396, 396);
      await capture(tester, const WearOsWatchPage(initialScreen: WatchScreen.watchface), 'watch_01_face.png', size: watchSize, pixelRatio: 1.0, isWatch: true);
      await capture(tester, const WearOsWatchPage(initialScreen: WatchScreen.dashboard), 'watch_02_dashboard.png', size: watchSize, pixelRatio: 1.0, isWatch: true);
      await capture(tester, const WearOsWatchPage(initialScreen: WatchScreen.checkin), 'watch_03_checkin.png', size: watchSize, pixelRatio: 1.0, isWatch: true);
      await capture(tester, const WearOsWatchPage(initialScreen: WatchScreen.warning), 'watch_04_warning.png', size: watchSize, pixelRatio: 1.0, isWatch: true);
      await capture(tester, const WearOsWatchPage(initialScreen: WatchScreen.sos), 'watch_05_sos.png', size: watchSize, pixelRatio: 1.0, isWatch: true);
      await capture(tester, const WearOsWatchPage(initialScreen: WatchScreen.health), 'watch_06_health.png', size: watchSize, pixelRatio: 1.0, isWatch: true);
      await capture(tester, const WearOsWatchPage(initialScreen: WatchScreen.medical), 'watch_07_medical.png', size: watchSize, pixelRatio: 1.0, isWatch: true);
    });
  });
}
