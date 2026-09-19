import 'package:flutter/material.dart';

enum OrbitSafetyStatus {
  home,
  transit,
  sleeping,
  alert,
}

class CircleOrbitMember {
  const CircleOrbitMember({
    required this.id,
    required this.name,
    required this.relation,
    required this.status,
    required this.batteryLevel,
    this.isCharging = false,
    required this.heartRateBpm,
    required this.locationLabel,
    this.transitSpeedKmH,
    this.avatarUrl,
    required this.lastActive,
    this.isCurrentUser = false,
  });

  final String id;
  final String name;
  final String relation;
  final OrbitSafetyStatus status;
  final int batteryLevel;
  final bool isCharging;
  final int heartRateBpm;
  final String locationLabel;
  final double? transitSpeedKmH;
  final String? avatarUrl;
  final DateTime lastActive;
  final bool isCurrentUser;

  Color get auraColor {
    switch (status) {
      case OrbitSafetyStatus.home:
        return const Color(0xFF2FAA68); // Emerald Green
      case OrbitSafetyStatus.transit:
        return const Color(0xFFFF9E1B); // Amber Comet
      case OrbitSafetyStatus.sleeping:
        return const Color(0xFF8B5CF6); // Deep Indigo / Violet
      case OrbitSafetyStatus.alert:
        return const Color(0xFFF05454); // Alert Red
    }
  }

  String get statusLabelVi {
    switch (status) {
      case OrbitSafetyStatus.home:
        return 'Ở nhà an toàn';
      case OrbitSafetyStatus.transit:
        final speed = transitSpeedKmH != null ? ' (${transitSpeedKmH!.toInt()} km/h)' : '';
        return 'Đang di chuyển$speed';
      case OrbitSafetyStatus.sleeping:
        return 'Đang ngủ yên giấc';
      case OrbitSafetyStatus.alert:
        return 'Cần chú ý';
    }
  }

  String get statusLabelEn {
    switch (status) {
      case OrbitSafetyStatus.home:
        return 'Safe at home';
      case OrbitSafetyStatus.transit:
        final speed = transitSpeedKmH != null ? ' (${transitSpeedKmH!.toInt()} km/h)' : '';
        return 'In transit$speed';
      case OrbitSafetyStatus.sleeping:
        return 'Sleeping soundly';
      case OrbitSafetyStatus.alert:
        return 'Attention needed';
    }
  }

  CircleOrbitMember copyWith({
    String? id,
    String? name,
    String? relation,
    OrbitSafetyStatus? status,
    int? batteryLevel,
    bool? isCharging,
    int? heartRateBpm,
    String? locationLabel,
    double? transitSpeedKmH,
    String? avatarUrl,
    DateTime? lastActive,
    bool? isCurrentUser,
  }) {
    return CircleOrbitMember(
      id: id ?? this.id,
      name: name ?? this.name,
      relation: relation ?? this.relation,
      status: status ?? this.status,
      batteryLevel: batteryLevel ?? this.batteryLevel,
      isCharging: isCharging ?? this.isCharging,
      heartRateBpm: heartRateBpm ?? this.heartRateBpm,
      locationLabel: locationLabel ?? this.locationLabel,
      transitSpeedKmH: transitSpeedKmH ?? this.transitSpeedKmH,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      lastActive: lastActive ?? this.lastActive,
      isCurrentUser: isCurrentUser ?? this.isCurrentUser,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'relation': relation,
    'status': status.name,
    'batteryLevel': batteryLevel,
    'isCharging': isCharging,
    'heartRateBpm': heartRateBpm,
    'locationLabel': locationLabel,
    'transitSpeedKmH': transitSpeedKmH,
    'avatarUrl': avatarUrl,
    'lastActive': lastActive.toIso8601String(),
    'isCurrentUser': isCurrentUser,
  };

  factory CircleOrbitMember.fromJson(Map<String, dynamic> json) {
    return CircleOrbitMember(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      relation: json['relation'] as String? ?? '',
      status: OrbitSafetyStatus.values.firstWhere(
        (e) => e.name == json['status'],
        orElse: () => OrbitSafetyStatus.home,
      ),
      batteryLevel: json['batteryLevel'] as int? ?? 100,
      isCharging: json['isCharging'] as bool? ?? false,
      heartRateBpm: json['heartRateBpm'] as int? ?? 72,
      locationLabel: json['locationLabel'] as String? ?? 'Vị trí an toàn',
      transitSpeedKmH: (json['transitSpeedKmH'] as num?)?.toDouble(),
      avatarUrl: json['avatarUrl'] as String?,
      lastActive: json['lastActive'] != null
          ? DateTime.tryParse(json['lastActive'] as String) ?? DateTime.now()
          : DateTime.now(),
      isCurrentUser: json['isCurrentUser'] as bool? ?? false,
    );
  }
}

class AiSafetyCapsuleModel {
  const AiSafetyCapsuleModel({
    required this.id,
    required this.dateLabel,
    required this.summaryMessageVi,
    required this.summaryMessageEn,
    required this.stepCount,
    required this.avgHeartRate,
    required this.safeCommuteMinutes,
    required this.batteryHealthPct,
    required this.arrivedHomeTime,
    this.isSentToCircle = false,
  });

  final String id;
  final String dateLabel;
  final String summaryMessageVi;
  final String summaryMessageEn;
  final int stepCount;
  final int avgHeartRate;
  final int safeCommuteMinutes;
  final int batteryHealthPct;
  final String arrivedHomeTime;
  final bool isSentToCircle;

  AiSafetyCapsuleModel copyWith({
    String? id,
    String? dateLabel,
    String? summaryMessageVi,
    String? summaryMessageEn,
    int? stepCount,
    int? avgHeartRate,
    int? safeCommuteMinutes,
    int? batteryHealthPct,
    String? arrivedHomeTime,
    bool? isSentToCircle,
  }) {
    return AiSafetyCapsuleModel(
      id: id ?? this.id,
      dateLabel: dateLabel ?? this.dateLabel,
      summaryMessageVi: summaryMessageVi ?? this.summaryMessageVi,
      summaryMessageEn: summaryMessageEn ?? this.summaryMessageEn,
      stepCount: stepCount ?? this.stepCount,
      avgHeartRate: avgHeartRate ?? this.avgHeartRate,
      safeCommuteMinutes: safeCommuteMinutes ?? this.safeCommuteMinutes,
      batteryHealthPct: batteryHealthPct ?? this.batteryHealthPct,
      arrivedHomeTime: arrivedHomeTime ?? this.arrivedHomeTime,
      isSentToCircle: isSentToCircle ?? this.isSentToCircle,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'dateLabel': dateLabel,
    'summaryMessageVi': summaryMessageVi,
    'summaryMessageEn': summaryMessageEn,
    'stepCount': stepCount,
    'avgHeartRate': avgHeartRate,
    'safeCommuteMinutes': safeCommuteMinutes,
    'batteryHealthPct': batteryHealthPct,
    'arrivedHomeTime': arrivedHomeTime,
    'isSentToCircle': isSentToCircle,
  };

  factory AiSafetyCapsuleModel.fromJson(Map<String, dynamic> json) {
    return AiSafetyCapsuleModel(
      id: json['id'] as String? ?? '',
      dateLabel: json['dateLabel'] as String? ?? '',
      summaryMessageVi: json['summaryMessageVi'] as String? ?? '',
      summaryMessageEn: json['summaryMessageEn'] as String? ?? '',
      stepCount: json['stepCount'] as int? ?? 0,
      avgHeartRate: json['avgHeartRate'] as int? ?? 72,
      safeCommuteMinutes: json['safeCommuteMinutes'] as int? ?? 0,
      batteryHealthPct: json['batteryHealthPct'] as int? ?? 100,
      arrivedHomeTime: json['arrivedHomeTime'] as String? ?? '',
      isSentToCircle: json['isSentToCircle'] as bool? ?? false,
    );
  }
}
