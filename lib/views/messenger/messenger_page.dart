import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/providers/app_provider.dart';
import '../../core/widgets/app_shell.dart';

class MessengerPage extends StatelessWidget {
  const MessengerPage({super.key});

  @override
  Widget build(BuildContext context) {
    final threads = context.watch<AppProvider>().chatThreads;
    final grouped = <String, List<ChatThread>>{};

    for (final thread in threads) {
      grouped.putIfAbsent(thread.groupLabel, () => []).add(thread);
    }

    return AppPage(
      child: ListView(
        padding: const EdgeInsets.only(top: 18, bottom: 22),
        children: [
          Text('Tin nhan', style: AppTextStyles.h2.copyWith(fontSize: 28)),
          const SizedBox(height: 8),
          Text(
            'Hop thu gia dinh, cong dong va kenh ho tro.',
            style: AppTextStyles.bodyLarge.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 26),
          for (final entry in grouped.entries) ...[
            AppSectionLabel(
              entry.key,
              color: entry.value.any((thread) => thread.highlight)
                  ? AppColors.warning
                  : AppColors.textSecondary,
            ),
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
                      Icon(
                        Icons.forum_outlined,
                        size: 14,
                        color: AppColors.textSecondary,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${chat.messages.length} tin nhan',
                        style: AppTextStyles.caption,
                      ),
                    ],
                  ),
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

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _send(BuildContext context) async {
    await context.read<AppProvider>().sendQuickMessage(
      widget.threadId,
      _controller.text,
    );
    _controller.clear();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AppProvider>();
    final thread = provider.threadById(widget.threadId);

    if (thread == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Tin nhan')),
        body: const Center(child: Text('Khong tim thay doan chat.')),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(thread.name),
      ),
      body: DecoratedBox(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: SafeArea(
          top: false,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 10),
                child: AppCard(
                  color: thread.highlight ? const Color(0xFFFFFBF2) : AppColors.card,
                  shadow: const [],
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(thread.groupLabel, style: AppTextStyles.caption),
                            const SizedBox(height: 4),
                            Text(
                              thread.preview,
                              style: AppTextStyles.body.copyWith(
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (thread.battery != null)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: AppColors.secondary,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(thread.battery!, style: AppTextStyles.caption),
                        ),
                    ],
                  ),
                ),
              ),
              Expanded(
                child: ListView.separated(
                  reverse: false,
                  padding: const EdgeInsets.fromLTRB(20, 6, 20, 20),
                  itemCount: thread.messages.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final message = thread.messages[index];
                    return _MessageBubble(message: message);
                  },
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 18),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _controller,
                        minLines: 1,
                        maxLines: 4,
                        decoration: const InputDecoration(
                          hintText: 'Nhap tin nhan phan hoi...',
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
          constraints: const BoxConstraints(maxWidth: 280),
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
