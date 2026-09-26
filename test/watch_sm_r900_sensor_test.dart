import 'package:flutter_test/flutter_test.dart';
import 'package:safesolo/services/watch_hardware_sensor_service.dart';
import 'package:safesolo/services/ble_watch_service.dart';
import 'package:safesolo/services/wear_os_service.dart';
import 'package:safesolo/services/pedometer_service.dart';
import 'package:safesolo/services/watch_sync_manager.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Samsung Galaxy Watch 5 (SM-R900) BioActive Sensor Calibration Tests', () {
    late WatchHardwareSensorService hwService;
    late WearOsService wearOs;
    late PedometerService pedometer;

    setUp(() {
      hwService = WatchHardwareSensorService.instance;
      wearOs = WearOsService.instance;
      pedometer = PedometerService.instance;
    });

    test('Heart Rate EMA Filter processes valid BPM and filters physiological anomalies', () {
      // 1. Kiểm tra giá trị bất thường (< 35 bpm hoặc > 220 bpm) bị loại bỏ
      hwService.testSetVitals(heartRate: 20); // Quá thấp, nhiễu
      expect(hwService.heartRate, isNull);

      hwService.testSetVitals(heartRate: 250); // Quá cao, nhiễu
      expect(hwService.heartRate, isNull);

      // 2. Kiểm tra giá trị chuẩn y tế (75 bpm)
      hwService.testSetVitals(heartRate: 75);
      expect(hwService.heartRate, equals(75));
      expect(hwService.rawHeartRate, equals(75));
      expect(hwService.sensorState, equals(BioActiveSensorState.calibrated));

      // 3. Kiểm tra bộ lọc mượt EMA (Exponential Moving Average)
      // Khi nhịp nhảy lên 85 bpm, EMA làm mượt: 0.35 * 85 + 0.65 * 75 = 29.75 + 48.75 = 78.5 -> round 79
      hwService.testSetVitals(heartRate: 85);
      expect(hwService.heartRate, equals(79));
      expect(hwService.rawHeartRate, equals(85));
    });

    test('SpO2 Median Filter smoothly filters optical noise and clamps within 70-100%', () {
      // 1. SpO2 hợp lệ
      hwService.testSetVitals(spO2: 98);
      expect(hwService.spO2, equals(98));

      // 2. Lọc trung vị 5 mẫu: thêm 97, 99, 98, 96 -> Median của [96, 97, 98, 98, 99] là 98
      hwService.testSetVitals(spO2: 97);
      hwService.testSetVitals(spO2: 99);
      hwService.testSetVitals(spO2: 98);
      hwService.testSetVitals(spO2: 96);
      expect(hwService.spO2, equals(98));
    });

    test('Off-Wrist (Tháo đồng hồ) resets vitals and prevents false panic alarms', () {
      hwService.testSetVitals(heartRate: 80, spO2: 98, isOffWrist: false);
      expect(hwService.isOffWrist, isFalse);
      expect(hwService.heartRate, isNotNull);

      // Khi tháo đồng hồ
      hwService.testSetVitals(isOffWrist: true);
      expect(hwService.isOffWrist, isTrue);
      expect(hwService.heartRate, isNull);
      expect(hwService.spO2, isNull);
      expect(hwService.sensorState, equals(BioActiveSensorState.offWrist));

      // Đeo lại vào tay
      hwService.testSetVitals(isOffWrist: false, heartRate: 74, spO2: 99);
      expect(hwService.isOffWrist, isFalse);
      expect(hwService.heartRate, isNotNull);
    });

    test('Step Counter updates steps and synchronizes to subsystems', () {
      hwService.testSetVitals(steps: 5420);
      expect(hwService.steps, equals(5420));
      expect(wearOs.steps, equals(5420));
      expect(pedometer.steps, equals(5420));
    });

    test('Battery level updates correctly and syncs to WearOsService', () {
      hwService.testSetVitals(battery: 82);
      expect(hwService.batteryLevel, equals(82));
      expect(wearOs.battery, equals(82));
    });

    test('SM-R900 Device naming and WatchSyncManager protocol compliance', () {
      expect(hwService.deviceModel, contains('SM-R900'));
      expect(WatchSyncManager.instance.deviceModel, contains('SM-R900'));
    });
  });

  group('BleWatchService GATT Profiles & SM-R900 Matching Tests', () {
    test('BLE GATT Service UUIDs adhere to Bluetooth SIG specifications', () {
      // 0x180D: Heart Rate
      expect(BleWatchService.heartRateServiceUuid.str128, contains('180d'));
      expect(BleWatchService.heartRateCharUuid.str128, contains('2a37'));

      // 0x1822: Pulse Oximeter (SpO2)
      expect(BleWatchService.pulseOximeterServiceUuid.str128, contains('1822'));
      expect(BleWatchService.plxSpotCheckCharUuid.str128, contains('2a5e'));
      expect(BleWatchService.plxContinuousCharUuid.str128, contains('2a5f'));

      // 0x1814: Running Speed and Cadence (Step & Cadence)
      expect(BleWatchService.rscServiceUuid.str128, contains('1814'));
      expect(BleWatchService.rscCharUuid.str128, contains('2a53'));

      // 0x180F: Battery
      expect(BleWatchService.batteryServiceUuid.str128, contains('180f'));
      expect(BleWatchService.batteryCharUuid.str128, contains('2a19'));
    });
  });
}
