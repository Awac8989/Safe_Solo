import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../core/providers/app_provider.dart';
import '../active_journey_page.dart';
import '../live_journey_setup_sheet.dart';

class HomeJourneyCard extends StatelessWidget {
  const HomeJourneyCard({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AppProvider>();
    final journey = provider.activeJourney;
    final hasActiveJourney = journey != null && journey.isInTransit;

    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (!hasActiveJourney) {
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: isDark ? AppDarkColors.card : AppColors.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: isDark ? AppDarkColors.border : AppColors.border),
          boxShadow: isDark
              ? const []
              : const [
                  BoxShadow(
                    color: Color(0x08000000),
                    blurRadius: 10,
                    offset: Offset(0, 3),
                  ),
                ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: isDark ? AppDarkColors.primarySoft : AppColors.primarySoft,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.navigation_rounded, color: AppColors.primary, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Live Journey Guard',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: isDark ? AppDarkColors.textPrimary : AppColors.textPrimary,
                    ),
                  ),
                  Text(
                    'Hộ tống an toàn khi đi đêm hoặc taxi',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? AppDarkColors.textSecondary : AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            ElevatedButton(
              onPressed: () => LiveJourneySetupSheet.show(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                minimumSize: const Size(64, 36),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
              ),
              child: const Text('Bắt đầu'),
            ),
          ],
        ),
      );
    }

    final isOverdue = journey.isOverdue;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      decoration: BoxDecoration(
        color: isOverdue
            ? (isDark ? const Color(0xFF2E1214) : const Color(0xFFFEF2F2))
            : (isDark ? const Color(0xFF0F261C) : const Color(0xFFF0FDF4)),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isOverdue ? AppColors.destructive : (isDark ? AppDarkColors.primary : AppColors.success),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: (isOverdue ? AppColors.destructive : AppColors.success).withValues(alpha: isDark ? 0.25 : 0.15),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute<void>(
                builder: (_) => const ActiveJourneyPage(),
              ),
            );
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: (isOverdue ? AppColors.destructive : AppColors.success).withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    isOverdue ? Icons.warning_amber_rounded : Icons.radar_rounded,
                    color: isOverdue ? AppColors.destructive : (isDark ? AppDarkColors.primary : AppColors.success),
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            isOverdue ? 'HÀNH TRÌNH QUÁ HẠN' : 'ĐANG GIÁM SÁT HÀNH TRÌNH',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: isOverdue ? AppColors.destructive : (isDark ? AppDarkColors.primary : AppColors.success),
                              letterSpacing: 0.5,
                            ),
                          ),
                          const Spacer(),
                          Text(
                            journey.remainingFormatted,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w900,
                              color: isOverdue ? AppColors.destructive : (isDark ? AppDarkColors.primary : AppColors.success),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        journey.destinationLabel,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: isDark ? AppDarkColors.textPrimary : AppColors.textPrimary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Icon(
                  Icons.chevron_right_rounded,
                  color: isDark ? AppDarkColors.textSecondary : AppColors.textSecondary,
                  size: 20,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
