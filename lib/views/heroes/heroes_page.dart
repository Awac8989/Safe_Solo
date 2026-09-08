import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/app_strings.dart';
import '../../core/app_theme.dart';
import '../../core/providers/app_provider.dart';
import '../../core/widgets/app_shell.dart';

enum _HeroesFilter { ranking, nearby }

class HeroesPage extends StatefulWidget {
  const HeroesPage({super.key});

  @override
  State<HeroesPage> createState() => _HeroesPageState();
}

class _HeroesPageState extends State<HeroesPage> {
  _HeroesFilter _filter = _HeroesFilter.ranking;

  Future<void> _showKycBottomSheet(BuildContext context) async {
    final picker = ImagePicker();
    XFile? frontImage;
    XFile? backImage;
    bool isSubmitting = false;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (bottomSheetContext) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Container(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(context).viewInsets.bottom + 24,
              ),
              decoration: const BoxDecoration(
                color: Color(0xFF1E293B),
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: Colors.white24,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        const Icon(Icons.badge_rounded, color: Color(0xFF38BDF8), size: 24),
                        const SizedBox(width: 8),
                        Text(
                          'Đăng ký Hiệp sĩ & KYC',
                          style: AppTextStyles.h3.copyWith(color: Colors.white),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Tải lên ảnh 2 mặt CCCD / Hộ chiếu để tham gia đội ngũ cứu hộ cộng đồng SafeSolo.',
                      style: AppTextStyles.body.copyWith(color: Colors.white70, fontSize: 13),
                    ),
                    const SizedBox(height: 20),
                    // Mặt trước CCCD
                    _buildImagePickerBox(
                      title: 'Mặt trước CCCD / Hộ chiếu',
                      image: frontImage,
                      onTap: () async {
                        final picked = await picker.pickImage(source: ImageSource.gallery);
                        if (picked != null) {
                          setModalState(() => frontImage = picked);
                        }
                      },
                    ),
                    const SizedBox(height: 14),
                    // Mặt sau CCCD
                    _buildImagePickerBox(
                      title: 'Mặt sau CCCD / Hộ chiếu',
                      image: backImage,
                      onTap: () async {
                        final picked = await picker.pickImage(source: ImageSource.gallery);
                        if (picked != null) {
                          setModalState(() => backImage = picked);
                        }
                      },
                    ),
                    const SizedBox(height: 22),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF0284C7),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        onPressed: (isSubmitting || frontImage == null || backImage == null)
                            ? null
                            : () async {
                                setModalState(() => isSubmitting = true);
                                final ok = await context.read<AppProvider>().submitKycDocuments(
                                      frontPath: frontImage!.path,
                                      backPath: backImage!.path,
                                    );
                                setModalState(() => isSubmitting = false);
                                if (!context.mounted) return;
                                Navigator.of(bottomSheetContext).pop();
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    backgroundColor: ok ? const Color(0xFF059669) : Colors.red,
                                    content: Text(
                                      ok
                                          ? 'Hồ sơ KYC đã gửi thành công! Cổng quản trị đang xét duyệt.'
                                          : 'Gửi hồ sơ KYC thất bại, vui lòng thử lại.',
                                    ),
                                  ),
                                );
                              },
                        child: isSubmitting
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  color: Colors.white,
                                  strokeWidth: 2,
                                ),
                              )
                            : const Text(
                                'NỘP HỒ SƠ XÉT DUYỆT KYC',
                                style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 0.5),
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildImagePickerBox({
    required String title,
    required XFile? image,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFF0F172A),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: image != null ? const Color(0xFF38BDF8) : Colors.white24,
            width: image != null ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            if (image != null && !kIsWeb)
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.file(
                  File(image.path),
                  width: 50,
                  height: 50,
                  fit: BoxFit.cover,
                ),
              )
            else
              Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  color: Colors.white10,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  image != null ? Icons.check_circle_rounded : Icons.camera_alt_outlined,
                  color: image != null ? const Color(0xFF38BDF8) : Colors.white60,
                ),
              ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    image != null ? 'Đã chọn: ${image.name}' : 'Nhấn để chọn ảnh từ thiết bị',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: image != null ? const Color(0xFF38BDF8) : Colors.white38,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              image != null ? Icons.check_circle_rounded : Icons.file_upload_outlined,
              color: image != null ? const Color(0xFF10B981) : Colors.white38,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showThankYouDialog(BuildContext context, HeroProfile hero) async {
    int selectedRating = 5;
    final textController = TextEditingController(
      text: 'Cảm ơn bạn rất nhiều vì đã kịp thời hỗ trợ tôi khi gặp tình huống khẩn cấp!',
    );
    bool isSending = false;

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF1E293B),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              title: Row(
                children: [
                  const Icon(Icons.favorite_rounded, color: Color(0xFFF43F5E), size: 24),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'Cảm ơn & Đánh giá',
                      style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Hiệp sĩ: ${hero.name} · ${hero.location}',
                      style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Chất lượng hỗ trợ:',
                      style: TextStyle(color: Colors.white70, fontSize: 12),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(5, (index) {
                        final star = index + 1;
                        return IconButton(
                          iconSize: 32,
                          icon: Icon(
                            star <= selectedRating ? Icons.star_rounded : Icons.star_outline_rounded,
                            color: const Color(0xFFFBBF24),
                          ),
                          onPressed: () => setDialogState(() => selectedRating = star),
                        );
                      }),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: textController,
                      maxLines: 3,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      decoration: InputDecoration(
                        hintText: 'Nhập lời nhắn cảm ơn gửi tới Hiệp sĩ...',
                        hintStyle: const TextStyle(color: Colors.white38),
                        filled: true,
                        fillColor: const Color(0xFF0F172A),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: Colors.white24),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: Colors.white24),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: Color(0xFF38BDF8)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(),
                  child: const Text('Đóng', style: TextStyle(color: Colors.white60)),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFF43F5E),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: isSending
                      ? null
                      : () async {
                          setDialogState(() => isSending = true);
                          final ok = await context.read<AppProvider>().sendHeroThankYou(
                                heroId: hero.effectiveId,
                                rating: selectedRating,
                                message: textController.text.trim(),
                              );
                          setDialogState(() => isSending = false);
                          if (!context.mounted) return;
                          Navigator.of(dialogContext).pop();
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              backgroundColor: ok ? const Color(0xFF059669) : Colors.red,
                              content: Text(
                                ok
                                    ? 'Đã gửi lời cảm ơn và đánh giá $selectedRating sao tới ${hero.name}!'
                                    : 'Gửi đánh giá thất bại, vui lòng thử lại.',
                              ),
                            ),
                          );
                        },
                  child: isSending
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('GỬI LỜI CẢM ƠN', style: TextStyle(fontWeight: FontWeight.bold)),
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
    final strings = AppStrings.of(context);
    final provider = context.watch<AppProvider>();
    final user = provider.user;
    final isKycVerified = user?.isKycVerified ?? false;
    final heroes = provider.heroes;
    final rows = _filter == _HeroesFilter.ranking
        ? ([...heroes]..sort((a, b) => b.rescues.compareTo(a.rescues)))
        : ([...heroes]..sort((a, b) => a.distanceKm.compareTo(b.distanceKm)));

    return AppPage(
      child: ListView(
        padding: const EdgeInsets.only(top: 18, bottom: 24),
        children: [
          Row(
            children: [
              const Icon(
                Icons.workspace_premium_outlined,
                color: AppColors.warning,
                size: 24,
              ),
              const SizedBox(width: 8),
              Text(strings.text('Hiệp sĩ', 'Heroes'), style: AppTextStyles.h2.copyWith(fontSize: 28)),
              const Spacer(),
              const AppRoundIconButton(icon: Icons.shield_outlined),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            strings.text(
              'Bảng xếp hạng tình nguyện viên và những người có thể hỗ trợ quanh bạn.',
              'Ranking of volunteers and people who can help nearby.',
            ),
            style: AppTextStyles.bodyLarge.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 16),

          // Card Đăng ký Tình nguyện viên Hiệp sĩ & KYC
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isKycVerified ? const Color(0xFF10B981) : const Color(0xFF0284C7).withValues(alpha: 0.5),
                width: 1.5,
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: isKycVerified
                        ? const Color(0xFF10B981).withValues(alpha: 0.2)
                        : const Color(0xFF0284C7).withValues(alpha: 0.2),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    isKycVerified ? Icons.verified_user_rounded : Icons.shield_outlined,
                    color: isKycVerified ? const Color(0xFF10B981) : const Color(0xFF38BDF8),
                    size: 26,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isKycVerified ? 'Hiệp sĩ đã xác minh KYC' : 'Đăng ký làm Hiệp sĩ Cứu hộ',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        isKycVerified
                            ? 'Tài khoản đã định danh đầy đủ, sẵn sàng nhận ca điều phối.'
                            : 'Xác minh CCCD/Passport để tham gia mạng lưới cứu hộ.',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.7),
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
                if (!isKycVerified) ...[
                  const SizedBox(width: 8),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0284C7),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    onPressed: () => _showKycBottomSheet(context),
                    child: const Text('Nộp KYC', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  ),
                ],
              ],
            ),
          ),

          const SizedBox(height: 18),
          if (rows.isNotEmpty)
            AppCard(
              child: Column(
                children: [
                  Row(
                    children: [
                      Stack(
                        clipBehavior: Clip.none,
                        children: [
                          Container(
                            width: 56,
                            height: 56,
                            decoration: const BoxDecoration(
                              color: AppColors.primarySoft,
                              shape: BoxShape.circle,
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              rows.first.name.substring(0, 1).toUpperCase(),
                              style: AppTextStyles.h3.copyWith(
                                color: AppColors.primary,
                              ),
                            ),
                          ),
                          if (rows.first.verified)
                            Positioned(
                              right: -2,
                              bottom: -2,
                              child: Container(
                                width: 20,
                                height: 20,
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  shape: BoxShape.circle,
                                  border: Border.all(color: Colors.white, width: 2),
                                ),
                                child: const Icon(
                                  Icons.verified_outlined,
                                  size: 14,
                                  color: Color(0xFF3A7AFE),
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(rows.first.name, style: AppTextStyles.title),
                            const SizedBox(height: 4),
                            Text(
                              '${rows.first.location} · ${rows.first.rescues} lần hỗ trợ',
                              style: AppTextStyles.bodyStrong.copyWith(
                                color: AppColors.primary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Row(
                            children: [
                              const Icon(
                                Icons.star_rounded,
                                size: 18,
                                color: AppColors.warning,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                rows.first.rating.toStringAsFixed(1),
                                style: AppTextStyles.title.copyWith(
                                  color: AppColors.warning,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text('${rows.first.distanceKm} km', style: AppTextStyles.caption),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFF43F5E),
                        side: const BorderSide(color: Color(0xFFF43F5E)),
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      icon: const Icon(Icons.favorite_rounded, size: 16),
                      label: const Text('Gửi lời cảm ơn & Đánh giá', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                      onPressed: () => _showThankYouDialog(context, rows.first),
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 18),
          AppSegmentedControl<_HeroesFilter>(
            value: _filter,
            items: const [
              AppSegmentItem(
                value: _HeroesFilter.ranking,
                label: 'Bảng vàng',
                icon: Icons.workspace_premium_outlined,
              ),
              AppSegmentItem(
                value: _HeroesFilter.nearby,
                label: 'Gần bạn',
                icon: Icons.map_outlined,
              ),
            ],
            onChanged: (value) => setState(() => _filter = value),
          ),
          const SizedBox(height: 18),
          for (var index = 0; index < rows.length; index++) ...[
            _HeroListRow(
              hero: rows[index],
              rank: index + 1,
              nearby: _filter == _HeroesFilter.nearby,
              onThankYou: () => _showThankYouDialog(context, rows[index]),
            ),
            const SizedBox(height: 14),
          ],
        ],
      ),
    );
  }
}

class _HeroListRow extends StatelessWidget {
  const _HeroListRow({
    required this.hero,
    required this.rank,
    required this.nearby,
    required this.onThankYou,
  });

  final HeroProfile hero;
  final int rank;
  final bool nearby;
  final VoidCallback onThankYou;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: rank == 1 ? const Color(0xFFFFF1D7) : AppColors.accent,
                  borderRadius: BorderRadius.circular(14),
                ),
                alignment: Alignment.center,
                child: Text(
                  '$rank',
                  style: AppTextStyles.title.copyWith(
                    color: rank == 1 ? AppColors.warning : AppColors.textPrimary,
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            hero.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTextStyles.title,
                          ),
                        ),
                        if (hero.verified) ...[
                          const SizedBox(width: 6),
                          const Icon(
                            Icons.verified_outlined,
                            size: 16,
                            color: Color(0xFF3A7AFE),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      nearby
                          ? 'Cách bạn ${hero.distanceKm.toStringAsFixed(1)} km'
                          : '${hero.location} · ${hero.rescues} lần cứu',
                      style: AppTextStyles.body.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Row(
                children: [
                  const Icon(
                    Icons.star_rounded,
                    color: AppColors.warning,
                    size: 18,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    hero.rating.toStringAsFixed(1),
                    style: AppTextStyles.title.copyWith(color: AppColors.warning),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              style: TextButton.styleFrom(
                foregroundColor: const Color(0xFFF43F5E),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              icon: const Icon(Icons.favorite_outline_rounded, size: 14),
              label: const Text('Cảm ơn & Đánh giá', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
              onPressed: onThankYou,
            ),
          ),
        ],
      ),
    );
  }
}
