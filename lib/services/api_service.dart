import 'dart:convert';
import 'dart:async';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../models/alert_policy_model.dart';
import '../models/automation_settings_model.dart';
import '../models/health_report_model.dart';
import '../models/interaction_event_model.dart';
import '../core/constants.dart';
import '../models/medical_profile_model.dart';
import '../models/security_settings_model.dart';
import '../models/user_model.dart';
import '../models/live_journey_model.dart';
import '../models/disaster_alert_model.dart';

class _ApiKeyClient extends http.BaseClient {
  final http.Client _inner;
  _ApiKeyClient(this._inner);

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) {
    if (!request.headers.containsKey('x-api-key')) {
      request.headers['x-api-key'] = 'android-app-key-abc';
    }
    return _inner.send(request);
  }
}

class ApiService {
  static final ApiService instance = ApiService();
  final _client = _ApiKeyClient(http.Client());
  static const _timeout = Duration(seconds: 12);

  Future<List<UserModel>> listUsers() async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/users');
    final response = await _safeRequest(_client.get(uri));
    _throwIfFailed(response);
    final body = jsonDecode(response.body) as List<dynamic>;
    return body
        .map(
          (item) => UserModel.fromJson(
            Map<String, dynamic>.from(item as Map),
          ),
        )
        .toList();
  }

  Future<UserModel> registerUser({
    required String fullName,
    required String phoneNumber,
    required int timerIntervalMinutes,
    required String emergencyName,
    required String emergencyPhone,
    String? email,
    String? password,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/users/register');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'fullName': fullName,
          'phoneNumber': phoneNumber,
          'timerIntervalMinutes': timerIntervalMinutes,
          if (email != null && email.isNotEmpty) 'email': email,
          if (password != null && password.isNotEmpty) 'password': password,
          'emergencyContacts': [
            {
              'name': emergencyName,
              'phone': emergencyPhone,
              'relation': 'Người thân',
            }
          ],
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return UserModel.fromJson(json);
  }

  Future<UserModel> getUserById(String userId) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/users/$userId');
    final response = await _safeRequest(_client.get(uri));
    _throwIfFailed(response);
    return UserModel.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<UserModel> updateTimer(String userId, int timerIntervalMinutes) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/users/$userId/timer');
    final response = await _safeRequest(
      _client.patch(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({'timerIntervalMinutes': timerIntervalMinutes}),
      ),
    );
    _throwIfFailed(response);
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return UserModel.fromJson(body['user'] as Map<String, dynamic>);
  }

  Future<UserModel> checkin({
    required String userId,
    double? lat,
    double? lng,
    String type = 'HARD_TAP',
    String? passiveSource,
    bool isDuress = false,
    int? snoozeMinutes,
    String? routineType,
    Map<String, dynamic>? mediaSnapshot,
    String? familyPingRef,
    Map<String, dynamic>? metadata,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/users/$userId/checkin');
    final payload = <String, dynamic>{
      'type': type,
      'isDuress': isDuress,
    };
    if (lat != null && lng != null) {
      payload['location'] = {'lat': lat, 'lng': lng};
    }
    if (passiveSource != null) payload['passiveSource'] = passiveSource;
    if (snoozeMinutes != null) payload['snoozeMinutes'] = snoozeMinutes;
    if (routineType != null) payload['routineType'] = routineType;
    if (mediaSnapshot != null) payload['mediaSnapshot'] = mediaSnapshot;
    if (familyPingRef != null) payload['familyPingRef'] = familyPingRef;
    if (metadata != null) payload['metadata'] = metadata;

    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode(payload),
      ),
    );
    _throwIfFailed(response);
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return UserModel.fromJson(body['user'] as Map<String, dynamic>);
  }

  Future<void> sendFamilyPing({
    required String userId,
    required String fromName,
    String? fromPhone,
    String? message,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/users/$userId/family-ping');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'fromName': fromName,
          'fromPhone': fromPhone ?? '',
          'message': message ?? 'Gửi cái ôm ấm áp! Bạn vẫn khỏe chứ?',
        }),
      ),
    );
    _throwIfFailed(response);
  }

  Future<UserModel> respondFamilyPing({
    required String userId,
    required String pingId,
    String? responseMessage,
    double? lat,
    double? lng,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/users/$userId/family-ping/respond');
    final payload = <String, dynamic>{
      'pingId': pingId,
      'responseMessage': responseMessage ?? 'Vẫn khỏe',
    };
    if (lat != null && lng != null) {
      payload['location'] = {'lat': lat, 'lng': lng};
    }
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode(payload),
      ),
    );
    _throwIfFailed(response);
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return UserModel.fromJson(body['user'] as Map<String, dynamic>);
  }

  Future<List<Map<String, dynamic>>> listCheckInMoments(String userId) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/users/$userId/checkin/moments');
    final response = await _safeRequest(_client.get(uri));
    _throwIfFailed(response);
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return (body['moments'] as List<dynamic>? ?? const [])
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  Future<UserModel> updateLocation({
    required String userId,
    required double lat,
    required double lng,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/users/$userId/location');
    final response = await _safeRequest(
      _client.patch(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'location': {'lat': lat, 'lng': lng}
        }),
      ),
    );
    _throwIfFailed(response);
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return UserModel.fromJson(body['user'] as Map<String, dynamic>);
  }

  Future<UserModel> updatePreferences({
    required String userId,
    required String quietHoursStart,
    required String quietHoursEnd,
    required int falseAlertGraceMinutes,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/users/$userId/preferences');
    final response = await _safeRequest(
      _client.patch(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'quietHoursStart': quietHoursStart,
          'quietHoursEnd': quietHoursEnd,
          'falseAlertGraceMinutes': falseAlertGraceMinutes,
        }),
      ),
    );
    _throwIfFailed(response);
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return UserModel.fromJson(body['user'] as Map<String, dynamic>);
  }

  Future<UserModel> setSleepMode({
    required String userId,
    required int minutes,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/users/$userId/sleep-mode');
    final response = await _safeRequest(
      _client.patch(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({'minutes': minutes}),
      ),
    );
    _throwIfFailed(response);
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return UserModel.fromJson(body['user'] as Map<String, dynamic>);
  }

  Future<AlertPolicyModel> getAlertPolicy(String userId) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/users/$userId/alert-policy');
    final response = await _safeRequest(_client.get(uri));
    _throwIfFailed(response);
    return AlertPolicyModel.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  Future<AlertPolicyModel> updateAlertPolicy({
    required String userId,
    required int level1Minutes,
    required int level2Minutes,
    required int level3Minutes,
    required bool level4Enabled,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/users/$userId/alert-policy');
    final response = await _safeRequest(
      _client.patch(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'level1Minutes': level1Minutes,
          'level2Minutes': level2Minutes,
          'level3Minutes': level3Minutes,
          'level4Enabled': level4Enabled,
        }),
      ),
    );
    _throwIfFailed(response);
    return AlertPolicyModel.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  Future<List<InteractionEventModel>> listInteractions(
    String userId, {
    int limit = 20,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/users/$userId/interactions?limit=$limit');
    final response = await _safeRequest(_client.get(uri));
    _throwIfFailed(response);
    final body = jsonDecode(response.body) as List<dynamic>;
    return body
        .map(
          (item) => InteractionEventModel.fromJson(
            Map<String, dynamic>.from(item as Map),
          ),
        )
        .toList();
  }

  Future<void> createInteraction({
    required String userId,
    required String type,
    required String source,
    Map<String, dynamic> metadata = const {},
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/users/$userId/interactions');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'type': type,
          'source': source,
          'metadata': metadata,
        }),
      ),
    );
    _throwIfFailed(response);
  }

  Future<Map<String, dynamic>> broadcastRadarSOS({
    required String incidentType,
    required double lat,
    required double lng,
    String? userId,
    int severity = 2,
    String severityLevel = 'P1_CRITICAL',
    String? approxAddress,
    String? medicalNotes,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/radar/broadcast');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'android-app-key-abc',
          if (userId != null && userId.isNotEmpty) 'x-user-id': userId,
        },
        body: jsonEncode({
          'incidentType': incidentType,
          'lat': lat,
          'lng': lng,
          'severity': severity,
          'severityLevel': severityLevel,
          if (approxAddress != null) 'approxAddress': approxAddress,
          if (medicalNotes != null) 'medicalNotes': medicalNotes,
        }),
      ),
    );
    _throwIfFailed(response);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<List<EmergencyContactModel>> listGuardians(String userId) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/users/$userId/guardians');
    final response = await _safeRequest(_client.get(uri));
    _throwIfFailed(response);
    final body = jsonDecode(response.body) as List<dynamic>;
    return body
        .map(
          (item) => EmergencyContactModel.fromJson(
            Map<String, dynamic>.from(item as Map),
          ),
        )
        .toList();
  }

  Future<List<EmergencyContactModel>> createGuardian({
    required String userId,
    required String name,
    required String phone,
    required String relation,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/users/$userId/guardians');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'name': name,
          'phone': phone,
          'relation': relation,
        }),
      ),
    );
    _throwIfFailed(response);
    final body = jsonDecode(response.body) as List<dynamic>;
    return body
        .map(
          (item) => EmergencyContactModel.fromJson(
            Map<String, dynamic>.from(item as Map),
          ),
        )
        .toList();
  }

  Future<List<EmergencyContactModel>> deleteGuardian({
    required String userId,
    required String phone,
  }) async {
    final uri = Uri.parse(
      '${AppConstants.backendBaseUrl}/users/$userId/guardians/${Uri.encodeComponent(phone)}',
    );
    final response = await _safeRequest(_client.delete(uri));
    _throwIfFailed(response);
    final body = jsonDecode(response.body) as List<dynamic>;
    return body
        .map(
          (item) => EmergencyContactModel.fromJson(
            Map<String, dynamic>.from(item as Map),
          ),
        )
        .toList();
  }

  Future<MedicalProfileModel> getMedicalProfile(String userId) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/users/$userId/medical-profile');
    final response = await _safeRequest(_client.get(uri));
    _throwIfFailed(response);
    return MedicalProfileModel.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<MedicalProfileModel> updateMedicalProfile({
    required String userId,
    required MedicalProfileModel profile,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/users/$userId/medical-profile');
    final response = await _safeRequest(
      _client.put(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode(profile.toJson()),
      ),
    );
    _throwIfFailed(response);
    return MedicalProfileModel.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<AutomationSettingsModel> getAutomationSettings(String userId) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/users/$userId/automation-settings');
    final response = await _safeRequest(_client.get(uri));
    _throwIfFailed(response);
    return AutomationSettingsModel.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<AutomationSettingsModel> updateAutomationSettings({
    required String userId,
    required AutomationSettingsModel settings,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/users/$userId/automation-settings');
    final response = await _safeRequest(
      _client.patch(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode(settings.toJson()),
      ),
    );
    _throwIfFailed(response);
    return AutomationSettingsModel.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<SecuritySettingsModel> getSecuritySettings(String userId) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/users/$userId/security-settings');
    final response = await _safeRequest(_client.get(uri));
    _throwIfFailed(response);
    return SecuritySettingsModel.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<SecuritySettingsModel> updateSecuritySettings({
    required String userId,
    required bool stealthMode,
    required int autoWipeDays,
    required bool encryptionEnabled,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/users/$userId/security-settings');
    final response = await _safeRequest(
      _client.patch(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'stealthMode': stealthMode,
          'autoWipeDays': autoWipeDays,
          'encryptionEnabled': encryptionEnabled,
        }),
      ),
    );
    _throwIfFailed(response);
    return SecuritySettingsModel.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<void> createDeviceSignal({
    required String userId,
    required String signalType,
    Map<String, dynamic> payload = const {},
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/users/$userId/device-signals');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'signalType': signalType,
          'payload': payload,
        }),
      ),
    );
    _throwIfFailed(response);
  }

  Future<void> registerPushToken({
    required String userId,
    required String pushToken,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/users/$userId/push-tokens');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'pushToken': pushToken,
        }),
      ),
    );
    _throwIfFailed(response);
  }

  Future<void> removePushToken({
    required String userId,
    required String pushToken,
  }) async {
    final uri = Uri.parse(
      '${AppConstants.backendBaseUrl}/users/$userId/push-tokens/${Uri.encodeComponent(pushToken)}',
    );
    final response = await _safeRequest(_client.delete(uri));
    _throwIfFailed(response);
  }

  Future<HealthReportModel> getHealthReport(
    String userId, {
    String period = 'month',
  }) async {
    final uri = Uri.parse(
      '${AppConstants.backendBaseUrl}/users/$userId/health-report?period=$period',
    );
    final response = await _safeRequest(_client.get(uri));
    _throwIfFailed(response);
    return HealthReportModel.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  Future<Map<String, dynamic>> uploadKycDocuments({
    required String frontPath,
    required String backPath,
    String? certificatePath,
    String? certificateNumber,
    String? issuingOrganization,
    String? certificateType,
    String? specialtyTier,
    String? professionCategory,
    String? credentialName,
    String? issuingAuthority,
    String? workingUnit,
    int? yearsOfExperience,
    List<String>? skillsList,
    String? expiryDate,
    bool? scopeOfPracticeAgreed,
    String? userId,
    String? token,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/kyc/upload');
    final request = http.MultipartRequest('POST', uri);
    if (token != null && token.isNotEmpty) {
      request.headers['Authorization'] = 'Bearer $token';
    }
    if (userId != null && userId.isNotEmpty) {
      request.headers['x-user-id'] = userId;
      request.fields['userId'] = userId;
    }
    if (professionCategory != null) request.fields['professionCategory'] = professionCategory;
    if (credentialName != null) request.fields['credentialName'] = credentialName;
    if (issuingAuthority != null) request.fields['issuingAuthority'] = issuingAuthority;
    if (workingUnit != null) request.fields['workingUnit'] = workingUnit;
    if (yearsOfExperience != null) request.fields['yearsOfExperience'] = yearsOfExperience.toString();
    if (certificateNumber != null) {
      request.fields['certificateNumber'] = certificateNumber;
      request.fields['credentialNumber'] = certificateNumber;
    }
    if (issuingOrganization != null) {
      request.fields['issuingOrganization'] = issuingOrganization;
      if (issuingAuthority == null) request.fields['issuingAuthority'] = issuingOrganization;
    }
    if (certificateType != null) request.fields['certificateType'] = certificateType;
    if (specialtyTier != null) request.fields['specialtyTier'] = specialtyTier;
    if (skillsList != null) request.fields['skillsList'] = jsonEncode(skillsList);
    if (expiryDate != null) request.fields['expiryDate'] = expiryDate;
    if (scopeOfPracticeAgreed != null) {
      request.fields['scopeOfPracticeAgreed'] = scopeOfPracticeAgreed.toString();
    }

    request.files.add(await http.MultipartFile.fromPath('front_image', frontPath));
    request.files.add(await http.MultipartFile.fromPath('back_image', backPath));
    if (certificatePath != null && certificatePath.isNotEmpty) {
      request.files.add(await http.MultipartFile.fromPath('certificate_image', certificatePath));
    }

    final streamedResponse = await request.send().timeout(_timeout);
    final response = await http.Response.fromStream(streamedResponse);
    _throwIfFailed(response);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> submitClinicalExam({
    required List<int> answers,
    required bool scopeOfPracticeAgreed,
    String? userId,
    String? token,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/kyc/exam/submit');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'android-app-key-abc',
          if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
          if (userId != null && userId.isNotEmpty) 'x-user-id': userId,
        },
        body: jsonEncode({
          'answers': answers,
          'scopeOfPracticeAgreed': scopeOfPracticeAgreed,
          if (userId != null) 'userId': userId,
        }),
      ),
    );
    _throwIfFailed(response);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getKycStatus({String? userId, String? token}) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/kyc/status');
    final response = await _safeRequest(
      _client.get(
        uri,
        headers: {
          'x-api-key': 'android-app-key-abc',
          if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
          if (userId != null && userId.isNotEmpty) 'x-user-id': userId,
        },
      ),
    );
    _throwIfFailed(response);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> postThankYouNote({
    required String heroId,
    required int rating,
    required String content,
    String? userId,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/community/heroes/$heroId/thank-you');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {
          'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc',
          if (userId != null && userId.isNotEmpty) 'x-user-id': userId,
        },
        body: jsonEncode({
          'rating': rating,
          'content': content,
        }),
      ),
    );
    _throwIfFailed(response);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  /// Báo cáo tai nạn / cấp cứu khẩn cấp cho người khác kèm ảnh TimeMark
  Future<Map<String, dynamic>> reportAccidentWithTimemark({
    required String title,
    required String description,
    required String category,
    required double lat,
    required double lng,
    required String address,
    required String severity,
    required String victimCount,
    required String victimCondition,
    String? photoPath,
    Map<String, dynamic>? timemarkMeta,
    String? userId,
    String? token,
    String? reportedByPhone,
    bool isAnonymous = false,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/community/hazards/accident-report');
    final request = http.MultipartRequest('POST', uri);
    if (token != null && token.isNotEmpty) {
      request.headers['Authorization'] = 'Bearer $token';
    }
    if (userId != null && userId.isNotEmpty) {
      request.headers['x-user-id'] = userId;
    }

    request.fields['title'] = title;
    request.fields['description'] = description;
    request.fields['category'] = category;
    request.fields['lat'] = lat.toString();
    request.fields['lng'] = lng.toString();
    request.fields['address'] = address;
    request.fields['severity'] = severity;
    request.fields['victimCount'] = victimCount;
    request.fields['victimCondition'] = victimCondition;
    request.fields['isAnonymous'] = isAnonymous.toString();
    if (reportedByPhone != null) {
      request.fields['reportedByPhone'] = reportedByPhone;
    }
    if (timemarkMeta != null) {
      request.fields['timemarkMeta'] = jsonEncode(timemarkMeta);
    }

    if (photoPath != null && photoPath.isNotEmpty && File(photoPath).existsSync()) {
      request.files.add(await http.MultipartFile.fromPath('timemark_photo', photoPath));
    }

    final streamedResponse = await request.send().timeout(_timeout);
    final response = await http.Response.fromStream(streamedResponse);
    _throwIfFailed(response);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  /// Lấy danh sách cảnh báo nguy cơ từ cộng đồng radar
  Future<List<Map<String, dynamic>>> fetchCommunityHazards({
    double? lat,
    double? lng,
    double? radiusKm,
    String? category,
  }) async {
    final queryParams = <String, String>{};
    if (lat != null) queryParams['lat'] = lat.toString();
    if (lng != null) queryParams['lng'] = lng.toString();
    if (radiusKm != null) queryParams['radiusKm'] = radiusKm.toString();
    if (category != null && category != 'ALL') queryParams['category'] = category;

    final uri = Uri.parse('${AppConstants.backendBaseUrl}/community/hazards')
        .replace(queryParameters: queryParams.isNotEmpty ? queryParams : null);
    final response = await _safeRequest(_client.get(uri));
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    final data = json['data'] as List<dynamic>? ?? [];
    return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  /// Đăng cảnh báo nguy cơ lên cộng đồng radar
  Future<Map<String, dynamic>> createCommunityHazard({
    required String title,
    String description = '',
    required String category,
    required double lat,
    required double lng,
    String address = '',
    bool isAnonymous = false,
    String? userId,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/community/hazards');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          if (userId != null && userId.isNotEmpty) 'x-user-id': userId,
        },
        body: jsonEncode({
          'title': title,
          'description': description,
          'category': category,
          'lat': lat,
          'lng': lng,
          'address': address,
          'isAnonymous': isAnonymous,
          if (userId != null) 'userId': userId,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Xác thực / giải tỏa cảnh báo nguy cơ (upvote hoặc resolve)
  Future<Map<String, dynamic>> verifyCommunityHazard(
    String hazardId, {
    required String action, // 'VERIFY' or 'RESOLVE'
    String? userId,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/community/hazards/$hazardId/verify');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          if (userId != null && userId.isNotEmpty) 'x-user-id': userId,
        },
        body: jsonEncode({
          'action': action,
          if (userId != null) 'userId': userId,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  Future<LiveJourneyModel> startJourney({
    required String userId,
    required String destinationLabel,
    required int durationMinutes,
    double? destinationLat,
    double? destinationLng,
    double? startLat,
    double? startLng,
    int? batteryLevel,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/journeys/start');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {
          'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc',
          'x-user-id': userId,
        },
        body: jsonEncode({
          'destinationLabel': destinationLabel,
          'durationMinutes': durationMinutes,
          'destinationLat': destinationLat,
          'destinationLng': destinationLng,
          'startLat': startLat,
          'startLng': startLng,
          'batteryLevel': batteryLevel,
        }),
      ),
    );
    _throwIfFailed(response);
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return LiveJourneyModel.fromJson(body['data'] as Map<String, dynamic>);
  }

  Future<LiveJourneyModel?> getActiveJourney(String userId) async {
    try {
      final uri = Uri.parse('${AppConstants.backendBaseUrl}/journeys/active');
      final response = await _safeRequest(
        _client.get(
          uri,
          headers: {'x-user-id': userId},
        ),
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        if (body['data'] != null) {
          return LiveJourneyModel.fromJson(body['data'] as Map<String, dynamic>);
        }
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<LiveJourneyModel> pingJourney({
    required String journeyId,
    required String userId,
    required double lat,
    required double lng,
    int? batteryLevel,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/journeys/$journeyId/ping');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {
          'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc',
          'x-user-id': userId,
        },
        body: jsonEncode({
          'lat': lat,
          'lng': lng,
          'batteryLevel': batteryLevel,
        }),
      ),
    );
    _throwIfFailed(response);
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return LiveJourneyModel.fromJson(body['data'] as Map<String, dynamic>);
  }

  Future<LiveJourneyModel> finishJourney({
    required String journeyId,
    required String userId,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/journeys/$journeyId/finish');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {
          'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc',
          'x-user-id': userId,
        },
      ),
    );
    _throwIfFailed(response);
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return LiveJourneyModel.fromJson(body['data'] as Map<String, dynamic>);
  }

  Future<LiveJourneyModel> extendJourney({
    required String journeyId,
    required String userId,
    int minutes = 10,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/journeys/$journeyId/extend');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {
          'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc',
          'x-user-id': userId,
        },
        body: jsonEncode({'minutes': minutes}),
      ),
    );
    _throwIfFailed(response);
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return LiveJourneyModel.fromJson(body['data'] as Map<String, dynamic>);
  }

  Future<LiveJourneyModel> cancelJourney({
    required String journeyId,
    required String userId,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/journeys/$journeyId/cancel');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {
          'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc',
          'x-user-id': userId,
        },
      ),
    );
    _throwIfFailed(response);
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return LiveJourneyModel.fromJson(body['data'] as Map<String, dynamic>);
  }

  Future<Map<String, dynamic>> uploadEmergencyEvidence({
    required String userId,
    String? incidentId,
    String? photoBase64,
    String? audioBase64,
    String? triggerSource,
    double? lat,
    double? lng,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/evidence/upload');
    try {
      final response = await _safeRequest(
        _client.post(
          uri,
          headers: {
            'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc',
            'x-user-id': userId,
          },
          body: jsonEncode({
            'incidentId': incidentId,
            'photoBase64': photoBase64,
            'audioBase64': audioBase64,
            'triggerSource': triggerSource ?? 'SOS',
            'lat': lat,
            'lng': lng,
          }),
        ),
      );
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      }
      return {'success': false, 'error': response.body};
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  Future<Map<String, dynamic>> sendTelegramOtp({required String identifier}) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/auth/telegram/send-otp');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({'identifier': identifier}),
      ),
    );
    _throwIfFailed(response);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> verifyTelegramOtp({
    required String identifier,
    required String otp,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/auth/telegram/verify-otp');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({'identifier': identifier, 'otp': otp}),
      ),
    );
    _throwIfFailed(response);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> sendGmailOtp({required String email}) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/auth/gmail/send-otp');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({'email': email}),
      ),
    );
    _throwIfFailed(response);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> verifyGmailOtp({
    required String email,
    required String otp,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/auth/verify-otp');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({'email': email, 'otp': otp}),
      ),
    );
    _throwIfFailed(response);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> loginWithGoogle({
    required String email,
    String? name,
    String? avatar,
    String? googleId,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/auth/google');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'email': email,
          'name': name ?? email.split('@').first,
          'avatar': avatar,
          'googleId': googleId,
        }),
      ),
    );
    _throwIfFailed(response);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> loginWithPassword({
    required String identifier,
    required String password,
    String? deviceName,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/auth/login-password');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'identifier': identifier,
          'password': password,
          'deviceName': deviceName ?? 'Android Device',
        }),
      ),
    );
    _throwIfFailed(response);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getOrCreateFamilyRoom(String token) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/chat/family-room');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {
          'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc',
          'Authorization': 'Bearer $token',
        },
      ),
    );
    _throwIfFailed(response);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> forgotPassword({
    required String identifier,
    String channel = 'auto',
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/auth/forgot-password');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'identifier': identifier,
          'channel': channel,
        }),
      ),
    );
    _throwIfFailed(response);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> resetPassword({
    required String identifier,
    required String resetCode,
    required String newPassword,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/auth/reset-password');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'identifier': identifier,
          'resetCode': resetCode,
          'newPassword': newPassword,
        }),
      ),
    );
    _throwIfFailed(response);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getActiveSessions({String? userId}) async {
    final query = userId != null ? '?userId=${Uri.encodeComponent(userId)}' : '';
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/auth/sessions$query');
    final response = await _safeRequest(_client.get(uri));
    _throwIfFailed(response);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> revokeOtherSessions({
    required String currentSessionId,
    String? userId,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/auth/sessions/revoke-others');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'currentSessionId': currentSessionId,
          if (userId != null) 'userId': userId,
        }),
      ),
    );
    _throwIfFailed(response);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<List<DisasterAlertModel>> getActiveDisasterAlerts({
    double? lat,
    double? lng,
  }) async {
    final queryParams = <String, String>{};
    if (lat != null && lng != null) {
      queryParams['lat'] = lat.toString();
      queryParams['lng'] = lng.toString();
    }
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/community/disaster-alerts/active')
        .replace(queryParameters: queryParams.isNotEmpty ? queryParams : null);
    try {
      final response = await _safeRequest(_client.get(uri));
      if (response.statusCode >= 200 && response.statusCode < 300) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        final list = (body['data'] as List<dynamic>? ?? const []);
        return list
            .map((item) => DisasterAlertModel.fromJson(Map<String, dynamic>.from(item as Map)))
            .toList();
      }
      return const [];
    } catch (_) {
      return const [];
    }
  }

  Future<List<Map<String, dynamic>>> fetchUserNotifications(
    String userId, {
    int page = 1,
    int limit = 30,
  }) async {
    final uri = Uri.parse(
      '${AppConstants.backendBaseUrl}/users/$userId/notifications?page=$page&limit=$limit',
    );
    try {
      final response = await _safeRequest(_client.get(uri));
      if (response.statusCode >= 200 && response.statusCode < 300) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        final list = (body['items'] as List<dynamic>? ?? const []);
        return list
            .map((item) => Map<String, dynamic>.from(item as Map))
            .toList();
      }
      return const [];
    } catch (_) {
      return const [];
    }
  }

  void _throwIfFailed(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return;
    }
    String message = 'Request failed';
    try {
      final parsed = jsonDecode(response.body) as Map<String, dynamic>;
      message = parsed['message'] as String? ?? message;
    } catch (_) {
      message = response.body;
    }
    throw Exception(message);
  }

  Future<http.Response> _safeRequest(Future<http.Response> future) async {
    try {
      return await future.timeout(_timeout);
    } on TimeoutException {
      throw Exception(
        'Không kết nối được backend. Hãy bật backend và kiểm tra API_BASE_URL (${AppConstants.backendBaseUrl}).',
      );
    } on http.ClientException {
      throw Exception(
        'Không kết nối được máy chủ. Vui lòng kiểm tra mạng hoặc API_BASE_URL (${AppConstants.backendBaseUrl}).',
      );
    }
  }

  Future<void> postRaw(String endpoint, Map<String, dynamic> body) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}$endpoint');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode(body),
      ),
    );
    _throwIfFailed(response);
  }

  Future<void> putRaw(String endpoint, Map<String, dynamic> body) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}$endpoint');
    final response = await _safeRequest(
      _client.put(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode(body),
      ),
    );
    _throwIfFailed(response);
  }

  Future<void> uploadMoment({
    required String userId,
    required String caption,
    String? mood,
    required String filePath,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/v1/moments');
    final request = http.MultipartRequest('POST', uri)
      ..headers['x-api-key'] = 'android-app-key-abc'
      ..fields['userId'] = userId
      ..fields['caption'] = caption
      ..fields['mood'] = mood ?? 'calm'
      ..files.add(await http.MultipartFile.fromPath('photo', filePath));
      
    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);
    _throwIfFailed(response);
  }

  Future<List<dynamic>> getMoments() async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/v1/moments');
    final response = await _safeRequest(
      _client.get(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
      ),
    );
    _throwIfFailed(response);
    return jsonDecode(response.body) as List<dynamic>;
  }

  /// Lấy thông tin trạng thái 4 kênh cứu hộ Omnichannel (Telegram, Zalo ZNS, SMS, Voice Call)
  Future<Map<String, dynamic>> fetchOmnichannelStatus({String? userId}) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/guardians/omnichannel/status');
    try {
      final response = await _safeRequest(
        _client.get(
          uri,
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'android-app-key-abc',
            if (userId != null && userId.isNotEmpty) 'x-user-id': userId,
          },
        ),
      );
      if (response.statusCode >= 200 && response.statusCode < 300) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        return body['data'] as Map<String, dynamic>? ?? {};
      }
      return {};
    } catch (_) {
      return {};
    }
  }

  /// Phát cảnh báo khẩn cấp đa kênh đồng thời tới toàn bộ người bảo hộ
  Future<Map<String, dynamic>> broadcastOmnichannelAlert({
    String? userId,
    required String emergencyType,
    double? lat,
    double? lng,
    String? address,
    int? heartRate,
    int? spO2,
    int? news2Score,
    String? notes,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/guardians/alert/broadcast');
    final payload = {
      'emergencyType': emergencyType,
      if (lat != null) 'lat': lat,
      if (lng != null) 'lng': lng,
      if (address != null && address.isNotEmpty) 'address': address,
      'vitals': {
        if (heartRate != null) 'heartRate': heartRate,
        if (spO2 != null) 'spO2': spO2,
        if (news2Score != null) 'news2Score': news2Score,
      },
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    };

    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'android-app-key-abc',
          if (userId != null && userId.isNotEmpty) 'x-user-id': userId,
        },
        body: jsonEncode(payload),
      ),
    );
    _throwIfFailed(response);
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return body['data'] as Map<String, dynamic>? ?? {};
  }

  /// Lấy danh sách ca cấp cứu lân cận dành cho Hiệp sĩ
  Future<List<Map<String, dynamic>>> getNearbyRadarIncidents({
    required double lat,
    required double lng,
    double radiusKm = 4.5,
    String? token,
    String? userId,
  }) async {
    final uri = Uri.parse(
      '${AppConstants.backendBaseUrl}/radar/nearby?lat=$lat&lng=$lng&radiusKm=$radiusKm',
    );
    final response = await _safeRequest(
      _client.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'android-app-key-abc',
          if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
          if (userId != null && userId.isNotEmpty) 'x-user-id': userId,
        },
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    final data = json['data'] as List<dynamic>? ?? [];
    return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  /// Hiệp sĩ bấm chấp nhận nhiệm vụ cứu nạn (Atomic Lock)
  Future<Map<String, dynamic>> acceptRadarIncident(
    String incidentId, {
    String? token,
    String? userId,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/radar/$incidentId/accept');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'android-app-key-abc',
          if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
          if (userId != null && userId.isNotEmpty) 'x-user-id': userId,
        },
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Hiệp sĩ cập nhật tọa độ di chuyển theo thời gian thực (Watchdog Telemetry)
  Future<Map<String, dynamic>> updateHeroTelemetry(
    String incidentId, {
    required double lat,
    required double lng,
    double speedKmh = 0,
    String? token,
    String? userId,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/radar/$incidentId/telemetry');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'android-app-key-abc',
          if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
          if (userId != null && userId.isNotEmpty) 'x-user-id': userId,
        },
        body: jsonEncode({
          'lat': lat,
          'lng': lng,
          'speedKmh': speedKmh,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Ghi nhận thao tác sơ cứu lâm sàng tại hiện trường (C-Spine, Garô CAT, CPR AED)
  Future<Map<String, dynamic>> recordFirstAidAction(
    String incidentId, {
    required String actionType,
    int durationSeconds = 0,
    String notes = '',
    String? token,
    String? userId,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/radar/$incidentId/first-aid');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'android-app-key-abc',
          if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
          if (userId != null && userId.isNotEmpty) 'x-user-id': userId,
        },
        body: jsonEncode({
          'actionType': actionType,
          'durationSeconds': durationSeconds,
          'notes': notes,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Bàn giao y tế SBAR cho Kíp cấp cứu 115
  Future<Map<String, dynamic>> handoffToMedical(
    String incidentId, {
    required String ambulancePlate,
    required String paramedicName,
    required String qrVerificationHash,
    String notes = '',
    String? token,
    String? userId,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/radar/$incidentId/handoff');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'android-app-key-abc',
          if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
          if (userId != null && userId.isNotEmpty) 'x-user-id': userId,
        },
        body: jsonEncode({
          'ambulancePlate': ambulancePlate,
          'paramedicName': paramedicName,
          'qrVerificationHash': qrVerificationHash,
          'notes': notes,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Lấy danh sách trạm SafePoint & Tủ AED lân cận
  Future<List<Map<String, dynamic>>> getNearbySafePoints({
    required double latitude,
    required double longitude,
    double radiusMeters = 5000,
    String? type,
  }) async {
    final queryParams = {
      'latitude': latitude.toString(),
      'longitude': longitude.toString(),
      'radiusMeters': radiusMeters.toString(),
      if (type != null && type.isNotEmpty) 'type': type,
    };
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/safepoints/nearby')
        .replace(queryParameters: queryParams);
    final response = await _safeRequest(
      _client.get(
        uri,
        headers: {'x-api-key': 'android-app-key-abc'},
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    final data = json['data'] as List<dynamic>? ?? [];
    return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  /// Tìm trạm AED tối ưu trên đường cứu hộ (Waypoint detouring)
  Future<Map<String, dynamic>?> getOptimalAedWaypoint({
    required double victimLat,
    required double victimLng,
    required double heroLat,
    required double heroLng,
  }) async {
    final queryParams = {
      'victimLat': victimLat.toString(),
      'victimLng': victimLng.toString(),
      'heroLat': heroLat.toString(),
      'heroLng': heroLng.toString(),
    };
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/safepoints/optimal-aed')
        .replace(queryParameters: queryParams);
    final response = await _safeRequest(
      _client.get(
        uri,
        headers: {'x-api-key': 'android-app-key-abc'},
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>?;
  }

  /// Tạo mã OTP TOTP mở tủ cứu hộ khẩn cấp
  Future<Map<String, dynamic>> requestSafePointUnlock(
    String safePointId, {
    required String rescuerId,
    String? incidentId,
    String? purpose,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/safepoints/$safePointId/unlock-request');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'rescuerId': rescuerId,
          if (incidentId != null) 'incidentId': incidentId,
          if (purpose != null) 'purpose': purpose,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Xác nhận đã mở tủ SafePoint thành công (chuyển trạng thái trạm sang IN_USE)
  Future<Map<String, dynamic>> confirmSafePointUnlock(
    String stationId, {
    required String unlockOtp,
    required String rescuerId,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/safepoints/$stationId/unlock-confirm');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'unlockOtp': unlockOtp,
          'rescuerId': rescuerId,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Alias fetchNearbySafePoints cho tính tương thích màn hình bản đồ cứu hộ
  Future<List<Map<String, dynamic>>> fetchNearbySafePoints({
    double lat = 10.7769,
    double lng = 106.7009,
    double radiusMeters = 50000,
    String? type,
  }) => getNearbySafePoints(
    latitude: lat,
    longitude: lng,
    radiusMeters: radiusMeters,
    type: type,
  );

  /// Alias fetchActiveBloodRelays cho điều phối máu khẩn cấp
  Future<List<Map<String, dynamic>>> fetchActiveBloodRelays() => getActiveBloodRelays();

  /// Tra cứu thẻ y tế ngoại tuyến SafeTag Tầng 1 (Public ICE)
  Future<Map<String, dynamic>> lookupSafeTagPublicIce(String tagUid) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/safetags/public-ice/$tagUid');
    final response = await _safeRequest(
      _client.get(
        uri,
        headers: {'x-api-key': 'android-app-key-abc'},
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Tra cứu danh sách lệnh điều phối máu SafeBlood khẩn cấp
  Future<List<Map<String, dynamic>>> getActiveBloodRelays({
    double? hospitalLat,
    double? hospitalLng,
  }) async {
    final queryParams = <String, String>{
      if (hospitalLat != null) 'hospitalLat': hospitalLat.toString(),
      if (hospitalLng != null) 'hospitalLng': hospitalLng.toString(),
    };
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/blood-relay/active')
        .replace(queryParameters: queryParams.isNotEmpty ? queryParams : null);
    final response = await _safeRequest(
      _client.get(
        uri,
        headers: {'x-api-key': 'android-app-key-abc'},
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    final data = json['data'] as List<dynamic>? ?? [];
    return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  /// Phát lệnh điều phối máu SafeBlood khẩn cấp
  Future<Map<String, dynamic>> createBloodRelayRequest({
    required String targetBloodGroup,
    required int unitsRequired,
    required String hospitalName,
    required String address,
    required String contactPhone,
    String urgencyLevel = 'EXTREME_IMMEDIATE',
    String? clinicalJustification,
    double? lat,
    double? lng,
    String? requestedByDoctorId,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/blood-relay/create');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'targetBloodGroup': targetBloodGroup,
          'unitsRequired': unitsRequired,
          'urgencyLevel': urgencyLevel,
          'hospitalLocation': {
            'hospitalName': hospitalName,
            'address': address,
            'contactPhone': contactPhone,
            'coordinates': [lng ?? 106.6822, lat ?? 10.7626],
          },
          'clinicalJustification': clinicalJustification ?? 'Cần máu gấp trong phẫu thuật cấp cứu ngoại viện.',
          if (requestedByDoctorId != null) 'requestedByDoctorId': requestedByDoctorId,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Hiệp sĩ nhận lệnh hiến máu khẩn cấp
  Future<Map<String, dynamic>> acceptBloodRelay(
    String requestId, {
    required String donorId,
    int? etaMinutes,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/blood-relay/$requestId/accept');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'donorId': donorId,
          if (etaMinutes != null) 'etaMinutes': etaMinutes,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Lấy danh sách chứng thư bảo hiểm pháp lý HeroShield của hiệp sĩ
  Future<List<Map<String, dynamic>>> getHeroPolicies(String heroId) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/heroshield/policies/$heroId');
    final response = await _safeRequest(
      _client.get(
        uri,
        headers: {'x-api-key': 'android-app-key-abc'},
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    final data = json['data'] as List<dynamic>? ?? [];
    return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  /// Lấy danh sách voucher bồi hoàn vật tư y tế của hiệp sĩ
  Future<List<Map<String, dynamic>>> getHeroRestockVouchers(String heroId) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/heroshield/vouchers/$heroId');
    final response = await _safeRequest(
      _client.get(
        uri,
        headers: {'x-api-key': 'android-app-key-abc'},
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    final data = json['data'] as List<dynamic>? ?? [];
    return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  /// Đổi/Kích hoạt nhận vật tư y tế bù đắp tại chuỗi nhà thuốc hoặc tủ SafePoint
  Future<Map<String, dynamic>> redeemHeroRestockVoucher(String voucherCode) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/heroshield/vouchers/$voucherCode/redeem');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json;
  }

  /// Kích hoạt còi tìm kiếm tầm gần & chớp flash máy nạn nhân (<25m) - Kịch bản 16
  Future<Map<String, dynamic>> triggerProximityBeacon(
    String incidentId, {
    String? token,
    String? userId,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/radar/$incidentId/beacon');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'android-app-key-abc',
          if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
          if (userId != null && userId.isNotEmpty) 'x-user-id': userId,
        },
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Đánh dấu Hiệp sĩ đã tiếp cận hiện trường (<25m)
  Future<Map<String, dynamic>> markArrivedAtScene(
    String incidentId, {
    String? token,
    String? userId,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/radar/$incidentId/arrive');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'android-app-key-abc',
          if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
          if (userId != null && userId.isNotEmpty) 'x-user-id': userId,
        },
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Hoàn thành ca cứu nạn & Gửi bằng chứng cấp Voucher Bồi Hoàn Vật Tư (HeroShield)
  Future<Map<String, dynamic>> completeHeroRescue({
    required String incidentId,
    required String volunteerId,
    required String ambulancePlate,
    required String doctorName,
    required String verificationHash,
    String? consumedSuppliesNote,
    String? proofImageBase64,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/heroshield/complete-mission');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'incidentId': incidentId,
          'volunteerId': volunteerId,
          'ambulancePlate': ambulancePlate,
          'doctorName': doctorName,
          'verificationHash': verificationHash,
          'consumedSuppliesNote': consumedSuppliesNote,
          'proofImageBase64': proofImageBase64,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json;
  }

  // ==================== PHÂN HỆ 22: SAFETAG OTP & PARAMEDIC BYPASS ====================

  /// Yêu cầu OTP gửi đến người bảo hộ để mở khóa hồ sơ y tế Tầng 2
  Future<Map<String, dynamic>> requestSafeTagOtp(String tagCode) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/safetags/request-otp/$tagCode');
    final response = await _safeRequest(
      _client.post(uri, headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'}),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Xác thực mã OTP mở khóa hồ sơ y tế Tầng 2
  Future<Map<String, dynamic>> verifySafeTagOtp(String tagCode, String otp) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/safetags/verify-otp/$tagCode');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({'otp': otp}),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Bác sĩ cấp cứu giải tỏa khẩn cấp trực tiếp với Chứng chỉ hành nghề (Emergency Bypass)
  Future<Map<String, dynamic>> emergencyBypassSafeTag({
    required String tagCode,
    required String paramedicLicense,
    required String clinicalJustification,
    String? emergencyIncidentId,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/safetags/emergency-bypass/$tagCode');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'paramedicLicense': paramedicLicense,
          'clinicalJustification': clinicalJustification,
          'emergencyIncidentId': emergencyIncidentId,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 23: BẢN ĐỒ CỨU HỘ LỤT LỘI & NGẬP NƯỚC ====================

  /// Định tuyến né tránh ngập lụt đô thị theo chiều sâu và loại phương tiện cứu trợ
  Future<Map<String, dynamic>> calculateFloodSafeRoute({
    required Map<String, double> origin,
    required Map<String, double> destination,
    String vehicleType = 'AMBULANCE_VAN',
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/flood/route/safe-plan');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'origin': origin,
          'destination': destination,
          'vehicleType': vehicleType,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Phát tín hiệu SOS khẩn cấp ngập lụt tầng trệt và nguy cơ giật điện
  Future<Map<String, dynamic>> triggerFloodSos({
    required String userId,
    required double lat,
    required double lng,
    int indoorWaterDepthCm = 35,
    bool electrocutionHazard = true,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/flood/sos');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'userId': userId,
          'lat': lat,
          'lng': lng,
          'indoorWaterDepthCm': indoorWaterDepthCm,
          'electrocutionHazard': electrocutionHazard,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 24: CẤP CỨU THẢM HỌA & START TRIAGE ====================

  /// Tuyên bố Tình trạng Cấp cứu Thảm họa Đa nạn nhân (MCI)
  Future<Map<String, dynamic>> declareMassCasualtyIncident({
    required String title,
    String incidentType = 'APARTMENT_FIRE',
    int initialVictimEstimate = 12,
    double lat = 10.792,
    double lng = 106.718,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/mci/declare');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'title': title,
          'incidentType': incidentType,
          'initialVictimEstimate': initialVictimEstimate,
          'lat': lat,
          'lng': lng,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Phân loại nạn nhân tại hiện trường theo chuẩn START Triage
  Future<Map<String, dynamic>> performStartTriage({
    required String mciId,
    required String victimTagId,
    bool canWalk = false,
    bool spontaneousBreathing = true,
    bool airwayRepositioned = false,
    bool breathsAfterAirwayOpen = false,
    int respiratoryRate = 22,
    double capillaryRefillSec = 1.5,
    bool radialPulsePresent = true,
    bool canFollowSimpleCommands = true,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/mci/$mciId/triage');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'assessmentData': {
            'victimTagId': victimTagId,
            'canWalk': canWalk,
            'spontaneousBreathing': spontaneousBreathing,
            'airwayRepositioned': airwayRepositioned,
            'breathsAfterAirwayOpen': breathsAfterAirwayOpen,
            'respiratoryRate': respiratoryRate,
            'capillaryRefillSec': capillaryRefillSec,
            'radialPulsePresent': radialPulsePresent,
            'canFollowSimpleCommands': canFollowSimpleCommands,
          },
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Phân bổ cân bằng tải chuyển viện nạn nhân thảm họa về các Trung tâm Chấn thương
  Future<Map<String, dynamic>> autoBalanceMciEvacuation(String mciId) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/mci/$mciId/balance-evacuation');
    final response = await _safeRequest(
      _client.post(uri, headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'}),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Giải tỏa sự cố khẩn cấp
  Future<Map<String, dynamic>> resolveIncident(String incidentId, String userId) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/resolve');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({'userId': userId}),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? json;
  }

  /// Lấy thông tin chi tiết sự cố cứu hộ
  Future<Map<String, dynamic>> getIncidentDetails(String incidentId, String userId) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId?userId=$userId');
    final response = await _safeRequest(
      _client.get(
        uri,
        headers: {'x-api-key': 'android-app-key-abc'},
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? json;
  }

  /// Lấy chứng nhận hiến máu điện tử
  Future<Map<String, dynamic>> getBloodDonorCertificate(String requestId, String donorId) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/blood-relay/requests/$requestId/donors/$donorId/certificate');
    final response = await _safeRequest(
      _client.get(
        uri,
        headers: {'x-api-key': 'android-app-key-abc'},
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? json;
  }

  /// Nộp hồ sơ yêu cầu bảo hiểm HeroShield
  Future<Map<String, dynamic>> fileHeroInsuranceClaim({
    required String policyId,
    required String claimType,
    required num estimatedLossVND,
    String? hospitalReportUrl,
    String? doctorDiagnosis,
    String? volunteerId,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/heroshield/claims');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'policyId': policyId,
          'claimType': claimType,
          'estimatedLossVND': estimatedLossVND,
          'hospitalReportUrl': hospitalReportUrl,
          'doctorDiagnosis': doctorDiagnosis,
          'volunteerId': volunteerId,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? json;
  }

  // ==================== PHÂN HỆ 25: CẤP CỨU RẮN CẮN ĐỘC (SNAKEBITE TRIAGE) ====================

  /// Ghi nhận phác đồ cấp cứu rắn cắn độc & Băng ép bất động PIT
  Future<Map<String, dynamic>> recordSnakebiteCare({
    required String incidentId,
    String biteLocation = 'Chi dưới',
    String snakeFamily = 'ELAPIDAE_NEUROTOXIC',
    bool pressureImmobilizationApplied = true,
    Map<String, dynamic>? systemicSymptoms,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/snakebite-care');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'biteLocation': biteLocation,
          'snakeFamily': snakeFamily,
          'pressureImmobilizationApplied': pressureImmobilizationApplied,
          'systemicSymptoms': systemicSymptoms ?? {},
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Định vị bệnh viện có sẵn Huyết thanh kháng nọc rắn đặc hiệu
  Future<Map<String, dynamic>> locateAntivenomHospital({
    double lat = 10.7769,
    double lng = 106.7009,
    String antivenomType = 'POLYVALENT',
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/hospitals/antivenom/locate');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({'lat': lat, 'lng': lng, 'antivenomType': antivenomType}),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 26: SƠ CỨU BỎNG NHIỆT & CÔNG THỨC PARKLAND ====================

  /// Ghi nhận phân loại bỏng, tưới nước 20p & Bù dịch Parkland
  Future<Map<String, dynamic>> recordBurnCare({
    required String incidentId,
    String burnEtiology = 'THERMAL_FLAME',
    num tbsaPercentage = 25,
    String burnDegree = 'SECOND_DEGREE_PARTIAL',
    bool waterIrrigation20MinApplied = true,
    num patientWeightKg = 60,
    bool inhalationInjurySuspected = false,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/burn-care');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'burnEtiology': burnEtiology,
          'tbsaPercentage': tbsaPercentage,
          'burnDegree': burnDegree,
          'waterIrrigation20MinApplied': waterIrrigation20MinApplied,
          'patientWeightKg': patientWeightKg,
          'inhalationInjurySuspected': inhalationInjurySuspected,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Định vị Trung tâm Cấp cứu Bỏng gần nhất
  Future<Map<String, dynamic>> locateBurnCenter({
    double lat = 10.7769,
    double lng = 106.7009,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/hospitals/burn-center/locate');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({'lat': lat, 'lng': lng}),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 27: HỘI CHỨNG VÙI LẤP & SẬP ĐỔ CÔNG TRÌNH ====================

  /// Quản lý giải phóng vùi lấp & Chống ngừng tim tái tưới máu (Crush Syndrome)
  Future<Map<String, dynamic>> manageCrushSyndrome({
    required String incidentId,
    String trappedStructure = 'Dầm bê tông sập đổ',
    String trappedMuscleGroup = 'BILATERAL_LOWER_EXTREMITIES',
    int compressionDurationMinutes = 150,
    bool ivHydrationPreExtricationStarted = true,
    bool provisionalTourniquetAppliedBeforeLifting = false,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/crush-care');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'trappedStructure': trappedStructure,
          'trappedMuscleGroup': trappedMuscleGroup,
          'compressionDurationMinutes': compressionDurationMinutes,
          'ivHydrationPreExtricationStarted': ivHydrationPreExtricationStarted,
          'provisionalTourniquetAppliedBeforeLifting': provisionalTourniquetAppliedBeforeLifting,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 28: CHẤN THƯƠNG NGỰC HỞ & TRÀN KHÍ MÀNG PHỔI ÁP LỰC ====================

  /// Cấp cứu vết thương ngực hở, Băng dán ngực van 1 chiều & Chọc kim giải áp
  Future<Map<String, dynamic>> recordChestTrauma({
    required String incidentId,
    bool hasSuckingChestWound = false,
    bool ventedChestSealApplied = false,
    bool chestSealBurped = false,
    bool tensionPneumothoraxSuspected = false,
    bool needleDecompressionPerformed = false,
    String needleInsertionSite = '2ND_ICS_MIDCLAVICULAR',
    String needleGauge = '14G',
    bool airHissDecompressionConfirmed = false,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/chest-trauma');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'hasSuckingChestWound': hasSuckingChestWound,
          'ventedChestSealApplied': ventedChestSealApplied,
          'chestSealBurped': chestSealBurped,
          'tensionPneumothoraxSuspected': tensionPneumothoraxSuspected,
          'needleDecompressionPerformed': needleDecompressionPerformed,
          'needleInsertionSite': needleInsertionSite,
          'needleGauge': needleGauge,
          'airHissDecompressionConfirmed': airHissDecompressionConfirmed,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 29: BẤT ĐỘNG CỘT SỐNG CỔ (SMR) & SỐC THẦN KINH ====================

  /// Bất động cột sống cổ theo Canadian C-Spine & Phân loại sốc thần kinh vs mất máu
  Future<Map<String, dynamic>> recordSpinalTrauma({
    required String incidentId,
    bool mechanismHighRisk = false,
    int patientAge = 35,
    bool extremityParesthesia = false,
    bool cervicalCollarApplied = false,
    String cervicalCollarSize = 'REGULAR',
    bool manualInLineStabilizationMaintained = true,
    bool logRollTechniqueUsed = true,
    bool vacuumMattressSecured = false,
    num systolicBp = 110,
    num heartRateBpm = 80,
    String skinCondition = 'WARM_DRY_PINK',
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/spinal-trauma');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'mechanismHighRisk': mechanismHighRisk,
          'patientAge': patientAge,
          'extremityParesthesia': extremityParesthesia,
          'cervicalCollarApplied': cervicalCollarApplied,
          'cervicalCollarSize': cervicalCollarSize,
          'manualInLineStabilizationMaintained': manualInLineStabilizationMaintained,
          'logRollTechniqueUsed': logRollTechniqueUsed,
          'vacuumMattressSecured': vacuumMattressSecured,
          'systolicBp': systolicBp,
          'heartRateBpm': heartRateBpm,
          'skinCondition': skinCondition,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 30: HẠ ĐƯỜNG HUYẾT NẶNG & HÔN MÊ TIỂU ĐƯỜNG ====================

  /// Cấp cứu hạ đường huyết nặng, Quy tắc 15-15 & Phác đồ tiêm bắp Glucagon khẩn cấp
  Future<Map<String, dynamic>> recordDiabeticEmergency({
    required String incidentId,
    num bloodGlucoseMmolL = 5.5,
    bool isConscious = true,
    bool swallowReflexIntact = true,
    bool ruleOf15Applied = false,
    bool glucagonOrIvDextroseAdministered = false,
    String medicationType = 'NONE',
    num? postTreatmentGlucoseMmolL,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/diabetic-emergency');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'bloodGlucoseMmolL': bloodGlucoseMmolL,
          'isConscious': isConscious,
          'swallowReflexIntact': swallowReflexIntact,
          'ruleOf15Applied': ruleOf15Applied,
          'glucagonOrIvDextroseAdministered': glucagonOrIvDextroseAdministered,
          'medicationType': medicationType,
          if (postTreatmentGlucoseMmolL != null) 'postTreatmentGlucoseMmolL': postTreatmentGlucoseMmolL,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 31: HÓC DỊ VẬT ĐƯỜNG THỞ TRẺ EM (FBAO) ====================

  /// Cấp cứu hóc dị vật đường thở trẻ em (AHA/ERC Pediatric Choking & FBAO)
  Future<Map<String, dynamic>> recordPediatricChoking({
    required String incidentId,
    num patientAgeMonths = 24,
    bool isUnconscious = false,
    bool backBlowsAndChestThrustsApplied = false,
    bool abdominalThrustsHeimlichApplied = false,
    bool foreignBodyExpelled = false,
    bool airwayClear = false,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/choking-fbao');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'patientAgeMonths': patientAgeMonths,
          'isUnconscious': isUnconscious,
          'backBlowsAndChestThrustsApplied': backBlowsAndChestThrustsApplied,
          'abdominalThrustsHeimlichApplied': abdominalThrustsHeimlichApplied,
          'foreignBodyExpelled': foreignBodyExpelled,
          'airwayClear': airwayClear,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 32: ĐỘNG KINH & CO GIẬT LIÊN TỤC ====================

  /// Cấp cứu động kinh cơn lớn & trạng thái co giật liên tục (ILAE Status Epilepticus)
  Future<Map<String, dynamic>> recordSeizureCare({
    required String incidentId,
    num seizureDurationMinutes = 2,
    bool headProtectedWithPadding = true,
    bool recoveryPositionPlacedPostIctal = false,
    bool midazolamOrDiazepamAdministered = false,
    bool convulsionCeased = false,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/seizure-care');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'seizureDurationMinutes': seizureDurationMinutes,
          'headProtectedWithPadding': headProtectedWithPadding,
          'recoveryPositionPlacedPostIctal': recoveryPositionPlacedPostIctal,
          'midazolamOrDiazepamAdministered': midazolamOrDiazepamAdministered,
          'convulsionCeased': convulsionCeased,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 33: ĐIỆN GIẬT & AN TOÀN CAO THẾ ====================

  /// Cấp cứu điện giật đô thị & an toàn hiện trường cao thế (Urban Electrical Injury & Step Potential)
  Future<Map<String, dynamic>> recordElectricalCare({
    required String incidentId,
    String voltageCategory = 'LOW_VOLTAGE_HOUSEHOLD_220V',
    bool scenePowerCutConfirmed = false,
    bool safetyCordonMaintained10Meters = false,
    bool stepPotentialHopExitUsed = false,
    String cardiacRhythmAssessed = 'UNKNOWN',
    bool aedShockDelivered = false,
    bool deepTissueBurnSuspected = false,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/electrical-care');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'voltageCategory': voltageCategory,
          'scenePowerCutConfirmed': scenePowerCutConfirmed,
          'safetyCordonMaintained10Meters': safetyCordonMaintained10Meters,
          'stepPotentialHopExitUsed': stepPotentialHopExitUsed,
          'cardiacRhythmAssessed': cardiacRhythmAssessed,
          'aedShockDelivered': aedShockDelivered,
          'deepTissueBurnSuspected': deepTissueBurnSuspected,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 34: NGỘ ĐỘC KHÍ CO & KHÓI CHÁY CHUNG CƯ ====================

  /// Cấp cứu ngộ độc khí CO & Khói cháy chung cư đô thị (CO/Cyanide Poisoning & HBOT)
  Future<Map<String, dynamic>> recordCoSmokeCare({
    required String incidentId,
    String sourceCategory = 'BUILDING_FIRE_SMOKE',
    bool sootInNarisOrOralCavity = false,
    bool highFlowOxygen100Applied = true,
    num oxygenFlowRateLpm = 15,
    num? estimatedHbCoPercent,
    bool isPregnant = false,
    bool isUnconscious = false,
    bool cyanideAntidoteAdministered = false,
    String antidoteType = 'NONE',
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/co-smoke-care');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'sourceCategory': sourceCategory,
          'sootInNarisOrOralCavity': sootInNarisOrOralCavity,
          'highFlowOxygen100Applied': highFlowOxygen100Applied,
          'oxygenFlowRateLpm': oxygenFlowRateLpm,
          if (estimatedHbCoPercent != null) 'estimatedHbCoPercent': estimatedHbCoPercent,
          'isPregnant': isPregnant,
          'isUnconscious': isUnconscious,
          'cyanideAntidoteAdministered': cyanideAntidoteAdministered,
          'antidoteType': antidoteType,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 35: CHẤN THƯƠNG MẮT & BỎNG HÓA CHẤT MẮT ====================

  /// Cấp cứu chấn thương mắt & bỏng hóa chất nhãn cầu ngoại viện (Ocular Trauma & Chemical Burns)
  Future<Map<String, dynamic>> recordOcularTraumaCare({
    required String incidentId,
    String injuryCategory = 'CHEMICAL_ALKALI_BASE',
    bool immediateIrrigationPerformed = false,
    num irrigationDurationMinutes = 20,
    num irrigationFluidVolumeMl = 1500,
    num measuredConjunctivalPh = 7.2,
    bool rigidEyeShieldApplied = false,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/ocular-trauma');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'injuryCategory': injuryCategory,
          'immediateIrrigationPerformed': immediateIrrigationPerformed,
          'irrigationDurationMinutes': irrigationDurationMinutes,
          'irrigationFluidVolumeMl': irrigationFluidVolumeMl,
          'measuredConjunctivalPh': measuredConjunctivalPh,
          'rigidEyeShieldApplied': rigidEyeShieldApplied,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 36: SƠ CỨU ĐỨT LÌA CHI & BẢO QUẢN VI PHẪU ====================

  /// Sơ cứu bẫy đứt lìa chi & bảo quản phần chi đứt rời chuẩn vi phẫu (Traumatic Amputation & Replantation)
  Future<Map<String, dynamic>> recordAmputationCare({
    required String incidentId,
    String amputationType = 'COMPLETE_AMPUTATION',
    String anatomicalPart = 'DIGIT_FINGER_TOE',
    bool stumpHemostasisApplied = true,
    String hemostasisMethod = 'PRESSURE_DRESSING',
    bool amputatedPartRetrieved = true,
    bool threeTierPreservationApplied = true,
    String ischemiaType = 'COLD_ISCHEMIA_2_TO_4C',
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/amputation-care');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'amputationType': amputationType,
          'anatomicalPart': anatomicalPart,
          'stumpHemostasisApplied': stumpHemostasisApplied,
          'hemostasisMethod': hemostasisMethod,
          'amputatedPartRetrieved': amputatedPartRetrieved,
          'threeTierPreservationApplied': threeTierPreservationApplied,
          'ischemiaType': ischemiaType,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 37: CHẤN THƯƠNG BỤNG & VỠ PHÌNH ĐM CHỦ BỤNG ====================

  /// Cấp cứu vỡ phình ĐM chủ bụng & thoát vị tạng vùng bụng (Abdominal Trauma & Ruptured AAA)
  Future<Map<String, dynamic>> recordAbdominalTraumaCare({
    required String incidentId,
    String traumaType = 'EVISCERATION_OPEN_BOWEL',
    bool sterileMoistDressingApplied = true,
    bool occlusiveMoistureBarrierApplied = true,
    bool kneesFlexedPositionMaintained = true,
    num actualSystolicBp = 85,
    bool excessiveFluidAvoided = true,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/abdominal-trauma');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'traumaType': traumaType,
          'sterileMoistDressingApplied': sterileMoistDressingApplied,
          'occlusiveMoistureBarrierApplied': occlusiveMoistureBarrierApplied,
          'kneesFlexedPositionMaintained': kneesFlexedPositionMaintained,
          'actualSystolicBp': actualSystolicBp,
          'excessiveFluidAvoided': excessiveFluidAvoided,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 38: NGỘ ĐỘC THUỐC TRỪ SÂU PHOSPHO HỮU CƠ ====================

  /// Cấp cứu ngộ độc thuốc trừ sâu phospho hữu cơ (Organophosphate Poisoning & Atropine/PAM)
  Future<Map<String, dynamic>> recordToxicologyCare({
    required String incidentId,
    String toxinCategory = 'ORGANOPHOSPHATE_INSECTICIDE',
    bool dermalDecontaminationPerformed = true,
    bool clothingSafelyDisposedInBags = true,
    bool pinpointPupilsObserved = true,
    bool bronchorrheaSecretionsSuctioned = true,
    num atropineAdministeredMg = 2,
    bool atropinizationAchieved = true,
    num pralidoximePamAdministeredGrams = 1,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/toxicology-care');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'toxinCategory': toxinCategory,
          'dermalDecontaminationPerformed': dermalDecontaminationPerformed,
          'clothingSafelyDisposedInBags': clothingSafelyDisposedInBags,
          'pinpointPupilsObserved': pinpointPupilsObserved,
          'bronchorrheaSecretionsSuctioned': bronchorrheaSecretionsSuctioned,
          'atropineAdministeredMg': atropineAdministeredMg,
          'atropinizationAchieved': atropinizationAchieved,
          'pralidoximePamAdministeredGrams': pralidoximePamAdministeredGrams,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 39: VỠ KHUNG CHẬU & ĐAI KẸP CẦM MÁU ====================

  /// Cấp cứu vỡ khung chậu nặng & đai kẹp cầm máu vùng chậu (Pelvic Ring Fracture & Binder)
  Future<Map<String, dynamic>> recordPelvicTraumaCare({
    required String incidentId,
    String fracturePattern = 'OPEN_BOOK_UNSTABLE',
    bool pelvicBinderApplied = true,
    String pelvicBinderPlacementSite = 'GREATER_TROCHANTERS_SYMPHYSIS_PUBIS',
    bool kneesAndFeetTiedTogether = true,
    bool scoopStretcherUsed = true,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/pelvic-trauma');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'fracturePattern': fracturePattern,
          'pelvicBinderApplied': pelvicBinderApplied,
          'pelvicBinderPlacementSite': pelvicBinderPlacementSite,
          'kneesAndFeetTiedTogether': kneesAndFeetTiedTogether,
          'scoopStretcherUsed': scoopStretcherUsed,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 40: CHẤN THƯƠNG SỌ NÃO & TỤT KẸT NÃO ====================

  /// Cấp cứu chấn thương sọ não nặng & tụt kẹt não (Severe TBI & Cushing Herniation)
  Future<Map<String, dynamic>> recordTbiCare({
    required String incidentId,
    num gcsScore = 7,
    num systolicBloodPressure = 175,
    num heartRateBpm = 48,
    String respiratoryPattern = 'CHEYNE_STOKES',
    num dilatedPupilDiameterMm = 5.5,
    bool headElevated30Degrees = true,
    bool controlledHyperventilationApplied = true,
    bool hypotensionHypoxiaPrevented = true,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/tbi-care');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'gcsScore': gcsScore,
          'systolicBloodPressure': systolicBloodPressure,
          'heartRateBpm': heartRateBpm,
          'respiratoryPattern': respiratoryPattern,
          'dilatedPupilDiameterMm': dilatedPupilDiameterMm,
          'headElevated30Degrees': headElevated30Degrees,
          'controlledHyperventilationApplied': controlledHyperventilationApplied,
          'hypotensionHypoxiaPrevented': hypotensionHypoxiaPrevented,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 41: SẢN PHỤ CHẤN THƯƠNG & NGỪNG TIM THAI PHỤ ====================

  /// Cấp cứu sản phụ chấn thương & ngừng tim thai phụ (Maternal Cardiac Arrest & PMCD)
  Future<Map<String, dynamic>> recordMaternalCare({
    required String incidentId,
    num gestationalAgeWeeks = 28,
    bool manualLeftUterineDisplacementApplied = true,
    num cardiacArrestDurationMinutes = 4,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/maternal-care');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'gestationalAgeWeeks': gestationalAgeWeeks,
          'manualLeftUterineDisplacementApplied': manualLeftUterineDisplacementApplied,
          'cardiacArrestDurationMinutes': cardiacArrestDurationMinutes,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 42: TAI BIẾN LẶN BIỂN & BỆNH GIẢM ÁP KHÍ NÉN ====================

  /// Cấp cứu tai biến lặn biển & bệnh giảm áp khí nén (Decompression Sickness & Caisson)
  Future<Map<String, dynamic>> recordDecompressionCare({
    required String incidentId,
    String exposureCategory = 'METRO_TUNNEL_CAISSON_WORKER',
    String symptomType = 'TYPE_2_SPINAL_PARALYSIS_CHOKES',
    bool highFlowOxygen100Applied = true,
    num oxygenFlowRateLpm = 15,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/decompression-care');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'exposureCategory': exposureCategory,
          'symptomType': symptomType,
          'highFlowOxygen100Applied': highFlowOxygen100Applied,
          'oxygenFlowRateLpm': oxygenFlowRateLpm,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 43: SỐC MẤT MÁU NẶNG & DCR / TXA CRASH-2 / MTP 1:1:1 ====================

  /// Cấp cứu sốc mất máu nặng & hồi sức kiểm soát tổn thương
  Future<Map<String, dynamic>> recordHemorrhagicShockCare({
    required String incidentId,
    String shockClass = 'CLASS_4_SEVERE_COLLAPSE',
    num estimatedBloodLossMl = 2200,
    num systolicBp = 65,
    num heartRate = 145,
    num injuryToTxaIntervalMinutes = 45,
    bool crystalloidLimitedUnder1000Ml = true,
    bool mtpProtocol111Activated = true,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/hemorrhagic-shock');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'shockClass': shockClass,
          'estimatedBloodLossMl': estimatedBloodLossMl,
          'systolicBp': systolicBp,
          'heartRate': heartRate,
          'injuryToTxaIntervalMinutes': injuryToTxaIntervalMinutes,
          'crystalloidLimitedUnder1000Ml': crystalloidLimitedUnder1000Ml,
          'mtpProtocol111Activated': mtpProtocol111Activated,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 44: HẠ THÂN NHIỆT SÂU & LÀM ẤM CHỦ ĐỘNG ====================

  /// Cấp cứu hạ thân nhiệt sâu & kỹ thuật làm ấm tích cực chống Afterdrop
  Future<Map<String, dynamic>> recordSevereHypothermiaCare({
    required String incidentId,
    num coreTemperatureCelsius = 27.5,
    bool gentleHandlingMaintained = true,
    bool activeExternalCoreRewarmingApplied = true,
    bool activeInternalRewarmingApplied = true,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/hypothermia-rewarming');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'coreTemperatureCelsius': coreTemperatureCelsius,
          'gentleHandlingMaintained': gentleHandlingMaintained,
          'activeExternalCoreRewarmingApplied': activeExternalCoreRewarmingApplied,
          'activeInternalRewarmingApplied': activeInternalRewarmingApplied,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 45: CƠN BÃO GIÁP TRẠNG & HÔN MÊ SUY GIÁP ====================

  /// Cấp cứu cơn bão giáp trạng & hôn mê suy giáp
  Future<Map<String, dynamic>> recordEndocrineCrisisCare({
    required String incidentId,
    String crisisType = 'THYROID_STORM',
    num burchWartofskyScore = 60,
    num coreTemperatureCelsius = 40.8,
    num heartRateBpm = 160,
    bool betaBlockerAdministered = true,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/endocrine-crisis');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'crisisType': crisisType,
          'burchWartofskyScore': burchWartofskyScore,
          'coreTemperatureCelsius': coreTemperatureCelsius,
          'heartRateBpm': heartRateBpm,
          'betaBlockerAdministered': betaBlockerAdministered,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 46: NGỘ ĐỘC KHÍ ĐỘC CÔNG NGHIỆP H2S & CLO ====================

  /// Cấp cứu ngộ độc khí độc công nghiệp H2S & khí Clo
  Future<Map<String, dynamic>> recordIndustrialGasCare({
    required String incidentId,
    String gasType = 'HYDROGEN_SULFIDE_H2S',
    bool rescuerHasScba = true,
    bool highFlowOxygen100Administered = true,
    String antidoteAdministered = 'SODIUM_NITRITE_300MG',
    bool upwindEvacuationMaintained = true,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/industrial-gas');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'gasType': gasType,
          'rescuerHasScba': rescuerHasScba,
          'highFlowOxygen100Administered': highFlowOxygen100Administered,
          'antidoteAdministered': antidoteAdministered,
          'upwindEvacuationMaintained': upwindEvacuationMaintained,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 47: SỐC TIM CẤP & PHÙ PHỔI CẤP HUYẾT ĐỘNG ====================

  /// Cấp cứu sốc tim cấp & phù phổi cấp Killip IV
  Future<Map<String, dynamic>> recordCardiogenicShockCare({
    required String incidentId,
    String killipClass = 'KILLIP_3_PULMONARY_EDEMA',
    num systolicBp = 160,
    bool cpapBiPapPositivePressureApplied = true,
    num cpapPressureCmH2O = 10,
    bool nitroglycerinAdministered = true,
    bool pde5InhibitorOrRvInfarctionScreened = true,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/cardiogenic-shock');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'killipClass': killipClass,
          'systolicBp': systolicBp,
          'cpapBiPapPositivePressureApplied': cpapBiPapPositivePressureApplied,
          'cpapPressureCmH2O': cpapPressureCmH2O,
          'nitroglycerinAdministered': nitroglycerinAdministered,
          'pde5InhibitorOrRvInfarctionScreened': pde5InhibitorOrRvInfarctionScreened,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 48: SỐC NHIỄM KHUẨN & GÓI GIỜ VÀNG SEPSIS ====================

  /// Cấp cứu sốc nhiễm khuẩn & gói giờ vàng Surviving Sepsis Campaign
  Future<Map<String, dynamic>> recordSepticShockCare({
    required String incidentId,
    num respiratoryRatePerMin = 28,
    num systolicBp = 85,
    num gcsScore = 13,
    num crystalloidBolusMlPerKg = 30,
    num patientWeightKg = 60,
    num lactateMmolL = 4.2,
    bool vasopressorNoradrenalineStarted = true,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/septic-shock');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'respiratoryRatePerMin': respiratoryRatePerMin,
          'systolicBp': systolicBp,
          'gcsScore': gcsScore,
          'crystalloidBolusMlPerKg': crystalloidBolusMlPerKg,
          'patientWeightKg': patientWeightKg,
          'lactateMmolL': lactateMmolL,
          'vasopressorNoradrenalineStarted': vasopressorNoradrenalineStarted,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 49: CHẤN THƯƠNG MẠCH MÁU GIÁP RANH & HỘI CHỨNG KHOANG ====================

  /// Cấp cứu chấn thương mạch máu vùng giáp ranh & phòng ngừa hội chứng khoang
  Future<Map<String, dynamic>> recordJunctionalVascularCare({
    required String incidentId,
    String injuryLocation = 'GROIN_FEMORAL',
    bool hemostaticWoundPackingApplied = true,
    bool junctionalTourniquetApplied = true,
    num directPressureDurationMinutes = 3,
    num ischemiaTimeMinutes = 45,
    bool compartmentSyndromeSuspected = true,
    bool passiveStretchPainPresent = true,
    bool elevationProhibitedIfCompartment = true,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/junctional-vascular');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'injuryLocation': injuryLocation,
          'hemostaticWoundPackingApplied': hemostaticWoundPackingApplied,
          'junctionalTourniquetApplied': junctionalTourniquetApplied,
          'directPressureDurationMinutes': directPressureDurationMinutes,
          'ischemiaTimeMinutes': ischemiaTimeMinutes,
          'compartmentSyndromeSuspected': compartmentSyndromeSuspected,
          'passiveStretchPainPresent': passiveStretchPainPresent,
          'elevationProhibitedIfCompartment': elevationProhibitedIfCompartment,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Định vị trung tâm can thiệp phẫu thuật mạch máu gần nhất
  Future<Map<String, dynamic>> locateVascularInterventionCenter({
    double lat = 10.7769,
    double lng = 106.7009,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/hospitals/vascular-intervention-center/locate');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({'lat': lat, 'lng': lng}),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 50: TĂNG THÂN NHIỆT ÁC TÍNH & HỘI CHỨNG SEROTONIN ====================

  /// Cấp cứu tăng thân nhiệt ác tính và hội chứng serotonin ngoại viện
  Future<Map<String, dynamic>> recordHyperthermiaSerotoninCare({
    required String incidentId,
    String syndromeType = 'SEROTONIN_SYNDROME',
    bool hunterCriteriaClonusPresent = true,
    bool leadPipeRigidityPresent = true,
    num coreTemperatureCelsius = 41.2,
    String antidoteAdministered = 'CYPROHEPTADINE_12MG',
    bool physicalRestraintsProhibited = true,
    bool activeExternalCoolingApplied = true,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/hyperthermia-serotonin');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'syndromeType': syndromeType,
          'hunterCriteriaClonusPresent': hunterCriteriaClonusPresent,
          'leadPipeRigidityPresent': leadPipeRigidityPresent,
          'coreTemperatureCelsius': coreTemperatureCelsius,
          'antidoteAdministered': antidoteAdministered,
          'physicalRestraintsProhibited': physicalRestraintsProhibited,
          'activeExternalCoolingApplied': activeExternalCoolingApplied,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Định vị trung tâm cấp phát thuốc giải độc Dantrolene & Chống độc gần nhất
  Future<Map<String, dynamic>> locateDantroleneCenter({
    double lat = 10.7769,
    double lng = 106.7009,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/hospitals/dantrolene-center/locate');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({'lat': lat, 'lng': lng}),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 51: HỒI SINH TIM PHỔI NGOÀI CƠ THỂ TIỀN VIỆN (ECPR) ====================

  /// Giao thức hồi sinh tim phổi ngoài cơ thể ECPR tiền viện
  Future<Map<String, dynamic>> recordEcprCare({
    required String incidentId,
    bool witnessedArrest = true,
    bool bystanderCprStartedWithin5Min = true,
    bool initialRhythmShockable = true,
    int refractoryShocksCount = 3,
    bool mechanicalCprDeviceActive = true,
    num estimatedTimeToCannulationMinutes = 42,
    bool ecprPreAlertAcknowledged = true,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/ecpr-arrest');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'witnessedArrest': witnessedArrest,
          'bystanderCprStartedWithin5Min': bystanderCprStartedWithin5Min,
          'initialRhythmShockable': initialRhythmShockable,
          'refractoryShocksCount': refractoryShocksCount,
          'mechanicalCprDeviceActive': mechanicalCprDeviceActive,
          'estimatedTimeToCannulationMinutes': estimatedTimeToCannulationMinutes,
          'ecprPreAlertAcknowledged': ecprPreAlertAcknowledged,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Định vị trung tâm tiếp nhận ECPR & ECMO khẩn cấp gần nhất
  Future<Map<String, dynamic>> locateEcprCenter({
    double lat = 10.7769,
    double lng = 106.7009,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/hospitals/ecpr-center/locate');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({'lat': lat, 'lng': lng}),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 52: CHẤN THƯƠNG CỘT SỐNG NGỰC - THẮT LƯNG & LIỆT TỦY ====================

  /// Cấp cứu chấn thương cột sống ngực - thắt lưng & phân độ ASIA
  Future<Map<String, dynamic>> recordThoracolumbarCare({
    required String incidentId,
    String asiaImpairmentScale = 'ASIA_A_COMPLETE',
    bool logRoll4PersonTechniqueApplied = true,
    bool vacuumMattressApplied = true,
    bool rigidSpineBoardRemovedWithin30Min = true,
    bool priapismOrSphincterLossDetected = false,
    bool spinalShockWatchdogActive = true,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/thoracolumbar-trauma');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'asiaImpairmentScale': asiaImpairmentScale,
          'logRoll4PersonTechniqueApplied': logRoll4PersonTechniqueApplied,
          'vacuumMattressApplied': vacuumMattressApplied,
          'rigidSpineBoardRemovedWithin30Min': rigidSpineBoardRemovedWithin30Min,
          'priapismOrSphincterLossDetected': priapismOrSphincterLossDetected,
          'spinalShockWatchdogActive': spinalShockWatchdogActive,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Định vị trung tâm phẫu thuật cột sống & hồi sức tủy cấp gần nhất
  Future<Map<String, dynamic>> locateSpineSurgeryCenter({
    double lat = 10.7769,
    double lng = 106.7009,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/hospitals/spine-center/locate');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({'lat': lat, 'lng': lng}),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 53: PHÙ NÃO & PHÙ PHỔI ĐỘ CAO (HACE & HAPE) ====================

  /// Cấp cứu phù não và phù phổi độ cao theo thang điểm Lake Louise
  Future<Map<String, dynamic>> recordHighAltitudeCare({
    required String incidentId,
    num altitudeMeters = 3143,
    num lakeLouiseScore = 5,
    bool immediateDescentStarted = true,
    num descentAltitudeMeters = 1000,
    bool gamowHyperbaricBagApplied = true,
    bool dexamethasoneAdministered = true,
    bool nifedipineAdministered = true,
    bool highFlowOxygenApplied = true,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/high-altitude');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'altitudeMeters': altitudeMeters,
          'lakeLouiseScore': lakeLouiseScore,
          'immediateDescentStarted': immediateDescentStarted,
          'descentAltitudeMeters': descentAltitudeMeters,
          'gamowHyperbaricBagApplied': gamowHyperbaricBagApplied,
          'dexamethasoneAdministered': dexamethasoneAdministered,
          'nifedipineAdministered': nifedipineAdministered,
          'highFlowOxygenApplied': highFlowOxygenApplied,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Định vị trung tâm điều trị oxy cao áp & bệnh lý độ cao gần nhất
  Future<Map<String, dynamic>> locateAltitudeCenter({
    double lat = 10.7769,
    double lng = 106.7009,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/hospitals/altitude-center/locate');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({'lat': lat, 'lng': lng}),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 54: SƠ CỨU BỎNG LẠNH & KHÍ HÓA LỎNG ====================

  /// Sơ cứu bỏng lạnh đô thị và tổn thương khí hóa lỏng nitơ/CO2
  Future<Map<String, dynamic>> recordCryogenicFrostbiteCare({
    required String incidentId,
    String frostbiteDegree = 'GRADE_2_CLEAR_BLISTER',
    num rapidRewarmingWaterTempCelsius = 38.5,
    bool frictionRubbingStrictlyProhibited = true,
    bool refreezingRiskPrevented = true,
    bool thromboxaneInhibitorIbuprofenGiven = true,
    bool aloeVeraSterileDressingApplied = true,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/cryogenic-frostbite');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'frostbiteDegree': frostbiteDegree,
          'rapidRewarmingWaterTempCelsius': rapidRewarmingWaterTempCelsius,
          'frictionRubbingStrictlyProhibited': frictionRubbingStrictlyProhibited,
          'refreezingRiskPrevented': refreezingRiskPrevented,
          'thromboxaneInhibitorIbuprofenGiven': thromboxaneInhibitorIbuprofenGiven,
          'aloeVeraSterileDressingApplied': aloeVeraSterileDressingApplied,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Định vị trung tâm bỏng lạnh & vi phẫu tạo hình gần nhất
  Future<Map<String, dynamic>> locateCryogenicCenter({
    double lat = 10.7769,
    double lng = 106.7009,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/hospitals/cryogenic-center/locate');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({'lat': lat, 'lng': lng}),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 55: VIÊM CÂN MẠC HOẠI TỬ & SỐC ĐỘC TỐ LRINEC ====================

  /// Đánh giá thang điểm LRINEC và xử trí viêm cân mạc hoại tử / TSS
  Future<Map<String, dynamic>> recordNecrotizingFasciitisCare({
    required String incidentId,
    num lrinecScore = 6,
    bool painOutOfProportion = true,
    bool subcutaneousCrepitusPresent = false,
    bool clindamycinToxinInhibitionGiven = true,
    bool emergencySurgicalDebridementAlerted = true,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/necrotizing-fasciitis');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'lrinecScore': lrinecScore,
          'painOutOfProportion': painOutOfProportion,
          'subcutaneousCrepitusPresent': subcutaneousCrepitusPresent,
          'clindamycinToxinInhibitionGiven': clindamycinToxinInhibitionGiven,
          'emergencySurgicalDebridementAlerted': emergencySurgicalDebridementAlerted,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Định vị trung tâm phẫu thuật cắt lọc viêm cân mạc hoại tử gần nhất
  Future<Map<String, dynamic>> locateNecrotizingCenter({
    double lat = 10.7769,
    double lng = 106.7009,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/hospitals/necrotizing-center/locate');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({'lat': lat, 'lng': lng}),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 56: KHỐI MÁU TỤ HỐC MẮT & MỞ GÓC MẮT NGOÀI ====================

  /// Cấp cứu khối máu tụ sau nhãn cầu và chuẩn bị mở góc mắt ngoài giải áp
  Future<Map<String, dynamic>> recordRetrobulbarHematomaCare({
    required String incidentId,
    bool rockHardProptosis = true,
    bool relativeAfferentPupillaryDefect = true,
    num intraocularPressureMmHg = 45,
    num ischemiaTimeMinutes = 35,
    bool lateralCanthotomyCantholysisPrepared = true,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/retrobulbar-hematoma');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'rockHardProptosis': rockHardProptosis,
          'relativeAfferentPupillaryDefect': relativeAfferentPupillaryDefect,
          'intraocularPressureMmHg': intraocularPressureMmHg,
          'ischemiaTimeMinutes': ischemiaTimeMinutes,
          'lateralCanthotomyCantholysisPrepared': lateralCanthotomyCantholysisPrepared,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Định vị trung tâm phẫu thuật cấp cứu mắt và giải áp hốc mắt gần nhất
  Future<Map<String, dynamic>> locateOrbitalCenter({
    double lat = 10.7769,
    double lng = 106.7009,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/hospitals/orbital-center/locate');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({'lat': lat, 'lng': lng}),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 57: NGỘ ĐỘC THUỐC TÊ & NHŨ DỊCH LIPID 20% ====================

  /// Cấp cứu ngộ độc thuốc tê toàn thân LAST và giải độc bằng nhũ dịch lipid 20%
  Future<Map<String, dynamic>> recordLastToxicityLipidCare({
    required String incidentId,
    String localAnestheticAgent = 'BUPIVACAINE',
    bool perioralNumbnessMetallicTaste = true,
    bool seizuresOrRefractoryArrhythmia = true,
    bool lipidEmulsion20PercentBolusGiven = true,
    num lipidInfusionRateMlKgMin = 0.25,
    bool vasopressinAndCalciumBlockersProhibited = true,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/last-lipid-rescue');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'localAnestheticAgent': localAnestheticAgent,
          'perioralNumbnessMetallicTaste': perioralNumbnessMetallicTaste,
          'seizuresOrRefractoryArrhythmia': seizuresOrRefractoryArrhythmia,
          'lipidEmulsion20PercentBolusGiven': lipidEmulsion20PercentBolusGiven,
          'lipidInfusionRateMlKgMin': lipidInfusionRateMlKgMin,
          'vasopressinAndCalciumBlockersProhibited': vasopressinAndCalciumBlockersProhibited,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Định vị trung tâm cấp cứu ngộ độc thuốc tê và có dự trữ Lipid 20% gần nhất
  Future<Map<String, dynamic>> locateLipidRescueCenter({
    double lat = 10.7769,
    double lng = 106.7009,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/hospitals/lipid-rescue-center/locate');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({'lat': lat, 'lng': lng}),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 58: THUYÊN TẮC PHỔI DIỆN RỘNG & TẮC MẠCH ỐI ====================

  /// Cấp cứu thuyên tắc phổi diện rộng và tắc mạch ối (Massive PE & AFE)
  Future<Map<String, dynamic>> recordMassivePulmonaryEmbolismCare({
    required String incidentId,
    num wellsScore = 6,
    bool isAmnioticFluidEmbolism = false,
    bool acuteRightHeartStrainSigns = true,
    bool systemicThrombolysisIndicated = true,
    bool cautiousFluidsUnder500Ml = true,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/massive-pulmonary-embolism');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'wellsScore': wellsScore,
          'isAmnioticFluidEmbolism': isAmnioticFluidEmbolism,
          'acuteRightHeartStrainSigns': acuteRightHeartStrainSigns,
          'systemicThrombolysisIndicated': systemicThrombolysisIndicated,
          'cautiousFluidsUnder500Ml': cautiousFluidsUnder500Ml,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Định vị trung tâm can thiệp thuyên tắc phổi & ECMO gần nhất
  Future<Map<String, dynamic>> locatePulmonaryEmbolismCenter({
    double lat = 10.7769,
    double lng = 106.7009,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/hospitals/pulmonary-embolism-center/locate');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({'lat': lat, 'lng': lng}),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 59: VỠ THỰC QUẢN BOERHAAVE & TRÀN KHÍ TRUNG THẤT ====================

  /// Cấp cứu vỡ thực quản do áp lực Boerhaave và tràn khí trung thất
  Future<Map<String, dynamic>> recordEsophagealRuptureCare({
    required String incidentId,
    bool macklerTriadPresent = true,
    bool hammanSignCrunchPresent = false,
    bool strictNpoProhibitedOralIntake = true,
    bool blindNasogastricTubeProhibited = true,
    bool broadSpectrumAntibioticsGiven = true,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/esophageal-rupture');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'macklerTriadPresent': macklerTriadPresent,
          'hammanSignCrunchPresent': hammanSignCrunchPresent,
          'strictNpoProhibitedOralIntake': strictNpoProhibitedOralIntake,
          'blindNasogastricTubeProhibited': blindNasogastricTubeProhibited,
          'broadSpectrumAntibioticsGiven': broadSpectrumAntibioticsGiven,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Định vị trung tâm phẫu thuật lồng ngực khâu vỡ thực quản gần nhất
  Future<Map<String, dynamic>> locateEsophagealCenter({
    double lat = 10.7769,
    double lng = 106.7009,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/hospitals/esophageal-center/locate');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({'lat': lat, 'lng': lng}),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  // ==================== PHÂN HỆ 60: VỠ BÀNG QUANG & ĐỨT NIỆU ĐẠO PHỨC TẠP ====================

  /// Cấp cứu vỡ bàng quang và chấn thương đứt niệu đạo tầng sinh môn
  Future<Map<String, dynamic>> recordBladderUrethralTraumaCare({
    required String incidentId,
    bool bloodAtUrethralMeatus = true,
    bool butterflyPerinealHematoma = true,
    bool blindFoleyCatheterizationStrictlyProhibited = true,
    bool retrogradeUrethrographyIndicated = true,
    bool suprapubicCystostomyPrepared = true,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/emergencies/$incidentId/bladder-urethral-trauma');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({
          'bloodAtUrethralMeatus': bloodAtUrethralMeatus,
          'butterflyPerinealHematoma': butterflyPerinealHematoma,
          'blindFoleyCatheterizationStrictlyProhibited': blindFoleyCatheterizationStrictlyProhibited,
          'retrogradeUrethrographyIndicated': retrogradeUrethrographyIndicated,
          'suprapubicCystostomyPrepared': suprapubicCystostomyPrepared,
        }),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// Định vị trung tâm phẫu thuật cấp cứu tiết niệu gần nhất
  Future<Map<String, dynamic>> locateUrologyCenter({
    double lat = 10.7769,
    double lng = 106.7009,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/hospitals/urology-center/locate');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json', 'x-api-key': 'android-app-key-abc'},
        body: jsonEncode({'lat': lat, 'lng': lng}),
      ),
    );
    _throwIfFailed(response);
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>? ?? {};
  }
}
