import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/app_theme.dart';
import 'core/providers/app_provider.dart';
import 'core/widgets/main_navigation.dart';
import 'views/auth/auth_page.dart';
import 'views/achievements/achievements_page.dart';
import 'views/community_radar/community_radar_page.dart';
import 'views/medical/medical_page.dart';
import 'views/network/network_page.dart';
import 'views/onboarding/onboarding_page.dart';
import 'views/permissions/permissions_page.dart';
import 'views/security/security_page.dart';
import 'views/settings/settings_page.dart';
import 'views/sos_map/sos_map_page.dart';
import 'views/stealth/stealth_page.dart';
import 'views/vault/vault_page.dart';

void main() {
  runApp(const SafeSoloApp());
}

class SafeSoloApp extends StatelessWidget {
  const SafeSoloApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [ChangeNotifierProvider(create: (_) => AppProvider())],
      child: Consumer<AppProvider>(
        builder: (context, appProvider, _) {
          final app = MaterialApp(
            title: 'SafeSolo',
            debugShowCheckedModeBanner: false,
            theme: appProvider.highContrast ? AppTheme.highContrast : AppTheme.light,
            home: const AppRoot(),
            routes: {
              '/onboarding': (_) => const OnboardingPage(),
              '/auth': (_) => const AuthPage(),
              '/permissions': (_) => const PermissionsPage(),
              '/settings': (_) => const SettingsPage(),
              '/medical': (_) => const MedicalPage(),
              '/security': (_) => const SecurityPage(),
              '/network': (_) => const NetworkPage(),
              '/vault': (_) => const VaultPage(),
              '/achievements': (_) => const AchievementsPage(),
              '/sos-map': (_) => const SosMapPage(),
              '/community-radar': (_) => const CommunityRadarPage(),
              '/stealth': (_) => const StealthPage(),
            },
          );

          if (!appProvider.highContrast) {
            return app;
          }

          return ColorFiltered(
            colorFilter: const ColorFilter.matrix([
              0.2126, 0.7152, 0.0722, 0, 0,
              0.2126, 0.7152, 0.0722, 0, 0,
              0.2126, 0.7152, 0.0722, 0, 0,
              0, 0, 0, 1, 0,
            ]),
            child: app,
          );
        },
      ),
    );
  }
}

class AppRoot extends StatelessWidget {
  const AppRoot({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<AppProvider>(
      builder: (context, appProvider, child) {
        if (appProvider.isInitializing) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        if (appProvider.security.stealthMode) {
          return const StealthPage();
        }
        if (!appProvider.onboarded) {
          return const OnboardingPage();
        }
        if (appProvider.user == null) {
          return const AuthPage();
        }
        if (!appProvider.permissionsGranted) {
          return const PermissionsPage();
        }
        return const MainNavigation();
      },
    );
  }
}
