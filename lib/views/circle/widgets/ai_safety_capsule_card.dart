import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../../core/app_strings.dart';
import '../../../core/app_theme.dart';
import '../../../core/providers/app_provider.dart';
import '../../../core/widgets/top_toast.dart';

class AiSafetyCapsuleCard extends StatelessWidget {
  const AiSafetyCapsuleCard({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AppProvider>();
    final capsule = provider.dailySafetyCapsule;
    final strings = AppStrings.of(context);

    if (capsule == null) {
      return const SizedBox.shrink();
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFC7D2FE)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF6366F1).withValues(alpha: 0.08),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Capsule Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFEEF2FF),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.auto_awesome_rounded,
                  color: Color(0xFF6366F1),
                  size: 18,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      strings.text('BƯU THIẾP BÌNH AN 24H (AI CAPSULE)', '24H SAFETY CAPSULE (AI)'),
                      style: AppTextStyles.caption.copyWith(
                        color: const Color(0xFF4F46E5),
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.6,
                        fontSize: 10.5,
                      ),
                    ),
                    Text(
                      strings.text('Tổng kết tự động hôm nay', 'Daily automated summary'),
                      style: AppTextStyles.caption.copyWith(
                        color: AppColors.textSecondary,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              if (capsule.isSentToCircle)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFDCFCE7),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 14),
                      const SizedBox(width: 4),
                      Text(
                        strings.text('Đã gửi', 'Sent'),
                        style: AppTextStyles.caption.copyWith(
                          color: const Color(0xFF16A34A),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          // AI Summary Text
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Text(
              strings.isVietnamese ? capsule.summaryMessageVi : capsule.summaryMessageEn,
              style: AppTextStyles.body.copyWith(
                color: AppColors.textPrimary,
                height: 1.5,
                fontSize: 13,
              ),
            ),
          ),
          const SizedBox(height: 12),
          // Vital Stat Chips
          Row(
            children: [
              _buildStatChip(
                icon: Icons.directions_walk_rounded,
                label: '${capsule.stepCount} ${strings.text('bước', 'steps')}',
                color: const Color(0xFF0EA5E9),
              ),
              const SizedBox(width: 8),
              _buildStatChip(
                icon: Icons.favorite_rounded,
                label: '${capsule.avgHeartRate} bpm',
                color: const Color(0xFFE11D48),
              ),
              const SizedBox(width: 8),
              _buildStatChip(
                icon: Icons.home_rounded,
                label: '${strings.text('Về lúc', 'Home at')} ${capsule.arrivedHomeTime}',
                color: const Color(0xFF16A34A),
              ),
            ],
          ),
          if (!capsule.isSentToCircle) ...[
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () async {
                  HapticFeedback.lightImpact();
                  await provider.publishDailySafetyCapsule();
                  if (!context.mounted) return;
                  TopToast.show(
                    context,
                    message: strings.text(
                      'Đã chia sẻ Bưu thiếp Bình An lên Vòng tròn gia đình!',
                      'Safety Capsule published to Family Circle!',
                    ),
                    icon: Icons.send_rounded,
                  );
                },
                icon: const Icon(Icons.send_rounded, size: 16),
                label: Text(strings.text('Gửi bưu thiếp cho gia đình', 'Share capsule with family')),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF4F46E5),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildStatChip({
    required IconData icon,
    required String label,
    required Color color,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                label,
                style: AppTextStyles.caption.copyWith(
                  color: color,
                  fontWeight: FontWeight.w700,
                  fontSize: 10.5,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
