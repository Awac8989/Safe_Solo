import 'dart:async';

import 'package:flutter/material.dart';

import '../app_theme.dart';
import 'voice_waveform.dart';

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
  OverlayEntry? _overlayEntry;

  double get _buttonSize => widget.size == PushToTalkSize.large ? 80 : 56;
  double get _iconSize => widget.size == PushToTalkSize.large ? 32 : 24;

  @override
  void dispose() {
    _ticker?.cancel();
    _removeOverlay();
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
      if (start == null) {
        return;
      }
      setState(() {
        _seconds = DateTime.now().difference(start).inMilliseconds / 1000;
      });
      _overlayEntry?.markNeedsBuild();
    });

    _showOverlay();
    setState(() {});
  }

  void _move(Offset globalPosition) {
    if (!_recording) {
      return;
    }
    setState(() {
      _cancelHover = (_startX - globalPosition.dx) > widget.cancelThreshold;
    });
    _overlayEntry?.markNeedsBuild();
  }

  void _end() {
    if (!_recording) {
      return;
    }

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
    _removeOverlay();
  }

  void _showOverlay() {
    _removeOverlay();
    final overlay = Overlay.maybeOf(context);
    if (overlay == null) {
      return;
    }

    _overlayEntry = OverlayEntry(
      builder: (context) {
        return IgnorePointer(
          child: Material(
            color: Colors.transparent,
            child: Container(
              color: AppColors.background.withValues(alpha: 0.95),
              alignment: Alignment.center,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 120),
                    width: 160,
                    height: 160,
                    decoration: BoxDecoration(
                      color: _cancelHover
                          ? const Color(0xFFE7EFEB)
                          : AppColors.destructive,
                      shape: BoxShape.circle,
                      boxShadow: _cancelHover ? AppShadows.card : AppShadows.danger,
                    ),
                    child: Icon(
                      _cancelHover ? Icons.delete_rounded : Icons.mic_rounded,
                      size: 54,
                      color: _cancelHover
                          ? AppColors.destructive
                          : AppColors.primaryForeground,
                    ),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: 180,
                    child: VoiceWaveform(
                      bars: 28,
                      progress: (_seconds % 4) / 4,
                      height: 28,
                      color: _cancelHover ? AppColors.textMuted : AppColors.destructive,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    '${_seconds.toStringAsFixed(1)}s',
                    style: AppTextStyles.h2.copyWith(
                      color: _cancelHover
                          ? AppColors.textMuted
                          : AppColors.destructive,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _cancelHover ? 'Thả để hủy' : 'Thả để gửi · Vuốt trái để hủy',
                    style: AppTextStyles.bodyStrong.copyWith(
                      color: AppColors.destructive,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
    overlay.insert(_overlayEntry!);
  }

  void _removeOverlay() {
    _overlayEntry?.remove();
    _overlayEntry = null;
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
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
    );
  }
}
