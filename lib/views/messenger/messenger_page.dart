import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_strings.dart';
import '../../core/app_theme.dart';
import '../../core/providers/app_provider.dart';
import '../../core/widgets/app_shell.dart';
import '../../core/widgets/push_to_talk_button.dart';
import '../../core/widgets/top_toast.dart';
import '../../core/widgets/voice_waveform.dart';

class MessengerPage extends StatelessWidget {
  const MessengerPage({super.key});

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    final threads = context.watch<AppProvider>().chatThreads;
    final grouped = <String, List<ChatThread>>{};

    for (final thread in threads) {
      final key = _displayGroupLabel(strings, thread.groupLabel, thread.id);
      grouped.putIfAbsent(key, () => []).add(thread);
    }

    return AppPage(
      child: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.only(top: 18, bottom: 22),
        children: [
          Text(
            strings.text('Tin nhắn', 'Messages'),
            style: AppTextStyles.h2.copyWith(fontSize: 28),
          ),
          const SizedBox(height: 8),
          Text(
            strings.text(
              'Hộp thư gia đình, cộng đồng và kênh hỗ trợ.',
              'Family, community, and support inboxes.',
            ),
            style: AppTextStyles.bodyLarge.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 26),
          for (final entry in grouped.entries) ...[
            AppSectionLabel(entry.key),
            const SizedBox(height: 12),
            for (final chat in entry.value) ...[
              _ChatCard(chat: chat),
              const SizedBox(height: 14),
            ],
            const SizedBox(height: 10),
          ],
        ],
      ),
    );
  }

  static String _displayGroupLabel(
    AppStrings strings,
    String raw,
    String threadId,
  ) {
    switch (threadId) {
      case 'family':
        return strings.text('Gia đình', 'Family');
      case 'emergency':
        return strings.text('Hiệp sĩ', 'Heroes');
      case 'community':
        return strings.text('Cộng đồng', 'Community');
      default:
        return raw;
    }
  }
}

class _ChatCard extends StatelessWidget {
  const _ChatCard({required this.chat});

  final ChatThread chat;

  Future<void> _openThread(BuildContext context) async {
    await context.read<AppProvider>().markThreadRead(chat.id);
    if (!context.mounted) {
      return;
    }
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _ThreadDetailPage(threadId: chat.id),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    return GestureDetector(
      onTap: () => _openThread(context),
      child: AppCard(
        color: chat.highlight ? const Color(0xFFFFFBF2) : AppColors.card,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: chat.highlight
                    ? const Color(0xFFFFF1D7)
                    : AppColors.primarySoft,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: Text(
                chat.name.substring(0, 1).toUpperCase(),
                style: AppTextStyles.title.copyWith(
                  color: chat.highlight ? AppColors.warning : AppColors.primary,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(child: Text(chat.name, style: AppTextStyles.title)),
                      Text(_formatTime(chat.updatedAt), style: AppTextStyles.caption),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    chat.preview,
                    style: AppTextStyles.bodyLarge.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Icon(
                        Icons.forum_outlined,
                        size: 14,
                        color: AppColors.textSecondary,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${chat.messages.length} ${strings.text('tin nhắn', 'messages')}',
                        style: AppTextStyles.caption,
                      ),
                    ],
                  ),
                  if (chat.contactPhone != null && chat.contactPhone!.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Icon(
                          Icons.call_outlined,
                          size: 14,
                          color: AppColors.primary,
                        ),
                        const SizedBox(width: 4),
                        Text(chat.contactPhone!, style: AppTextStyles.caption),
                      ],
                    ),
                  ],
                  if (chat.battery != null) ...[
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Icon(
                          Icons.battery_3_bar_rounded,
                          size: 14,
                          color: chat.battery == '12%'
                              ? AppColors.destructive
                              : AppColors.textSecondary,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          chat.battery!,
                          style: AppTextStyles.caption.copyWith(
                            color: chat.battery == '12%'
                                ? AppColors.destructive
                                : AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 10),
            if (chat.unread > 0)
              Container(
                width: 22,
                height: 22,
                decoration: const BoxDecoration(
                  color: Color(0xFFEF3C3C),
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  '${chat.unread}',
                  style: AppTextStyles.caption.copyWith(color: Colors.white),
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _formatTime(DateTime date) {
    final hour = date.hour.toString().padLeft(2, '0');
    final minute = date.minute.toString().padLeft(2, '0');
    return '$hour:$minute';
  }
}

class _ThreadDetailPage extends StatefulWidget {
  const _ThreadDetailPage({required this.threadId});

  final String threadId;

  @override
  State<_ThreadDetailPage> createState() => _ThreadDetailPageState();
}

class _ThreadDetailPageState extends State<_ThreadDetailPage> {
  final TextEditingController _controller = TextEditingController();

  AppStrings _snapshotStrings() {
    return AppStrings(context.read<AppProvider>().language);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _send(BuildContext context) async {
    final text = _controller.text.trim();
    if (text.isEmpty) {
      return;
    }
    FocusScope.of(context).unfocus();
    await context.read<AppProvider>().sendQuickMessage(widget.threadId, text);
    _controller.clear();
    if (!context.mounted) {
      return;
    }
    final strings = _snapshotStrings();
    TopToast.show(
      context,
      message: strings.text('Đã gửi tin nhắn.', 'Message sent.'),
      icon: Icons.send_rounded,
    );
  }

  Future<void> _sendVoice(BuildContext context, int seconds) async {
    await context.read<AppProvider>().sendVoiceMessage(widget.threadId, seconds);
    if (!context.mounted) {
      return;
    }
    final strings = _snapshotStrings();
    TopToast.show(
      context,
      message: strings.text(
        'Đã gửi ghi âm ${seconds}s.',
        'Voice note sent (${seconds}s).',
      ),
      icon: Icons.mic_rounded,
    );
  }

  Future<void> _callThread(ChatThread thread) async {
    final strings = _snapshotStrings();
    final phone = thread.contactPhone;
    if (phone == null || phone.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            strings.text(
              'Đoạn chat này chưa có số điện thoại để gọi.',
              'This thread does not have a phone number yet.',
            ),
          ),
        ),
      );
      return;
    }

    final uri = Uri.parse('tel:$phone');
    if (!await launchUrl(uri) && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            strings.text('Không thể gọi tới $phone.', 'Could not call $phone.'),
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AppProvider>();
    final strings = AppStrings.of(context);
    final thread = provider.threadById(widget.threadId);

    if (thread == null) {
      return Scaffold(
        appBar: AppBar(title: Text(strings.text('Tin nhắn', 'Messages'))),
        body: Center(
          child: Text(strings.text('Không tìm thấy đoạn chat.', 'Chat thread not found.')),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(thread.name),
        actions: [
          if (thread.contactPhone != null && thread.contactPhone!.isNotEmpty)
            IconButton(
              onPressed: () => _callThread(thread),
              icon: const Icon(Icons.call_outlined),
              tooltip: strings.text('Gọi điện', 'Call'),
            ),
        ],
      ),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: SafeArea(
          top: false,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: thread.highlight ? const Color(0xFFFFFBF2) : AppColors.card,
                    borderRadius: BorderRadius.circular(AppRadius.xl),
                    border: Border.all(
                      color: thread.highlight
                          ? const Color(0xFFFFD8A1)
                          : AppColors.border,
                    ),
                    boxShadow: AppShadows.card,
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              MessengerPage._displayGroupLabel(
                                strings,
                                thread.groupLabel,
                                thread.id,
                              ),
                              style: AppTextStyles.caption,
                            ),
                            const SizedBox(height: 6),
                            Text(
                              thread.preview,
                              style: AppTextStyles.body.copyWith(
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (thread.contactPhone != null && thread.contactPhone!.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(left: 10),
                          child: OutlinedButton.icon(
                            onPressed: () => _callThread(thread),
                            icon: const Icon(Icons.call_outlined, size: 18),
                            label: Text(strings.text('Gọi', 'Call')),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              Expanded(
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 12),
                  padding: const EdgeInsets.only(top: 8),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.78),
                    borderRadius: BorderRadius.circular(AppRadius.xl),
                    border: Border.all(color: AppColors.border.withValues(alpha: 0.95)),
                  ),
                  child: thread.messages.isEmpty
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Text(
                              strings.text(
                                'Chưa có tin nhắn nào. Hãy gửi tin nhắn đầu tiên hoặc giữ nút mic để gửi ghi âm.',
                                'No messages yet. Send the first message or hold the mic to send a voice note.',
                              ),
                              textAlign: TextAlign.center,
                              style: AppTextStyles.bodyLarge.copyWith(
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(14, 8, 14, 18),
                          keyboardDismissBehavior:
                              ScrollViewKeyboardDismissBehavior.onDrag,
                          itemCount: thread.messages.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (context, index) {
                            final message = thread.messages[index];
                            return _MessageBubble(message: message);
                          },
                        ),
                ),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
          decoration: BoxDecoration(
            color: AppColors.card,
            border: Border(
              top: BorderSide(color: AppColors.border.withValues(alpha: 0.9)),
            ),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0F000000),
                blurRadius: 18,
                offset: Offset(0, -6),
              ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              PushToTalkButton(onSend: (seconds) => _sendVoice(context, seconds)),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: _controller,
                  minLines: 1,
                  maxLines: 4,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => _send(context),
                  decoration: InputDecoration(
                    hintText: strings.text('Nhập tin nhắn phản hồi...', 'Type a reply...'),
                    filled: true,
                    fillColor: AppColors.backgroundAlt,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              SizedBox(
                width: 52,
                height: 52,
                child: ElevatedButton(
                  onPressed: () => _send(context),
                  style: ElevatedButton.styleFrom(
                    padding: EdgeInsets.zero,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                    ),
                  ),
                  child: const Icon(Icons.send_rounded),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    if (message.isSystem) {
      return Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: AppColors.secondary,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            message.content,
            textAlign: TextAlign.center,
            style: AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
          ),
        ),
      );
    }

    final alignEnd = message.mine;
    return Row(
      mainAxisAlignment: alignEnd ? MainAxisAlignment.end : MainAxisAlignment.start,
      children: [
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 290),
          child: AppCard(
            padding: const EdgeInsets.all(14),
            color: alignEnd ? AppColors.primary : AppColors.card,
            shadow: const [],
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (!alignEnd)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text(
                      message.sender,
                      style: AppTextStyles.caption.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                if (message.isVoiceNote)
                  _VoiceNotePlayer(message: message, alignEnd: alignEnd)
                else
                  Text(
                    message.content,
                    style: AppTextStyles.bodyLarge.copyWith(
                      color: alignEnd ? Colors.white : AppColors.textPrimary,
                    ),
                  ),
                const SizedBox(height: 6),
                Text(
                  _formatTime(message.createdAt),
                  style: AppTextStyles.caption.copyWith(
                    color: alignEnd
                        ? Colors.white.withValues(alpha: 0.85)
                        : AppColors.textMuted,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  String _formatTime(DateTime date) {
    final hour = date.hour.toString().padLeft(2, '0');
    final minute = date.minute.toString().padLeft(2, '0');
    return '$hour:$minute';
  }
}

class _VoiceNotePlayer extends StatefulWidget {
  const _VoiceNotePlayer({required this.message, required this.alignEnd});

  final ChatMessage message;
  final bool alignEnd;

  @override
  State<_VoiceNotePlayer> createState() => _VoiceNotePlayerState();
}

class _VoiceNotePlayerState extends State<_VoiceNotePlayer> {
  Timer? _ticker;
  double _progress = 0;
  bool _playing = false;

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  void _togglePlay() {
    if (_playing) {
      _ticker?.cancel();
      setState(() => _playing = false);
      return;
    }

    final totalMs = ((widget.message.voiceSeconds ?? 1) * 1000).clamp(1000, 999000);
    const tickMs = 120;
    _ticker?.cancel();
    setState(() => _playing = true);
    _ticker = Timer.periodic(const Duration(milliseconds: tickMs), (timer) {
      setState(() {
        _progress += tickMs / totalMs;
        if (_progress >= 1) {
          _progress = 1;
          _playing = false;
          timer.cancel();
          Future<void>.delayed(const Duration(milliseconds: 300), () {
            if (mounted) {
              setState(() => _progress = 0);
            }
          });
        }
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final foreground = widget.alignEnd ? Colors.white : AppColors.textPrimary;
    final muted = widget.alignEnd
        ? Colors.white.withValues(alpha: 0.78)
        : AppColors.textSecondary;

    return Row(
      children: [
        InkWell(
          onTap: _togglePlay,
          borderRadius: BorderRadius.circular(999),
          child: Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: widget.alignEnd
                  ? Colors.white.withValues(alpha: 0.18)
                  : AppColors.primarySoft,
              shape: BoxShape.circle,
            ),
            child: Icon(
              _playing ? Icons.pause_rounded : Icons.play_arrow_rounded,
              color: foreground,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: VoiceWaveform(
            seed: widget.message.id,
            progress: _progress,
            height: 22,
            color: muted,
            activeColor: foreground,
          ),
        ),
        const SizedBox(width: 10),
        Text(
          '${widget.message.voiceSeconds ?? 0}s',
          style: AppTextStyles.bodyStrong.copyWith(color: foreground),
        ),
      ],
    );
  }
}
