import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';

import 'wear_os_service.dart';
import 'watch_sync_manager.dart';

/// Đại diện một thiết bị Smartwatch phát hiện qua sóng Bluetooth LE
class DiscoveredBleWatch {
  final BluetoothDevice device;
  final String name;
  final int rssi;
  final bool hasHeartRateService;

  const DiscoveredBleWatch({
    required this.device,
    required this.name,
    required this.rssi,
    this.hasHeartRateService = false,
  });
}

/// ============================================================================
/// SAFESOLO - BLUETOOTH LOW ENERGY (BLE) REAL SMARTWATCH SERVICE
/// Kết nối trực tiếp với đồng hồ thông minh thật (Samsung Galaxy Watch 5 SM-R900,
/// Apple Watch, Garmin, Xiaomi Mi Band, Amazfit...) qua sóng Bluetooth LE.
/// Hỗ trợ chuẩn GATT Bluetooth SIG:
/// 1. Heart Rate Service (0x180D) - Nhịp tim chuẩn (0x2A37)
/// 2. Pulse Oximeter Service (0x1822) - Nồng độ SpO2 (0x2A5E / 0x2A5F)
/// 3. Running Speed and Cadence (0x1814) - Bước chân & nhịp bước (0x2A53)
/// 4. Battery Service (0x180F) - Mức pin thật (0x2A19)
/// ============================================================================
class BleWatchService extends ChangeNotifier {
  BleWatchService._();
  static final BleWatchService instance = BleWatchService._();

  // UUID chuẩn Bluetooth SIG GATT cho thiết bị đeo y tế & sức khỏe
  static final Guid heartRateServiceUuid = Guid('180d');
  static final Guid heartRateCharUuid = Guid('2a37');
  static final Guid pulseOximeterServiceUuid = Guid('1822');
  static final Guid plxSpotCheckCharUuid = Guid('2a5e');
  static final Guid plxContinuousCharUuid = Guid('2a5f');
  static final Guid rscServiceUuid = Guid('1814');
  static final Guid rscCharUuid = Guid('2a53');
  static final Guid batteryServiceUuid = Guid('180f');
  static final Guid batteryCharUuid = Guid('2a19');

  BluetoothDevice? _connectedDevice;
  StreamSubscription<List<ScanResult>>? _scanSubscription;
  StreamSubscription<BluetoothConnectionState>? _connectionSubscription;
  StreamSubscription<List<int>>? _heartRateSubscription;
  StreamSubscription<List<int>>? _spo2Subscription;
  StreamSubscription<List<int>>? _stepSubscription;
  StreamSubscription<List<int>>? _batterySubscription;

  final List<DiscoveredBleWatch> _discoveredWatches = [];
  bool _isScanning = false;
  bool _isConnecting = false;
  String? _statusMessage;
  int? _latestHeartRate;
  int? _latestBattery;
  int? _latestSpO2;
  int? _latestSteps;

  // Getters
  BluetoothDevice? get connectedDevice => _connectedDevice;
  bool get isConnected => _connectedDevice != null;
  bool get isScanning => _isScanning;
  bool get isConnecting => _isConnecting;
  String? get statusMessage => _statusMessage;
  int? get latestHeartRate => _latestHeartRate;
  int? get latestBattery => _latestBattery;
  int? get latestSpO2 => _latestSpO2;
  int? get latestSteps => _latestSteps;
  List<DiscoveredBleWatch> get discoveredWatches => List.unmodifiable(_discoveredWatches);

  /// Kiểm tra Bluetooth trên điện thoại có đang bật hay không
  Future<bool> isBluetoothSupportedAndOn() async {
    try {
      if (kIsWeb || (!Platform.isAndroid && !Platform.isIOS && !Platform.isWindows && !Platform.isMacOS)) {
        return false;
      }
      final isSupported = await FlutterBluePlus.isSupported;
      if (!isSupported) return false;
      final adapter = await FlutterBluePlus.adapterState.first;
      return adapter == BluetoothAdapterState.on;
    } catch (_) {
      return false;
    }
  }

  /// Bắt đầu quét các đồng hồ thông minh thật phát sóng xung quanh
  Future<void> startScan({Duration timeout = const Duration(seconds: 12)}) async {
    if (_isScanning) return;

    try {
      _discoveredWatches.clear();
      _isScanning = true;
      _statusMessage = 'Đang quét sóng Bluetooth tìm đồng hồ thật SM-R900...';
      notifyListeners();

      // Kiểm tra adapter
      final adapterState = await FlutterBluePlus.adapterState.first;
      if (adapterState != BluetoothAdapterState.on) {
        if (Platform.isAndroid) {
          try {
            await FlutterBluePlus.turnOn();
          } catch (_) {}
        }
      }

      _scanSubscription?.cancel();
      _scanSubscription = FlutterBluePlus.scanResults.listen((results) {
        for (final r in results) {
          final devName = r.device.platformName.trim().isNotEmpty
              ? r.device.platformName.trim()
              : (r.advertisementData.advName.trim().isNotEmpty ? r.advertisementData.advName.trim() : '');

          // Lọc ra các thiết bị có tên hoặc có Heart Rate / SpO2 Service
          final hasHr = r.advertisementData.serviceUuids.contains(heartRateServiceUuid);
          final hasPlx = r.advertisementData.serviceUuids.contains(pulseOximeterServiceUuid);
          if (devName.isEmpty && !hasHr && !hasPlx) continue;

          final upper = devName.toUpperCase();
          final isSmR900 = upper.contains('SM-R900') ||
              upper.contains('WATCH5') ||
              upper.contains('GALAXY WATCH 5') ||
              upper.contains('GALAXY WATCH5');

          final displayName = isSmR900
              ? 'Samsung Galaxy Watch 5 (SM-R900)'
              : (devName.isNotEmpty ? devName : 'BLE Health Watch (${r.device.remoteId.str.substring(0, 5)})');

          final existingIdx = _discoveredWatches.indexWhere((w) => w.device.remoteId == r.device.remoteId);
          final watch = DiscoveredBleWatch(
            device: r.device,
            name: displayName,
            rssi: r.rssi,
            hasHeartRateService: hasHr || isSmR900,
          );

          if (existingIdx >= 0) {
            _discoveredWatches[existingIdx] = watch;
          } else {
            if (isSmR900) {
              _discoveredWatches.insert(0, watch); // Đưa SM-R900 lên hàng đầu
            } else {
              _discoveredWatches.add(watch);
            }
          }
        }
        notifyListeners();
      }, onError: (e) {
        debugPrint('[BleWatchService] Lỗi quét: $e');
      });

      await FlutterBluePlus.startScan(
        timeout: timeout,
        androidUsesFineLocation: true,
      );

      // Khi hết thời gian quét
      await Future.delayed(timeout);
      _isScanning = false;
      _statusMessage = _discoveredWatches.isEmpty
          ? 'Không tìm thấy đồng hồ Bluetooth nào ở gần.'
          : 'Tìm thấy ${_discoveredWatches.length} thiết bị Bluetooth.';
      notifyListeners();
    } catch (e) {
      _isScanning = false;
      _statusMessage = 'Lỗi quét Bluetooth: $e';
      notifyListeners();
      debugPrint('[BleWatchService] startScan error: $e');
    }
  }

  /// Dừng quét
  Future<void> stopScan() async {
    try {
      await FlutterBluePlus.stopScan();
    } catch (_) {}
    _isScanning = false;
    notifyListeners();
  }

  /// Kết nối vào chiếc đồng hồ thật được chọn
  Future<bool> connectToWatch(BluetoothDevice device) async {
    _isConnecting = true;
    _statusMessage = 'Đang kết nối với ${device.platformName}...';
    notifyListeners();

    try {
      await stopScan();

      // Kết nối GATT
      await device.connect(
        license: License.nonprofit,
        timeout: const Duration(seconds: 15),
        autoConnect: false,
      );

      _connectedDevice = device;
      _statusMessage = 'Đã kết nối! Đang khám phá cảm biến BioActive (Nhịp tim, SpO2, Bước chân)...';
      notifyListeners();

      // Lắng nghe trạng thái ngắt kết nối
      _connectionSubscription?.cancel();
      _connectionSubscription = device.connectionState.listen((state) {
        if (state == BluetoothConnectionState.disconnected) {
          _handleDisconnected();
        }
      });

      // Khám phá GATT Services
      final services = await device.discoverServices();
      debugPrint('[BleWatchService] Đã tìm thấy ${services.length} GATT Services');

      bool foundHr = false;
      bool foundBattery = false;
      bool foundSpo2 = false;
      bool foundRsc = false;

      for (final service in services) {
        // 1. Dịch vụ đo nhịp tim (Heart Rate Service 0x180D)
        if (service.uuid == heartRateServiceUuid) {
          for (final char in service.characteristics) {
            if (char.uuid == heartRateCharUuid) {
              await char.setNotifyValue(true);
              _heartRateSubscription?.cancel();
              _heartRateSubscription = char.lastValueStream.listen(_onHeartRateMeasurementReceived);
              foundHr = true;
              debugPrint('[BleWatchService] Đã kích hoạt lắng nghe cảm biến nhịp tim thật (0x2A37)');
            }
          }
        }

        // 2. Dịch vụ oxy trong máu (Pulse Oximeter Service 0x1822)
        if (service.uuid == pulseOximeterServiceUuid) {
          for (final char in service.characteristics) {
            if (char.uuid == plxContinuousCharUuid || char.uuid == plxSpotCheckCharUuid) {
              try {
                await char.setNotifyValue(true);
                _spo2Subscription?.cancel();
                _spo2Subscription = char.lastValueStream.listen(_onPlxMeasurementReceived);
                foundSpo2 = true;
                debugPrint('[BleWatchService] Đã kích hoạt cảm biến SpO2 thật (0x${char.uuid})');
              } catch (_) {}
            }
          }
        }

        // 3. Dịch vụ bước chân & nhịp bước (Running Speed and Cadence 0x1814)
        if (service.uuid == rscServiceUuid) {
          for (final char in service.characteristics) {
            if (char.uuid == rscCharUuid) {
              try {
                await char.setNotifyValue(true);
                _stepSubscription?.cancel();
                _stepSubscription = char.lastValueStream.listen(_onRscMeasurementReceived);
                foundRsc = true;
                debugPrint('[BleWatchService] Đã kích hoạt cảm biến bước chân thật (0x2A53)');
              } catch (_) {}
            }
          }
        }

        // 4. Dịch vụ pin (Battery Service 0x180F)
        if (service.uuid == batteryServiceUuid) {
          for (final char in service.characteristics) {
            if (char.uuid == batteryCharUuid) {
              try {
                final value = await char.read();
                if (value.isNotEmpty) {
                  _latestBattery = value[0];
                  _syncMetricsToSystem();
                }
              } catch (_) {}

              if (char.properties.notify) {
                await char.setNotifyValue(true);
                _batterySubscription?.cancel();
                _batterySubscription = char.lastValueStream.listen((val) {
                  if (val.isNotEmpty) {
                    _latestBattery = val[0];
                    _syncMetricsToSystem();
                  }
                });
              }
              foundBattery = true;
            }
          }
        }
      }

      debugPrint('[BleWatchService] Khám phá cảm biến phần cứng: Nhịp tim=$foundHr, SpO2=$foundSpo2, Bước=$foundRsc, Pin=$foundBattery');

      // Cập nhật trạng thái ghép nối trong WatchSyncManager
      final rawDevName = device.platformName.isNotEmpty ? device.platformName : device.remoteId.str;
      final devNameUpper = rawDevName.toUpperCase();
      final isSmR900 = devNameUpper.contains('SM-R900') ||
          devNameUpper.contains('WATCH5') ||
          devNameUpper.contains('GALAXY WATCH 5');
      final deviceName = isSmR900
          ? 'Samsung Galaxy Watch 5 (SM-R900)'
          : (rawDevName.isNotEmpty ? rawDevName : 'Smartwatch Thật (${device.remoteId.str.substring(0, 5)})');

      WatchSyncManager.instance.setBleConnected(
        deviceId: device.remoteId.str,
        deviceModel: deviceName,
      );

      _isConnecting = false;
      _statusMessage = 'Đã kết nối trực tiếp với $deviceName! Dữ liệu cảm biến đang truyền theo thời gian thực.';
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('[BleWatchService] Lỗi kết nối đồng hồ: $e');
      _isConnecting = false;
      _statusMessage = 'Không thể kết nối với đồng hồ: $e';
      notifyListeners();
      await disconnect();
      return false;
    }
  }

  /// Giải mã gói tin đo nhịp tim chuẩn Bluetooth SIG (GATT 0x2A37)
  void _onHeartRateMeasurementReceived(List<int> data) {
    if (data.isEmpty) return;

    // Byte 0: Flags
    // Bit 0: 0 = UINT8 BPM, 1 = UINT16 BPM
    final flags = data[0];
    final is16Bit = (flags & 0x01) != 0;

    int bpm = 0;
    if (is16Bit && data.length >= 3) {
      bpm = data[1] + (data[2] << 8);
    } else if (data.length >= 2) {
      bpm = data[1];
    }

    if (bpm >= 35 && bpm <= 220) {
      _latestHeartRate = bpm;
      _syncMetricsToSystem();
    }
  }

  /// Giải mã gói tin đo SpO2 chuẩn Bluetooth SIG PLX (GATT 0x2A5E / 0x2A5F)
  void _onPlxMeasurementReceived(List<int> data) {
    if (data.isEmpty) return;
    int spo2 = 0;

    if (data.length >= 3) {
      final b1 = data[1];
      if (b1 >= 70 && b1 <= 100) {
        spo2 = b1;
      } else {
        final mantissa = data[1] + ((data[2] & 0x0F) << 8);
        if (mantissa >= 70 && mantissa <= 100) spo2 = mantissa;
      }
    } else if (data.length >= 2) {
      final b1 = data[1];
      if (b1 >= 70 && b1 <= 100) spo2 = b1;
    }

    if (spo2 >= 70 && spo2 <= 100) {
      _latestSpO2 = spo2;
      _syncMetricsToSystem();
    }
  }

  /// Giải mã gói tin bước chân & nhịp bước chuẩn Bluetooth SIG RSC (GATT 0x2A53)
  void _onRscMeasurementReceived(List<int> data) {
    if (data.length >= 4) {
      final cadence = data[3]; // Nhịp bước (steps/min)
      if (cadence > 0) {
        _latestSteps = (_latestSteps ?? 0) + 1;
        _syncMetricsToSystem();
      }
    }
  }

  /// Đồng bộ dữ liệu cảm biến thật sang các Service cốt lõi của SafeSolo
  void _syncMetricsToSystem() {
    WearOsService.instance.updateMetrics(
      heartRate: _latestHeartRate,
      spO2: _latestSpO2,
      steps: _latestSteps,
      battery: _latestBattery,
      isOffWrist: false,
      broadcast: true,
    );

    notifyListeners();
  }

  void _handleDisconnected() {
    _connectedDevice = null;
    _heartRateSubscription?.cancel();
    _spo2Subscription?.cancel();
    _stepSubscription?.cancel();
    _batterySubscription?.cancel();
    _statusMessage = 'Đã ngắt kết nối với đồng hồ.';
    WatchSyncManager.instance.unpairDevice();
    notifyListeners();
  }

  /// Ngắt kết nối thủ công
  Future<void> disconnect() async {
    try {
      _heartRateSubscription?.cancel();
      _spo2Subscription?.cancel();
      _stepSubscription?.cancel();
      _batterySubscription?.cancel();
      _connectionSubscription?.cancel();
      await _connectedDevice?.disconnect();
    } catch (_) {}
    _handleDisconnected();
  }

  @override
  void dispose() {
    _scanSubscription?.cancel();
    _connectionSubscription?.cancel();
    _heartRateSubscription?.cancel();
    _spo2Subscription?.cancel();
    _stepSubscription?.cancel();
    _batterySubscription?.cancel();
    super.dispose();
  }
}
