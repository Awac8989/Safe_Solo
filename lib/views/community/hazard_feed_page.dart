import 'package:flutter/material.dart';
import '../../core/app_theme.dart';
import '../../core/widgets/top_toast.dart';
import '../../models/hazard_report_model.dart';
import 'create_hazard_sheet.dart';

class HazardFeedPage extends StatefulWidget {
  const HazardFeedPage({super.key});

  @override
  State<HazardFeedPage> createState() => _HazardFeedPageState();
}

class _HazardFeedPageState extends State<HazardFeedPage> {
  HazardCategory? _selectedCategory;
  double _radiusKm = 5.0;

  final List<HazardReportModel> _hazards = [
    HazardReportModel(
      id: 'hazard_admin_1',
      authorName: 'Ban Chỉ Huy SafeSolo Admin',
      title: 'CẢNH BÁO SẠT LỞ ĐẤT ĐÁ: Khu vực ven sườn đồi và taluy dốc',
      description: 'Mưa lớn kéo dài gây nguy cơ sạt trượt đất đá nghiêm trọng. Khuyến cáo người dân không di chuyển qua cung đường đèo taluy âm/dương nguy hiểm, chủ động sơ tán đến vùng cao an toàn.',
      category: HazardCategory.landslide,
      lat: 10.7760,
      lng: 106.7010,
      address: 'Khu vực tuyến đường dốc taluy ven sông - Quận 1',
      distanceKm: 0.3,
      confirmCount: 48,
      resolvedCount: 0,
      createdAt: DateTime.now().subtract(const Duration(minutes: 10)),
      isAdminBroadcast: true,
      severity: 'P1_CRITICAL',
    ),
    HazardReportModel(
      id: 'hazard_admin_2',
      authorName: 'Trung Tâm Khí Tượng Thủy Văn & Điều Phối',
      title: 'BÁO ĐỘNG NGẬP LỤT SÂU: Mực nước vượt 0.8m',
      description: 'Triều cường kết hợp mưa lớn làm ngập lụt sâu toàn bộ trục đường giao thông chính, nước tràn vào tầng hầm nhà dân, ngắt nguồn điện khu vực trũng thấp.',
      category: HazardCategory.flooding,
      lat: 10.7780,
      lng: 106.7035,
      address: 'Trục giao lộ Nguyễn Hữu Cảnh - Ung Văn Khiêm',
      distanceKm: 0.6,
      confirmCount: 35,
      resolvedCount: 0,
      createdAt: DateTime.now().subtract(const Duration(minutes: 40)),
      isAdminBroadcast: true,
      severity: 'P1_CRITICAL',
    ),
    HazardReportModel(
      id: 'hazard_1',
      authorName: 'Hiệp sĩ Tuấn Anh',
      title: 'Đoạn ngõ 45 mất đèn đường hoàn toàn',
      description: 'Đoạn đường dài khoảng 300m rất tối, nhiều góc khuất. Các bạn nữ đi làm về muộn nên đi đường vòng lớn hơn.',
      category: HazardCategory.darkRoad,
      lat: 10.7769,
      lng: 106.7009,
      address: 'Ngõ 45, Đường Lê Lợi, P. Bến Nghé, Q.1',
      distanceKm: 0.45,
      confirmCount: 7,
      resolvedCount: 0,
      createdAt: DateTime.now().subtract(const Duration(minutes: 25)),
    ),
    HazardReportModel(
      id: 'hazard_2',
      authorName: 'Hiệp sĩ ẩn danh',
      title: 'Nhóm đối tượng khả nghi bám đuôi',
      description: 'Có 2 thanh niên đi xe Wave đen không biển số dừng quan sát ở ngã ba vắng. Mọi người cảnh giác.',
      category: HazardCategory.suspiciousPerson,
      lat: 10.7790,
      lng: 106.7020,
      address: 'Ngã ba Nguyễn Huệ - Mạc Thị Bưởi',
      distanceKm: 0.8,
      confirmCount: 12,
      resolvedCount: 1,
      createdAt: DateTime.now().subtract(const Duration(hours: 1, minutes: 10)),
    ),
    HazardReportModel(
      id: 'hazard_3',
      authorName: 'Cư dân Khu phố 3',
      title: 'Thi công cống hở không có biển cảnh báo',
      description: 'Hố ga công trình đang đào sâu khoảng 1m, che chắn tạm bợ bằng cành cây, đi xe máy rất dễ sụp.',
      category: HazardCategory.roadHazard,
      lat: 10.7740,
      lng: 106.6980,
      address: 'Đoạn trước số 18 Pasteur',
      distanceKm: 1.2,
      confirmCount: 4,
      resolvedCount: 0,
      createdAt: DateTime.now().subtract(const Duration(hours: 2)),
    ),
  ];

  void _verifyHazard(HazardReportModel report, bool isResolved) {
    setState(() {
      final index = _hazards.indexWhere((h) => h.id == report.id);
      if (index != -1) {
        if (isResolved) {
          _hazards[index] = report.copyWith(resolvedCount: report.resolvedCount + 1);
          TopToast.show(context, message: 'Đã ghi nhận báo cáo an toàn / đã khắc phục.');
        } else {
          _hazards[index] = report.copyWith(confirmCount: report.confirmCount + 1);
          TopToast.show(context, message: 'Đã xác thực nguy cơ vẫn còn tồn tại.');
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _hazards.where((h) {
      if (_selectedCategory != null && h.category != _selectedCategory) {
        return false;
      }
      return h.isAdminBroadcast || h.distanceKm <= _radiusKm;
    }).toList();

    filtered.sort((a, b) {
      if (a.isAdminBroadcast && !b.isAdminBroadcast) return -1;
      if (!a.isAdminBroadcast && b.isAdminBroadcast) return 1;
      return b.createdAt.compareTo(a.createdAt);
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bản tin Cảnh báo Radar'),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0.5,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          CreateHazardSheet.show(
            context,
            onCreated: (newReport) {
              setState(() => _hazards.insert(0, newReport));
            },
          );
        },
        backgroundColor: AppColors.destructive,
        icon: const Icon(Icons.add_alert_rounded, color: Colors.white),
        label: const Text('BÁO CÁO NGUY CƠ', style: TextStyle(fontWeight: FontWeight.w800, color: Colors.white)),
      ),
      body: Column(
        children: [
          // Filter Row
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: Colors.white,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: FilterChip(
                          label: const Text('Tất cả'),
                          selected: _selectedCategory == null,
                          onSelected: (_) => setState(() => _selectedCategory = null),
                        ),
                      ),
                      ...HazardCategory.values.map((cat) {
                        final dummy = HazardReportModel(
                          id: '',
                          authorName: '',
                          title: '',
                          category: cat,
                          lat: 0,
                          lng: 0,
                          createdAt: DateTime.now(),
                        );
                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: FilterChip(
                            avatar: Icon(dummy.categoryIcon, size: 14, color: _selectedCategory == cat ? Colors.white : dummy.categoryColor),
                            label: Text(dummy.categoryLabel),
                            selected: _selectedCategory == cat,
                            onSelected: (_) => setState(() => _selectedCategory = cat),
                          ),
                        );
                      }),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(Icons.radar_rounded, size: 16, color: AppColors.primary),
                    const SizedBox(width: 6),
                    Text(
                      'Bán kính quét: ${_radiusKm.toInt()} km',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                    ),
                    const Spacer(),
                    ...[1.0, 3.0, 5.0, 10.0].map((r) {
                      final isSelected = _radiusKm == r;
                      return Padding(
                        padding: const EdgeInsets.only(left: 4),
                        child: ActionChip(
                          label: Text('${r.toInt()}km', style: TextStyle(fontSize: 11, color: isSelected ? Colors.white : AppColors.textPrimary)),
                          backgroundColor: isSelected ? AppColors.primary : AppColors.secondary,
                          padding: EdgeInsets.zero,
                          side: BorderSide.none,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          onPressed: () => setState(() => _radiusKm = r),
                        ),
                      );
                    }),
                  ],
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // Hazards List
          Expanded(
            child: filtered.isEmpty
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.check_circle_outline_rounded, size: 64, color: AppColors.success.withValues(alpha: 0.5)),
                        const SizedBox(height: 12),
                        const Text(
                          'Khu vực xung quanh bạn đang an toàn',
                          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: AppColors.textPrimary),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Không có cảnh báo nguy cơ nào trong bán kính đã chọn.',
                          style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      final h = filtered[index];
                      return _buildHazardCard(h);
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildHazardCard(HazardReportModel h) {
    final bool isAdmin = h.isAdminBroadcast;
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isAdmin ? const Color(0xFFFEF2F2) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isAdmin ? const Color(0xFFDC2626) : AppColors.border,
          width: isAdmin ? 1.5 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: isAdmin ? const Color(0x1CDC2626) : const Color(0x08000000),
            blurRadius: isAdmin ? 12 : 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: h.categoryColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(h.categoryIcon, size: 14, color: h.categoryColor),
                          const SizedBox(width: 4),
                          Text(
                            h.categoryLabel,
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: h.categoryColor),
                          ),
                        ],
                      ),
                    ),
                    if (isAdmin)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFFDC2626),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.campaign_rounded, size: 13, color: Colors.white),
                            SizedBox(width: 4),
                            Text(
                              'BAN ĐIỀU PHỐI (ADMIN)',
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: 0.4),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: isAdmin ? const Color(0xFFFFEDD5) : AppColors.secondary,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.near_me_rounded, size: 11, color: isAdmin ? const Color(0xFFC2410C) : AppColors.textSecondary),
                    const SizedBox(width: 3),
                    Text(
                      'Cách ${(h.distanceKm * 1000).toInt()}m',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: isAdmin ? const Color(0xFFC2410C) : AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            h.title,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: isAdmin ? const Color(0xFF991B1B) : AppColors.textPrimary,
            ),
          ),
          if (h.description.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              h.description,
              style: TextStyle(
                fontSize: 13,
                color: isAdmin ? const Color(0xFF7F1D1D) : AppColors.textSecondary,
                height: 1.4,
              ),
            ),
          ],
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(Icons.location_on_outlined, size: 14, color: isAdmin ? const Color(0xFFB91C1C) : AppColors.textSecondary),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  h.address,
                  style: TextStyle(fontSize: 12, color: isAdmin ? const Color(0xFFB91C1C) : AppColors.textSecondary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Divider(height: 1),
          const SizedBox(height: 10),

          // Community Verification Row
          Row(
            children: [
              Expanded(
                child: Text(
                  'Bởi ${h.authorName}',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: isAdmin ? const Color(0xFF991B1B) : AppColors.textSecondary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              // Confirm Button
              InkWell(
                borderRadius: BorderRadius.circular(10),
                onTap: () => _verifyHazard(h, false),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.destructive.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.warning_amber_rounded, size: 14, color: AppColors.destructive),
                      const SizedBox(width: 4),
                      Text(
                        'Vẫn còn (${h.confirmCount})',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.destructive),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              // Resolved Button
              InkWell(
                borderRadius: BorderRadius.circular(10),
                onTap: () => _verifyHazard(h, true),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.success.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle_outline_rounded, size: 14, color: AppColors.success),
                      const SizedBox(width: 4),
                      Text(
                        'Đã an toàn (${h.resolvedCount})',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.success),
                      ),
                    ],
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
