import 'dart:math' as math;
import 'package:flutter/material.dart';

/// ============================================================================
/// SAFESOLO - BỘ 3 VÒNG HOẠT ĐỘNG THỂ CHẤT (ACTIVITY RINGS)
/// Lấy cảm hứng từ thiết kế chuẩn của Apple Fitness & Samsung Health Daily Rings
/// Vòng 1 (Ngoài): Bước chân (Steps) - Mục tiêu: 6,000 bước
/// Vòng 2 (Giữa): Calo tiêu thụ (Active Burn) - Mục tiêu: 300 kcal
/// Vòng 3 (Trong): Quãng đường (Distance) - Mục tiêu: 5.0 km
/// ============================================================================
class ActivityRingsWidget extends StatelessWidget {
  const ActivityRingsWidget({
    super.key,
    required this.steps,
    required this.calories,
    required this.distanceKm,
    this.stepGoal = 6000,
    this.calorieGoal = 300.0,
    this.distanceGoal = 5.0,
    this.onSimulateStep,
  });

  final int steps;
  final double calories;
  final double distanceKm;
  final int stepGoal;
  final double calorieGoal;
  final double distanceGoal;
  final VoidCallback? onSimulateStep;

  @override
  Widget build(BuildContext context) {
    final stepProgress = (steps / stepGoal).clamp(0.0, 1.5);
    final calProgress = (calories / calorieGoal).clamp(0.0, 1.5);
    final distProgress = (distanceKm / distanceGoal).clamp(0.0, 1.5);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF131D2F),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: const Color(0xFF38BDF8).withValues(alpha: 0.25),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.25),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Tiêu đề phần Vòng hoạt động
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981).withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.donut_large_rounded,
                      color: Color(0xFF10B981),
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 10),
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'VÒNG HOẠT ĐỘNG HÔM NAY',
                        style: TextStyle(
                          color: Color(0xFF94A3B8),
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.2,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Mục tiêu vận động sinh tồn',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              if (onSimulateStep != null)
                InkWell(
                  onTap: onSimulateStep,
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0284C7).withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: const Color(0xFF38BDF8).withValues(alpha: 0.4),
                      ),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.directions_walk_rounded, color: Color(0xFF38BDF8), size: 14),
                        SizedBox(width: 4),
                        Text(
                          '+25 bước',
                          style: TextStyle(
                            color: Color(0xFF38BDF8),
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 20),

          // Khối vòng tròn 3 tầng & Bảng số liệu chi tiết
          Row(
            children: [
              // Vòng tròn 3 tầng vẽ CustomPainter
              SizedBox(
                width: 136,
                height: 136,
                child: CustomPaint(
                  painter: _ActivityRingsPainter(
                    stepProgress: stepProgress,
                    calProgress: calProgress,
                    distProgress: distProgress,
                  ),
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.bolt_rounded,
                          color: Color(0xFF38BDF8),
                          size: 26,
                        ),
                        Text(
                          '${((stepProgress + calProgress + distProgress) / 3 * 100).toInt()}%',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 18),

              // 3 Hàng chỉ số chi tiết tương ứng với 3 màu vòng
              Expanded(
                child: Column(
                  children: [
                    _RingMetricRow(
                      color: const Color(0xFF10B981),
                      icon: Icons.directions_walk_rounded,
                      label: 'Bước chân',
                      valueText: '$steps',
                      unit: '/ $stepGoal bước',
                      percent: (stepProgress * 100).toInt(),
                    ),
                    const SizedBox(height: 12),
                    _RingMetricRow(
                      color: const Color(0xFFF97316),
                      icon: Icons.local_fire_department_rounded,
                      label: 'Calo tiêu thụ',
                      valueText: calories.toStringAsFixed(0),
                      unit: '/ ${calorieGoal.toInt()} kcal',
                      percent: (calProgress * 100).toInt(),
                    ),
                    const SizedBox(height: 12),
                    _RingMetricRow(
                      color: const Color(0xFF06B6D4),
                      icon: Icons.route_rounded,
                      label: 'Quãng đường',
                      valueText: distanceKm.toStringAsFixed(2),
                      unit: '/ ${distanceGoal.toStringAsFixed(1)} km',
                      percent: (distProgress * 100).toInt(),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _RingMetricRow extends StatelessWidget {
  const _RingMetricRow({
    required this.color,
    required this.icon,
    required this.label,
    required this.valueText,
    required this.unit,
    required this.percent,
  });

  final Color color;
  final IconData icon;
  final String label;
  final String valueText;
  final String unit;
  final int percent;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.2),
            shape: BoxShape.circle,
            border: Border.all(color: color.withValues(alpha: 0.5), width: 1.2),
          ),
          child: Icon(icon, color: color, size: 14),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '$percent%',
                    style: TextStyle(
                      color: color,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 2),
              RichText(
                text: TextSpan(
                  text: valueText,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                  ),
                  children: [
                    TextSpan(
                      text: ' $unit',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.5),
                        fontSize: 10,
                        fontWeight: FontWeight.normal,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// CustomPainter vẽ 3 vòng tròn lồng nhau với độ dày và bán kính chuẩn tỉ lệ
class _ActivityRingsPainter extends CustomPainter {
  _ActivityRingsPainter({
    required this.stepProgress,
    required this.calProgress,
    required this.distProgress,
  });

  final double stepProgress;
  final double calProgress;
  final double distProgress;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    const strokeWidth = 10.5;
    const spacing = 3.5;

    final outerRadius = (size.width / 2) - (strokeWidth / 2);
    final middleRadius = outerRadius - strokeWidth - spacing;
    final innerRadius = middleRadius - strokeWidth - spacing;

    // Vòng 1: Steps (Xanh lá)
    _drawRing(
      canvas: canvas,
      center: center,
      radius: outerRadius,
      strokeWidth: strokeWidth,
      progress: stepProgress,
      color: const Color(0xFF10B981),
      trackColor: const Color(0xFF10B981).withValues(alpha: 0.18),
    );

    // Vòng 2: Calories (Cam)
    _drawRing(
      canvas: canvas,
      center: center,
      radius: middleRadius,
      strokeWidth: strokeWidth,
      progress: calProgress,
      color: const Color(0xFFF97316),
      trackColor: const Color(0xFFF97316).withValues(alpha: 0.18),
    );

    // Vòng 3: Distance (Cyan)
    _drawRing(
      canvas: canvas,
      center: center,
      radius: innerRadius,
      strokeWidth: strokeWidth,
      progress: distProgress,
      color: const Color(0xFF06B6D4),
      trackColor: const Color(0xFF06B6D4).withValues(alpha: 0.18),
    );
  }

  void _drawRing({
    required Canvas canvas,
    required Offset center,
    required double radius,
    required double strokeWidth,
    required double progress,
    required Color color,
    required Color trackColor,
  }) {
    final trackPaint = Paint()
      ..color = trackColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    // Vẽ rãnh nền phía sau
    canvas.drawCircle(center, radius, trackPaint);

    if (progress <= 0.0) return;

    final arcPaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    const startAngle = -math.pi / 2; // Bắt đầu từ vị trí 12h
    final sweepAngle = (2 * math.pi * progress.clamp(0.0, 1.0));

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      startAngle,
      sweepAngle,
      false,
      arcPaint,
    );

    // Nếu vượt mục tiêu (> 100%), vẽ thêm lớp bóng sáng đè lên
    if (progress > 1.0) {
      final overflowAngle = (2 * math.pi * (progress - 1.0).clamp(0.0, 1.0));
      final overflowPaint = Paint()
        ..color = Colors.white.withValues(alpha: 0.8)
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round;

      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        startAngle,
        overflowAngle,
        false,
        overflowPaint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _ActivityRingsPainter oldDelegate) {
    return oldDelegate.stepProgress != stepProgress ||
        oldDelegate.calProgress != calProgress ||
        oldDelegate.distProgress != distProgress;
  }
}
