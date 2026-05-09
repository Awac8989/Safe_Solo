import 'package:flutter/material.dart';

import '../app_theme.dart';

class VoiceWaveform extends StatelessWidget {
  const VoiceWaveform({
    super.key,
    this.bars = 28,
    this.progress = 0,
    this.height = 28,
    this.barWidth = 3,
    this.gap = 3,
    this.color = AppColors.textMuted,
    this.activeColor,
  });

  final int bars;
  final double progress;
  final double height;
  final double barWidth;
  final double gap;
  final Color color;
  final Color? activeColor;

  List<double> _heights(int n) {
    final arr = <double>[];
    var seed = 7;
    for (var i = 0; i < n; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      final r = seed / 233280;
      arr.add(0.25 + (r * 0.75));
    }
    return arr;
  }

  @override
  Widget build(BuildContext context) {
    final hs = _heights(bars);
    final cutoff = (progress.clamp(0, 1) * bars).round();

    return SizedBox(
      height: height,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: List.generate(hs.length, (i) {
          final isActive = i < cutoff;
          return Padding(
            padding: EdgeInsets.only(right: i == hs.length - 1 ? 0 : gap),
            child: Align(
              alignment: Alignment.center,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                width: barWidth,
                height: hs[i] * height,
                decoration: BoxDecoration(
                  color: isActive ? (activeColor ?? color) : color.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}
