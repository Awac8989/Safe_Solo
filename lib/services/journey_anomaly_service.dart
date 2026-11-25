import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';

enum JourneyAnomalyPhase {
  monitoring,
  awaitingWatchConfirm,
  safeConfirmed,
  escalated,
}

enum JourneyAnomalyKind {
  none,
  routeDeviation,
  stationaryOutsideSafeZone,
}

/// ============================================================================
/// SAFESOLO - BỘ GIÁM SÁT LỆCH TUYẾN ĐƯỜNG (>300M) & ĐỨNG IM (>3 PHÚT)
/// Phối hợp Watch 5: Đẩy ping rung hỏi "Bạn ổn chứ?", chờ 30 giây phản hồi
/// Nếu quá 30s không xác nhận từ Watch 5 hoặc Điện thoại -> Leo thang TOC & SMS
/// ============================================================================
class JourneyAnomalyService extends ChangeNotifier {
  JourneyAnomalyService._();
  static final JourneyAnomalyService instance = JourneyAnomalyService._();

  @visibleForTesting
  JourneyAnomalyService.testable({DateTime Function()? clock})
      : _clock = clock ?? DateTime.now;

  DateTime Function() _clock = DateTime.now;

  static const double defaultDeviationThresholdMeters = 300.0;
  static const int defaultStationaryThresholdSeconds = 180; // 3 phút
  static const int defaultResponseTimeoutSeconds = 30; // 30 giây Watch 5
  static const double defaultStationaryRadiusMeters = 20.0;
  static const double defaultSafeDestRadiusMeters = 120.0;

  double deviationThresholdMeters = defaultDeviationThresholdMeters;
  int stationaryThresholdSeconds = defaultStationaryThresholdSeconds;
  int responseTimeoutSeconds = defaultResponseTimeoutSeconds;

  String? _journeyId;
  double? _startLat;
  double? _startLng;
  double? _destLat;
  double? _destLng;

  double? _stationaryAnchorLat;
  double? _stationaryAnchorLng;
  DateTime? _stationarySince;
  DateTime? _snoozedUntil;

  JourneyAnomalyPhase _phase = JourneyAnomalyPhase.monitoring;
  JourneyAnomalyKind _anomalyKind = JourneyAnomalyKind.none;
  String? _anomalyReason;
  double _lastDeviationMeters = 0;
  int _lastStationarySeconds = 0;
  int _confirmRemainingSeconds = 0;
  Timer? _countdownTimer;

  void Function({
    required String journeyId,
    required JourneyAnomalyKind kind,
    required String reason,
    required double deviationMeters,
    required int stationarySeconds,
  })? onTriggerWatchPrompt;

  void Function({
    required String journeyId,
    required JourneyAnomalyKind kind,
    required String reason,
    required double deviationMeters,
    required int stationarySeconds,
  })? onEscalateTimeout;

  void Function(String journeyId, String source)? onConfirmedSafe;

  // Getters
  JourneyAnomalyPhase get phase => _phase;
  JourneyAnomalyKind get anomalyKind => _anomalyKind;
  String? get anomalyReason => _anomalyReason;
  double get lastDeviationMeters => _lastDeviationMeters;
  int get lastStationarySeconds => _lastStationarySeconds;
  int get confirmRemainingSeconds => _confirmRemainingSeconds;
  bool get isAwaitingConfirm => _phase == JourneyAnomalyPhase.awaitingWatchConfirm;

  void startMonitoring({
    required String journeyId,
    required double startLat,
    required double startLng,
    double? destLat,
    double? destLng,
  }) {
    _countdownTimer?.cancel();
    _journeyId = journeyId;
    _startLat = startLat;
    _startLng = startLng;
    _destLat = destLat;
    _destLng = destLng;
    _stationaryAnchorLat = startLat;
    _stationaryAnchorLng = startLng;
    _stationarySince = _clock();
    _snoozedUntil = null;
    _phase = JourneyAnomalyPhase.monitoring;
    _anomalyKind = JourneyAnomalyKind.none;
    _anomalyReason = null;
    _lastDeviationMeters = 0;
    _lastStationarySeconds = 0;
    _confirmRemainingSeconds = 0;
    notifyListeners();
  }

  void stopMonitoring() {
    _countdownTimer?.cancel();
    _journeyId = null;
    _phase = JourneyAnomalyPhase.monitoring;
    _anomalyKind = JourneyAnomalyKind.none;
    _anomalyReason = null;
    _confirmRemainingSeconds = 0;
    notifyListeners();
  }

  static double haversineMeters(
    double lat1,
    double lng1,
    double lat2,
    double lng2,
  ) {
    const earthRadiusMeters = 6371000.0;
    double toRad(double deg) => deg * (math.pi / 180.0);
    final dLat = toRad(lat2 - lat1);
    final dLng = toRad(lng2 - lng1);
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(toRad(lat1)) *
            math.cos(toRad(lat2)) *
            math.sin(dLng / 2) *
            math.sin(dLng / 2);
    final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
    return earthRadiusMeters * c;
  }

  static double crossTrackDistanceMeters({
    required double lat,
    required double lng,
    required double startLat,
    required double startLng,
    required double destLat,
    required double destLng,
  }) {
    final segLen = haversineMeters(startLat, startLng, destLat, destLng);
    if (segLen < 30.0) {
      return haversineMeters(lat, lng, destLat, destLng);
    }
    final midLatRad = ((startLat + destLat) / 2.0) * (math.pi / 180.0);
    const mPerDegLat = 111320.0;
    final mPerDegLng = 111320.0 * math.cos(midLatRad);

    final bx = (destLng - startLng) * mPerDegLng;
    final by = (destLat - startLat) * mPerDegLat;
    final px = (lng - startLng) * mPerDegLng;
    final py = (lat - startLat) * mPerDegLat;

    final ab2 = bx * bx + by * by;
    if (ab2 <= 1e-6) return math.sqrt(px * px + py * py);
    final t = ((px * bx + py * by) / ab2).clamp(0.0, 1.0);
    final projX = t * bx;
    final projY = t * by;
    final dx = px - projX;
    final dy = py - projY;
    return math.sqrt(dx * dx + dy * dy);
  }

  /// Nạp tọa độ GPS mới trong hành trình và kiểm tra 2 điều kiện bất thường
  void ingestPosition({
    required double lat,
    required double lng,
    DateTime? timestamp,
    bool startCountdownTimer = true,
  }) {
    final jId = _journeyId;
    if (jId == null || _phase == JourneyAnomalyPhase.escalated) return;

    final now = timestamp ?? _clock();

    if (_startLat == null || _startLng == null) {
      _startLat = lat;
      _startLng = lng;
    }

    // Trong 3 phút cooldown sau khi vừa xác nhận an toàn
    if (_snoozedUntil != null && now.isBefore(_snoozedUntil!)) {
      _stationaryAnchorLat = lat;
      _stationaryAnchorLng = lng;
      _stationarySince = now;
      return;
    }

    // Nếu đang chờ phản hồi Watch 5 30s -> kiểm tra quá hạn nếu test dùng fake clock
    if (_phase == JourneyAnomalyPhase.awaitingWatchConfirm) {
      return;
    }

    final hasDest = _destLat != null && _destLng != null;
    final distToDest = hasDest
        ? haversineMeters(lat, lng, _destLat!, _destLng!)
        : 99999.0;

    // 1. Kiểm tra Lệch tuyến đường > 300m
    if (hasDest) {
      _lastDeviationMeters = crossTrackDistanceMeters(
        lat: lat,
        lng: lng,
        startLat: _startLat!,
        startLng: _startLng!,
        destLat: _destLat!,
        destLng: _destLng!,
      );
      if (_lastDeviationMeters > deviationThresholdMeters) {
        _triggerWatchPrompt(
          journeyId: jId,
          kind: JourneyAnomalyKind.routeDeviation,
          reason:
              'Lệch khỏi lộ trình dự kiến ${_lastDeviationMeters.round()}m (> ${deviationThresholdMeters.round()}m)',
          deviationMeters: _lastDeviationMeters,
          stationarySeconds: 0,
          startCountdownTimer: startCountdownTimer,
        );
        return;
      }
    }

    // 2. Kiểm tra Đứng im > 3 phút (180s) ngoài vùng an toàn đích
    if (_stationaryAnchorLat == null || _stationaryAnchorLng == null) {
      _stationaryAnchorLat = lat;
      _stationaryAnchorLng = lng;
      _stationarySince = now;
      return;
    }

    final movedMeters = haversineMeters(
      _stationaryAnchorLat!,
      _stationaryAnchorLng!,
      lat,
      lng,
    );
    if (movedMeters <= defaultStationaryRadiusMeters &&
        distToDest > defaultSafeDestRadiusMeters) {
      final elapsed = now.difference(_stationarySince ?? now).inSeconds;
      _lastStationarySeconds = elapsed;
      if (elapsed >= stationaryThresholdSeconds) {
        _triggerWatchPrompt(
          journeyId: jId,
          kind: JourneyAnomalyKind.stationaryOutsideSafeZone,
          reason:
              'Đứng im ngoài vùng an toàn ${(elapsed / 60).toStringAsFixed(1)} phút (> 3 phút)',
          deviationMeters: _lastDeviationMeters,
          stationarySeconds: elapsed,
          startCountdownTimer: startCountdownTimer,
        );
      }
    } else {
      _stationaryAnchorLat = lat;
      _stationaryAnchorLng = lng;
      _stationarySince = now;
      _lastStationarySeconds = 0;
    }
  }

  void _triggerWatchPrompt({
    required String journeyId,
    required JourneyAnomalyKind kind,
    required String reason,
    required double deviationMeters,
    required int stationarySeconds,
    required bool startCountdownTimer,
  }) {
    _phase = JourneyAnomalyPhase.awaitingWatchConfirm;
    _anomalyKind = kind;
    _anomalyReason = reason;
    _confirmRemainingSeconds = responseTimeoutSeconds;
    notifyListeners();

    onTriggerWatchPrompt?.call(
      journeyId: journeyId,
      kind: kind,
      reason: reason,
      deviationMeters: deviationMeters,
      stationarySeconds: stationarySeconds,
    );

    if (startCountdownTimer) {
      _countdownTimer?.cancel();
      _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
        if (_phase != JourneyAnomalyPhase.awaitingWatchConfirm) {
          timer.cancel();
          return;
        }
        if (_confirmRemainingSeconds > 1) {
          _confirmRemainingSeconds--;
          notifyListeners();
        } else {
          timer.cancel();
          escalateNow();
        }
      });
    }
  }

  /// Người dùng bấm "Tôi ổn" trên Galaxy Watch 5 hoặc Điện thoại trong 30 giây
  void confirmWellbeing({String source = 'WATCH_5'}) {
    final jId = _journeyId;
    _countdownTimer?.cancel();
    _confirmRemainingSeconds = 0;
    _phase = JourneyAnomalyPhase.safeConfirmed;
    _snoozedUntil = _clock().add(const Duration(minutes: 3));
    _stationarySince = _clock();
    _lastStationarySeconds = 0;
    notifyListeners();
    if (jId != null) {
      onConfirmedSafe?.call(jId, source);
    }
  }

  /// Quá 30s không xác nhận -> Tự động leo thang cảnh báo TOC & người thân
  void escalateNow() {
    final jId = _journeyId;
    _countdownTimer?.cancel();
    _confirmRemainingSeconds = 0;
    _phase = JourneyAnomalyPhase.escalated;
    notifyListeners();
    if (jId != null) {
      onEscalateTimeout?.call(
        journeyId: jId,
        kind: _anomalyKind,
        reason: _anomalyReason ?? 'Lệch tuyến / Đứng im không phản hồi sau 30s',
        deviationMeters: _lastDeviationMeters,
        stationarySeconds: _lastStationarySeconds,
      );
    }
  }

  @visibleForTesting
  void resetForTesting() {
    stopMonitoring();
    _startLat = null;
    _startLng = null;
    _destLat = null;
    _destLng = null;
    deviationThresholdMeters = defaultDeviationThresholdMeters;
    stationaryThresholdSeconds = defaultStationaryThresholdSeconds;
    responseTimeoutSeconds = defaultResponseTimeoutSeconds;
  }
}
