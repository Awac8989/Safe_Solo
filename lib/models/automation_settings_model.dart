import 'user_model.dart';

class AutomationSettingsModel {
  const AutomationSettingsModel({
    required this.userId,
    required this.dailyReminderTime,
    required this.shakeSos,
    required this.shakeSensitivity,
    required this.fallDetection,
    required this.geofenceAutoCheckin,
    required this.pillReminder,
    required this.pillTime,
    this.homeLocation,
  });

  final String userId;
  final String dailyReminderTime;
  final bool shakeSos;
  final int shakeSensitivity;
  final bool fallDetection;
  final bool geofenceAutoCheckin;
  final bool pillReminder;
  final String pillTime;
  final AppLocation? homeLocation;

  factory AutomationSettingsModel.fromJson(Map<String, dynamic> json) {
    final rawLocation = json['homeLocation'];
    return AutomationSettingsModel(
      userId: json['userId'] as String? ?? '',
      dailyReminderTime: json['dailyReminderTime'] as String? ?? '08:00',
      shakeSos: json['shakeSos'] as bool? ?? true,
      shakeSensitivity: json['shakeSensitivity'] as int? ?? 3,
      fallDetection: json['fallDetection'] as bool? ?? false,
      geofenceAutoCheckin: json['geofenceAutoCheckin'] as bool? ?? true,
      pillReminder: json['pillReminder'] as bool? ?? false,
      pillTime: json['pillTime'] as String? ?? '08:00',
      homeLocation: rawLocation is Map<String, dynamic>
          ? AppLocation.fromJson(rawLocation)
          : rawLocation is Map
          ? AppLocation.fromJson(Map<String, dynamic>.from(rawLocation))
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'userId': userId,
    'dailyReminderTime': dailyReminderTime,
    'shakeSos': shakeSos,
    'shakeSensitivity': shakeSensitivity,
    'fallDetection': fallDetection,
    'geofenceAutoCheckin': geofenceAutoCheckin,
    'pillReminder': pillReminder,
    'pillTime': pillTime,
    'homeLocation': homeLocation?.toJson(),
  };
}
