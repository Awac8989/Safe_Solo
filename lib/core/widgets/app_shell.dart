import 'package:flutter/material.dart';

import '../app_theme.dart';

class AppPage extends StatelessWidget {
  const AppPage({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.symmetric(horizontal: 24),
    this.safeTop = true,
    this.safeBottom = false,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final bool safeTop;
  final bool safeBottom;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Material(
      color: isDark ? AppDarkColors.background : AppColors.background,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: isDark
              ? AppDarkColors.backgroundGradient
              : AppColors.backgroundGradient,
        ),
        child: SafeArea(
          top: safeTop,
          bottom: safeBottom,
          child: Padding(
            padding: padding,
            child: DefaultTextStyle.merge(
              style: TextStyle(
                color: isDark
                    ? AppDarkColors.textPrimary
                    : AppColors.textPrimary,
                fontFamily: AppTextStyles.fontFamily,
              ),
              child: IconTheme.merge(
                data: IconThemeData(
                  color: isDark
                      ? AppDarkColors.textPrimary
                      : AppColors.textPrimary,
                ),
                child: child,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(18),
    this.margin,
    this.color,
    this.radius = AppRadius.xl,
    this.shadow,
    this.border,
    this.borderColor,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;
  final Color? color;
  final double radius;
  final List<BoxShadow>? shadow;
  final Border? border;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    Color bg;
    if (color == null) {
      bg = isDark ? AppDarkColors.card : AppColors.card;
    } else if (isDark) {
      if (color == AppColors.card ||
          color == Colors.white ||
          color == AppColors.surface ||
          color == const Color(0xFFFFFBF4) ||
          color == const Color(0xFFFFFBF2) ||
          color == const Color(0xFFFFF1D7) ||
          color == const Color(0xFFE8F1FF)) {
        bg = AppDarkColors.card;
      } else if (color == AppColors.cardSoft || color == AppColors.secondary) {
        bg = AppDarkColors.cardSoft;
      } else {
        bg = color!;
      }
    } else {
      bg = color!;
    }

    final effectiveBorder = border ?? (borderColor != null
        ? Border.all(color: borderColor!, width: 1)
        : (isDark ? Border.all(color: AppDarkColors.border, width: 1) : null));

    return Container(
      margin: margin,
      padding: padding,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(radius),
        border: effectiveBorder,
        boxShadow: shadow ?? (isDark ? const [] : AppShadows.card),
      ),
      child: DefaultTextStyle.merge(
        style: TextStyle(
          color: isDark
              ? AppDarkColors.textPrimary
              : AppColors.textPrimary,
        ),
        child: child,
      ),
    );
  }
}

class AppRoundIconButton extends StatelessWidget {
  const AppRoundIconButton({super.key, required this.icon, this.onPressed});

  final IconData icon;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(20),
        child: Ink(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: isDark ? AppDarkColors.card : AppColors.card,
            borderRadius: BorderRadius.circular(20),
            boxShadow: isDark ? const [] : AppShadows.card,
            border: Border.all(
              color: isDark
                  ? AppDarkColors.border
                  : AppColors.border.withValues(alpha: 0.35),
            ),
          ),
          child: Icon(
            icon,
            size: 22,
            color: isDark ? AppDarkColors.textPrimary : AppColors.textPrimary,
          ),
        ),
      ),
    );
  }
}

class AppSectionLabel extends StatelessWidget {
  const AppSectionLabel(this.text, {super.key, this.color});

  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Text(
      text.toUpperCase(),
      style: AppTextStyles.caption.copyWith(
        color: color ??
            (isDark
                ? AppDarkColors.textSecondary
                : AppColors.textSecondary),
        fontWeight: FontWeight.w700,
        letterSpacing: 0.8,
      ),
    );
  }
}

class AppSegmentedControl<T> extends StatelessWidget {
  const AppSegmentedControl({
    super.key,
    required this.value,
    required this.items,
    required this.onChanged,
  });

  final T value;
  final List<AppSegmentItem<T>> items;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return AppCard(
      padding: const EdgeInsets.all(4),
      color: isDark ? AppDarkColors.surface : AppColors.secondary,
      radius: AppRadius.lg,
      shadow: const [],
      child: Row(
        children: items.map((item) {
          final active = item.value == value;
          return Expanded(
            child: GestureDetector(
              onTap: () => onChanged(item.value),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                curve: Curves.easeOut,
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 13,
                ),
                decoration: BoxDecoration(
                  color: active
                      ? (isDark ? AppDarkColors.cardSoft : AppColors.card)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  boxShadow: active && !isDark ? AppShadows.card : const [],
                  border: active && isDark
                      ? Border.all(color: AppDarkColors.border)
                      : null,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      item.icon,
                      size: 18,
                      color: active
                          ? (isDark ? AppDarkColors.primaryGlow : AppColors.primary)
                          : (isDark ? AppDarkColors.textMuted : AppColors.textSecondary),
                    ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        item.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.bodyStrong.copyWith(
                          color: active
                              ? (isDark ? AppDarkColors.primaryGlow : AppColors.primary)
                              : (isDark ? AppDarkColors.textMuted : AppColors.textSecondary),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class AppSegmentItem<T> {
  const AppSegmentItem({
    required this.value,
    required this.label,
    required this.icon,
  });

  final T value;
  final String label;
  final IconData icon;
}
