import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'wear_os_service.dart';
import 'watch_sync_manager.dart';
import 'pedometer_service.dart';

/// Trạng thái hoạt động của cảm biến BioActive
enum BioActiveSensorState {
  uninitialized,
  measuring,
  calibrated,
  offWrist,
  unavailable,
}

/// ============================================================================
/// SAFESOLO - DỊCH VỤ CẢM BIẾN PHẦN CỨNG GALAXY WATCH 5 (SM-R900)
/// Đọc trực tiếp từ Android SensorManager trên đồng hồ thật Wear OS:
/// 1. Nhịp tim quang học BioActive PPG (Type 21) kèm lọc nhiễu EMA chuẩn xác
/// 2. Đếm bước chân phần cứng (Type 19 Step Counter & Type 18 Step Detector)
/// 3. Nồng độ oxy hòa tan trong máu SpO2 (Type 65545 / 38 / Samsung Vendor)
/// 4. Cảm biến nhận diện tháo đồng hồ (Type 34 Off-body Detect)
/// 5. Mức pin phần cứng thật (BatteryManager)
/// ============================================================================
class WatchHardwareSensorService extends ChangeNotifier {
  WatchHardwareSensorService._();
  static final WatchHardwareSensorService instance = WatchHardwareSensorService._();

  static const MethodChannel _methodChannel =
      MethodChannel('com.example.safesolo/watch_native');
  static const EventChannel _eventChannel =
      EventChannel('com.example.safesolo/watch_sensors');

  StreamSubscription<dynamic>? _sensorStreamSub;

  // Trạng thái phần cứng thiết bị
  bool _isHardwareAvailable = false;
  bool _isSamsungWatch5 = false;
  bool _isSmR900 = false;
  String _deviceModel = 'Samsung Galaxy Watch 5 (SM-R900)';
  String _deviceManufacturer = 'Samsung';
  BioActiveSensorState _sensorState = BioActiveSensorState.uninitialized;

  // Dữ liệu sinh tồn thời gian thực (đã qua xử lý chuẩn hóa)
  int? _heartRate;
  int? _rawHeartRate;
  double? _emaHeartRate;
  int _heartRateAccuracy = 3;

  int _steps = 0;
  int? _dailyStepBaseline;
  int? _rawCumulativeSteps;

  int? _spO2;
  final List<int> _spO2Buffer = [];

  int _batteryLevel = 100;
  bool _isOffWrist = false;
  DateTime? _lastReadingTime;

  // Getters
  bool get isHardwareAvailable => _isHardwareAvailable;
  bool get isSamsungWatch5 => _isSamsungWatch5;
  bool get isSmR900 => _isSmR900;
  String get deviceModel => _deviceModel;
  String get deviceManufacturer => _deviceManufacturer;
  BioActiveSensorState get sensorState => _sensorState;

  int? get heartRate => _heartRate;
  int? get rawHeartRate => _rawHeartRate;
  double? get emaHeartRate => _emaHeartRate;
  int get heartRateAccuracy => _heartRateAccuracy;
  int get steps => _steps;
  int? get rawCumulativeSteps => _rawCumulativeSteps;
  int? get spO2 => _spO2;
  int get batteryLevel => _batteryLevel;
  bool get isOffWrist => _isOffWrist;
  DateTime? get lastReadingTime => _lastReadingTime;

  /// Bật và kết nối với các cảm biến phần cứng của đồng hồ SM-R900
  Future<void> initialize() async {
    if (WatchSyncManager.kIsTesting || kIsWeb || !Platform.isAndroid) {
      _sensorState = BioActiveSensorState.unavailable;
      return;
    }

    try {
      // 1. Lấy thông tin phần cứng thiết bị
      final Map<dynamic, dynamic>? info =
          await _methodChannel.invokeMethod<Map<dynamic, dynamic>>('getDeviceInfo');

      if (info != null) {
        final model = (info['model'] as String? ?? '').toUpperCase();
        final manufacturer = (info['manufacturer'] as String? ?? '').toUpperCase();
        final isWatch = info['isWatch'] as bool? ?? false;
        final isSmR900Flag = info['isSmR900'] == true;
        final smR900Match = model.contains('SM-R900') ||
            model.contains('WATCH5') ||
            isSmR900Flag;

        _isSmR900 = smR900Match;
        _isSamsungWatch5 = smR900Match || (manufacturer.contains('SAMSUNG') && isWatch);
        _deviceModel = smR900Match
            ? 'Samsung Galaxy Watch 5 (SM-R900)'
            : (info['model'] as String? ?? 'Wear OS Device');
        _deviceManufacturer = info['manufacturer'] as String? ?? 'Samsung';
        _isHardwareAvailable = true;

        debugPrint('[WatchHardwareSensorService] Khởi tạo thiết bị: $_deviceModel (SM-R900=$smR900Match)');
      }

      // 2. Yêu cầu cấp quyền cảm biến nếu cần
      await _methodChannel.invokeMethod('requestSensorPermissions');

      // 3. Đọc mức pin hiện tại
      final bat = await _methodChannel.invokeMethod<int>('getBatteryLevel');
      if (bat != null && bat > 0) {
        _batteryLevel = bat;
      }

      // 4. Bắt đầu lắng nghe dòng dữ liệu thời gian thực từ EventChannel
      _startSensorStream();
    } catch (e) {
      debugPrint('[WatchHardwareSensorService] Thiết bị không hỗ trợ Native SensorChannel: $e');
      _isHardwareAvailable = false;
      _sensorState = BioActiveSensorState.unavailable;
    }
  }

  void _startSensorStream() {
    _sensorStreamSub?.cancel();
    _sensorState = BioActiveSensorState.measuring;
    notifyListeners();

    try {
      _sensorStreamSub = _eventChannel.receiveBroadcastStream().listen(
        _onSensorEvent,
        onError: (err) {
          debugPrint('[WatchHardwareSensorService] Stream error: $err');
          _sensorState = BioActiveSensorState.unavailable;
          notifyListeners();
        },
      );
    } catch (e) {
      debugPrint('[WatchHardwareSensorService] Không thể kết nối EventChannel: $e');
    }
  }

  void _onSensorEvent(dynamic event) {
    if (event is! Map) return;
    final map = Map<String, dynamic>.from(event);
    final type = map['sensorType'] as String?;
    _lastReadingTime = DateTime.now();

    switch (type) {
      case 'HEART_RATE':
        _processHeartRate(
          rawBpm: map['value'] as int? ?? 0,
          accuracy: map['accuracy'] as int? ?? 3,
        );
        break;

      case 'HEART_RATE_ACCURACY':
        _heartRateAccuracy = map['accuracy'] as int? ?? 3;
        notifyListeners();
        break;

      case 'STEP_COUNTER':
        _processCumulativeSteps(map['value'] as int? ?? 0);
        break;

      case 'STEP_DETECTOR':
        _processStepDetector();
        break;

      case 'SPO2':
        _processSpO2(
          rawSpo2: map['value'] as int? ?? 0,
          accuracy: map['accuracy'] as int? ?? 3,
        );
        break;

      case 'OFFBODY':
        _processOffBody(map['isOffWrist'] as bool? ?? false);
        break;

      case 'BATTERY':
        final bat = map['level'] as int? ?? _batteryLevel;
        if (bat > 0 && bat <= 100) {
          _batteryLevel = bat;
          _syncToSubsystems();
          notifyListeners();
        }
        break;
    }
  }

  /// Thuật toán lọc nhịp tim chuẩn y tế (EMA Filter & Accuracy Validation)
  void _processHeartRate({required int rawBpm, required int accuracy}) {
    if (_isOffWrist) {
      _heartRate = null;
      _rawHeartRate = 0;
      _sensorState = BioActiveSensorState.offWrist;
      notifyListeners();
      return;
    }

    _rawHeartRate = rawBpm;
    _heartRateAccuracy = accuracy;

    // Bỏ qua giá trị 0 hoặc dị thường sinh lý (< 35 bpm hoặc > 220 bpm)
    if (rawBpm < 35 || rawBpm > 220) {
      _sensorState = BioActiveSensorState.measuring;
      notifyListeners();
      return;
    }

    // Nếu độ chính xác bằng 0 (unreliable), cảm biến đang điều chỉnh quang phổ
    if (accuracy == 0) {
      _sensorState = BioActiveSensorState.measuring;
    } else {
      _sensorState = BioActiveSensorState.calibrated;
    }

    // Bộ lọc mượt EMA (Exponential Moving Average) với alpha = 0.35
    if (_emaHeartRate == null) {
      _emaHeartRate = rawBpm.toDouble();
    } else {
      _emaHeartRate = (0.35 * rawBpm) + (0.65 * _emaHeartRate!);
    }
    _heartRate = _emaHeartRate!.round();
    _syncToSubsystems();
    notifyListeners();
  }

  /// Thuật toán đếm bước chân chuẩn (Tự động trừ mốc đầu ngày)
  void _processCumulativeSteps(int rawSteps) {
    _rawCumulativeSteps = rawSteps;
    if (_dailyStepBaseline == null || _dailyStepBaseline! > rawSteps) {
      _dailyStepBaseline = rawSteps;
    }

    final todaySteps = rawSteps - _dailyStepBaseline!;
    if (todaySteps >= 0 && todaySteps < 200000) {
      _steps = todaySteps;
      _syncToSubsystems();
      notifyListeners();
    }
  }

  /// Nhận tín hiệu xung bước chân tức thời (+1 bước)
  void _processStepDetector() {
    _steps++;
    _syncToSubsystems();
    notifyListeners();
  }

  /// Thuật toán lọc SpO2 chuẩn y tế (Median Filter 5 mẫu chống nhiễu quang học)
  void _processSpO2({required int rawSpo2, required int accuracy}) {
    if (_isOffWrist) {
      _spO2 = null;
      _sensorState = BioActiveSensorState.offWrist;
      notifyListeners();
      return;
    }

    // Nồng độ SpO2 sinh lý chỉ nằm trong khoảng 70% - 100%
    if (rawSpo2 < 70 || rawSpo2 > 100) return;

    _spO2Buffer.add(rawSpo2);
    if (_spO2Buffer.length > 5) {
      _spO2Buffer.removeAt(0);
    }

    // Lấy giá trị trung vị (Median) của 5 mẫu gần nhất để loại bỏ nhiễu ánh sáng
    final sorted = List<int>.from(_spO2Buffer)..sort();
    final median = sorted[sorted.length ~/ 2];

    _spO2 = median;
    _sensorState = BioActiveSensorState.calibrated;
    _syncToSubsystems();
    notifyListeners();
  }

  /// Xử lý sự kiện tháo/đeo đồng hồ
  void _processOffBody(bool off) {
    _isOffWrist = off;
    if (off) {
      _sensorState = BioActiveSensorState.offWrist;
      _heartRate = null;
      _spO2 = null;
    } else {
      _sensorState = BioActiveSensorState.measuring;
    }
    _syncToSubsystems();
    notifyListeners();
  }

  /// Đồng bộ các chỉ số sinh tồn chuẩn sang WearOsService, PedometerService & WatchSyncManager
  void _syncToSubsystems() {
    WearOsService.instance.updateMetrics(
      heartRate: _heartRate,
      spO2: _spO2,
      steps: _steps,
      battery: _batteryLevel,
      isOffWrist: _isOffWrist,
      broadcast: true,
    );

    PedometerService.instance.updateFromWatchSimulator(
      steps: _steps,
      heartRate: _heartRate ?? PedometerService.instance.heartRate,
      spO2: _spO2 ?? PedometerService.instance.spO2,
      battery: _batteryLevel,
      isOffWrist: _isOffWrist,
    );
  }

  /// Phương thức đặt giá trị thử nghiệm (Unit testing)
  @visibleForTesting
  void testSetVitals({
    int? heartRate,
    int? steps,
    int? spO2,
    int? battery,
    bool? isOffWrist,
  }) {
    if (isOffWrist != null) _processOffBody(isOffWrist);
    if (heartRate != null) _processHeartRate(rawBpm: heartRate, accuracy: 3);
    if (steps != null) _steps = steps;
    if (spO2 != null) _processSpO2(rawSpo2: spO2, accuracy: 3);
    if (battery != null) _batteryLevel = battery;
    _syncToSubsystems();
    notifyListeners();
  }

  @override
  void dispose() {
    _sensorStreamSub?.cancel();
    super.dispose();
  }
}
