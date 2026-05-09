class EmergencyContactModel {
  const EmergencyContactModel({
    required this.name,
    required this.phone,
    required this.relation,
  });

  final String name;
  final String phone;
  final String relation;

  factory EmergencyContactModel.fromJson(Map<String, dynamic> json) {
    return EmergencyContactModel(
      name: json['name'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      relation: json['relation'] as String? ?? '',
    );
  }
}

class AppLocation {
  const AppLocation({
    required this.lat,
    required this.lng,
    this.updatedAt,
  });

  final double lat;
  final double lng;
  final DateTime? updatedAt;

  Map<String, dynamic> toJson() => {
    'lat': lat,
    'lng': lng,
    'updatedAt': updatedAt?.toIso8601String(),
  };

  factory AppLocation.fromJson(Map<String, dynamic> json) {
    return AppLocation(
      lat: (json['lat'] as num?)?.toDouble() ?? 0,
      lng: (json['lng'] as num?)?.toDouble() ?? 0,
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'] as String)
          : null,
    );
  }
}

class UserModel {
  const UserModel({
    required this.id,
    required this.fullName,
    required this.phoneNumber,
    required this.timerIntervalMinutes,
    required this.currentStatus,
    required this.quietHoursStart,
    required this.quietHoursEnd,
    required this.falseAlertGraceMinutes,
    required this.emergencyContacts,
    this.nextDeadline,
    this.sleepModeUntil,
    this.lastCheckinTime,
    this.lastKnownLocation,
  });

  final String id;
  final String fullName;
  final String phoneNumber;
  final int timerIntervalMinutes;
  final DateTime? nextDeadline;
  final String currentStatus;
  final String quietHoursStart;
  final String quietHoursEnd;
  final DateTime? sleepModeUntil;
  final int falseAlertGraceMinutes;
  final DateTime? lastCheckinTime;
  final AppLocation? lastKnownLocation;
  final List<EmergencyContactModel> emergencyContacts;

  factory UserModel.fromJson(Map<String, dynamic> json) {
    final rawContacts = json['emergencyContacts'] as List<dynamic>? ?? const [];
    final rawLocation = json['lastKnownLocation'];

    return UserModel(
      id: json['_id'] as String? ?? '',
      fullName: json['fullName'] as String? ?? '',
      phoneNumber: json['phoneNumber'] as String? ?? '',
      timerIntervalMinutes: json['timerIntervalMinutes'] as int? ?? 720,
      nextDeadline: json['nextDeadline'] != null
          ? DateTime.tryParse(json['nextDeadline'] as String)
          : null,
      currentStatus: json['currentStatus'] as String? ?? 'SAFE',
      quietHoursStart: json['quietHoursStart'] as String? ?? '23:00',
      quietHoursEnd: json['quietHoursEnd'] as String? ?? '06:00',
      sleepModeUntil: json['sleepModeUntil'] != null
          ? DateTime.tryParse(json['sleepModeUntil'] as String)
          : null,
      falseAlertGraceMinutes: json['falseAlertGraceMinutes'] as int? ?? 3,
      lastCheckinTime: json['lastCheckinTime'] != null
          ? DateTime.tryParse(json['lastCheckinTime'] as String)
          : null,
      lastKnownLocation: rawLocation is Map<String, dynamic>
          ? AppLocation.fromJson(rawLocation)
          : rawLocation is Map
          ? AppLocation.fromJson(Map<String, dynamic>.from(rawLocation))
          : null,
      emergencyContacts: rawContacts
          .map(
            (item) => EmergencyContactModel.fromJson(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList(),
    );
  }
}
