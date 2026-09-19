import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../../core/app_strings.dart';
import '../../../core/app_theme.dart';
import '../../../core/providers/app_provider.dart';
import '../../../core/widgets/top_toast.dart';
import '../../../models/circle_orbit_member.dart';

class BiometricResonanceSheet extends StatefulWidget {
  const BiometricResonanceSheet({
    super.key,
    required this.member,
  });

  final CircleOrbitMember member;

  static Future<void> show(BuildContext context, CircleOrbitMember member) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => BiometricResonanceSheet(member: member),
    );
  }

  @override
  State<BiometricResonanceSheet> createState() => _BiometricResonanceSheetState();
}

class _BiometricResonanceSheetState extends State<BiometricResonanceSheet>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;
  Timer? _hapticTimer;
  double _holdingProgress = 0.0;
  Timer? _holdTimer;
  bool _resonanceSuccess = false;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: Duration(
        milliseconds: (60000 / widget.member.heartRateBpm).clamp(600, 1200).toInt(),
      ),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _hapticTimer?.cancel();
    _holdTimer?.cancel();
    super.dispose();
  }

  void _startHoldingResonance() {
    setState(() {
      _holdingProgress = 0.0;
      _resonanceSuccess = false;
    });

    _hapticTimer?.cancel();
    // Simulate heart rate pulse through haptics
    final pulseInterval = (60000 / widget.member.heartRateBpm).clamp(500, 1000).toInt();
    _hapticTimer = Timer.periodic(Duration(milliseconds: pulseInterval), (_) {
      HapticFeedback.heavyImpact();
    });

    _holdTimer?.cancel();
    _holdTimer = Timer.periodic(const Duration(milliseconds: 50), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() {
        _holdingProgress += 0.035;
        if (_holdingProgress >= 1.0) {
          _holdingProgress = 1.0;
          _resonanceSuccess = true;
          timer.cancel();
          _hapticTimer?.cancel();
          _triggerSuccess();
        }
      });
    });
  }

  void _stopHoldingResonance() {
    _holdTimer?.cancel();
    _hapticTimer?.cancel();
    if (!_resonanceSuccess && mounted) {
      setState(() {
        _holdingProgress = 0.0;
      });
    }
  }

  void _triggerSuccess() {
    HapticFeedback.vibrate();
    final strings = AppStrings.of(context);
    TopToast.show(
      context,
      message: strings.text(
        'Đã đồng điệu nhịp tim cùng ${widget.member.name}! Một cái ôm ấm áp đã được gửi.',
        'Resonance synced with ${widget.member.name}! A warm hug was sent.',
      ),
      icon: Icons.favorite_rounded,
    );
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    final member = widget.member;

    return Container(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 14,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        boxShadow: [
          BoxShadow(
            color: Colors.black26,
            blurRadius: 20,
            offset: Offset(0, -6),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Center(
            child: Container(
              width: 44,
              height: 5,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
          const SizedBox(height: 18),
          // Member Profile Header
          Row(
            children: [
              Stack(
                alignment: Alignment.center,
                children: [
                  AnimatedBuilder(
                    animation: _pulseController,
                    builder: (context, child) {
                      return Container(
                        width: 58 + (_pulseController.value * 6),
                        height: 58 + (_pulseController.value * 6),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: member.auraColor.withValues(alpha: 0.15 + (_pulseController.value * 0.1)),
                        ),
                      );
                    },
                  ),
                  Container(
                    width: 50,
                    height: 50,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(
                        colors: [
                          member.auraColor.withValues(alpha: 0.8),
                          member.auraColor,
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: member.auraColor.withValues(alpha: 0.3),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      member.name.substring(0, 1).toUpperCase(),
                      style: AppTextStyles.h2.copyWith(color: Colors.white, fontSize: 20),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(member.name, style: AppTextStyles.h3),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppColors.secondary,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            member.relation,
                            style: AppTextStyles.caption.copyWith(
                              fontWeight: FontWeight.w600,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: member.auraColor,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          strings.isVietnamese ? member.statusLabelVi : member.statusLabelEn,
                          style: AppTextStyles.caption.copyWith(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const Text(' • ', style: TextStyle(color: AppColors.textMuted)),
                        Text(
                          member.locationLabel,
                          style: AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          // Vitality Cards: Heart Rate & Battery
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF1F2),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: const Color(0xFFFFE4E6)),
                  ),
                  child: Row(
                    children: [
                      AnimatedBuilder(
                        animation: _pulseController,
                        builder: (context, child) {
                          return Transform.scale(
                            scale: 1.0 + (_pulseController.value * 0.18),
                            child: const Icon(
                              Icons.favorite_rounded,
                              color: Color(0xFFF43F5E),
                              size: 26,
                            ),
                          );
                        },
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.baseline,
                            textBaseline: TextBaseline.alphabetic,
                            children: [
                              Text(
                                '${member.heartRateBpm}',
                                style: AppTextStyles.h2.copyWith(
                                  color: const Color(0xFFBE123C),
                                  fontSize: 22,
                                ),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                'BPM',
                                style: AppTextStyles.caption.copyWith(
                                  color: const Color(0xFFBE123C),
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                          Text(
                            strings.text('Nhịp tim trực tiếp', 'Live Heartbeat'),
                            style: AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0FDF4),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: const Color(0xFFDCFCE7)),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        member.isCharging
                            ? Icons.battery_charging_full_rounded
                            : Icons.battery_6_bar_rounded,
                        color: const Color(0xFF16A34A),
                        size: 26,
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                '${member.batteryLevel}%',
                                style: AppTextStyles.h2.copyWith(
                                  color: const Color(0xFF15803D),
                                  fontSize: 22,
                                ),
                              ),
                              if (member.isCharging) ...[
                                const SizedBox(width: 4),
                                const Icon(Icons.bolt_rounded, size: 14, color: Color(0xFFEAB308)),
                              ],
                            ],
                          ),
                          Text(
                            member.isCharging
                                ? strings.text('Đang cắm sạc', 'Charging now')
                                : strings.text('Pin thiết bị', 'Device Battery'),
                            style: AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          // Hold for Resonance Button
          GestureDetector(
            onTapDown: (_) => _startHoldingResonance(),
            onTapUp: (_) => _stopHoldingResonance(),
            onTapCancel: () => _stopHoldingResonance(),
            child: Container(
              width: double.infinity,
              height: 56,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                gradient: const LinearGradient(
                  colors: [Color(0xFFE11D48), Color(0xFFF43F5E)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFF43F5E).withValues(alpha: 0.35),
                    blurRadius: 14,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Stack(
                alignment: Alignment.centerLeft,
                children: [
                  FractionallySizedBox(
                    widthFactor: _holdingProgress,
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.3),
                        borderRadius: BorderRadius.circular(18),
                      ),
                    ),
                  ),
                  Center(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          _resonanceSuccess ? Icons.favorite_rounded : Icons.fingerprint_rounded,
                          color: Colors.white,
                          size: 22,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          _resonanceSuccess
                              ? strings.text('Đã hòa chung nhịp tim ❤️', 'Heartbeats synchronized ❤️')
                              : strings.text('Chạm giữ để đồng điệu nhịp tim', 'Hold to sync heartbeat'),
                          style: AppTextStyles.bodyStrong.copyWith(
                            color: Colors.white,
                            fontSize: 15,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          // Secondary actions: Gõ cửa hỏi thăm
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () async {
                    HapticFeedback.mediumImpact();
                    await context.read<AppProvider>().sendNudgePing(member.id);
                    if (!context.mounted) return;
                    Navigator.pop(context);
                    TopToast.show(
                      context,
                      message: strings.text(
                        'Đã gõ cửa nhẹ nhàng hỏi thăm ${member.name}.',
                        'Gentle nudge sent to ${member.name}.',
                      ),
                      icon: Icons.notifications_active_rounded,
                    );
                  },
                  icon: const Icon(Icons.touch_app_rounded, size: 18),
                  label: Text(strings.text('Gõ cửa hỏi thăm', 'Gentle Nudge')),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    side: const BorderSide(color: AppColors.border),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.pop(context);
                    Navigator.pushNamed(context, '/messenger');
                  },
                  icon: const Icon(Icons.chat_bubble_outline_rounded, size: 18),
                  label: Text(strings.text('Nhắn tin', 'Message')),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
