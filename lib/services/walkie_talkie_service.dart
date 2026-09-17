import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

enum WalkieTalkieRole { idle, transmitting, receiving }

class WalkieTalkieState {
  const WalkieTalkieState({
    required this.role,
    required this.channelId,
    required this.channelName,
    this.activeSpeaker,
    this.talkSeconds = 0,
    this.audioWave = const [0.2, 0.4, 0.3, 0.5, 0.2],
  });

  final WalkieTalkieRole role;
  final String channelId;
  final String channelName;
  final String? activeSpeaker;
  final int talkSeconds;
  final List<double> audioWave;

  bool get isTransmitting => role == WalkieTalkieRole.transmitting;
  bool get isReceiving => role == WalkieTalkieRole.receiving;
  bool get isIdle => role == WalkieTalkieRole.idle;

  WalkieTalkieState copyWith({
    WalkieTalkieRole? role,
    String? channelId,
    String? channelName,
    String? activeSpeaker,
    int? talkSeconds,
    List<double>? audioWave,
  }) {
    return WalkieTalkieState(
      role: role ?? this.role,
      channelId: channelId ?? this.channelId,
      channelName: channelName ?? this.channelName,
      activeSpeaker: activeSpeaker,
      talkSeconds: talkSeconds ?? this.talkSeconds,
      audioWave: audioWave ?? this.audioWave,
    );
  }
}

/// Dịch vụ Bộ đàm Cứu hộ Tức thời (Walkie-Talkie Push-To-Talk Service)
class WalkieTalkieService {
  WalkieTalkieService._();
  static final WalkieTalkieService instance = WalkieTalkieService._();

  final ValueNotifier<WalkieTalkieState> stateNotifier = ValueNotifier(
    const WalkieTalkieState(
      role: WalkieTalkieRole.idle,
      channelId: 'channel_emergency_main',
      channelName: 'Kênh Cứu hộ Tác chiến',
    ),
  );

  WalkieTalkieState get state => stateNotifier.value;

  Timer? _talkTimer;
  int _seconds = 0;

  void joinChannel({required String channelId, required String channelName}) {
    stateNotifier.value = state.copyWith(
      channelId: channelId,
      channelName: channelName,
      role: WalkieTalkieRole.idle,
    );
  }

  /// Nhấn giữ để nói (Transmit)
  void startTalking({String? speakerName}) {
    if (state.isTransmitting) return;

    try {
      HapticFeedback.mediumImpact();
    } catch (_) {}

    _seconds = 0;
    _talkTimer?.cancel();
    _talkTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      _seconds++;
      // Giả lập sóng âm động học (Dynamic audio wave)
      final wave = [
        0.2 + (_seconds % 4) * 0.2,
        0.5 + (_seconds % 3) * 0.15,
        0.8 - (_seconds % 4) * 0.15,
        0.4 + (_seconds % 2) * 0.3,
        0.3 + (_seconds % 5) * 0.12,
      ];
      stateNotifier.value = state.copyWith(
        talkSeconds: _seconds,
        audioWave: wave,
      );
    });

    stateNotifier.value = state.copyWith(
      role: WalkieTalkieRole.transmitting,
      activeSpeaker: speakerName ?? 'Bạn',
      talkSeconds: 0,
    );
  }

  /// Buông tay để phát (End Transmit & Play Roger Beep)
  void stopTalking() {
    if (!state.isTransmitting) return;

    _talkTimer?.cancel();
    _talkTimer = null;

    try {
      HapticFeedback.lightImpact();
      SystemSound.play(SystemSoundType.click);
    } catch (_) {}

    stateNotifier.value = state.copyWith(
      role: WalkieTalkieRole.idle,
      activeSpeaker: null,
      talkSeconds: 0,
    );
  }

  /// Nhận tín hiệu giọng nói từ người khác trong kênh
  void simulateIncomingSpeech({required String speakerName, int durationSeconds = 3}) {
    if (state.isTransmitting) return;

    try {
      HapticFeedback.selectionClick();
    } catch (_) {}

    stateNotifier.value = state.copyWith(
      role: WalkieTalkieRole.receiving,
      activeSpeaker: speakerName,
    );

    Timer(Duration(seconds: durationSeconds), () {
      if (state.isReceiving) {
        stateNotifier.value = state.copyWith(
          role: WalkieTalkieRole.idle,
          activeSpeaker: null,
        );
      }
    });
  }
}
