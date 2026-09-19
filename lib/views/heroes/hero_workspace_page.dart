import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/providers/app_provider.dart';
import '../../core/widgets/top_toast.dart';

/// Trạng thái nhiệm vụ cứu nạn của Hiệp sĩ
enum HeroMissionStage {
  enRoute, // Đang di chuyển tiếp cận
  onScene, // Đã tới hiện trường
  firstAidGiven, // Đã sơ cứu / CPR
  completed, // Đã bàn giao 115 / Hoàn tất ca
}

/// Mô hình một ca SOS khẩn cấp trong Radar của Hiệp sĩ
class HeroIncidentItem {
  final String id;
  final String victimName;
  final int victimAge;
  final String emergencyType;
  final String address;
  final double distanceMeters;
  final int heartRateBpm;
  final int spO2Percent;
  final String triggerTime;
  final String severity; // P1, P2, P3
  final String notes;
  final double lat;
  final double lng;

  const HeroIncidentItem({
    required this.id,
    required this.victimName,
    required this.victimAge,
    required this.emergencyType,
    required this.address,
    required this.distanceMeters,
    required this.heartRateBpm,
    required this.spO2Percent,
    required this.triggerTime,
    required this.severity,
    required this.notes,
    required this.lat,
    required this.lng,
  });
}

/// Màn hình chính Bàn Tác Chiến Hiệp Sĩ (Chỉ mở khi KYC thành công)
class HeroWorkspacePage extends StatefulWidget {
  const HeroWorkspacePage({super.key});

  @override
  State<HeroWorkspacePage> createState() => _HeroWorkspacePageState();
}

class _HeroWorkspacePageState extends State<HeroWorkspacePage> with SingleTickerProviderStateMixin {
  int _activeTab = 0; // 0: Radar, 1: Active Mission, 2: AED & Logistics, 3: ID & Wallet
  bool _isOnDuty = true;
  String _dutyRadius = '3 km';
  bool _isPttTransmitting = false;
  bool _isRecordingBodycam = false;
  int _activeCallSeconds = 0;
  Timer? _missionTimer;

  // Active mission state
  HeroIncidentItem? _activeMission;
  HeroMissionStage _missionStage = HeroMissionStage.enRoute;

  late final AnimationController _pulseAnim = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  )..repeat(reverse: true);

  // Danh sách các ca SOS khẩn cấp mô phỏng xung quanh vị trí Hiệp sĩ
  final List<HeroIncidentItem> _incidents = [
    const HeroIncidentItem(
      id: 'SOS-HCM-7491',
      victimName: 'Nguyễn Thị Hoa',
      victimAge: 67,
      emergencyType: 'Cấp cứu Tim Mạch (Rung nhĩ & Té ngã)',
      address: 'Hẻm 420 Nguyễn Tri Phương, P.8, Q.5',
      distanceMeters: 420,
      heartRateBpm: 138,
      spO2Percent: 88,
      triggerTime: '3 phút trước',
      severity: 'P1',
      notes: 'Đồng hồ phát hiện té ngã cầu thang, nhịp tim bất thường 138 bpm. Cần kiểm tra ý thức & chuẩn bị CPR nếu ngưng thở.',
      lat: 10.7602,
      lng: 106.6685,
    ),
    const HeroIncidentItem(
      id: 'SOS-HCM-7492',
      victimName: 'Trần Quốc Huy',
      victimAge: 28,
      emergencyType: 'Tai nạn giao thông đêm',
      address: 'Giao lộ Lý Thường Kiệt - Nguyễn Chí Thanh',
      distanceMeters: 1100,
      heartRateBpm: 104,
      spO2Percent: 97,
      triggerTime: '7 phút trước',
      severity: 'P2',
      notes: 'Va quẹt xe máy, nạn nhân bị trầy xước sâu cẳng tay, cần hỗ trợ băng ép cầm máu và phân luồng đường vắng.',
      lat: 10.7628,
      lng: 106.6582,
    ),
    const HeroIncidentItem(
      id: 'SOS-HCM-7493',
      victimName: 'Lê Mỹ Duyên',
      victimAge: 22,
      emergencyType: 'Hỗ trợ Đi Đêm / Nghi vấn bám đuôi',
      address: 'Đoạn đường vắng Kênh Tân Hóa, P.14, Q.6',
      distanceMeters: 1650,
      heartRateBpm: 118,
      spO2Percent: 99,
      triggerTime: '12 phút trước',
      severity: 'P3',
      notes: 'Nạn nhân đi làm ca đêm về thấy đối tượng bám theo, đã bật tính năng Dead-Man SOS. Cần hiệp sĩ chạy qua kiểm tra.',
      lat: 10.7550,
      lng: 106.6430,
    ),
  ];

  @override
  void initState() {
    super.initState();
    // Khởi tạo một ca đang tác chiến mẫu để hiệp sĩ trải nghiệm ngay HUD
    _activeMission = _incidents.first;
    _startMissionTimer();
  }

  void _startMissionTimer() {
    _missionTimer?.cancel();
    _missionTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted && _activeMission != null) {
        setState(() => _activeCallSeconds++);
      }
    });
  }

  @override
  void dispose() {
    _pulseAnim.dispose();
    _missionTimer?.cancel();
    super.dispose();
  }

  Future<void> _openNavigation(double lat, double lng) async {
    final uri = Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$lat,$lng');
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        if (!mounted) return;
        TopToast.show(context, message: 'Không thể khởi động ứng dụng bản đồ', icon: Icons.error_outline_rounded);
      }
    } catch (_) {
      if (!mounted) return;
      TopToast.show(context, message: 'Lỗi mở bản đồ', icon: Icons.error_outline_rounded);
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AppProvider>();
    final user = provider.user;
    final isKycVerified = user?.isKycVerified ?? false;

    // KIỂM SOÁT BẢO MẬT & PHÂN QUYỀN (GATEKEEPING)
    // CHỈ CÓ HIỆP SĨ ĐÃ XÁC MINH KYC CCCD MỚI THẤY & TRUY CẬP ĐƯỢC
    if (!isKycVerified) {
      return _buildLockedGateScreen(context);
    }

    return Scaffold(
      backgroundColor: const Color(0xFF070B14),
      appBar: _buildTacticalAppBar(context, user),
      body: Column(
        children: [
          _buildDutyStatusBar(),
          Expanded(
            child: IndexedStack(
              index: _activeTab,
              children: [
                _buildRadarTab(),
                _buildActiveMissionTab(),
                _buildAedLogisticsTab(),
                _buildDigitalIdAndWalletTab(user),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: _buildTacticalBottomBar(),
    );
  }

  /// Màn hình khóa khi chưa KYC (Bảo vệ quyền truy cập)
  Widget _buildLockedGateScreen(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 90,
              height: 90,
              decoration: BoxDecoration(
                color: const Color(0xFFEF4444).withValues(alpha: 0.15),
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFFEF4444).withValues(alpha: 0.5), width: 2),
              ),
              child: const Icon(Icons.lock_person_rounded, size: 48, color: Color(0xFFEF4444)),
            ),
            const SizedBox(height: 24),
            const Text(
              'KHU VỰC TÁC CHIẾN BỊ KHÓA',
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.5,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            const Text(
              'Bàn Tác Chiến & Nhận Ca Cứu Nạn Hiện Trường chỉ dành riêng cho tình nguyện viên đã xác minh danh tính điện tử (KYC CCCD/Passport) theo quy định của SafeSolo và Nghị định Cứu trợ khẩn cấp.',
              style: TextStyle(color: Colors.white70, fontSize: 13, height: 1.5),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0284C7),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: () {
                Navigator.pop(context);
                TopToast.show(context, message: 'Vui lòng nhấn [Nộp KYC] tại mục Hiệp sĩ để gửi CCCD');
              },
              icon: const Icon(Icons.badge_outlined),
              label: const Text('NỘP HỒ SƠ KYC NGAY', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
            const SizedBox(height: 16),
            // Nút Kích hoạt Demo KYC nhanh dành cho hội đồng kiểm thử & đánh giá
            TextButton.icon(
              onPressed: () async {
                await context.read<AppProvider>().setKycVerified(true);
                if (context.mounted) {
                  TopToast.show(context, message: 'Đã kích hoạt quyền Hiệp Sĩ KYC thành công!');
                }
              },
              icon: const Icon(Icons.verified_user_rounded, color: Color(0xFF10B981), size: 16),
              label: const Text(
                'Mở Khóa Nhanh KYC (Dành Cho Giám Khảo & Test)',
                style: TextStyle(color: Color(0xFF10B981), fontSize: 12, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Thanh AppBar Tác Chiến Chuyên Nghiệp
  PreferredSizeWidget _buildTacticalAppBar(BuildContext context, User? user) {
    return AppBar(
      backgroundColor: const Color(0xFF0B1120),
      elevation: 0,
      centerTitle: false,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white70, size: 18),
        onPressed: () => Navigator.pop(context),
      ),
      title: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: const Color(0xFF10B981).withValues(alpha: 0.2),
              shape: BoxShape.circle,
              border: Border.all(color: const Color(0xFF10B981), width: 1.5),
            ),
            child: const Icon(Icons.shield_rounded, color: Color(0xFF10B981), size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Flexible(
                      child: Text(
                        user?.name.isNotEmpty == true ? user!.name : 'Hiệp Sĩ SafeSolo',
                        style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                        overflow: TextOverflow.ellipsis,
                        maxLines: 1,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF59E0B).withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: const Color(0xFFF59E0B), width: 0.8),
                      ),
                      child: const Text(
                        'KYC ĐẠT',
                        style: TextStyle(color: Color(0xFFF59E0B), fontSize: 9, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
                const Text(
                  'MÃ: HERO-HCM-0928 · BẬC A',
                  style: TextStyle(color: Colors.white54, fontSize: 10, fontFamily: 'monospace'),
                ),
              ],
            ),
          ),
        ],
      ),
      actions: [
        // Nút tắt/bật trực chiến nhanh
        Padding(
          padding: const EdgeInsets.only(right: 12),
          child: Row(
            children: [
              Text(
                _isOnDuty ? 'TRỰC CHIẾN' : 'NGHỈ',
                style: TextStyle(
                  color: _isOnDuty ? const Color(0xFF10B981) : Colors.white38,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(width: 4),
              Transform.scale(
                scale: 0.8,
                child: Switch(
                  value: _isOnDuty,
                  activeThumbColor: const Color(0xFF10B981),
                  activeTrackColor: const Color(0xFF10B981).withValues(alpha: 0.3),
                  inactiveThumbColor: Colors.white38,
                  inactiveTrackColor: Colors.white12,
                  onChanged: (val) {
                    setState(() => _isOnDuty = val);
                    TopToast.show(
                      context,
                      message: val ? 'Đã kích hoạt trạng thái SẴN SÀNG CỨU NẠN' : 'Đã chuyển sang chế độ TẠM NGHỈ',
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// Thanh trạng thái viễn thám kết nối & Bán kính tiếp nhận
  Widget _buildDutyStatusBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: const BoxDecoration(
        color: Color(0xFF0F172A),
        border: Border(bottom: BorderSide(color: Color(0xFF1E293B))),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              AnimatedBuilder(
                animation: _pulseAnim,
                builder: (context, _) {
                  return Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: _isOnDuty ? const Color(0xFF10B981) : Colors.amber,
                      shape: BoxShape.circle,
                      boxShadow: [
                        if (_isOnDuty)
                          BoxShadow(
                            color: const Color(0xFF10B981).withValues(alpha: _pulseAnim.value),
                            blurRadius: 8,
                            spreadRadius: 2,
                          ),
                      ],
                    ),
                  );
                },
              ),
              const SizedBox(width: 8),
              Text(
                _isOnDuty ? 'GPS RTK: ĐANG PHÁT TỌA ĐỘ VỀ TOC' : 'ĐỊNH VỊ: TẠM DỪNG',
                style: TextStyle(
                  color: _isOnDuty ? const Color(0xFF34D399) : Colors.white54,
                  fontSize: 10.5,
                  fontWeight: FontWeight.w600,
                  fontFamily: 'monospace',
                ),
              ),
            ],
          ),
          Row(
            children: [
              const Text('Bán kính: ', style: TextStyle(color: Colors.white54, fontSize: 10.5)),
              DropdownButton<String>(
                value: _dutyRadius,
                dropdownColor: const Color(0xFF1E293B),
                underline: const SizedBox.shrink(),
                isDense: true,
                style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 11, fontWeight: FontWeight.bold),
                items: ['1 km', '3 km', '5 km', '10 km'].map((r) {
                  return DropdownMenuItem(value: r, child: Text(r));
                }).toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _dutyRadius = val);
                },
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ==========================================
  // TAB 0: 🚨 RADAR CÁC CA SOS QUANH HIỆP SĨ
  // ==========================================
  Widget _buildRadarTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Banner thông báo kết nối TOC
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF1E1B4B), Color(0xFF0F172A)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFF6366F1).withValues(alpha: 0.4)),
          ),
          child: Row(
            children: [
              const Icon(Icons.radar_rounded, color: Color(0xFF818CF8), size: 28),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'RADAR CỨU NẠN THỜI GIAN THỰC',
                      style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Phát hiện ${_incidents.length} ca SOS trong bán kính $_dutyRadius. Ưu tiên can thiệp trong "4 phút vàng".',
                      style: const TextStyle(color: Colors.white70, fontSize: 11),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),

        // Nút báo cáo tai nạn hiện trường có TimeMark
        Container(
          margin: const EdgeInsets.only(bottom: 16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF7F1D1D), Color(0xFF1E1B4B)],
            ),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFEF4444).withValues(alpha: 0.6)),
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: () => Navigator.pushNamed(context, '/report-accident'),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                child: Row(
                  children: [
                    const Icon(Icons.camera_enhance_rounded, color: Color(0xFFEF4444), size: 24),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'BÁO CÁO TAI NẠN HIỆN TRƯỜNG',
                            style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Chụp ảnh TimeMark đóng dấu toạ độ & báo Dispatch 115',
                            style: TextStyle(color: Colors.white70, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEF4444),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Text(
                        'CHỤP NGAY',
                        style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),

        // Danh sách các ca
        ..._incidents.map((incident) => _buildIncidentCard(incident)),
      ],
    );
  }

  Widget _buildIncidentCard(HeroIncidentItem item) {
    final isP1 = item.severity == 'P1';
    final isP2 = item.severity == 'P2';
    final severityColor = isP1 ? const Color(0xFFEF4444) : isP2 ? const Color(0xFFF59E0B) : const Color(0xFF38BDF8);

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: severityColor.withValues(alpha: 0.4), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: severityColor.withValues(alpha: 0.08),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header ca: Severity + Name + Distance
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                      decoration: BoxDecoration(
                        color: severityColor,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        item.severity,
                        style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      item.victimName,
                      style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      ' (${item.victimAge}t)',
                      style: const TextStyle(color: Colors.white54, fontSize: 12),
                    ),
                  ],
                ),
                Row(
                  children: [
                    const Icon(Icons.near_me_rounded, color: Color(0xFF38BDF8), size: 14),
                    const SizedBox(width: 3),
                    Text(
                      '${item.distanceMeters.toStringAsFixed(0)}m',
                      style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 8),

            // Loại sự cố & Địa chỉ
            Text(
              item.emergencyType,
              style: TextStyle(color: severityColor, fontSize: 13, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.location_on_outlined, color: Colors.white54, size: 14),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    item.address,
                    style: const TextStyle(color: Colors.white70, fontSize: 11),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Chỉ số sinh tồn từ thiết bị nạn nhân (Vitals Glance)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.favorite_rounded, color: Color(0xFFF43F5E), size: 14),
                      const SizedBox(width: 4),
                      Text(
                        '${item.heartRateBpm} BPM',
                        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      const Icon(Icons.bloodtype_rounded, color: Color(0xFF06B6D4), size: 14),
                      const SizedBox(width: 4),
                      Text(
                        '${item.spO2Percent}% SpO2',
                        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      const Icon(Icons.access_time_rounded, color: Colors.amber, size: 14),
                      const SizedBox(width: 4),
                      Text(
                        item.triggerTime,
                        style: const TextStyle(color: Colors.white70, fontSize: 11),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),

            Text(
              item.notes,
              style: const TextStyle(color: Colors.white60, fontSize: 11, fontStyle: FontStyle.italic),
            ),
            const SizedBox(height: 12),

            // Action Buttons
            Row(
              children: [
                Expanded(
                  flex: 3,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    onPressed: () {
                      setState(() {
                        _activeMission = item;
                        _missionStage = HeroMissionStage.enRoute;
                        _activeTab = 1; // Switch to Active Mission Tab
                        _activeCallSeconds = 0;
                      });
                      _startMissionTimer();
                      TopToast.show(context, message: 'ĐÃ NHẬN CA: Đang bật HUD điều hướng tiếp cận nạn nhân');
                    },
                    icon: const Icon(Icons.bolt_rounded, size: 16),
                    label: const Text('NHẬN CA CỨU NẠN', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  style: IconButton.styleFrom(
                    backgroundColor: const Color(0xFF1E293B),
                    padding: const EdgeInsets.all(10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  icon: const Icon(Icons.directions_rounded, color: Color(0xFF38BDF8), size: 18),
                  tooltip: 'Chỉ đường Google Maps',
                  onPressed: () => _openNavigation(item.lat, item.lng),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ==========================================
  // TAB 1: ⚡ HUD TÁC CHIẾN HIỆN TRƯỜNG (ACTIVE MISSION)
  // ==========================================
  Widget _buildActiveMissionTab() {
    if (_activeMission == null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.radar_rounded, size: 54, color: Colors.white24),
            const SizedBox(height: 14),
            const Text(
              'CHƯA CÓ NHIỆM VỤ ĐANG THỰC HIỆN',
              style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 6),
            const Text(
              'Vui lòng chọn ca cứu nạn từ tab Radar để kích hoạt HUD tác chiến',
              style: TextStyle(color: Colors.white54, fontSize: 12),
            ),
            const SizedBox(height: 18),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0284C7)),
              onPressed: () => setState(() => _activeTab = 0),
              child: const Text('MỞ RADAR TÌM CA', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      );
    }

    final mission = _activeMission!;
    final minutes = (_activeCallSeconds ~/ 60).toString().padLeft(2, '0');
    final seconds = (_activeCallSeconds % 60).toString().padLeft(2, '0');

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Countdown banner & Distance
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF881337), Color(0xFF4C0519)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFF43F5E).withValues(alpha: 0.5)),
            boxShadow: [
              BoxShadow(color: const Color(0xFFF43F5E).withValues(alpha: 0.2), blurRadius: 12),
            ],
          ),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: const BoxDecoration(color: Colors.white24, shape: BoxShape.circle),
                        child: const Icon(Icons.timer_rounded, color: Colors.white, size: 16),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'THỜI GIAN ĐIỀU PHỐI: $minutes:$seconds',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: const Text(
                      'ETA: 1 PHÚT 45S',
                      style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          mission.victimName,
                          style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                        Text(
                          mission.address,
                          style: const TextStyle(color: Colors.white70, fontSize: 11),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: const Color(0xFF881337),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    onPressed: () => _openNavigation(mission.lat, mission.lng),
                    icon: const Icon(Icons.navigation_rounded, size: 16),
                    label: const Text('DẪN ĐƯỜNG', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11)),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // Live Telemetry sinh tồn nạn nhân truyền về
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFF1E293B)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'CHỈ SỐ SINH TỒN TRUYỀN TỪ GALAXY WATCH NẠN NHÂN',
                    style: TextStyle(color: Colors.white54, fontSize: 10, fontWeight: FontWeight.bold),
                  ),
                  Text(
                    'LIVE 250Hz',
                    style: TextStyle(color: Color(0xFF10B981), fontSize: 10, fontFamily: 'monospace', fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildTelemetryItem(Icons.favorite_rounded, const Color(0xFFF43F5E), '${mission.heartRateBpm}', 'BPM (AFib)'),
                  _buildTelemetryItem(Icons.bloodtype_rounded, const Color(0xFF06B6D4), '${mission.spO2Percent}%', 'SpO2'),
                  _buildTelemetryItem(Icons.accessibility_new_rounded, const Color(0xFFF59E0B), 'TÉ NGÃ', 'G-Sensor 4.2G'),
                  _buildTelemetryItem(Icons.battery_charging_full_rounded, const Color(0xFF10B981), '82%', 'Pin đồng hồ'),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // Bộ đàm Web PTT 2 chiều (Push to Talk) với Nạn nhân & Ban Chỉ Huy TOC
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFF38BDF8).withValues(alpha: 0.3)),
          ),
          child: Column(
            children: [
              const Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'BỘ ĐÀM HIỆN TRƯỜNG (PTT DIRECT LINK)',
                    style: TextStyle(color: Color(0xFF38BDF8), fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                  Text(
                    'LOA NGOÀI ĐỒNG HỒ NẠN NHÂN',
                    style: TextStyle(color: Colors.white54, fontSize: 9.5, fontFamily: 'monospace'),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Audio Wave Visualizer
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(16, (i) {
                  return Container(
                    margin: const EdgeInsets.symmetric(horizontal: 2.5),
                    width: 3.5,
                    height: _isPttTransmitting ? (10.0 + (i * 7 % 24)) : 4.0,
                    decoration: BoxDecoration(
                      color: _isPttTransmitting ? const Color(0xFF10B981) : Colors.white24,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  );
                }),
              ),
              const SizedBox(height: 14),

              // Hold to talk button
              GestureDetector(
                onTapDown: (_) => setState(() => _isPttTransmitting = true),
                onTapUp: (_) {
                  setState(() => _isPttTransmitting = false);
                  TopToast.show(context, message: 'Đã phát: "Hiệp sĩ SafeSolo đang đến gần, bạn hãy giữ bình tĩnh!"');
                },
                onTapCancel: () => setState(() => _isPttTransmitting = false),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(
                    gradient: _isPttTransmitting
                        ? const LinearGradient(colors: [Color(0xFFEF4444), Color(0xFFDC2626)])
                        : const LinearGradient(colors: [Color(0xFF0284C7), Color(0xFF0369A1)]),
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: (_isPttTransmitting ? Colors.red : Colors.blue).withValues(alpha: 0.3),
                        blurRadius: 10,
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        _isPttTransmitting ? Icons.mic_rounded : Icons.mic_none_rounded,
                        color: Colors.white,
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _isPttTransmitting ? 'ĐANG PHÁT THANH TRỰC TIẾP (NHẢ ĐỂ DỪNG)' : 'GIỮ ĐỂ NÓI VỚI NẠN NHÂN & TOC',
                        style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // 4 Bước tác chiến hiện trường (Triage & Legal Progression)
        const Text(
          'TIẾN TRÌNH TÁC CHIẾN TẠI HIỆN TRƯỜNG',
          style: TextStyle(color: Colors.white54, fontSize: 10.5, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),

        _buildStageItem(HeroMissionStage.enRoute, '1. Đang tiếp cận hiện trường', 'Lộ trình tối ưu hóa bởi SafeSolo Radar'),
        _buildStageItem(HeroMissionStage.onScene, '2. Đã tiếp cận hiện trường', 'Xác định nạn nhân & kiểm tra dấu hiệu sinh tồn'),
        _buildStageItem(HeroMissionStage.firstAidGiven, '3. Thực hiện sơ cứu / Hồi sức', 'Thực hiện ép tim CPR / dán máy sốc tim AED'),
        _buildStageItem(HeroMissionStage.completed, '4. Bàn giao 115 & Hoàn tất ca', 'Bàn giao xe cấp cứu 115 & nhận chứng nhận cứu trợ'),

        const SizedBox(height: 14),

        // Nút Bảo vệ Pháp lý (Good Samaritan Legal Shield & Bodycam)
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: _isRecordingBodycam ? Colors.red : Colors.white70,
                  side: BorderSide(color: _isRecordingBodycam ? Colors.red : Colors.white24),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: () {
                  setState(() => _isRecordingBodycam = !_isRecordingBodycam);
                  TopToast.show(
                    context,
                    message: _isRecordingBodycam
                        ? 'Đã bật ghi hình Bodycam & mã hóa SHA-256 bảo vệ pháp lý'
                        : 'Đã lưu trữ video bằng chứng vào hồ sơ ca',
                  );
                },
                icon: Icon(_isRecordingBodycam ? Icons.videocam_rounded : Icons.videocam_outlined, size: 16),
                label: Text(
                  _isRecordingBodycam ? 'ĐANG GHI BODYCAM' : 'BẬT BODYCAM TỰ VỆ',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFF59E0B),
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: () {
                  TopToast.show(context, message: 'Đã phát tín hiệu gọi thêm 01 Hiệp sĩ chi viện trong bán kính 1km');
                },
                icon: const Icon(Icons.group_add_rounded, size: 16),
                label: const Text('GỌI CHI VIỆN', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildTelemetryItem(IconData icon, Color color, String value, String unit) {
    return Column(
      children: [
        Icon(icon, color: color, size: 18),
        const SizedBox(height: 3),
        Text(value, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
        Text(unit, style: const TextStyle(color: Colors.white54, fontSize: 9.5)),
      ],
    );
  }

  Widget _buildStageItem(HeroMissionStage stage, String title, String subtitle) {
    final isDone = _missionStage.index >= stage.index;
    final isCurrent = _missionStage == stage;

    return InkWell(
      onTap: () {
        setState(() => _missionStage = stage);
        if (stage == HeroMissionStage.completed) {
          TopToast.show(context, message: 'CHÚC MỪNG: Ca cứu nạn hoàn tất thành công! Đã cộng 200.000đ vào Quỹ Hiệp Sĩ.');
        }
      },
      borderRadius: BorderRadius.circular(10),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: isCurrent
              ? const Color(0xFF10B981).withValues(alpha: 0.15)
              : const Color(0xFF0F172A),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isCurrent
                ? const Color(0xFF10B981)
                : (isDone ? const Color(0xFF10B981).withValues(alpha: 0.4) : Colors.white10),
          ),
        ),
        child: Row(
          children: [
            Icon(
              isDone ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
              color: isDone ? const Color(0xFF10B981) : Colors.white30,
              size: 20,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      color: isDone ? Colors.white : Colors.white54,
                      fontSize: 12,
                      fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                    ),
                  ),
                  Text(subtitle, style: const TextStyle(color: Colors.white38, fontSize: 10)),
                ],
              ),
            ),
            if (isCurrent)
              const Text('HIỆN TẠI', style: TextStyle(color: Color(0xFF10B981), fontSize: 9, fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }

  // ==========================================
  // TAB 2: 🏥 MÁY SỐC TIM AED & HẬU CẦN TRẠM AN TOÀN
  // ==========================================
  Widget _buildAedLogisticsTab() {
    final aedList = [
      {'name': 'Máy AED #01 - Circle K 24/7', 'dist': '140m', 'addr': '280 Nguyễn Tri Phương, Q.5', 'model': 'Philips HeartStart FRx', 'pin': '98%', 'status': 'Sẵn sàng'},
      {'name': 'Máy AED #02 - Highland Coffee', 'dist': '310m', 'addr': '145 Nguyễn Trãi, Q.5', 'model': 'Zoll AED Plus', 'pin': '92%', 'status': 'Sẵn sàng'},
      {'name': 'Trạm Y Tế Phường 8 (Safe Haven)', 'dist': '450m', 'addr': '56 An Dương Vương, Q.5', 'model': 'Nihon Kohden Cardiolife', 'pin': '100%', 'status': 'Trực 24/7'},
      {'name': 'Máy AED #04 - Bệnh Viện Chợ Rẫy (Cổng 2)', 'dist': '850m', 'addr': '201B Nguyễn Chí Thanh, Q.5', 'model': 'Medtronic Lifepak', 'pin': '100%', 'status': 'Sẵn sàng'},
    ];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFF064E3B),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.4)),
          ),
          child: const Row(
            children: [
              Icon(Icons.medical_services_rounded, color: Color(0xFF34D399), size: 28),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('MẠNG LƯỚI MÁY SỐC TIM TỰ ĐỘNG AED', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                    SizedBox(height: 2),
                    Text('Vị trí máy sốc tim công cộng gần nhất để kịp can thiệp trong "4 phút vàng" ngưng tim.', style: TextStyle(color: Colors.white70, fontSize: 11)),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        ...aedList.map((aed) {
          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFF1E293B)),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFF10B981).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.monitor_heart_rounded, color: Color(0xFF10B981), size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(aed['name']!, style: const TextStyle(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.bold)),
                          Text(aed['dist']!, style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 11, fontWeight: FontWeight.bold)),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(aed['addr']!, style: const TextStyle(color: Colors.white60, fontSize: 10.5)),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Text('Pin: ${aed['pin']}', style: const TextStyle(color: Color(0xFF10B981), fontSize: 10, fontWeight: FontWeight.w600)),
                          const SizedBox(width: 8),
                          Text('· ${aed['model']}', style: const TextStyle(color: Colors.white38, fontSize: 10)),
                        ],
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.directions_rounded, color: Color(0xFF38BDF8), size: 20),
                  onPressed: () => _openNavigation(10.7602, 106.6685),
                ),
              ],
            ),
          );
        }),

        const SizedBox(height: 12),
        const Text('KIỂM TRA BỘ VẬT TƯ CÁ NHÂN (IFAK CHECKLIST)', style: TextStyle(color: Colors.white54, fontSize: 10.5, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        _buildGearCheckItem('Băng ép garo cầm máu CAT Tourniquet', true),
        _buildGearCheckItem('Gạc cầm máu Celox khẩn cấp', true),
        _buildGearCheckItem('Bình xịt cay tự vệ (Hợp chuẩn an ninh SafeSolo)', true),
        _buildGearCheckItem('Mặt nạ hồi sức thổi ngạt Pocket Mask', true),
      ],
    );
  }

  Widget _buildGearCheckItem(String label, bool ok) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(ok ? Icons.check_circle_rounded : Icons.cancel_rounded, color: ok ? const Color(0xFF10B981) : Colors.red, size: 16),
          const SizedBox(width: 8),
          Expanded(child: Text(label, style: const TextStyle(color: Colors.white70, fontSize: 11.5))),
          Text(ok ? 'ĐỦ' : 'THIẾU', style: TextStyle(color: ok ? const Color(0xFF10B981) : Colors.red, fontSize: 10, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  // ==========================================
  // TAB 3: 💳 THẺ HIỆP SĨ ĐIỆN TỬ & VÍ THƯỞNG
  // ==========================================
  Widget _buildDigitalIdAndWalletTab(User? user) {
    final heroName = user?.name.isNotEmpty == true ? user!.name : 'LÊ HỮU PHƯỚC';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // THẺ HIỆP SĨ ĐIỆN TỬ (CYBER DIGITAL BADGE)
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF1E293B), Color(0xFF0F172A), Color(0xFF0B132B)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFF59E0B), width: 1.5),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                blurRadius: 18,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF59E0B).withValues(alpha: 0.2),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.workspace_premium_rounded, color: Color(0xFFF59E0B), size: 20),
                      ),
                      const SizedBox(width: 8),
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'THẺ HIỆP SĨ CỨU HỘ SAFESOLO',
                            style: TextStyle(color: Color(0xFFF59E0B), fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                          ),
                          Text('GOOD SAMARITAN RESCUE CORPS', style: TextStyle(color: Colors.white38, fontSize: 8)),
                        ],
                      ),
                    ],
                  ),
                  const Text('GRADE A', style: TextStyle(color: Color(0xFF10B981), fontSize: 11, fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 18),

              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('HỌ VÀ TÊN HIỆP SĨ:', style: TextStyle(color: Colors.white38, fontSize: 9.5)),
                        Text(
                          heroName.toUpperCase(),
                          style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 6),
                        const Text('MÃ SỐ ĐỊNH DANH CCCD:', style: TextStyle(color: Colors.white38, fontSize: 9.5)),
                        const Text('079*******89 (ĐÃ ĐỐI SOÁT)', style: TextStyle(color: Colors.white70, fontSize: 11.5, fontFamily: 'monospace')),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            _buildMiniChip('NHÓM MÁU: O+'),
                            const SizedBox(width: 6),
                            _buildMiniChip('CPR/AED CERTIFIED'),
                          ],
                        ),
                      ],
                    ),
                  ),

                  // QR Code xác thực cho Công An 113 / Bệnh Viện 115 quét
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: QrImageView(
                      data: 'SAFESOLO-HERO:ID=0928;NAME=$heroName;KYC=VERIFIED;GRADE=A',
                      version: QrVersions.auto,
                      size: 72.0,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              const Divider(color: Colors.white12, height: 1),
              const SizedBox(height: 10),
              const Text(
                'Thẻ có giá trị xuất trình khi hỗ trợ hiện trường khẩn cấp theo điều khoản Miễn trừ trách nhiệm cứu người (Good Samaritan Law).',
                style: TextStyle(color: Colors.white38, fontSize: 9, fontStyle: FontStyle.italic),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),

        // VÍ QUỸ TRỢ CẤP XĂNG XE & CỨU NẠN (HERO RESCUE BOUNTY FUND)
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.3)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('VÍ QUỸ HỖ TRỢ HIỆP SĨ (BOUNTY WALLET)', style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold)),
                  Text('SAFE FUND TOC', style: TextStyle(color: Color(0xFF10B981), fontSize: 9.5, fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Số dư trợ cấp xăng xe & hao mòn:', style: TextStyle(color: Colors.white38, fontSize: 10.5)),
                      SizedBox(height: 2),
                      Text(
                        '1.850.000 VNĐ',
                        style: TextStyle(color: Color(0xFF10B981), fontSize: 22, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    onPressed: () {
                      TopToast.show(context, message: 'Đã gửi yêu cầu rút 1.850.000 VNĐ về ví MoMo/Ngân hàng');
                    },
                    child: const Text('RÚT TIỀN', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              const Text('Nhật ký giải ngân gần nhất:', style: TextStyle(color: Colors.white38, fontSize: 10)),
              const SizedBox(height: 6),
              _buildWalletRow('+200.000 VNĐ', 'Trợ cấp xăng xe ca AFib Nguyễn Thị Hoa (Hôm nay)', '14:40'),
              _buildWalletRow('+150.000 VNĐ', 'Hỗ trợ ca tai nạn Lý Thường Kiệt (Hôm qua)', '21:15'),
              _buildWalletRow('+500.000 VNĐ', 'Thưởng Hiệp Sĩ phản ứng nhanh xuất sắc tuần', '15/09'),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // THÀNH TÍCH CỨU NẠN
        Row(
          children: [
            Expanded(child: _buildAchievementStat('38', 'Ca cứu nạn', Icons.military_tech_rounded, const Color(0xFFF59E0B))),
            const SizedBox(width: 10),
            Expanded(child: _buildAchievementStat('4.98 ⭐', '156 Đánh giá', Icons.thumb_up_rounded, const Color(0xFF38BDF8))),
            const SizedBox(width: 10),
            Expanded(child: _buildAchievementStat('2.8p', 'ETA trung bình', Icons.speed_rounded, const Color(0xFF10B981))),
          ],
        ),
      ],
    );
  }

  Widget _buildMiniChip(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: Colors.white10,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(label, style: const TextStyle(color: Colors.white70, fontSize: 9.5, fontWeight: FontWeight.bold)),
    );
  }

  Widget _buildWalletRow(String amount, String desc, String time) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(desc, style: const TextStyle(color: Colors.white70, fontSize: 10.5), maxLines: 1, overflow: TextOverflow.ellipsis),
          ),
          const SizedBox(width: 8),
          Text(amount, style: const TextStyle(color: Color(0xFF10B981), fontSize: 11, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildAchievementStat(String value, String label, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF1E293B)),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
          Text(label, style: const TextStyle(color: Colors.white38, fontSize: 10)),
        ],
      ),
    );
  }

  /// Thanh Navigation Bar 4 Tab Tác Chiến Chuyên Biệt
  Widget _buildTacticalBottomBar() {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF0B1120),
        border: Border(top: BorderSide(color: Color(0xFF1E293B))),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildNavItem(0, Icons.radar_rounded, 'Radar SOS'),
              _buildNavItem(1, Icons.bolt_rounded, 'Đang Cứu Hộ'),
              _buildNavItem(2, Icons.medical_services_rounded, 'Máy AED'),
              _buildNavItem(3, Icons.badge_rounded, 'Thẻ & Ví Quỹ'),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(int index, IconData icon, String label) {
    final isSelected = _activeTab == index;
    final color = isSelected ? const Color(0xFF10B981) : Colors.white38;

    return InkWell(
      onTap: () => setState(() => _activeTab = index),
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(color: color, fontSize: 10, fontWeight: isSelected ? FontWeight.bold : FontWeight.normal),
            ),
          ],
        ),
      ),
    );
  }
}
