class HealthReportBucket {
  const HealthReportBucket({
    required this.key,
    required this.label,
    required this.checkIns,
    required this.autoCheckIns,
    required this.alertCount,
    required this.sosCount,
    required this.moodCounts,
  });

  final String key;
  final String label;
  final int checkIns;
  final int autoCheckIns;
  final int alertCount;
  final int sosCount;
  final Map<String, int> moodCounts;

  factory HealthReportBucket.fromJson(Map<String, dynamic> json) {
    return HealthReportBucket(
      key: json['key'] as String? ?? '',
      label: json['label'] as String? ?? '',
      checkIns: json['checkIns'] as int? ?? 0,
      autoCheckIns: json['autoCheckIns'] as int? ?? 0,
      alertCount: json['alertCount'] as int? ?? 0,
      sosCount: json['sosCount'] as int? ?? 0,
      moodCounts: Map<String, int>.from(
        (json['moodCounts'] as Map? ?? const {}).map(
          (key, value) => MapEntry(key.toString(), (value as num).toInt()),
        ),
      ),
    );
  }
}

class HealthReportEvent {
  const HealthReportEvent({
    required this.id,
    required this.title,
    required this.message,
    required this.createdAt,
    this.status,
    this.level,
    this.location,
    this.autoTriggered = false,
  });

  final String id;
  final String title;
  final String message;
  final String createdAt;
  final String? status;
  final String? level;
  final Map<String, dynamic>? location;
  final bool autoTriggered;

  factory HealthReportEvent.fromJson(Map<String, dynamic> json) {
    return HealthReportEvent(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      message: json['message'] as String? ?? '',
      createdAt: json['createdAt'] as String? ?? '',
      status: json['status'] as String?,
      level: json['level'] as String?,
      location: json['locationAtCheckin'] is Map
          ? Map<String, dynamic>.from(json['locationAtCheckin'] as Map)
          : json['location'] is Map
              ? Map<String, dynamic>.from(json['location'] as Map)
              : null,
      autoTriggered: json['isSystemAutoTriggered'] as bool? ?? false,
    );
  }
}

class HealthReportModel {
  const HealthReportModel({
    required this.period,
    required this.rangeStart,
    required this.rangeEnd,
    required this.totalCheckIns,
    required this.autoCheckIns,
    required this.overdueCount,
    required this.sosCount,
    required this.moodCounts,
    required this.dailySeries,
    required this.recentCheckins,
    required this.recentAlerts,
  });

  final String period;
  final String rangeStart;
  final String rangeEnd;
  final int totalCheckIns;
  final int autoCheckIns;
  final int overdueCount;
  final int sosCount;
  final Map<String, int> moodCounts;
  final List<HealthReportBucket> dailySeries;
  final List<HealthReportEvent> recentCheckins;
  final List<HealthReportEvent> recentAlerts;

  factory HealthReportModel.fromJson(Map<String, dynamic> json) {
    final summary = Map<String, dynamic>.from(json['summary'] as Map? ?? const {});
      final moodCounts = Map<String, int>.from(
      (summary['moodCounts'] as Map? ?? const {}).map(
        (key, value) => MapEntry(key.toString(), (value as num).toInt()),
      ),
    );
    return HealthReportModel(
      period: json['period'] as String? ?? 'month',
      rangeStart: json['range'] is Map
          ? (json['range'] as Map)['start'] as String? ?? ''
          : '',
      rangeEnd: json['range'] is Map
          ? (json['range'] as Map)['end'] as String? ?? ''
          : '',
      totalCheckIns: summary['totalCheckIns'] as int? ?? 0,
      autoCheckIns: summary['autoCheckIns'] as int? ?? 0,
      overdueCount: summary['overdueCount'] as int? ?? 0,
      sosCount: summary['sosCount'] as int? ?? 0,
      moodCounts: moodCounts,
      dailySeries: (json['dailySeries'] as List<dynamic>? ?? const [])
          .map((item) => HealthReportBucket.fromJson(Map<String, dynamic>.from(item as Map)))
          .toList(),
      recentCheckins: (json['recentCheckins'] as List<dynamic>? ?? const [])
          .map((item) => HealthReportEvent.fromJson(Map<String, dynamic>.from(item as Map)))
          .toList(),
      recentAlerts: (json['recentAlerts'] as List<dynamic>? ?? const [])
          .map((item) => HealthReportEvent.fromJson(Map<String, dynamic>.from(item as Map)))
          .toList(),
    );
  }
}
