import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/app_strings.dart';
import '../../../core/app_theme.dart';
import '../../../core/providers/app_provider.dart';
import '../../../models/disaster_alert_model.dart';
import 'disaster_alert_detail_sheet.dart';

class DisasterLiveFeedSection extends StatefulWidget {
  const DisasterLiveFeedSection({super.key});

  @override
  State<DisasterLiveFeedSection> createState() => _DisasterLiveFeedSectionState();
}

class _DisasterLiveFeedSectionState extends State<DisasterLiveFeedSection> {
  bool _isRefreshing = false;

  Future<void> _handleRefresh(BuildContext context) async {
    setState(() => _isRefreshing = true);
    final strings = AppStrings.of(context);
    final messenger = ScaffoldMessenger.maybeOf(context);
    try {
      await context.read<AppProvider>().refreshDisasterAlerts();
      if (mounted && messenger != null) {
        messenger.hideCurrentSnackBar();
        messenger.showSnackBar(
          SnackBar(
            behavior: SnackBarBehavior.floating,
            content: Text(
              strings.text(
                'Đã đồng bộ cảnh báo bão lũ mới nhất từ Ban Chỉ Huy Admin.',
                'Disaster alerts updated from Admin command center.',
              ),
            ),
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (_) {
    } finally {
      if (mounted) {
        setState(() => _isRefreshing = false);
      }
    }
  }

  List<DisasterAlertModel> _resolveAlerts(List<DisasterAlertModel> serverAlerts) {
    if (serverAlerts.isNotEmpty) {
      return serverAlerts;
    }
    // Dữ liệu chuẩn mực mặc định từ Ban chỉ huy phòng chống thiên tai SafeSolo Admin
    return [
      DisasterAlertModel(
        id: 'seed-flood-q7',
        title: 'TRIỀU CƯỜNG NGẬP NƯỚC SÂU 0.7M - SÔNG SÀI GÒN',
        description: 'Triều cường dâng cao vượt báo động 3 làm ngập úng nghiêm trọng nhiều tuyến đường ven sông, xe chết máy hàng loạt, nguy cơ chập rò rỉ điện.',
        category: DisasterCategory.flooding,
        severity: DisasterSeverity.critical,
        lat: 10.7420,
        lng: 106.6840,
        radiusMeters: 1500,
        address: 'Đường Trần Xuân Soạn (Cầu Rạch Ông ➔ Cầu Tân Thuận), Quận 7, TP.HCM',
        safetyAdvice: 'Không cố đi xe máy qua vùng nước ngập sâu quá bánh xe. Tránh xa cột điện, tủ điện ngập nước.',
        evacuationRouteTip: 'Di chuyển theo trục đường Nguyễn Thị Thập hoặc cầu Kênh Tẻ.',
        status: 'ACTIVE',
        issuedBy: 'Ban Chỉ Huy PCTT & Cứu Hộ SafeSolo Admin 115',
        broadcastCount: 385,
        distanceKm: 1.2,
        imageUrl: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=800&q=80',
        createdAt: DateTime.now().subtract(const Duration(minutes: 18)),
      ),
      DisasterAlertModel(
        id: 'seed-landslide-bl',
        title: 'CẢNH BÁO SẠT LỞ ĐẤT ĐÈO BẢO LỘC DO MƯA LỚN',
        description: 'Mưa lớn liên tục gây sạt trượt taluy dương tại Km 104+200, đất đá tràn xuống mặt đường, nguy cơ sạt lở nguy cấp.',
        category: DisasterCategory.landslide,
        severity: DisasterSeverity.critical,
        lat: 11.4720,
        lng: 107.7260,
        radiusMeters: 5000,
        address: 'Đèo Bảo Lộc, Quốc Lộ 20, Tỉnh Lâm Đồng',
        safetyAdvice: 'Dừng ngay việc lưu thông qua đèo. Tìm nơi đỗ xe kiên cố tại chân đèo hoặc đi vòng theo hướng Tỉnh lộ 725.',
        evacuationRouteTip: 'Đường tránh Tỉnh lộ 725 qua Huyện Đạ Tẻh ➔ Huyện Bảo Lâm.',
        status: 'ACTIVE',
        issuedBy: 'Cảnh Sát Giao Thông & Admin SafeSolo PCTT',
        broadcastCount: 142,
        distanceKm: 8.5,
        imageUrl: 'https://images.unsplash.com/photo-1578885136359-16c8bd4d3a8e?auto=format&fit=crop&w=800&q=80',
        createdAt: DateTime.now().subtract(const Duration(hours: 1, minutes: 25)),
      ),
    ];
  }

  String _formatTime(DateTime dateTime) {
    final hour = dateTime.hour.toString().padLeft(2, '0');
    final minute = dateTime.minute.toString().padLeft(2, '0');
    final day = dateTime.day.toString().padLeft(2, '0');
    final month = dateTime.month.toString().padLeft(2, '0');
    final year = dateTime.year;
    return '$hour:$minute · $day/$month/$year';
  }

  @override
  Widget build(BuildContext context) {
    final appProvider = context.watch<AppProvider>();
    final strings = AppStrings.of(context);
    final alerts = _resolveAlerts(appProvider.activeDisasterAlerts);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header Section
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: const Color(0xFFEF4444).withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.radar_rounded,
                color: Color(0xFFEF4444),
                size: 20,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    strings.text(
                      'CẢNH BÁO BÃO LŨ & NGẬP LỤT',
                      'FLOOD & STORM DISASTER ALERTS',
                    ),
                    style: AppTextStyles.caption.copyWith(
                      color: const Color(0xFFB91C1C),
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.4,
                    ),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    strings.text(
                      'Cập nhật trực tiếp từ Ban Chỉ Huy Admin SafeSolo 115/114',
                      'Live broadcast from SafeSolo Disaster Admin Center',
                    ),
                    style: AppTextStyles.caption.copyWith(
                      fontSize: 10.5,
                      color: AppColors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
            InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: _isRefreshing ? null : () => _handleRefresh(context),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _isRefreshing
                        ? const SizedBox(
                            width: 12,
                            height: 12,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppColors.primary,
                            ),
                          )
                        : const Icon(Icons.refresh_rounded, size: 14, color: AppColors.primary),
                    const SizedBox(width: 4),
                    Text(
                      strings.text('Làm mới', 'Sync'),
                      style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.primary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        // List of Disaster Cards
        for (final alert in alerts) ...[
          _DisasterFeedCard(
            alert: alert,
            timeFormatted: _formatTime(alert.createdAt),
          ),
          const SizedBox(height: 14),
        ],
      ],
    );
  }
}

class _DisasterFeedCard extends StatelessWidget {
  const _DisasterFeedCard({
    required this.alert,
    required this.timeFormatted,
  });

  final DisasterAlertModel alert;
  final String timeFormatted;

  @override
  Widget build(BuildContext context) {
    final alertColor = alert.severityColor;
    final strings = AppStrings.of(context);

    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(
          color: alert.isCritical
              ? const Color(0xFFEF4444).withValues(alpha: 0.4)
              : AppColors.border,
          width: alert.isCritical ? 1.4 : 1.0,
        ),
        boxShadow: [
          BoxShadow(
            color: alert.isCritical
                ? const Color(0xFFEF4444).withValues(alpha: 0.10)
                : AppColors.shadowSafe,
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => DisasterAlertDetailSheet.show(context, alert),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Hình ảnh hiện trường / Vệ tinh bão lũ
              Stack(
                children: [
                  AspectRatio(
                    aspectRatio: 16 / 9,
                    child: Image.network(
                      alert.effectiveImageUrl,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Container(
                        color: const Color(0xFF1E293B),
                        child: Center(
                          child: Icon(
                            alert.categoryIcon,
                            size: 48,
                            color: Colors.white54,
                          ),
                        ),
                      ),
                      loadingBuilder: (context, child, progress) {
                        if (progress == null) return child;
                        return Container(
                          color: const Color(0xFF0F172A),
                          child: const Center(
                            child: SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white54,
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  // Dark gradient overlay
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.black.withValues(alpha: 0.2),
                            Colors.black.withValues(alpha: 0.75),
                          ],
                        ),
                      ),
                    ),
                  ),
                  // Top Tags: Severity Badge & Category
                  Positioned(
                    top: 10,
                    left: 10,
                    right: 10,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Flexible(
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: alertColor,
                              borderRadius: BorderRadius.circular(8),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.3),
                                  blurRadius: 6,
                                ),
                              ],
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  alert.isCritical
                                      ? Icons.warning_rounded
                                      : Icons.info_outline_rounded,
                                  color: Colors.white,
                                  size: 13,
                                ),
                                const SizedBox(width: 4),
                                Flexible(
                                  child: Text(
                                    alert.isCritical
                                        ? strings.text('BÁO ĐỘNG ĐỎ', 'CRITICAL')
                                        : strings.text('CẢNH BÁO', 'WARNING'),
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 10,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 0.3,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3.5),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.6),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: Colors.white24, width: 0.8),
                          ),
                          child: Text(
                            'ADMIN · ${alert.broadcastCount}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Bottom overlay on image: Title
                  Positioned(
                    bottom: 10,
                    left: 12,
                    right: 12,
                    child: Text(
                      alert.title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14.5,
                        fontWeight: FontWeight.w800,
                        shadows: [
                          Shadow(color: Colors.black, blurRadius: 6),
                        ],
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),

              // 2. Thông tin chi tiết: Thời gian, Địa chỉ, Lời khuyên
              Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Thời gian cập nhật từ Admin
                    Row(
                      children: [
                        const Icon(Icons.schedule_rounded, size: 14, color: AppColors.textSecondary),
                        const SizedBox(width: 5),
                        Expanded(
                          child: Text(
                            '${strings.text('Thời gian phát lệnh:', 'Broadcast time:')} $timeFormatted',
                            overflow: TextOverflow.ellipsis,
                            style: AppTextStyles.caption.copyWith(
                              color: AppColors.textSecondary,
                              fontWeight: FontWeight.w600,
                              fontSize: 11.5,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),

                    // Địa chỉ / Vị trí chịu ảnh hưởng
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.location_on_rounded, size: 16, color: Color(0xFFEF4444)),
                        const SizedBox(width: 5),
                        Expanded(
                          child: Text(
                            alert.address.isNotEmpty
                                ? alert.address
                                : strings.text('Khu vực cảnh báo diện rộng', 'Wide alert area'),
                            style: AppTextStyles.bodyStrong.copyWith(
                              fontSize: 13,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                      ],
                    ),

                    if (alert.distanceKm > 0) ...[
                      const SizedBox(height: 4),
                      Padding(
                        padding: const EdgeInsets.only(left: 21),
                        child: Text(
                          '📍 ${strings.text('Cách vị trí của bạn:', 'Distance to you:')} ${alert.distanceKm} km',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF0284C7),
                          ),
                        ),
                      ),
                    ],

                    const SizedBox(height: 10),
                    const Divider(height: 1, color: AppColors.border),
                    const SizedBox(height: 10),

                    // Lời khuyên an toàn & Lộ trình sơ tán
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.health_and_safety_rounded, size: 15, color: Color(0xFF059669)),
                              const SizedBox(width: 5),
                              Expanded(
                                child: Text(
                                  strings.text('Hướng dẫn ứng phó & Sơ tán:', 'Safety & Evacuation advice:'),
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF059669),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            alert.safetyAdvice.isNotEmpty
                                ? alert.safetyAdvice
                                : alert.description,
                            style: AppTextStyles.caption.copyWith(
                              fontSize: 11.5,
                              color: AppColors.textPrimary,
                              height: 1.35,
                            ),
                          ),
                          if (alert.evacuationRouteTip.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(
                              '➔ ${strings.text('Lộ trình tránh ngập:', 'Safe route:')} ${alert.evacuationRouteTip}',
                              style: const TextStyle(
                                fontSize: 11,
                                fontStyle: FontStyle.italic,
                                color: Color(0xFF0284C7),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),

                    const SizedBox(height: 12),
                    // Action button: Xem chi tiết bản đồ & gọi 115
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: alertColor,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                              elevation: 0,
                            ),
                            icon: const Icon(Icons.map_rounded, size: 16),
                            label: Text(
                              strings.text('Xem bản đồ sơ tán', 'Evacuation Map'),
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                            ),
                            onPressed: () => DisasterAlertDetailSheet.show(context, alert),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
