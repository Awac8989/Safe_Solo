import 'user_model.dart';

class SafeWifiStation {
  const SafeWifiStation({
    required this.ssid,
    this.bssid,
    this.label = 'Wi-Fi An Toàn',
  });

  final String ssid;
  final String? bssid;
  final String label;

  factory SafeWifiStation.fromJson(Map<String, dynamic> json) => SafeWifiStation(
        ssid: json['ssid'] as String? ?? '',
        bssid: json['bssid'] as String?,
        label: json['label'] as String? ?? 'Wi-Fi An Toàn',
      );

  Map<String, dynamic> toJson() => {
        'ssid': ssid,
        if (bssid != null) 'bssid': bssid,
        'label': label,
      };
}

class CustomRoutineItem {
  const CustomRoutineItem({
    required this.id,
    required this.title,
    this.isMandatory = false,
    this.completed = false,
    this.time,
  });

  final String id;
  final String title;
  final bool isMandatory;
  final bool completed;
  final String? time;

  factory CustomRoutineItem.fromJson(Map<String, dynamic> json) => CustomRoutineItem(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ?? '',
        isMandatory: json['isMandatory'] as bool? ?? false,
        completed: json['completed'] as bool? ?? false,
        time: json['time'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'isMandatory': isMandatory,
        'completed': completed,
        if (time != null) 'time': time,
      };
}

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
    this.enabledPassiveSources = const [
      'SCREEN_UNLOCK',
      'CHARGER_PLUGGED',
      'CHARGER_UNPLUGGED',
      'PEDOMETER_BURST',
      'GEOFENCE_ENTER',
      'SAFE_GEOFENCE',
      'HOME_WIFI',
      'DEVICE_ACTIVITY',
      'WAKE_UP_PULSE',
    ],
    this.pedometerThreshold = 200,
    this.safeWifiList = const [],
    this.multiFactorPassiveEnabled = false,
    this.multiFactorMinSignals = 2,
    this.maxSoftCheckinAllowed = 3,
    this.customRoutines = const [],
    this.telegramReminderOffsetMinutes = 15,
    this.telegramCustomPrompt = '',
    this.familyPingTemplates = const [
      'Con đang lái xe, về đến nơi sẽ gọi lại.',
      'Đang làm việc, mọi thứ vẫn ổn.',
      'Đang tụ tập với bạn bè.',
      'Hơi mệt một chút, đang nằm nghỉ.',
    ],
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

  // 1. Passive Check-in
  final List<String> enabledPassiveSources;
  final int pedometerThreshold;
  final List<SafeWifiStation> safeWifiList;
  final bool multiFactorPassiveEnabled;
  final int multiFactorMinSignals;
  final int maxSoftCheckinAllowed;

  // 3. Custom Routines
  final List<CustomRoutineItem> customRoutines;

  // 6. Telegram Bot Customization
  final int telegramReminderOffsetMinutes;
  final String telegramCustomPrompt;

  // 7. Family Ping Templates
  final List<String> familyPingTemplates;

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
      enabledPassiveSources: (json['enabledPassiveSources'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [
            'SCREEN_UNLOCK',
            'CHARGER_PLUGGED',
            'CHARGER_UNPLUGGED',
            'PEDOMETER_BURST',
            'GEOFENCE_ENTER',
            'SAFE_GEOFENCE',
            'HOME_WIFI',
            'DEVICE_ACTIVITY',
            'WAKE_UP_PULSE',
          ],
      pedometerThreshold: json['pedometerThreshold'] as int? ?? 200,
      safeWifiList: (json['safeWifiList'] as List<dynamic>?)
              ?.map((e) => SafeWifiStation.fromJson(Map<String, dynamic>.from(e as Map)))
              .toList() ??
          const [],
      multiFactorPassiveEnabled: json['multiFactorPassiveEnabled'] as bool? ?? false,
      multiFactorMinSignals: json['multiFactorMinSignals'] as int? ?? 2,
      maxSoftCheckinAllowed: json['maxSoftCheckinAllowed'] as int? ?? 3,
      customRoutines: (json['customRoutines'] as List<dynamic>?)
              ?.map((e) => CustomRoutineItem.fromJson(Map<String, dynamic>.from(e as Map)))
              .toList() ??
          const [],
      telegramReminderOffsetMinutes: json['telegramReminderOffsetMinutes'] as int? ?? 15,
      telegramCustomPrompt: json['telegramCustomPrompt'] as String? ?? '',
      familyPingTemplates: (json['familyPingTemplates'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [
            'Con đang lái xe, về đến nơi sẽ gọi lại.',
            'Đang làm việc, mọi thứ vẫn ổn.',
            'Đang tụ tập với bạn bè.',
            'Hơi mệt một chút, đang nằm nghỉ.',
          ],
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
    'enabledPassiveSources': enabledPassiveSources,
    'pedometerThreshold': pedometerThreshold,
    'safeWifiList': safeWifiList.map((e) => e.toJson()).toList(),
    'multiFactorPassiveEnabled': multiFactorPassiveEnabled,
    'multiFactorMinSignals': multiFactorMinSignals,
    'maxSoftCheckinAllowed': maxSoftCheckinAllowed,
    'customRoutines': customRoutines.map((e) => e.toJson()).toList(),
    'telegramReminderOffsetMinutes': telegramReminderOffsetMinutes,
    'telegramCustomPrompt': telegramCustomPrompt,
    'familyPingTemplates': familyPingTemplates,
  };
}
