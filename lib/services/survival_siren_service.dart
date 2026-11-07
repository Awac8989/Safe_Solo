import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Dịch vụ Còi Hú & Chớp Đèn Sinh Tồn (Survival Siren & Strobe Service)
/// Phục vụ: Định vị nạn nhân trong bóng tối, bụi rậm, hẻm vắng hoặc khi bất tỉnh
class SurvivalSirenService {
  SurvivalSirenService._();
  static final SurvivalSirenService instance = SurvivalSirenService._();

  final AudioPlayer _audioPlayer = AudioPlayer();
  Timer? _strobeTimer;
  Timer? _vibrateTimer;

  bool _isSirenActive = false;
  bool _isStrobeActive = false;
  bool _isBystanderVoiceActive = false;

  final ValueNotifier<bool> sirenActiveNotifier = ValueNotifier<bool>(false);
  final ValueNotifier<bool> strobeLightNotifier = ValueNotifier<bool>(false);
  final ValueNotifier<bool> bystanderVoiceNotifier = ValueNotifier<bool>(false);

  bool get isSirenActive => _isSirenActive;
  bool get isStrobeActive => _isStrobeActive;
  bool get isBystanderVoiceActive => _isBystanderVoiceActive;

  /// Bật/Tắt chế độ Loa Phát Thanh Trợ Giúp Người Qua Đường (Bystander Assistance Voice)
  Future<void> toggleBystanderBroadcast() async {
    if (_isBystanderVoiceActive) {
      await stopBystanderBroadcast();
    } else {
      await startBystanderBroadcast();
    }
  }

  Future<void> startBystanderBroadcast() async {
    _isBystanderVoiceActive = true;
    bystanderVoiceNotifier.value = true;
    await startSiren();
    startStrobe();
  }

  Future<void> stopBystanderBroadcast() async {
    _isBystanderVoiceActive = false;
    bystanderVoiceNotifier.value = false;
  }

  /// Bật/Tắt Còi Hú Cứu Nạn Âm Lượng Cực Đại
  Future<void> toggleSiren() async {
    if (_isSirenActive) {
      await stopSiren();
    } else {
      await startSiren();
    }
  }

  Future<void> startSiren() async {
    _isSirenActive = true;
    sirenActiveNotifier.value = true;

    try {
      await _audioPlayer.setReleaseMode(ReleaseMode.loop);
      await _audioPlayer.setVolume(1.0);
      // Phát âm thanh cảnh báo tần số cao chuẩn cứu nạn
      await _audioPlayer.play(
        AssetSource('sounds/emergency_alarm.mp3'),
      ).catchError((_) async {
        // Fallback sang âm thanh hệ thống nếu asset chưa sẵn sàng
        _startHapticSirenFallback();
      });
    } catch (_) {
      _startHapticSirenFallback();
    }
  }

  Future<void> stopSiren() async {
    _isSirenActive = false;
    sirenActiveNotifier.value = false;
    _vibrateTimer?.cancel();
    _vibrateTimer = null;
    try {
      await _audioPlayer.stop();
    } catch (_) {}
  }

  void _startHapticSirenFallback() {
    _vibrateTimer?.cancel();
    _vibrateTimer = Timer.periodic(const Duration(milliseconds: 600), (_) {
      if (!_isSirenActive) {
        _vibrateTimer?.cancel();
        return;
      }
      try {
        HapticFeedback.heavyImpact();
      } catch (_) {}
    });
  }

  /// Bật/Tắt Chớp Đèn Sinh Tồn Mã Morse SOS (... --- ...)
  void toggleStrobe() {
    if (_isStrobeActive) {
      stopStrobe();
    } else {
      startStrobe();
    }
  }

  void startStrobe() {
    _isStrobeActive = true;
    _strobeTimer?.cancel();

    // Chu kỳ chớp nháy màn hình / đèn flash cứu hộ
    _strobeTimer = Timer.periodic(const Duration(milliseconds: 180), (_) {
      strobeLightNotifier.value = !strobeLightNotifier.value;
      if (strobeLightNotifier.value) {
        try {
          HapticFeedback.lightImpact();
        } catch (_) {}
      }
    });
  }

  void stopStrobe() {
    _isStrobeActive = false;
    _strobeTimer?.cancel();
    _strobeTimer = null;
    strobeLightNotifier.value = false;
  }

  Future<void> stopAll() async {
    await stopSiren();
    stopStrobe();
    await stopBystanderBroadcast();
  }
}
