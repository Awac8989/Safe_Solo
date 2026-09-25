import 'dart:async';
import 'dart:io';

import 'package:audioplayers/audioplayers.dart';
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
import '../../services/audio_note_service.dart';
import '../audio/fake_call_setup_sheet.dart';
import '../audio/walkie_talkie_dialog.dart';

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
          const SizedBox(height: 20),
          // Audio & Voice Communication Tools
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () {
                    showModalBottomSheet<void>(
                      context: context,
                      isScrollControlled: true,
                      backgroundColor: Colors.transparent,
                      builder: (_) => const WalkieTalkieDialog(),
                    );
                  },
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF161B22),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFF30363D)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: const BoxDecoration(
                            color: Color(0xFF238636),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.radio_rounded, color: Colors.white, size: 20),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                strings.text('Bộ đàm PTT', 'Walkie-Talkie'),
                                style: AppTextStyles.title.copyWith(color: Colors.white, fontSize: 13),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                strings.text('Kênh thoại tức thì', 'Live voice'),
                                style: AppTextStyles.caption.copyWith(color: Colors.white60, fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: GestureDetector(
                  onTap: () {
                    showModalBottomSheet<void>(
                      context: context,
                      isScrollControlled: true,
                      backgroundColor: Theme.of(context).brightness == Brightness.dark
                          ? AppDarkColors.surface
                          : AppColors.surface,
                      shape: const RoundedRectangleBorder(
                        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                      ),
                      builder: (_) => const FakeCallSetupSheet(),
                    );
                  },
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Theme.of(context).brightness == Brightness.dark
                          ? AppDarkColors.card
                          : Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: Theme.of(context).brightness == Brightness.dark
                            ? AppDarkColors.border
                            : AppColors.border,
                      ),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Theme.of(context).brightness == Brightness.dark
                                ? AppDarkColors.primarySoft
                                : AppColors.primarySoft,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            Icons.phone_in_talk_rounded,
                            color: Theme.of(context).brightness == Brightness.dark
                                ? AppDarkColors.primary
                                : AppColors.primary,
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                strings.text('Gọi thoát hiểm', 'Fake Call'),
                                style: AppTextStyles.title.copyWith(
                                  fontSize: 13,
                                  color: Theme.of(context).brightness == Brightness.dark
                                      ? AppDarkColors.textPrimary
                                      : null,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                strings.text('Ngụy trang cứu nguy', 'Escape tool'),
                                style: AppTextStyles.caption.copyWith(
                                  color: Theme.of(context).brightness == Brightness.dark
                                      ? AppDarkColors.textSecondary
                                      : AppColors.textSecondary,
                                  fontSize: 11,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 22),
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = chat.highlight
        ? (isDark ? const Color(0xFF261D0F) : const Color(0xFFFFFBF2))
        : (isDark ? AppDarkColors.card : AppColors.card);
    final avatarBg = chat.highlight
        ? (isDark ? const Color(0xFF3F2B12) : const Color(0xFFFFF1D7))
        : (isDark ? AppDarkColors.primarySoft : AppColors.primarySoft);
    final avatarTextColor = chat.highlight
        ? AppColors.warning
        : (isDark ? AppDarkColors.primaryGlow : AppColors.primary);

    return GestureDetector(
      onTap: () => _openThread(context),
      child: AppCard(
        color: cardBg,
        borderColor: isDark
            ? (chat.highlight ? const Color(0xFF6A481B) : AppDarkColors.border)
            : null,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: avatarBg,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: Text(
                chat.name.substring(0, 1).toUpperCase(),
                style: AppTextStyles.title.copyWith(
                  color: avatarTextColor,
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
                      Expanded(
                        child: Text(
                          chat.name,
                          style: AppTextStyles.title.copyWith(
                            color: isDark ? AppDarkColors.textPrimary : null,
                          ),
                        ),
                      ),
                      Text(
                        _formatTime(chat.updatedAt),
                        style: AppTextStyles.caption.copyWith(
                          color: isDark ? AppDarkColors.textSecondary : null,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    chat.preview,
                    style: AppTextStyles.bodyLarge.copyWith(
                      color: isDark ? AppDarkColors.textSecondary : AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Icon(
                        Icons.forum_outlined,
                        size: 14,
                        color: isDark ? AppDarkColors.textMuted : AppColors.textSecondary,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${chat.messages.length} ${strings.text('tin nhắn', 'messages')}',
                        style: AppTextStyles.caption.copyWith(
                          color: isDark ? AppDarkColors.textMuted : null,
                        ),
                      ),
                    ],
                  ),
                  if (chat.contactPhone != null && chat.contactPhone!.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Icon(
                          Icons.call_outlined,
                          size: 14,
                          color: isDark ? AppDarkColors.primary : AppColors.primary,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          chat.contactPhone!,
                          style: AppTextStyles.caption.copyWith(
                            color: isDark ? AppDarkColors.primary : null,
                          ),
                        ),
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
                              : (isDark ? AppDarkColors.textMuted : AppColors.textSecondary),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          chat.battery!,
                          style: AppTextStyles.caption.copyWith(
                            color: chat.battery == '12%'
                                ? AppColors.destructive
                                : (isDark ? AppDarkColors.textMuted : AppColors.textSecondary),
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

  Future<void> _sendVoice(BuildContext context, RecordedAudioNote note) async {
    await context.read<AppProvider>().sendVoiceMessage(widget.threadId, note);
    if (!context.mounted) {
      return;
    }
    final seconds = note.durationSeconds;
    final strings = _snapshotStrings();
    TopToast.show(
      context,
      message: strings.text(
        'Đã gửi ghi âm ${seconds}s.',
        'Voice note sent (${note.durationSeconds}s).',
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

    final cleanPhone = phone.replaceAll(RegExp(r'[^0-9+]'), '');
    final uri = Uri.parse('tel:$cleanPhone');
    try {
      final success = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!success && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              strings.text('Không thể gọi tới $phone.', 'Could not call $phone.'),
            ),
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              strings.text('Không thể gọi tới $phone.', 'Could not call $phone.'),
            ),
          ),
        );
      }
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

    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppDarkColors.background : AppColors.background,
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
        decoration: BoxDecoration(
          gradient: isDark
              ? AppDarkColors.backgroundGradient
              : AppColors.backgroundGradient,
        ),
        child: SafeArea(
          top: false,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: thread.highlight
                        ? (isDark ? const Color(0xFF261D0F) : const Color(0xFFFFFBF2))
                        : (isDark ? AppDarkColors.card : AppColors.card),
                    borderRadius: BorderRadius.circular(AppRadius.xl),
                    border: Border.all(
                      color: thread.highlight
                          ? (isDark ? const Color(0xFF6A481B) : const Color(0xFFFFD8A1))
                          : (isDark ? AppDarkColors.border : AppColors.border),
                    ),
                    boxShadow: isDark ? const [] : AppShadows.card,
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
                              style: AppTextStyles.caption.copyWith(
                                color: isDark ? AppDarkColors.textSecondary : null,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              thread.preview,
                              style: AppTextStyles.body.copyWith(
                                color: isDark ? AppDarkColors.textSecondary : AppColors.textSecondary,
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
                    color: isDark
                        ? AppDarkColors.card.withValues(alpha: 0.5)
                        : Colors.white.withValues(alpha: 0.78),
                    borderRadius: BorderRadius.circular(AppRadius.xl),
                    border: Border.all(
                      color: isDark
                          ? AppDarkColors.border
                          : AppColors.border.withValues(alpha: 0.95),
                    ),
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
                                color: isDark ? AppDarkColors.textSecondary : AppColors.textSecondary,
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
            color: isDark ? AppDarkColors.surface : AppColors.card,
            border: Border(
              top: BorderSide(
                color: isDark ? AppDarkColors.border : AppColors.border.withValues(alpha: 0.9),
              ),
            ),
            boxShadow: isDark
                ? const []
                : const [
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
              PushToTalkButton(
                onSend: (note) => _sendVoice(context, note),
                onError: (message) {
                  if (!context.mounted) {
                    return;
                  }
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(message)),
                  );
                },
              ),
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
                    fillColor: isDark ? AppDarkColors.card : AppColors.backgroundAlt,
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    if (message.isSystem) {
      return Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: isDark ? AppDarkColors.surface : AppColors.secondary,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            message.content,
            textAlign: TextAlign.center,
            style: AppTextStyles.caption.copyWith(
              color: isDark ? AppDarkColors.textSecondary : AppColors.textSecondary,
            ),
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
            color: alignEnd
                ? AppColors.primary
                : (isDark ? AppDarkColors.card : AppColors.card),
            borderColor: alignEnd
                ? null
                : (isDark ? AppDarkColors.border : null),
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
                        color: isDark ? AppDarkColors.textSecondary : AppColors.textSecondary,
                      ),
                    ),
                  ),
                if (message.isVoiceNote)
                  _VoiceNotePlayer(message: message, alignEnd: alignEnd)
                else
                  Text(
                    message.content,
                    style: AppTextStyles.bodyLarge.copyWith(
                      color: alignEnd
                          ? Colors.white
                          : (isDark ? AppDarkColors.textPrimary : AppColors.textPrimary),
                    ),
                  ),
                const SizedBox(height: 6),
                Text(
                  _formatTime(message.createdAt),
                  style: AppTextStyles.caption.copyWith(
                    color: alignEnd
                        ? Colors.white.withValues(alpha: 0.85)
                        : (isDark ? AppDarkColors.textMuted : AppColors.textMuted),
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
  late final AudioPlayer _player = AudioPlayer();
  Timer? _ticker;
  double _progress = 0;
  bool _playing = false;
  Duration _duration = Duration.zero;
  Duration _position = Duration.zero;

  @override
  void initState() {
    super.initState();
    _player.onDurationChanged.listen((value) {
      if (mounted) {
        setState(() => _duration = value);
      }
    });
    _player.onPositionChanged.listen((value) {
      if (mounted) {
        setState(() => _position = value);
      }
    });
    _player.onPlayerComplete.listen((_) {
      if (mounted) {
        setState(() {
          _playing = false;
          _position = Duration.zero;
          _progress = 0;
        });
      }
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _player.dispose();
    super.dispose();
  }

  Future<void> _togglePlay() async {
    final voicePath = widget.message.voicePath;
    if (voicePath != null && voicePath.isNotEmpty) {
      if (!File(voicePath).existsSync()) {
        return;
      }
      if (_playing) {
        await _player.pause();
        if (mounted) {
          setState(() => _playing = false);
        }
        return;
      }

      await _player.stop();
      setState(() {
        _position = Duration.zero;
        _duration = Duration.zero;
      });
      setState(() => _playing = true);
      try {
        await _player.play(DeviceFileSource(voicePath));
      } catch (_) {
        if (mounted) {
          setState(() => _playing = false);
        }
      }
      return;
    }

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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final foreground = widget.alignEnd
        ? Colors.white
        : (isDark ? AppDarkColors.textPrimary : AppColors.textPrimary);
    final muted = widget.alignEnd
        ? Colors.white.withValues(alpha: 0.78)
        : (isDark ? AppDarkColors.textSecondary : AppColors.textSecondary);
    final liveProgress = _duration.inMilliseconds > 0
        ? (_position.inMilliseconds / _duration.inMilliseconds).clamp(0.0, 1.0)
        : _progress;

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
                  : (isDark ? AppDarkColors.primarySoft : AppColors.primarySoft),
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
            progress: liveProgress,
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
