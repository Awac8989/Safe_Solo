import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../../core/app_strings.dart';
import '../../../core/app_theme.dart';
import '../../../core/providers/app_provider.dart';
import '../../../models/circle_orbit_member.dart';
import 'biometric_resonance_sheet.dart';

class CircleOrbitVisualizer extends StatefulWidget {
  const CircleOrbitVisualizer({super.key});

  @override
  State<CircleOrbitVisualizer> createState() => _CircleOrbitVisualizerState();
}

class _CircleOrbitVisualizerState extends State<CircleOrbitVisualizer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _orbitController;

  @override
  void initState() {
    super.initState();
    _orbitController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 40),
    )..repeat();
  }

  @override
  void dispose() {
    _orbitController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AppProvider>();
    final strings = AppStrings.of(context);
    final isNight = provider.isNightShieldActive;
    final members = provider.orbitMembers;
    final userName = provider.user?.name ?? strings.text('Bạn', 'You');

    return Container(
      width: double.infinity,
      height: 270,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: isNight
            ? const LinearGradient(
                colors: [Color(0xFF0F172A), Color(0xFF1E1B4B)],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              )
            : const LinearGradient(
                colors: [Color(0xFFF8FCFA), Color(0xFFEBF7F0)],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
        border: Border.all(
          color: isNight
              ? const Color(0xFF3730A3).withValues(alpha: 0.5)
              : AppColors.border.withValues(alpha: 0.8),
        ),
        boxShadow: [
          BoxShadow(
            color: isNight
                ? const Color(0xFF1E1B4B).withValues(alpha: 0.4)
                : Colors.black.withValues(alpha: 0.04),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Background orbit rings canvas
            AnimatedBuilder(
              animation: _orbitController,
              builder: (context, child) {
                return CustomPaint(
                  size: const Size(double.infinity, 270),
                  painter: _OrbitRingsPainter(
                    angle: _orbitController.value * 2 * math.pi,
                    isNight: isNight,
                  ),
                );
              },
            ),
            // Header label inside the canvas
            Positioned(
              top: 12,
              left: 16,
              child: Row(
                children: [
                  Icon(
                    Icons.bubble_chart_rounded,
                    size: 16,
                    color: isNight ? const Color(0xFF818CF8) : AppColors.primary,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    strings.text('QUỸ ĐẠO BÌNH AN (THE ORBIT)', 'THE ORBIT OF PEACE'),
                    style: AppTextStyles.caption.copyWith(
                      color: isNight ? const Color(0xFFC7D2FE) : AppColors.textSecondary,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.6,
                      fontSize: 10.5,
                    ),
                  ),
                ],
              ),
            ),
            Positioned(
              top: 12,
              right: 16,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: isNight
                      ? Colors.white.withValues(alpha: 0.1)
                      : AppColors.surface,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                        color: Color(0xFF22C55E),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      strings.text('Trực tiếp', 'Live'),
                      style: AppTextStyles.caption.copyWith(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: isNight ? Colors.white70 : AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            // Center Node: User (Bạn)
            _buildCenterNode(userName, isNight),
            // Satellites: Orbit Members
            if (members.isNotEmpty)
              ..._buildSatellites(members, isNight),
            // Legend at bottom
            Positioned(
              bottom: 10,
              left: 14,
              right: 14,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _buildLegendItem(const Color(0xFF2FAA68), strings.text('Ở nhà', 'At home'), isNight),
                  const SizedBox(width: 12),
                  _buildLegendItem(const Color(0xFFFF9E1B), strings.text('Đi đường', 'Transit'), isNight),
                  const SizedBox(width: 12),
                  _buildLegendItem(const Color(0xFF8B5CF6), strings.text('Ngủ', 'Sleep'), isNight),
                  const SizedBox(width: 12),
                  Text(
                    strings.text('• Chạm để đồng điệu', '• Tap to sync'),
                    style: AppTextStyles.caption.copyWith(
                      color: isNight ? const Color(0xFF94A3B8) : AppColors.textMuted,
                      fontSize: 10.5,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLegendItem(Color color, String label, bool isNight) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 7,
          height: 7,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: AppTextStyles.caption.copyWith(
            color: isNight ? const Color(0xFFCBD5E1) : AppColors.textSecondary,
            fontSize: 10.5,
          ),
        ),
      ],
    );
  }

  Widget _buildCenterNode(String userName, bool isNight) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: isNight
                ? const LinearGradient(
                    colors: [Color(0xFF6366F1), Color(0xFF4338CA)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  )
                : const LinearGradient(
                    colors: [Color(0xFF34D399), Color(0xFF10B981)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
            boxShadow: [
              BoxShadow(
                color: isNight
                    ? const Color(0xFF6366F1).withValues(alpha: 0.5)
                    : const Color(0xFF10B981).withValues(alpha: 0.4),
                blurRadius: 18,
                spreadRadius: 2,
              ),
            ],
            border: Border.all(color: Colors.white, width: 2),
          ),
          alignment: Alignment.center,
          child: Text(
            userName.substring(0, 1).toUpperCase(),
            style: AppTextStyles.h3.copyWith(color: Colors.white, fontSize: 18),
          ),
        ),
        const SizedBox(height: 4),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(
            color: isNight ? const Color(0xFF1E293B) : Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isNight ? const Color(0xFF475569) : AppColors.border,
            ),
          ),
          child: Text(
            userName,
            style: AppTextStyles.caption.copyWith(
              color: isNight ? Colors.white : AppColors.textPrimary,
              fontWeight: FontWeight.w700,
              fontSize: 10.5,
            ),
          ),
        ),
      ],
    );
  }

  List<Widget> _buildSatellites(List<CircleOrbitMember> members, bool isNight) {
    final List<Widget> widgets = [];
    final count = members.length;

    // Relative orbit parameters (elliptical orbits centered at middle)
    final double radiusX = 130;
    final double radiusY = 72;

    for (int i = 0; i < count; i++) {
      final member = members[i];
      final baseAngle = (i * (2 * math.pi / count)) - (math.pi / 2);

      widgets.add(
        AnimatedBuilder(
          animation: _orbitController,
          builder: (context, child) {
            final currentAngle = baseAngle + (_orbitController.value * 2 * math.pi * 0.4);
            final double x = radiusX * math.cos(currentAngle);
            final double y = radiusY * math.sin(currentAngle) - 6;

            return Transform.translate(
              offset: Offset(x, y),
              child: GestureDetector(
                onTap: () {
                  HapticFeedback.selectionClick();
                  BiometricResonanceSheet.show(context, member);
                },
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Stack(
                      clipBehavior: Clip.none,
                      alignment: Alignment.center,
                      children: [
                        // Glow ring
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: member.auraColor.withValues(alpha: isNight ? 0.25 : 0.15),
                            boxShadow: [
                              BoxShadow(
                                color: member.auraColor.withValues(alpha: 0.35),
                                blurRadius: 10,
                                spreadRadius: 1,
                              ),
                            ],
                          ),
                        ),
                        // Avatar
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: isNight ? const Color(0xFF1E293B) : Colors.white,
                            border: Border.all(color: member.auraColor, width: 2),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            member.name.substring(0, 1).toUpperCase(),
                            style: AppTextStyles.bodyStrong.copyWith(
                              color: member.auraColor,
                              fontSize: 14,
                            ),
                          ),
                        ),
                        // Status Badge (Battery / Heart icon)
                        Positioned(
                          right: -3,
                          bottom: -3,
                          child: Container(
                            padding: const EdgeInsets.all(2),
                            decoration: BoxDecoration(
                              color: isNight ? const Color(0xFF0F172A) : Colors.white,
                              shape: BoxShape.circle,
                              border: Border.all(color: member.auraColor, width: 1),
                            ),
                            child: Icon(
                              member.status == OrbitSafetyStatus.transit
                                  ? Icons.directions_car_filled_rounded
                                  : (member.isCharging
                                      ? Icons.bolt_rounded
                                      : Icons.favorite_rounded),
                              size: 10,
                              color: member.auraColor,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                      decoration: BoxDecoration(
                        color: isNight
                            ? const Color(0xFF0F172A).withValues(alpha: 0.85)
                            : Colors.white.withValues(alpha: 0.9),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        member.name,
                        style: AppTextStyles.caption.copyWith(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w600,
                          color: isNight ? Colors.white : AppColors.textPrimary,
                        ),
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

    return widgets;
  }
}

class _OrbitRingsPainter extends CustomPainter {
  _OrbitRingsPainter({required this.angle, required this.isNight});

  final double angle;
  final bool isNight;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, (size.height / 2) - 6);

    final linePaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2
      ..color = isNight
          ? const Color(0xFF4338CA).withValues(alpha: 0.35)
          : AppColors.primary.withValues(alpha: 0.2);

    // Inner orbit
    canvas.drawOval(
      Rect.fromCenter(center: center, width: 170, height: 95),
      linePaint,
    );

    // Outer orbit
    final outerPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0
      ..color = isNight
          ? const Color(0xFF6366F1).withValues(alpha: 0.25)
          : AppColors.primary.withValues(alpha: 0.15);

    canvas.drawOval(
      Rect.fromCenter(center: center, width: 265, height: 148),
      outerPaint,
    );

    // Subtle cosmic star dust dots
    final dotPaint = Paint()
      ..color = isNight
          ? const Color(0xFF818CF8).withValues(alpha: 0.4)
          : AppColors.primary.withValues(alpha: 0.3)
      ..style = PaintingStyle.fill;

    final double dotRadiusX = 132;
    final double dotRadiusY = 74;

    for (int i = 0; i < 8; i++) {
      final a = (i * (math.pi / 4)) + (angle * 0.2);
      final dx = center.dx + (dotRadiusX * math.cos(a));
      final dy = center.dy + (dotRadiusY * math.sin(a));
      canvas.drawCircle(Offset(dx, dy), 1.5, dotPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _OrbitRingsPainter oldDelegate) {
    return oldDelegate.angle != angle || oldDelegate.isNight != isNight;
  }
}
