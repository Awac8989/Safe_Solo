import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../../core/app_strings.dart';
import '../../../core/app_theme.dart';
import '../../../core/providers/app_provider.dart';
import '../../../core/widgets/top_toast.dart';

class NightShieldBar extends StatelessWidget {
  const NightShieldBar({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AppProvider>();
    final strings = AppStrings.of(context);
    final isShieldActive = provider.isNightShieldActive;
    final isMorningCheckedIn = provider.isMorningCheckinDone;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeInOut,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: isShieldActive
            ? const LinearGradient(
                colors: [Color(0xFF1E1B4B), Color(0xFF312E81)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              )
            : LinearGradient(
                colors: isDark
                    ? const [Color(0xFF111C2E), Color(0xFF0D1726)]
                    : const [Color(0xFFE8F8F0), Color(0xFFD3EFE1)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
        border: Border.all(
          color: isShieldActive
              ? const Color(0xFF818CF8).withValues(alpha: 0.5)
              : (isDark ? AppDarkColors.border : AppColors.primary.withValues(alpha: 0.3)),
          width: 1.5,
        ),
        boxShadow: isDark
            ? (isShieldActive
                ? [
                    const BoxShadow(
                      color: Color(0x334338CA),
                      blurRadius: 18,
                      offset: Offset(0, 6),
                    ),
                  ]
                : const [])
            : [
                BoxShadow(
                  color: isShieldActive
                      ? const Color(0xFF4338CA).withValues(alpha: 0.25)
                      : AppColors.primary.withValues(alpha: 0.12),
                  blurRadius: 18,
                  offset: const Offset(0, 6),
                ),
              ],
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: isShieldActive
                  ? const Color(0xFF4F46E5)
                  : (isDark ? AppDarkColors.primarySoft : AppColors.primary.withValues(alpha: 0.2)),
              shape: BoxShape.circle,
            ),
            child: Icon(
              isShieldActive
                  ? Icons.shield_moon_rounded
                  : (isMorningCheckedIn ? Icons.wb_sunny_rounded : Icons.shield_outlined),
              color: isShieldActive
                  ? const Color(0xFFFDE047)
                  : (isDark ? AppDarkColors.primaryGlow : AppColors.primary),
              size: 24,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Text(
                      isShieldActive
                          ? strings.text('KHIÊN ĐÊM: ĐANG BẬT', 'NIGHT SHIELD: ACTIVE')
                          : strings.text('NGHI THỨC BÌNH AN', 'PEACE RITUAL'),
                      style: AppTextStyles.caption.copyWith(
                        color: isShieldActive
                            ? const Color(0xFFC7D2FE)
                            : (isDark ? AppDarkColors.textSecondary : AppColors.textSecondary),
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.8,
                        fontSize: 10.5,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      width: 7,
                      height: 7,
                      decoration: BoxDecoration(
                        color: isShieldActive
                            ? const Color(0xFF4ADE80)
                            : (isMorningCheckedIn
                                ? (isDark ? AppDarkColors.primary : AppColors.primary)
                                : AppColors.warning),
                        shape: BoxShape.circle,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  isShieldActive
                      ? strings.text(
                          'Giám sát thụ động trong giấc ngủ',
                          'Passive monitoring while asleep',
                        )
                      : (isMorningCheckedIn
                          ? strings.text('Đã điểm danh thức dậy hôm nay', 'Morning check-in completed')
                          : strings.text('Chưa bật khiên đêm', 'Night shield standby')),
                  style: AppTextStyles.bodyStrong.copyWith(
                    color: isShieldActive
                        ? Colors.white
                        : (isDark ? AppDarkColors.textPrimary : AppColors.textPrimary),
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: () async {
                HapticFeedback.heavyImpact();
                if (isShieldActive) {
                  await provider.checkinMorningSunlight();
                  if (!context.mounted) return;
                  TopToast.show(
                    context,
                    message: strings.text(
                      'Chào buổi sáng! Đã điểm danh bình minh.',
                      'Good morning! Sunlight check-in sent.',
                    ),
                    icon: Icons.wb_sunny_rounded,
                  );
                } else {
                  await provider.toggleNightShield();
                  if (!context.mounted) return;
                  TopToast.show(
                    context,
                    message: strings.text(
                      'Đã kích hoạt Khiên Đêm. Ngủ ngon và bình an!',
                      'Night Shield activated. Sleep safely!',
                    ),
                    icon: Icons.shield_moon_rounded,
                  );
                }
              },
              child: Ink(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: isShieldActive
                      ? const Color(0xFFFDE047)
                      : AppColors.primary,
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [
                    BoxShadow(
                      color: isShieldActive
                          ? const Color(0xFFFDE047).withValues(alpha: 0.3)
                          : AppColors.primary.withValues(alpha: 0.25),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      isShieldActive ? Icons.wb_sunny_rounded : Icons.bedtime_rounded,
                      size: 15,
                      color: isShieldActive ? const Color(0xFF1E1B4B) : Colors.white,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      isShieldActive
                          ? strings.text('Bình minh', 'Sunlight')
                          : strings.text('Khóa đêm', 'Lock night'),
                      style: AppTextStyles.bodyStrong.copyWith(
                        color: isShieldActive ? const Color(0xFF1E1B4B) : Colors.white,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
