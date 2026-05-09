import 'package:flutter/material.dart';

import '../app_theme.dart';

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
      'Diem danh',
      Icons.home_outlined,
      Icons.home_rounded,
    ),
    _NavItem(
      BottomTab.circle,
      'Circle',
      Icons.auto_awesome_outlined,
      Icons.auto_awesome_rounded,
    ),
    _NavItem(
      BottomTab.messages,
      'Tin nhan',
      Icons.chat_bubble_outline_rounded,
      Icons.chat_bubble_rounded,
    ),
    _NavItem(
      BottomTab.heroes,
      'Heroes',
      Icons.workspace_premium_outlined,
      Icons.workspace_premium_rounded,
    ),
    _NavItem(
      BottomTab.settings,
      'Cai dat',
      Icons.settings_outlined,
      Icons.settings_rounded,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface.withValues(alpha: 0.95),
          border: Border(
            top: BorderSide(color: AppColors.border.withValues(alpha: 0.55)),
          ),
        ),
        padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
        child: Row(
          children: _items.map((item) {
            final isActive = item.tab == active;
            return Expanded(
              child: Semantics(
                button: true,
                selected: isActive,
                label: item.label,
                child: InkWell(
                  onTap: () => onChanged(item.tab),
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  child: SizedBox(
                    height: 58,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          curve: Curves.easeOut,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: isActive
                                ? AppColors.primarySoft
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(18),
                          ),
                          child: Icon(
                            isActive ? item.activeIcon : item.icon,
                            size: 20,
                            color: isActive
                                ? AppColors.primary
                                : AppColors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          item.label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.caption.copyWith(
                            fontSize: 10,
                            color: isActive
                                ? AppColors.primary
                                : AppColors.textSecondary,
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
  const _NavItem(this.tab, this.label, this.icon, this.activeIcon);

  final BottomTab tab;
  final String label;
  final IconData icon;
  final IconData activeIcon;
}
