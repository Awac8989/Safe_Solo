import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:pedometer/pedometer.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sensors_plus/sensors_plus.dart';

import '../app_language.dart';
import '../../models/alert_policy_model.dart';
import '../../models/automation_settings_model.dart';
import '../../models/interaction_event_model.dart';
import '../../models/medical_profile_model.dart';
import '../../models/security_settings_model.dart';
import '../../models/user_model.dart';
import '../../services/api_service.dart';
import '../../services/audio_note_service.dart';
import '../../services/location_service.dart';
import '../../services/notification_service.dart';

enum Mood { calm, happy, tired, sick, focused }

enum CircleScope { family, community }

class EmergencyContact {
  const EmergencyContact({
    required this.name,
    required this.phone,
    required this.relation,
  });

  final String name;
  final String phone;
  final String relation;

  Map<String, dynamic> toJson() => {
    'name': name,
    'phone': phone,
    'relation': relation,
  };

  factory EmergencyContact.fromJson(Map<String, dynamic> json) {
    return EmergencyContact(
      name: json['name'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      relation: json['relation'] as String? ?? '',
    );
  }
}

class User {
  const User({
    required this.id,
    required this.name,
    required this.email,
    required this.phoneNumber,
    required this.timerIntervalMinutes,
    required this.currentStatus,
    required this.quietHoursStart,
    required this.quietHoursEnd,
    required this.falseAlertGraceMinutes,
    this.nextDeadline,
    this.sleepModeUntil,
    this.lastCheckinTime,
    this.lastKnownLocation,
    this.emergencyContacts = const [],
  });

  final String id;
  final String name;
  final String email;
  final String phoneNumber;
  final int timerIntervalMinutes;
  final String currentStatus;
  final String quietHoursStart;
  final String quietHoursEnd;
  final int falseAlertGraceMinutes;
  final DateTime? nextDeadline;
  final DateTime? sleepModeUntil;
  final DateTime? lastCheckinTime;
  final AppLocation? lastKnownLocation;
  final List<EmergencyContact> emergencyContacts;

  int get graceHours => (timerIntervalMinutes / 60).round();

  User copyWith({
    String? id,
    String? name,
    String? email,
    String? phoneNumber,
    int? timerIntervalMinutes,
    String? currentStatus,
    String? quietHoursStart,
    String? quietHoursEnd,
    int? falseAlertGraceMinutes,
    DateTime? nextDeadline,
    DateTime? sleepModeUntil,
    DateTime? lastCheckinTime,
    AppLocation? lastKnownLocation,
    List<EmergencyContact>? emergencyContacts,
  }) {
    return User(
      id: id ?? this.id,
      name: name ?? this.name,
      email: email ?? this.email,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      timerIntervalMinutes: timerIntervalMinutes ?? this.timerIntervalMinutes,
      currentStatus: currentStatus ?? this.currentStatus,
      quietHoursStart: quietHoursStart ?? this.quietHoursStart,
      quietHoursEnd: quietHoursEnd ?? this.quietHoursEnd,
      falseAlertGraceMinutes:
          falseAlertGraceMinutes ?? this.falseAlertGraceMinutes,
      nextDeadline: nextDeadline ?? this.nextDeadline,
      sleepModeUntil: sleepModeUntil ?? this.sleepModeUntil,
      lastCheckinTime: lastCheckinTime ?? this.lastCheckinTime,
      lastKnownLocation: lastKnownLocation ?? this.lastKnownLocation,
      emergencyContacts: emergencyContacts ?? this.emergencyContacts,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'email': email,
    'phoneNumber': phoneNumber,
    'timerIntervalMinutes': timerIntervalMinutes,
    'currentStatus': currentStatus,
    'quietHoursStart': quietHoursStart,
    'quietHoursEnd': quietHoursEnd,
    'falseAlertGraceMinutes': falseAlertGraceMinutes,
    'nextDeadline': nextDeadline?.toIso8601String(),
    'sleepModeUntil': sleepModeUntil?.toIso8601String(),
    'lastCheckinTime': lastCheckinTime?.toIso8601String(),
    'lastKnownLocation': lastKnownLocation?.toJson(),
    'emergencyContacts': emergencyContacts.map((item) => item.toJson()).toList(),
  };

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      phoneNumber: json['phoneNumber'] as String? ?? '',
      timerIntervalMinutes: json['timerIntervalMinutes'] as int? ?? 720,
      currentStatus: json['currentStatus'] as String? ?? 'SAFE',
      quietHoursStart: json['quietHoursStart'] as String? ?? '23:00',
      quietHoursEnd: json['quietHoursEnd'] as String? ?? '06:00',
      falseAlertGraceMinutes:
          json['falseAlertGraceMinutes'] as int? ?? 3,
      nextDeadline: _parseDateTime(json['nextDeadline']),
      sleepModeUntil: _parseDateTime(json['sleepModeUntil']),
      lastCheckinTime: _parseDateTime(json['lastCheckinTime']),
      lastKnownLocation: json['lastKnownLocation'] is Map<String, dynamic>
          ? AppLocation.fromJson(json['lastKnownLocation'] as Map<String, dynamic>)
          : null,
      emergencyContacts: (json['emergencyContacts'] as List<dynamic>? ?? [])
          .map(
            (item) => EmergencyContact.fromJson(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList(),
    );
  }

  factory User.fromUserModel(UserModel model, {String email = ''}) {
    return User(
      id: model.id,
      name: model.fullName,
      email: email,
      phoneNumber: model.phoneNumber,
      timerIntervalMinutes: model.timerIntervalMinutes,
      currentStatus: model.currentStatus,
      quietHoursStart: model.quietHoursStart,
      quietHoursEnd: model.quietHoursEnd,
      falseAlertGraceMinutes: model.falseAlertGraceMinutes,
      nextDeadline: model.nextDeadline,
      sleepModeUntil: model.sleepModeUntil,
      lastCheckinTime: model.lastCheckinTime,
      lastKnownLocation: model.lastKnownLocation,
      emergencyContacts: model.emergencyContacts
          .map(
            (item) => EmergencyContact(
              name: item.name,
              phone: item.phone,
              relation: item.relation,
            ),
          )
          .toList(),
    );
  }
}

class MedicalId {
  String fullName;
  String birthYear;
  String citizenId;
  String permanentAddress;
  String bloodType;
  String allergies;
  String conditions;
  String medications;
  String emergencyPhone;
  String insuranceProvider;
  String insuranceNumber;

  MedicalId({
    this.fullName = '',
    this.birthYear = '',
    this.citizenId = '',
    this.permanentAddress = '',
    this.bloodType = 'O+',
    this.allergies = '',
    this.conditions = '',
    this.medications = '',
    this.emergencyPhone = '',
    this.insuranceProvider = '',
    this.insuranceNumber = '',
  });

  Map<String, dynamic> toJson() => {
    'fullName': fullName,
    'birthYear': birthYear,
    'citizenId': citizenId,
    'permanentAddress': permanentAddress,
    'bloodType': bloodType,
    'allergies': allergies,
    'conditions': conditions,
    'medications': medications,
    'emergencyPhone': emergencyPhone,
    'insuranceProvider': insuranceProvider,
    'insuranceNumber': insuranceNumber,
  };

  factory MedicalId.fromJson(Map<String, dynamic> json) => MedicalId(
    fullName: json['fullName'] as String? ?? '',
    birthYear: json['birthYear'] as String? ?? '',
    citizenId: json['citizenId'] as String? ?? '',
    permanentAddress: json['permanentAddress'] as String? ?? '',
    bloodType: json['bloodType'] as String? ?? 'O+',
    allergies: json['allergies'] as String? ?? '',
    conditions: json['conditions'] as String? ?? '',
    medications: json['medications'] as String? ?? '',
    emergencyPhone: json['emergencyPhone'] as String? ?? '',
    insuranceProvider: json['insuranceProvider'] as String? ?? '',
    insuranceNumber: json['insuranceNumber'] as String? ?? '',
  );
}

class Automation {
  String dailyReminderTime;
  bool shakeSos;
  int shakeSensitivity;
  bool fallDetection;
  bool geofenceAutoCheckin;
  bool pillReminder;
  String pillTime;
  bool stepTrackingEnabled;

  Automation({
    this.dailyReminderTime = '08:00',
    this.shakeSos = true,
    this.shakeSensitivity = 3,
    this.fallDetection = false,
    this.geofenceAutoCheckin = true,
    this.pillReminder = false,
    this.pillTime = '08:00',
    this.stepTrackingEnabled = false,
  });

  Map<String, dynamic> toJson() => {
    'dailyReminderTime': dailyReminderTime,
    'shakeSos': shakeSos,
    'shakeSensitivity': shakeSensitivity,
    'fallDetection': fallDetection,
    'geofenceAutoCheckin': geofenceAutoCheckin,
    'pillReminder': pillReminder,
    'pillTime': pillTime,
    'stepTrackingEnabled': stepTrackingEnabled,
  };

  factory Automation.fromJson(Map<String, dynamic> json) => Automation(
    dailyReminderTime: json['dailyReminderTime'] as String? ?? '08:00',
    shakeSos: json['shakeSos'] as bool? ?? true,
    shakeSensitivity: json['shakeSensitivity'] as int? ?? 3,
    fallDetection: json['fallDetection'] as bool? ?? false,
    geofenceAutoCheckin: json['geofenceAutoCheckin'] as bool? ?? true,
    pillReminder: json['pillReminder'] as bool? ?? false,
    pillTime: json['pillTime'] as String? ?? '08:00',
    stepTrackingEnabled: json['stepTrackingEnabled'] as bool? ?? false,
  );
}

class Security {
  String realPin;
  String duressPin;
  bool stealthMode;
  int autoWipeDays;
  bool encryptionEnabled;

  Security({
    this.realPin = '',
    this.duressPin = '',
    this.stealthMode = false,
    this.autoWipeDays = 0,
    this.encryptionEnabled = true,
  });

  Map<String, dynamic> toJson() => {
    'realPin': realPin,
    'duressPin': duressPin,
    'stealthMode': stealthMode,
    'autoWipeDays': autoWipeDays,
    'encryptionEnabled': encryptionEnabled,
  };

  factory Security.fromJson(Map<String, dynamic> json) => Security(
    realPin: json['realPin'] as String? ?? '',
    duressPin: json['duressPin'] as String? ?? '',
    stealthMode: json['stealthMode'] as bool? ?? false,
    autoWipeDays: json['autoWipeDays'] as int? ?? 0,
    encryptionEnabled: json['encryptionEnabled'] as bool? ?? true,
  );
}

class VaultEntry {
  const VaultEntry({
    required this.id,
    required this.title,
    required this.hint,
    required this.content,
    this.updatedAt,
  });

  final String id;
  final String title;
  final String hint;
  final String content;
  final DateTime? updatedAt;

  bool get hasContent => content.trim().isNotEmpty;

  VaultEntry copyWith({
    String? id,
    String? title,
    String? hint,
    String? content,
    DateTime? updatedAt,
  }) {
    return VaultEntry(
      id: id ?? this.id,
      title: title ?? this.title,
      hint: hint ?? this.hint,
      content: content ?? this.content,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'hint': hint,
    'content': content,
    'updatedAt': updatedAt?.toIso8601String(),
  };

  factory VaultEntry.fromJson(Map<String, dynamic> json) {
    return VaultEntry(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      hint: json['hint'] as String? ?? '',
      content: json['content'] as String? ?? '',
      updatedAt: _parseDateTime(json['updatedAt']),
    );
  }
}

class CirclePost {
  const CirclePost({
    required this.id,
    required this.author,
    required this.message,
    required this.moodLabel,
    required this.createdAt,
    required this.scope,
    required this.cheers,
    this.replyItems = const [],
    this.voiceNote = false,
    this.mine = false,
    this.cheeredByMe = false,
  });

  final String id;
  final String author;
  final String message;
  final String moodLabel;
  final DateTime createdAt;
  final CircleScope scope;
  final int cheers;
  final List<CircleReply> replyItems;
  final bool voiceNote;
  final bool mine;
  final bool cheeredByMe;

  int get replies => replyItems.length;

  CirclePost copyWith({
    String? id,
    String? author,
    String? message,
    String? moodLabel,
    DateTime? createdAt,
    CircleScope? scope,
    int? cheers,
    List<CircleReply>? replyItems,
    bool? voiceNote,
    bool? mine,
    bool? cheeredByMe,
  }) {
    return CirclePost(
      id: id ?? this.id,
      author: author ?? this.author,
      message: message ?? this.message,
      moodLabel: moodLabel ?? this.moodLabel,
      createdAt: createdAt ?? this.createdAt,
      scope: scope ?? this.scope,
      cheers: cheers ?? this.cheers,
      replyItems: replyItems ?? this.replyItems,
      voiceNote: voiceNote ?? this.voiceNote,
      mine: mine ?? this.mine,
      cheeredByMe: cheeredByMe ?? this.cheeredByMe,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'author': author,
    'message': message,
    'moodLabel': moodLabel,
    'createdAt': createdAt.toIso8601String(),
    'scope': scope.name,
    'cheers': cheers,
    'replyItems': replyItems.map((item) => item.toJson()).toList(),
    'voiceNote': voiceNote,
    'mine': mine,
    'cheeredByMe': cheeredByMe,
  };

  factory CirclePost.fromJson(Map<String, dynamic> json) {
    return CirclePost(
      id: json['id'] as String? ?? '',
      author: json['author'] as String? ?? '',
      message: json['message'] as String? ?? '',
      moodLabel: json['moodLabel'] as String? ?? '',
      createdAt: _parseDateTime(json['createdAt']) ?? DateTime.now(),
      scope: (json['scope'] as String? ?? 'family') == 'community'
          ? CircleScope.community
          : CircleScope.family,
      cheers: json['cheers'] as int? ?? 0,
      replyItems: (json['replyItems'] as List<dynamic>? ?? const [])
          .map((item) => CircleReply.fromJson(Map<String, dynamic>.from(item as Map)))
          .toList(),
      voiceNote: json['voiceNote'] as bool? ?? false,
      mine: json['mine'] as bool? ?? false,
      cheeredByMe: json['cheeredByMe'] as bool? ?? false,
    );
  }
}

class CircleReply {
  const CircleReply({
    required this.id,
    required this.author,
    required this.message,
    required this.createdAt,
    this.mine = false,
  });

  final String id;
  final String author;
  final String message;
  final DateTime createdAt;
  final bool mine;

  Map<String, dynamic> toJson() => {
    'id': id,
    'author': author,
    'message': message,
    'createdAt': createdAt.toIso8601String(),
    'mine': mine,
  };

  factory CircleReply.fromJson(Map<String, dynamic> json) {
    return CircleReply(
      id: json['id'] as String? ?? '',
      author: json['author'] as String? ?? '',
      message: json['message'] as String? ?? '',
      createdAt: _parseDateTime(json['createdAt']) ?? DateTime.now(),
      mine: json['mine'] as bool? ?? false,
    );
  }
}

class ChatThread {
  const ChatThread({
    required this.id,
    required this.groupLabel,
    required this.name,
    required this.preview,
    required this.updatedAt,
    this.messages = const [],
    this.unread = 0,
    this.battery,
    this.contactPhone,
    this.highlight = false,
  });

  final String id;
  final String groupLabel;
  final String name;
  final String preview;
  final DateTime updatedAt;
  final List<ChatMessage> messages;
  final int unread;
  final String? battery;
  final String? contactPhone;
  final bool highlight;

  ChatThread copyWith({
    String? id,
    String? groupLabel,
    String? name,
    String? preview,
    DateTime? updatedAt,
    List<ChatMessage>? messages,
    int? unread,
    String? battery,
    String? contactPhone,
    bool? highlight,
  }) {
    return ChatThread(
      id: id ?? this.id,
      groupLabel: groupLabel ?? this.groupLabel,
      name: name ?? this.name,
      preview: preview ?? this.preview,
      updatedAt: updatedAt ?? this.updatedAt,
      messages: messages ?? this.messages,
      unread: unread ?? this.unread,
      battery: battery ?? this.battery,
      contactPhone: contactPhone ?? this.contactPhone,
      highlight: highlight ?? this.highlight,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'groupLabel': groupLabel,
    'name': name,
    'preview': preview,
    'updatedAt': updatedAt.toIso8601String(),
    'messages': messages.map((item) => item.toJson()).toList(),
    'unread': unread,
    'battery': battery,
    'contactPhone': contactPhone,
    'highlight': highlight,
  };

  factory ChatThread.fromJson(Map<String, dynamic> json) {
    return ChatThread(
      id: json['id'] as String? ?? '',
      groupLabel: json['groupLabel'] as String? ?? '',
      name: json['name'] as String? ?? '',
      preview: json['preview'] as String? ?? '',
      updatedAt: _parseDateTime(json['updatedAt']) ?? DateTime.now(),
      messages: (json['messages'] as List<dynamic>? ?? const [])
          .map((item) => ChatMessage.fromJson(Map<String, dynamic>.from(item as Map)))
          .toList(),
      unread: json['unread'] as int? ?? 0,
      battery: json['battery'] as String?,
      contactPhone: json['contactPhone'] as String?,
      highlight: json['highlight'] as bool? ?? false,
    );
  }
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.sender,
    required this.content,
    required this.createdAt,
    this.mine = false,
    this.isSystem = false,
    this.voiceSeconds,
    this.voicePath,
  });

  final String id;
  final String sender;
  final String content;
  final DateTime createdAt;
  final bool mine;
  final bool isSystem;
  final int? voiceSeconds;
  final String? voicePath;

  bool get isVoiceNote =>
      (voicePath != null && voicePath!.isNotEmpty) ||
      (voiceSeconds != null && voiceSeconds! > 0);

  Map<String, dynamic> toJson() => {
    'id': id,
    'sender': sender,
    'content': content,
    'createdAt': createdAt.toIso8601String(),
    'mine': mine,
    'isSystem': isSystem,
    'voiceSeconds': voiceSeconds,
    'voicePath': voicePath,
  };

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id'] as String? ?? '',
      sender: json['sender'] as String? ?? '',
      content: json['content'] as String? ?? '',
      createdAt: _parseDateTime(json['createdAt']) ?? DateTime.now(),
      mine: json['mine'] as bool? ?? false,
      isSystem: json['isSystem'] as bool? ?? false,
      voiceSeconds: json['voiceSeconds'] as int?,
      voicePath: json['voicePath'] as String?,
    );
  }
}

class HeroProfile {
  const HeroProfile({
    required this.name,
    required this.location,
    required this.rating,
    required this.rescues,
    required this.verified,
    required this.distanceKm,
  });

  final String name;
  final String location;
  final double rating;
  final int rescues;
  final bool verified;
  final double distanceKm;
}

class RadarIncident {
  const RadarIncident({
    required this.id,
    required this.title,
    required this.locationLabel,
    required this.distanceKm,
    required this.severity,
    required this.reportedAt,
    required this.status,
  });

  final String id;
  final String title;
  final String locationLabel;
  final double distanceKm;
  final int severity;
  final DateTime reportedAt;
  final String status;
}

class AppProvider with ChangeNotifier {
  AppProvider() {
    _bootstrap();
  }

  static const _storageKey = 'safesolo_state_v3';

  final ApiService _api = ApiService();
  final LocationService _locationService = LocationService();
  final NotificationService _notifications = NotificationService.instance;

  User? _user;
  bool _onboarded = false;
  bool _permissionsGranted = false;
  bool _isInitializing = true;
  bool _isBusy = false;
  String? _lastError;
  int _streak = 0;
  Mood? _mood = Mood.calm;
  bool _highContrast = false;
  AppLanguage _language = AppLanguage.vi;
  MedicalId _medical = MedicalId();
  Automation _automation = Automation();
  Security _security = Security();
  List<VaultEntry> _vaultEntries = _defaultVaultEntries();
  DateTime? _vaultReleaseAt;
  DateTime? _vaultAutoWipeAt;
  List<String> _badges = [];
  List<CirclePost> _circlePosts = const [];
  List<ChatThread> _chatThreads = const [];
  List<HeroProfile> _heroes = const [];
  List<RadarIncident> _radarIncidents = const [];
  AlertPolicyModel? _alertPolicy;
  List<InteractionEventModel> _interactionEvents = const [];
  Timer? _automationTimer;
  StreamSubscription<Position>? _positionSubscription;
  StreamSubscription<UserAccelerometerEvent>? _accelerometerSubscription;
  StreamSubscription<StepCount>? _stepCountSubscription;
  AppLocation? _homeAnchor;
  DateTime? _lastDailyReminderAt;
  DateTime? _lastMedicationReminderAt;
  DateTime? _lastOverdueNotificationAt;
  DateTime? _lastGeofenceCheckInAt;
  DateTime? _lastFallSignalAt;
  DateTime? _lastShakeSignalAt;
  DateTime? _fallCandidateAt;
  DateTime? _lowMotionSince;
  DateTime? _lastShakePeakAt;
  bool _wasOutsideHome = false;
  final List<DateTime> _shakePeaks = [];
  int _stepsToday = 0;
  double _caloriesBurnedToday = 0;
  int? _stepBaseline;
  String? _stepBaselineDayKey;
  int? _lastRawStepCount;

  User? get user => _user;
  bool get onboarded => _onboarded;
  bool get permissionsGranted => _permissionsGranted;
  bool get isInitializing => _isInitializing;
  bool get isBusy => _isBusy;
  String? get lastError => _lastError;
  int get streak => _streak;
  Mood? get mood => _mood;
  bool get highContrast => _highContrast;
  AppLanguage get language => _language;
  MedicalId get medical => _medical;
  Automation get automation => _automation;
  int get stepsToday => _stepsToday;
  double get caloriesBurnedToday => _caloriesBurnedToday;
  Security get security => _security;
  List<VaultEntry> get vaultEntries => List.unmodifiable(_vaultEntries);
  DateTime? get vaultReleaseAt => _vaultReleaseAt;
  DateTime? get vaultAutoWipeAt => _vaultAutoWipeAt;
  bool get isVaultReleased => _vaultReleaseAt != null;
  bool get isVaultAutoWiped => _vaultAutoWipeAt != null;
  List<String> get badges => List.unmodifiable(_badges);
  List<CirclePost> get circlePosts => List.unmodifiable(_circlePosts);
  List<ChatThread> get chatThreads => List.unmodifiable(_chatThreads);
  List<HeroProfile> get heroes => List.unmodifiable(_heroes);
  List<RadarIncident> get radarIncidents => List.unmodifiable(_radarIncidents);
  AlertPolicyModel? get alertPolicy => _alertPolicy;
  List<InteractionEventModel> get interactionEvents =>
      List.unmodifiable(_interactionEvents);
  int get lastCheckIn => (_user?.lastCheckinTime ?? DateTime.now()).millisecondsSinceEpoch;
  int get graceHours => _user?.graceHours ?? 12;
  int? get vacationUntil => _user?.sleepModeUntil?.millisecondsSinceEpoch;
  bool get isVacation =>
      _user?.sleepModeUntil != null &&
      _user!.sleepModeUntil!.isAfter(DateTime.now());
  DateTime? get silentWindowStartedAt {
    final lastCheckin = _user?.lastCheckinTime;
    if (lastCheckin == null) {
      return null;
    }
    return lastCheckin.add(Duration(hours: graceHours));
  }

  DateTime? get vaultUnlockAt {
    final silentWindow = silentWindowStartedAt;
    if (silentWindow == null) {
      return null;
    }
    return silentWindow.add(const Duration(hours: 72));
  }

  List<CirclePost> postsFor(CircleScope scope) =>
      _circlePosts.where((post) => post.scope == scope).toList();

  ChatThread? threadById(String threadId) {
    return _chatThreads.where((thread) => thread.id == threadId).firstOrNull;
  }

  Future<void> _bootstrap() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_storageKey);
    if (raw != null && raw.isNotEmpty) {
      try {
        final data = Map<String, dynamic>.from(jsonDecode(raw) as Map);
        _user = data['user'] != null
            ? User.fromJson(Map<String, dynamic>.from(data['user'] as Map))
            : null;
        _onboarded = data['onboarded'] as bool? ?? false;
        _permissionsGranted = data['permissionsGranted'] as bool? ?? false;
        _streak = data['streak'] as int? ?? 0;
        _mood = _decodeMood(data['mood'] as String?);
        _highContrast = data['highContrast'] as bool? ?? false;
        _language = _decodeLanguage(data['language'] as String?);
        _medical = MedicalId.fromJson(
          Map<String, dynamic>.from(data['medical'] as Map? ?? const {}),
        );
        _automation = Automation.fromJson(
          Map<String, dynamic>.from(data['automation'] as Map? ?? const {}),
        );
        _security = Security.fromJson(
          Map<String, dynamic>.from(data['security'] as Map? ?? const {}),
        );
        _vaultEntries = (data['vaultEntries'] as List<dynamic>? ?? const [])
            .map((item) => VaultEntry.fromJson(Map<String, dynamic>.from(item as Map)))
            .toList();
        if (_vaultEntries.isEmpty) {
          _vaultEntries = _defaultVaultEntries();
        }
        _vaultReleaseAt = _parseDateTime(data['vaultReleaseAt']);
        _vaultAutoWipeAt = _parseDateTime(data['vaultAutoWipeAt']);
        _badges = List<String>.from(data['badges'] as List<dynamic>? ?? const []);
        _circlePosts = (data['circlePosts'] as List<dynamic>? ?? const [])
            .map((item) => CirclePost.fromJson(Map<String, dynamic>.from(item as Map)))
            .toList();
        _chatThreads = (data['chatThreads'] as List<dynamic>? ?? const [])
            .map((item) => ChatThread.fromJson(Map<String, dynamic>.from(item as Map)))
            .toList();
        _homeAnchor = data['homeAnchor'] is Map<String, dynamic>
            ? AppLocation.fromJson(
                Map<String, dynamic>.from(data['homeAnchor'] as Map),
              )
            : null;
        _stepsToday = data['stepsToday'] as int? ?? 0;
        _caloriesBurnedToday =
            (data['caloriesBurnedToday'] as num?)?.toDouble() ?? 0;
        _stepBaseline = data['stepBaseline'] as int?;
        _stepBaselineDayKey = data['stepBaselineDayKey'] as String?;
        _lastRawStepCount = data['lastRawStepCount'] as int?;
      } catch (error) {
        debugPrint('Failed to restore SafeSolo state: $error');
      }
    }

    _resetStepCountersIfNeeded();

    _seedDemoCollections();

    if (_user != null) {
      try {
        await refreshUser();
      } catch (_) {
        // Keep cached state so the app can still open offline.
      }
    }

    await _evaluateSafetyAutomation();
    await _notifications.initialize();
    _restartRuntimeAutomation();

    _isInitializing = false;
    notifyListeners();
  }

  Future<void> _saveToStorage() async {
    final prefs = await SharedPreferences.getInstance();
    final data = {
      'user': _user?.toJson(),
      'onboarded': _onboarded,
      'permissionsGranted': _permissionsGranted,
      'streak': _streak,
      'mood': _mood?.name,
      'highContrast': _highContrast,
      'language': _language.name,
      'medical': _medical.toJson(),
      'automation': _automation.toJson(),
      'security': _security.toJson(),
      'vaultEntries': _vaultEntries.map((item) => item.toJson()).toList(),
      'vaultReleaseAt': _vaultReleaseAt?.toIso8601String(),
      'vaultAutoWipeAt': _vaultAutoWipeAt?.toIso8601String(),
      'badges': _badges,
      'circlePosts': _circlePosts.map((item) => item.toJson()).toList(),
      'chatThreads': _chatThreads.map((item) => item.toJson()).toList(),
      'homeAnchor': _homeAnchor?.toJson(),
      'stepsToday': _stepsToday,
      'caloriesBurnedToday': _caloriesBurnedToday,
      'stepBaseline': _stepBaseline,
      'stepBaselineDayKey': _stepBaselineDayKey,
      'lastRawStepCount': _lastRawStepCount,
    };
    await prefs.setString(_storageKey, jsonEncode(data));
  }

  Future<void> completeOnboarding() async {
    _onboarded = true;
    notifyListeners();
    await _saveToStorage();
  }

  Future<void> grantPermissions() async {
    _permissionsGranted = true;
    await _notifications.initialize();
    _restartRuntimeAutomation();
    notifyListeners();
    await _saveToStorage();
  }

  Future<void> authenticate({
    required String fullName,
    required String phoneNumber,
    required String email,
    required String emergencyName,
    required String emergencyPhone,
    required int timerIntervalMinutes,
  }) async {
    await _runBusy(() async {
      final users = await _api.listUsers();
      final existing = users.where((item) => item.phoneNumber == phoneNumber).toList();

      if (existing.isNotEmpty) {
        final restored = existing.first;
        _user = User.fromUserModel(restored, email: email);
      } else {
      final created = await _api.registerUser(
          fullName: fullName,
          phoneNumber: phoneNumber,
          timerIntervalMinutes: timerIntervalMinutes,
          emergencyName: emergencyName,
          emergencyPhone: emergencyPhone,
        );
        _user = User.fromUserModel(created, email: email);
      }

      _medical.fullName = fullName;
      _medical.emergencyPhone = emergencyPhone;
      _streak = (_streak == 0) ? 1 : _streak;
      _medical = _fromMedicalProfile(
        await _api.getMedicalProfile(_user!.id),
        citizenId: _medical.citizenId,
        permanentAddress: _medical.permanentAddress,
      );
      _automation = _fromAutomationSettings(
        await _api.getAutomationSettings(_user!.id),
        stepTrackingEnabled: _automation.stepTrackingEnabled,
      );
      _security = _mergeSecuritySettings(
        _security,
        await _api.getSecuritySettings(_user!.id),
      );
      _alertPolicy = await _api.getAlertPolicy(_user!.id);
      _interactionEvents = await _api.listInteractions(_user!.id);
      _seedDemoCollections();
      _homeAnchor ??= _user?.lastKnownLocation;
      _updateBadges();
      await _saveToStorage();
      _restartRuntimeAutomation();
    });
  }

  Future<void> refreshUser() async {
    final current = _user;
    if (current == null) {
      return;
    }
    final refreshed = await _api.getUserById(current.id);
    _user = User.fromUserModel(refreshed, email: current.email);
    _medical = _fromMedicalProfile(
      await _api.getMedicalProfile(current.id),
      citizenId: _medical.citizenId,
      permanentAddress: _medical.permanentAddress,
    );
    _automation = _fromAutomationSettings(
      await _api.getAutomationSettings(current.id),
      stepTrackingEnabled: _automation.stepTrackingEnabled,
    );
    _security = _mergeSecuritySettings(
      _security,
      await _api.getSecuritySettings(current.id),
    );
    _alertPolicy = await _api.getAlertPolicy(current.id);
    _interactionEvents = await _api.listInteractions(current.id);
    _seedDemoCollections();
    _homeAnchor ??= _user?.lastKnownLocation;
    _updateBadges();
    await _evaluateSafetyAutomation();
    _restartRuntimeAutomation();
    notifyListeners();
    await _saveToStorage();
  }

  Future<void> signOut() async {
    _stopRuntimeAutomation();
    _user = null;
    _lastError = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_storageKey);
    _onboarded = true;
    _permissionsGranted = false;
    _streak = 0;
    _mood = Mood.calm;
    _medical = MedicalId();
    _automation = Automation();
    _security = Security();
    _vaultEntries = _defaultVaultEntries();
    _vaultReleaseAt = null;
    _vaultAutoWipeAt = null;
    _badges = [];
    _circlePosts = const [];
    _chatThreads = const [];
    _heroes = const [];
    _radarIncidents = const [];
    _alertPolicy = null;
    _interactionEvents = const [];
    _homeAnchor = null;
    notifyListeners();
  }

  Future<void> checkIn({Mood? mood}) async {
    final current = _user;
    if (current == null) {
      throw Exception('Chưa có hồ sơ người dùng. Vui lòng đăng nhập lại.');
    }

    await _runBusy(() async {
      final position = await _locationService.getBestEffortLocation(
        fallbackLat: current.lastKnownLocation?.lat,
        fallbackLng: current.lastKnownLocation?.lng,
      );
      final updated = await _api.checkin(
        userId: current.id,
        lat: position.lat,
        lng: position.lng,
      );

      _user = User.fromUserModel(updated, email: current.email);
      _homeAnchor = AppLocation(
        lat: position.lat,
        lng: position.lng,
        updatedAt: DateTime.now(),
      );
      _wasOutsideHome = false;
      _lastOverdueNotificationAt = null;
      _mood = mood ?? _mood ?? Mood.calm;
      _streak += 1;
      _prependOwnPost(
        message: 'Tôi vừa check-in an toàn. Nếu cần, mọi người có thể xem vị trí cập nhật mới nhất của tôi.',
        moodLabel: _labelForMood(_mood ?? Mood.calm),
        scope: CircleScope.family,
      );
      _updateChatPreview(
        'family',
        'Đã nhận check-in mới của ${_user?.name ?? 'bạn'}',
      );
      _interactionEvents = await _api.listInteractions(current.id);
      _vaultReleaseAt = null;
      _updateBadges();
      await _evaluateSafetyAutomation();
      await _saveToStorage();
      _restartRuntimeAutomation();
    });
  }

  Future<void> acknowledgeReminder() async {
    final current = _user;
    if (current == null) {
      return;
    }

    await _runBusy(() async {
      await _api.createInteraction(
        userId: current.id,
        type: 'MORNING_ACK',
        source: 'MOBILE_APP',
        metadata: {'screen': 'home'},
      );
      _interactionEvents = await _api.listInteractions(current.id);
      await _saveToStorage();
    });
  }

  Future<void> setGraceHours(int hours) async {
    final current = _user;
    if (current == null) {
      return;
    }
    await _runBusy(() async {
      final updated = await _api.updateTimer(current.id, hours * 60);
      _user = User.fromUserModel(updated, email: current.email);
      await _evaluateSafetyAutomation();
      await _saveToStorage();
    });
  }

  Future<void> setQuietHours({
    required String start,
    required String end,
    required int falseAlertGraceMinutes,
  }) async {
    final current = _user;
    if (current == null) {
      return;
    }
    await _runBusy(() async {
      final updated = await _api.updatePreferences(
        userId: current.id,
        quietHoursStart: start,
        quietHoursEnd: end,
        falseAlertGraceMinutes: falseAlertGraceMinutes,
      );
      _user = User.fromUserModel(updated, email: current.email);
      await _saveToStorage();
    });
  }

  Future<void> updateAlertPolicy({
    required int level1Minutes,
    required int level2Minutes,
    required int level3Minutes,
    required bool level4Enabled,
  }) async {
    final current = _user;
    if (current == null) {
      return;
    }

    await _runBusy(() async {
      _alertPolicy = await _api.updateAlertPolicy(
        userId: current.id,
        level1Minutes: level1Minutes,
        level2Minutes: level2Minutes,
        level3Minutes: level3Minutes,
        level4Enabled: level4Enabled,
      );
      await _saveToStorage();
    });
  }

  Future<void> startVacation(int days) async {
    final current = _user;
    if (current == null) {
      return;
    }
    await _runBusy(() async {
      final updated = await _api.setSleepMode(
        userId: current.id,
        minutes: days * 24 * 60,
      );
      _user = User.fromUserModel(updated, email: current.email);
      await _saveToStorage();
    });
  }

  Future<void> endVacation() async {
    final current = _user;
    if (current == null) {
      return;
    }
    await _runBusy(() async {
      final updated = await _api.setSleepMode(userId: current.id, minutes: 0);
      _user = User.fromUserModel(updated, email: current.email);
      await _evaluateSafetyAutomation();
      await _saveToStorage();
    });
  }

  Future<void> setSleepModeHours(int hours) async {
    final current = _user;
    if (current == null) {
      return;
    }
    await _runBusy(() async {
      final boundedHours = hours.clamp(1, 24);
      final updated = await _api.setSleepMode(
        userId: current.id,
        minutes: boundedHours * 60,
      );
      _user = User.fromUserModel(updated, email: current.email);
      await _evaluateSafetyAutomation();
      await _saveToStorage();
    });
  }

  Future<void> setHighContrast(bool enabled) async {
    _highContrast = enabled;
    await _saveToStorage();
    notifyListeners();
  }

  Future<void> setLanguage(AppLanguage language) async {
    _language = language;
    await _saveToStorage();
    notifyListeners();
  }

  Future<void> setMedical(MedicalId medical) async {
    final current = _user;
    if (current == null) {
      _medical = medical;
      _updateBadges();
      await _saveToStorage();
      notifyListeners();
      return;
    }
    await _runBusy(() async {
      final profile = await _api.updateMedicalProfile(
        userId: current.id,
        profile: _toMedicalProfile(current.id, medical),
      );
      _medical = _fromMedicalProfile(
        profile,
        citizenId: medical.citizenId,
        permanentAddress: medical.permanentAddress,
      );
      _updateBadges();
      await _saveToStorage();
    });
  }

  Future<void> setAutomation(Automation automation) async {
    final current = _user;
    if (current == null) {
      _automation = automation;
      _updateBadges();
      await _saveToStorage();
      _restartRuntimeAutomation();
      notifyListeners();
      return;
    }
    await _runBusy(() async {
      final settings = await _api.updateAutomationSettings(
        userId: current.id,
        settings: _toAutomationSettings(current.id, automation),
      );
      _automation = _fromAutomationSettings(settings);
      _automation.stepTrackingEnabled = automation.stepTrackingEnabled;
      _updateBadges();
      await _saveToStorage();
      _restartRuntimeAutomation();
    });
  }

  Future<void> setSecurity(Security security) async {
    final current = _user;
    _security = security;
    if (current != null) {
      await _runBusy(() async {
        final remote = await _api.updateSecuritySettings(
          userId: current.id,
          stealthMode: security.stealthMode,
          autoWipeDays: security.autoWipeDays,
          encryptionEnabled: security.encryptionEnabled,
        );
        _security = _mergeSecuritySettings(security, remote);
        _updateBadges();
        await _evaluateSafetyAutomation();
        await _saveToStorage();
      });
      return;
    }
    _updateBadges();
    await _evaluateSafetyAutomation();
    await _saveToStorage();
    notifyListeners();
  }

  Future<void> saveVaultEntry({
    required String entryId,
    required String content,
  }) async {
    _vaultEntries = _vaultEntries
        .map(
          (entry) => entry.id == entryId
              ? entry.copyWith(
                  content: content.trim(),
                  updatedAt: DateTime.now(),
                )
              : entry,
        )
        .toList();
    _updateBadges();
    await _saveToStorage();
    notifyListeners();
  }

  Future<void> setEmergencyContacts(List<EmergencyContact> contacts) async {
    final current = _user;
    if (current == null) {
      return;
    }
    await _runBusy(() async {
      final target = contacts.take(3).toList();
      final existing = current.emergencyContacts;
      final exactExisting = {
        for (final item in existing) '${item.name}|${item.phone}|${item.relation}': item,
      };
      final exactTarget = {
        for (final item in target) '${item.name}|${item.phone}|${item.relation}': item,
      };

      for (final item in existing) {
        final key = '${item.name}|${item.phone}|${item.relation}';
        if (!exactTarget.containsKey(key)) {
          await _api.deleteGuardian(userId: current.id, phone: item.phone);
        }
      }

      for (final item in target) {
        final key = '${item.name}|${item.phone}|${item.relation}';
        if (!exactExisting.containsKey(key)) {
          await _api.createGuardian(
            userId: current.id,
            name: item.name,
            phone: item.phone,
            relation: item.relation,
          );
        }
      }

      final refreshedContacts = await _api.listGuardians(current.id);
      _user = current.copyWith(
        emergencyContacts: refreshedContacts
            .map(
              (item) => EmergencyContact(
                name: item.name,
                phone: item.phone,
                relation: item.relation,
              ),
            )
            .toList(),
      );
      await _saveToStorage();
    });
  }

  Future<void> reportDeviceSignal({
    required String signalType,
    Map<String, dynamic> payload = const {},
  }) async {
    final current = _user;
    if (current == null) {
      return;
    }
    await _api.createDeviceSignal(
      userId: current.id,
      signalType: signalType,
      payload: payload,
    );
    await refreshUser();
  }

  Future<void> triggerSilentSos() async {
    final current = _user;
    if (current == null) {
      return;
    }

    try {
      final position = await _locationService.getBestEffortLocation(
        fallbackLat: current.lastKnownLocation?.lat,
        fallbackLng: current.lastKnownLocation?.lng,
      );
      await _api.createInteraction(
        userId: current.id,
        type: 'SILENT_DURESS',
        source: 'STEALTH_PIN',
        metadata: {
          'lat': position.lat,
          'lng': position.lng,
          'triggeredAt': DateTime.now().toIso8601String(),
        },
      );
      _updateChatPreview(
        'emergency',
        'Đã gửi SOS im lặng từ chế độ ẩn danh',
      );
      _chatThreads = _chatThreads
          .map(
            (thread) => thread.id == 'emergency'
                ? thread.copyWith(
                    updatedAt: DateTime.now(),
                    unread: thread.unread + 1,
                    messages: [
                      ...thread.messages,
                      ChatMessage(
                        id: 'system-${DateTime.now().microsecondsSinceEpoch}',
                        sender: 'Hệ thống',
                        content:
                            'Đã ghi nhận mã duress và gửi SOS im lặng cùng vị trí hiện tại.',
                        createdAt: DateTime.now(),
                        isSystem: true,
                      ),
                    ],
                  )
                : thread,
          )
          .toList()
        ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
      await _saveToStorage();
      notifyListeners();
    } catch (_) {
      // Silent by design.
    }
  }

  Future<void> createCirclePost({
    required String message,
    required Mood mood,
    required CircleScope scope,
  }) async {
    _mood = mood;
    _prependOwnPost(
      message: message,
      moodLabel: _labelForMood(mood),
      scope: scope,
    );
    final current = _user;
    if (current != null) {
      await _api.createInteraction(
        userId: current.id,
        type: 'STATUS_POSTED',
        source: scope == CircleScope.family ? 'FAMILY_CIRCLE' : 'COMMUNITY_CIRCLE',
        metadata: {'message': message, 'mood': mood.name},
      );
      _interactionEvents = await _api.listInteractions(current.id);
    }
    _updateChatPreview(
      scope == CircleScope.family ? 'family' : 'community',
      message,
    );
    await _saveToStorage();
    notifyListeners();
  }

  Future<void> toggleCircleCheer(String postId) async {
    final post = _circlePosts.where((item) => item.id == postId).firstOrNull;
    if (post == null) {
      return;
    }

    final nextCheered = !post.cheeredByMe;
    _circlePosts = _circlePosts
        .map(
          (item) => item.id == postId
              ? item.copyWith(
                  cheeredByMe: nextCheered,
                  cheers: nextCheered ? item.cheers + 1 : (item.cheers > 0 ? item.cheers - 1 : 0),
                )
              : item,
        )
        .toList();

    _updateChatPreview(
      post.scope == CircleScope.family ? 'family' : 'community',
      nextCheered
          ? '${_user?.name ?? 'Bạn'} vừa gửi động viên cho ${post.author}'
          : '${_user?.name ?? 'Bạn'} đã bỏ gửi động viên',
    );
    await _saveToStorage();
    notifyListeners();
  }

  Future<void> replyToCirclePost(String postId, String text) async {
    final message = text.trim();
    if (message.isEmpty) {
      return;
    }

    final author = _user?.name ?? 'Bạn';
    final reply = CircleReply(
      id: 'reply-${DateTime.now().microsecondsSinceEpoch}',
      author: author,
      message: message,
      createdAt: DateTime.now(),
      mine: true,
    );

    CirclePost? updatedPost;
    _circlePosts = _circlePosts
        .map((item) {
          if (item.id != postId) {
            return item;
          }
          updatedPost = item.copyWith(
            replyItems: [...item.replyItems, reply],
          );
          return updatedPost!;
        })
        .toList();

    if (updatedPost != null) {
      _updateChatPreview(
        updatedPost!.scope == CircleScope.family ? 'family' : 'community',
        '$author: $message',
      );
    }

    await _saveToStorage();
    notifyListeners();
  }

  Future<void> sendQuickMessage(String threadId, String text) async {
    final message = text.trim();
    if (message.isEmpty) {
      return;
    }
    if (!_chatThreads.any((thread) => thread.id == threadId)) {
      return;
    }

    final sender = _user?.name ?? 'Bạn';
    final now = DateTime.now();
    final outgoing = ChatMessage(
      id: 'msg-${now.microsecondsSinceEpoch}',
      sender: sender,
      content: message,
      createdAt: now,
      mine: true,
    );

    _chatThreads = _chatThreads
        .map((thread) => thread.id == threadId
            ? thread.copyWith(
                preview: message,
                updatedAt: now,
                unread: 0,
                messages: [...thread.messages, outgoing],
              )
            : thread)
        .toList()
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));

    notifyListeners();
    await _saveToStorage();
  }

  Future<void> sendVoiceMessage(String threadId, RecordedAudioNote note) async {
    if (note.durationSeconds <= 0) {
      return;
    }
    final seconds = note.durationSeconds;
    if (!_chatThreads.any((thread) => thread.id == threadId)) {
      return;
    }

    final sender = _user?.name ?? 'Bạn';
    final now = DateTime.now();
    final outgoing = ChatMessage(
      id: 'voice-${now.microsecondsSinceEpoch}',
      sender: sender,
      content: 'Tin nhắn thoại',
      createdAt: now,
      mine: true,
      voiceSeconds: note.durationSeconds,
      voicePath: note.path,
    );

    final preview = 'Tin nhắn thoại ${seconds}s';
    _chatThreads = _chatThreads
        .map((thread) => thread.id == threadId
            ? thread.copyWith(
                preview: preview,
                updatedAt: now,
                unread: 0,
                messages: [...thread.messages, outgoing],
              )
            : thread)
        .toList()
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));

    notifyListeners();
    await _saveToStorage();
  }

  Future<void> markThreadRead(String threadId) async {
    _chatThreads = _chatThreads
        .map(
          (thread) => thread.id == threadId ? thread.copyWith(unread: 0) : thread,
        )
        .toList();
    await _saveToStorage();
    notifyListeners();
  }

  void _restartRuntimeAutomation() {
    _stopRuntimeAutomation();
    if (_user == null || !_permissionsGranted) {
      return;
    }

    _automationTimer = Timer.periodic(
      const Duration(seconds: 30),
      (_) => _runRuntimeAutomationTick(),
    );
    unawaited(_runRuntimeAutomationTick());

    if (_automation.geofenceAutoCheckin) {
      final settings = const LocationSettings(
        accuracy: LocationAccuracy.medium,
        distanceFilter: 30,
      );
      _positionSubscription = Geolocator.getPositionStream(
        locationSettings: settings,
      ).listen(
        (position) => unawaited(_handleGeofencePosition(position)),
        onError: (_) {},
      );
    }

    if (_automation.fallDetection || _automation.shakeSos) {
      _accelerometerSubscription = userAccelerometerEventStream().listen(
        (event) => unawaited(_handleMotionEvent(event)),
        onError: (_) {},
        cancelOnError: false,
      );
    }

    if (_automation.stepTrackingEnabled) {
      _stepCountSubscription = Pedometer.stepCountStream.listen(
        (event) => unawaited(_handleStepCountEvent(event)),
        onError: (_) {},
        cancelOnError: false,
      );
    }
  }

  void _stopRuntimeAutomation() {
    _automationTimer?.cancel();
    _automationTimer = null;
    _positionSubscription?.cancel();
    _positionSubscription = null;
    _accelerometerSubscription?.cancel();
    _accelerometerSubscription = null;
    _stepCountSubscription?.cancel();
    _stepCountSubscription = null;
  }

  Future<void> _runRuntimeAutomationTick() async {
    final user = _user;
    if (user == null || isVacation) {
      return;
    }

    final now = DateTime.now();
    final hhmm =
        '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
    final todayKey = DateTime(now.year, now.month, now.day, now.hour, now.minute);

    if (_automation.dailyReminderTime == hhmm &&
        !_sameMinute(_lastDailyReminderAt, todayKey)) {
      _lastDailyReminderAt = todayKey;
      await _notifications.showDailyReminder(
        hhmm,
        isVietnamese: _language == AppLanguage.vi,
      );
    }

    if (_automation.pillReminder &&
        _automation.pillTime == hhmm &&
        !_sameMinute(_lastMedicationReminderAt, todayKey)) {
      _lastMedicationReminderAt = todayKey;
      await _notifications.showMedicationReminder(
        hhmm,
        isVietnamese: _language == AppLanguage.vi,
      );
    }

    final deadline = user.nextDeadline;
    if (deadline != null &&
        now.isAfter(deadline) &&
        !_sameMinute(_lastOverdueNotificationAt, todayKey)) {
      _lastOverdueNotificationAt = todayKey;
      await _notifications.showOverdueCheckIn(
        isVietnamese: _language == AppLanguage.vi,
      );
    }
  }

  Future<void> _handleGeofencePosition(Position position) async {
    final user = _user;
    if (user == null || !_automation.geofenceAutoCheckin) {
      return;
    }

    _homeAnchor ??= user.lastKnownLocation;
    final anchor = _homeAnchor;
    if (anchor == null) {
      return;
    }

    final distance = Geolocator.distanceBetween(
      anchor.lat,
      anchor.lng,
      position.latitude,
      position.longitude,
    );

    if (distance > 250) {
      _wasOutsideHome = true;
      return;
    }

    if (_wasOutsideHome && distance <= 120) {
      final now = DateTime.now();
      if (_lastGeofenceCheckInAt == null ||
          now.difference(_lastGeofenceCheckInAt!).inMinutes >= 15) {
        _lastGeofenceCheckInAt = now;
        _wasOutsideHome = false;
        await reportDeviceSignal(
          signalType: 'GEOFENCE_HOME_ARRIVAL',
          payload: {
            'lat': position.latitude,
            'lng': position.longitude,
            'distanceMeters': distance.round(),
            'triggeredAt': now.toIso8601String(),
          },
        );
        await _notifications.showHomeArrivalAutoCheckIn(
          isVietnamese: _language == AppLanguage.vi,
        );
      }
    }
  }

  Future<void> _handleMotionEvent(UserAccelerometerEvent event) async {
    final now = DateTime.now();
    final magnitude = math.sqrt(
      event.x * event.x + event.y * event.y + event.z * event.z,
    );

    if (_automation.shakeSos) {
      final lastPeak = _lastShakePeakAt;
      if (magnitude > 16 &&
          (lastPeak == null ||
              now.difference(lastPeak).inMilliseconds > 350)) {
        _lastShakePeakAt = now;
        _shakePeaks.add(now);
        _shakePeaks.removeWhere(
          (item) => now.difference(item).inSeconds > 2,
        );
        if (_shakePeaks.length >= 3 &&
            (_lastShakeSignalAt == null ||
                now.difference(_lastShakeSignalAt!).inSeconds > 45)) {
          _lastShakeSignalAt = now;
          _shakePeaks.clear();
          await reportDeviceSignal(
            signalType: 'SHAKE_SOS',
            payload: {
              'magnitude': magnitude,
              'triggeredAt': now.toIso8601String(),
            },
          );
          await _notifications.showShakeSosTriggered(
            isVietnamese: _language == AppLanguage.vi,
          );
        }
      }
    }

    if (!_automation.fallDetection) {
      return;
    }

    if (magnitude > 18) {
      _fallCandidateAt = now;
      _lowMotionSince = null;
      return;
    }

    final candidate = _fallCandidateAt;
    if (candidate == null) {
      return;
    }

    if (now.difference(candidate).inSeconds > 12) {
      _fallCandidateAt = null;
      _lowMotionSince = null;
      return;
    }

    if (magnitude < 1.2) {
      _lowMotionSince ??= now;
      if (_lowMotionSince != null &&
          now.difference(_lowMotionSince!).inSeconds >= 4 &&
          (_lastFallSignalAt == null ||
              now.difference(_lastFallSignalAt!).inSeconds > 60)) {
        _lastFallSignalAt = now;
        _fallCandidateAt = null;
        _lowMotionSince = null;
        await reportDeviceSignal(
          signalType: 'FALL_DETECTED',
          payload: {
            'magnitude': magnitude,
            'triggeredAt': now.toIso8601String(),
          },
        );
        await _notifications.showFallDetected(
          isVietnamese: _language == AppLanguage.vi,
        );
      }
    } else if (magnitude > 3) {
      _lowMotionSince = null;
    }
  }

  Future<void> _handleStepCountEvent(StepCount event) async {
    _resetStepCountersIfNeeded();
    final todayKey = _todayKey(DateTime.now());
    _stepBaselineDayKey ??= todayKey;

    if (_stepBaselineDayKey != todayKey) {
      _stepBaselineDayKey = todayKey;
      _stepBaseline = event.steps;
      _stepsToday = 0;
      _caloriesBurnedToday = 0;
    }

    if (_stepBaseline == null || event.steps < _stepBaseline!) {
      _stepBaseline = event.steps;
    }

    _lastRawStepCount = event.steps;
    final computedSteps = math.max(0, event.steps - (_stepBaseline ?? event.steps));
    if (computedSteps == _stepsToday) {
      return;
    }

    _stepsToday = computedSteps;
    _caloriesBurnedToday = _estimateCaloriesForSteps(_stepsToday);
    notifyListeners();

    if (_stepsToday % 20 == 0 || _stepsToday < 20) {
      await _saveToStorage();
    }
  }

  void _resetStepCountersIfNeeded() {
    final todayKey = _todayKey(DateTime.now());
    if (_stepBaselineDayKey == null) {
      _stepBaselineDayKey = todayKey;
      return;
    }
    if (_stepBaselineDayKey != todayKey) {
      _stepBaselineDayKey = todayKey;
      _stepBaseline = _lastRawStepCount;
      _stepsToday = 0;
      _caloriesBurnedToday = 0;
    }
  }

  double _estimateCaloriesForSteps(int steps) {
    return steps * 0.04;
  }

  bool _sameMinute(DateTime? a, DateTime? b) {
    if (a == null || b == null) {
      return false;
    }
    return a.year == b.year &&
        a.month == b.month &&
        a.day == b.day &&
        a.hour == b.hour &&
        a.minute == b.minute;
  }

  @override
  void dispose() {
    _stopRuntimeAutomation();
    super.dispose();
  }

  Future<void> _runBusy(Future<void> Function() action) async {
    _isBusy = true;
    _lastError = null;
    notifyListeners();
    try {
      await action();
    } catch (error) {
      _lastError = error.toString().replaceFirst('Exception: ', '');
      rethrow;
    } finally {
      _isBusy = false;
      notifyListeners();
    }
  }

  void _updateBadges() {
    final newBadges = <String>[];
    if (_streak >= 7) {
      newBadges.add('streak7');
    }
    if (_streak >= 30) {
      newBadges.add('streak30');
    }
    if (_medical.bloodType.isNotEmpty &&
        _medical.allergies.isNotEmpty &&
        _medical.emergencyPhone.isNotEmpty) {
      newBadges.add('medical');
    }
    if (_automation.shakeSos || _automation.fallDetection) {
      newBadges.add('automation');
    }
    if (_security.duressPin.isNotEmpty) {
      newBadges.add('duress');
    }
    if (_vaultEntries.any((entry) => entry.hasContent)) {
      newBadges.add('vault');
    }
    _badges = newBadges;
  }

  void _prependOwnPost({
    required String message,
    required String moodLabel,
    required CircleScope scope,
  }) {
    final author = _user?.name ?? 'Bạn';
    final next = CirclePost(
      id: 'post-${DateTime.now().millisecondsSinceEpoch}',
      author: author,
      message: message,
      moodLabel: moodLabel,
      createdAt: DateTime.now(),
      scope: scope,
      cheers: 0,
      replyItems: const [],
      mine: true,
    );

    final withoutOldMine = _circlePosts.where((post) => post.id != next.id).toList();
    _circlePosts = [next, ...withoutOldMine];
  }

  void _updateChatPreview(String threadId, String preview) {
    _chatThreads = _chatThreads
        .map((thread) => thread.id == threadId
            ? thread.copyWith(
                preview: preview,
                updatedAt: DateTime.now(),
              )
            : thread)
        .toList()
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
  }

  Future<void> _evaluateSafetyAutomation() async {
    final current = _user;
    if (current == null || isVacation) {
      return;
    }

    final now = DateTime.now();
    final unlockAt = vaultUnlockAt;
    var changed = false;

    if (unlockAt != null && _vaultReleaseAt == null && !now.isBefore(unlockAt)) {
      _vaultReleaseAt = now;
      _appendSystemMessage(
        'family',
        'Két sắt sinh tử đã được mở theo dead-man switch sau hơn 72 giờ mất liên lạc liên tiếp.',
      );
      _appendSystemMessage('emergency', buildVaultGuardianPayload());
      changed = true;
    }

    if (_security.autoWipeDays > 0 &&
        _vaultAutoWipeAt == null &&
        current.lastCheckinTime != null &&
        !now.isBefore(
          current.lastCheckinTime!.add(Duration(days: _security.autoWipeDays)),
        )) {
      _vaultEntries = _defaultVaultEntries();
      _medical = MedicalId();
      _vaultAutoWipeAt = now;
      _appendSystemMessage(
        'emergency',
        'Auto-wipe đã xóa dữ liệu nhạy cảm cục bộ trên thiết bị sau ${_security.autoWipeDays} ngày không có check-in.',
      );
      changed = true;
    }

    if (changed) {
      _updateBadges();
      await _saveToStorage();
      notifyListeners();
    }
  }

  String buildVaultGuardianPayload() {
    final filledEntries = _vaultEntries.where((entry) => entry.hasContent).toList();
    if (filledEntries.isEmpty) {
      return 'Két sắt sinh tử đã mở nhưng hiện chưa có nội dung nào được lưu.';
    }

    final buffer = StringBuffer('Gói dữ liệu Vault cho Guardian:\n');
    for (final entry in filledEntries) {
      buffer.writeln('- ${entry.title}: ${entry.content}');
    }
    return buffer.toString().trimRight();
  }

  void _appendSystemMessage(String threadId, String content) {
    final now = DateTime.now();
    _chatThreads = _chatThreads
        .map((thread) => thread.id == threadId
            ? thread.copyWith(
                preview: content,
                updatedAt: now,
                unread: thread.unread + 1,
                messages: [
                  ...thread.messages,
                  ChatMessage(
                    id: 'system-${now.microsecondsSinceEpoch}-${thread.id}',
                    sender: 'Hệ thống',
                    content: content,
                    createdAt: now,
                    isSystem: true,
                  ),
                ],
              )
            : thread)
        .toList()
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
  }

  void _seedDemoCollections() {
    final userName = _user?.name.isNotEmpty == true ? _user!.name : 'Bạn';

    if (_circlePosts.isEmpty) {
      _circlePosts = [
        CirclePost(
          id: 'family-1',
          author: userName,
          message: 'Hôm nay tôi ổn và đã bật SafeSolo để gia đình yên tâm.',
          moodLabel: 'Bình an',
          createdAt: DateTime.now().subtract(const Duration(minutes: 35)),
          scope: CircleScope.family,
          cheers: 2,
          cheeredByMe: false,
          replyItems: [
            CircleReply(
              id: 'reply-family-1',
              author: 'Mẹ',
              message: 'Cả nhà đã thấy check-in của con, yên tâm rồi nhé.',
              createdAt: DateTime.now().subtract(const Duration(minutes: 22)),
            ),
          ],
          mine: true,
        ),
        CirclePost(
          id: 'family-2',
          author: 'Mẹ Lan',
          message: 'Mẹ vừa uống thuốc và đang nghỉ ngơi. Cả nhà yên tâm nhé.',
          moodLabel: 'Ổn định',
          createdAt: DateTime.now().subtract(const Duration(hours: 3)),
          scope: CircleScope.family,
          cheers: 7,
          replyItems: [
            CircleReply(
              id: 'reply-family-2a',
              author: userName,
              message: 'Con đã xem, mẹ nghỉ thêm nhé.',
              createdAt: DateTime.now().subtract(const Duration(hours: 2, minutes: 40)),
              mine: true,
            ),
            CircleReply(
              id: 'reply-family-2b',
              author: 'Ba',
              message: 'Tối nay con ghé qua thăm mẹ giúp ba nhé.',
              createdAt: DateTime.now().subtract(const Duration(hours: 2, minutes: 25)),
            ),
          ],
          voiceNote: true,
        ),
        CirclePost(
          id: 'community-1',
          author: 'Quốc An',
          message: 'Tôi vừa về đến nhà sau ca trực tối. Khu vực hiện an toàn.',
          moodLabel: 'Đã check-in',
          createdAt: DateTime.now().subtract(const Duration(minutes: 55)),
          scope: CircleScope.community,
          cheers: 6,
          replyItems: const [],
        ),
      ];
    }

    if (_chatThreads.isEmpty) {
      _chatThreads = [
        ChatThread(
          id: 'family',
          groupLabel: 'NHÓM GIA ĐÌNH',
          name: 'Gia đình',
          preview: 'Đã đồng bộ check-in mới nhất',
          updatedAt: DateTime.now().subtract(const Duration(minutes: 10)),
          contactPhone: _user?.emergencyContacts.firstOrNull?.phone ?? '0911132112',
          messages: [
            ChatMessage(
              id: 'family-msg-1',
              sender: 'Mẹ',
              content: 'Con nhớ check-in sau khi tan làm nhé.',
              createdAt: DateTime.now().subtract(const Duration(hours: 1, minutes: 10)),
            ),
            ChatMessage(
              id: 'family-msg-2',
              sender: userName,
              content: 'Con vừa về nhà an toàn rồi, đã check-in xong.',
              createdAt: DateTime.now().subtract(const Duration(minutes: 10)),
              mine: true,
            ),
            ChatMessage(
              id: 'family-voice-1',
              sender: 'Mẹ',
              content: 'Voice note đã gửi',
              createdAt: DateTime.now().subtract(const Duration(minutes: 8)),
              voiceSeconds: 11,
            ),
          ],
          unread: 1,
        ),
        ChatThread(
          id: 'emergency',
          groupLabel: 'HỖ TRỢ KHẨN CẤP',
          name: 'Hỗ trợ - Hiệp sĩ Minh Anh',
          preview: 'Nếu có SOS, tôi sẽ là người tiếp cận đầu tiên.',
          updatedAt: DateTime.now().subtract(const Duration(hours: 1)),
          contactPhone: '115',
          messages: [
            ChatMessage(
              id: 'emergency-msg-1',
              sender: 'Hệ thống',
              content: 'Kênh liên lạc khẩn cấp đã sẵn sàng.',
              createdAt: DateTime.now(),
              isSystem: true,
            ),
            ChatMessage(
              id: 'emergency-msg-2',
              sender: 'Hiệp sĩ Minh Anh',
              content: 'Nếu cần hỗ trợ gấp, hãy nhắn tin trực tiếp cho tôi ở đây.',
              createdAt: DateTime.now(),
            ),
          ],
          unread: 0,
          battery: '64%',
          highlight: true,
        ),
        ChatThread(
          id: 'community',
          groupLabel: 'CỘNG ĐỒNG',
          name: 'Alive Circle',
          preview: 'Mọi người đang gửi trạng thái bình an hôm nay',
          updatedAt: DateTime.now().subtract(const Duration(hours: 2)),
          contactPhone: null,
          messages: [
            ChatMessage(
              id: 'community-msg-1',
              sender: 'Quốc An',
              content: 'Tôi vừa check-in về nhà, khu vực đang an toàn.',
              createdAt: DateTime.now(),
            ),
            ChatMessage(
              id: 'community-msg-2',
              sender: 'Hệ thống',
              content: 'Hãy giữ thông điệp ngắn gọn để người thân dễ theo dõi.',
              createdAt: DateTime.now(),
              isSystem: true,
            ),
          ],
          unread: 0,
        ),
      ];
    }

    _heroes = const [
      HeroProfile(
        name: 'Doan Minh Quan',
        location: 'Thu Dau Mot',
        rating: 4.9,
        rescues: 12,
        verified: true,
        distanceKm: 1.2,
      ),
      HeroProfile(
        name: 'Le Huu Phuoc',
        location: 'Di An',
        rating: 4.8,
        rescues: 9,
        verified: true,
        distanceKm: 1.8,
      ),
      HeroProfile(
        name: 'Nguyen Bao An',
        location: 'Thuan An',
        rating: 4.9,
        rescues: 7,
        verified: true,
        distanceKm: 2.5,
      ),
      HeroProfile(
        name: 'Phan Thi Mai',
        location: 'Ben Cat',
        rating: 4.7,
        rescues: 5,
        verified: false,
        distanceKm: 3.8,
      ),
    ];

    _radarIncidents = [
      RadarIncident(
        id: 'radar-1',
        title: 'Can theo doi vi tri tai cong vien',
        locationLabel: 'Cong vien trung tam',
        distanceKm: 1.4,
        severity: 2,
        reportedAt: DateTime.now(),
        status: 'ACTIVE',
      ),
      RadarIncident(
        id: 'radar-2',
        title: 'Yeu cau kiem tra suc khoe khan',
        locationLabel: 'Phuong Phu Hoa',
        distanceKm: 2.3,
        severity: 3,
        reportedAt: DateTime.now(),
        status: 'ACTIVE',
      ),
    ];

    _updateBadges();
  }

  String formatInteractionType(String type) {
    switch (type) {
      case 'ACCOUNT_REGISTERED':
        return 'Đăng ký tài khoản';
      case 'CHECKIN_TAP_OK':
        return 'Chạm để ổn';
      case 'MORNING_ACK':
        return 'Đã xem thông báo';
      case 'STATUS_POSTED':
        return 'Đăng trạng thái';
      default:
        return type;
    }
  }

  static Mood? _decodeMood(String? value) {
    if (value == null || value.isEmpty) {
      return null;
    }
    return Mood.values.where((item) => item.name == value).firstOrNull;
  }

  static AppLanguage _decodeLanguage(String? value) {
    return AppLanguage.values
            .where((item) => item.name == value)
            .firstOrNull ??
        AppLanguage.vi;
  }

  static String _labelForMood(Mood mood) {
    switch (mood) {
      case Mood.calm:
        return 'Bình an';
      case Mood.happy:
        return 'Tích cực';
      case Mood.tired:
        return 'Hơi mệt';
      case Mood.sick:
        return 'Cần lưu ý';
      case Mood.focused:
        return 'Đang tập trung';
    }
  }
}

List<VaultEntry> _defaultVaultEntries() {
  return const [
    VaultEntry(
      id: 'checklist',
      title: 'Checklist công việc',
      hint: 'Các việc cần Guardian xử lý ngay trong 24 giờ đầu.',
      content: '',
    ),
    VaultEntry(
      id: 'farewell',
      title: 'Lời trăn trối',
      hint: 'Điều bạn muốn nhắn lại cho gia đình và người thân.',
      content: '',
    ),
    VaultEntry(
      id: 'passwords',
      title: 'Mật khẩu',
      hint: 'Tài khoản số, email, mạng xã hội và hướng dẫn truy cập.',
      content: '',
    ),
    VaultEntry(
      id: 'funeral',
      title: 'Tang lễ',
      hint: 'Nguyện vọng tang lễ, nghi thức, người cần liên hệ.',
      content: '',
    ),
    VaultEntry(
      id: 'medical',
      title: 'Hồ sơ y tế',
      hint: 'Bệnh nền, thuốc, bác sĩ và lưu ý cấp cứu.',
      content: '',
    ),
    VaultEntry(
      id: 'pets',
      title: 'Thú cưng',
      hint: 'Người chăm, thức ăn, thuốc và lịch sinh hoạt.',
      content: '',
    ),
    VaultEntry(
      id: 'insurance',
      title: 'Bảo hiểm',
      hint: 'Hợp đồng, người thụ hưởng và nơi liên hệ.',
      content: '',
    ),
    VaultEntry(
      id: 'assets',
      title: 'Tài sản',
      hint: 'Ngân hàng, ví, giấy tờ, tài sản số và hướng dẫn xử lý.',
      content: '',
    ),
    VaultEntry(
      id: 'other',
      title: 'Khác',
      hint: 'Mọi điều Guardian cần biết thêm.',
      content: '',
    ),
  ];
}

MedicalProfileModel _toMedicalProfile(String userId, MedicalId medical) {
  return MedicalProfileModel(
    userId: userId,
    fullName: medical.fullName,
    birthYear: medical.birthYear,
    bloodType: medical.bloodType,
    allergies: medical.allergies,
    conditions: medical.conditions,
    medications: medical.medications,
    emergencyPhone: medical.emergencyPhone,
    insuranceProvider: medical.insuranceProvider,
    insuranceNumber: medical.insuranceNumber,
  );
}

MedicalId _fromMedicalProfile(
  MedicalProfileModel profile, {
  String citizenId = '',
  String permanentAddress = '',
}) {
  return MedicalId(
    fullName: profile.fullName,
    birthYear: profile.birthYear,
    citizenId: citizenId,
    permanentAddress: permanentAddress,
    bloodType: profile.bloodType,
    allergies: profile.allergies,
    conditions: profile.conditions,
    medications: profile.medications,
    emergencyPhone: profile.emergencyPhone,
    insuranceProvider: profile.insuranceProvider,
    insuranceNumber: profile.insuranceNumber,
  );
}

AutomationSettingsModel _toAutomationSettings(String userId, Automation automation) {
  return AutomationSettingsModel(
    userId: userId,
    dailyReminderTime: automation.dailyReminderTime,
    shakeSos: automation.shakeSos,
    shakeSensitivity: automation.shakeSensitivity,
    fallDetection: automation.fallDetection,
    geofenceAutoCheckin: automation.geofenceAutoCheckin,
    pillReminder: automation.pillReminder,
    pillTime: automation.pillTime,
  );
}

Automation _fromAutomationSettings(
  AutomationSettingsModel settings, {
  bool stepTrackingEnabled = false,
}) {
  return Automation(
    dailyReminderTime: settings.dailyReminderTime,
    shakeSos: settings.shakeSos,
    shakeSensitivity: settings.shakeSensitivity,
    fallDetection: settings.fallDetection,
    geofenceAutoCheckin: settings.geofenceAutoCheckin,
    pillReminder: settings.pillReminder,
    pillTime: settings.pillTime,
    stepTrackingEnabled: stepTrackingEnabled,
  );
}

Security _mergeSecuritySettings(Security local, SecuritySettingsModel remote) {
  return Security(
    realPin: local.realPin,
    duressPin: local.duressPin,
    stealthMode: remote.stealthMode,
    autoWipeDays: remote.autoWipeDays,
    encryptionEnabled: remote.encryptionEnabled,
  );
}

DateTime? _parseDateTime(Object? value) {
  if (value is String && value.isNotEmpty) {
    return DateTime.tryParse(value);
  }
  return null;
}

String _todayKey(DateTime value) {
  final month = value.month.toString().padLeft(2, '0');
  final day = value.day.toString().padLeft(2, '0');
  return '${value.year}-$month-$day';
}
