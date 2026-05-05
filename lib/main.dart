import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/providers/app_provider.dart';
import 'core/widgets/main_navigation.dart';
import 'views/onboarding/onboarding_page.dart';
import 'views/auth/auth_page.dart';
import 'views/permissions/permissions_page.dart';
import 'views/settings/settings_page.dart';
import 'views/medical/medical_page.dart';
import 'views/security/security_page.dart';

void main() {
  runApp(const SafeSoloApp());
}

class SafeSoloApp extends StatelessWidget {
  const SafeSoloApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AppProvider()),
      ],
      child: MaterialApp(
        title: 'SafeSolo',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF4CAF50)),
          useMaterial3: true,
          fontFamily: 'Inter',
        ),
        home: const AppRoot(),
        routes: {
          '/onboarding': (_) => const OnboardingPage(),
          '/auth': (_) => const AuthPage(),
          '/permissions': (_) => const PermissionsPage(),
          '/settings': (_) => const SettingsPage(),
          '/medical': (_) => const MedicalPage(),
          '/security': (_) => const SecurityPage(),
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
        if (appProvider.security.stealthMode) {
          return const Placeholder(); // Stealth mode - hide app
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