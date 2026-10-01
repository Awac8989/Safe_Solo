import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:pedometer/pedometer.dart';
import 'watch_sync_manager.dart';

class PedometerService extends ChangeNotifier {
  PedometerService._();
  static final PedometerService instance = PedometerService._();

  StreamSubscription<StepCount>? _stepCountSubscription;
  StreamSubscription<PedestrianStatus>? _pedestrianStatusSubscription;
  final StreamController<Map<String, dynamic>> _watchAlertController =
      StreamController<Map<String, dynamic>>.broadcast();

  int _steps = 4280;
  int _initialSteps = -1;
  int _lastBurstCheckpoint = 4280;
  String _status = 'stopped';
  bool _isAvailable = false;
  final String _watchModel = 'Samsung Galaxy Watch 5 (WearOS)';
  int _heartRate = 78;
  int _spO2 = 98;
  int _battery = 88;
  bool _isPaired = false;
  bool _isOffWrist = false;

  /// Callback khi phát hiện người dùng đi bộ vượt mốc >200 bước chân tích cực
  void Function(int totalSteps, int burstSteps)? onStepBurstDetected;

  int get steps => _steps;
  int get lastBurstCheckpoint => _lastBurstCheckpoint;
  double get calories => double.parse((_steps * 0.04).toStringAsFixed(1));
  double get distanceKm => double.parse((_steps * 0.00075).toStringAsFixed(2));
  String get status => _status;
  bool get isAvailable => _isAvailable;
  String get watchModel => _watchModel;
  int get heartRate => _heartRate;
  int get spO2 => _spO2;
  int get battery => _battery;
  bool get isPaired => _isPaired;
  set isPaired(bool val) {
    if (_isPaired != val) {
      _isPaired = val;
      notifyListeners();
    }
  }

  void setPaired(bool val) {
    if (_isPaired != val) {
      _isPaired = val;
      notifyListeners();
    }
  }
  bool get isOffWrist => _isOffWrist;
  Stream<Map<String, dynamic>> get watchAlertStream => _watchAlertController.stream;

  void setSpO2(int val) {
    _spO2 = val;
    notifyListeners();
  }

  void setHeartRate(int val) {
    _heartRate = val;
    notifyListeners();
  }

  void setBattery(int val) {
    _battery = val;
    notifyListeners();
  }

  void setOffWrist(bool val) {
    _isOffWrist = val;
    notifyListeners();
  }

  void _checkStepBurst(int currentSteps) {
    final delta = currentSteps - _lastBurstCheckpoint;
    if (delta >= 200) {
      _lastBurstCheckpoint = currentSteps;
      onStepBurstDetected?.call(currentSteps, delta);
    }
  }

  void resetBurstCheckpoint([int? steps]) {
    _lastBurstCheckpoint = steps ?? _steps;
  }

  void updateFromWatchSimulator({
    required int steps,
    required int heartRate,
    required int spO2,
    required int battery,
    required bool isOffWrist,
    String? status,
  }) {
    _steps = steps;
    _heartRate = heartRate;
    _spO2 = spO2;
    _battery = battery;
    _isOffWrist = isOffWrist;
    if (status != null) _status = status;
    _checkStepBurst(_steps);
    notifyListeners();
  }

  void emitWatchEmergencyAlert({
    required String type,
    required String message,
    Map<String, dynamic>? extra,
  }) {
    _watchAlertController.add({
      'type': type,
      'message': message,
      'heartRate': _heartRate,
      'spO2': _spO2,
      'battery': _battery,
      'timestamp': DateTime.now().toIso8601String(),
      if (extra != null) ...extra,
    });
  }

  bool _isInitialized = false;

  void initialize() {
    if (WatchSyncManager.kIsTesting) return;
    if (_isInitialized) return;
    _isInitialized = true;

    runZonedGuarded(() {
      try {
        _stepCountSubscription?.cancel();
        _stepCountSubscription = Pedometer.stepCountStream.listen(
          _onStepCount,
          onError: _onStepCountError,
          cancelOnError: false,
        );
        _pedestrianStatusSubscription?.cancel();
        _pedestrianStatusSubscription = Pedometer.pedestrianStatusStream.listen(
          _onPedestrianStatusChanged,
          onError: _onPedestrianStatusError,
          cancelOnError: false,
        );
        _isAvailable = true;
      } catch (e) {
        debugPrint('Pedometer sensor not available on this platform/device: $e');
        _isAvailable = false;
      }
    }, (error, stack) {
      debugPrint('Caught pedometer stream error gracefully: $error');
      _isAvailable = false;
    });
  }

  void _onStepCount(StepCount event) {
    if (_initialSteps == -1) {
      _initialSteps = event.steps;
    }
    final sessionSteps = event.steps - _initialSteps;
    _steps = 4280 + sessionSteps;
    _checkStepBurst(_steps);
    notifyListeners();
  }

  void _onPedestrianStatusChanged(PedestrianStatus event) {
    _status = event.status;
    notifyListeners();
  }

  void _onStepCountError(dynamic error) {
    debugPrint('Pedometer StepCount error: $error');
    _isAvailable = false;
  }

  void _onPedestrianStatusError(dynamic error) {
    debugPrint('Pedometer Status error: $error');
  }

  void simulateWalking() {
    _steps += 25;
    _status = 'walking';
    _heartRate = 92;
    _checkStepBurst(_steps);
    notifyListeners();
  }

  /// Mô phỏng người dùng đi bộ vượt mốc >200 bước chân tích cực
  void simulateWalkingBurst({int burstSteps = 210}) {
    _steps += burstSteps;
    _status = 'walking';
    _heartRate = 96;
    _checkStepBurst(_steps);
    notifyListeners();
  }

  @override
  void dispose() {
    _stepCountSubscription?.cancel();
    _pedestrianStatusSubscription?.cancel();
    _watchAlertController.close();
    super.dispose();
  }
}
