import 'package:flutter/foundation.dart';

class AppConstants {
  static const String _androidEmulatorBaseUrl = 'http://10.0.2.2:4000/api';
  static const String _localhostBaseUrl = 'http://localhost:4000/api';

  static String get backendBaseUrl {
    const overridden = String.fromEnvironment('API_BASE_URL');
    if (overridden.isNotEmpty) {
      return overridden;
    }

    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return _androidEmulatorBaseUrl;
    }

    return _localhostBaseUrl;
  }

  static const String userIdStorageKey = 'safesolo_user_id';
}