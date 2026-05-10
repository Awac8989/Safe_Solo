import 'dart:async';

import 'package:geolocator/geolocator.dart';

class ResolvedLocation {
  const ResolvedLocation({
    required this.lat,
    required this.lng,
    required this.isFresh,
  });

  final double lat;
  final double lng;
  final bool isFresh;
}

class LocationService {
  static const _lookupTimeout = Duration(seconds: 6);
  static const _defaultLat = 10.7765;
  static const _defaultLng = 106.7009;

  Future<ResolvedLocation> getBestEffortLocation({
    double? fallbackLat,
    double? fallbackLng,
  }) async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return _fallbackLocation(
        fallbackLat: fallbackLat,
        fallbackLng: fallbackLng,
      );
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      return _fallbackLocation(
        fallbackLat: fallbackLat,
        fallbackLng: fallbackLng,
      );
    }

    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: _lookupTimeout,
        ),
      );

      return ResolvedLocation(
        lat: position.latitude,
        lng: position.longitude,
        isFresh: true,
      );
    } on TimeoutException {
      return _fallbackToLastKnown(
        fallbackLat: fallbackLat,
        fallbackLng: fallbackLng,
      );
    } catch (_) {
      return _fallbackToLastKnown(
        fallbackLat: fallbackLat,
        fallbackLng: fallbackLng,
      );
    }
  }

  ResolvedLocation _fallbackLocation({
    double? fallbackLat,
    double? fallbackLng,
  }) {
    return ResolvedLocation(
      lat: fallbackLat ?? _defaultLat,
      lng: fallbackLng ?? _defaultLng,
      isFresh: false,
    );
  }

  Future<ResolvedLocation> _fallbackToLastKnown({
    double? fallbackLat,
    double? fallbackLng,
  }) async {
    final lastKnown = await Geolocator.getLastKnownPosition();
    if (lastKnown != null) {
      return ResolvedLocation(
        lat: lastKnown.latitude,
        lng: lastKnown.longitude,
        isFresh: false,
      );
    }

    return _fallbackLocation(
      fallbackLat: fallbackLat,
      fallbackLng: fallbackLng,
    );
  }
}
