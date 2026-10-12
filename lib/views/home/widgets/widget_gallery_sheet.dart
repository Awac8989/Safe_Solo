import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/app_strings.dart';
import '../../../core/app_theme.dart';
import '../../../core/widgets/top_toast.dart';
import '../../../services/widget_service.dart';

class WidgetGallerySheet extends StatelessWidget {
  const WidgetGallerySheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const WidgetGallerySheet(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final strings = AppStrings.of(context);

    return Container(
      height: MediaQuery.of(context).size.height * 0.88,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0B132B) : const Color(0xFFF8FAFC),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        border: Border.all(
          color: isDark ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0),
          width: 1,
        ),
      ),
      child: Column(
        children: [
          // Handle drag pill
          const SizedBox(height: 12),
          Center(
            child: Container(
              width: 44,
              height: 5,
              decoration: BoxDecoration(
                color: isDark ? Colors.white24 : Colors.black26,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
          const SizedBox(height: 14),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF10B981).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.widgets_rounded, color: Color(0xFF10B981), size: 24),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        strings.text('Bộ Sưu Tập Tiện Ích', 'Widget Collection Gallery'),
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: isDark ? Colors.white : AppColors.textPrimary,
                        ),
                      ),
                      Text(
                        strings.text(
                          'Chọn mẫu phù hợp và ghim ra Màn hình chính',
                          'Select your favorite widget and pin to Home Screen',
                        ),
                        style: TextStyle(
                          fontSize: 12,
                          color: isDark ? Colors.white60 : Colors.black54,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.pop(context),
                  color: isDark ? Colors.white70 : Colors.black54,
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Divider(color: isDark ? Colors.white12 : Colors.black12, height: 1),

          // List of 4 Widget Models
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                // 1. MẪU SAFESOLO PRO 4x2
                _buildWidgetModelCard(
                  context: context,
                  isDark: isDark,
                  title: '1. SafeSolo Pro • Đa Năng Sinh Tồn & Người Thân',
                  sizeBadge: '4x2 (Khuyên Dùng)',
                  badgeColor: const Color(0xFF10B981),
                  description: 'Tích hợp toàn diện: Đếm ngược Dead-man switch, chỉ số BPM/SpO2/Pin đồng hồ, và thẻ người thân bảo hộ online kèm pin.',
                  previewWidget: _buildPreviewPro(isDark),
                  onPin: () => _handlePin(context, WidgetService.requestPinSafeSoloWidget, 'SafeSolo Pro 4x2'),
                ),
                const SizedBox(height: 24),

                // 2. MẪU MINI SURVIVAL 2x2
                _buildWidgetModelCard(
                  context: context,
                  isDark: isDark,
                  title: '2. SafeSolo Mini • Điểm Danh Tối Giản',
                  sizeBadge: '2x2 (Gọn Nhẹ)',
                  badgeColor: const Color(0xFF38BDF8),
                  description: 'Dành cho người thích bố cục nhỏ gọn: Vòng đếm ngược sinh tồn, nhịp tim, số lượng người bảo hộ và 2 nút hành động 1-chạm.',
                  previewWidget: _buildPreviewMini(isDark),
                  onPin: () => _handlePin(context, WidgetService.requestPinMiniWidget, 'SafeSolo Mini 2x2'),
                ),
                const SizedBox(height: 24),

                // 3. MẪU FAMILY ORBIT 4x2
                _buildWidgetModelCard(
                  context: context,
                  isDark: isDark,
                  title: '3. SafeSolo Family Orbit • Vòng Tròn Gia Đình',
                  sizeBadge: '4x2 (Gia Đình)',
                  badgeColor: const Color(0xFF818CF8),
                  description: 'Tập trung 100% vào người thân: Hiển thị lưới 4 thành viên yêu thương, trạng thái sạc pin, vị trí an toàn, nút Ping và Chia sẻ vị trí.',
                  previewWidget: _buildPreviewCircle(isDark),
                  onPin: () => _handlePin(context, WidgetService.requestPinCircleWidget, 'Family Orbit 4x2'),
                ),
                const SizedBox(height: 24),

                // 4. MẪU MEDICAL I.C.E 4x2
                _buildWidgetModelCard(
                  context: context,
                  isDark: isDark,
                  title: '4. SafeSolo Medical I.C.E • Cứu Hộ Khẩn Cấp',
                  sizeBadge: '4x2 (Y Tế & Cấp Cứu)',
                  badgeColor: const Color(0xFFEF4444),
                  description: 'Thẻ y tế khẩn cấp chuẩn SBAR: Nhóm máu O+, tiền sử dị ứng thuốc, số điện thoại người bảo hộ ưu tiên và phím bấm gọi 115 khẩn cấp.',
                  previewWidget: _buildPreviewMedical(isDark),
                  onPin: () => _handlePin(context, WidgetService.requestPinMedicalWidget, 'Medical I.C.E 4x2'),
                ),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static Future<void> _handlePin(
    BuildContext context,
    Future<bool> Function() pinAction,
    String label,
  ) async {
    HapticFeedback.mediumImpact();
    final success = await pinAction();
    if (context.mounted) {
      if (success) {
        TopToast.show(
          context,
          message: 'Đã gửi yêu cầu ghim tiện ích $label! Nhấn "Thêm" trên thông báo.',
          icon: Icons.check_circle_rounded,
        );
        Navigator.pop(context);
      } else {
        TopToast.show(
          context,
          message: 'Launcher không hỗ trợ ghim tự động. Hãy nhấn giữ màn hình chính để chọn $label.',
          icon: Icons.info_outline_rounded,
        );
      }
    }
  }

  Widget _buildWidgetModelCard({
    required BuildContext context,
    required bool isDark,
    required String title,
    required String sizeBadge,
    required Color badgeColor,
    required String description,
    required Widget previewWidget,
    required VoidCallback onPin,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0F172A) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isDark ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header of card
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: isDark ? Colors.white : AppColors.textPrimary,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: badgeColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: badgeColor.withValues(alpha: 0.4)),
                ),
                child: Text(
                  sizeBadge,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: badgeColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            description,
            style: TextStyle(
              fontSize: 11.5,
              height: 1.4,
              color: isDark ? Colors.white70 : Colors.black87,
            ),
          ),
          const SizedBox(height: 14),

          // Visual Mockup Preview
          previewWidget,
          const SizedBox(height: 14),

          // Action Button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: badgeColor,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 11),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                elevation: 0,
              ),
              onPressed: onPin,
              icon: const Icon(Icons.push_pin_rounded, size: 16),
              label: Text(
                'Ghim $sizeBadge Ra Màn Hình Chính',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // --- PREVIEWS ---
  Widget _buildPreviewPro(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF09101E),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF10B981), width: 1.5),
      ),
      child: Column(
        children: [
          Row(
            children: [
              const Icon(Icons.shield_rounded, color: Color(0xFF10B981), size: 16),
              const SizedBox(width: 6),
              const Text('SafeSolo Pro • BS. CKII Lê Hoàng Nam', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: const Color(0xFF064E3B), borderRadius: BorderRadius.circular(999), border: Border.all(color: const Color(0xFF10B981))),
                child: const Text('● BÌNH AN', style: TextStyle(color: Color(0xFF34D399), fontSize: 8.5, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('DEAD-MAN SWITCH', style: TextStyle(color: Color(0xFF6EE7B7), fontSize: 8.5, fontWeight: FontWeight.bold)),
                    Text('71h 06m', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                    Text('❤️ 78 BPM • 🫁 98% • ⌚ 100%', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 9)),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(color: const Color(0xFF141F33), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFF24344D))),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('🛡️ BẢO HỘ ONLINE (4)', style: TextStyle(color: Color(0xFF38BDF8), fontSize: 8, fontWeight: FontWeight.bold)),
                    Text('🟢 Mẹ Lan: 88% 🔋 Ở nhà', style: TextStyle(color: Colors.white, fontSize: 8.5)),
                    Text('🟢 Ba Hùng: 94% ⚡ Phòng ngủ', style: TextStyle(color: Colors.white, fontSize: 8.5)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: const Color(0xFF059669), borderRadius: BorderRadius.circular(8)),
                  child: const Text('✓ Tôi ổn (Check-in)', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: const Color(0xFFDC2626), borderRadius: BorderRadius.circular(8)),
                  child: const Text('🆘 SOS Cấp Cứu', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPreviewMini(bool isDark) {
    return Container(
      width: 170,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFF09101E),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF10B981), width: 1.2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.shield_rounded, color: Color(0xFF10B981), size: 14),
              SizedBox(width: 4),
              Text('SafeSolo', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
              Spacer(),
              Text('● ỔN', style: TextStyle(color: Color(0xFF34D399), fontSize: 8.5, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 6),
          const Text('DEAD-MAN SWITCH', style: TextStyle(color: Color(0xFF6EE7B7), fontSize: 8, fontWeight: FontWeight.bold)),
          const Text('71h 06m', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
          const Text('❤️ 78 BPM • ⌚ 100%', style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 8.5)),
          const Text('🛡️ 4 người bảo hộ online', style: TextStyle(color: Color(0xFF38BDF8), fontSize: 8)),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: const Color(0xFF059669), borderRadius: BorderRadius.circular(6)),
                  child: const Text('✓ Tôi ổn', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(width: 4),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: const Color(0xFFDC2626), borderRadius: BorderRadius.circular(6)),
                  child: const Text('🆘 SOS', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPreviewCircle(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF060E1C),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF0284C7), width: 1.5),
      ),
      child: Column(
        children: [
          Row(
            children: [
              const Icon(Icons.groups_rounded, color: Color(0xFF38BDF8), size: 16),
              const SizedBox(width: 6),
              const Text('SafeSolo Family Orbit • BS. Nam', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: const Color(0xFF0F1F38), borderRadius: BorderRadius.circular(999), border: Border.all(color: const Color(0xFF0284C7))),
                child: const Text('🛡️ 4 AN TOÀN', style: TextStyle(color: Color(0xFF38BDF8), fontSize: 8.5, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(5),
                  decoration: BoxDecoration(color: const Color(0xFF0F1F38), borderRadius: BorderRadius.circular(8)),
                  child: const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('👩 Mẹ Lan • Mẹ', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                      Text('🟢 Ở nhà • 🔋 88%', style: TextStyle(color: Color(0xFF34D399), fontSize: 8)),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(5),
                  decoration: BoxDecoration(color: const Color(0xFF0F1F38), borderRadius: BorderRadius.circular(8)),
                  child: const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('👨 Ba Hùng • Ba', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                      Text('🟢 Phòng ngủ • ⚡ 94%', style: TextStyle(color: Color(0xFF34D399), fontSize: 8)),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(5),
                  decoration: BoxDecoration(color: const Color(0xFF0F1F38), borderRadius: BorderRadius.circular(8)),
                  child: const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('👧 Linh • Bạn thân', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                      Text('🟡 Đi xe về • 🔋 38%', style: TextStyle(color: Color(0xFFFBBF24), fontSize: 8)),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(5),
                  decoration: BoxDecoration(color: const Color(0xFF0F1F38), borderRadius: BorderRadius.circular(8)),
                  child: const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('👦 Anh Hai • Anh', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                      Text('🟢 Khu CNC • 🔋 75%', style: TextStyle(color: Color(0xFF34D399), fontSize: 8)),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: const Color(0xFF0284C7), borderRadius: BorderRadius.circular(8)),
                  child: const Text('📡 Ping Gia Đình', style: TextStyle(color: Colors.white, fontSize: 9.5, fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: const Color(0xFF059669), borderRadius: BorderRadius.circular(8)),
                  child: const Text('📍 Chia Sẻ Vị Trí', style: TextStyle(color: Colors.white, fontSize: 9.5, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPreviewMedical(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF14090C),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFEF4444), width: 1.5),
      ),
      child: Column(
        children: [
          Row(
            children: [
              const Icon(Icons.medical_services_rounded, color: Color(0xFFEF4444), size: 16),
              const SizedBox(width: 6),
              const Text('Medical I.C.E • BS. CKII Lê Hoàng Nam', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: const Color(0xFFDC2626), borderRadius: BorderRadius.circular(999)),
                child: const Text('🩸 NHÓM O+', style: TextStyle(color: Colors.white, fontSize: 8.5, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(5),
                  decoration: BoxDecoration(color: const Color(0xFF241217), borderRadius: BorderRadius.circular(8)),
                  child: const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('⚠️ Dị ứng: Penicillin', style: TextStyle(color: Colors.white, fontSize: 8.5)),
                      Text('🩺 Bệnh nền: Tăng HA', style: TextStyle(color: Color(0xFFE2E8F0), fontSize: 8.5)),
                      Text('🫁 98% SpO2 • ❤️ 78 BPM', style: TextStyle(color: Color(0xFF38BDF8), fontSize: 8)),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(5),
                  decoration: BoxDecoration(color: const Color(0xFF241217), borderRadius: BorderRadius.circular(8)),
                  child: const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('👤 Guardian 21A', style: TextStyle(color: Colors.white, fontSize: 8.5)),
                      Text('📞 0911002021', style: TextStyle(color: Color(0xFF34D399), fontSize: 8.5, fontWeight: FontWeight.bold)),
                      Text('🏥 BV: Chợ Rẫy', style: TextStyle(color: Color(0xFFE2E8F0), fontSize: 8)),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: const Color(0xFF0284C7), borderRadius: BorderRadius.circular(8)),
                  child: const Text('📞 Gọi Bảo Hộ', style: TextStyle(color: Colors.white, fontSize: 9.5, fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: const Color(0xFFDC2626), borderRadius: BorderRadius.circular(8)),
                  child: const Text('🚑 CẤP CỨU 115', style: TextStyle(color: Colors.white, fontSize: 9.5, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
