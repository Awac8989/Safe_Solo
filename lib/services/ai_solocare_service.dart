import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../core/providers/app_provider.dart';

/// Đại diện cho một tin nhắn trong hội thoại với SoloCare AI
class SoloCareMessage {
  final String role; // 'user' | 'assistant'
  final String content;
  final DateTime timestamp;
  final bool isEmergencyTrigger;

  const SoloCareMessage({
    required this.role,
    required this.content,
    required this.timestamp,
    this.isEmergencyTrigger = false,
  });

  Map<String, String> toApiMap() => {
        'role': role,
        'content': content,
      };
}

/// Dịch vụ Trợ lý AI Sơ cứu & Tâm lý SoloCare (Hỗ trợ Google Gemini AI & Groq siêu tốc)
class SoloCareAiService {
  SoloCareAiService._();
  static final SoloCareAiService instance = SoloCareAiService._();

  static const String defaultGeminiApiKey = String.fromEnvironment(
    'GEMINI_API_KEY',
    defaultValue: '',
  );

  static const String _fallbackGeminiKeyB64 =
      'QVEuQWI4Uk42SXROYlctdlZhWlNCYW1Qb3Y2aGVNODlnWmFDaUNYN2FwSFVhX3NYVmJITEE=';

  static const String defaultApiKey = String.fromEnvironment(
    'GROQ_API_KEY',
    defaultValue: 'gsk_your_groq_api_key_here',
  );
  static const String defaultModel = 'gemini-2.5-flash';
  static const String geminiEndpointBase = 'https://generativelanguage.googleapis.com/v1beta/models';
  static const String groqEndpoint = 'https://api.groq.com/openai/v1/chat/completions';

  String _geminiApiKey = defaultGeminiApiKey;
  String _apiKey = defaultApiKey;
  String _model = defaultModel;

  String get currentModel => _model;

  String get effectiveGeminiApiKey {
    final trimmed = _geminiApiKey.trim();
    if (trimmed.isNotEmpty && !trimmed.contains('your_') && !trimmed.contains('YOUR_')) {
      return trimmed;
    }
    try {
      return utf8.decode(base64.decode(_fallbackGeminiKeyB64));
    } catch (_) {
      return '';
    }
  }

  void updateApiKey(String key) {
    final trimmed = key.trim();
    if (trimmed.isNotEmpty) {
      if (trimmed.startsWith('AQ.') || trimmed.startsWith('AIza')) {
        _geminiApiKey = trimmed;
      } else {
        _apiKey = trimmed;
      }
    }
  }

  void updateModel(String model) {
    if (model.trim().isNotEmpty) _model = model.trim();
  }

  String _buildSystemPrompt({
    required String userName,
    required String bloodType,
    required String allergies,
    required String medications,
  }) {
    return '''
Bạn là SoloCare AI - Bác sĩ Sơ cứu & Chuyên gia Tâm lý đồng hành của SafeSolo (ứng dụng bảo vệ an toàn cho người đi du lịch / đi một mình).
Hồ sơ y tế của người dùng hiện tại:
- Tên: $userName
- Nhóm máu: ${bloodType.isNotEmpty ? bloodType : 'Chưa cập nhật'}
- DỊ ỨNG ĐÃ BIẾT: ${allergies.isNotEmpty ? allergies : 'Không ghi nhận dị ứng'}
- Thuốc / Bệnh lý nền: ${medications.isNotEmpty ? medications : 'Không ghi nhận'}

Nhiệm vụ của bạn gồm 3 phần chính:
1. SƠ CỨU VẾT THƯƠNG:
   - Trình bày ngắn gọn, đánh số bước 1, 2, 3 rõ ràng để người bị thương đọc được ngay lập tức.
   - Nếu phát hiện dấu hiệu nguy hiểm (chảy máu ồ ạt thành tia, sốc phản vệ, gãy xương hở, khó thở, bỏng diện rộng), BẮT BUỘC khuyên người dùng bấm nút GỌI 115 hoặc BẬT NÚT SOS ngay lập tức trong app.
2. HƯỚNG DẪN DÙNG THUỐC:
   - Hướng dẫn các loại thuốc thông dụng không kê đơn (Paracetamol, Oresol, Berberin, Smecta, Povidone Iodine...).
   - ĐẶC BIỆT LƯU Ý: Phải đối chiếu với danh sách DỊ ỨNG của người dùng ($allergies). Nếu thuốc họ hỏi thuộc diện dị ứng, PHẢI CẢNH BÁO ĐỎ không được dùng và gợi ý thuốc thay thế an toàn.
3. TRÒ CHUYỆN TÂM LÝ & TRẤN AN:
   - Giọng điệu ấm áp, ân cần, điềm tĩnh: "Bạn đang an toàn, mình ở đây lắng nghe và đồng hành cùng bạn...".
   - Hướng dẫn bài tập thở 4-7-8 (hít vào 4s, giữ 7s, thở ra 8s) hoặc kỹ thuật neo 5-4-3-2-1 để hạ nhịp tim và thoát cơn hoảng loạn (panic attack).

Quy chuẩn: Dùng tiếng Việt tự nhiên, súc tích, dễ đọc trên điện thoại. Luôn nhắc nhở AI chỉ hỗ trợ sơ cứu ban đầu, không thay thế bác sĩ chuyên khoa trong ca cấp cứu.
''';
  }

  /// Gửi câu hỏi đến SoloCare AI (Gemini hoặc Groq)
  Future<String> askSoloCare({
    required String prompt,
    required AppProvider appProvider,
    List<SoloCareMessage> history = const [],
  }) async {
    final user = appProvider.user;
    final med = appProvider.medical;

    final systemPrompt = _buildSystemPrompt(
      userName: user?.name ?? 'Bạn',
      bloodType: med.bloodType,
      allergies: med.allergies,
      medications: med.medications,
    );

    // 1. Thử gửi đến Gemini API
    final geminiKey = effectiveGeminiApiKey;
    if (geminiKey.isNotEmpty && !geminiKey.contains('your_')) {
      final geminiResult = await _askGemini(
        systemPrompt: systemPrompt,
        prompt: prompt,
        history: history,
      );
      if (geminiResult != null && geminiResult.trim().isNotEmpty) {
        return geminiResult.trim();
      }
    }

    // 2. Thử gửi đến Groq API nếu có key
    if (_apiKey.isNotEmpty && !_apiKey.contains('your_')) {
      final groqResult = await _askGroq(
        systemPrompt: systemPrompt,
        prompt: prompt,
        history: history,
      );
      if (groqResult != null && groqResult.trim().isNotEmpty) {
        return groqResult.trim();
      }
    }

    // 3. Fallback sơ cứu cục bộ khi không có mạng hoặc API gặp sự cố
    return _fallbackAdvice(prompt, appProvider);
  }

  /// Gọi Google Gemini API
  Future<String?> _askGemini({
    required String systemPrompt,
    required String prompt,
    required List<SoloCareMessage> history,
  }) async {
    final geminiKey = effectiveGeminiApiKey;
    if (geminiKey.isEmpty) return null;

    final candidateModels = <String>[
      if (_model.startsWith('gemini')) _model,
      'gemini-2.5-flash',
      'gemini-flash-latest',
      'gemini-flash-lite-latest',
      'gemini-2.5-flash-lite',
    ];

    // Chuyển đổi lịch sử sang định dạng nội dung của Gemini
    final contents = <Map<String, dynamic>>[];
    final recentHistory = history.length > 6 ? history.sublist(history.length - 6) : history;
    for (final msg in recentHistory) {
      contents.add({
        'role': msg.role == 'assistant' ? 'model' : 'user',
        'parts': [
          {'text': msg.content}
        ],
      });
    }

    contents.add({
      'role': 'user',
      'parts': [
        {'text': prompt}
      ],
    });

    final payload = jsonEncode({
      'system_instruction': {
        'parts': [
          {'text': systemPrompt}
        ],
      },
      'contents': contents,
      'generationConfig': {
        'temperature': 0.6,
        'maxOutputTokens': 800,
      },
    });

    for (final modelName in candidateModels.toSet()) {
      try {
        final uri = Uri.parse('$geminiEndpointBase/$modelName:generateContent');
        final response = await http
            .post(
              uri,
              headers: {
                'x-goog-api-key': geminiKey,
                'Content-Type': 'application/json; charset=utf-8',
              },
              body: payload,
            )
            .timeout(const Duration(seconds: 10));

        if (response.statusCode == 200) {
          final data = jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
          final candidates = data['candidates'] as List<dynamic>?;
          if (candidates != null && candidates.isNotEmpty) {
            final firstCandidate = candidates[0] as Map<String, dynamic>;
            final content = firstCandidate['content'] as Map<String, dynamic>?;
            final parts = content?['parts'] as List<dynamic>?;
            if (parts != null && parts.isNotEmpty) {
              final text = parts[0]['text']?.toString() ?? '';
              if (text.trim().isNotEmpty) {
                return text.trim();
              }
            }
          }
        } else {
          if (kDebugMode) {
            print('Gemini model $modelName returned ${response.statusCode}: ${response.body}');
          }
        }
      } catch (e) {
        if (kDebugMode) {
          print('Gemini model $modelName request error: $e');
        }
      }
    }

    return null;
  }

  /// Gọi Groq API
  Future<String?> _askGroq({
    required String systemPrompt,
    required String prompt,
    required List<SoloCareMessage> history,
  }) async {
    final messages = <Map<String, String>>[
      {'role': 'system', 'content': systemPrompt},
    ];

    final recentHistory = history.length > 6 ? history.sublist(history.length - 6) : history;
    for (final msg in recentHistory) {
      messages.add(msg.toApiMap());
    }

    messages.add({'role': 'user', 'content': prompt});

    try {
      final response = await http
          .post(
            Uri.parse(groqEndpoint),
            headers: {
              'Authorization': 'Bearer $_apiKey',
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: jsonEncode({
              'model': _model.startsWith('gemini') ? 'llama-3.3-70b-versatile' : _model,
              'messages': messages,
              'temperature': 0.6,
              'max_tokens': 512,
            }),
          )
          .timeout(const Duration(seconds: 12));

      if (response.statusCode == 200) {
        final data = jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
        final choices = data['choices'] as List<dynamic>?;
        if (choices != null && choices.isNotEmpty) {
          final firstChoice = choices[0] as Map<String, dynamic>;
          final msg = firstChoice['message'] as Map<String, dynamic>?;
          final content = msg?['content']?.toString() ?? '';
          if (content.isNotEmpty) {
            return content.trim();
          }
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print('Groq connection exception: $e');
      }
    }

    return null;
  }

  /// Lời khuyên sơ cứu ngoại tuyến cục bộ khi mất mạng hoặc API gián đoạn
  String _fallbackAdvice(String query, AppProvider appProvider) {
    final lower = query.toLowerCase();

    if (lower.contains('chảy máu') || lower.contains('đứt tay') || lower.contains('vết thương')) {
      return '''🩹 HƯỚNG DẪN SƠ CỨU VẾT THƯƠNG (Ngoại tuyến):
1. Dùng gạc sạch hoặc khăn đè trực tiếp lên vết thương trong 5-10 phút để cầm máu.
2. Rửa sạch bằng nước muối sinh lý hoặc xà phòng dịu nhẹ. Không rắc thuốc kháng sinh dạng bột.
3. Thoa dung dịch sát khuẩn Povidone Iodine và băng lại bằng gạc vô khuẩn.
⚠️ Nếu máu chảy thành tia hoặc không cầm sau 15 phút: Gọi ngay 115 hoặc bấm nút SOS màu đỏ!''';
    }

    if (lower.contains('bỏng') || lower.contains('bô xe') || lower.contains('nước sôi')) {
      return '''🔥 HƯỚNG DẪN SƠ CỨU BỎNG:
1. Xả nhẹ dưới vòi nước mát sạch trong 15-20 phút (TUYỆT ĐỐI KHÔNG dùng nước đá hoặc kem đánh răng).
2. Tháo nhẹ nhẫn, đồng hồ trước khi vết bỏng sưng nề.
3. Không làm vỡ bọng nước. Che phủ vết bỏng bằng gạc sạch tẩm ẩm hoặc băng vô khuẩn.
⚠️ Bỏng sâu, bỏng mặt hoặc diện tích lớn: Đến cơ sở y tế gần nhất ngay!''';
    }

    if (lower.contains('lo lắng') || lower.contains('sợ') || lower.contains('hoảng loạn') || lower.contains('tim đập')) {
      return '''🧘 HÃY HÍT THỞ CÙNG TÔI (KỸ THUẬT 4-7-8):
Bạn đang an toàn. Hãy ngồi xuống tựa lưng vững chắc và thực hiện:
• Hít vào sâu bằng mũi trong 4 giây.
• Giữ hơi thở lại trong 7 giây.
• Thở chậm ra bằng miệng trong 8 giây.
Lặp lại chu kỳ 4 lần. Nhịp tim và cảm giác hồi hộp sẽ dần lắng dịu.''';
    }

    return '''🩺 THÔNG ĐIỆP SƠ CỨU CẤP TỐC:
SoloCare AI đã ghi nhận yêu cầu của bạn.
• Đối với chấn thương: Luôn ưu tiên cầm máu, làm mát vết bỏng và cố định chi gãy.
• Đối với dùng thuốc: Kiểm tra dị ứng (${appProvider.medical.allergies.isNotEmpty ? appProvider.medical.allergies : 'Chưa cập nhật'}), uống đúng liều và bù đủ nước.
⚠️ Trong mọi tình huống nguy kịch, hãy bấm nút SOS 115 đỏ phía trên để kích hoạt báo động khẩn cấp!''';
  }
}
