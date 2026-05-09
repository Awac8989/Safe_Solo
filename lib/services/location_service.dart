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

  Future<ResolvedLocation> getBestEffortLocation({
    double? fallbackLat,
    double? fallbackLng,
  }) async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      if (fallbackLat != null && fallbackLng != null) {
        return ResolvedLocation(
          lat: fallbackLat,
          lng: fallbackLng,
          isFresh: false,
        );
      }
      throw Exception('Dich vu dinh vi dang tat');
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      if (fallbackLat != null && fallbackLng != null) {
        return ResolvedLocation(
          lat: fallbackLat,
          lng: fallbackLng,
          isFresh: false,
        );
      }
      throw Exception('Khong co quyen truy cap vi tri');
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

    if (fallbackLat != null && fallbackLng != null) {
      return ResolvedLocation(
        lat: fallbackLat,
        lng: fallbackLng,
        isFresh: false,
      );
    }

    throw Exception(
      'Khong lay duoc GPS kip thoi. Hay mo vi tri tren may hoac thu lai sau.',
    );
  }
}
