class AlertPolicyModel {
  const AlertPolicyModel({
    required this.id,
    required this.userId,
    required this.level1Minutes,
    required this.level2Minutes,
    required this.level3Minutes,
    required this.level4Enabled,
  });

  final String id;
  final String userId;
  final int level1Minutes;
  final int level2Minutes;
  final int level3Minutes;
  final bool level4Enabled;

  factory AlertPolicyModel.fromJson(Map<String, dynamic> json) {
    return AlertPolicyModel(
      id: json['_id'] as String? ?? '',
      userId: json['userId'] as String? ?? '',
      level1Minutes: json['level1Minutes'] as int? ?? 30,
      level2Minutes: json['level2Minutes'] as int? ?? 5,
      level3Minutes: json['level3Minutes'] as int? ?? 15,
      level4Enabled: json['level4Enabled'] as bool? ?? false,
    );
  }
}
