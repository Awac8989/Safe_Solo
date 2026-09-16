import 'package:flutter/material.dart';

import '../../core/app_strings.dart';
import '../../core/app_theme.dart';
import '../../core/widgets/app_shell.dart';
import '../../core/widgets/top_toast.dart';

class SafetyGuideItem {
  const SafetyGuideItem({
    required this.id,
    required this.category,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.level,
    required this.tips,
    this.estimatedMinutes = 3,
  });

  final String id;
  final String category;
  final String title;
  final String subtitle;
  final IconData icon;
  final String level; // 'essential', 'advanced', 'quick'
  final List<String> tips;
  final int estimatedMinutes;
}

class SafetyGuidesPage extends StatefulWidget {
  const SafetyGuidesPage({super.key});

  @override
  State<SafetyGuidesPage> createState() => _SafetyGuidesPageState();
}

class _SafetyGuidesPageState extends State<SafetyGuidesPage> {
  String _selectedCategory = 'all';
  String _searchQuery = '';
  final Set<String> _bookmarkedIds = {};

  final List<SafetyGuideItem> _allGuides = const [
    SafetyGuideItem(
      id: 'guide-camera',
      category: 'home',
      title: 'Dò tìm camera quay lén trong phòng trọ/khách sạn',
      subtitle: 'Kỹ thuật dùng đèn flash điện thoại và tắt đèn quét quang học',
      icon: Icons.videocam_off_rounded,
      level: 'essential',
      estimatedMinutes: 3,
      tips: [
        'Tắt hết đèn trong phòng và kéo rèm kín tối hoàn toàn.',
        'Bật camera điện thoại (dùng camera trước nếu camera sau có bộ lọc hồng ngoại) và quét quanh phòng. Nếu có chấm tím hoặc đỏ nhấp nháy trên màn hình, đó có thể là đèn hồng ngoại của camera ẩn.',
        'Bật đèn pin flash điện thoại rọi trực diện vào các vị trí nhạy cảm: ổ cắm điện, đầu báo khói, đồng hồ treo tường, gương soi. Nếu phản chiếu ánh sáng chấm tròn màu xanh lam hoặc xanh lá, kiểm tra kỹ xem có thấu kính không.',
        'Kiểm tra gương hai chiều: Áp đầu ngón tay vào mặt gương. Nếu có khoảng cách giữa ngón tay và hình phản chiếu là gương bình thường; nếu ngón tay chạm khít vào hình ảnh phản chiếu, đó là gương 2 chiều nguy hiểm!',
      ],
    ),
    SafetyGuideItem(
      id: 'guide-stalking',
      category: 'commute',
      title: 'Xử lý khi nghi ngờ bị bám đuôi trên đường về đêm',
      subtitle: 'Quy tắc 3 rẽ phải, không về thẳng cửa nhà và tìm chỗ trú an toàn',
      icon: Icons.directions_run_rounded,
      level: 'essential',
      estimatedMinutes: 4,
      tips: [
        'Không bao giờ đi thẳng về cửa phòng trọ hoặc nhà riêng khi phát hiện kẻ bám theo, tránh để lộ địa chỉ cư trú.',
        'Thực hiện quy tắc "3 lần rẽ phải": Nếu đối tượng vẫn tiếp tục rẽ theo cả 3 lần liên tiếp, chắc chắn 100% bạn đang bị bám đuôi.',
        'Chuyển hướng vào cửa hàng tiện lợi 24/7 (Circle K, GS25, WinMart+), cây xăng sáng đèn hoặc trụ sở cơ quan công an gần nhất.',
        'Mở SafeSolo kích hoạt Cuộc gọi ngụy trang (Fake Call) hoặc ấn SOS khẩn cấp để định vị truyền về cho người thân.',
        'Nói to giả vờ trên điện thoại: "Bố ơi con đang tới đầu ngõ rồi, bố ra đón con luôn nhé".',
      ],
    ),
    SafetyGuideItem(
      id: 'guide-taxi',
      category: 'commute',
      title: 'An toàn tuyệt đối khi đi taxi / xe ôm công nghệ đêm',
      subtitle: 'Check biển số, mở cửa kính xe và khóa chốt child-lock',
      icon: Icons.local_taxi_rounded,
      level: 'quick',
      estimatedMinutes: 2,
      tips: [
        'Trước khi lên xe: Kiểm tra biển số thực tế và tên tài xế trên app. Hỏi tài xế: "Bác đón ai đấy ạ?" thay vì tự nhận tên mình.',
        'Khi vào xe ô tô: Luôn ngồi hàng ghế sau, tốt nhất là ghế chéo sau lưng ghế phụ. Không ngồi cạnh tài xế.',
        'Kiểm tra chốt cửa: Hạ kính xe xuống 1/3 để dễ kêu cứu và thử kéo tay nắm cửa xem có bị khóa trẻ em (child-lock) từ bên trong không.',
        'Chia sẻ chuyến đi trực tiếp qua tính năng Live Journey trên SafeSolo để người nhà theo dõi vị trí thời gian thực.',
      ],
    ),
    SafetyGuideItem(
      id: 'guide-fire',
      category: 'emergency',
      title: 'Thoát hiểm hỏa hoạn nhà chung cư mini và ngõ hẹp',
      subtitle: 'Kỹ năng cúi thấp người, dùng khăn ướt bịt mũi và chặn khói cửa',
      icon: Icons.local_fire_department_rounded,
      level: 'essential',
      estimatedMinutes: 5,
      tips: [
        '90% nạn nhân tử vong do hít phải khí độc CO trước khi bị bỏng. Luôn bò thấp sát sàn nhà vì không khí sạch ở cách mặt đất 20-30cm.',
        'Thấm ướt khăn mặt hoặc áo dày che kín mũi và miệng.',
        'Trước khi mở bất kỳ cánh cửa nào, dùng mu bàn tay chạm vào tay nắm cửa. Nếu tay nắm nóng rực, TUYỆT ĐỐI không mở vì lửa đang bùng sau cánh cửa.',
        'Nếu không thể xuống tầng dưới: Quay lại phòng, đóng chặt cửa, lấy chăn/quần áo ướt nhét kín khe cửa dưới sàn để ngăn khói.',
        'Di chuyển ra ban công hoặc cửa sổ thoáng, vẫy áo sáng màu hoặc rọi đèn pin điện thoại SOS để cứu hộ định vị.',
      ],
    ),
    SafetyGuideItem(
      id: 'guide-intruder',
      category: 'home',
      title: 'Ứng phó khi phát hiện có kẻ đột nhập ban đêm',
      subtitle: 'Trú ẩn phòng kiên cố, chuẩn bị vật tự vệ và báo động ngầm',
      icon: Icons.door_front_door_rounded,
      level: 'advanced',
      estimatedMinutes: 4,
      tips: [
        'Nếu đang ở trong phòng ngủ: Chốt chặt cửa phòng ngủ ngay lập tức, dùng đồ nặng (ghế, bàn, tủ) chặn cửa.',
        'Bật SafeSolo bấm giữ nút SOS âm thầm để gửi tọa độ GPS và âm thanh thu âm hiện trường về cho người thân.',
        'Không chủ động lao ra giáp lá cà nếu bạn chỉ có một mình và không có công cụ hỗ trợ phòng vệ tương đương.',
        'Bật đèn sáng toàn phòng ngủ để kẻ gian biết bạn đã thức giấc và tạo tiếng động lớn báo hiệu cho hàng xóm.',
      ],
    ),
    SafetyGuideItem(
      id: 'guide-doorbell',
      category: 'home',
      title: 'Bẫy chuông cảnh báo tự chế cho cửa phòng trọ',
      subtitle: 'Mẹo an toàn kinh tế chỉ với 2 chiếc thìa inox hoặc móc nhôm',
      icon: Icons.notifications_active_rounded,
      level: 'quick',
      estimatedMinutes: 2,
      tips: [
        'Kẹp 2 chiếc thìa inox vào tay nắm cửa bên trong phòng. Khi có bất kỳ ai từ bên ngoài chạm hoặc lắc tay nắm cửa, thìa sẽ rơi xuống sàn tạo tiếng leng keng đánh thức bạn.',
        'Chêm thêm một chiếc nêm gỗ hoặc chặn cửa cao su hình tam giác phía dưới chân cửa bên trong.',
        'Dán băng dính màu tối lên mắt thần cửa (peephole) từ bên trong khi không sử dụng để tránh công cụ đảo chiều nhìn trộm từ hành lang.',
      ],
    ),
  ];

  List<SafetyGuideItem> get _filteredGuides {
    return _allGuides.where((guide) {
      final matchesCategory = _selectedCategory == 'all' || guide.category == _selectedCategory;
      final matchesSearch = _searchQuery.isEmpty ||
          guide.title.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          guide.subtitle.toLowerCase().contains(_searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    }).toList();
  }

  void _openGuideDetail(SafetyGuideItem guide) {
    final strings = AppStrings.of(context);
    final isBookmarked = _bookmarkedIds.contains(guide.id);

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            final bookmarked = _bookmarkedIds.contains(guide.id);
            return Container(
              height: MediaQuery.of(sheetContext).size.height * 0.85,
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              padding: const EdgeInsets.only(top: 14, left: 20, right: 20, bottom: 24),
              child: Column(
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
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.primarySoft,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(guide.icon, color: AppColors.primary, size: 24),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              guide.title,
                              style: AppTextStyles.title.copyWith(fontSize: 18),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${guide.estimatedMinutes} ${strings.text('phút đọc • Cẩm nang sinh tồn', 'min read • Survival guide')}',
                              style: AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: Icon(
                          bookmarked ? Icons.bookmark_rounded : Icons.bookmark_border_rounded,
                          color: bookmarked ? AppColors.primary : AppColors.textMuted,
                        ),
                        onPressed: () {
                          setState(() {
                            if (bookmarked) {
                              _bookmarkedIds.remove(guide.id);
                            } else {
                              _bookmarkedIds.add(guide.id);
                            }
                          });
                          setSheetState(() {});
                          TopToast.show(
                            context,
                            message: bookmarked
                                ? strings.text('Đã bỏ lưu cẩm nang', 'Guide unbookmarked')
                                : strings.text('Đã lưu cẩm nang vào Két an toàn Vault', 'Saved guide to Safe Vault'),
                            icon: bookmarked ? Icons.bookmark_remove_outlined : Icons.bookmark_added_rounded,
                          );
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  const Divider(height: 1),
                  const SizedBox(height: 16),
                  Expanded(
                    child: ListView.separated(
                      physics: const BouncingScrollPhysics(),
                      itemCount: guide.tips.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 14),
                      itemBuilder: (context, idx) {
                        return Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 26,
                                height: 26,
                                decoration: BoxDecoration(
                                  color: AppColors.primarySoft,
                                  shape: BoxShape.circle,
                                ),
                                alignment: Alignment.center,
                                child: Text(
                                  '${idx + 1}',
                                  style: AppTextStyles.caption.copyWith(
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.primary,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  guide.tips[idx],
                                  style: AppTextStyles.body.copyWith(
                                    height: 1.45,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: () {
                        Navigator.pop(sheetContext);
                        TopToast.show(
                          context,
                          message: strings.text(
                            'Đã chia sẻ hướng dẫn an toàn tới người thân!',
                            'Safety guide shared to family!',
                          ),
                          icon: Icons.share_rounded,
                        );
                      },
                      icon: const Icon(Icons.share_outlined),
                      label: Text(strings.text('Chia sẻ cho gia đình / bạn bè', 'Share to family / friends')),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
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
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    final guides = _filteredGuides;

    return AppPage(
      child: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.only(top: 14, bottom: 24),
        children: [
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
                onPressed: () => Navigator.pop(context),
              ),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  strings.text('Cẩm nang an toàn độc lập', 'Solo Safety Guides'),
                  style: AppTextStyles.h2.copyWith(fontSize: 22),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Padding(
            padding: const EdgeInsets.only(left: 12),
            child: Text(
              strings.text(
                'Kỹ năng sinh tồn, tự vệ và phòng ngừa rủi ro cho người sống một mình.',
                'Survival skills, defense, and risk prevention for solo living.',
              ),
              style: AppTextStyles.bodyLarge.copyWith(color: AppColors.textSecondary),
            ),
          ),
          const SizedBox(height: 18),
          // Search box
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
            ),
            child: TextField(
              decoration: InputDecoration(
                hintText: strings.text('Tìm kiếm cẩm nang (camera, bám đuôi, cháy...)', 'Search guides (camera, stalking, fire...)'),
                border: InputBorder.none,
                icon: const Icon(Icons.search_rounded, color: AppColors.textMuted),
              ),
              onChanged: (val) {
                setState(() => _searchQuery = val.trim());
              },
            ),
          ),
          const SizedBox(height: 16),
          // Category chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            child: Row(
              children: [
                _categoryFilterChip('all', strings.text('Tất cả', 'All')),
                const SizedBox(width: 8),
                _categoryFilterChip('home', strings.text('Nhà ở & Phòng trọ', 'Home & Rental')),
                const SizedBox(width: 8),
                _categoryFilterChip('commute', strings.text('Đi lại & Taxi', 'Commute & Taxi')),
                const SizedBox(width: 8),
                _categoryFilterChip('emergency', strings.text('Thoát hiểm khẩn', 'Emergency')),
              ],
            ),
          ),
          const SizedBox(height: 18),
          if (guides.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 40),
                child: Column(
                  children: [
                    const Icon(Icons.menu_book_outlined, size: 48, color: AppColors.textMuted),
                    const SizedBox(height: 12),
                    Text(
                      strings.text('Không tìm thấy bài viết phù hợp', 'No matching guides found'),
                      style: AppTextStyles.title.copyWith(color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
            )
          else
            for (final guide in guides) ...[
              _buildGuideCard(guide),
              const SizedBox(height: 12),
            ],
        ],
      ),
    );
  }

  Widget _categoryFilterChip(String catId, String label) {
    final isSelected = _selectedCategory == catId;
    return GestureDetector(
      onTap: () => setState(() => _selectedCategory = catId),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.border,
          ),
        ),
        child: Text(
          label,
          style: AppTextStyles.caption.copyWith(
            color: isSelected ? Colors.white : AppColors.textSecondary,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
      ),
    );
  }

  Widget _buildGuideCard(SafetyGuideItem guide) {
    final strings = AppStrings.of(context);
    final isBookmarked = _bookmarkedIds.contains(guide.id);

    return GestureDetector(
      onTap: () => _openGuideDetail(guide),
      child: AppCard(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.primarySoft,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(guide.icon, color: AppColors.primary, size: 26),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Text(
                          '${guide.estimatedMinutes} ${strings.text('phút', 'mins')}',
                          style: AppTextStyles.caption.copyWith(
                            fontSize: 10,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ),
                      const Spacer(),
                      if (isBookmarked)
                        const Icon(Icons.bookmark_rounded, color: AppColors.primary, size: 18),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    guide.title,
                    style: AppTextStyles.title.copyWith(fontSize: 15),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    guide.subtitle,
                    style: AppTextStyles.body.copyWith(
                      color: AppColors.textSecondary,
                      fontSize: 13,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
