import 'package:flutter/material.dart';
import '../core/app_theme.dart';

enum HazardCategory {
  darkRoad,
  suspiciousPerson,
  roadHazard,
  flooding,
  landslide,
  accident,
  other,
}

class HazardReportModel {
  const HazardReportModel({
    required this.id,
    required this.authorName,
    required this.title,
    this.description = '',
    required this.category,
    required this.lat,
    required this.lng,
    this.address = '',
    this.distanceKm = 0.5,
    this.confirmCount = 1,
    this.resolvedCount = 0,
    required this.createdAt,
    this.isAnonymous = false,
    this.isAdminBroadcast = false,
    this.severity = 'P2_URGENT',
  });

  final String id;
  final String authorName;
  final String title;
  final String description;
  final HazardCategory category;
  final double lat;
  final double lng;
  final String address;
  final double distanceKm;
  final int confirmCount;
  final int resolvedCount;
  final DateTime createdAt;
  final bool isAnonymous;
  final bool isAdminBroadcast;
  final String severity;

  String get categoryLabel {
    switch (category) {
      case HazardCategory.darkRoad:
        return 'Đoạn đường tối';
      case HazardCategory.suspiciousPerson:
        return 'Đối tượng khả nghi';
      case HazardCategory.roadHazard:
        return 'Ổ gà / Thi công';
      case HazardCategory.flooding:
        return 'Ngập nước sâu';
      case HazardCategory.landslide:
        return 'Sạt lở đất đá';
      case HazardCategory.accident:
        return 'Sự cố va chạm';
      case HazardCategory.other:
        return 'Cảnh báo khác';
    }
  }

  IconData get categoryIcon {
    switch (category) {
      case HazardCategory.darkRoad:
        return Icons.nightlight_round;
      case HazardCategory.suspiciousPerson:
        return Icons.visibility_outlined;
      case HazardCategory.roadHazard:
        return Icons.construction_rounded;
      case HazardCategory.flooding:
        return Icons.water_drop_rounded;
      case HazardCategory.landslide:
        return Icons.landslide_rounded;
      case HazardCategory.accident:
        return Icons.car_crash_rounded;
      case HazardCategory.other:
        return Icons.warning_amber_rounded;
    }
  }

  Color get categoryColor {
    switch (category) {
      case HazardCategory.darkRoad:
        return const Color(0xFF6366F1);
      case HazardCategory.suspiciousPerson:
        return AppColors.destructive;
      case HazardCategory.roadHazard:
        return AppColors.warning;
      case HazardCategory.flooding:
        return const Color(0xFF0284C7);
      case HazardCategory.landslide:
        return const Color(0xFFDC2626);
      case HazardCategory.accident:
        return AppColors.destructive;
      case HazardCategory.other:
        return AppColors.textSecondary;
    }
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'authorName': authorName,
    'title': title,
    'description': description,
    'category': category.name,
    'lat': lat,
    'lng': lng,
    'address': address,
    'distanceKm': distanceKm,
    'confirmCount': confirmCount,
    'resolvedCount': resolvedCount,
    'createdAt': createdAt.toIso8601String(),
    'isAnonymous': isAnonymous,
    'isAdminBroadcast': isAdminBroadcast,
    'severity': severity,
  };

  factory HazardReportModel.fromJson(Map<String, dynamic> json) {
    HazardCategory cat = HazardCategory.other;
    final catRaw = (json['category'] as String? ?? '').toUpperCase();
    if (catRaw.contains('LANDSLIDE')) {
      cat = HazardCategory.landslide;
    } else if (catRaw.contains('DARK')) {
      cat = HazardCategory.darkRoad;
    } else if (catRaw.contains('SUSPICIOUS')) {
      cat = HazardCategory.suspiciousPerson;
    } else if (catRaw.contains('ROAD')) {
      cat = HazardCategory.roadHazard;
    } else if (catRaw.contains('FLOOD')) {
      cat = HazardCategory.flooding;
    } else if (catRaw.contains('ACCIDENT')) {
      cat = HazardCategory.accident;
    }

    return HazardReportModel(
      id: json['id'] as String? ?? json['_id'] as String? ?? '',
      authorName: json['authorName'] as String? ?? 'Hiệp sĩ SafeSolo',
      title: json['title'] as String? ?? 'Cảnh báo nguy cơ',
      description: json['description'] as String? ?? '',
      category: cat,
      lat: (json['lat'] as num?)?.toDouble() ?? 10.7769,
      lng: (json['lng'] as num?)?.toDouble() ?? 106.7009,
      address: json['address'] as String? ?? '',
      distanceKm: (json['distanceKm'] as num?)?.toDouble() ?? 0.5,
      confirmCount: json['confirmCount'] as int? ?? 1,
      resolvedCount: json['resolvedCount'] as int? ?? 0,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
      isAnonymous: json['isAnonymous'] as bool? ?? false,
      isAdminBroadcast: json['isAdminBroadcast'] as bool? ?? false,
      severity: json['severity'] as String? ?? 'P2_URGENT',
    );
  }

  HazardReportModel copyWith({
    String? id,
    String? authorName,
    String? title,
    String? description,
    HazardCategory? category,
    double? lat,
    double? lng,
    String? address,
    double? distanceKm,
    int? confirmCount,
    int? resolvedCount,
    DateTime? createdAt,
    bool? isAnonymous,
    bool? isAdminBroadcast,
    String? severity,
  }) {
    return HazardReportModel(
      id: id ?? this.id,
      authorName: authorName ?? this.authorName,
      title: title ?? this.title,
      description: description ?? this.description,
      category: category ?? this.category,
      lat: lat ?? this.lat,
      lng: lng ?? this.lng,
      address: address ?? this.address,
      distanceKm: distanceKm ?? this.distanceKm,
      confirmCount: confirmCount ?? this.confirmCount,
      resolvedCount: resolvedCount ?? this.resolvedCount,
      createdAt: createdAt ?? this.createdAt,
      isAnonymous: isAnonymous ?? this.isAnonymous,
      isAdminBroadcast: isAdminBroadcast ?? this.isAdminBroadcast,
      severity: severity ?? this.severity,
    );
  }
}
