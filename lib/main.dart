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
import 'views/stealth/stealth_page.dart';
import 'views/watch/smartwatch_connection_page.dart';
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
              '/stealth': (_) => const StealthPage(),
              '/vault': (_) => const VaultPage(),
              '/achievements': (_) => const AchievementsPage(),
              '/settings': (_) => const SettingsPage(),
              '/smartwatch': (_) => const SmartwatchConnectionPage(),
              '/watch-details': (_) => const SmartwatchConnectionPage(),
              '/watch-simulator': (_) => const WearOsWatchPage(),
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
    final view = View.of(context);

    // Tính kích thước màn hình từ View.of(context).physicalSize để phát hiện smartwatch ngay frame 0
    final dpr = view.devicePixelRatio > 0
        ? view.devicePixelRatio
        : (media.devicePixelRatio > 0 ? media.devicePixelRatio : 1.0);
    final width = view.physicalSize.width > 0 ? view.physicalSize.width / dpr : media.size.width;
    final height = view.physicalSize.height > 0 ? view.physicalSize.height / dpr : media.size.height;

    // Màn hình đồng hồ Wear OS (màn hình tròn/vuông nhỏ, kích thước <= 320dp và tỉ lệ xấp xỉ 1:1)
    // hoặc khi build chuyên biệt cho Wear OS qua flag --dart-define=WEAR_OS=true
    const isExplicitWearOs = bool.fromEnvironment('WEAR_OS', defaultValue: false);
    final isNativeWatchHardware = width > 0 &&
        height > 0 &&
        width <= 454 &&
        height <= 454 &&
        (width / height) >= 0.8 &&
        (width / height) <= 1.25;
    final isWatchScreen = isExplicitWearOs || isNativeWatchHardware;

    debugPrint('MAIN _AppGate: width=$width, height=$height, isWatchScreen=$isWatchScreen');

    // Tự động chuyển thẳng vào Chế độ Đồng hồ WearOS nếu chạy trên thiết bị Smartwatch thật
    if (isWatchScreen) {
      return const WearOsWatchPage();
    }

    // Nếu kích thước chưa xác định (frame 0), giữ màn hình nền đen chờ frame tiếp theo có kích thước
    if (width <= 0 || height <= 0) {
      return const ColoredBox(color: Colors.black);
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
