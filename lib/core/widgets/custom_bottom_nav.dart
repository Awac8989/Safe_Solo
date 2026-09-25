import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_theme.dart';
import '../app_strings.dart';
import '../providers/app_provider.dart';

enum BottomTab { home, circle, messages, heroes, settings }

class CustomBottomNav extends StatelessWidget {
  const CustomBottomNav({
    super.key,
    required this.active,
    required this.onChanged,
  });

  final BottomTab active;
  final ValueChanged<BottomTab> onChanged;

  static const List<_NavItem> _items = [
    _NavItem(
      BottomTab.home,
      BottomNavLabel.home,
      Icons.home_outlined,
      Icons.home_rounded,
    ),
    _NavItem(
      BottomTab.circle,
      BottomNavLabel.circle,
      Icons.auto_awesome_outlined,
      Icons.auto_awesome_rounded,
    ),
    _NavItem(
      BottomTab.messages,
      BottomNavLabel.messages,
      Icons.chat_bubble_outline_rounded,
      Icons.chat_bubble_rounded,
    ),
    _NavItem(
      BottomTab.heroes,
      BottomNavLabel.heroes,
      Icons.workspace_premium_outlined,
      Icons.workspace_premium_rounded,
    ),
    _NavItem(
      BottomTab.settings,
      BottomNavLabel.settings,
      Icons.settings_outlined,
      Icons.settings_rounded,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    context.watch<AppProvider>().language;
    final strings = AppStrings.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final navBg = isDark
        ? AppDarkColors.background
        : AppColors.surface;
    final navBorder = isDark
        ? AppDarkColors.border
        : AppColors.border.withValues(alpha: 0.55);
    final activeBg = isDark
        ? AppDarkColors.primarySoft
        : AppColors.primarySoft;
    final activeColor = isDark
        ? AppDarkColors.primaryGlow
        : AppColors.primary;
    final inactiveColor = isDark
        ? AppDarkColors.textSecondary
        : AppColors.textSecondary;

    return SafeArea(
      top: false,
      child: Container(
        decoration: BoxDecoration(
          color: navBg,
          border: Border(
            top: BorderSide(color: navBorder),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.05),
              blurRadius: 10,
              offset: const Offset(0, -3),
            ),
          ],
        ),
        padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
        child: Row(
          children: _items.map((item) {
            final isActive = item.tab == active;
            final label = strings.bottomTab(item.labelKey);
            return Expanded(
              child: Semantics(
                button: true,
                selected: isActive,
                label: label,
                child: InkWell(
                  onTap: () => onChanged(item.tab),
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  child: SizedBox(
                    height: 58,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        AnimatedScale(
                          scale: isActive ? 0.95 : 1,
                          duration: const Duration(milliseconds: 180),
                          curve: Curves.easeOut,
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 180),
                            curve: Curves.easeOut,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 8,
                            ),
                            decoration: BoxDecoration(
                              color: isActive
                                  ? activeBg
                                  : Colors.transparent,
                              borderRadius: BorderRadius.circular(18),
                              boxShadow: isActive && !isDark ? AppShadows.card : const [],
                              border: isActive && isDark
                                  ? Border.all(color: AppDarkColors.border)
                                  : null,
                            ),
                            child: Icon(
                              isActive ? item.activeIcon : item.icon,
                              size: 20,
                              color: isActive
                                  ? activeColor
                                  : inactiveColor,
                            ),
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.caption.copyWith(
                            fontSize: 10,
                            color: isActive
                                ? activeColor
                                : inactiveColor,
                            fontWeight: isActive
                                ? FontWeight.w700
                                : FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}

class _NavItem {
  const _NavItem(this.tab, this.labelKey, this.icon, this.activeIcon);

  final BottomTab tab;
  final BottomNavLabel labelKey;
  final IconData icon;
  final IconData activeIcon;
}
