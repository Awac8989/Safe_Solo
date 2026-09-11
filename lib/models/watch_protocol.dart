import 'dart:convert';

/// ============================================================================
/// SAFESOLO WATCH PROTOCOL (SSWP v1.0)
/// Chuẩn hóa cấu trúc gói tin đồng bộ hai chiều giữa Samsung Galaxy Watch 5 & Phone
/// ============================================================================

enum WatchSender {
  watch,
  phone,
}

enum WatchPacketType {
  telemetry,
  emergency,
  command,
  ack,
  pairing,
}

class WatchAction {
  // Telemetry
  static const String vitalsUpdate = 'VITALS_UPDATE';
  static const String deadmanCheckin = 'DEADMAN_CHECKIN';

  // Emergency
  static const String fallDetected = 'FALL_DETECTED';
  static const String hardwareSos = 'HARDWARE_SOS';
  static const String criticalSpo2 = 'CRITICAL_SPO2';
  static const String alertCancelled = 'ALERT_CANCELLED';

  // Commands from Phone
  static const String findWatchPing = 'FIND_WATCH_PING';
  static const String instantMeasureReq = 'INSTANT_MEASURE_REQ';
  static const String timerSync = 'TIMER_SYNC';

  // Pairing
  static const String pairRequest = 'PAIR_REQUEST';
  static const String pairConfirmed = 'PAIR_CONFIRMED';
  static const String ping = 'PING';
  static const String pong = 'PONG';
}

class WatchPacket {
  final String protocol;
  final String messageId;
  final DateTime timestamp;
  final WatchSender sender;
  final WatchPacketType type;
  final String action;
  final Map<String, dynamic> payload;

  const WatchPacket({
    this.protocol = 'SAFESOLO_WATCH_V1',
    required this.messageId,
    required this.timestamp,
    required this.sender,
    required this.type,
    required this.action,
    this.payload = const {},
  });

  factory WatchPacket.create({
    required WatchSender sender,
    required WatchPacketType type,
    required String action,
    Map<String, dynamic> payload = const {},
  }) {
    final now = DateTime.now();
    final id = 'msg_${now.millisecondsSinceEpoch}_${(now.microsecond % 1000).toString().padLeft(3, '0')}';
    return WatchPacket(
      messageId: id,
      timestamp: now,
      sender: sender,
      type: type,
      action: action,
      payload: payload,
    );
  }

  factory WatchPacket.fromJson(Map<String, dynamic> json) {
    return WatchPacket(
      protocol: json['protocol'] as String? ?? 'SAFESOLO_WATCH_V1',
      messageId: json['messageId'] as String? ?? '',
      timestamp: json['timestamp'] != null
          ? DateTime.tryParse(json['timestamp'] as String) ?? DateTime.now()
          : DateTime.now(),
      sender: (json['sender'] == 'phone') ? WatchSender.phone : WatchSender.watch,
      type: WatchPacketType.values.firstWhere(
        (t) => t.name == json['type'],
        orElse: () => WatchPacketType.telemetry,
      ),
      action: json['action'] as String? ?? '',
      payload: json['payload'] is Map ? Map<String, dynamic>.from(json['payload'] as Map) : {},
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'protocol': protocol,
      'messageId': messageId,
      'timestamp': timestamp.toIso8601String(),
      'sender': sender.name,
      'type': type.name,
      'action': action,
      'payload': payload,
    };
  }

  String serialize() => jsonEncode(toJson());

  static WatchPacket? deserialize(String raw) {
    try {
      final map = jsonDecode(raw);
      if (map is Map<String, dynamic>) {
        return WatchPacket.fromJson(map);
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  @override
  String toString() => 'WatchPacket($action by ${sender.name} at $timestamp: $payload)';
}
