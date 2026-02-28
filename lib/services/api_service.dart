import 'dart:convert';
import 'dart:async';

import 'package:http/http.dart' as http;

import '../core/constants.dart';
import '../models/user_model.dart';

class ApiService {
  final _client = http.Client();
  static const _timeout = Duration(seconds: 12);

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
              'relation': 'Nguoi than',
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
        'Khong ket noi duoc backend. Hay bat backend va kiem tra API_BASE_URL (${AppConstants.backendBaseUrl}).',
      );
    } on http.ClientException {
      throw Exception(
        'Khong ket noi duoc may chu. Vui long kiem tra mang hoac API_BASE_URL (${AppConstants.backendBaseUrl}).',
      );
    }
  }
}