class LiveJourneyModel {
  const LiveJourneyModel({
    required this.id,
    required this.destinationLabel,
    this.destinationLat,
    this.destinationLng,
    required this.durationMinutes,
    required this.startedAt,
    required this.expectedArrivalAt,
    required this.status,
    required this.shareToken,
    this.currentLat,
    this.currentLng,
    this.batteryLevel,
    this.remainingSeconds = 0,
  });

  final String id;
  final String destinationLabel;
  final double? destinationLat;
  final double? destinationLng;
  final int durationMinutes;
  final DateTime startedAt;
  final DateTime expectedArrivalAt;
  final String status;
  final String shareToken;
  final double? currentLat;
  final double? currentLng;
  final int? batteryLevel;
  final int remainingSeconds;

  bool get isInTransit => status == 'IN_TRANSIT';
  bool get isOverdue => status == 'OVERDUE_ALARM' || (isInTransit && DateTime.now().isAfter(expectedArrivalAt));
  bool get isArrived => status == 'ARRIVED_SAFE';
  bool get isCancelled => status == 'CANCELLED';

  String get remainingFormatted {
    final secs = remainingSeconds > 0
        ? remainingSeconds
        : expectedArrivalAt.difference(DateTime.now()).inSeconds;
    if (secs <= 0) return '00:00';
    final m = (secs ~/ 60).toString().padLeft(2, '0');
    final s = (secs % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  LiveJourneyModel copyWith({
    String? id,
    String? destinationLabel,
    double? destinationLat,
    double? destinationLng,
    int? durationMinutes,
    DateTime? startedAt,
    DateTime? expectedArrivalAt,
    String? status,
    String? shareToken,
    double? currentLat,
    double? currentLng,
    int? batteryLevel,
    int? remainingSeconds,
  }) {
    return LiveJourneyModel(
      id: id ?? this.id,
      destinationLabel: destinationLabel ?? this.destinationLabel,
      destinationLat: destinationLat ?? this.destinationLat,
      destinationLng: destinationLng ?? this.destinationLng,
      durationMinutes: durationMinutes ?? this.durationMinutes,
      startedAt: startedAt ?? this.startedAt,
      expectedArrivalAt: expectedArrivalAt ?? this.expectedArrivalAt,
      status: status ?? this.status,
      shareToken: shareToken ?? this.shareToken,
      currentLat: currentLat ?? this.currentLat,
      currentLng: currentLng ?? this.currentLng,
      batteryLevel: batteryLevel ?? this.batteryLevel,
      remainingSeconds: remainingSeconds ?? this.remainingSeconds,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'destinationLabel': destinationLabel,
    'destinationLat': destinationLat,
    'destinationLng': destinationLng,
    'durationMinutes': durationMinutes,
    'startedAt': startedAt.toIso8601String(),
    'expectedArrivalAt': expectedArrivalAt.toIso8601String(),
    'status': status,
    'shareToken': shareToken,
    'currentLat': currentLat,
    'currentLng': currentLng,
    'batteryLevel': batteryLevel,
    'remainingSeconds': remainingSeconds,
  };

  factory LiveJourneyModel.fromJson(Map<String, dynamic> json) {
    return LiveJourneyModel(
      id: json['id'] as String? ?? json['_id'] as String? ?? '',
      destinationLabel: json['destinationLabel'] as String? ?? 'Điểm đến',
      destinationLat: (json['destinationLat'] as num?)?.toDouble(),
      destinationLng: (json['destinationLng'] as num?)?.toDouble(),
      durationMinutes: json['durationMinutes'] as int? ?? 20,
      startedAt: DateTime.tryParse(json['startedAt'] as String? ?? '') ?? DateTime.now(),
      expectedArrivalAt: DateTime.tryParse(json['expectedArrivalAt'] as String? ?? '') ??
          DateTime.now().add(Duration(minutes: json['durationMinutes'] as int? ?? 20)),
      status: json['status'] as String? ?? 'IN_TRANSIT',
      shareToken: json['shareToken'] as String? ?? '',
      currentLat: (json['currentLat'] as num?)?.toDouble(),
      currentLng: (json['currentLng'] as num?)?.toDouble(),
      batteryLevel: json['batteryLevel'] as int?,
      remainingSeconds: json['remainingSeconds'] as int? ?? 0,
    );
  }
}
