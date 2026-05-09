import 'dart:async';

import 'package:flutter/material.dart';

import '../app_theme.dart';

class PushToTalkButton extends StatefulWidget {
  const PushToTalkButton({
    super.key,
    this.size = PushToTalkSize.medium,
    this.onTap,
    this.onLongPress,
    this.onSend,
    this.cancelThreshold = 80,
  });

  final PushToTalkSize size;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final ValueChanged<int>? onSend;
  final double cancelThreshold;

  @override
  State<PushToTalkButton> createState() => _PushToTalkButtonState();
}

enum PushToTalkSize { medium, large }

class _PushToTalkButtonState extends State<PushToTalkButton> {
  bool _recording = false;
  bool _cancelHover = false;
  double _seconds = 0;
  double _startX = 0;
  DateTime? _startTime;
  Timer? _ticker;

  double get _buttonSize => widget.size == PushToTalkSize.large ? 80 : 56;
  double get _iconSize => widget.size == PushToTalkSize.large ? 32 : 24;

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  void _begin(Offset globalPosition) {
    widget.onLongPress?.call();
    _startX = globalPosition.dx;
    _startTime = DateTime.now();
    _seconds = 0;
    _cancelHover = false;
    _recording = true;

    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(milliseconds: 100), (_) {
      final start = _startTime;
      if (start == null) return;
      setState(() {
        _seconds = DateTime.now().difference(start).inMilliseconds / 1000;
      });
    });

    setState(() {});
  }

  void _move(Offset globalPosition) {
    if (!_recording) return;
    setState(() {
      _cancelHover = (_startX - globalPosition.dx) > widget.cancelThreshold;
    });
  }

  void _end() {
    if (!_recording) return;

    final duration = _seconds;
    _ticker?.cancel();
    _ticker = null;

    if (!_cancelHover && duration >= 0.4) {
      widget.onSend?.call(duration.round().clamp(1, 999));
    }

    setState(() {
      _recording = false;
      _cancelHover = false;
      _seconds = 0;
      _startTime = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Listener(
          onPointerDown: (event) => _begin(event.position),
          onPointerMove: (event) => _move(event.position),
          onPointerUp: (_) => _end(),
          onPointerCancel: (_) => _end(),
          child: GestureDetector(
            onTap: widget.onTap,
            child: AnimatedScale(
              duration: const Duration(milliseconds: 180),
              scale: _recording ? 1.2 : 1,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                width: _buttonSize,
                height: _buttonSize,
                decoration: BoxDecoration(
                  color: _recording ? AppColors.destructive : AppColors.primary,
                  shape: BoxShape.circle,
                  boxShadow: _recording ? AppShadows.danger : AppShadows.safe,
                ),
                child: Icon(
                  Icons.mic_rounded,
                  size: _iconSize,
                  color: AppColors.primaryForeground,
                ),
              ),
            ),
          ),
        ),
        if (_recording)
          Positioned.fill(
            child: IgnorePointer(
              child: Container(
                color: AppColors.background.withValues(alpha: 0.95),
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 120),
                        width: 160,
                        height: 160,
                        decoration: BoxDecoration(
                          color: _cancelHover ? AppColors.mutedFallback : AppColors.destructive,
                          shape: BoxShape.circle,
                          boxShadow: _cancelHover ? AppShadows.card : AppShadows.danger,
                        ),
                        child: Icon(
                          _cancelHover ? Icons.delete_rounded : Icons.mic_rounded,
                          size: 54,
                          color: _cancelHover ? AppColors.destructive : AppColors.primaryForeground,
                        ),
                      ),
                      const SizedBox(height: 24),
                      Text(
                        '${_seconds.toStringAsFixed(1)}s',
                        style: AppTextStyles.h2.copyWith(
                          color: _cancelHover ? AppColors.textMuted : AppColors.destructive,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _cancelHover ? 'Thả tay để HỦY' : '🔴 Đang ghi âm...',
                        style: AppTextStyles.bodyStrong.copyWith(
                          color: AppColors.destructive,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '← Vuốt sang trái để hủy',
                        style: AppTextStyles.body.copyWith(color: AppColors.textMuted),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

extension on AppColors {
  static const Color mutedFallback = Color(0xFF2A3D36);
}
