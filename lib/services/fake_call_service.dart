import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import '../models/fake_call_config.dart';

enum FakeCallStatus { idle, pendingCountdown, ringing, inCall, finished }

/// Dịch vụ Cuộc gọi Thoát hiểm Ngụy trang (Fake Escape Call Service)
class FakeCallService extends ChangeNotifier {
  FakeCallService._();
  static final FakeCallService instance = FakeCallService._();

  FakeCallConfig _config = const FakeCallConfig();
  Timer? _countdownTimer;
  Timer? _inCallTimer;
  Timer? _vibrateTimer;
  int _countdownRemaining = 0;
  int _callDurationSeconds = 0;
  FakeCallStatus _status = FakeCallStatus.idle;

  final ValueNotifier<FakeCallStatus> statusNotifier = ValueNotifier(FakeCallStatus.idle);

  FakeCallConfig get config => _config;
  FakeCallStatus get status => _status;
  int get countdownRemaining => _countdownRemaining;
  int get callDurationSeconds => _callDurationSeconds;

  void setConfig(FakeCallConfig config) {
    _config = config;
    notifyListeners();
  }

  void _setStatus(FakeCallStatus newStatus) {
    _status = newStatus;
    statusNotifier.value = newStatus;
    notifyListeners();
  }

  /// Bắt đầu đếm ngược hoặc đổ chuông ngay
  void scheduleFakeCall({FakeCallConfig? customConfig, void Function()? onRinging}) {
    if (customConfig != null) {
      _config = customConfig;
    }

    _countdownTimer?.cancel();
    _inCallTimer?.cancel();
    _stopVibration();

    if (_config.delaySeconds <= 0) {
      _triggerRinging(onRinging);
      return;
    }

    _countdownRemaining = _config.delaySeconds;
    _setStatus(FakeCallStatus.pendingCountdown);

    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      _countdownRemaining--;
      if (_countdownRemaining <= 0) {
        timer.cancel();
        _triggerRinging(onRinging);
      } else {
        notifyListeners();
      }
    });
  }

  void _triggerRinging(void Function()? onRinging) {
    _setStatus(FakeCallStatus.ringing);
    _startVibration();
    onRinging?.call();
  }

  void _startVibration() {
    _stopVibration();
    try {
      HapticFeedback.heavyImpact();
    } catch (_) {}

    _vibrateTimer = Timer.periodic(const Duration(milliseconds: 1200), (_) {
      try {
        HapticFeedback.vibrate();
      } catch (_) {}
    });
  }

  void _stopVibration() {
    _vibrateTimer?.cancel();
    _vibrateTimer = null;
  }

  /// Nạn nhân bấm nhận cuộc gọi
  void acceptCall() {
    _stopVibration();
    _callDurationSeconds = 0;
    _setStatus(FakeCallStatus.inCall);

    _inCallTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      _callDurationSeconds++;
      notifyListeners();
    });
  }

  /// Nạn nhân bấm kết thúc hoặc từ chối cuộc gọi
  void endCall() {
    _stopVibration();
    _countdownTimer?.cancel();
    _countdownTimer = null;
    _inCallTimer?.cancel();
    _inCallTimer = null;
    _callDurationSeconds = 0;
    _countdownRemaining = 0;
    _setStatus(FakeCallStatus.finished);

    // Reset về idle sau 500ms
    Future.delayed(const Duration(milliseconds: 500), () {
      if (_status == FakeCallStatus.finished) {
        _setStatus(FakeCallStatus.idle);
      }
    });
  }
}
