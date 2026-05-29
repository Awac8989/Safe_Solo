import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../core/constants.dart';
import 'api_service.dart';
import 'notification_service.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    if (AppConstants.hasFirebaseConfig) {
      await Firebase.initializeApp(
        options: FirebaseOptions(
          apiKey: AppConstants.firebaseApiKey,
          appId: AppConstants.firebaseAppId,
          messagingSenderId: AppConstants.firebaseMessagingSenderId,
          projectId: AppConstants.firebaseProjectId,
          storageBucket: AppConstants.firebaseStorageBucket.isNotEmpty
              ? AppConstants.firebaseStorageBucket
              : null,
        ),
      );
    }
  } catch (_) {
    // No-op. Background handler should never crash the isolate.
  }
}

class PushNotificationService {
  PushNotificationService._();

  static final PushNotificationService instance = PushNotificationService._();

  final ApiService _api = ApiService();
  StreamSubscription<String>? _tokenRefreshSubscription;
  StreamSubscription<RemoteMessage>? _foregroundMessageSubscription;
  String? _currentToken;
  bool _initialized = false;

  FirebaseMessaging get _messaging => FirebaseMessaging.instance;

  bool get isConfigured => AppConstants.firebasePushEnabled;

  Future<bool> initialize() async {
    if (!isConfigured) {
      return false;
    }

    try {
      if (!_initialized) {
        await Firebase.initializeApp(
          options: FirebaseOptions(
            apiKey: AppConstants.firebaseApiKey,
            appId: AppConstants.firebaseAppId,
            messagingSenderId: AppConstants.firebaseMessagingSenderId,
            projectId: AppConstants.firebaseProjectId,
            storageBucket: AppConstants.firebaseStorageBucket.isNotEmpty
                ? AppConstants.firebaseStorageBucket
                : null,
          ),
        );

        await _messaging.requestPermission(
          alert: true,
          announcement: false,
          badge: true,
          carPlay: false,
          criticalAlert: false,
          provisional: false,
          sound: true,
        );

        await NotificationService.instance.initialize();

        _foregroundMessageSubscription ??= FirebaseMessaging.onMessage.listen(
          (message) {
            unawaited(NotificationService.instance.showRemoteMessage(message));
          },
        );

        _tokenRefreshSubscription ??= _messaging.onTokenRefresh.listen((token) {
          _currentToken = token;
        });

        FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
        _initialized = true;
      }

      _currentToken ??= await _messaging.getToken();
      return _currentToken?.isNotEmpty == true;
    } catch (error) {
      if (kDebugMode) {
        debugPrint('Firebase push init skipped: $error');
      }
      return false;
    }
  }

  Future<String?> getToken() async {
    try {
      await initialize();
      _currentToken ??= await _messaging.getToken();
      return _currentToken;
    } catch (_) {
      return null;
    }
  }

  Future<void> syncTokenForUser(String? userId) async {
    if (userId == null || userId.isEmpty || !isConfigured) {
      return;
    }

    final token = await getToken();
    if (token == null || token.isEmpty) {
      return;
    }

    try {
      await _api.registerPushToken(userId: userId, pushToken: token);
    } catch (error) {
      if (kDebugMode) {
        debugPrint('Push token sync failed: $error');
      }
    }
  }

  Future<void> removeTokenForUser(String? userId) async {
    if (userId == null || userId.isEmpty || !isConfigured) {
      return;
    }

    final token = _currentToken ?? await _messaging.getToken();
    if (token == null || token.isEmpty) {
      return;
    }

    try {
      await _api.removePushToken(userId: userId, pushToken: token);
    } catch (error) {
      if (kDebugMode) {
        debugPrint('Push token remove failed: $error');
      }
    }
  }

  Future<void> dispose() async {
    await _tokenRefreshSubscription?.cancel();
    _tokenRefreshSubscription = null;
    await _foregroundMessageSubscription?.cancel();
    _foregroundMessageSubscription = null;
  }
}
