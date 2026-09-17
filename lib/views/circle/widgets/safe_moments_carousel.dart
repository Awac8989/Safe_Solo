import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/app_strings.dart';
import '../../../core/app_theme.dart';
import '../../../core/providers/app_provider.dart';
import '../../../core/widgets/top_toast.dart';
import '../../../core/widgets/voice_waveform.dart';
import '../../../models/safe_moment_model.dart';

class SafeMomentsCarousel extends StatefulWidget {
  const SafeMomentsCarousel({super.key});

  @override
  State<SafeMomentsCarousel> createState() => _SafeMomentsCarouselState();
}

class _SafeMomentsCarouselState extends State<SafeMomentsCarousel> {
  late final List<SafeMomentModel> _moments;

  @override
  void initState() {
    super.initState();
    _moments = [
      SafeMomentModel(
        id: 'moment-1',
        authorName: 'Mẹ',
        mood: 'calm',
        caption: 'Mẹ và ba đã về tới quê an toàn rồi nhé con, ở một mình nhớ khóa cửa cẩn thận.',
        voiceNoteUrl: 'mock_mom_voice.aac',
        createdAt: DateTime.now().subtract(const Duration(minutes: 42)),
      ),
      SafeMomentModel(
        id: 'moment-2',
        authorName: 'Anh Hai',
        mood: 'vigilant',
        caption: 'Vừa xong ca trực đêm, anh ghé mua đồ ăn sáng rồi về nhà nghỉ.',
        createdAt: DateTime.now().subtract(const Duration(hours: 2, minutes: 15)),
      ),
      SafeMomentModel(
        id: 'moment-3',
        authorName: 'Linh (Bạn cùng phòng)',
        mood: 'energized',
        caption: 'Đang đi Grab về nhà trọ, bác tài xế vui vẻ nhiệt tình lắm!',
        voiceNoteUrl: 'mock_linh_voice.aac',
        createdAt: DateTime.now().subtract(const Duration(hours: 4, minutes: 10)),
      ),
      SafeMomentModel(
        id: 'moment-4',
        authorName: 'Bác tổ trưởng TDP',
        mood: 'calm',
        caption: 'Ngõ 85 tối nay có dân phòng đi tuần, các cháu đi làm về muộn cứ yên tâm.',
        createdAt: DateTime.now().subtract(const Duration(hours: 6)),
      ),
    ];
  }

  void _openCreateMomentSheet(BuildContext context) {
    final strings = AppStrings.of(context);
    final textController = TextEditingController();
    String selectedMood = 'calm';
    bool attachVoice = false;

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 24,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 44,
                      height: 5,
                      decoration: BoxDecoration(
                        color: AppColors.border,
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: AppColors.primarySoft,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.camera_alt_rounded,
                          color: AppColors.primary,
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          strings.text('Điểm danh bình an 24h', '24h Safe Moment Check-in'),
                          style: AppTextStyles.h2.copyWith(fontSize: 20),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: textController,
                    maxLines: 3,
                    style: AppTextStyles.bodyLarge,
                    decoration: InputDecoration(
                      hintText: strings.text(
                        'Ví dụ: "Đã về phòng trọ an toàn...", "Đang ở thư viện"',
                        'e.g. "Arrived home safely", "Studying in library"',
                      ),
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    strings.text('Cảm xúc hiện tại:', 'Current mood:'),
                    style: AppTextStyles.title.copyWith(fontSize: 14),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      _moodChip('calm', 'Bình an', Icons.sentiment_satisfied_rounded, selectedMood, (m) {
                        setSheetState(() => selectedMood = m);
                      }),
                      const SizedBox(width: 8),
                      _moodChip('vigilant', 'Cảnh giác', Icons.remove_red_eye_rounded, selectedMood, (m) {
                        setSheetState(() => selectedMood = m);
                      }),
                      const SizedBox(width: 8),
                      _moodChip('energized', 'Vui vẻ', Icons.mood_rounded, selectedMood, (m) {
                        setSheetState(() => selectedMood = m);
                      }),
                    ],
                  ),
                  const SizedBox(height: 14),
                  InkWell(
                    onTap: () {
                      setSheetState(() => attachVoice = !attachVoice);
                    },
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: attachVoice ? AppColors.primarySoft : Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: attachVoice ? AppColors.primary : AppColors.border,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.mic_rounded,
                            color: attachVoice ? AppColors.primary : AppColors.textMuted,
                            size: 20,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              attachVoice
                                  ? strings.text('Đã kèm tin nhắn thoại 5s', '5s Voice note attached')
                                  : strings.text('Kèm tin nhắn thoại điểm danh', 'Attach voice check-in note'),
                              style: AppTextStyles.body.copyWith(
                                color: attachVoice ? AppColors.primary : AppColors.textPrimary,
                                fontWeight: attachVoice ? FontWeight.w600 : FontWeight.normal,
                              ),
                            ),
                          ),
                          Checkbox(
                            value: attachVoice,
                            activeColor: AppColors.primary,
                            onChanged: (val) {
                              setSheetState(() => attachVoice = val ?? false);
                            },
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () {
                        final text = textController.text.trim();
                        final newMoment = SafeMomentModel(
                          id: 'moment-${DateTime.now().millisecondsSinceEpoch}',
                          authorName: context.read<AppProvider>().user?.name ?? 'Bạn',
                          mood: selectedMood,
                          caption: text.isNotEmpty
                              ? text
                              : strings.text('Điểm danh an toàn', 'Checked in safe'),
                          voiceNoteUrl: attachVoice ? 'user_voice_moment.aac' : null,
                          createdAt: DateTime.now(),
                        );
                        setState(() {
                          _moments.insert(0, newMoment);
                        });
                        Navigator.pop(sheetContext);
                        TopToast.show(
                          context,
                          message: strings.text(
                            'Đã đăng khoảnh khắc bình an 24h!',
                            '24h Safe Moment posted!',
                          ),
                          icon: Icons.check_circle_outline_rounded,
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: Text(
                        strings.text('Đăng điểm danh 24h', 'Post 24h Check-in'),
                        style: AppTextStyles.title.copyWith(color: Colors.white),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _moodChip(
    String id,
    String label,
    IconData icon,
    String current,
    ValueChanged<String> onSelect,
  ) {
    final isSelected = id == current;
    return Expanded(
      child: GestureDetector(
        onTap: () => onSelect(id),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.primarySoft : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? AppColors.primary : AppColors.border,
            ),
          ),
          child: Column(
            children: [
              Icon(
                icon,
                color: isSelected ? AppColors.primary : AppColors.textMuted,
                size: 20,
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: AppTextStyles.caption.copyWith(
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  color: isSelected ? AppColors.primary : AppColors.textSecondary,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _viewMoment(BuildContext context, SafeMomentModel moment) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _SafeMomentViewerModal(moment: moment),
    );
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                color: AppColors.success,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              strings.text('Khoảnh khắc an toàn 24h', '24h Safe Moments'),
              style: AppTextStyles.title.copyWith(fontSize: 16),
            ),
            const Spacer(),
            Text(
              strings.text('Tự biến mất sau 24h', 'Expires in 24h'),
              style: AppTextStyles.caption.copyWith(color: AppColors.textMuted),
            ),
          ],
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 104,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            itemCount: _moments.length + 1,
            separatorBuilder: (_, __) => const SizedBox(width: 14),
            itemBuilder: (context, index) {
              if (index == 0) {
                // Add Moment Button
                return GestureDetector(
                  onTap: () => _openCreateMomentSheet(context),
                  child: Column(
                    children: [
                      Stack(
                        children: [
                          Container(
                            width: 66,
                            height: 66,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: AppColors.primary.withValues(alpha: 0.3),
                                width: 2,
                                strokeAlign: BorderSide.strokeAlignOutside,
                              ),
                              color: AppColors.primarySoft,
                            ),
                            alignment: Alignment.center,
                            child: const Icon(
                              Icons.add_rounded,
                              color: AppColors.primary,
                              size: 32,
                            ),
                          ),
                          Positioned(
                            bottom: 0,
                            right: 0,
                            child: Container(
                              padding: const EdgeInsets.all(3),
                              decoration: const BoxDecoration(
                                color: AppColors.primary,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.shield_rounded,
                                color: Colors.white,
                                size: 14,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      SizedBox(
                        width: 72,
                        child: Text(
                          strings.text('+ Điểm danh', '+ Check-in'),
                          style: AppTextStyles.caption.copyWith(
                            fontWeight: FontWeight.w600,
                            color: AppColors.primary,
                          ),
                          textAlign: TextAlign.center,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                );
              }

              final moment = _moments[index - 1];
              final hasVoice = moment.voiceNoteUrl != null;

              return GestureDetector(
                onTap: () => _viewMoment(context, moment),
                child: Column(
                  children: [
                    Stack(
                      children: [
                        Container(
                          width: 66,
                          height: 66,
                          padding: const EdgeInsets.all(3),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: const LinearGradient(
                              colors: [Color(0xFF2FB56C), Color(0xFF00C6FF)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                          ),
                          child: Container(
                            decoration: const BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                            ),
                            alignment: Alignment.center,
                            child: CircleAvatar(
                              radius: 27,
                              backgroundColor: AppColors.primarySoft,
                              child: Text(
                                moment.authorName.substring(0, 1).toUpperCase(),
                                style: AppTextStyles.title.copyWith(
                                  color: AppColors.primary,
                                  fontSize: 18,
                                ),
                              ),
                            ),
                          ),
                        ),
                        if (hasVoice)
                          Positioned(
                            bottom: 2,
                            right: 2,
                            child: Container(
                              padding: const EdgeInsets.all(4),
                              decoration: const BoxDecoration(
                                color: Color(0xFF3B82F6),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.mic_rounded,
                                color: Colors.white,
                                size: 12,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    SizedBox(
                      width: 72,
                      child: Text(
                        moment.authorName,
                        style: AppTextStyles.caption.copyWith(
                          fontWeight: FontWeight.w500,
                        ),
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _SafeMomentViewerModal extends StatefulWidget {
  const _SafeMomentViewerModal({required this.moment});

  final SafeMomentModel moment;

  @override
  State<_SafeMomentViewerModal> createState() => _SafeMomentViewerModalState();
}

class _SafeMomentViewerModalState extends State<_SafeMomentViewerModal> {
  bool _isPlaying = false;
  double _playbackProgress = 0.0;
  Timer? _playbackTimer;

  @override
  void dispose() {
    _playbackTimer?.cancel();
    super.dispose();
  }

  void _toggleAudio() {
    if (_isPlaying) {
      _playbackTimer?.cancel();
      setState(() => _isPlaying = false);
    } else {
      setState(() {
        _isPlaying = true;
        _playbackProgress = 0.0;
      });
      _playbackTimer = Timer.periodic(const Duration(milliseconds: 100), (timer) {
        if (!mounted) return;
        setState(() {
          _playbackProgress += 0.033;
          if (_playbackProgress >= 1.0) {
            _playbackProgress = 1.0;
            _isPlaying = false;
            timer.cancel();
          }
        });
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    final m = widget.moment;
    final hasVoice = m.voiceNoteUrl != null;

    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF161B22),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 44,
            height: 5,
            decoration: BoxDecoration(
              color: Colors.white24,
              borderRadius: BorderRadius.circular(999),
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: AppColors.primary,
                child: Text(
                  m.authorName.substring(0, 1).toUpperCase(),
                  style: AppTextStyles.title.copyWith(color: Colors.white),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      m.authorName,
                      style: AppTextStyles.title.copyWith(color: Colors.white),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      strings.text(
                        'Điểm danh an toàn • Tự biến mất sau 24h',
                        'Safe check-in • Disappears in 24h',
                      ),
                      style: AppTextStyles.caption.copyWith(color: Colors.white70),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded, color: Colors.white70),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: const Color(0xFF21262D),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white10),
            ),
            child: Text(
              m.caption,
              style: AppTextStyles.bodyLarge.copyWith(
                color: Colors.white,
                height: 1.4,
              ),
            ),
          ),
          if (hasVoice) ...[
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFF0D1117),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.4)),
              ),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: _toggleAudio,
                    child: Container(
                      width: 42,
                      height: 42,
                      decoration: const BoxDecoration(
                        color: AppColors.primary,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        _isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                        color: Colors.white,
                        size: 26,
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          strings.text('Tin nhắn thoại bình an (0:05)', 'Voice note check-in (0:05)'),
                          style: AppTextStyles.caption.copyWith(color: Colors.white70),
                        ),
                        const SizedBox(height: 6),
                        VoiceWaveform(
                          seed: m.id,
                          bars: 24,
                          progress: _playbackProgress,
                          height: 20,
                          barWidth: 3,
                          gap: 3,
                          color: Colors.white30,
                          activeColor: AppColors.primary,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.pop(context);
                    TopToast.show(
                      context,
                      message: strings.text(
                        'Đã gửi lời động viên bình an tới ${m.authorName}!',
                        'Cheered ${m.authorName} safely!',
                      ),
                      icon: Icons.favorite_rounded,
                    );
                  },
                  icon: const Icon(Icons.favorite_rounded, color: Color(0xFFFF5252)),
                  label: Text(strings.text('Thả tim bình an', 'Send safe cheer')),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF21262D),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
