import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_theme.dart';
import '../../core/providers/app_provider.dart';
import '../../core/widgets/top_toast.dart';

/// ============================================================================
/// SAFESOLO - THẺ Y TẾ CẤP CỨU MÀN HÌNH KHÓA & MÃ QR 115
/// (Lockscreen Medical ID & Emergency QR Code Card - ICE Standard)
/// Phục vụ: Bác sĩ 115 & Người cứu hộ tiếp cận hồ sơ sinh tử không cần mở khóa máy
/// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03
/// ============================================================================

class LockscreenMedicalCardPage extends StatelessWidget {
  const LockscreenMedicalCardPage({super.key});

  Future<void> _makeCall(BuildContext context, String phone) async {
    final cleanPhone = phone.replaceAll(RegExp(r'[^0-9+]'), '');
    if (cleanPhone.isEmpty) {
      TopToast.show(
        context,
        message: 'Chưa cập nhật số điện thoại liên hệ.',
        icon: Icons.error_outline_rounded,
      );
      return;
    }
    final uri = Uri(scheme: 'tel', path: cleanPhone);
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri);
      } else {
        if (!context.mounted) return;
        TopToast.show(
          context,
          message: 'Không thể mở trình quay số: $cleanPhone',
          icon: Icons.phone_disabled_rounded,
        );
      }
    } catch (e) {
      if (!context.mounted) return;
      TopToast.show(
        context,
        message: 'Lỗi quay số: $e',
        icon: Icons.error_outline_rounded,
      );
    }
  }

  String _buildQrMedicalPayload(BuildContext context, MedicalId med, User? user) {
    final name = med.fullName.isNotEmpty
        ? med.fullName.toUpperCase()
        : (user?.name ?? 'NGƯỜI DÙNG SAFESOLO');
    final blood = med.bloodType.isNotEmpty ? med.bloodType : 'Chưa cập nhật';
    final allergy = med.allergies.isNotEmpty ? med.allergies : 'Không có';
    final condition = med.conditions.isNotEmpty ? med.conditions : 'Không có';
    final meds = med.medications.isNotEmpty ? med.medications : 'Không có';
    final icePhone = med.emergencyPhone.isNotEmpty
        ? med.emergencyPhone
        : (user?.emergencyContacts.isNotEmpty == true
            ? user!.emergencyContacts.first.phone
            : '115');

    return [
      '🚨 SAFESOLO EMERGENCY MEDICAL ID (ICE)',
      'HỌ TÊN: $name',
      'NĂM SINH: ${med.birthYear.isNotEmpty ? med.birthYear : "N/A"}',
      'NHÓM MÁU: $blood',
      'DỊ ỨNG KHẨN CẤP: $allergy',
      'BỆNH LÝ NỀN: $condition',
      'THUỐC ĐANG DÙNG: $meds',
      'LIÊN HỆ KHẨN CẤP (ICE): $icePhone',
      'BẢO HIỂM: ${med.insuranceProvider.isNotEmpty ? "${med.insuranceProvider} - ${med.insuranceNumber}" : "N/A"}',
      'HỆ THỐNG BẢO VỆ: SafeSolo Autonomous Rescue Ecosystem',
    ].join('\n');
  }

  void _copyEmergencyData(BuildContext context, String payload) {
    Clipboard.setData(ClipboardData(text: payload));
    TopToast.show(
      context,
      message: 'Đã sao chép toàn bộ hồ sơ y tế cấp cứu!',
      icon: Icons.copy_rounded,
    );
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppProvider>();
    final med = app.medical;
    final user = app.user;

    final victimName = med.fullName.isNotEmpty
        ? med.fullName.toUpperCase()
        : (user?.name.toUpperCase() ?? 'NGƯỜI DÙNG SAFESOLO');
    final bloodType =
        med.bloodType.trim().isNotEmpty ? med.bloodType.trim() : 'Chưa cập nhật';
    final allergies = med.allergies.trim().isNotEmpty
        ? med.allergies.trim()
        : 'Không có ghi nhận dị ứng';
    final hasAllergyWarning =
        allergies.toLowerCase() != 'không có ghi nhận dị ứng' &&
            allergies.toLowerCase() != 'không có';
    final icePhone = med.emergencyPhone.trim().isNotEmpty
        ? med.emergencyPhone.trim()
        : (user?.emergencyContacts.isNotEmpty == true
            ? user!.emergencyContacts.first.phone
            : '');
    final iceGuardianName = user?.emergencyContacts.isNotEmpty == true
        ? user!.emergencyContacts.first.name
        : 'Người thân bảo hộ';

    final qrPayload = _buildQrMedicalPayload(context, med, user);

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A), // Clinical Dark Navy Slate
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0xFFEF4444),
              ),
              child: const Icon(Icons.medical_services_rounded,
                  color: Colors.white, size: 16),
            ),
            const SizedBox(width: 8),
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'THẺ Y TẾ CẤP CỨU 115',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
                    color: Colors.white,
                  ),
                ),
                Text(
                  'In Case of Emergency (ICE) • Chuẩn Y Tế',
                  style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Sao chép Hồ sơ Y tế',
            icon: const Icon(Icons.copy_rounded, color: Colors.white70),
            onPressed: () => _copyEmergencyData(context, qrPayload),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        children: [
          // KHỐI 1: HERO CARD - THÔNG TIN ĐỊNH DANH & NHÓM MÁU
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF1E293B), Color(0xFF172554)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: const Color(0xFF38BDF8).withValues(alpha: 0.25),
                width: 1.2,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.3),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEF4444).withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(
                                color: const Color(0xFFEF4444).withValues(alpha: 0.5),
                              ),
                            ),
                            child: const Text(
                              'HỒ SƠ CẤP CỨU KHẨN CẤP',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFFFCA5A5),
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            victimName,
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Năm sinh: ${med.birthYear.isNotEmpty ? med.birthYear : "Chưa cập nhật"}  •  CCCD: ${med.citizenId.isNotEmpty ? med.citizenId : "Chưa cập nhật"}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF94A3B8),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    // Badge Nhóm máu lớn
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEF4444),
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFFEF4444).withValues(alpha: 0.4),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Column(
                        children: [
                          const Icon(Icons.water_drop_rounded,
                              color: Colors.white, size: 18),
                          const SizedBox(height: 2),
                          const Text(
                            'NHÓM MÁU',
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                              color: Colors.white70,
                              letterSpacing: 0.3,
                            ),
                          ),
                          Text(
                            bloodType,
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                if (med.permanentAddress.isNotEmpty) ...[
                  const Divider(color: Colors.white12, height: 24),
                  Row(
                    children: [
                      const Icon(Icons.home_rounded,
                          color: Color(0xFF94A3B8), size: 15),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          med.permanentAddress,
                          style: const TextStyle(
                            fontSize: 11,
                            color: Color(0xFFCBD5E1),
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 14),

          // KHỐI 2: CÁC NÚT GỌI CẤP CỨU NHANH
          Row(
            children: [
              // Nút 1: Gọi 115 Cấp cứu
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => _makeCall(context, '115'),
                  icon: const Icon(Icons.emergency_rounded, size: 18),
                  label: const Text(
                    'GỌI 115 CẤP CỨU',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFEF4444),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    elevation: 3,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              // Nút 2: Gọi Người thân ICE
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: icePhone.isNotEmpty
                      ? () => _makeCall(context, icePhone)
                      : null,
                  icon: const Icon(Icons.phone_in_talk_rounded, size: 18),
                  label: Text(
                    'GỌI $iceGuardianName',
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, fontSize: 13),
                    overflow: TextOverflow.ellipsis,
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF10B981),
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: Colors.white12,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    elevation: 3,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // KHỐI 3: HỘP CẢNH BÁO DỊ ỨNG NGUY HIỂM (CRITICAL ALLERGY ALERT)
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: hasAllergyWarning
                  ? const Color(0xFFEF4444).withValues(alpha: 0.15)
                  : const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: hasAllergyWarning
                    ? const Color(0xFFEF4444).withValues(alpha: 0.6)
                    : Colors.white12,
                width: hasAllergyWarning ? 1.5 : 1,
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  hasAllergyWarning
                      ? Icons.warning_amber_rounded
                      : Icons.check_circle_outline_rounded,
                  color: hasAllergyWarning
                      ? const Color(0xFFEF4444)
                      : const Color(0xFF10B981),
                  size: 22,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        hasAllergyWarning
                            ? '⚠️ CẢNH BÁO DỊ ỨNG NGUY HIỂM (KHÔNG TIÊM THUỐC)'
                            : 'TIỀN SỬ DỊ ỨNG THUỐC & THỰC PHẨM',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: hasAllergyWarning
                              ? const Color(0xFFFCA5A5)
                              : const Color(0xFF94A3B8),
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        allergies,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: hasAllergyWarning
                              ? FontWeight.w800
                              : FontWeight.normal,
                          color: hasAllergyWarning
                              ? Colors.white
                              : const Color(0xFFCBD5E1),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // KHỐI 4: BỆNH LÝ NỀN & THUỐC ĐANG DÙNG
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildInfoSection(
                  icon: Icons.healing_rounded,
                  title: 'BỆNH LÝ NỀN (CHRONIC CONDITIONS)',
                  content: med.conditions.isNotEmpty
                      ? med.conditions
                      : 'Không có ghi nhận bệnh mạn tính',
                ),
                const Divider(color: Colors.white12, height: 20),
                _buildInfoSection(
                  icon: Icons.medication_rounded,
                  title: 'THUỐC ĐANG ĐIỀU TRỊ HÀNG NGÀY',
                  content: med.medications.isNotEmpty
                      ? med.medications
                      : 'Không dùng thuốc thường xuyên',
                ),
                if (med.insuranceProvider.isNotEmpty) ...[
                  const Divider(color: Colors.white12, height: 20),
                  _buildInfoSection(
                    icon: Icons.card_membership_rounded,
                    title: 'BẢO HIỂM Y TẾ / BẢO HIỂM SỨC KHỎE',
                    content:
                        '${med.insuranceProvider} (Số thẻ: ${med.insuranceNumber.isNotEmpty ? med.insuranceNumber : "N/A"})',
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 18),

          // KHỐI 5: MÃ QR CẤP CỨU TƯƠNG PHẢN CAO (HIGH-CONTRAST EMERGENCY QR)
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.3),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.qr_code_scanner_rounded,
                        color: Color(0xFF0F172A), size: 20),
                    const SizedBox(width: 8),
                    Text(
                      'QUÉT MÃ QR CẤP CỨU 115',
                      style: AppTextStyles.title.copyWith(
                        color: const Color(0xFF0F172A),
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                const Text(
                  'Bác sĩ hoặc người cứu trợ dùng camera điện thoại quét mã này để đọc toàn bộ hồ sơ y tế không cần mật khẩu.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 11,
                    color: Color(0xFF475569),
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 14),
                // QR View
                Center(
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0), width: 2),
                    ),
                    child: QrImageView(
                      data: qrPayload,
                      size: 210,
                      backgroundColor: Colors.white,
                      version: QrVersions.auto,
                      gapless: false,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.lock_open_rounded,
                          size: 14, color: Color(0xFF059669)),
                      SizedBox(width: 6),
                      Text(
                        'Truy cập Mở khẩn cấp • Chuẩn AHA 2026',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF059669),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // KHỐI 6: NÚT XUẤT ẢNH MÀN HÌNH KHÓA & CHIA SẺ
          OutlinedButton.icon(
            onPressed: () => _copyEmergencyData(context, qrPayload),
            icon: const Icon(Icons.share_rounded, color: Color(0xFF38BDF8)),
            label: const Text(
              'CHIA SẺ HỒ SƠ CẤP CỨU CHO NGƯỜI THÂN',
              style: TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 13,
                color: Color(0xFF38BDF8),
              ),
            ),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: Color(0xFF38BDF8), width: 1.5),
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoSection({
    required IconData icon,
    required String title,
    required String content,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 14, color: const Color(0xFF38BDF8)),
            const SizedBox(width: 6),
            Text(
              title,
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                color: Color(0xFF94A3B8),
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          content,
          style: const TextStyle(
            fontSize: 13,
            color: Colors.white,
            fontWeight: FontWeight.w600,
            height: 1.35,
          ),
        ),
      ],
    );
  }
}
