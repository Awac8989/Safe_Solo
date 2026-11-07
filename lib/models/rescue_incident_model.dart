import 'package:flutter/material.dart';

/// Trạng thái sự cố cứu nạn theo quy trình chuẩn SafeSolo
enum RescueIncidentStatus {
  triggered, // Vừa kích hoạt, đang đếm ngược
  dispatchingR1, // Đang quét bán kính Vòng 1 (1.2km)
  dispatchingR2, // Đang quét bán kính Vòng 2 (4.5km)
  accepted, // Hiệp sĩ đã nhận (Atomic lock)
  enRoute, // Hiệp sĩ đang di chuyển đến
  onScene, // Hiệp sĩ đã có mặt (< 25m)
  handedOver115, // Đã bàn giao bác sĩ/công an
  resolvedSafe, // Nạn nhân an toàn, hoàn tất
  escalated115, // Hết thời gian chờ, chuyển tổng đài 115
  cancelledFalseAlarm, // Hủy do báo động giả
  active, // Trạng thái chung
  unknown,
}

/// Mức độ nghiêm trọng của sự cố
enum RescueSeverityLevel {
  p0Silent, // Khẩn cấp ngầm / bắt cóc / cưỡng bức
  p1Critical, // Nguy kịch: ngưng tim, tai nạn nặng, bất tỉnh
  p2Urgent, // Khẩn cấp: té ngã, gãy xương, vết thương sâu
  p3Assist, // Trợ giúp: hỏng xe đêm, lạc đường, nghi vấn theo dõi
}

/// Mô hình Sự cố Cứu nạn Thời gian thực SafeSolo
class RescueIncidentModel {
  final String id;
  final String victimId;
  final String victimName;
  final String? victimPhone;
  final String incidentType;
  final RescueIncidentStatus status;
  final RescueSeverityLevel severityLevel;
  final double exactLat;
  final double exactLng;
  final double fuzzedLat;
  final double fuzzedLng;
  final String? approxAddress;
  final int? batteryLevel;
  final String? assignedVolunteerId;
  final String? assignedVolunteerName;
  final String? assignedVolunteerPhone;
  final String? assignedVolunteerSkillTier;
  final double? heroDistanceMeters;
  final int? heroEtaMinutes;
  final String? medicalNotes;
  final String bloodType;
  final List<String> allergies;
  final List<String> chronicConditions;
  final DateTime createdAt;
  final DateTime? updatedAt;

  const RescueIncidentModel({
    required this.id,
    required this.victimId,
    required this.victimName,
    this.victimPhone,
    required this.incidentType,
    this.status = RescueIncidentStatus.dispatchingR1,
    this.severityLevel = RescueSeverityLevel.p1Critical,
    required this.exactLat,
    required this.exactLng,
    required this.fuzzedLat,
    required this.fuzzedLng,
    this.approxAddress,
    this.batteryLevel,
    this.assignedVolunteerId,
    this.assignedVolunteerName,
    this.assignedVolunteerPhone,
    this.assignedVolunteerSkillTier,
    this.heroDistanceMeters,
    this.heroEtaMinutes,
    this.medicalNotes,
    this.bloodType = 'UNKNOWN',
    this.allergies = const [],
    this.chronicConditions = const [],
    required this.createdAt,
    this.updatedAt,
  });

  bool get isActive =>
      status == RescueIncidentStatus.triggered ||
      status == RescueIncidentStatus.dispatchingR1 ||
      status == RescueIncidentStatus.dispatchingR2 ||
      status == RescueIncidentStatus.accepted ||
      status == RescueIncidentStatus.enRoute ||
      status == RescueIncidentStatus.onScene ||
      status == RescueIncidentStatus.active;

  bool get isHeroAssigned =>
      assignedVolunteerId != null &&
      assignedVolunteerId!.isNotEmpty &&
      (status == RescueIncidentStatus.accepted ||
          status == RescueIncidentStatus.enRoute ||
          status == RescueIncidentStatus.onScene);

  bool get isOnScene => status == RescueIncidentStatus.onScene;

  String get statusTitleVi {
    switch (status) {
      case RescueIncidentStatus.triggered:
        return 'VỪA KÍCH HOẠT (ĐANG XÁC THỰC)';
      case RescueIncidentStatus.dispatchingR1:
        return 'ĐANG QUÉT HIỆP SĨ VÒNG 1 (1.2KM)';
      case RescueIncidentStatus.dispatchingR2:
        return 'MỞ RỘNG BÁN KÍNH QUÉT (4.5KM)';
      case RescueIncidentStatus.accepted:
        return 'HIỆP SĨ ĐÃ TIẾP NHẬN CA';
      case RescueIncidentStatus.enRoute:
        return 'HIỆP SĨ ĐANG TIẾP CẬN';
      case RescueIncidentStatus.onScene:
        return 'HIỆP SĨ ĐÃ CÓ MẶT TẠI HIỆN TRƯỜNG';
      case RescueIncidentStatus.handedOver115:
        return 'ĐÃ BÀN GIAO KÍP CẤP CỨU 115';
      case RescueIncidentStatus.resolvedSafe:
        return 'SỰ CỐ ĐÃ ĐƯỢC XỬ LÝ AN TOÀN';
      case RescueIncidentStatus.escalated115:
        return 'ĐÃ CHUYỂN TIẾP TỔNG ĐÀI 115';
      case RescueIncidentStatus.cancelledFalseAlarm:
        return 'ĐÃ HỦY BÁO ĐỘNG GIẢ';
      case RescueIncidentStatus.active:
      case RescueIncidentStatus.unknown:
        return 'ĐANG HOẠT ĐỘNG KHẨN CẤP';
    }
  }

  String get statusSubtitleVi {
    switch (status) {
      case RescueIncidentStatus.triggered:
        return 'Đếm ngược an toàn đang chạy tại máy nạn nhân';
      case RescueIncidentStatus.dispatchingR1:
        return 'Hệ thống AI đang lọc Hiệp sĩ có chứng chỉ Sơ cứu gần nhất';
      case RescueIncidentStatus.dispatchingR2:
        return 'Tự động mở rộng phạm vi tìm kiếm First Responder';
      case RescueIncidentStatus.accepted:
        return '${assignedVolunteerName ?? "Hiệp sĩ"} đang chuẩn bị xuất phát';
      case RescueIncidentStatus.enRoute:
        final eta = heroEtaMinutes != null ? ' · ETA $heroEtaMinutes phút' : '';
        final dist = heroDistanceMeters != null
            ? ' · Cách ${(heroDistanceMeters! / 1000).toStringAsFixed(1)}km'
            : '';
        return '${assignedVolunteerName ?? "Hiệp sĩ"} đang di chuyển đến bạn$dist$eta';
      case RescueIncidentStatus.onScene:
        return 'Hiệp sĩ đang tiến hành các biện pháp sơ cứu sinh tồn';
      case RescueIncidentStatus.handedOver115:
        return 'Hồ sơ y tế SBAR số hóa đã được chuyển cho bác sĩ';
      case RescueIncidentStatus.resolvedSafe:
        return 'Nạn nhân đã xác nhận an toàn tuyệt đối';
      case RescueIncidentStatus.escalated115:
        return 'Đường dây nóng 115 và gia đình đã nhận được hồ sơ định vị';
      case RescueIncidentStatus.cancelledFalseAlarm:
        return 'Người dùng đã nhập mã PIN xác nhận an toàn';
      case RescueIncidentStatus.active:
      case RescueIncidentStatus.unknown:
        return 'Các kênh cứu nạn đang hoạt động ở mức ưu tiên tối cao';
    }
  }

  Color get statusColor {
    switch (status) {
      case RescueIncidentStatus.triggered:
      case RescueIncidentStatus.dispatchingR1:
      case RescueIncidentStatus.dispatchingR2:
        return const Color(0xFFEF4444); // Red
      case RescueIncidentStatus.accepted:
      case RescueIncidentStatus.enRoute:
        return const Color(0xFFF59E0B); // Amber
      case RescueIncidentStatus.onScene:
        return const Color(0xFF3B82F6); // Blue
      case RescueIncidentStatus.handedOver115:
      case RescueIncidentStatus.resolvedSafe:
        return const Color(0xFF10B981); // Emerald Green
      case RescueIncidentStatus.escalated115:
        return const Color(0xFF8B5CF6); // Purple
      case RescueIncidentStatus.cancelledFalseAlarm:
        return const Color(0xFF6B7280); // Gray
      case RescueIncidentStatus.active:
      case RescueIncidentStatus.unknown:
        return const Color(0xFFEF4444);
    }
  }

  factory RescueIncidentModel.fromJson(Map<String, dynamic> json) {
    RescueIncidentStatus parseStatus(String? raw) {
      switch (raw?.toUpperCase()) {
        case 'TRIGGERED':
          return RescueIncidentStatus.triggered;
        case 'DISPATCHING_R1':
          return RescueIncidentStatus.dispatchingR1;
        case 'DISPATCHING_R2':
          return RescueIncidentStatus.dispatchingR2;
        case 'ACCEPTED':
          return RescueIncidentStatus.accepted;
        case 'EN_ROUTE':
          return RescueIncidentStatus.enRoute;
        case 'ON_SCENE':
          return RescueIncidentStatus.onScene;
        case 'HANDED_OVER_115':
          return RescueIncidentStatus.handedOver115;
        case 'RESOLVED_SAFE':
        case 'RESOLVED':
          return RescueIncidentStatus.resolvedSafe;
        case 'ESCALATED_115':
          return RescueIncidentStatus.escalated115;
        case 'CANCELLED_FALSE_ALARM':
          return RescueIncidentStatus.cancelledFalseAlarm;
        case 'ACTIVE':
          return RescueIncidentStatus.active;
        default:
          return RescueIncidentStatus.active;
      }
    }

    RescueSeverityLevel parseSeverity(String? raw) {
      switch (raw?.toUpperCase()) {
        case 'P0_SILENT':
          return RescueSeverityLevel.p0Silent;
        case 'P1_CRITICAL':
          return RescueSeverityLevel.p1Critical;
        case 'P2_URGENT':
          return RescueSeverityLevel.p2Urgent;
        case 'P3_ASSIST':
          return RescueSeverityLevel.p3Assist;
        default:
          return RescueSeverityLevel.p1Critical;
      }
    }

    final medSnapshot = json['medicalSnapshot'] is Map ? json['medicalSnapshot'] as Map : null;

    return RescueIncidentModel(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      victimId: (json['victimId'] ?? '').toString(),
      victimName: (json['victimName'] ?? 'Nạn nhân SafeSolo').toString(),
      victimPhone: json['victimPhone']?.toString(),
      incidentType: (json['incidentType'] ?? 'SOS_KHAN_CAP').toString(),
      status: parseStatus(json['status']?.toString()),
      severityLevel: parseSeverity(json['severityLevel']?.toString()),
      exactLat: (json['exactLat'] as num?)?.toDouble() ?? 10.7766,
      exactLng: (json['exactLng'] as num?)?.toDouble() ?? 106.7009,
      fuzzedLat: (json['fuzzedLat'] as num?)?.toDouble() ?? (json['exactLat'] as num?)?.toDouble() ?? 10.7766,
      fuzzedLng: (json['fuzzedLng'] as num?)?.toDouble() ?? (json['exactLng'] as num?)?.toDouble() ?? 106.7009,
      approxAddress: json['approxAddress']?.toString(),
      batteryLevel: (json['batteryLevel'] as num?)?.toInt(),
      assignedVolunteerId: json['assignedVolunteerId']?.toString(),
      assignedVolunteerName: json['assignedVolunteerName']?.toString(),
      assignedVolunteerPhone: json['assignedVolunteerPhone']?.toString(),
      assignedVolunteerSkillTier: json['assignedVolunteerSkillTier']?.toString(),
      heroDistanceMeters: (json['heroDistanceMeters'] as num?)?.toDouble() ??
          (json['telemetry'] is Map ? (json['telemetry']['distanceRemainingMeters'] as num?)?.toDouble() : null),
      heroEtaMinutes: (json['heroEtaMinutes'] as num?)?.toInt(),
      medicalNotes: json['medicalNotes']?.toString(),
      bloodType: medSnapshot != null && medSnapshot['bloodType'] != null
          ? medSnapshot['bloodType'].toString()
          : (json['bloodType']?.toString() ?? 'UNKNOWN'),
      allergies: medSnapshot != null && medSnapshot['allergies'] is List
          ? List<String>.from(medSnapshot['allergies'].map((e) => e.toString()))
          : (json['allergies'] is List ? List<String>.from(json['allergies'].map((e) => e.toString())) : const []),
      chronicConditions: medSnapshot != null && medSnapshot['chronicConditions'] is List
          ? List<String>.from(medSnapshot['chronicConditions'].map((e) => e.toString()))
          : (json['chronicConditions'] is List ? List<String>.from(json['chronicConditions'].map((e) => e.toString())) : const []),
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'].toString())
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'victimId': victimId,
      'victimName': victimName,
      'victimPhone': victimPhone,
      'incidentType': incidentType,
      'status': status.name,
      'severityLevel': severityLevel.name,
      'exactLat': exactLat,
      'exactLng': exactLng,
      'fuzzedLat': fuzzedLat,
      'fuzzedLng': fuzzedLng,
      'approxAddress': approxAddress,
      'batteryLevel': batteryLevel,
      'assignedVolunteerId': assignedVolunteerId,
      'assignedVolunteerName': assignedVolunteerName,
      'assignedVolunteerPhone': assignedVolunteerPhone,
      'assignedVolunteerSkillTier': assignedVolunteerSkillTier,
      'heroDistanceMeters': heroDistanceMeters,
      'heroEtaMinutes': heroEtaMinutes,
      'medicalNotes': medicalNotes,
      'bloodType': bloodType,
      'allergies': allergies,
      'chronicConditions': chronicConditions,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
    };
  }

  RescueIncidentModel copyWith({
    String? id,
    String? victimId,
    String? victimName,
    String? victimPhone,
    String? incidentType,
    RescueIncidentStatus? status,
    RescueSeverityLevel? severityLevel,
    double? exactLat,
    double? exactLng,
    double? fuzzedLat,
    double? fuzzedLng,
    String? approxAddress,
    int? batteryLevel,
    String? assignedVolunteerId,
    String? assignedVolunteerName,
    String? assignedVolunteerPhone,
    String? assignedVolunteerSkillTier,
    double? heroDistanceMeters,
    int? heroEtaMinutes,
    String? medicalNotes,
    String? bloodType,
    List<String>? allergies,
    List<String>? chronicConditions,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return RescueIncidentModel(
      id: id ?? this.id,
      victimId: victimId ?? this.victimId,
      victimName: victimName ?? this.victimName,
      victimPhone: victimPhone ?? this.victimPhone,
      incidentType: incidentType ?? this.incidentType,
      status: status ?? this.status,
      severityLevel: severityLevel ?? this.severityLevel,
      exactLat: exactLat ?? this.exactLat,
      exactLng: exactLng ?? this.exactLng,
      fuzzedLat: fuzzedLat ?? this.fuzzedLat,
      fuzzedLng: fuzzedLng ?? this.fuzzedLng,
      approxAddress: approxAddress ?? this.approxAddress,
      batteryLevel: batteryLevel ?? this.batteryLevel,
      assignedVolunteerId: assignedVolunteerId ?? this.assignedVolunteerId,
      assignedVolunteerName: assignedVolunteerName ?? this.assignedVolunteerName,
      assignedVolunteerPhone: assignedVolunteerPhone ?? this.assignedVolunteerPhone,
      assignedVolunteerSkillTier: assignedVolunteerSkillTier ?? this.assignedVolunteerSkillTier,
      heroDistanceMeters: heroDistanceMeters ?? this.heroDistanceMeters,
      heroEtaMinutes: heroEtaMinutes ?? this.heroEtaMinutes,
      medicalNotes: medicalNotes ?? this.medicalNotes,
      bloodType: bloodType ?? this.bloodType,
      allergies: allergies ?? this.allergies,
      chronicConditions: chronicConditions ?? this.chronicConditions,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
