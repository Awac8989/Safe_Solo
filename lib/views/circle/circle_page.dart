import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_strings.dart';
import '../../core/app_theme.dart';
import '../../core/providers/app_provider.dart';
import '../../core/widgets/app_shell.dart';
import '../../core/widgets/voice_waveform.dart';

class CirclePage extends StatefulWidget {
  const CirclePage({super.key});

  @override
  State<CirclePage> createState() => _CirclePageState();
}

class _CirclePageState extends State<CirclePage> {
  CircleScope _filter = CircleScope.family;

  Future<void> _openComposer() async {
    final controller = TextEditingController();
    Mood selectedMood = Mood.calm;

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              title: const Text('Dang trang thai'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: controller,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      hintText: 'Ban muon ca nha biet dieu gi hom nay?',
                    ),
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<Mood>(
                    initialValue: selectedMood,
                    dropdownColor: Colors.white,
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                    iconEnabledColor: AppColors.textPrimary,
                    style: AppTextStyles.bodyLarge.copyWith(
                      color: AppColors.textPrimary,
                    ),
                    decoration: const InputDecoration(
                      labelText: 'Cam xuc',
                      filled: true,
                      fillColor: Colors.white,
                    ),
                    items: Mood.values
                        .map(
                          (mood) => DropdownMenuItem(
                            value: mood,
                            child: Text(
                              _moodLabel(mood),
                              style: AppTextStyles.bodyLarge.copyWith(
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      setState(() => selectedMood = value ?? Mood.calm);
                    },
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext),
                  child: const Text('Huy'),
                ),
                ElevatedButton(
                  onPressed: () async {
                    final text = controller.text.trim();
                    if (text.isEmpty) {
                      return;
                    }
                    await dialogContext.read<AppProvider>().createCirclePost(
                      message: text,
                      mood: selectedMood,
                      scope: _filter,
                    );
                    if (!dialogContext.mounted) {
                      return;
                    }
                    Navigator.pop(dialogContext);
                  },
                  child: const Text('Dang'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final appProvider = context.watch<AppProvider>();
    final strings = AppStrings.of(context);
    final userName = appProvider.user?.name ?? strings.text('Bạn', 'You');
    final posts = appProvider.postsFor(_filter);

    return AppPage(
      child: ListView(
        padding: const EdgeInsets.only(top: 18, bottom: 24),
        children: [
          Row(
            children: [
              const Icon(
                Icons.auto_awesome_outlined,
                color: AppColors.primary,
                size: 24,
              ),
              const SizedBox(width: 8),
              Text(
                strings.text('Vòng tròn Bình an', 'Alive Circle'),
                style: AppTextStyles.h2.copyWith(fontSize: 26),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            strings.text(
              'Bảng tin bình an cho gia đình và cộng đồng.',
              'Safety updates for family and community.',
            ),
            style: AppTextStyles.bodyLarge.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 18),
          AppSegmentedControl<CircleScope>(
            value: _filter,
            items: [
              AppSegmentItem(
                value: CircleScope.family,
                label: strings.text('Gia đình', 'Family'),
                icon: Icons.groups_2_outlined,
              ),
              AppSegmentItem(
                value: CircleScope.community,
                label: strings.text('Cộng đồng', 'Community'),
                icon: Icons.workspace_premium_outlined,
              ),
            ],
            onChanged: (value) => setState(() => _filter = value),
          ),
          const SizedBox(height: 18),
          GestureDetector(
            onTap: _openComposer,
            child: AppCard(
              child: Row(
                children: [
                  Container(
                    width: 50,
                    height: 50,
                    decoration: const BoxDecoration(
                      color: Color(0xFF3DC87D),
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      userName.substring(0, 1).toUpperCase(),
                      style: AppTextStyles.title.copyWith(color: Colors.white),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Dang mot status nhanh',
                          style: AppTextStyles.title,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Cham de chia se mood, check-in hoac thong diep ngan',
                          style: AppTextStyles.body.copyWith(
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(
                    Icons.edit_note_rounded,
                    color: AppColors.warning,
                    size: 30,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 18),
          for (final post in posts) ...[
            _CirclePostCard(
              post: post,
              onCheer: () => context.read<AppProvider>().toggleCircleCheer(post.id),
              onReply: () => _openReplySheet(context, post),
            ),
            const SizedBox(height: 16),
          ],
          if (posts.isEmpty)
            AppCard(
              child: Text(
                'Chua co bai dang nao. Hay chia se trang thai dau tien cua ban.',
                style: AppTextStyles.bodyLarge,
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _openReplySheet(BuildContext context, CirclePost post) async {
    final controller = TextEditingController();

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 10,
            bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 20,
          ),
          child: Consumer<AppProvider>(
            builder: (context, provider, _) {
              final livePost = provider.circlePosts
                  .where((item) => item.id == post.id)
                  .firstOrNull;

              return Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 48,
                      height: 5,
                      decoration: BoxDecoration(
                        color: AppColors.border,
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  Text('Phan hoi bai dang', style: AppTextStyles.h3),
                  const SizedBox(height: 6),
                  Text(
                    livePost?.message ?? post.message,
                    style: AppTextStyles.body.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 16),
                  if ((livePost?.replyItems ?? post.replyItems).isNotEmpty)
                    ...[
                      SizedBox(
                        height: 220,
                        child: ListView.separated(
                          itemCount: (livePost?.replyItems ?? post.replyItems).length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (context, index) {
                            final reply = (livePost?.replyItems ?? post.replyItems)[index];
                            return AppCard(
                              padding: const EdgeInsets.all(14),
                              color: reply.mine ? AppColors.primarySoft : AppColors.accent,
                              shadow: const [],
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(reply.author, style: AppTextStyles.bodyStrong),
                                  const SizedBox(height: 4),
                                  Text(reply.message, style: AppTextStyles.bodyLarge),
                                  const SizedBox(height: 4),
                                  Text(
                                    _formatRelativeTime(reply.createdAt),
                                    style: AppTextStyles.caption,
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 14),
                    ],
                  TextField(
                    controller: controller,
                    minLines: 2,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      hintText: 'Gui loi nhan dong vien hoac trao doi nhanh...',
                    ),
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () async {
                        final text = controller.text.trim();
                        if (text.isEmpty) {
                          return;
                        }
                        await sheetContext.read<AppProvider>().replyToCirclePost(
                          post.id,
                          text,
                        );
                        controller.clear();
                      },
                      child: const Text('Gui phan hoi'),
                    ),
                  ),
                ],
              );
            },
          ),
        );
      },
    );
  }

  String _moodLabel(Mood mood) {
    switch (mood) {
      case Mood.calm:
        return 'Binh an';
      case Mood.happy:
        return 'Tich cuc';
      case Mood.tired:
        return 'Hoi met';
      case Mood.sick:
        return 'Can luu y';
      case Mood.focused:
        return 'Dang tap trung';
    }
  }

  String _formatRelativeTime(DateTime value) {
    final difference = DateTime.now().difference(value);
    if (difference.inMinutes < 1) {
      return 'Vua xong';
    }
    if (difference.inMinutes < 60) {
      return '${difference.inMinutes} phut truoc';
    }
    if (difference.inHours < 24) {
      return '${difference.inHours} gio truoc';
    }
    return '${difference.inDays} ngay truoc';
  }
}

class _CirclePostCard extends StatelessWidget {
  const _CirclePostCard({
    required this.post,
    required this.onCheer,
    required this.onReply,
  });

  final CirclePost post;
  final VoidCallback onCheer;
  final VoidCallback onReply;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: post.mine ? const Color(0xFFE3F0FF) : const Color(0xFFDFF3E9),
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  post.author.substring(0, 1).toUpperCase(),
                  style: AppTextStyles.title.copyWith(color: AppColors.primary),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(post.author, style: AppTextStyles.title),
                    Text(_formatRelativeTime(post.createdAt), style: AppTextStyles.caption),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  post.scope == CircleScope.family ? 'Gia dinh' : 'Cong dong',
                  style: AppTextStyles.caption.copyWith(color: AppColors.primary),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              const Icon(
                Icons.sentiment_satisfied_alt_rounded,
                color: AppColors.warning,
                size: 40,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  post.moodLabel,
                  style: AppTextStyles.h3.copyWith(fontSize: 20),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            post.message,
            style: AppTextStyles.bodyLarge.copyWith(
              color: AppColors.textPrimary,
              height: 1.55,
            ),
          ),
          if (post.voiceNote) ...[
            const SizedBox(height: 18),
            AppCard(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              color: AppColors.accent,
              shadow: const [],
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: const BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.play_arrow_rounded, color: Colors.white),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: VoiceWaveform(
                      bars: 18,
                      progress: 0.45,
                      height: 24,
                      barWidth: 2,
                      gap: 4,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    '0:15',
                    style: AppTextStyles.bodyStrong.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ],
          if (post.replyItems.isNotEmpty) ...[
            const SizedBox(height: 16),
            AppCard(
              padding: const EdgeInsets.all(14),
              color: AppColors.accent,
              shadow: const [],
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Phan hoi moi nhat', style: AppTextStyles.bodyStrong),
                  const SizedBox(height: 8),
                  Text(
                    '${post.replyItems.last.author}: ${post.replyItems.last.message}',
                    style: AppTextStyles.body.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 18),
          const Divider(),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _ActionPill(
                  icon: post.cheeredByMe
                      ? Icons.favorite_rounded
                      : Icons.favorite_border_rounded,
                  iconColor: post.cheeredByMe ? AppColors.destructive : AppColors.textPrimary,
                  label: 'Gui dong vien · ${post.cheers}',
                  onTap: onCheer,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _ActionPill(
                  icon: Icons.reply_rounded,
                  label: 'Phan hoi · ${post.replies}',
                  onTap: onReply,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatRelativeTime(DateTime value) {
    final difference = DateTime.now().difference(value);
    if (difference.inMinutes < 1) {
      return 'Vua xong';
    }
    if (difference.inMinutes < 60) {
      return '${difference.inMinutes} phut truoc';
    }
    if (difference.inHours < 24) {
      return '${difference.inHours} gio truoc';
    }
    return '${difference.inDays} ngay truoc';
  }
}

class _ActionPill extends StatelessWidget {
  const _ActionPill({
    required this.icon,
    required this.label,
    required this.onTap,
    this.iconColor,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: AppColors.secondary,
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 18, color: iconColor ?? AppColors.textPrimary),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  label,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.bodyStrong,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
