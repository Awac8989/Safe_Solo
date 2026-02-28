class UserModel {
  final String id;
  final String fullName;
  final String phoneNumber;
  final int timerIntervalMinutes;
  final DateTime? nextDeadline;
  final String currentStatus;
  final String quietHoursStart;
  final String quietHoursEnd;
  final DateTime? sleepModeUntil;
  final int falseAlertGraceMinutes;

  const UserModel({
    required this.id,
    required this.fullName,
    required this.phoneNumber,
    required this.timerIntervalMinutes,
    required this.nextDeadline,
    required this.currentStatus,
    required this.quietHoursStart,
    required this.quietHoursEnd,
    required this.sleepModeUntil,
    required this.falseAlertGraceMinutes,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['_id'] as String,
      fullName: json['fullName'] as String? ?? '',
      phoneNumber: json['phoneNumber'] as String? ?? '',
      timerIntervalMinutes: json['timerIntervalMinutes'] as int? ?? 720,
      nextDeadline: json['nextDeadline'] != null
          ? DateTime.tryParse(json['nextDeadline'] as String)
          : null,
      currentStatus: json['currentStatus'] as String? ?? 'SAFE',
      quietHoursStart: json['quietHoursStart'] as String? ?? '23:00',
      quietHoursEnd: json['quietHoursEnd'] as String? ?? '06:00',
      sleepModeUntil: json['sleepModeUntil'] != null
          ? DateTime.tryParse(json['sleepModeUntil'] as String)
          : null,
      falseAlertGraceMinutes: json['falseAlertGraceMinutes'] as int? ?? 3,
    );
  }
}