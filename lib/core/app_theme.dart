import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  static const Color background = Color(0xFFF7FCF9);
  static const Color backgroundAlt = Color(0xFFEEF7F2);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceElevated = Color(0xFFFFFFFF);
  static const Color card = Color(0xFFFFFFFF);
  static const Color cardSoft = Color(0xFFF1F8F4);
  static const Color border = Color(0xFFDCEAE2);
  static const Color input = Color(0xFFFFFFFF);
  static const Color ring = Color(0xFF37B874);

  static const Color primary = Color(0xFF33B56F);
  static const Color primaryGlow = Color(0xFF6ED5A2);
  static const Color primarySoft = Color(0xFFDDF5E7);
  static const Color primaryForeground = Color(0xFFFFFFFF);

  static const Color secondary = Color(0xFFEAF3EE);
  static const Color secondaryForeground = Color(0xFF617E71);

  static const Color accent = Color(0xFFF5FAF7);
  static const Color accentForeground = Color(0xFF1F352C);

  static const Color warning = Color(0xFFFFAF1E);
  static const Color warningForeground = Color(0xFF3A2700);

  static const Color destructive = Color(0xFFF05454);
  static const Color destructiveForeground = Color(0xFFFFFFFF);

  static const Color textPrimary = Color(0xFF1F332B);
  static const Color textSecondary = Color(0xFF668073);
  static const Color textMuted = Color(0xFF8AA094);
  static const Color textOnDark = Color(0xFFFFFFFF);

  static const Color success = Color(0xFF2FAA68);
  static const Color shadowSafe = Color(0x1833B56F);
  static const Color shadowWarn = Color(0x18FFAF1E);
  static const Color shadowDanger = Color(0x18F05454);

  static const LinearGradient safeGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF69D39F), Color(0xFF39C87F)],
  );

  static const LinearGradient warnGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFFFCB59), Color(0xFFFFA22E)],
  );

  static const LinearGradient dangerGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFFF8E85), Color(0xFFF25F6B)],
  );

  static const LinearGradient backgroundGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFFFFFFFF), Color(0xFFF1F8F3)],
  );
}

class AppDarkColors {
  AppDarkColors._();

  static const Color background = Color(0xFF070B14);
  static const Color backgroundAlt = Color(0xFF0B1120);
  static const Color surface = Color(0xFF0F172A);
  static const Color surfaceElevated = Color(0xFF131D31);
  static const Color card = Color(0xFF111C2E);
  static const Color cardSoft = Color(0xFF1E293B);
  static const Color border = Color(0xFF1E2D44);
  static const Color input = Color(0xFF0F172A);
  static const Color ring = Color(0xFF10B981);

  static const Color primary = Color(0xFF10B981);
  static const Color primaryGlow = Color(0xFF34D399);
  static const Color primarySoft = Color(0xFF064E3B);
  static const Color primaryForeground = Color(0xFFFFFFFF);

  static const Color secondary = Color(0xFF1E293B);
  static const Color secondaryForeground = Color(0xFF94A3B8);

  static const Color accent = Color(0xFF0F172A);
  static const Color accentForeground = Color(0xFFF8FAFC);

  static const Color warning = Color(0xFFF59E0B);
  static const Color warningForeground = Color(0xFF000000);

  static const Color destructive = Color(0xFFEF4444);
  static const Color destructiveForeground = Color(0xFFFFFFFF);

  static const Color textPrimary = Color(0xFFFFFFFF);
  static const Color textSecondary = Color(0xFF94A3B8);
  static const Color textMuted = Color(0xFF64748B);
  static const Color textOnDark = Color(0xFFFFFFFF);

  static const Color success = Color(0xFF10B981);

  static const LinearGradient backgroundGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFF070B14), Color(0xFF0B1120)],
  );

  static const LinearGradient cardGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF111C2E), Color(0xFF0F172A)],
  );
}

class AppRadius {
  AppRadius._();

  static const double sm = 14;
  static const double md = 18;
  static const double lg = 22;
  static const double xl = 26;
  static const double xxl = 32;
  static const double pill = 999;
}

class AppShadows {
  AppShadows._();

  static List<BoxShadow> card = const [
    BoxShadow(color: Color(0x120A2F20), blurRadius: 30, offset: Offset(0, 14)),
  ];

  static List<BoxShadow> safe = const [
    BoxShadow(
      color: AppColors.shadowSafe,
      blurRadius: 36,
      offset: Offset(0, 18),
    ),
  ];

  static List<BoxShadow> warn = const [
    BoxShadow(
      color: AppColors.shadowWarn,
      blurRadius: 36,
      offset: Offset(0, 18),
    ),
  ];

  static List<BoxShadow> danger = const [
    BoxShadow(
      color: AppColors.shadowDanger,
      blurRadius: 36,
      offset: Offset(0, 18),
    ),
  ];
}

class AppTextStyles {
  AppTextStyles._();

  static const String fontFamily = 'Inter';

  static const TextStyle h1 = TextStyle(
    fontFamily: fontFamily,
    fontSize: 40,
    height: 1.08,
    fontWeight: FontWeight.w800,
  );

  static const TextStyle h2 = TextStyle(
    fontFamily: fontFamily,
    fontSize: 30,
    height: 1.14,
    fontWeight: FontWeight.w800,
  );

  static const TextStyle h3 = TextStyle(
    fontFamily: fontFamily,
    fontSize: 24,
    height: 1.2,
    fontWeight: FontWeight.w700,
  );

  static const TextStyle title = TextStyle(
    fontFamily: fontFamily,
    fontSize: 18,
    height: 1.25,
    fontWeight: FontWeight.w700,
  );

  static const TextStyle bodyLarge = TextStyle(
    fontFamily: fontFamily,
    fontSize: 16,
    height: 1.45,
    fontWeight: FontWeight.w500,
  );

  static const TextStyle body = TextStyle(
    fontFamily: fontFamily,
    fontSize: 14,
    height: 1.5,
    fontWeight: FontWeight.w500,
  );

  static const TextStyle bodyStrong = TextStyle(
    fontFamily: fontFamily,
    fontSize: 14,
    height: 1.4,
    fontWeight: FontWeight.w700,
  );

  static const TextStyle caption = TextStyle(
    fontFamily: fontFamily,
    fontSize: 12,
    height: 1.35,
    fontWeight: FontWeight.w600,
  );

  static const TextStyle button = TextStyle(
    fontFamily: fontFamily,
    fontSize: 16,
    height: 1.2,
    fontWeight: FontWeight.w700,
    color: AppColors.primaryForeground,
  );

  static const TextStyle timer = TextStyle(
    fontFamily: fontFamily,
    fontSize: 48,
    height: 1,
    fontWeight: FontWeight.w800,
  );

  static Color textPrimary(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? AppDarkColors.textPrimary
          : AppColors.textPrimary;

  static Color textSecondary(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? AppDarkColors.textSecondary
          : AppColors.textSecondary;

  static Color textMuted(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? AppDarkColors.textMuted
          : AppColors.textMuted;
}

class AppTheme {
  AppTheme._();

  static ThemeData get light {
    const colorScheme = ColorScheme(
      brightness: Brightness.light,
      primary: AppColors.primary,
      onPrimary: AppColors.primaryForeground,
      secondary: AppColors.secondary,
      onSecondary: AppColors.secondaryForeground,
      error: AppColors.destructive,
      onError: AppColors.destructiveForeground,
      surface: AppColors.surface,
      onSurface: AppColors.textPrimary,
      tertiary: AppColors.warning,
      onTertiary: AppColors.warningForeground,
    );

    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      fontFamily: AppTextStyles.fontFamily,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: AppColors.background,
      canvasColor: AppColors.background,
      splashFactory: InkRipple.splashFactory,
    );

    return base.copyWith(
      textTheme: const TextTheme(
        displayLarge: AppTextStyles.h1,
        displayMedium: AppTextStyles.h2,
        headlineMedium: AppTextStyles.h2,
        headlineSmall: AppTextStyles.h3,
        titleLarge: AppTextStyles.title,
        bodyLarge: AppTextStyles.bodyLarge,
        bodyMedium: AppTextStyles.body,
        labelLarge: AppTextStyles.button,
        bodySmall: AppTextStyles.caption,
        labelSmall: AppTextStyles.caption,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: AppTextStyles.title,
        iconTheme: IconThemeData(color: AppColors.textPrimary),
      ),
      cardTheme: CardThemeData(
        color: AppColors.card,
        elevation: 0,
        shadowColor: Colors.black12,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.xl),
          side: const BorderSide(color: Colors.transparent),
        ),
        margin: EdgeInsets.zero,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.surfaceElevated,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.xl),
        ),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.surfaceElevated,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
        dragHandleColor: AppColors.textMuted,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppRadius.xxl),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.input,
        contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
        hintStyle: AppTextStyles.body.copyWith(color: AppColors.textMuted),
        labelStyle: AppTextStyles.body.copyWith(color: AppColors.textSecondary),
        prefixIconColor: AppColors.textMuted,
        suffixIconColor: AppColors.textMuted,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: const BorderSide(color: AppColors.ring, width: 1.4),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: const BorderSide(color: AppColors.destructive),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: const BorderSide(color: AppColors.destructive, width: 1.4),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          elevation: 0,
          backgroundColor: AppColors.primary,
          foregroundColor: AppColors.primaryForeground,
          disabledBackgroundColor: AppColors.secondary,
          disabledForegroundColor: AppColors.textMuted,
          minimumSize: const Size(64, 48),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          textStyle: AppTextStyles.button,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.textPrimary,
          minimumSize: const Size(64, 48),
          side: const BorderSide(color: AppColors.border),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          textStyle: AppTextStyles.button.copyWith(color: AppColors.textPrimary),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primary,
          textStyle: AppTextStyles.bodyStrong,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.pill),
          ),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: AppColors.primaryForeground,
          minimumSize: const Size(64, 48),
          textStyle: AppTextStyles.button,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.secondary,
        selectedColor: AppColors.primarySoft,
        disabledColor: AppColors.secondary,
        side: const BorderSide(color: Colors.transparent),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.pill),
        ),
        labelStyle: AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
        secondaryLabelStyle: AppTextStyles.caption.copyWith(color: AppColors.primary),
        brightness: Brightness.light,
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColors.surface,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.textMuted,
        selectedLabelStyle: TextStyle(
          fontFamily: AppTextStyles.fontFamily,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
        unselectedLabelStyle: TextStyle(
          fontFamily: AppTextStyles.fontFamily,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.border,
        thickness: 1,
        space: 1,
      ),
      iconTheme: const IconThemeData(color: AppColors.textPrimary),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.primary,
        linearTrackColor: AppColors.secondary,
        circularTrackColor: AppColors.secondary,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.textPrimary,
        contentTextStyle: AppTextStyles.body.copyWith(color: AppColors.textOnDark),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
        ),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.primaryForeground,
        elevation: 0,
        shape: CircleBorder(),
      ),
    );
  }

  static ThemeData get dark {
    const colorScheme = ColorScheme(
      brightness: Brightness.dark,
      primary: AppDarkColors.primary,
      onPrimary: AppDarkColors.primaryForeground,
      secondary: AppDarkColors.secondary,
      onSecondary: AppDarkColors.secondaryForeground,
      error: AppDarkColors.destructive,
      onError: Colors.white,
      surface: AppDarkColors.surface,
      onSurface: AppDarkColors.textPrimary,
      tertiary: AppDarkColors.warning,
      onTertiary: Colors.black,
    );

    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      fontFamily: AppTextStyles.fontFamily,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: AppDarkColors.background,
      canvasColor: AppDarkColors.background,
      cardColor: AppDarkColors.card,
      dividerColor: AppDarkColors.border,
      splashFactory: InkRipple.splashFactory,
    );

    return base.copyWith(
      textTheme: const TextTheme(
        displayLarge: AppTextStyles.h1,
        displayMedium: AppTextStyles.h2,
        headlineMedium: AppTextStyles.h2,
        headlineSmall: AppTextStyles.h3,
        titleLarge: AppTextStyles.title,
        bodyLarge: AppTextStyles.bodyLarge,
        bodyMedium: AppTextStyles.body,
        labelLarge: AppTextStyles.button,
        bodySmall: AppTextStyles.caption,
        labelSmall: AppTextStyles.caption,
      ).apply(
        bodyColor: AppDarkColors.textPrimary,
        displayColor: AppDarkColors.textPrimary,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          fontFamily: AppTextStyles.fontFamily,
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: AppDarkColors.textPrimary,
        ),
        iconTheme: IconThemeData(color: AppDarkColors.textPrimary),
      ),
      cardTheme: CardThemeData(
        color: AppDarkColors.card,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.xl),
          side: const BorderSide(color: AppDarkColors.border, width: 1),
        ),
        margin: EdgeInsets.zero,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppDarkColors.surfaceElevated,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.xl),
          side: const BorderSide(color: AppDarkColors.border, width: 1),
        ),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppDarkColors.surfaceElevated,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
        dragHandleColor: AppDarkColors.textMuted,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppRadius.xxl),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppDarkColors.input,
        contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
        hintStyle: AppTextStyles.body.copyWith(color: AppDarkColors.textMuted),
        labelStyle: AppTextStyles.body.copyWith(color: AppDarkColors.textSecondary),
        prefixIconColor: AppDarkColors.textMuted,
        suffixIconColor: AppDarkColors.textMuted,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: const BorderSide(color: AppDarkColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: const BorderSide(color: AppDarkColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: const BorderSide(color: AppDarkColors.ring, width: 1.4),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: const BorderSide(color: AppDarkColors.destructive),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: const BorderSide(color: AppDarkColors.destructive, width: 1.4),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          elevation: 0,
          backgroundColor: AppDarkColors.primary,
          foregroundColor: AppDarkColors.primaryForeground,
          disabledBackgroundColor: AppDarkColors.secondary,
          disabledForegroundColor: AppDarkColors.textMuted,
          minimumSize: const Size(64, 48),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          textStyle: AppTextStyles.button,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppDarkColors.textPrimary,
          minimumSize: const Size(64, 48),
          side: const BorderSide(color: AppDarkColors.border),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          textStyle: AppTextStyles.button.copyWith(color: AppDarkColors.textPrimary),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppDarkColors.primary,
          textStyle: AppTextStyles.bodyStrong,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.pill),
          ),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppDarkColors.primary,
          foregroundColor: AppDarkColors.primaryForeground,
          minimumSize: const Size(64, 48),
          textStyle: AppTextStyles.button,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppDarkColors.secondary,
        selectedColor: AppDarkColors.primarySoft,
        disabledColor: AppDarkColors.secondary,
        side: const BorderSide(color: Colors.transparent),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.pill),
        ),
        labelStyle: AppTextStyles.caption.copyWith(color: AppDarkColors.textSecondary),
        secondaryLabelStyle: AppTextStyles.caption.copyWith(color: AppDarkColors.primary),
        brightness: Brightness.dark,
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppDarkColors.surface,
        selectedItemColor: AppDarkColors.primary,
        unselectedItemColor: AppDarkColors.textMuted,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),
      dividerTheme: const DividerThemeData(
        color: AppDarkColors.border,
        thickness: 1,
        space: 1,
      ),
      iconTheme: const IconThemeData(color: AppDarkColors.textPrimary),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return AppDarkColors.primary;
          }
          return Colors.white70;
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return AppDarkColors.primarySoft;
          }
          return AppDarkColors.secondary;
        }),
      ),
      sliderTheme: const SliderThemeData(
        activeTrackColor: AppDarkColors.primary,
        inactiveTrackColor: AppDarkColors.secondary,
        thumbColor: Colors.white,
        overlayColor: Color(0x3310B981),
      ),
    );
  }

  static ThemeData get highContrast => dark;
}
