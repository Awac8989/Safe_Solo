import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:pedometer/pedometer.dart';

class PedometerService extends ChangeNotifier {
  PedometerService._();
  static final PedometerService instance = PedometerService._();

  StreamSubscription<StepCount>? _stepCountSubscription;
  StreamSubscription<PedestrianStatus>? _pedestrianStatusSubscription;
  final StreamController<Map<String, dynamic>> _watchAlertController =
      StreamController<Map<String, dynamic>>.broadcast();

  int _steps = 4280;
  int _initialSteps = -1;
  String _status = 'stopped';
  bool _isAvailable = false;
  final String _watchModel = 'Samsung Galaxy Watch 5 (WearOS)';
  int _heartRate = 78;
  int _spO2 = 98;
  int _battery = 88;
  bool _isPaired = true;
  bool _isOffWrist = false;

  int get steps => _steps;
  double get calories => double.parse((_steps * 0.04).toStringAsFixed(1));
  double get distanceKm => double.parse((_steps * 0.00075).toStringAsFixed(2));
  String get status => _status;
  bool get isAvailable => _isAvailable;
  String get watchModel => _watchModel;
  int get heartRate => _heartRate;
  int get spO2 => _spO2;
  int get battery => _battery;
  bool get isPaired => _isPaired;
  set isPaired(bool val) { _isPaired = val; notifyListeners(); }
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

  void initialize() {
    try {
      _pedestrianStatusSubscription = Pedometer.pedestrianStatusStream.listen(
        _onPedestrianStatusChanged,
        onError: _onPedestrianStatusError,
      );

      _stepCountSubscription = Pedometer.stepCountStream.listen(
        _onStepCount,
        onError: _onStepCountError,
      );
      _isAvailable = true;
    } catch (e) {
      debugPrint('Pedometer sensor not available on this platform/device: $e');
      _isAvailable = false;
    }
  }

  void _onStepCount(StepCount event) {
    if (_initialSteps == -1) {
      _initialSteps = event.steps;
    }
    final sessionSteps = event.steps - _initialSteps;
    _steps = 4280 + sessionSteps;
    notifyListeners();
  }

  void _onPedestrianStatusChanged(PedestrianStatus event) {
    _status = event.status;
    notifyListeners();
  }

  void _onStepCountError(dynamic error) {
    debugPrint('Pedometer StepCount error: $error');
  }

  void _onPedestrianStatusError(dynamic error) {
    debugPrint('Pedometer Status error: $error');
  }

  void simulateWalking() {
    _steps += 25;
    _status = 'walking';
    _heartRate = 92;
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
