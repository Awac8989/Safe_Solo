import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AppConstants {
  static const String _defaultLanBaseUrl = 'http://192.168.1.5:4000/api';
  static const String _localhostBaseUrl = 'http://localhost:4000/api';
  static const String _defaultMapTilerStyle = 'streets-v2';

  static String _customBaseUrl = '';
  static const String customBaseUrlStorageKey = 'safesolo_custom_base_url';

  static Future<void> setCustomBaseUrl(String url) async {
    _customBaseUrl = url.trim();
    await _persistCustomBaseUrl(_customBaseUrl);
  }

  static Future<void> setHostIp(String ip, {int port = 4000}) async {
    final cleanIp = ip.trim().replaceAll('http://', '').replaceAll('https://', '').split('/')[0];
    final host = cleanIp.contains(':') ? cleanIp : '$cleanIp:$port';
    await setCustomBaseUrl('http://$host/api');
  }

  static Future<void> _persistCustomBaseUrl(String url) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (url.isEmpty) {
        await prefs.remove(customBaseUrlStorageKey);
      } else {
        await prefs.setString(customBaseUrlStorageKey, url);
      }
    } catch (_) {}
  }

  static Future<void> loadPersistedBaseUrl() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getString(customBaseUrlStorageKey);
      if (saved != null && saved.trim().isNotEmpty) {
        if (saved.contains('192.168.1.13')) {
          _customBaseUrl = saved.replaceAll('192.168.1.13', '192.168.1.5');
          await _persistCustomBaseUrl(_customBaseUrl);
        } else {
          _customBaseUrl = saved.trim();
        }
      }
    } catch (_) {}
  }

  static String get customBaseUrl => _customBaseUrl;

  static String get backendBaseUrl {
    if (_customBaseUrl.isNotEmpty) {
      return _customBaseUrl;
    }
    const overridden = String.fromEnvironment('API_BASE_URL');
    if (overridden.isNotEmpty) {
      return overridden;
    }

    if (!kIsWeb) {
      try {
        if (Platform.isAndroid) {
          return _defaultLanBaseUrl;
        }
      } catch (_) {}
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

  static String get firebaseApiKey {
    const value = String.fromEnvironment('FIREBASE_API_KEY');
    return value;
  }

  static String get firebaseAppId {
    const value = String.fromEnvironment('FIREBASE_APP_ID');
    return value;
  }

  static String get firebaseMessagingSenderId {
    const value = String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID');
    return value;
  }

  static String get firebaseProjectId {
    const value = String.fromEnvironment('FIREBASE_PROJECT_ID');
    return value;
  }

  static String get firebaseStorageBucket {
    const value = String.fromEnvironment('FIREBASE_STORAGE_BUCKET');
    return value;
  }

  static bool get hasFirebaseConfig =>
      firebaseApiKey.isNotEmpty &&
      firebaseAppId.isNotEmpty &&
      firebaseMessagingSenderId.isNotEmpty &&
      firebaseProjectId.isNotEmpty;

  static bool get firebasePushEnabled {
    const value = String.fromEnvironment('FIREBASE_PUSH_ENABLED');
    if (value.isEmpty) {
      return hasFirebaseConfig;
    }
    return value.toLowerCase() == 'true';
  }

  static String? mapTilerRasterTileUrl(int x, int y, int zoom) {
    if (!hasMapTiler) {
      return null;
    }
    return 'https://api.maptiler.com/maps/$mapTilerStyle/$zoom/$x/$y.png?key=$mapTilerApiKey';
  }
}
