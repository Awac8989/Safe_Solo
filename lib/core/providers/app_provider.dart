import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum Mood { happy, ok, sick }

class User {
  final String name;
  final String email;

  User({required this.name, required this.email});

  Map<String, dynamic> toJson() => {'name': name, 'email': email};

  factory User.fromJson(Map<String, dynamic> json) =>
      User(name: json['name'], email: json['email']);
}

class MedicalId {
  String fullName;
  String birthYear;
  String bloodType;
  String allergies;
  String conditions;
  String medications;
  String emergencyPhone;

  MedicalId({
    this.fullName = '',
    this.birthYear = '',
    this.bloodType = 'O+',
    this.allergies = '',
    this.conditions = '',
    this.medications = '',
    this.emergencyPhone = '',
  });

  Map<String, dynamic> toJson() => {
        'fullName': fullName,
        'birthYear': birthYear,
        'bloodType': bloodType,
        'allergies': allergies,
        'conditions': conditions,
        'medications': medications,
        'emergencyPhone': emergencyPhone,
      };

  factory MedicalId.fromJson(Map<String, dynamic> json) => MedicalId(
        fullName: json['fullName'] ?? '',
        birthYear: json['birthYear'] ?? '',
        bloodType: json['bloodType'] ?? 'O+',
        allergies: json['allergies'] ?? '',
        conditions: json['conditions'] ?? '',
        medications: json['medications'] ?? '',
        emergencyPhone: json['emergencyPhone'] ?? '',
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
    this.shakeSos = false,
    this.shakeSensitivity = 3,
    this.fallDetection = false,
    this.geofenceAutoCheckin = false,
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
        shakeSos: json['shakeSos'] ?? false,
        shakeSensitivity: json['shakeSensitivity'] ?? 3,
        fallDetection: json['fallDetection'] ?? false,
        geofenceAutoCheckin: json['geofenceAutoCheckin'] ?? false,
        pillReminder: json['pillReminder'] ?? false,
        pillTime: json['pillTime'] ?? '08:00',
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
        realPin: json['realPin'] ?? '',
        duressPin: json['duressPin'] ?? '',
        stealthMode: json['stealthMode'] ?? false,
        autoWipeDays: json['autoWipeDays'] ?? 0,
      );
}

class AppProvider with ChangeNotifier {
  // Core state
  User? _user;
  bool _onboarded = false;
  bool _permissionsGranted = false;
  int _lastCheckIn = DateTime.now().millisecondsSinceEpoch;
  int _graceHours = 24;
  int _streak = 12;
  Mood? _mood;
  int? _vacationUntil;
  bool _highContrast = false;
  MedicalId _medical = MedicalId();
  Automation _automation = Automation();
  Security _security = Security();
  List<String> _badges = [];

  // Getters
  User? get user => _user;
  bool get onboarded => _onboarded;
  bool get permissionsGranted => _permissionsGranted;
  int get lastCheckIn => _lastCheckIn;
  int get graceHours => _graceHours;
  int get streak => _streak;
  Mood? get mood => _mood;
  int? get vacationUntil => _vacationUntil;
  bool get highContrast => _highContrast;
  MedicalId get medical => _medical;
  Automation get automation => _automation;
  Security get security => _security;
  List<String> get badges => _badges;

  bool get isVacation => _vacationUntil != null && _vacationUntil! > DateTime.now().millisecondsSinceEpoch;

  // Constructor - load from storage
  AppProvider() {
    _loadFromStorage();
  }

  Future<void> _loadFromStorage() async {
    final prefs = await SharedPreferences.getInstance();
    final data = prefs.getString('safesolo_state_v2');
    if (data != null) {
      try {
        final json = Map<String, dynamic>.from(data as Map);
        _user = json['user'] != null ? User.fromJson(json['user']) : null;
        _onboarded = json['onboarded'] ?? false;
        _permissionsGranted = json['permissionsGranted'] ?? false;
        _lastCheckIn = json['lastCheckIn'] ?? DateTime.now().millisecondsSinceEpoch;
        _graceHours = json['graceHours'] ?? 24;
        _streak = json['streak'] ?? 12;
        _mood = json['mood'] != null ? Mood.values[json['mood']] : null;
        _vacationUntil = json['vacationUntil'];
        _highContrast = json['highContrast'] ?? false;
        _medical = MedicalId.fromJson(json['medical'] ?? {});
        _automation = Automation.fromJson(json['automation'] ?? {});
        _security = Security.fromJson(json['security'] ?? {});
        _badges = List<String>.from(json['badges'] ?? []);
        notifyListeners();
      } catch (e) {
        debugPrint('Error loading app state: $e');
      }
    }
  }

  Future<void> _saveToStorage() async {
    final prefs = await SharedPreferences.getInstance();
    final data = {
      'user': _user?.toJson(),
      'onboarded': _onboarded,
      'permissionsGranted': _permissionsGranted,
      'lastCheckIn': _lastCheckIn,
      'graceHours': _graceHours,
      'streak': _streak,
      'mood': _mood?.index,
      'vacationUntil': _vacationUntil,
      'highContrast': _highContrast,
      'medical': _medical.toJson(),
      'automation': _automation.toJson(),
      'security': _security.toJson(),
      'badges': _badges,
    };
    await prefs.setString('safesolo_state_v2', data.toString());
  }

  // Actions
  void signIn(String email, {String? name}) {
    _user = User(
      email: email,
      name: name ?? email.split('@')[0].replaceAll('.', ' '),
    );
    _saveToStorage();
    notifyListeners();
  }

  void signOut() {
    _user = null;
    _saveToStorage();
    notifyListeners();
  }

  void completeOnboarding() {
    _onboarded = true;
    _saveToStorage();
    notifyListeners();
  }

  void grantPermissions() {
    _permissionsGranted = true;
    _saveToStorage();
    notifyListeners();
  }

  void checkIn({Mood? mood}) {
    _lastCheckIn = DateTime.now().millisecondsSinceEpoch;
    _streak += 1;
    if (mood != null) {
      _mood = mood;
    }
    _updateBadges();
    _saveToStorage();
    notifyListeners();
  }

  void setGraceHours(int hours) {
    _graceHours = hours;
    _saveToStorage();
    notifyListeners();
  }

  void setMood(Mood? mood) {
    _mood = mood;
    _saveToStorage();
    notifyListeners();
  }

  void startVacation(int days) {
    _vacationUntil = DateTime.now().add(Duration(days: days)).millisecondsSinceEpoch;
    _saveToStorage();
    notifyListeners();
  }

  void endVacation() {
    _vacationUntil = null;
    _saveToStorage();
    notifyListeners();
  }

  void setHighContrast(bool enabled) {
    _highContrast = enabled;
    _saveToStorage();
    notifyListeners();
  }

  void setMedical(MedicalId medical) {
    _medical = medical;
    _updateBadges();
    _saveToStorage();
    notifyListeners();
  }

  void setAutomation(Automation automation) {
    _automation = automation;
    _updateBadges();
    _saveToStorage();
    notifyListeners();
  }

  void setSecurity(Security security) {
    _security = security;
    _updateBadges();
    _saveToStorage();
    notifyListeners();
  }

  void _updateBadges() {
    final newBadges = <String>[];
    if (_streak >= 7) newBadges.add('streak7');
    if (_streak >= 30) newBadges.add('streak30');
    if (_streak >= 100) newBadges.add('streak100');
    if (_medical.bloodType.isNotEmpty && _medical.allergies.isNotEmpty && _medical.emergencyPhone.isNotEmpty) {
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
}