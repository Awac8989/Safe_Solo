import 'package:flutter/foundation.dart';

class AppConstants {
  static const String _androidEmulatorBaseUrl = 'http://10.0.2.2:4000/api';
  static const String _localhostBaseUrl = 'http://localhost:4000/api';
  static const String _defaultMapTilerStyle = 'streets-v2';

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

  static String get mapTilerApiKey {
    const value = String.fromEnvironment('MAPTILER_API_KEY');
    return value;
  }

  static String get mapTilerStyle {
    const value = String.fromEnvironment('MAPTILER_STYLE');
    return value.isNotEmpty ? value : _defaultMapTilerStyle;
  }

  static bool get hasMapTiler => mapTilerApiKey.isNotEmpty;

  static String? mapTilerRasterTileUrl(int x, int y, int zoom) {
    if (!hasMapTiler) {
      return null;
    }
    return 'https://api.maptiler.com/maps/$mapTilerStyle/$zoom/$x/$y.png?key=$mapTilerApiKey';
  }
}
