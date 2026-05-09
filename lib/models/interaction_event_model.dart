class InteractionEventModel {
  const InteractionEventModel({
    required this.id,
    required this.userId,
    required this.type,
    required this.source,
    required this.createdAt,
    required this.metadata,
  });

  final String id;
  final String userId;
  final String type;
  final String source;
  final DateTime createdAt;
  final Map<String, dynamic> metadata;

  factory InteractionEventModel.fromJson(Map<String, dynamic> json) {
    return InteractionEventModel(
      id: json['_id'] as String? ?? '',
      userId: json['userId'] as String? ?? '',
      type: json['type'] as String? ?? '',
      source: json['source'] as String? ?? '',
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
      metadata: Map<String, dynamic>.from(json['metadata'] as Map? ?? const {}),
    );
  }
}
