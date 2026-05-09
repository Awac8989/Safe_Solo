import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../models/alert_policy_model.dart';
import '../../models/interaction_event_model.dart';
import '../../models/user_model.dart';
import '../../services/api_service.dart';
import '../../services/location_service.dart';

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
  bool shakeSos;
  int shakeSensitivity;
  bool fallDetection;
  bool geofenceAutoCheckin;
  bool pillReminder;
  String pillTime;

  Automation({
    this.shakeSos = true,
    this.shakeSensitivity = 3,
    this.fallDetection = false,
    this.geofenceAutoCheckin = true,
    this.pillReminder = false,
    this.pillTime = '08:00',
  });

  Map<String, dynamic> toJson() => {
    'shakeSos': shakeSos,
    'shakeSensitivity': shakeSensitivity,
    'fallDetection': fallDetection,
    'geofenceAutoCheckin': geofenceAutoCheckin,
    'pillReminder': pillReminder,
    'pillTime': pillTime,
  };

  factory Automation.fromJson(Map<String, dynamic> json) => Automation(
    shakeSos: json['shakeSos'] as bool? ?? true,
    shakeSensitivity: json['shakeSensitivity'] as int? ?? 3,
    fallDetection: json['fallDetection'] as bool? ?? false,
    geofenceAutoCheckin: json['geofenceAutoCheckin'] as bool? ?? true,
    pillReminder: json['pillReminder'] as bool? ?? false,
    pillTime: json['pillTime'] as String? ?? '08:00',
  );
}

class Security {
  String realPin;
  String duressPin;
  bool stealthMode;
  int autoWipeDays;

  Security({
    this.realPin = '',
    this.duressPin = '',
    this.stealthMode = false,
    this.autoWipeDays = 0,
  });

  Map<String, dynamic> toJson() => {
    'realPin': realPin,
    'duressPin': duressPin,
    'stealthMode': stealthMode,
    'autoWipeDays': autoWipeDays,
  };

  factory Security.fromJson(Map<String, dynamic> json) => Security(
    realPin: json['realPin'] as String? ?? '',
    duressPin: json['duressPin'] as String? ?? '',
    stealthMode: json['stealthMode'] as bool? ?? false,
    autoWipeDays: json['autoWipeDays'] as int? ?? 0,
  );
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
  });

  final String id;
  final String sender;
  final String content;
  final DateTime createdAt;
  final bool mine;
  final bool isSystem;

  Map<String, dynamic> toJson() => {
    'id': id,
    'sender': sender,
    'content': content,
    'createdAt': createdAt.toIso8601String(),
    'mine': mine,
    'isSystem': isSystem,
  };

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id'] as String? ?? '',
      sender: json['sender'] as String? ?? '',
      content: json['content'] as String? ?? '',
      createdAt: _parseDateTime(json['createdAt']) ?? DateTime.now(),
      mine: json['mine'] as bool? ?? false,
      isSystem: json['isSystem'] as bool? ?? false,
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

  User? _user;
  bool _onboarded = false;
  bool _permissionsGranted = false;
  bool _isInitializing = true;
  bool _isBusy = false;
  String? _lastError;
  int _streak = 0;
  Mood? _mood = Mood.calm;
  bool _highContrast = false;
  MedicalId _medical = MedicalId();
  Automation _automation = Automation();
  Security _security = Security();
  List<String> _badges = [];
  List<CirclePost> _circlePosts = const [];
  List<ChatThread> _chatThreads = const [];
  List<HeroProfile> _heroes = const [];
  List<RadarIncident> _radarIncidents = const [];
  AlertPolicyModel? _alertPolicy;
  List<InteractionEventModel> _interactionEvents = const [];

  User? get user => _user;
  bool get onboarded => _onboarded;
  bool get permissionsGranted => _permissionsGranted;
  bool get isInitializing => _isInitializing;
  bool get isBusy => _isBusy;
  String? get lastError => _lastError;
  int get streak => _streak;
  Mood? get mood => _mood;
  bool get highContrast => _highContrast;
  MedicalId get medical => _medical;
  Automation get automation => _automation;
  Security get security => _security;
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
        _medical = MedicalId.fromJson(
          Map<String, dynamic>.from(data['medical'] as Map? ?? const {}),
        );
        _automation = Automation.fromJson(
          Map<String, dynamic>.from(data['automation'] as Map? ?? const {}),
        );
        _security = Security.fromJson(
          Map<String, dynamic>.from(data['security'] as Map? ?? const {}),
        );
        _badges = List<String>.from(data['badges'] as List<dynamic>? ?? const []);
        _circlePosts = (data['circlePosts'] as List<dynamic>? ?? const [])
            .map((item) => CirclePost.fromJson(Map<String, dynamic>.from(item as Map)))
            .toList();
        _chatThreads = (data['chatThreads'] as List<dynamic>? ?? const [])
            .map((item) => ChatThread.fromJson(Map<String, dynamic>.from(item as Map)))
            .toList();
      } catch (error) {
        debugPrint('Failed to restore SafeSolo state: $error');
      }
    }

    _seedDemoCollections();

    if (_user != null) {
      try {
        await refreshUser();
      } catch (_) {
        // Keep cached state so the app can still open offline.
      }
    }

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
      'medical': _medical.toJson(),
      'automation': _automation.toJson(),
      'security': _security.toJson(),
      'badges': _badges,
      'circlePosts': _circlePosts.map((item) => item.toJson()).toList(),
      'chatThreads': _chatThreads.map((item) => item.toJson()).toList(),
    };
    await prefs.setString(_storageKey, jsonEncode(data));
  }

  Future<void> completeOnboarding() async {
    _onboarded = true;
    await _saveToStorage();
    notifyListeners();
  }

  Future<void> grantPermissions() async {
    _permissionsGranted = true;
    await _saveToStorage();
    notifyListeners();
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
      _alertPolicy = await _api.getAlertPolicy(_user!.id);
      _interactionEvents = await _api.listInteractions(_user!.id);
      _seedDemoCollections();
      _updateBadges();
      await _saveToStorage();
    });
  }

  Future<void> refreshUser() async {
    final current = _user;
    if (current == null) {
      return;
    }
    final refreshed = await _api.getUserById(current.id);
    _user = User.fromUserModel(refreshed, email: current.email);
    _alertPolicy = await _api.getAlertPolicy(current.id);
    _interactionEvents = await _api.listInteractions(current.id);
    _seedDemoCollections();
    _updateBadges();
    await _saveToStorage();
    notifyListeners();
  }

  Future<void> signOut() async {
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
    _badges = [];
    _circlePosts = const [];
    _chatThreads = const [];
    _heroes = const [];
    _radarIncidents = const [];
    _alertPolicy = null;
    _interactionEvents = const [];
    notifyListeners();
  }

  Future<void> checkIn({Mood? mood}) async {
    final current = _user;
    if (current == null) {
      return;
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
      _mood = mood ?? _mood ?? Mood.calm;
      _streak += 1;
      _prependOwnPost(
        message: 'Toi vua check-in an toan. Neu can, moi nguoi co the xem vi tri cap nhat moi nhat cua toi.',
        moodLabel: _labelForMood(_mood ?? Mood.calm),
        scope: CircleScope.family,
      );
      _updateChatPreview(
        'family',
        'Da nhan check-in moi cua ${_user?.name ?? 'ban'}',
      );
      _interactionEvents = await _api.listInteractions(current.id);
      _updateBadges();
      await _saveToStorage();
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
      await _saveToStorage();
    });
  }

  Future<void> setHighContrast(bool enabled) async {
    _highContrast = enabled;
    await _saveToStorage();
    notifyListeners();
  }

  Future<void> setMedical(MedicalId medical) async {
    _medical = medical;
    _updateBadges();
    await _saveToStorage();
    notifyListeners();
  }

  Future<void> setAutomation(Automation automation) async {
    _automation = automation;
    _updateBadges();
    await _saveToStorage();
    notifyListeners();
  }

  Future<void> setSecurity(Security security) async {
    _security = security;
    _updateBadges();
    await _saveToStorage();
    notifyListeners();
  }

  Future<void> setEmergencyContacts(List<EmergencyContact> contacts) async {
    final current = _user;
    if (current == null) {
      return;
    }
    _user = current.copyWith(emergencyContacts: contacts);
    await _saveToStorage();
    notifyListeners();
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
        'Da gui SOS im lang tu che do an danh',
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
                        sender: 'He thong',
                        content:
                            'Da ghi nhan ma duress va gui SOS im lang cung vi tri hien tai.',
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
          ? '${_user?.name ?? 'Ban'} vua gui dong vien cho ${post.author}'
          : '${_user?.name ?? 'Ban'} da bo gui dong vien',
    );
    await _saveToStorage();
    notifyListeners();
  }

  Future<void> replyToCirclePost(String postId, String text) async {
    final message = text.trim();
    if (message.isEmpty) {
      return;
    }

    final author = _user?.name ?? 'Ban';
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

    final sender = _user?.name ?? 'Ban';
    final outgoing = ChatMessage(
      id: 'msg-${DateTime.now().microsecondsSinceEpoch}',
      sender: sender,
      content: message,
      createdAt: DateTime.now(),
      mine: true,
    );

    _chatThreads = _chatThreads
        .map((thread) => thread.id == threadId
            ? thread.copyWith(
                preview: message,
                updatedAt: DateTime.now(),
                unread: 0,
                messages: [...thread.messages, outgoing],
              )
            : thread)
        .toList()
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));

    await _saveToStorage();
    notifyListeners();
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
    _badges = newBadges;
  }

  void _prependOwnPost({
    required String message,
    required String moodLabel,
    required CircleScope scope,
  }) {
    final author = _user?.name ?? 'Ban';
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

  void _seedDemoCollections() {
    final userName = _user?.name.isNotEmpty == true ? _user!.name : 'Ban';

    if (_circlePosts.isEmpty) {
      _circlePosts = [
        CirclePost(
          id: 'family-1',
          author: userName,
          message: 'Hom nay toi on va da bat SafeSolo de gia dinh yen tam.',
          moodLabel: 'Binh an',
          createdAt: DateTime.now().subtract(const Duration(minutes: 35)),
          scope: CircleScope.family,
          cheers: 2,
          cheeredByMe: false,
          replyItems: [
            CircleReply(
              id: 'reply-family-1',
              author: 'Me',
              message: 'Ca nha da thay check-in cua con, yen tam roi nhe.',
              createdAt: DateTime.now().subtract(const Duration(minutes: 22)),
            ),
          ],
          mine: true,
        ),
        CirclePost(
          id: 'family-2',
          author: 'Me Lan',
          message: 'Me vua uong thuoc va dang nghi ngoi. Ca nha yen tam nhe.',
          moodLabel: 'On dinh',
          createdAt: DateTime.now().subtract(const Duration(hours: 3)),
          scope: CircleScope.family,
          cheers: 7,
          replyItems: [
            CircleReply(
              id: 'reply-family-2a',
              author: userName,
              message: 'Con da xem, me nghi them nhe.',
              createdAt: DateTime.now().subtract(const Duration(hours: 2, minutes: 40)),
              mine: true,
            ),
            CircleReply(
              id: 'reply-family-2b',
              author: 'Ba',
              message: 'Toi nay con ghe qua tham me giup ba nhe.',
              createdAt: DateTime.now().subtract(const Duration(hours: 2, minutes: 25)),
            ),
          ],
          voiceNote: true,
        ),
        CirclePost(
          id: 'community-1',
          author: 'Quoc An',
          message: 'Toi vua ve den nha sau ca truc toi. Khu vuc hien an toan.',
          moodLabel: 'Da check-in',
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
          groupLabel: 'NHOM GIA DINH',
          name: 'Gia dinh',
          preview: 'Da dong bo check-in moi nhat',
          updatedAt: DateTime.now().subtract(const Duration(minutes: 10)),
          messages: [
            ChatMessage(
              id: 'family-msg-1',
              sender: 'Me',
              content: 'Con nho check-in sau khi tan lam nhe.',
              createdAt: DateTime.now().subtract(const Duration(hours: 1, minutes: 10)),
            ),
            ChatMessage(
              id: 'family-msg-2',
              sender: userName,
              content: 'Con vua ve nha an toan roi, da check-in xong.',
              createdAt: DateTime.now().subtract(const Duration(minutes: 10)),
              mine: true,
            ),
          ],
          unread: 1,
        ),
        ChatThread(
          id: 'emergency',
          groupLabel: 'HO TRO KHAN CAP',
          name: 'Ho tro - Hiep si Minh Anh',
          preview: 'Neu co SOS, toi se la nguoi tiep can dau tien.',
          updatedAt: DateTime.now().subtract(const Duration(hours: 1)),
          messages: [
            ChatMessage(
              id: 'emergency-msg-1',
              sender: 'He thong',
              content: 'Kenh lien lac khan cap da san sang.',
              createdAt: DateTime.now(),
              isSystem: true,
            ),
            ChatMessage(
              id: 'emergency-msg-2',
              sender: 'Hiep si Minh Anh',
              content: 'Neu can ho tro gap, hay nhan tin truc tiep cho toi o day.',
              createdAt: DateTime.now(),
            ),
          ],
          unread: 0,
          battery: '64%',
          highlight: true,
        ),
        ChatThread(
          id: 'community',
          groupLabel: 'CONG DONG',
          name: 'Alive Circle',
          preview: 'Moi nguoi dang gui trang thai binh an hom nay',
          updatedAt: DateTime.now().subtract(const Duration(hours: 2)),
          messages: [
            ChatMessage(
              id: 'community-msg-1',
              sender: 'Quoc An',
              content: 'Toi vua check-in ve nha, khu vuc dang an toan.',
              createdAt: DateTime.now(),
            ),
            ChatMessage(
              id: 'community-msg-2',
              sender: 'He thong',
              content: 'Hay giu thong diep ngan gon va de nguoi than de theo doi.',
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
        return 'Dang ky tai khoan';
      case 'CHECKIN_TAP_OK':
        return 'Cham de on';
      case 'MORNING_ACK':
        return 'Da xem thong bao';
      case 'STATUS_POSTED':
        return 'Dang trang thai';
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

  static String _labelForMood(Mood mood) {
    switch (mood) {
      case Mood.calm:
        return 'Binh an';
      case Mood.happy:
        return 'Tich cuc';
      case Mood.tired:
        return 'Hoi met';
      case Mood.sick:
        return 'Can luu y';
      case Mood.focused:
        return 'Dang tap trung';
    }
  }
}

DateTime? _parseDateTime(Object? value) {
  if (value is String && value.isNotEmpty) {
    return DateTime.tryParse(value);
  }
  return null;
}
