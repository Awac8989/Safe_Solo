import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';

import 'api_service.dart';
import 'blackbox_service.dart';
import 'offline_resilience_service.dart';

/// ============================================================================
/// SAFESOLO - CƠ CHẾ MẠNG LƯỚI CỨU HỘ DÃ CHIẾN NGOẠI TUYẾN BLE MESH
/// (BLE Mesh Store-and-Forward Emergency Multi-Hop Relay Engine)
///
/// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03
/// Phục vụ: Cứu hộ sinh tồn khi hoàn toàn mất sóng 4G/Internet (Kẹt tầng hầm B2-B4,
/// vùng sạt lở, bão lũ cắt đứt viễn thông). Gói tin tự động nhảy cóc (Hop-by-Hop)
/// qua các thiết bị xung quanh cho đến khi gặp thiết bị có Internet để đẩy lên Web Admin.
/// ============================================================================

enum BleMeshPacketStatus {
  storedLocally,     // Lưu trữ tại thiết bị nạn nhân (Store)
  broadcasting,      // Đang phát sóng BLE Coded Beacon tìm nốt tiếp sức (Forward)
  relayedByPeer,     // Đã được người đi đường / nốt trung gian tiếp nhận và mang theo
  deliveredToCloud,  // Đã được nốt trung gian chuyển tiếp thành công lên Web Admin
}

class BleMeshRescuePacket {
  BleMeshRescuePacket({
    required this.packetId,
    required this.victimId,
    required this.victimName,
    required this.incidentType,
    required this.timestamp,
    required this.lat,
    required this.lng,
    required this.pdrFloor,
    this.heartRate,
    this.spO2,
    this.batteryLevel,
    this.ttl = 5,
    this.hopCount = 0,
    List<String>? relayNodeChain,
    this.status = BleMeshPacketStatus.storedLocally,
    this.deliveredAt,
  }) : relayNodeChain = relayNodeChain ?? [];

  final String packetId;
  final String victimId;
  final String victimName;
  final String incidentType;
  final DateTime timestamp;
  final double lat;
  final double lng;
  final String pdrFloor;
  final int? heartRate;
  final int? spO2;
  final int? batteryLevel;
  int ttl;
  int hopCount;
  final List<String> relayNodeChain;
  BleMeshPacketStatus status;
  DateTime? deliveredAt;

  bool get isDelivered => status == BleMeshPacketStatus.deliveredToCloud;

  String get formattedStatusVi {
    switch (status) {
      case BleMeshPacketStatus.storedLocally:
        return 'Lưu trữ cục bộ (Chờ nốt tiếp sức)';
      case BleMeshPacketStatus.broadcasting:
        return 'Đang phát sóng BLE Mesh SOS (50m)';
      case BleMeshPacketStatus.relayedByPeer:
        return 'Đang chuyển tiếp đa chặng ($hopCount chặng)';
      case BleMeshPacketStatus.deliveredToCloud:
        return 'ĐÃ CHUYỂN TIẾP THÀNH CÔNG LÊN WEB ADMIN';
    }
  }

  Map<String, dynamic> toJson() => {
        'packetId': packetId,
        'victimId': victimId,
        'victimName': victimName,
        'incidentType': incidentType,
        'timestamp': timestamp.toIso8601String(),
        'lat': lat,
        'lng': lng,
        'pdrFloor': pdrFloor,
        'heartRate': heartRate,
        'spO2': spO2,
        'batteryLevel': batteryLevel,
        'ttl': ttl,
        'hopCount': hopCount,
        'relayNodeChain': relayNodeChain,
        'status': status.name,
        'deliveredAt': deliveredAt?.toIso8601String(),
      };

  factory BleMeshRescuePacket.fromJson(Map<String, dynamic> json) =>
      BleMeshRescuePacket(
        packetId: json['packetId'] as String,
        victimId: json['victimId'] as String,
        victimName: json['victimName'] as String,
        incidentType: json['incidentType'] as String,
        timestamp: DateTime.parse(json['timestamp'] as String),
        lat: (json['lat'] as num).toDouble(),
        lng: (json['lng'] as num).toDouble(),
        pdrFloor: json['pdrFloor'] as String? ?? 'Mặt đất',
        heartRate: json['heartRate'] as int?,
        spO2: json['spO2'] as int?,
        batteryLevel: json['batteryLevel'] as int?,
        ttl: json['ttl'] as int? ?? 5,
        hopCount: json['hopCount'] as int? ?? 0,
        relayNodeChain: (json['relayNodeChain'] as List?)?.cast<String>(),
        status: BleMeshPacketStatus.values.firstWhere(
          (e) => e.name == json['status'],
          orElse: () => BleMeshPacketStatus.storedLocally,
        ),
        deliveredAt: json['deliveredAt'] != null
            ? DateTime.parse(json['deliveredAt'] as String)
            : null,
      );
}

class BleMeshPeerNode {
  BleMeshPeerNode({
    required this.nodeId,
    required this.deviceName,
    required this.rssi,
    required this.lastSeen,
    required this.hasInternetUplink,
  });

  final String nodeId;
  final String deviceName;
  final int rssi; // dBm (-40 dBm là rất gần, -90 dBm là rìa phủ sóng)
  final DateTime lastSeen;
  final bool hasInternetUplink;

  double get estimatedDistanceMeters {
    // Công thức Friis Path Loss ước tính khoảng cách từ RSSI (TxPower ≈ -59 dBm)
    if (rssi == 0) return -1.0;
    final ratio = (-59 - rssi) / (10 * 2.0);
    return double.parse(math.pow(10, ratio).toStringAsFixed(1));
  }
}

class BleMeshRelayService extends ChangeNotifier {
  BleMeshRelayService._() {
    _initStorage();
  }

  static final BleMeshRelayService instance = BleMeshRelayService._();

  static const String _storageKey = 'safesolo_ble_mesh_packets_vault';
  static const String meshServiceUuid = '0000FEAA-0000-1000-8000-00805F9B34FB';

  bool _isMeshActive = false;
  bool _isScanning = false;
  bool _isBroadcasting = false;

  final List<BleMeshRescuePacket> _vaultPackets = [];
  final List<BleMeshPeerNode> _discoveredPeers = [];
  StreamSubscription<List<ScanResult>>? _scanSub;

  // Thống kê thực nghiệm luận văn (Scientific Thesis Metrics)
  int _totalOriginated = 0;
  int _totalRelayed = 0;
  int _totalDelivered = 0;

  // Getters
  bool get isMeshActive => _isMeshActive;
  bool get isScanning => _isScanning;
  bool get isBroadcasting => _isBroadcasting;
  List<BleMeshRescuePacket> get vaultPackets => List.unmodifiable(_vaultPackets);
  List<BleMeshPeerNode> get discoveredPeers => List.unmodifiable(_discoveredPeers);

  int get totalOriginated => _totalOriginated;
  int get totalRelayed => _totalRelayed;
  int get totalDelivered => _totalDelivered;

  double get deliveryRatePercent {
    final total = _totalOriginated + _totalRelayed;
    if (total == 0) return 100.0;
    return double.parse(((_totalDelivered / total) * 100).toStringAsFixed(1));
  }

  Future<void> _initStorage() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_storageKey);
      if (raw != null) {
        final list = jsonDecode(raw) as List;
        _vaultPackets.clear();
        _vaultPackets.addAll(
          list.map((e) => BleMeshRescuePacket.fromJson(e as Map<String, dynamic>)),
        );
        notifyListeners();
      }
    } catch (e) {
      debugPrint('[BleMeshRelay] Storage load error: $e');
    }
  }

  Future<void> _persistVault() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final data = _vaultPackets.map((e) => e.toJson()).toList();
      await prefs.setString(_storageKey, jsonEncode(data));
    } catch (_) {}
  }

  // ===========================================================================
  // 1. TẠO GÓI TIN CỨU HỘ GỐC KHI MẤT SÓNG (ORIGINATE RESCUE PACKET)
  // ===========================================================================

  Future<BleMeshRescuePacket> originateRescuePacket({
    required String victimId,
    required String victimName,
    required String incidentType,
    int? heartRate,
    int? spO2,
    int? batteryLevel,
  }) async {
    final resilience = OfflineResilienceService.instance;
    final pdr = resilience.calculatePdrEstimate();

    final packet = BleMeshRescuePacket(
      packetId: 'MESH_${DateTime.now().millisecondsSinceEpoch}_${math.Random().nextInt(9999)}',
      victimId: victimId,
      victimName: victimName,
      incidentType: incidentType,
      timestamp: DateTime.now(),
      lat: pdr.estimatedLat,
      lng: pdr.estimatedLng,
      pdrFloor: pdr.floorLabel,
      heartRate: heartRate,
      spO2: spO2,
      batteryLevel: batteryLevel,
      ttl: 5,
      hopCount: 0,
      relayNodeChain: ['ORIGIN_NODE_${victimId.substring(0, math.min(6, victimId.length))}'],
      status: BleMeshPacketStatus.broadcasting,
    );

    _vaultPackets.insert(0, packet);
    _totalOriginated++;
    _isBroadcasting = true;
    _isMeshActive = true;

    await _persistVault();
    notifyListeners();

    // Khởi chạy quét tìm nốt lân cận để tiếp sức
    await startMeshDiscovery();

    return packet;
  }

  // ===========================================================================
  // 2. KHỞI CHẠY QUÉT DÃ CHIẾN & PHÁT HIỆN THIẾT BỊ LÂN CẬN (DISCOVERY)
  // ===========================================================================

  Future<void> startMeshDiscovery() async {
    if (_isScanning) return;
    _isMeshActive = true;

    if (kIsWeb) {
      _isScanning = true;
      notifyListeners();
      return;
    }

    try {
      final isSupported = await FlutterBluePlus.isSupported;
      if (!isSupported) {
        _isScanning = true;
        notifyListeners();
        return;
      }

      final adapter = await FlutterBluePlus.adapterState.first;
      if (adapter != BluetoothAdapterState.on) {
        _isScanning = true;
        notifyListeners();
        return;
      }

      await _scanSub?.cancel();
      _scanSub = FlutterBluePlus.scanResults.listen((results) {
        for (final r in results) {
          final id = r.device.remoteId.str;
          final name = r.device.platformName.isNotEmpty ? r.device.platformName : 'SafeSolo_Mesh_Node';
          
          final existingIdx = _discoveredPeers.indexWhere((p) => p.nodeId == id);
          final peer = BleMeshPeerNode(
            nodeId: id,
            deviceName: name,
            rssi: r.rssi,
            lastSeen: DateTime.now(),
            hasInternetUplink: true, // Nốt người đi đường thường có 4G khi lên mặt đất
          );

          if (existingIdx >= 0) {
            _discoveredPeers[existingIdx] = peer;
          } else {
            _discoveredPeers.add(peer);
          }
        }
        notifyListeners();
      });

      await FlutterBluePlus.startScan(
        timeout: const Duration(seconds: 15),
        androidUsesFineLocation: true,
      );
      _isScanning = true;
      notifyListeners();
    } catch (e) {
      debugPrint('[BleMeshRelay] Scan start failed: $e. Fallback to mesh simulation.');
      _isScanning = true;
      notifyListeners();
    }
  }

  Future<void> stopMeshEngine() async {
    _isScanning = false;
    _isBroadcasting = false;
    _isMeshActive = false;
    await _scanSub?.cancel();
    _scanSub = null;
    try {
      if (!kIsWeb) {
        await FlutterBluePlus.stopScan();
      }
    } catch (_) {}
    notifyListeners();
  }

  // ===========================================================================
  // 3. TIẾP NHẬN GÓI TIN TỪ NỐT KHÁC & CHUYỂN TIẾP (STORE-AND-FORWARD RELAY)
  // ===========================================================================

  Future<void> receiveIncomingMeshPacket(
    BleMeshRescuePacket incoming, {
    required String relayingPeerName,
    bool autoUploadIfOnline = true,
  }) async {
    // 1. Kiểm tra chống lặp vòng (Loop Flood Prevention)
    final existing = _vaultPackets.where((p) => p.packetId == incoming.packetId).firstOrNull;
    if (existing != null && existing.isDelivered) {
      return; // Gói tin đã gửi xong, bỏ qua
    }

    // 2. Giảm TTL & Tăng Hop Count
    if (incoming.ttl <= 1) {
      debugPrint('[BleMeshRelay] Packet TTL expired (${incoming.packetId}). Drop.');
      return;
    }

    incoming.ttl -= 1;
    incoming.hopCount += 1;
    incoming.relayNodeChain.add(relayingPeerName);
    incoming.status = BleMeshPacketStatus.relayedByPeer;

    if (existing == null) {
      _vaultPackets.insert(0, incoming);
      _totalRelayed++;
    }

    await _persistVault();
    notifyListeners();

    // 3. Nếu thiết bị hiện tại có Internet -> Đẩy lên Web Admin ngay lập tức!
    if (autoUploadIfOnline) {
      await forwardPacketToCloud(incoming);
    }
  }

  Future<bool> forwardPacketToCloud(BleMeshRescuePacket packet) async {
    try {
      final api = ApiService();
      final payload = {
        'packetId': packet.packetId,
        'victimId': packet.victimId,
        'victimName': packet.victimName,
        'incidentType': packet.incidentType,
        'lat': packet.lat,
        'lng': packet.lng,
        'pdrFloor': packet.pdrFloor,
        'vitals': {
          'heartRate': packet.heartRate,
          'spO2': packet.spO2,
          'batteryLevel': packet.batteryLevel,
        },
        'hopCount': packet.hopCount,
        'relayChain': packet.relayNodeChain,
        'transmittedVia': 'BLE_MESH_STORE_AND_FORWARD',
        'forwardedAt': DateTime.now().toIso8601String(),
      };

      // Đẩy qua API Hộp đen / Cứu hộ khẩn cấp
      await api.postRaw('/api/emergency/evidence/upload', {
        'triggerSource': 'BLE_MESH_RELAY',
        'photoBase64': null,
        'audioBase64': null,
        'lat': packet.lat,
        'lng': packet.lng,
        'metadata': payload,
      });

      // Ghi nhận vào Blackbox
      await BlackboxService.instance.captureAndUploadEvidence(
        userId: packet.victimId,
        triggerSource: 'BLE_MESH_RELAY_UPLINK',
      );

      packet.status = BleMeshPacketStatus.deliveredToCloud;
      packet.deliveredAt = DateTime.now();
      _totalDelivered++;

      await _persistVault();
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('[BleMeshRelay] Forwarding error: $e');
      // Nếu chưa có mạng hoặc lỗi, giữ nguyên trạng thái để thử lại khi có sóng
      return false;
    }
  }

  // ===========================================================================
  // 4. CÁC KỊCH BẢN MÔ PHỎNG THỰC ĐỊA HỘI ĐỒNG (THESIS DEFENSE SIMULATION)
  // ===========================================================================

  /// Mô phỏng Nạn nhân kẹt hầm B2 hoàn toàn mất sóng 4G/GPS
  Future<BleMeshRescuePacket> simulateBasementEntrapmentSos() async {
    final resilience = OfflineResilienceService.instance;
    resilience.markGpsLost();
    resilience.recordIndoorMovement(
      newSteps: 85,
      headingDegrees: 180.0,
      currentPressureHpa: 1014.2, // Tương đương tầng hầm B2
    );

    return originateRescuePacket(
      victimId: 'user_quan_2224801030137',
      victimName: 'Đoàn Minh Quân',
      incidentType: 'BASEMENT_ENTRAPMENT_SOS',
      heartRate: 112,
      spO2: 97,
      batteryLevel: 42,
    );
  }

  /// Mô phỏng Người đi đường lướt qua bắt được sóng BLE và mang lên mặt đất có 4G
  Future<void> simulatePeerRelayBridge({required bool peerReaches4g}) async {
    if (_vaultPackets.isEmpty) {
      await simulateBasementEntrapmentSos();
    }

    final packet = _vaultPackets.first;

    // Giả lập phát hiện nốt lân cận
    _discoveredPeers.clear();
    _discoveredPeers.add(
      BleMeshPeerNode(
        nodeId: 'NODE_RELAY_S23_PEER',
        deviceName: 'Galaxy S23 (Người đi đường A)',
        rssi: -68,
        lastSeen: DateTime.now(),
        hasInternetUplink: peerReaches4g,
      ),
    );

    await receiveIncomingMeshPacket(
      packet,
      relayingPeerName: 'Galaxy S23 (Chặng 1 - Tiếp sức tại Cầu thang)',
      autoUploadIfOnline: peerReaches4g,
    );
  }

  void resetMeshDemo() {
    _vaultPackets.clear();
    _discoveredPeers.clear();
    _isScanning = false;
    _isBroadcasting = false;
    _isMeshActive = false;
    _totalOriginated = 0;
    _totalRelayed = 0;
    _totalDelivered = 0;
    _persistVault();
    notifyListeners();
  }
}
