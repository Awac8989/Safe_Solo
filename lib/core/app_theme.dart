import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  static const Color background = Color(0xFF071411);
  static const Color backgroundAlt = Color(0xFF0D1D19);
  static const Color surface = Color(0xFF10231E);
  static const Color surfaceElevated = Color(0xFF163029);
  static const Color card = Color(0xFF11261F);
  static const Color cardSoft = Color(0xFF18342C);
  static const Color border = Color(0xFF24463C);
  static const Color input = Color(0xFF1B362E);
  static const Color ring = Color(0xFF3CCB87);

  static const Color primary = Color(0xFF27B06E);
  static const Color primaryGlow = Color(0xFF48DD97);
  static const Color primarySoft = Color(0xFF173A2B);
  static const Color primaryForeground = Color(0xFFF5FFFA);

  static const Color secondary = Color(0xFF183129);
  static const Color secondaryForeground = Color(0xFFE3F4EC);

  static const Color accent = Color(0xFF1E4737);
  static const Color accentForeground = Color(0xFFBDF5D7);

  static const Color warning = Color(0xFFF6B533);
  static const Color warningForeground = Color(0xFF1B1200);

  static const Color destructive = Color(0xFFF25858);
  static const Color destructiveForeground = Color(0xFFFFF4F4);

  static const Color textPrimary = Color(0xFFF3FFF8);
  static const Color textSecondary = Color(0xFFB6D1C5);
  static const Color textMuted = Color(0xFF86A59A);
  static const Color textOnDark = Color(0xFFF8FFFB);

  static const Color success = Color(0xFF45D58D);
  static const Color shadowSafe = Color(0x7327B06E);
  static const Color shadowWarn = Color(0x80F6B533);
  static const Color shadowDanger = Color(0x8CF25858);

  static const LinearGradient safeGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF27B06E), Color(0xFF48DD97)],
  );

  static const LinearGradient warnGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFF6B533), Color(0xFFF07A2F)],
  );

  static const LinearGradient dangerGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFF25858), Color(0xFFE1365F)],
  );

  static const LinearGradient backgroundGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFF081714), Color(0xFF0E221C)],
  );
}

class AppRadius {
  AppRadius._();

  static const double sm = 16;
  static const double md = 18;
  static const double lg = 20;
  static const double xl = 24;
  static const double xxl = 32;
  static const double pill = 999;
}

class AppShadows {
  AppShadows._();

  static List<BoxShadow> card = const [
    BoxShadow(
      color: Color(0x24000000),
      blurRadius: 24,
      offset: Offset(0, 8),
    ),
  ];

  static List<BoxShadow> safe = const [
    BoxShadow(
      color: AppColors.shadowSafe,
      blurRadius: 40,
      spreadRadius: -8,
      offset: Offset(0, 16),
    ),
  ];

  static List<BoxShadow> warn = const [
    BoxShadow(
      color: AppColors.shadowWarn,
      blurRadius: 40,
      spreadRadius: -8,
      offset: Offset(0, 16),
    ),
  ];

  static List<BoxShadow> danger = const [
    BoxShadow(
      color: AppColors.shadowDanger,
      blurRadius: 44,
      spreadRadius: -8,
      offset: Offset(0, 16),
    ),
  ];
}

class AppTextStyles {
  AppTextStyles._();

  static const String fontFamily = 'Inter';

  static const TextStyle h1 = TextStyle(
    fontFamily: fontFamily,
    fontSize: 34,
    height: 1.12,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.9,
    color: AppColors.textPrimary,
  );

  static const TextStyle h2 = TextStyle(
    fontFamily: fontFamily,
    fontSize: 28,
    height: 1.16,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.7,
    color: AppColors.textPrimary,
  );

  static const TextStyle h3 = TextStyle(
    fontFamily: fontFamily,
    fontSize: 22,
    height: 1.2,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.4,
    color: AppColors.textPrimary,
  );

  static const TextStyle title = TextStyle(
    fontFamily: fontFamily,
    fontSize: 18,
    height: 1.28,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.2,
    color: AppColors.textPrimary,
  );

  static const TextStyle bodyLarge = TextStyle(
    fontFamily: fontFamily,
    fontSize: 16,
    height: 1.5,
    fontWeight: FontWeight.w500,
    color: AppColors.textPrimary,
  );

  static const TextStyle body = TextStyle(
    fontFamily: fontFamily,
    fontSize: 14,
    height: 1.5,
    fontWeight: FontWeight.w500,
    color: AppColors.textSecondary,
  );

  static const TextStyle bodyStrong = TextStyle(
    fontFamily: fontFamily,
    fontSize: 14,
    height: 1.45,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
  );

  static const TextStyle caption = TextStyle(
    fontFamily: fontFamily,
    fontSize: 12,
    height: 1.4,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.2,
    color: AppColors.textMuted,
  );

  static const TextStyle button = TextStyle(
    fontFamily: fontFamily,
    fontSize: 16,
    height: 1.2,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.1,
    color: AppColors.primaryForeground,
  );

  static const TextStyle timer = TextStyle(
    fontFamily: fontFamily,
    fontSize: 44,
    height: 1,
    fontWeight: FontWeight.w900,
    letterSpacing: -1.4,
    color: AppColors.textPrimary,
  );
}

class AppTheme {
  AppTheme._();

  static ThemeData get dark {
    const colorScheme = ColorScheme(
      brightness: Brightness.dark,
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
      brightness: Brightness.dark,
      fontFamily: AppTextStyles.fontFamily,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: AppColors.background,
      canvasColor: AppColors.background,
      splashFactory: InkSparkle.splashFactory,
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
        shadowColor: Colors.black26,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.xl),
          side: const BorderSide(color: AppColors.border),
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
          borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xxl)),
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
          minimumSize: const Size.fromHeight(56),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          textStyle: AppTextStyles.button,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.textPrimary,
          minimumSize: const Size.fromHeight(56),
          side: const BorderSide(color: AppColors.border),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          textStyle: AppTextStyles.button.copyWith(color: AppColors.textPrimary),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primaryGlow,
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
          minimumSize: const Size.fromHeight(56),
          textStyle: AppTextStyles.button,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.secondary,
        selectedColor: AppColors.primarySoft,
        disabledColor: AppColors.input,
        side: const BorderSide(color: AppColors.border),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.pill),
        ),
        labelStyle: AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
        secondaryLabelStyle: AppTextStyles.caption.copyWith(color: AppColors.primaryGlow),
        brightness: Brightness.dark,
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColors.surface,
        selectedItemColor: AppColors.primaryGlow,
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
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.surface,
        indicatorColor: AppColors.primarySoft,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return AppTextStyles.caption.copyWith(color: AppColors.primaryGlow);
          }
          return AppTextStyles.caption.copyWith(color: AppColors.textMuted);
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(color: AppColors.primaryGlow);
          }
          return const IconThemeData(color: AppColors.textMuted);
        }),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.border,
        thickness: 1,
        space: 1,
      ),
      iconTheme: const IconThemeData(color: AppColors.textPrimary),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.primaryGlow,
        linearTrackColor: AppColors.secondary,
        circularTrackColor: AppColors.secondary,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.surfaceElevated,
        contentTextStyle: AppTextStyles.body.copyWith(color: AppColors.textPrimary),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          side: const BorderSide(color: AppColors.border),
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
}
