import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/providers/app_provider.dart';

class AchievementsPage extends StatelessWidget {
  const AchievementsPage({super.key});

  static const _items = [
    ('streak7', 'Nguoi can than', Icons.favorite_rounded),
    ('streak30', 'Doi truong bao ve', Icons.shield_outlined),
    ('streak100', 'Kien tri 100 ngay', Icons.local_fire_department_rounded),
    ('medical', 'Chien binh y te', Icons.medical_services_outlined),
    ('automation', 'Anh hung cong dong', Icons.workspace_premium_rounded),
  ];

  @override
  Widget build(BuildContext context) {
    final unlocked = context.watch<AppProvider>().badges.toSet();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Huy hieu'),
      ),
      body: GridView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _items.length,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 14,
          crossAxisSpacing: 14,
          childAspectRatio: 0.92,
        ),
        itemBuilder: (context, index) {
          final item = _items[index];
          final active = unlocked.contains(item.$1);

          return ColorFiltered(
            colorFilter: active
                ? const ColorFilter.mode(Colors.transparent, BlendMode.dst)
                : const ColorFilter.matrix([
                    0.2126, 0.7152, 0.0722, 0, 0,
                    0.2126, 0.7152, 0.0722, 0, 0,
                    0.2126, 0.7152, 0.0722, 0, 0,
                    0, 0, 0, 1, 0,
                  ]),
            child: Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(AppRadius.xl),
                boxShadow: active ? AppShadows.safe : AppShadows.card,
                border: Border.all(
                  color: active ? AppColors.primary.withValues(alpha: 0.28) : AppColors.border,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 54,
                    height: 54,
                    decoration: BoxDecoration(
                      gradient: active ? AppColors.safeGradient : AppColors.backgroundGradient,
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Icon(item.$3, color: active ? Colors.white : AppColors.textMuted),
                  ),
                  const Spacer(),
                  Text(item.$2, style: AppTextStyles.title),
                  const SizedBox(height: 6),
                  Text(
                    active ? 'Da mo khoa' : 'Chua dat duoc',
                    style: AppTextStyles.caption.copyWith(
                      color: active ? AppColors.primary : AppColors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
