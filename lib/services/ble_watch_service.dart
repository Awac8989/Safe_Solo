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
/// Kết nối trực tiếp với đồng hồ thông minh thật (Samsung Galaxy Watch,
/// Apple Watch, Garmin, Xiaomi Mi Band, Amazfit...) qua sóng Bluetooth LE
/// Đọc chỉ số nhịp tim PPG (GATT 0x180D) và mức pin thật (GATT 0x180F).
/// ============================================================================
class BleWatchService extends ChangeNotifier {
  BleWatchService._();
  static final BleWatchService instance = BleWatchService._();

  // UUID chuẩn Bluetooth SIG GATT cho thiết bị đeo y tế & sức khỏe
  static final Guid heartRateServiceUuid = Guid('180d');
  static final Guid heartRateCharUuid = Guid('2a37');
  static final Guid batteryServiceUuid = Guid('180f');
  static final Guid batteryCharUuid = Guid('2a19');

  BluetoothDevice? _connectedDevice;
  StreamSubscription<List<ScanResult>>? _scanSubscription;
  StreamSubscription<BluetoothConnectionState>? _connectionSubscription;
  StreamSubscription<List<int>>? _heartRateSubscription;
  StreamSubscription<List<int>>? _batterySubscription;

  final List<DiscoveredBleWatch> _discoveredWatches = [];
  bool _isScanning = false;
  bool _isConnecting = false;
  String? _statusMessage;
  int? _latestHeartRate;
  int? _latestBattery;

  // Getters
  BluetoothDevice? get connectedDevice => _connectedDevice;
  bool get isConnected => _connectedDevice != null;
  bool get isScanning => _isScanning;
  bool get isConnecting => _isConnecting;
  String? get statusMessage => _statusMessage;
  int? get latestHeartRate => _latestHeartRate;
  int? get latestBattery => _latestBattery;
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
      _statusMessage = 'Đang quét sóng Bluetooth tìm đồng hồ thật...';
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

          // Lọc ra các thiết bị có tên hoặc có Heart Rate Service
          final hasHr = r.advertisementData.serviceUuids.contains(heartRateServiceUuid);
          if (devName.isEmpty && !hasHr) continue;

          final displayName = devName.isNotEmpty ? devName : 'BLE Health Watch (${r.device.remoteId.str.substring(0, 5)})';

          final existingIdx = _discoveredWatches.indexWhere((w) => w.device.remoteId == r.device.remoteId);
          final watch = DiscoveredBleWatch(
            device: r.device,
            name: displayName,
            rssi: r.rssi,
            hasHeartRateService: hasHr,
          );

          if (existingIdx >= 0) {
            _discoveredWatches[existingIdx] = watch;
          } else {
            _discoveredWatches.add(watch);
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
      _statusMessage = 'Đã kết nối! Đang khám phá cảm biến đo nhịp tim & pin...';
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

        // 2. Dịch vụ pin (Battery Service 0x180F)
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

      debugPrint('[BleWatchService] Khám phá cảm biến phần cứng: Nhịp tim=$foundHr, Pin=$foundBattery');

      // Cập nhật trạng thái ghép nối trong WatchSyncManager
      final deviceName = device.platformName.isNotEmpty ? device.platformName : 'Smartwatch Thật (${device.remoteId.str.substring(0, 5)})';
      WatchSyncManager.instance.setBleConnected(
        deviceId: device.remoteId.str,
        deviceModel: deviceName,
      );

      _isConnecting = false;
      _statusMessage = 'Đã kết nối trực tiếp với đồng hồ thật! Dữ liệu cảm biến đang truyền theo thời gian thực.';
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

    if (bpm > 0) {
      _latestHeartRate = bpm;
      _syncMetricsToSystem();
    }
  }

  /// Đồng bộ dữ liệu cảm biến thật sang các Service cốt lõi của SafeSolo
  void _syncMetricsToSystem() {
    final bpm = _latestHeartRate;
    final bat = _latestBattery;

    WearOsService.instance.updateMetrics(
      heartRate: bpm,
      battery: bat,
      isOffWrist: false,
      broadcast: true,
    );

    notifyListeners();
  }

  void _handleDisconnected() {
    _connectedDevice = null;
    _heartRateSubscription?.cancel();
    _batterySubscription?.cancel();
    _statusMessage = 'Đã ngắt kết nối với đồng hồ.';
    WatchSyncManager.instance.unpairDevice();
    notifyListeners();
  }

  /// Ngắt kết nối thủ công
  Future<void> disconnect() async {
    try {
      _heartRateSubscription?.cancel();
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
    _batterySubscription?.cancel();
    super.dispose();
  }
}
