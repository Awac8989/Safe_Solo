import 'package:flutter/material.dart';

enum DisasterCategory {
  flooding,
  landslide,
  stormSurge,
  criticalDanger,
  roadHazard,
  other,
}

enum DisasterSeverity {
  critical,
  warning,
  advisory,
}

class DisasterAlertModel {
  const DisasterAlertModel({
    required this.id,
    required this.title,
    this.description = '',
    required this.category,
    required this.severity,
    required this.lat,
    required this.lng,
    this.radiusMeters = 2000,
    this.address = '',
    this.safetyAdvice = '',
    this.evacuationRouteTip = '',
    this.status = 'ACTIVE',
    this.issuedBy = 'Ban Điều Phối Cứu Hộ SafeSolo 115/114',
    this.broadcastCount = 1,
    this.distanceKm = 0.0,
    this.isNearby = true,
    this.imageUrl,
    required this.createdAt,
    this.resolvedAt,
  });

  final String id;
  final String title;
  final String description;
  final DisasterCategory category;
  final DisasterSeverity severity;
  final double lat;
  final double lng;
  final int radiusMeters;
  final String address;
  final String safetyAdvice;
  final String evacuationRouteTip;
  final String status;
  final String issuedBy;
  final int broadcastCount;
  final double distanceKm;
  final bool isNearby;
  final String? imageUrl;
  final DateTime createdAt;
  final DateTime? resolvedAt;

  bool get isCritical => severity == DisasterSeverity.critical;
  bool get isActive => status == 'ACTIVE';

  String get effectiveImageUrl {
    if (imageUrl != null && imageUrl!.trim().isNotEmpty) {
      return imageUrl!.trim();
    }
    switch (category) {
      case DisasterCategory.flooding:
        return 'https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=800&q=80';
      case DisasterCategory.stormSurge:
        return 'https://images.unsplash.com/photo-1527482797697-8795b05a13fe?auto=format&fit=crop&w=800&q=80';
      case DisasterCategory.landslide:
        return 'https://images.unsplash.com/photo-1578885136359-16c8bd4d3a8e?auto=format&fit=crop&w=800&q=80';
      case DisasterCategory.roadHazard:
        return 'https://images.unsplash.com/photo-1584467735815-f778f274e296?auto=format&fit=crop&w=800&q=80';
      default:
        return 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80';
    }
  }

  String get categoryLabel {
    switch (category) {
      case DisasterCategory.landslide:
        return 'Sạt lở đất đá';
      case DisasterCategory.flooding:
        return 'Ngập nước sâu';
      case DisasterCategory.stormSurge:
        return 'Bão lũ khẩn cấp';
      case DisasterCategory.criticalDanger:
        return 'Khu vực nguy hiểm';
      case DisasterCategory.roadHazard:
        return 'Sụt lún cầu đường';
      case DisasterCategory.other:
        return 'Cảnh báo khẩn';
    }
  }

  IconData get categoryIcon {
    switch (category) {
      case DisasterCategory.landslide:
        return Icons.landslide_rounded;
      case DisasterCategory.flooding:
        return Icons.water_drop_rounded;
      case DisasterCategory.stormSurge:
        return Icons.cyclone_rounded;
      case DisasterCategory.criticalDanger:
        return Icons.warning_rounded;
      case DisasterCategory.roadHazard:
        return Icons.construction_rounded;
      case DisasterCategory.other:
        return Icons.shield_rounded;
    }
  }

  Color get categoryColor {
    switch (category) {
      case DisasterCategory.landslide:
        return const Color(0xFFEF4444);
      case DisasterCategory.flooding:
        return const Color(0xFF0284C7);
      case DisasterCategory.stormSurge:
        return const Color(0xFF8B5CF6);
      case DisasterCategory.criticalDanger:
        return const Color(0xFFDC2626);
      case DisasterCategory.roadHazard:
        return const Color(0xFFF59E0B);
      case DisasterCategory.other:
        return const Color(0xFF64748B);
    }
  }

  String get severityLabel {
    switch (severity) {
      case DisasterSeverity.critical:
        return 'NGUY CẤP (BÁO ĐỘNG ĐỎ)';
      case DisasterSeverity.warning:
        return 'CẢNH BÁO (BÁO ĐỘNG VÀNG)';
      case DisasterSeverity.advisory:
        return 'KHUYẾN CÁO PHÒNG NGỪA';
    }
  }

  Color get severityColor {
    switch (severity) {
      case DisasterSeverity.critical:
        return const Color(0xFFEF4444);
      case DisasterSeverity.warning:
        return const Color(0xFFF59E0B);
      case DisasterSeverity.advisory:
        return const Color(0xFF10B981);
    }
  }

  factory DisasterAlertModel.fromJson(Map<String, dynamic> json) {
    DisasterCategory cat = DisasterCategory.other;
    final catRaw = (json['category'] as String? ?? '').toUpperCase();
    if (catRaw.contains('LANDSLIDE')) {
      cat = DisasterCategory.landslide;
    } else if (catRaw.contains('FLOOD')) {
      cat = DisasterCategory.flooding;
    } else if (catRaw.contains('STORM')) {
      cat = DisasterCategory.stormSurge;
    } else if (catRaw.contains('CRITICAL') || catRaw.contains('DANGER')) {
      cat = DisasterCategory.criticalDanger;
    } else if (catRaw.contains('ROAD')) {
      cat = DisasterCategory.roadHazard;
    }

    DisasterSeverity sev = DisasterSeverity.critical;
    final sevRaw = (json['severity'] as String? ?? '').toUpperCase();
    if (sevRaw.contains('WARN')) {
      sev = DisasterSeverity.warning;
    } else if (sevRaw.contains('ADV')) {
      sev = DisasterSeverity.advisory;
    }

    return DisasterAlertModel(
      id: json['id'] as String? ?? json['_id'] as String? ?? '',
      title: json['title'] as String? ?? 'Cảnh báo nguy hiểm',
      description: json['description'] as String? ?? '',
      category: cat,
      severity: sev,
      lat: (json['lat'] as num?)?.toDouble() ?? 10.7769,
      lng: (json['lng'] as num?)?.toDouble() ?? 106.7009,
      radiusMeters: (json['radiusMeters'] as num?)?.toInt() ?? 2000,
      address: json['address'] as String? ?? '',
      safetyAdvice: json['safetyAdvice'] as String? ?? '',
      evacuationRouteTip: json['evacuationRouteTip'] as String? ?? '',
      status: json['status'] as String? ?? 'ACTIVE',
      issuedBy: json['issuedBy'] as String? ?? 'Ban Điều Phối Cứu Hộ SafeSolo',
      broadcastCount: (json['broadcastCount'] as num?)?.toInt() ?? 1,
      distanceKm: (json['distanceKm'] as num?)?.toDouble() ?? 0.0,
      isNearby: json['isNearby'] as bool? ?? true,
      imageUrl: json['imageUrl'] as String? ?? json['image'] as String?,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
      resolvedAt: json['resolvedAt'] != null ? DateTime.tryParse(json['resolvedAt'].toString()) : null,
    );
  }
}
