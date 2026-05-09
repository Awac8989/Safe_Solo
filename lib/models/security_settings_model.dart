class SecuritySettingsModel {
  const SecuritySettingsModel({
    required this.userId,
    required this.stealthMode,
    required this.autoWipeDays,
    required this.encryptionEnabled,
    this.lastAutoWipeDueAt,
  });

  final String userId;
  final bool stealthMode;
  final int autoWipeDays;
  final bool encryptionEnabled;
  final DateTime? lastAutoWipeDueAt;

  factory SecuritySettingsModel.fromJson(Map<String, dynamic> json) {
    return SecuritySettingsModel(
      userId: json['userId'] as String? ?? '',
      stealthMode: json['stealthMode'] as bool? ?? false,
      autoWipeDays: json['autoWipeDays'] as int? ?? 0,
      encryptionEnabled: json['encryptionEnabled'] as bool? ?? true,
      lastAutoWipeDueAt: json['lastAutoWipeDueAt'] != null
          ? DateTime.tryParse(json['lastAutoWipeDueAt'] as String)
          : null,
    );
  }
}
