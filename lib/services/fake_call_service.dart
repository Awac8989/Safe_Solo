import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/fake_call_config.dart';

enum FakeCallStatus { idle, pendingCountdown, ringing, inCall, finished }

/// Dịch vụ Cuộc gọi Thoát hiểm Ngụy trang (Fake Escape Call Service)
class FakeCallService {
  FakeCallService._();
  static final FakeCallService instance = FakeCallService._();

  FakeCallConfig _config = const FakeCallConfig();
  Timer? _countdownTimer;
  Timer? _inCallTimer;
  int _countdownRemaining = 0;
  int _callDurationSeconds = 0;

  final ValueNotifier<FakeCallStatus> statusNotifier = ValueNotifier(FakeCallStatus.idle);

  FakeCallConfig get config => _config;
  FakeCallStatus get status => statusNotifier.value;
  int get countdownRemaining => _countdownRemaining;
  int get callDurationSeconds => _callDurationSeconds;

  void setConfig(FakeCallConfig config) {
    _config = config;
  }

  /// Bắt đầu đếm ngược hoặc đổ chuông ngay
  void scheduleFakeCall({FakeCallConfig? customConfig, void Function()? onRinging}) {
    if (customConfig != null) {
      _config = customConfig;
    }

    _countdownTimer?.cancel();
    _inCallTimer?.cancel();

    if (_config.delaySeconds <= 0) {
      _triggerRinging(onRinging);
      return;
    }

    _countdownRemaining = _config.delaySeconds;
    statusNotifier.value = FakeCallStatus.pendingCountdown;

    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      _countdownRemaining--;
      if (_countdownRemaining <= 0) {
        timer.cancel();
        _triggerRinging(onRinging);
      }
    });
  }

  void _triggerRinging(void Function()? onRinging) {
    statusNotifier.value = FakeCallStatus.ringing;
    onRinging?.call();
  }

  /// Nạn nhân bấm nhận cuộc gọi
  void acceptCall() {
    _callDurationSeconds = 0;
    statusNotifier.value = FakeCallStatus.inCall;

    _inCallTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      _callDurationSeconds++;
      statusNotifier.notifyListeners();
    });
  }

  /// Nạn nhân bấm kết thúc hoặc từ chối cuộc gọi
  void endCall() {
    _countdownTimer?.cancel();
    _inCallTimer?.cancel();
    _callDurationSeconds = 0;
    _countdownRemaining = 0;
    statusNotifier.value = FakeCallStatus.finished;

    // Reset về idle sau 500ms
    Future.delayed(const Duration(milliseconds: 500), () {
      statusNotifier.value = FakeCallStatus.idle;
    });
  }
}
