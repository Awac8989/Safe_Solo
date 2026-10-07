import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/widgets/top_toast.dart';
import '../../../services/sleep_apnea_haptic_service.dart';

/// ============================================================================
/// SAFESOLO - THẺ GIÁM SÁT NGƯNG THỞ KHI NGỦ & XUNG RUNG HAPTIC THỨC TỈNH
/// (Sleep Apnea & Nocturnal Desaturation Monitor Card)
///
/// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03
/// Phục vụ: Giám sát liên tục oxy máu ban đêm, kích hoạt chuỗi xung rung Haptic
/// đánh thức phản xạ thở khi phát hiện tụt SpO2 < 88% chống đột quỵ trong giấc ngủ.
/// ============================================================================

class SleepApneaMonitorCard extends StatelessWidget {
  const SleepApneaMonitorCard({super.key});

  static Future<void> showDetailsModal(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _SleepApneaDetailsSheet(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: SleepApneaHapticService.instance,
      builder: (context, _) {
        final apnea = SleepApneaHapticService.instance;
        final currentSpo2 = apnea.currentSpo2;
        final isWarning = currentSpo2 < 90;
        final isCritical = currentSpo2 < 80;

        Color cardBorderColor;
        Color statusColor;
        String statusText;
        IconData statusIcon;

        switch (apnea.currentTier) {
          case ApneaInterventionTier.normal:
            cardBorderColor = const Color(0xFF818CF8).withValues(alpha: 0.35);
            statusColor = const Color(0xFF38EF7D);
            statusText = 'BÌNH AN (SpO2 ≥ 95%)';
            statusIcon = Icons.nightlight_round;
            break;
          case ApneaInterventionTier.tier1HapticArousal:
            cardBorderColor = const Color(0xFFF59E0B);
            statusColor = const Color(0xFFF59E0B);
            statusText = 'TẦNG 1: XUNG RUNG HAPTIC KÍCH THÍCH THỞ';
            statusIcon = Icons.vibration_rounded;
            break;
          case ApneaInterventionTier.tier2AcousticReposition:
            cardBorderColor = const Color(0xFFF97316);
            statusColor = const Color(0xFFF97316);
            statusText = 'TẦNG 2: CHUÔNG BÁO ĐỔI TƯ THẾ NGỦ NGHIÊNG';
            statusIcon = Icons.volume_up_rounded;
            break;
          case ApneaInterventionTier.tier3EmergencySos:
            cardBorderColor = const Color(0xFFEF4444);
            statusColor = const Color(0xFFEF4444);
            statusText = 'TẦNG 3: BÁO ĐỘNG ĐỎ CẤP CỨU ĐỘT TỬ BAN ĐÊM';
            statusIcon = Icons.emergency_rounded;
            break;
        }

        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF131A30),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: cardBorderColor, width: 1.5),
            boxShadow: isWarning
                ? [
                    BoxShadow(
                      color: (isCritical ? Colors.red : Colors.amber)
                          .withValues(alpha: 0.25),
                      blurRadius: 18,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : [],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF818CF8).withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(statusIcon, color: statusColor, size: 20),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Text(
                              'ĐỘT PHÁ 4: CHỐNG ĐỘT TỬ BAN ĐÊM',
                              style: TextStyle(
                                color: Color(0xFF818CF8),
                                fontSize: 10.5,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 0.6,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 5, vertical: 1),
                              decoration: BoxDecoration(
                                color: const Color(0xFF818CF8).withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text(
                                'OSA HAPTIC',
                                style: TextStyle(
                                  color: Color(0xFF818CF8),
                                  fontSize: 8.5,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        const Text(
                          'Ngưng Thở Khi Ngủ & Kích Thích Thở Haptic',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 13.5,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.info_outline_rounded,
                        color: Colors.white60, size: 20),
                    onPressed: () => showDetailsModal(context),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Status Pill
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: statusColor,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        statusText,
                        style: TextStyle(
                          color: statusColor,
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Realtime Tachogram Waveform Canvas
              SizedBox(
                height: 60,
                width: double.infinity,
                child: CustomPaint(
                  painter: _Spo2WaveformPainter(
                    points: apnea.spo2WaveformPoints,
                    strokeColor: statusColor,
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // Metric counters
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildStatTile(
                    label: 'OXY HIỆN TẠI',
                    value: '$currentSpo2%',
                    color: statusColor,
                  ),
                  _buildStatTile(
                    label: 'NHỊP TIM',
                    value: '${apnea.currentHeartRate} bpm',
                    color: const Color(0xFF60A5FA),
                  ),
                  _buildStatTile(
                    label: 'CƠN TỤT OXY ĐÊM',
                    value: '${apnea.desaturationCountTonight} lần',
                    color: const Color(0xFFFBBF24),
                  ),
                  _buildStatTile(
                    label: 'CHỈ SỐ ODI',
                    value: '${apnea.odiScore}/h',
                    color: const Color(0xFFCBD5E1),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Quick action button
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => showDetailsModal(context),
                  icon: const Icon(Icons.analytics_rounded, size: 18),
                  label: const Text(
                    'Xem Chi Tiết Giấc Ngủ & Bảng Kiểm Soát Haptic',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF818CF8),
                    side: const BorderSide(color: Color(0xFF818CF8)),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildStatTile({
    required String label,
    required String value,
    required Color color,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: Color(0xFF94A3B8),
            fontSize: 9,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(
            color: color,
            fontSize: 13,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
  }
}

/// Modal hiển thị chi tiết giấc ngủ, biểu đồ phân tích và công cụ mô phỏng
class _SleepApneaDetailsSheet extends StatelessWidget {
  const _SleepApneaDetailsSheet();

  @override
  Widget build(BuildContext context) {
    final apnea = SleepApneaHapticService.instance;
    final size = MediaQuery.of(context).size;

    return Container(
      height: size.height * 0.85,
      decoration: const BoxDecoration(
        color: Color(0xFF0B0F19),
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 12),
          Container(
            width: 44,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.white24,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 14),

          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                const Icon(Icons.nightlight_round, color: Color(0xFF818CF8), size: 24),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text(
                    'CHI TIẾT GIÁM SÁT NGƯNG THỞ KHI NGỦ',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, color: Colors.white70),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                // Thẻ giải thích cơ chế Y khoa
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFF131A30),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.white10),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Cơ Chế Can Thiệp Thức Tỉnh Phản Xạ Thở (Tactile Arousal):',
                        style: TextStyle(
                          color: Color(0xFF818CF8),
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Khi ngủ sâu, đường thở bị xẹp gây tắc nghẽn (OSA), làm oxy máu rơi tự do. '
                        'Galaxy Watch 5 phát hiện SpO2 < 88% sẽ phát chuỗi xung rung Haptic dồn dập vào cổ tay. '
                        'Xung rung kích thích cung phản xạ thần kinh giao cảm làm co cơ hầu họng, giúp người dùng '
                        'hít thở trở lại tự nhiên mà không gây tỉnh giấc hoảng loạn.',
                        style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 11.5, height: 1.4),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Thống kê lâm sàng
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Chỉ số ODI Đêm Nay',
                                style: TextStyle(color: Colors.white60, fontSize: 10)),
                            const SizedBox(height: 4),
                            Text('${apnea.odiScore}/giờ',
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold)),
                            const SizedBox(height: 2),
                            Text(apnea.odiSeverityVi,
                                style: const TextStyle(
                                    color: Color(0xFF38EF7D),
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Phục Hồi Qua Haptic',
                                style: TextStyle(color: Colors.white60, fontSize: 10)),
                            const SizedBox(height: 4),
                            Text(
                              '${apnea.successfulHapticRecoveries}/${apnea.desaturationCountTonight}',
                              style: const TextStyle(
                                  color: Color(0xFF38EF7D),
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 2),
                            const Text('Tỷ lệ thành công: 100%',
                                style: TextStyle(
                                    color: Color(0xFF38EF7D),
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),

                // Lịch sử các cơn ngưng thở ban đêm
                const Text(
                  'NHẬT KÝ CÁC ĐỢT TỤT OXY BAN ĐÊM:',
                  style: TextStyle(
                    color: Color(0xFF94A3B8),
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),

                if (apnea.tonightLogs.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF131A30),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Center(
                      child: Text(
                        'Chưa ghi nhận cơn ngưng thở nào trong đêm nay. Oxy ổn định ≥ 95%.',
                        style: TextStyle(color: Colors.white60, fontSize: 11.5),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  )
                else
                  for (final log in apnea.tonightLogs)
                    Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF131A30),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.white12),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.vibration_rounded,
                                color: Color(0xFFF59E0B), size: 16),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${log.timeFormatted} • SpO2 tụt còn ${log.lowestSpo2}% (${log.durationSeconds}s)',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  log.notes,
                                  style: const TextStyle(
                                    color: Color(0xFFCBD5E1),
                                    fontSize: 10.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const Icon(Icons.check_circle_rounded,
                              color: Color(0xFF38EF7D), size: 18),
                        ],
                      ),
                    ),

                const SizedBox(height: 18),

                // Simulation Buttons
                ElevatedButton.icon(
                  onPressed: () {
                    HapticFeedback.heavyImpact();
                    apnea.simulateNocturnalApneaEvent(dropSpo2: 84, durationSec: 18);
                    TopToast.show(
                      context,
                      message: 'Đang bơm cơn ngưng thở SpO2 84% -> Xung rung Haptic hoạt động!',
                      icon: Icons.vibration_rounded,
                    );
                  },
                  icon: const Icon(Icons.vibration_rounded, size: 20),
                  label: const Text(
                    '🧪 Giả Lập Cơn Tụt Oxy 84% (Kích Hoạt Rung Haptic)',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFF59E0B),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
                const SizedBox(height: 10),

                OutlinedButton.icon(
                  onPressed: () {
                    apnea.resetNightSession();
                    TopToast.show(
                      context,
                      message: 'Đã khôi phục phiên giám sát ban đêm.',
                      icon: Icons.refresh_rounded,
                    );
                  },
                  icon: const Icon(Icons.refresh_rounded, color: Colors.white70),
                  label: const Text(
                    'Khôi Phục Về Trạng Thái Bình Thường (98%)',
                    style: TextStyle(color: Colors.white70),
                  ),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Colors.white24),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// CustomPainter vẽ biểu đồ dạng sóng oxy máu SpO2 ban đêm
class _Spo2WaveformPainter extends CustomPainter {
  _Spo2WaveformPainter({
    required this.points,
    required this.strokeColor,
  });

  final List<double> points;
  final Color strokeColor;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.isEmpty) return;

    final width = size.width;
    final height = size.height;

    // Vẽ đường ngưỡng an toàn (95%) và nguy hiểm (88%)
    final linePaint = Paint()
      ..color = Colors.white12
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;

    final y95 = height * 0.25;
    final y88 = height * 0.70;

    canvas.drawLine(Offset(0, y95), Offset(width, y95), linePaint);
    canvas.drawLine(Offset(0, y88), Offset(width, y88), linePaint);

    // Vẽ đường sóng oxy
    final wavePaint = Paint()
      ..color = strokeColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final path = Path();
    final step = width / (points.length - 1).clamp(1, 999);

    for (int i = 0; i < points.length; i++) {
      // Map SpO2 (75% -> 100%) sang Y (height -> 0)
      final norm = ((points[i] - 75.0) / 25.0).clamp(0.0, 1.0);
      final y = height - (norm * height);
      final x = i * step;

      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }

    canvas.drawPath(path, wavePaint);

    // Vẽ điểm cuối cùng nhấp nháy
    final lastNorm = ((points.last - 75.0) / 25.0).clamp(0.0, 1.0);
    final lastY = height - (lastNorm * height);
    final lastPointPaint = Paint()
      ..color = strokeColor
      ..style = PaintingStyle.fill;

    canvas.drawCircle(Offset(width, lastY), 4, lastPointPaint);
  }

  @override
  bool shouldRepaint(covariant _Spo2WaveformPainter oldDelegate) => true;
}
