class SafeMomentModel {
  const SafeMomentModel({
    required this.id,
    required this.authorName,
    this.avatarUrl,
    this.mood = 'calm',
    this.voiceNoteUrl,
    this.photoUrl,
    this.caption = '',
    required this.createdAt,
  });

  final String id;
  final String authorName;
  final String? avatarUrl;
  final String mood;
  final String? voiceNoteUrl;
  final String? photoUrl;
  final String caption;
  final DateTime createdAt;

  Map<String, dynamic> toJson() => {
    'id': id,
    'authorName': authorName,
    'avatarUrl': avatarUrl,
    'mood': mood,
    'voiceNoteUrl': voiceNoteUrl,
    'photoUrl': photoUrl,
    'caption': caption,
    'createdAt': createdAt.toIso8601String(),
  };

  factory SafeMomentModel.fromJson(Map<String, dynamic> json) {
    return SafeMomentModel(
      id: json['id'] as String? ?? json['_id'] as String? ?? '',
      authorName: json['authorName'] as String? ?? 'Gia đình',
      avatarUrl: json['avatarUrl'] as String?,
      mood: json['mood'] as String? ?? 'calm',
      voiceNoteUrl: json['voiceNoteUrl'] as String?,
      photoUrl: json['photoUrl'] as String?,
      caption: json['caption'] as String? ?? '',
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
    );
  }
}
