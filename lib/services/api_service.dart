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

class ApiService {
  final _client = http.Client();
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
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/users/register');
    final response = await _safeRequest(
      _client.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'fullName': fullName,
          'phoneNumber': phoneNumber,
          'timerIntervalMinutes': timerIntervalMinutes,
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
    return UserModel.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
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
        headers: {'Content-Type': 'application/json'},
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
        headers: {'Content-Type': 'application/json'},
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
        headers: {'Content-Type': 'application/json'},
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
        headers: {'Content-Type': 'application/json'},
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
        headers: {'Content-Type': 'application/json'},
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
        headers: {'Content-Type': 'application/json'},
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
        headers: {'Content-Type': 'application/json'},
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
        headers: {'Content-Type': 'application/json'},
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
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'type': type,
          'source': source,
          'metadata': metadata,
        }),
      ),
    );
    _throwIfFailed(response);
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
        headers: {'Content-Type': 'application/json'},
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
        headers: {'Content-Type': 'application/json'},
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
        headers: {'Content-Type': 'application/json'},
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
        headers: {'Content-Type': 'application/json'},
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
        headers: {'Content-Type': 'application/json'},
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
        headers: {'Content-Type': 'application/json'},
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
    request.files.add(await http.MultipartFile.fromPath('front_image', frontPath));
    request.files.add(await http.MultipartFile.fromPath('back_image', backPath));

    final streamedResponse = await request.send().timeout(_timeout);
    final response = await http.Response.fromStream(streamedResponse);
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
          'Content-Type': 'application/json',
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
          'Content-Type': 'application/json',
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
          'Content-Type': 'application/json',
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
          'Content-Type': 'application/json',
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
          'Content-Type': 'application/json',
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
          'Content-Type': 'application/json',
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
            'Content-Type': 'application/json',
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
        headers: {'Content-Type': 'application/json'},
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
        headers: {'Content-Type': 'application/json'},
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
        headers: {'Content-Type': 'application/json'},
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
        headers: {'Content-Type': 'application/json'},
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
        headers: {'Content-Type': 'application/json'},
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
}
