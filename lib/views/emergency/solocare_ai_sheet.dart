import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/providers/app_provider.dart';
import '../../services/ai_solocare_service.dart';

/// Modal Pop-up Tư vấn AI: SoloCare AI (Sơ cứu vết thương, Hướng dẫn thuốc, Trấn an tâm lý)
class SoloCareAiSheet extends StatefulWidget {
  const SoloCareAiSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const SoloCareAiSheet(),
    );
  }

  @override
  State<SoloCareAiSheet> createState() => _SoloCareAiSheetState();
}

class _SoloCareAiSheetState extends State<SoloCareAiSheet> with SingleTickerProviderStateMixin {
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final List<SoloCareMessage> _messages = [];
  bool _isLoading = false;

  // Trạng thái bài tập thở 4-7-8
  bool _isBreathingActive = false;
  int _breathingPhase = 0; // 0: Hít (4s), 1: Giữ (7s), 2: Thở (8s)
  int _breathingCountdown = 4;
  Timer? _breathingTimer;

  late final AnimationController _pulseController = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat(reverse: true);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initWelcomeMessage();
    });
  }

  @override
  void dispose() {
    _textController.dispose();
    _scrollController.dispose();
    _breathingTimer?.cancel();
    _pulseController.dispose();
    super.dispose();
  }

  void _initWelcomeMessage() {
    final app = context.read<AppProvider>();
    final userName = app.user?.name ?? 'bạn';
    final med = app.medical;
    final allergyNote = med.allergies.isNotEmpty
        ? '\n⚠️ *Hệ thống đã nạp hồ sơ Dị ứng của bạn:* **${med.allergies}** (tôi sẽ luôn đối chiếu an toàn trước khi khuyên dùng thuốc).'
        : '';

    setState(() {
      _messages.add(
        SoloCareMessage(
          role: 'assistant',
          content: 'Chào $userName, mình là **SoloCare AI** 🩺\n\nMình có thể hỗ trợ bạn:\n'
              '• 🩹 **Sơ cứu vết thương**: Bỏng, chảy máu, côn trùng đốt, bong gân.\n'
              '• 💊 **Dùng thuốc an toàn**: Kiểm tra dị ứng, liều dùng thông thường.\n'
              '• 🧘 **Trấn an tâm lý**: Cùng bạn thở chậm, hạ nhịp tim khi hoảng sợ.$allergyNote\n\n'
              'Bạn đang gặp tình huống gì hoặc cần mình hỗ trợ điều gì?',
          timestamp: DateTime.now(),
        ),
      );
    });
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent + 80,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _handleSendMessage([String? quickText]) async {
    final text = quickText ?? _textController.text.trim();
    if (text.isEmpty || _isLoading) return;

    _textController.clear();
    setState(() {
      _messages.add(
        SoloCareMessage(
          role: 'user',
          content: text,
          timestamp: DateTime.now(),
        ),
      );
      _isLoading = true;
    });
    _scrollToBottom();

    final app = context.read<AppProvider>();
    final responseText = await SoloCareAiService.instance.askSoloCare(
      prompt: text,
      appProvider: app,
      history: _messages,
    );

    if (!mounted) return;

    setState(() {
      _isLoading = false;
      _messages.add(
        SoloCareMessage(
          role: 'assistant',
          content: responseText,
          timestamp: DateTime.now(),
        ),
      );
    });
    _scrollToBottom();
  }

  void _toggleBreathingExercise() {
    setState(() {
      _isBreathingActive = !_isBreathingActive;
      if (_isBreathingActive) {
        _breathingPhase = 0;
        _breathingCountdown = 4;
        _startBreathingLoop();
      } else {
        _breathingTimer?.cancel();
      }
    });
  }

  void _startBreathingLoop() {
    _breathingTimer?.cancel();
    _breathingTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!_isBreathingActive) {
        timer.cancel();
        return;
      }
      setState(() {
        if (_breathingCountdown > 1) {
          _breathingCountdown--;
        } else {
          // Chuyển giai đoạn: 0 (Hít 4s) -> 1 (Giữ 7s) -> 2 (Thở ra 8s) -> 0
          if (_breathingPhase == 0) {
            _breathingPhase = 1;
            _breathingCountdown = 7;
          } else if (_breathingPhase == 1) {
            _breathingPhase = 2;
            _breathingCountdown = 8;
          } else {
            _breathingPhase = 0;
            _breathingCountdown = 4;
          }
        }
      });
    });
  }

  Future<void> _call115() async {
    final uri = Uri(scheme: 'tel', path: '115');
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Không thể mở trình gọi điện thoại cho số 115.'),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      height: MediaQuery.of(context).size.height * 0.9,
      decoration: const BoxDecoration(
        color: Color(0xFF0B1329), // Deep Tactical Midnight Slate
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        boxShadow: [
          BoxShadow(
            color: Colors.black54,
            blurRadius: 24,
            offset: Offset(0, -6),
          ),
        ],
      ),
      child: Column(
        children: [
          // Drag Handle
          Container(
            margin: const EdgeInsets.only(top: 10, bottom: 6),
            width: 44,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.white24,
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
            child: Row(
              children: [
                Stack(
                  alignment: Alignment.center,
                  children: [
                    ScaleTransition(
                      scale: Tween(begin: 0.9, end: 1.15).animate(_pulseController),
                      child: Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: const Color(0xFF10B981).withValues(alpha: 0.25),
                        ),
                      ),
                    ),
                    Container(
                      width: 36,
                      height: 36,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          colors: [Color(0xFF059669), Color(0xFF10B981)],
                        ),
                      ),
                      child: const Icon(Icons.health_and_safety_rounded, color: Colors.white, size: 20),
                    ),
                  ],
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            'SoloCare AI',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          SizedBox(width: 6),
                          Icon(Icons.verified_rounded, color: Color(0xFF10B981), size: 14),
                        ],
                      ),
                      Text(
                        'Sơ cứu · Thuốc · Trấn an (Qwen 3.8)',
                        style: TextStyle(color: Colors.white54, fontSize: 11),
                      ),
                    ],
                  ),
                ),
                // Nút Khẩn cấp 115
                ElevatedButton.icon(
                  onPressed: _call115,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFDC2626),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    minimumSize: Size.zero,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                  icon: const Icon(Icons.emergency_rounded, size: 14),
                  label: const Text('115', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                ),
                const SizedBox(width: 6),
                IconButton(
                  icon: const Icon(Icons.close_rounded, color: Colors.white60, size: 22),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const Divider(color: Colors.white10, height: 1),

          // Widget Bài tập thở 4-7-8 khi kích hoạt
          if (_isBreathingActive) _buildBreathingWidget(),

          // Danh sách Chips gợi ý nhanh (Quick Chips)
          SizedBox(
            height: 42,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              physics: const BouncingScrollPhysics(),
              children: [
                _buildQuickChip('🩹 Đứt tay chảy máu', 'Tôi vừa bị đứt tay chảy máu khá nhiều, cần sơ cứu thế nào?'),
                _buildQuickChip('🔥 Bỏng bô xe máy', 'Tôi bị bỏng bô xe máy đỏ rát, cách sơ cứu cấp tốc?'),
                _buildQuickChip('💊 Đau bụng / sốt', 'Tôi bị sốt và đau bụng, tôi nên dùng thuốc gì an toàn?'),
                _buildQuickChip('🧘 Tôi đang rất hoảng sợ', 'Tôi đang đi một mình và cảm thấy rất hoảng loạn, khó thở, tim đập nhanh. Hãy giúp tôi.'),
                _buildQuickChip('🐝 Ong / côn trùng đốt', 'Tôi bị ong/côn trùng cắn sưng tấy, phải làm sao?'),
              ],
            ),
          ),

          // Danh sách tin nhắn trò chuyện
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              physics: const BouncingScrollPhysics(),
              itemCount: _messages.length,
              itemBuilder: (context, index) {
                final message = _messages[index];
                final isUser = message.role == 'user';
                return _buildMessageBubble(message, isUser);
              },
            ),
          ),

          // Hiệu ứng đang tải (AI Typing)
          if (_isLoading)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
              child: Row(
                children: [
                  const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF10B981)),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    'SoloCare AI đang phân tích sơ cứu...',
                    style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 12),
                  ),
                ],
              ),
            ),

          // Thanh công cụ phụ: Nút bật bài tập thở
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
            child: Row(
              children: [
                InkWell(
                  onTap: _toggleBreathingExercise,
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: _isBreathingActive
                          ? const Color(0xFF10B981).withValues(alpha: 0.2)
                          : Colors.white.withValues(alpha: 0.05),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: _isBreathingActive ? const Color(0xFF10B981) : Colors.white12,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.air_rounded,
                          size: 15,
                          color: _isBreathingActive ? const Color(0xFF10B981) : Colors.white70,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          _isBreathingActive ? 'Tắt bài thở 4-7-8' : '🧘 Luyện thở 4-7-8 hạ nhịp tim',
                          style: TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w600,
                            color: _isBreathingActive ? const Color(0xFF10B981) : Colors.white70,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Ô nhập tin nhắn & nút gửi
          Container(
            padding: EdgeInsets.fromLTRB(14, 6, 14, 10 + bottomInset),
            decoration: const BoxDecoration(
              color: Color(0xFF0F172A),
              border: Border(top: BorderSide(color: Colors.white10)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(22),
                          border: Border.all(color: Colors.white12),
                        ),
                        child: TextField(
                          controller: _textController,
                          style: const TextStyle(color: Colors.white, fontSize: 13.5),
                          maxLines: 3,
                          minLines: 1,
                          textInputAction: TextInputAction.send,
                          onSubmitted: (_) => _handleSendMessage(),
                          decoration: const InputDecoration(
                            hintText: 'Hỏi về vết thương, thuốc, hoặc tâm sự...',
                            hintStyle: TextStyle(color: Colors.white38, fontSize: 12.5),
                            border: InputBorder.none,
                            contentPadding: EdgeInsets.symmetric(vertical: 10),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          colors: [Color(0xFF059669), Color(0xFF10B981)],
                        ),
                      ),
                      child: IconButton(
                        icon: const Icon(Icons.send_rounded, color: Colors.white, size: 18),
                        onPressed: _isLoading ? null : () => _handleSendMessage(),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                const Text(
                  'SoloCare AI hỗ trợ sơ cứu ban đầu, không thay thế chẩn đoán bác sĩ. Trường hợp nguy kịch hãy gọi 115.',
                  style: TextStyle(color: Colors.white38, fontSize: 9.5),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickChip(String label, String prompt) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ActionChip(
        backgroundColor: const Color(0xFF1E293B),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Colors.white12),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        label: Text(
          label,
          style: const TextStyle(color: Colors.white70, fontSize: 11.5),
        ),
        onPressed: () => _handleSendMessage(prompt),
      ),
    );
  }

  Widget _buildMessageBubble(SoloCareMessage message, bool isUser) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment: isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!isUser) ...[
            Container(
              width: 28,
              height: 28,
              margin: const EdgeInsets.only(right: 8, top: 2),
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(colors: [Color(0xFF059669), Color(0xFF10B981)]),
              ),
              child: const Icon(Icons.health_and_safety_rounded, color: Colors.white, size: 15),
            ),
          ],
          Flexible(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: isUser ? const Color(0xFF0284C7) : const Color(0xFF1E293B),
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(18),
                  topRight: const Radius.circular(18),
                  bottomLeft: Radius.circular(isUser ? 18 : 4),
                  bottomRight: Radius.circular(isUser ? 4 : 18),
                ),
                border: Border.all(
                  color: isUser ? Colors.transparent : Colors.white12,
                ),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x10000000),
                    blurRadius: 6,
                    offset: Offset(0, 2),
                  ),
                ],
              ),
              child: SelectableText(
                message.content,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  height: 1.45,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBreathingWidget() {
    final phaseNames = ['Hít vào sâu...', 'Giữ hơi thở...', 'Thở ra chậm rãi...'];
    final phaseColors = [const Color(0xFF38BDF8), const Color(0xFFF59E0B), const Color(0xFF10B981)];

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: phaseColors[_breathingPhase].withValues(alpha: 0.5)),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: phaseColors[_breathingPhase].withValues(alpha: 0.2),
              border: Border.all(color: phaseColors[_breathingPhase], width: 2),
            ),
            alignment: Alignment.center,
            child: Text(
              '$_breathingCountdown',
              style: TextStyle(
                color: phaseColors[_breathingPhase],
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  phaseNames[_breathingPhase],
                  style: TextStyle(
                    color: phaseColors[_breathingPhase],
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 2),
                const Text(
                  'Bài tập thở 4-7-8 giúp kích hoạt hệ thần kinh phó giao cảm để hạ nhịp tim.',
                  style: TextStyle(color: Colors.white60, fontSize: 11),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.close_rounded, color: Colors.white54, size: 18),
            onPressed: _toggleBreathingExercise,
          ),
        ],
      ),
    );
  }
}
