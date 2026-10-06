class SafeMoment {
  final String id;
  final String userId;
  final String authorName;
  final String? avatarUrl;
  final String mood;
  final String? voiceNoteUrl;
  final String? photoUrl;
  final String caption;
  final DateTime createdAt;
  final DateTime expiresAt;

  SafeMoment({
    required this.id,
    required this.userId,
    required this.authorName,
    this.avatarUrl,
    required this.mood,
    this.voiceNoteUrl,
    this.photoUrl,
    required this.caption,
    required this.createdAt,
    required this.expiresAt,
  });

  factory SafeMoment.fromJson(Map<String, dynamic> json) {
    return SafeMoment(
      id: json['_id'] ?? '',
      userId: json['userId'] ?? '',
      authorName: json['authorName'] ?? 'Người thân',
      avatarUrl: json['avatarUrl'],
      mood: json['mood'] ?? 'calm',
      voiceNoteUrl: json['voiceNoteUrl'],
      photoUrl: json['photoUrl'],
      caption: json['caption'] ?? '',
      createdAt: DateTime.parse(json['createdAt'] as String),
      expiresAt: DateTime.parse(json['expiresAt'] as String),
    );
  }
}
