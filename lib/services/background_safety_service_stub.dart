class BackgroundSafetyService {
  BackgroundSafetyService._();

  static final BackgroundSafetyService instance = BackgroundSafetyService._();

  Future<void> prepare() async {}

  Future<void> updateFromState({
    required String? userId,
    required bool permissionsGranted,
    required bool appVisible,
    required bool enabled,
    required Map<String, dynamic> automation,
    Map<String, dynamic>? homeAnchor,
    required String languageCode,
  }) async {}

  Future<void> stop() async {}
}
