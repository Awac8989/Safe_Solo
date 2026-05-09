import 'package:flutter/material.dart';

import '../app_theme.dart';

enum BottomTab { home, circle, messages, heroes, settings }

class CustomBottomNav extends StatelessWidget {
  const CustomBottomNav({
    super.key,
    required this.active,
    required this.onChanged,
    this.onTap,
  });

  final BottomTab active;
  final ValueChanged<BottomTab> onChanged;
  final VoidCallback? onTap;

  static const List<_NavItem> _items = [
    _NavItem(BottomTab.home, 'Điểm danh', Icons.home_rounded),
    _NavItem(BottomTab.circle, 'Circle', Icons.auto_awesome_rounded),
    _NavItem(BottomTab.messages, 'Tin nhắn', Icons.chat_bubble_rounded),
    _NavItem(BottomTab.heroes, 'Heroes', Icons.workspace_premium_rounded),
    _NavItem(BottomTab.settings, 'Cài đặt', Icons.settings_rounded),
  ];

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.card.withValues(alpha: 0.95),
          border: const Border(top: BorderSide(color: AppColors.border)),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Row(
          children: _items
              .map(
                (item) => Expanded(
                  child: _BottomNavButton(
                    item: item,
                    active: item.tab == active,
                    onPressed: () {
                      onTap?.call();
                      onChanged(item.tab);
                    },
                  ),
                ),
              )
              .toList(),
        ),
      ),
    );
  }
}

class _BottomNavButton extends StatelessWidget {
  const _BottomNavButton({
    required this.item,
    required this.active,
    required this.onPressed,
  });

  final _NavItem item;
  final bool active;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final iconColor = active ? AppColors.primary : AppColors.textMuted;
    final textColor = active ? AppColors.primary : AppColors.textMuted;

    return Semantics(
      button: true,
      selected: active,
      label: item.label,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        onTap: onPressed,
        child: SizedBox(
          height: 56,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                curve: Curves.easeOut,
                width: 44,
                height: 36,
                decoration: BoxDecoration(
                  color: active ? AppColors.primarySoft : Colors.transparent,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(item.icon, size: 20, color: iconColor),
              ),
              const SizedBox(height: 2),
              Text(
                item.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.caption.copyWith(
                  fontSize: 10,
                  color: textColor,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem {
  const _NavItem(this.tab, this.label, this.icon);

  final BottomTab tab;
  final String label;
  final IconData icon;
}
