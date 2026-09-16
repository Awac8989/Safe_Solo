import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

enum CprPhase { idle, compressing, ventilating }

class CprState {
  const CprState({
    required this.phase,
    required this.compressionCount,
    required this.cycleCount,
    required this.totalCompressions,
    required this.bpm,
    required this.beatTick,
  });

  final CprPhase phase;
  final int compressionCount; // 1 -> 30
  final int cycleCount;       // 1, 2, 3...
  final int totalCompressions;
  final int bpm;
  final bool beatTick;

  bool get isCompressing => phase == CprPhase.compressing;
  bool get isVentilating => phase == CprPhase.ventilating;
  bool get isIdle => phase == CprPhase.idle;
}

/// Dịch vụ Máy đếm nhịp Ép tim CPR (AHA 110 BPM Standard)
class CprMetronomeService {
  CprMetronomeService._();
  static final CprMetronomeService instance = CprMetronomeService._();

  static const int kDefaultBpm = 110;
  static const int kCompressionsPerCycle = 30;
  static const int kVentilationsPerCycle = 2;

  Timer? _ticker;
  int _bpm = kDefaultBpm;
  int _compressionCount = 0;
  int _cycleCount = 1;
  int _totalCompressions = 0;
  CprPhase _phase = CprPhase.idle;
  bool _beatTick = false;

  final ValueNotifier<CprState> stateNotifier = ValueNotifier<CprState>(
    const CprState(
      phase: CprPhase.idle,
      compressionCount: 0,
      cycleCount: 1,
      totalCompressions: 0,
      bpm: kDefaultBpm,
      beatTick: false,
    ),
  );

  CprState get state => stateNotifier.value;
  bool get isRunning => _phase != CprPhase.idle;

  void start({int bpm = kDefaultBpm}) {
    stop();
    _bpm = bpm.clamp(90, 130);
    _compressionCount = 0;
    _cycleCount = 1;
    _totalCompressions = 0;
    _phase = CprPhase.compressing;

    _updateState();
    final intervalMs = ((60 / _bpm) * 1000).round();
    _ticker = Timer.periodic(Duration(milliseconds: intervalMs), (_) => _onBeat());
  }

  void stop() {
    _ticker?.cancel();
    _ticker = null;
    _phase = CprPhase.idle;
    _compressionCount = 0;
    _updateState();
  }

  void _onBeat() {
    if (_phase == CprPhase.compressing) {
      _compressionCount++;
      _totalCompressions++;
      _beatTick = !_beatTick;

      // Haptic feedback if available
      try {
        HapticFeedback.lightImpact();
      } catch (_) {}

      if (_compressionCount >= kCompressionsPerCycle) {
        // Chuyển sang pha thổi ngạt 2 hơi
        _phase = CprPhase.ventilating;
        _compressionCount = 0;
        _ticker?.cancel();
        _updateState();

        // 4 giây thổi ngạt (2 hơi, mỗi hơi 1 giây + giãn cách)
        Timer(const Duration(seconds: 4), () {
          if (_phase == CprPhase.ventilating) {
            _cycleCount++;
            _phase = CprPhase.compressing;
            _updateState();
            final intervalMs = ((60 / _bpm) * 1000).round();
            _ticker = Timer.periodic(Duration(milliseconds: intervalMs), (_) => _onBeat());
          }
        });
        return;
      }
    }
    _updateState();
  }

  void _updateState() {
    stateNotifier.value = CprState(
      phase: _phase,
      compressionCount: _compressionCount,
      cycleCount: _cycleCount,
      totalCompressions: _totalCompressions,
      bpm: _bpm,
      beatTick: _beatTick,
    );
  }
}
