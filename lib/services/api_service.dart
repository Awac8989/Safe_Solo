import 'dart:convert';
import 'dart:async';

import 'package:http/http.dart' as http;

import '../models/alert_policy_model.dart';
import '../models/automation_settings_model.dart';
import '../models/health_report_model.dart';
import '../models/interaction_event_model.dart';
import '../core/constants.dart';
import '../models/medical_profile_model.dart';
import '../models/security_settings_model.dart';
import '../models/user_model.dart';

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
    required double lat,
    required double lng,
  }) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/users/$userId/checkin');
    final response = await _safeRequest(
      _client.post(
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
