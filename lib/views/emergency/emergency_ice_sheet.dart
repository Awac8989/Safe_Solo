import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_theme.dart';
import '../../core/providers/app_provider.dart';
import '../../models/rescue_incident_model.dart';

/// ============================================================================
/// SAFESOLO - THẺ Y TẾ KHẨN CẤP I.C.E & BÀN GIAO SBAR CHO KÍP 115
/// (In Case of Emergency Digital Profile & SBAR Telemetry)
/// Phục vụ: Bác sĩ 115, Hiệp sĩ và Người qua đường tra cứu nhanh sinh hiệu
/// ============================================================================

class EmergencyIceSheet extends StatelessWidget {
  const EmergencyIceSheet({
    super.key,
    this.incident,
  });

  final RescueIncidentModel? incident;

  static Future<void> show(BuildContext context, {RescueIncidentModel? incident}) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => EmergencyIceSheet(incident: incident),
    );
  }

  @override
  Widget build(BuildContext context) {
    final appProvider = context.watch<AppProvider>();
    final user = appProvider.user;
    final size = MediaQuery.of(context).size;
    final bloodType = incident?.bloodType != null && incident!.bloodType != 'UNKNOWN'
        ? incident!.bloodType
        : (appProvider.medical.bloodType.isNotEmpty ? appProvider.medical.bloodType : 'O+');

    final allergies = incident?.allergies.isNotEmpty == true
        ? incident!.allergies
        : (appProvider.medical.allergies.isNotEmpty
            ? appProvider.medical.allergies.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList()
            : ['Không rõ']);

    final chronicConditions = incident?.chronicConditions.isNotEmpty == true
        ? incident!.chronicConditions
        : (appProvider.medical.conditions.isNotEmpty
            ? appProvider.medical.conditions.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList()
            : ['Không có bệnh nền']);

    final guardians = user?.emergencyContacts ?? [];

    // Tạo payload SBAR chuẩn cho kíp 115 quét QR
    final sbarPayload = 'SAFESOLO#SBAR#'
        'VICTIM:${user?.fullName ?? incident?.victimName ?? "Nạn nhân"}#'
        'BLOOD:$bloodType#'
        'ALLERGIES:${allergies.join(",")}#'
        'CHRONIC:${chronicConditions.join(",")}#'
        'INCIDENT:${incident?.incidentType ?? "P1_CRITICAL"}#'
        'GPS:${incident?.exactLat ?? 10.7766},${incident?.exactLng ?? 106.7009}#'
        'TIME:${incident?.createdAt.toIso8601String() ?? DateTime.now().toIso8601String()}';

    return Container(
      height: size.height * 0.88,
      decoration: const BoxDecoration(
        color: Color(0xFF0F172A),
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 12),
          Container(
            width: 44,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.white24,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 14),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.destructive.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.destructive.withValues(alpha: 0.4)),
                  ),
                  child: const Icon(
                    Icons.medical_services_rounded,
                    color: AppColors.destructive,
                    size: 26,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'THẺ Y TẾ SINH TỒN (I.C.E)',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'In Case of Emergency · Bàn giao chuẩn Y tế SBAR',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.7),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close_rounded, color: Colors.white70),
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),
          const Divider(color: Colors.white12, height: 1),

          // Body Content
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
              children: [
                // Thẻ thông tin nạn nhân & Nhóm máu
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        const Color(0xFF1E293B),
                        const Color(0xFF1E293B).withValues(alpha: 0.8),
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.white12),
                  ),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 30,
                        backgroundColor: AppColors.primarySoft.withValues(alpha: 0.2),
                        child: Text(
                          (user?.fullName.isNotEmpty == true ? user!.fullName[0] : 'N').toUpperCase(),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              user?.fullName ?? incident?.victimName ?? 'Nạn nhân SafeSolo',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              user?.phone ?? 'Chưa đăng ký số điện thoại',
                              style: const TextStyle(
                                color: Color(0xFF94A3B8),
                                fontSize: 13,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFF10B981).withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Text(
                                'Đã xác thực danh tính căn cước eKYC',
                                style: TextStyle(
                                  color: Color(0xFF34D399),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      // Badge Nhóm máu lớn
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFFDC2626), Color(0xFF991B1B)],
                          ),
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFFDC2626).withValues(alpha: 0.4),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Column(
                          children: [
                            const Text(
                              'NHÓM MÁU',
                              style: TextStyle(
                                color: Colors.white70,
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            Text(
                              bloodType,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 22,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                // Lưới Dị ứng & Bệnh lý nền
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Dị ứng
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: Colors.amber.withValues(alpha: 0.25)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Row(
                              children: [
                                Icon(Icons.warning_amber_rounded, color: Colors.amber, size: 18),
                                SizedBox(width: 6),
                                Text(
                                  'DỊ ỨNG THUỐC',
                                  style: TextStyle(
                                    color: Colors.amber,
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            for (final allergy in allergies)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 4),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('• ', style: TextStyle(color: Colors.white70)),
                                    Expanded(
                                      child: Text(
                                        allergy,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 13,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    // Tiền sử bệnh
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: Colors.blue.withValues(alpha: 0.25)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Row(
                              children: [
                                Icon(Icons.healing_rounded, color: Colors.lightBlueAccent, size: 18),
                                SizedBox(width: 6),
                                Text(
                                  'BỆNH LÝ NỀN',
                                  style: TextStyle(
                                    color: Colors.lightBlueAccent,
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            for (final cond in chronicConditions)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 4),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('• ', style: TextStyle(color: Colors.white70)),
                                    Expanded(
                                      child: Text(
                                        cond,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 13,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 16),

                // Danh bạ người thân bảo trợ (Guardians)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.white12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.shield_rounded, color: Color(0xFF10B981), size: 18),
                          SizedBox(width: 8),
                          Text(
                            'NGƯỜI BẢO TRỢ KHẨN CẤP (GUARDIANS)',
                            style: TextStyle(
                              color: Color(0xFF34D399),
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      if (guardians.isEmpty)
                        const Text(
                          'Chưa thêm người bảo trợ. Khuyến nghị cập nhật ngay trong phần Cài đặt.',
                          style: TextStyle(color: Colors.white60, fontSize: 13),
                        )
                      else
                        for (final g in guardians)
                          Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            decoration: BoxDecoration(
                              color: const Color(0xFF0F172A),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.white10),
                            ),
                            child: Row(
                              children: [
                                CircleAvatar(
                                  radius: 18,
                                  backgroundColor: const Color(0xFF3B82F6).withValues(alpha: 0.2),
                                  child: Text(
                                    g.name.isNotEmpty ? g.name[0] : 'G',
                                    style: const TextStyle(
                                      color: Color(0xFF60A5FA),
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        '${g.name} (${g.relation})',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.w600,
                                          fontSize: 14,
                                        ),
                                      ),
                                      Text(
                                        g.phone,
                                        style: const TextStyle(
                                          color: Colors.white60,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                ElevatedButton.icon(
                                  icon: const Icon(Icons.phone_in_talk_rounded, size: 16),
                                  label: const Text('Gọi'),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFF10B981),
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                  ),
                                  onPressed: () async {
                                    final uri = Uri.parse('tel:${g.phone.replaceAll(" ", "")}');
                                    if (await canLaunchUrl(uri)) {
                                      await launchUrl(uri);
                                    }
                                  },
                                ),
                              ],
                            ),
                          ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                // Mã QR Bàn giao Y tế SBAR
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.25),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      const Text(
                        'MÃ QR BÀN GIAO SBAR CHO KÍP 115',
                        style: TextStyle(
                          color: Color(0xFF0F172A),
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Bác sĩ / Nhân viên y tế quét mã để lập tức trích xuất hồ sơ lâm sàng',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Color(0xFF64748B),
                          fontSize: 11,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Center(
                        child: QrImageView(
                          data: sbarPayload,
                          version: QrVersions.auto,
                          size: 160.0,
                          backgroundColor: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text(
                          'Chuẩn giao tiếp y khoa SBAR: Situation - Background - Assessment - Recommendation',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Color(0xFF475569),
                            fontSize: 10,
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                // Khung Pháp lý Bảo vệ Hiệp sĩ (Good Samaritan)
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: Colors.white12),
                  ),
                  child: const Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.gavel_rounded, color: Colors.white60, size: 20),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Căn cứ Điều 87 Luật Khám bệnh, chữa bệnh 2023 & Điều 132 Bộ luật Hình sự 2015: Người tham gia sơ cứu ban đầu trong tình trạng khẩn cấp vì mục đích cứu người được miễn trừ trách nhiệm pháp lý khi tuân thủ kỹ thuật sơ cứu cơ bản.',
                          style: TextStyle(
                            color: Colors.white60,
                            fontSize: 11,
                            height: 1.4,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
