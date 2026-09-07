import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/app_theme.dart';
import 'core/providers/app_provider.dart';
import 'views/achievements/achievements_page.dart';
import 'views/auth/auth_page.dart';
import 'views/medical/medical_page.dart';
import 'views/network/network_page.dart';
import 'views/onboarding/onboarding_page.dart';
import 'views/permissions/permissions_page.dart';
import 'views/security/security_page.dart';
import 'views/settings/settings_page.dart';
import 'views/watch/watch_simulator_page.dart';
import 'views/wear_os/wear_os_watch_page.dart';
import 'views/vault/vault_page.dart';
import 'core/widgets/app_shell.dart';
import 'core/widgets/main_navigation.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const SafeSoloApp());
}

class SafeSoloApp extends StatelessWidget {
  const SafeSoloApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AppProvider(),
      child: Consumer<AppProvider>(
        builder: (context, provider, _) {
          return MaterialApp(
            debugShowCheckedModeBanner: false,
            title: 'SafeSolo',
            theme: provider.highContrast ? AppTheme.highContrast : AppTheme.light,
            darkTheme: provider.highContrast ? AppTheme.highContrast : AppTheme.light,
            themeMode: ThemeMode.light,
            home: const _AppGate(),
            routes: {
              '/auth': (_) => const AuthPage(),
              '/onboarding': (_) => const OnboardingPage(),
              '/permissions': (_) => const PermissionsPage(),
              '/medical': (_) => const MedicalPage(),
              '/network': (_) => const NetworkPage(),
              '/security': (_) => const SecurityPage(),
              '/vault': (_) => const VaultPage(),
              '/achievements': (_) => const AchievementsPage(),
              '/settings': (_) => const SettingsPage(),
              '/watch-simulator': (_) => const WatchSimulatorPage(),
              '/wear-os': (_) => const WearOsWatchPage(),
            },
            onUnknownRoute: (_) => MaterialPageRoute<void>(
              builder: (_) => const _AppGate(),
            ),
          );
        },
      ),
    );
  }
}

class _AppGate extends StatelessWidget {
  const _AppGate();

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AppProvider>();
    final media = MediaQuery.of(context);
    final isWatchScreen =
        media.size.shortestSide <= 480 && media.size.aspectRatio <= 1.25;
    debugPrint('MAIN _AppGate: size=${media.size}, shortestSide=${media.size.shortestSide}, aspectRatio=${media.size.aspectRatio}, isWatchScreen=$isWatchScreen');

    // Tự động chuyển thẳng vào Chế độ Đồng hồ WearOS nếu kích thước màn hình nhỏ tròn/vuông
    if (isWatchScreen) {
      return const WearOsWatchPage();
    }

    if (provider.isInitializing) {
      return const _SplashScreen();
    }

    if (!provider.onboarded) {
      return const OnboardingPage();
    }

    if (!provider.permissionsGranted) {
      return const PermissionsPage();
    }

    if (provider.user == null) {
      return const AuthPage();
    }

    return const MainNavigation();
  }
}

class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) {
    return const AppPage(
      child: Center(
        child: SizedBox(
          width: 52,
          height: 52,
          child: CircularProgressIndicator(strokeWidth: 3),
        ),
      ),
    );
  }
}
