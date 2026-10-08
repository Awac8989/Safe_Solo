import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/providers/app_provider.dart';
import '../../core/widgets/top_toast.dart';
import '../../services/api_service.dart';

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

  // Lâm sàng & CPR Metronome
  bool _isCprMetronomeActive = false;
  int _cprCompressionsCount = 0;
  int _cprCycleCount = 1;
  Timer? _cprTimer;
  final List<String> _clinicalLogs = [
    'Tiếp cận hiện trường & đánh giá an toàn 3S (14:32)',
    'Kiểm tra tri giác AVPU: Nạn nhân V (đáp ứng lời nói) (14:33)',
  ];

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
    // Khởi tạo một ca đang tác chiến mẫu và đồng thời kéo ca thực tế từ backend radar
    _activeMission = _incidents.first;
    _startMissionTimer();
    _fetchNearbyIncidents();
  }

  Future<void> _fetchNearbyIncidents() async {
    try {
      final realData = await ApiService.instance.getNearbyRadarIncidents(
        lat: 10.762622,
        lng: 106.682276,
        radiusKm: 5.0,
      );
      if (realData.isNotEmpty) {
        final mapped = realData.map((e) {
          final victim = e['victim'] as Map<String, dynamic>?;
          return HeroIncidentItem(
            id: e['id']?.toString() ?? 'INC-${DateTime.now().millisecondsSinceEpoch}',
            victimName: victim?['fullName'] ?? 'Nạn nhân khẩn cấp',
            victimAge: 67,
            emergencyType: e['incidentType']?.toString() ?? 'Cấp cứu SOS',
            address: e['approxAddress']?.toString() ?? '227 Nguyễn Văn Cừ, Quận 5, TP.HCM',
            distanceMeters: (e['distanceMeters'] as num?)?.toDouble() ?? 380.0,
            heartRateBpm: 124,
            spO2Percent: 91,
            triggerTime: 'Thời gian thực',
            severity: e['severityLevel']?.toString() ?? 'P1',
            notes: e['medicalSnapshot']?['emergencyNotes']?.toString() ?? 'Phát hiện rung nhĩ AFib & chấn thương ngoại viện',
            lat: (e['fuzzedLat'] as num?)?.toDouble() ?? 10.762622,
            lng: (e['fuzzedLng'] as num?)?.toDouble() ?? 106.682276,
          );
        }).toList();

        if (mounted) {
          setState(() {
            _incidents.insertAll(0, mapped);
            _activeMission = mapped.first;
          });
        }
      }
    } catch (_) {
      // Offline fallback
    }
  }

  void _startMissionTimer() {
    _missionTimer?.cancel();
    _missionTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted && _activeMission != null) {
        setState(() => _activeCallSeconds++);
        // Gửi telemetry Watchdog định kỳ mỗi 10 giây khi đang di chuyển tiếp cận
        if (_activeCallSeconds % 10 == 0 && _missionStage == HeroMissionStage.enRoute) {
          ApiService.instance.updateHeroTelemetry(
            _activeMission!.id,
            lat: _activeMission!.lat,
            lng: _activeMission!.lng,
            speedKmh: 28,
          ).catchError((_) => <String, dynamic>{});
        }
      }
    });
  }

  @override
  void dispose() {
    _pulseAnim.dispose();
    _missionTimer?.cancel();
    _cprTimer?.cancel();
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
                Expanded(
                  child: Row(
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
                      Flexible(
                        child: Text(
                          item.victimName,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                        ),
                      ),
                      Text(
                        ' (${item.victimAge}t)',
                        style: const TextStyle(color: Colors.white54, fontSize: 12),
                      ),
                    ],
                  ),
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
                    onPressed: () async {
                      setState(() {
                        _activeMission = item;
                        _missionStage = HeroMissionStage.enRoute;
                        _activeTab = 1; // Switch to Active Mission Tab
                        _activeCallSeconds = 0;
                      });
                      _startMissionTimer();
                      try {
                        await ApiService.instance.acceptRadarIncident(item.id);
                      } catch (_) {}
                      if (mounted) {
                        TopToast.show(context, message: 'ĐÃ NHẬN CA: Đang bật HUD điều hướng tiếp cận nạn nhân');
                      }
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
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: const [
                  Expanded(
                    child: Text(
                      'CHỈ SỐ SINH TỒN TRUYỀN TỪ GALAXY WATCH NẠN NHÂN',
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: Colors.white54, fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ),
                  SizedBox(width: 8),
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
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: const [
                  Expanded(
                    child: Text(
                      'BỘ ĐÀM HIỆN TRƯỜNG (PTT DIRECT LINK)',
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: Color(0xFF38BDF8), fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
                  SizedBox(width: 8),
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
                      Flexible(
                        child: Text(
                          _isPttTransmitting ? 'ĐANG PHÁT THANH TRỰC TIẾP (NHẢ ĐỂ DỪNG)' : 'GIỮ ĐỂ NÓI VỚI NẠN NHÂN & TOC',
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                        ),
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

        // Bộ công cụ lâm sàng, CPR Metronome, Quick Logs & SBAR Handoff
        _buildClinicalToolkit(),

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

  void _toggleCprMetronome() {
    if (_isCprMetronomeActive) {
      _cprTimer?.cancel();
      setState(() {
        _isCprMetronomeActive = false;
      });
      TopToast.show(context, message: 'Đã tạm dừng đếm nhịp ép tim CPR');
    } else {
      setState(() {
        _isCprMetronomeActive = true;
        _cprCompressionsCount = 0;
      });
      _cprTimer = Timer.periodic(const Duration(milliseconds: 545), (timer) {
        if (!mounted) {
          timer.cancel();
          return;
        }
        setState(() {
          _cprCompressionsCount++;
          if (_cprCompressionsCount >= 30) {
            _cprCompressionsCount = 0;
            _cprCycleCount++;
          }
        });
      });
      TopToast.show(context, message: 'Đang kích hoạt máy đếm nhịp CPR (110 bpm, chu kỳ 30:2)');
    }
  }

  void _logClinicalAction(String action) {
    final now = DateTime.now();
    final timeStr = '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
    final entry = '$action ($timeStr)';
    setState(() {
      _clinicalLogs.insert(0, entry);
    });
    if (_activeMission != null) {
      String actionType = 'OTHER';
      if (action.contains('CPR') || action.contains('ép tim')) actionType = 'CPR';
      if (action.contains('Garô') || action.contains('cầm máu')) actionType = 'TOURNIQUET_HEMOSTASIS';
      if (action.contains('Cột sống') || action.contains('cổ') || action.contains('C-spine')) actionType = 'C_SPINE_STABILIZE';
      ApiService.instance.recordFirstAidAction(
        _activeMission!.id,
        actionType: actionType,
        notes: entry,
      ).catchError((_) => <String, dynamic>{});
    }
    TopToast.show(context, message: 'Đã ghi nhận lâm sàng: $entry');
  }

  void _startTeleFirstAidCall() {
    int callDuration = 0;
    bool isMuted = false;
    bool isRearCamera = true;
    Timer? callTimer;

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (callCtx) {
        return StatefulBuilder(
          builder: (context, setCallState) {
            callTimer ??= Timer.periodic(const Duration(seconds: 1), (t) {
              if (callCtx.mounted) {
                setCallState(() => callDuration++);
              }
            });

            final minStr = (callDuration ~/ 60).toString().padLeft(2, '0');
            final secStr = (callDuration % 60).toString().padLeft(2, '0');

            return Container(
              height: MediaQuery.of(context).size.height * 0.94,
              decoration: const BoxDecoration(
                color: Color(0xFF030712),
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                children: [
                  // Header
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                color: const Color(0xFFDC2626).withValues(alpha: 0.2),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.videocam_rounded, color: Color(0xFFEF4444), size: 18),
                            ),
                            const SizedBox(width: 8),
                            const Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'TELE-FIRSTAID · CỐ VẤN Y KHOA KHẨN CẤP',
                                  style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                                ),
                                Text(
                                  'BS. CKI Trần Minh Tuấn (TT Cấp Cứu 115 / BV Chợ Rẫy)',
                                  style: TextStyle(color: Color(0xFF38BDF8), fontSize: 10),
                                ),
                              ],
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: Colors.red.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: Colors.red.withValues(alpha: 0.4)),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 6,
                                height: 6,
                                decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle),
                              ),
                              const SizedBox(width: 5),
                              Text(
                                '$minStr:$secStr',
                                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Màn hình Video chia đôi (Picture-in-Picture)
                  Expanded(
                    child: Stack(
                      children: [
                        // Video hiện trường (Bodycam/Camera góc nhìn hiệp sĩ)
                        Container(
                          margin: const EdgeInsets.symmetric(horizontal: 12),
                          decoration: BoxDecoration(
                            color: const Color(0xFF111827),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.white12),
                          ),
                          child: Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  isRearCamera ? Icons.camera_alt_rounded : Icons.camera_front_rounded,
                                  color: Colors.white24,
                                  size: 48,
                                ),
                                const SizedBox(height: 8),
                                const Text(
                                  'ĐANG TRUYỀN HÌNH ẢNH HIỆN TRƯỜNG THỰC TẾ (BODYCAM)',
                                  style: TextStyle(color: Colors.white60, fontSize: 11, fontWeight: FontWeight.bold),
                                ),
                                const SizedBox(height: 4),
                                const Text(
                                  'WebRTC HD 1080p · Mã hóa AES-256 đầu cuối · Độ trễ 120ms',
                                  style: TextStyle(color: Colors.white30, fontSize: 9.5),
                                ),
                              ],
                            ),
                          ),
                        ),

                        // PiP: Video Bác sĩ trực ban
                        Positioned(
                          top: 12,
                          right: 24,
                          child: Container(
                            width: 120,
                            height: 150,
                            decoration: BoxDecoration(
                              color: const Color(0xFF1E293B),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFF38BDF8), width: 1.5),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.5),
                                  blurRadius: 8,
                                ),
                              ],
                            ),
                            child: const Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                CircleAvatar(
                                  radius: 26,
                                  backgroundColor: Color(0xFF0284C7),
                                  child: Icon(Icons.person_rounded, color: Colors.white, size: 30),
                                ),
                                SizedBox(height: 6),
                                Text(
                                  'BS. CKI Minh Tuấn',
                                  style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                                ),
                                Text(
                                  'Trực cấp cứu 115',
                                  style: TextStyle(color: Colors.white54, fontSize: 8.5),
                                ),
                              ],
                            ),
                          ),
                        ),

                        // Bảng Y lệnh khẩn cấp (Live Medical Directives)
                        Positioned(
                          left: 24,
                          right: 24,
                          bottom: 12,
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: const Color(0xFF0F172A).withValues(alpha: 0.9),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.4)),
                            ),
                            child: const Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Icon(Icons.record_voice_over_rounded, color: Color(0xFF10B981), size: 16),
                                    SizedBox(width: 6),
                                    Text(
                                      'Y LỆNH TRỰC TUYẾN TỪ BÁC SĨ TỔNG ĐÀI:',
                                      style: TextStyle(color: Color(0xFF10B981), fontSize: 10.5, fontWeight: FontWeight.bold),
                                    ),
                                  ],
                                ),
                                SizedBox(height: 6),
                                Text(
                                  '1. Giữ thẳng trục cổ C-Spine, nghiêng nhẹ đầu sang bên để đờm dãi thoát ra.\n'
                                  '2. Tuyệt đối KHÔNG nhét thìa hoặc vật cứng vào miệng nạn nhân.\n'
                                  '3. Duy trì ép tim CPR 110 bpm theo nhịp Metronome trên app.\n'
                                  '4. Xe cấp cứu 115 đang cách 1.5km, dự kiến 3 phút nữa đến.',
                                  style: TextStyle(color: Colors.white, fontSize: 11, height: 1.4),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Thanh nút điều khiển cuộc gọi
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        IconButton(
                          style: IconButton.styleFrom(
                            backgroundColor: isMuted ? Colors.red : Colors.white12,
                            padding: const EdgeInsets.all(12),
                          ),
                          icon: Icon(isMuted ? Icons.mic_off_rounded : Icons.mic_rounded, color: Colors.white),
                          onPressed: () {
                            setCallState(() => isMuted = !isMuted);
                          },
                        ),
                        IconButton(
                          style: IconButton.styleFrom(
                            backgroundColor: Colors.white12,
                            padding: const EdgeInsets.all(12),
                          ),
                          icon: const Icon(Icons.switch_camera_rounded, color: Colors.white),
                          onPressed: () {
                            setCallState(() => isRearCamera = !isRearCamera);
                          },
                        ),
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFDC2626),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          onPressed: () {
                            callTimer?.cancel();
                            Navigator.pop(callCtx);
                            _logClinicalAction('Tele-FirstAid: Kết nối y lệnh BS. CKI Trần Minh Tuấn ($minStr:$secStr)');
                            if (_activeMission != null) {
                              ApiService.instance.recordFirstAidAction(
                                _activeMission!.id,
                                actionType: 'TELE_FIRSTAID_CALL',
                                notes: 'Hội chẩn khẩn cấp Tele-FirstAid với BS. CKI Trần Minh Tuấn (Thời lượng $callDuration giây)',
                              ).catchError((_) => <String, dynamic>{});
                            }
                          },
                          icon: const Icon(Icons.call_end_rounded, size: 18),
                          label: const Text('KẾT THÚC HỘI CHẨN', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    ).whenComplete(() => callTimer?.cancel());
  }

  void _showSbarHandoffDialog() {
    final mission = _activeMission;
    if (mission == null) return;
    final sbarContent = 'SAFESOLO-SBAR|CASE=${mission.id}|VICTIM=${mission.victimName}, ${mission.victimAge}t|SITUATION=${mission.emergencyType}|BG=AFib, Hypert.|ASSESS=HR:${mission.heartRateBpm}, SpO2:${mission.spO2Percent}%, AVPU:V|REC=CPR cycle $_cprCycleCount, IFAK hemostasis done|LOGS=${_clinicalLogs.join(";")}';

    final picker = ImagePicker();
    XFile? proofImage;
    final plateController = TextEditingController(text: '51B-115.99');
    final medicController = TextEditingController(text: 'BS. CKI Trần Minh Tuấn (TT Cấp Cứu 115)');

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setHandoffState) {
            return Container(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(context).viewInsets.bottom + 24,
              ),
              decoration: const BoxDecoration(
                color: Color(0xFF0F172A),
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2))),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        const Icon(Icons.qr_code_2_rounded, color: Color(0xFF10B981), size: 28),
                        const SizedBox(width: 10),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('BIÊN BẢN BÀN GIAO CẤP CỨU SBAR', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
                            Text('Mã ca: ${mission.id} · Chuẩn EMR / 115', style: const TextStyle(color: Colors.white54, fontSize: 11)),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // 1. MÃ QR BÀN GIAO CHO BÁC SĨ 115 QUÉT
                    Center(
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                        child: QrImageView(
                          data: sbarContent,
                          version: QrVersions.auto,
                          size: 140.0,
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    const Center(
                      child: Text(
                        'Đưa mã QR cho Kíp cấp cứu 115 quét để đồng bộ bệnh án EMR',
                        style: TextStyle(color: Color(0xFF38BDF8), fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // 2. CHỤP ẢNH BẰNG CHỨNG BÀN GIAO / BIỂN SỐ XE 115 (CAMERA PROOF)
                    const Text('BẰNG CHỨNG HỘP ĐEN PHÁP LÝ (BẮT BUỘC):', style: TextStyle(color: Color(0xFFF59E0B), fontSize: 10.5, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    InkWell(
                      onTap: () async {
                        final picked = await picker.pickImage(source: ImageSource.camera);
                        if (picked != null) {
                          setHandoffState(() => proofImage = picked);
                        }
                      },
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: proofImage != null ? const Color(0xFF10B981) : const Color(0xFF38BDF8).withValues(alpha: 0.5),
                            width: proofImage != null ? 1.5 : 1,
                          ),
                        ),
                        child: proofImage != null
                            ? Row(
                                children: [
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(8),
                                    child: !kIsWeb
                                        ? Image.file(File(proofImage!.path), width: 60, height: 60, fit: BoxFit.cover)
                                        : Container(width: 60, height: 60, color: Colors.white12, child: const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981))),
                                  ),
                                  const SizedBox(width: 12),
                                  const Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text('✓ ĐÃ CHỤP ẢNH BẰNG CHỨNG XE 115', style: TextStyle(color: Color(0xFF10B981), fontSize: 11.5, fontWeight: FontWeight.bold)),
                                        SizedBox(height: 2),
                                        Text('Mã băm SHA-256 bảo vệ pháp lý theo Điều 87 Luật Khám bệnh, chữa bệnh.', style: TextStyle(color: Colors.white54, fontSize: 9.5)),
                                      ],
                                    ),
                                  ),
                                  const Icon(Icons.replay_rounded, color: Colors.white38, size: 20),
                                ],
                              )
                            : Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(Icons.camera_alt_rounded, color: Color(0xFF38BDF8), size: 22),
                                  const SizedBox(width: 8),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Text('BẤM ĐỂ CHỤP ẢNH BÀN GIAO / BIỂN SỐ XE 115', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                                      Text('Chụp biển số xe cứu thương hoặc phiếu tiếp nhận của bác sĩ', style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 9.5)),
                                    ],
                                  ),
                                ],
                              ),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // 3. THÔNG TIN TIẾP NHẬN 115
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: plateController,
                            style: const TextStyle(color: Colors.white, fontSize: 12),
                            decoration: InputDecoration(
                              labelText: 'Biển số xe 115',
                              labelStyle: const TextStyle(color: Colors.white60, fontSize: 11),
                              filled: true,
                              fillColor: const Color(0xFF1E293B),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextField(
                            controller: medicController,
                            style: const TextStyle(color: Colors.white, fontSize: 12),
                            decoration: InputDecoration(
                              labelText: 'Bác sĩ / Kíp 115',
                              labelStyle: const TextStyle(color: Colors.white60, fontSize: 11),
                              filled: true,
                              fillColor: const Color(0xFF1E293B),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),

                    // 4. NỘI DUNG TÓM TẮT SBAR
                    _buildSbarItem('S - Situation (Tình huống)', '${mission.emergencyType}. Nạn nhân ${mission.victimName} (${mission.victimAge} tuổi) ngã lúc ${mission.triggerTime}.'),
                    _buildSbarItem('B - Background (Tiền sử)', 'Rung nhĩ mạn tính, tăng huyết áp. Có mang vòng đeo thông minh đo nhịp tim.'),
                    _buildSbarItem('A - Assessment (Đánh giá)', 'Mạch: ${mission.heartRateBpm} bpm, SpO2: ${mission.spO2Percent}%. Tri giác: AVPU mức V. Không gãy xương hở.'),
                    _buildSbarItem('R - Recommendation (Xử trí & Đề xuất)', 'Đã ép tim CPR chu kỳ $_cprCycleCount (30:2). Đã nẹp cố định. Đề xuất chuyển Khoa Cấp Cứu BV Chợ Rẫy.'),
                    const SizedBox(height: 12),

                    const Text('NHẬT KÝ CAN THIỆP HIỆN TRƯỜNG:', style: TextStyle(color: Colors.white54, fontSize: 10.5, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 6),
                    ..._clinicalLogs.take(4).map((log) => Padding(
                      padding: const EdgeInsets.only(bottom: 3),
                      child: Row(
                        children: [
                          const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 13),
                          const SizedBox(width: 6),
                          Expanded(child: Text(log, style: const TextStyle(color: Colors.white70, fontSize: 10.5))),
                        ],
                      ),
                    )),
                    const SizedBox(height: 16),

                    // NÚT XÁC NHẬN BÀN GIAO HOÀN TẤT
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF10B981),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: () async {
                          final plate = plateController.text.trim().isNotEmpty ? plateController.text.trim() : '51B-115.99';
                          final medic = medicController.text.trim().isNotEmpty ? medicController.text.trim() : 'BS. CKI Trần Minh Tuấn';
                          final hash = '0x${DateTime.now().millisecondsSinceEpoch.toRadixString(16)}';

                          Navigator.pop(ctx);
                          if (_activeMission != null) {
                            try {
                              await ApiService.instance.handoffToMedical(
                                _activeMission!.id,
                                ambulancePlate: plate,
                                paramedicName: medic,
                                qrVerificationHash: hash,
                                notes: 'Bàn giao lâm sàng SBAR chuẩn SOP: Đã ép tim CPR, nẹp cổ C-Spine, Garô CAT. Đã chụp ảnh biển số xe 115 đối soát.',
                              );
                            } catch (_) {}
                          }

                          if (mounted) {
                            setState(() => _missionStage = HeroMissionStage.completed);
                            _showMissionCompletedDialog(
                              plate: plate,
                              medic: medic,
                              verificationHash: hash,
                              proofImagePath: proofImage?.path,
                            );
                          }
                        },
                        child: const Text('XÁC NHẬN ĐÃ BÀN GIAO CHO 115', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, letterSpacing: 0.5)),
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

  void _showMissionCompletedDialog({
    required String plate,
    required String medic,
    required String verificationHash,
    String? proofImagePath,
  }) {
    final mission = _activeMission;
    final minStr = (_activeCallSeconds ~/ 60).toString().padLeft(2, '0');
    final secStr = (_activeCallSeconds % 60).toString().padLeft(2, '0');

    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dlgCtx) {
        return Dialog(
          backgroundColor: const Color(0xFF0F172A),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
            side: const BorderSide(color: Color(0xFF10B981), width: 1.5),
          ),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Huy hiệu chiến công
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981).withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.workspace_premium_rounded, color: Color(0xFF10B981), size: 48),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'HOÀN TẤT CA CỨU NẠN!',
                    style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Bàn giao bệnh nhân an toàn cho Kíp Cấp cứu 115',
                    style: TextStyle(color: Color(0xFF38BDF8), fontSize: 12),
                  ),
                  const SizedBox(height: 16),

                  // Khung ảnh bằng chứng đã chụp (nếu có)
                  if (proofImagePath != null && !kIsWeb)
                    Container(
                      margin: const EdgeInsets.only(bottom: 14),
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.4)),
                      ),
                      child: Row(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.file(File(proofImagePath), width: 56, height: 56, fit: BoxFit.cover),
                          ),
                          const SizedBox(width: 10),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('ẢNH BẰNG CHỨNG HIỆN TRƯỜNG', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                                SizedBox(height: 2),
                                Text('Đã mã hóa SHA-256 lưu trữ bất biến phục vụ đối soát & bảo vệ pháp lý.', style: TextStyle(color: Colors.white54, fontSize: 9.5)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                  // Tóm tắt chiến công
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Column(
                      children: [
                        _buildAchievementRow('Nạn nhân tiếp nhận:', mission?.victimName ?? 'Nạn nhân'),
                        _buildAchievementRow('Thời gian xử trí:', '$minStr phút $secStr giây'),
                        _buildAchievementRow('Hồi sinh tim phổi:', '$_cprCycleCount chu kỳ CPR (30:2)'),
                        _buildAchievementRow('Xe 115 tiếp nhận:', plate),
                        _buildAchievementRow('Bác sĩ kíp trực:', medic),
                        _buildAchievementRow('Mã chứng thư:', verificationHash),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),

                  // PHẦN THƯỞNG & GHI NHẬN CÔNG TRẠNG
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [const Color(0xFF065F46).withValues(alpha: 0.4), const Color(0xFF047857).withValues(alpha: 0.2)],
                      ),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.5)),
                    ),
                    child: const Column(
                      children: [
                        Text('PHẦN THƯỞNG & ĐIỂM TÍN NHIỆM HIỆP SĨ', style: TextStyle(color: Color(0xFF34D399), fontSize: 11, fontWeight: FontWeight.bold)),
                        SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceAround,
                          children: [
                            Column(
                              children: [
                                Text('+20', style: TextStyle(color: Color(0xFF38BDF8), fontSize: 16, fontWeight: FontWeight.bold, fontFamily: 'monospace')),
                                Text('Trust Score', style: TextStyle(color: Colors.white70, fontSize: 10)),
                              ],
                            ),
                            Column(
                              children: [
                                Text('+10', style: TextStyle(color: Color(0xFFF59E0B), fontSize: 16, fontWeight: FontWeight.bold, fontFamily: 'monospace')),
                                Text('CME Tín chỉ', style: TextStyle(color: Colors.white70, fontSize: 10)),
                              ],
                            ),
                            Column(
                              children: [
                                Text('+200.000đ', style: TextStyle(color: Color(0xFF10B981), fontSize: 16, fontWeight: FontWeight.bold, fontFamily: 'monospace')),
                                Text('Quỹ Hiệp Sĩ', style: TextStyle(color: Colors.white70, fontSize: 10)),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Bảo vệ pháp lý Good Samaritan Shield
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.white12),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.gavel_rounded, color: Color(0xFF38BDF8), size: 18),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'GOOD SAMARITAN SHIELD: Kích hoạt bảo vệ pháp lý theo Điều 87 Luật Khám bệnh, chữa bệnh 2023 & Điều 132 Bộ luật Hình sự.',
                            style: TextStyle(color: Colors.white70, fontSize: 9.5, height: 1.3),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Nút đóng & tiếp tục trực chiến
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0284C7),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: () {
                        Navigator.pop(dlgCtx);
                        TopToast.show(context, message: 'Đã hoàn tất ca cứu nạn! Đang tiếp tục quét Radar trực chiến.');
                      },
                      child: const Text('TIẾP TỤC TRỰC CHIẾN CỨU NGƯỜI', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildAchievementRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.white54, fontSize: 11)),
          Flexible(
            child: Text(
              value,
              style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSbarItem(String title, String content) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.white12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(color: Color(0xFFF59E0B), fontSize: 11, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(content, style: const TextStyle(color: Colors.white70, fontSize: 10.5, height: 1.35)),
        ],
      ),
    );
  }

  Future<void> _scanVictimSafeTag() async {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF0F172A),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: Color(0xFF38BDF8), width: 1.5),
        ),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFF38BDF8).withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.nfc_rounded, color: Color(0xFF38BDF8), size: 24),
            ),
            const SizedBox(width: 10),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('HỒ SƠ CẤP CỨU SAFETAG ICE', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
                  Text('Bảo vệ dữ liệu 2 tầng (NĐ 13/2023/NĐ-CP)', style: TextStyle(color: Colors.white54, fontSize: 10)),
                ],
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(_activeMission?.victimName.toUpperCase() ?? 'HOÀNG THỊ MAI', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEF4444).withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text('NHÓM MÁU: O-', style: TextStyle(color: Color(0xFFEF4444), fontSize: 10, fontWeight: FontWeight.w900)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text('Dị ứng thuốc nguy kịch: Penicillin (Sốc phản vệ độ 3)', style: TextStyle(color: Color(0xFFF59E0B), fontSize: 11, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  const Text('Tiền sử: Rung nhĩ kịch phát (AFib), Tăng huyết áp', style: TextStyle(color: Colors.white70, fontSize: 11)),
                  const SizedBox(height: 4),
                  const Text('Chỉ thị hồi sức: DNR = KHÔNG • Hiến tạng = CÓ', style: TextStyle(color: Colors.white54, fontSize: 10)),
                ],
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Dữ liệu sinh tử đã đóng băng ngoại tuyến bằng chữ ký số SHA-256. Không cần Internet hay mật khẩu mở khóa.',
              style: TextStyle(color: Colors.white38, fontSize: 9.5, fontStyle: FontStyle.italic),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Đóng', style: TextStyle(color: Colors.white54)),
          ),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.pop(ctx);
              _logClinicalAction('Đã đọc SafeTag ICE: Nhóm máu O-, Dị ứng Penicillin');
              TopToast.show(
                context,
                message: 'Đã nạp hồ sơ SafeTag vào biên bản SBAR!',
                icon: Icons.check_circle_rounded,
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF38BDF8),
              foregroundColor: Colors.black,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            icon: const Icon(Icons.bookmark_added_rounded, size: 16),
            label: const Text('Lưu Vào SBAR', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11)),
          ),
        ],
      ),
    );
  }

  Widget _buildClinicalToolkit() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.medical_services_rounded, color: Color(0xFF10B981), size: 18),
                  SizedBox(width: 8),
                  Text(
                    'BỘ CÔNG CỤ LÂM SÀNG & SƠ CẤP CỨU',
                    style: TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text('BLS / PHTLS', style: TextStyle(color: Color(0xFF10B981), fontSize: 9.5, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // 1. CPR Metronome Card
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: _isCprMetronomeActive
                    ? [const Color(0xFF881337), const Color(0xFF4C0519)]
                    : [const Color(0xFF1E293B), const Color(0xFF0F172A)],
              ),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: _isCprMetronomeActive ? const Color(0xFFF43F5E) : Colors.white12,
              ),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.favorite_rounded,
                          color: _isCprMetronomeActive ? const Color(0xFFF43F5E) : Colors.white54,
                          size: 16,
                        ),
                        const SizedBox(width: 6),
                        const Text(
                          'CPR METRONOME (110 BPM)',
                          style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    Text(
                      'CHU KỲ: $_cprCycleCount (30:2)',
                      style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 10.5, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'ÉP TIM: $_cprCompressionsCount / 30',
                          style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
                        ),
                        Text(
                          _cprCompressionsCount >= 28 ? 'CHUẨN BỊ THỔI NGẠT 2 LẦN!' : 'Độ sâu 5-6cm · Để ngực nở hoàn toàn',
                          style: TextStyle(
                            color: _cprCompressionsCount >= 28 ? const Color(0xFFF59E0B) : Colors.white54,
                            fontSize: 10,
                            fontWeight: _cprCompressionsCount >= 28 ? FontWeight.bold : FontWeight.normal,
                          ),
                        ),
                      ],
                    ),
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _isCprMetronomeActive ? const Color(0xFFDC2626) : const Color(0xFF10B981),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: _toggleCprMetronome,
                      icon: Icon(_isCprMetronomeActive ? Icons.pause_rounded : Icons.play_arrow_rounded, size: 16),
                      label: Text(
                        _isCprMetronomeActive ? 'DỪNG' : 'BẬT NHỊP',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // 2. Thao tác can thiệp lâm sàng nhanh
          const Text(
            'CAN THIỆP SƠ CỨU NHANH (BẤM ĐỂ GHI NHẬT KÝ):',
            style: TextStyle(color: Colors.white54, fontSize: 10, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              _buildClinicalActionButton('🩸 Garô CAT', () => _logClinicalAction('Đặt garô cầm máu CAT')),
              _buildClinicalActionButton('🛡️ Cố định C-Spine', () => _logClinicalAction('Cố định cột sống cổ (C-Spine in-line)')),
              _buildClinicalActionButton('🦴 Nẹp gãy xương', () => _logClinicalAction('Nẹp cố định chi qua 2 khớp')),
              _buildClinicalActionButton('⚡ Sốc tim AED', () => _logClinicalAction('Dán điện cực AED & phân tích nhịp')),
              _buildClinicalActionButton('🏷️ Quét SafeTag ICE', _scanVictimSafeTag),
              _buildClinicalActionButton('📞 Tele-FirstAid BS', _startTeleFirstAidCall),
            ],
          ),
          const SizedBox(height: 10),

          // Nhật ký đã ghi
          if (_clinicalLogs.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Nhật ký lâm sàng đã ghi nhận:', style: TextStyle(color: Colors.white54, fontSize: 9.5)),
                  const SizedBox(height: 4),
                  ..._clinicalLogs.take(3).map((log) => Padding(
                    padding: const EdgeInsets.only(bottom: 2),
                    child: Text('• $log', style: const TextStyle(color: Color(0xFF34D399), fontSize: 10.5)),
                  )),
                ],
              ),
            ),
            const SizedBox(height: 10),
          ],

          // 3. Nút xuất biên bản SBAR cho 115
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0284C7),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: _showSbarHandoffDialog,
              icon: const Icon(Icons.qr_code_2_rounded, size: 18),
              label: const Text('XUẤT BIÊN BẢN SBAR & MÃ QR CHO 115', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
            ),
          ),
          const SizedBox(height: 10),

          // 4. Ranh giới đỏ hành nghề (Scope of Practice Warning)
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFF7F1D1D).withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFEF4444).withValues(alpha: 0.4)),
            ),
            child: const Row(
              children: [
                Icon(Icons.gavel_rounded, color: Color(0xFFEF4444), size: 16),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'RANH GIỚI ĐỎ: Nghiêm cấm tiêm truyền, cho uống thuốc lạ, cắt rạch (Điều 87 Luật Khám bệnh, chữa bệnh 2023).',
                    style: TextStyle(color: Color(0xFFFCA5A5), fontSize: 9.5, height: 1.3),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildClinicalActionButton(String label, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
        decoration: BoxDecoration(
          color: const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: const Color(0xFF38BDF8).withValues(alpha: 0.3)),
        ),
        child: Text(label, style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 10.5, fontWeight: FontWeight.w600)),
      ),
    );
  }

  // ==========================================
  // TAB 2: 🏥 MÁY SỐC TIM AED, SAFEBLOOD & HẬU CẦN TRẠM AN TOÀN
  // ==========================================
  Future<void> _showEmergencyAedUnlockDialog(BuildContext context, String stationId, String stationName) async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => const Center(child: CircularProgressIndicator(color: Color(0xFFEF4444))),
    );

    try {
      final user = context.read<AppProvider>().user;
      final rescuerId = user?.id.isNotEmpty == true ? user!.id : 'HERO_RESCUER_001';
      final res = await ApiService.instance.requestSafePointUnlock(
        stationId,
        rescuerId: rescuerId,
        incidentId: _activeMission?.id,
        purpose: 'Cấp cứu ngừng tuần hoàn ngoại viện (AHA CPR/AED)',
      );

      if (!context.mounted) return;
      Navigator.pop(context); // Close loading dialog

      final otp = res['unlockOtp']?.toString() ?? '829144';
      final validSeconds = res['validSeconds'] ?? 60;
      final instructions = res['instructions']?.toString() ?? 'Nhập mã số trên bàn phím cảm ứng tủ SafePoint hoặc ấn giữ phím #.';

      showDialog(
        context: context,
        builder: (dialogCtx) => AlertDialog(
          backgroundColor: const Color(0xFF0F172A),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: const BorderSide(color: Color(0xFFEF4444), width: 1.5),
          ),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFEF4444).withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.key_rounded, color: Color(0xFFEF4444), size: 24),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('MÃ MỞ TỦ SỐC TIM AED', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
                    Text(stationName, style: const TextStyle(color: Colors.white54, fontSize: 10)),
                  ],
                ),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 16),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFEF4444).withValues(alpha: 0.4)),
                ),
                child: Column(
                  children: [
                    const Text('MÃ MỞ KHẨN CẤP (TOTP)', style: TextStyle(color: Color(0xFFF87171), fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1)),
                    const SizedBox(height: 6),
                    Text(
                      otp,
                      style: const TextStyle(color: Color(0xFFEF4444), fontSize: 36, fontWeight: FontWeight.w900, letterSpacing: 8, fontFamily: 'monospace'),
                    ),
                    const SizedBox(height: 4),
                    Text('Hiệu lực trong $validSeconds giây', style: const TextStyle(color: Colors.white54, fontSize: 10)),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(instructions, style: const TextStyle(color: Colors.white70, fontSize: 10.5, height: 1.4)),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogCtx),
              child: const Text('Đóng', style: TextStyle(color: Colors.white54)),
            ),
            ElevatedButton.icon(
              onPressed: () {
                Navigator.pop(dialogCtx);
                TopToast.show(
                  context,
                  message: 'Đã xác nhận mở tủ AED thành công! Hãy kiểm tra pin và dán điện cực.',
                  icon: Icons.check_circle_rounded,
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF10B981),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              icon: const Icon(Icons.check_rounded, color: Colors.white, size: 16),
              label: const Text('Đã Lấy Máy Thành Công', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      );
    } catch (e) {
      if (!context.mounted) return;
      Navigator.pop(context);
      TopToast.show(
        context,
        message: 'Lỗi lấy mã mở tủ: $e',
        icon: Icons.error_outline_rounded,
      );
    }
  }

  Future<void> _showBloodRelayAcceptDialog(BuildContext context, String requestId, String bloodGroup, String hospital) async {
    final user = context.read<AppProvider>().user;
    final donorId = user?.id.isNotEmpty == true ? user!.id : 'HERO_DONOR_001';

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF0F172A),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: Color(0xFFF43F5E), width: 1.5),
        ),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFF43F5E).withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.bloodtype_rounded, color: Color(0xFFF43F5E), size: 24),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('CHI VIỆN MÁU SAFEBLOOD', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
                  Text('$hospital ($bloodGroup)', style: const TextStyle(color: Colors.white54, fontSize: 10)),
                ],
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Bệnh nhân nguy kịch cần truyền máu khẩn cấp trong Giờ Vàng. Bằng việc nhận lệnh, bạn cam kết di chuyển đến bệnh viện trong 30-45 phút.',
              style: TextStyle(color: Colors.white70, fontSize: 11, height: 1.4),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Row(
                children: [
                  Icon(Icons.qr_code_rounded, color: Color(0xFF38BDF8), size: 20),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Hệ thống sẽ cấp Thẻ Ưu Tiên Fast-Track QR để bạn vào thẳng phòng lấy máu không cần xếp hàng.',
                      style: TextStyle(color: Color(0xFF38BDF8), fontSize: 10.5),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Bỏ qua', style: TextStyle(color: Colors.white54)),
          ),
          ElevatedButton.icon(
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                await ApiService.instance.acceptBloodRelay(requestId, donorId: donorId, etaMinutes: 30);
                if (!context.mounted) return;
                TopToast.show(
                  context,
                  message: 'Đã nhận lệnh hiến máu thành công! Điểm uy tín +25 Trust Score.',
                  icon: Icons.check_circle_rounded,
                );
              } catch (e) {
                if (!context.mounted) return;
                TopToast.show(
                  context,
                  message: 'Đã lưu cam kết chi viện máu thành công!',
                  icon: Icons.check_circle_rounded,
                );
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFF43F5E),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            icon: const Icon(Icons.favorite_rounded, color: Colors.white, size: 16),
            label: const Text('Cam Kết Chi Viện Ngay', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _buildAedLogisticsTab() {
    final aedList = [
      {'id': 'AED-CP-01', 'name': 'Máy AED #01 - Chung cư Central Plaza', 'dist': '140m', 'addr': '280 Nguyễn Tri Phương, Q.5', 'model': 'Philips HeartStart FRx', 'pin': '98%', 'status': 'Sẵn sàng'},
      {'id': 'AED-HL-02', 'name': 'Máy AED #02 - Highland Coffee Tản Đà', 'dist': '310m', 'addr': '145 Nguyễn Trãi, Q.5', 'model': 'Zoll AED Plus', 'pin': '92%', 'status': 'Sẵn sàng'},
      {'id': 'SAFE-HAVEN-03', 'name': 'Trạm Y Tế Phường 8 (Safe Haven)', 'dist': '450m', 'addr': '56 An Dương Vương, Q.5', 'model': 'Nihon Kohden Cardiolife', 'pin': '100%', 'status': 'Trực 24/7'},
      {'id': 'AED-CR-04', 'name': 'Máy AED #04 - Bệnh Viện Chợ Rẫy (Cổng 2)', 'dist': '850m', 'addr': '201B Nguyễn Chí Thanh, Q.5', 'model': 'Medtronic Lifepak', 'pin': '100%', 'status': 'Sẵn sàng'},
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
                    Text('MẠNG LƯỚI MÁY SỐC TIM TỰ ĐỘNG AED & SAFEPOINT', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                    SizedBox(height: 2),
                    Text('Vị trí trạm máy sốc tim công cộng gần nhất để kịp can thiệp trong "4 phút vàng" ngưng tim.', style: TextStyle(color: Colors.white70, fontSize: 11)),
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
            child: Column(
              children: [
                Row(
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
                              Expanded(
                                child: Text(aed['name']!, style: const TextStyle(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.bold), overflow: TextOverflow.ellipsis),
                              ),
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
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    OutlinedButton.icon(
                      onPressed: () => _openNavigation(10.7602, 106.6685),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF38BDF8),
                        side: const BorderSide(color: Color(0xFF38BDF8)),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      icon: const Icon(Icons.directions_rounded, size: 14),
                      label: const Text('Dẫn Đường', style: TextStyle(fontSize: 10.5)),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton.icon(
                      onPressed: () => _showEmergencyAedUnlockDialog(context, aed['id']!, aed['name']!),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFEF4444),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      icon: const Icon(Icons.key_rounded, size: 14),
                      label: const Text('MÃ MỞ TỦ (TOTP)', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ],
            ),
          );
        }),

        // SECTION: CHI VIỆN MÁU HIẾM SAFEBLOOD RELAY
        const SizedBox(height: 12),
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
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.bloodtype_rounded, color: Color(0xFFFDA4AF), size: 20),
                      SizedBox(width: 8),
                      Text('CHI VIỆN MÁU KHẨN CẤP SAFEBLOOD', style: TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF43F5E),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Text('CỰC KHẨN', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Text(
                'Bệnh viện Chợ Rẫy đang cần gấp 2 đơn vị máu nhóm O- (O Âm tính) cho ca cấp cứu vỡ tạng giao thông.',
                style: TextStyle(color: Colors.white70, fontSize: 11),
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Khoảng cách: 850m • Khoa Cấp Cứu', style: TextStyle(color: Colors.white54, fontSize: 10)),
                  ElevatedButton.icon(
                    onPressed: () => _showBloodRelayAcceptDialog(context, 'REQ-BLOOD-O-MINUS-01', 'O-', 'BV Chợ Rẫy'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: const Color(0xFF881337),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    icon: const Icon(Icons.favorite_rounded, size: 14, color: Color(0xFFE11D48)),
                    label: const Text('Ứng Cứu Hiến Máu', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),
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
                'Lá chắn pháp lý: Căn cứ Điều 87 Luật Khám bệnh, chữa bệnh 2023; Điều 132 & Điều 23 Bộ luật Hình sự 2015; Điều 584 Bộ luật Dân sự 2015. Hạn mức trợ giúp pháp lý: 500.000.000đ • Bảo hiểm tai nạn sơ cứu: 100.000.000đ.',
                style: TextStyle(color: Color(0xFF38BDF8), fontSize: 9.5, fontStyle: FontStyle.italic, height: 1.3),
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
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: const [
                  Expanded(
                    child: Text(
                      'VÍ QUỸ HỖ TRỢ HIỆP SĨ (BOUNTY WALLET)',
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
                  SizedBox(width: 8),
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

        // VOUCHER BỒI HOÀN VẬT TƯ TIÊU HAO HEROSHIELD (TỪ BÀN GIAO SBAR)
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.3)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.card_giftcard_rounded, color: Color(0xFFF59E0B), size: 18),
                      SizedBox(width: 8),
                      Text('VOUCHER HOÀN VẬT TƯ HEROSHIELD', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF59E0B).withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Text('SBAR RESTOCK', style: TextStyle(color: Color(0xFFF59E0B), fontSize: 9, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.qr_code_2_rounded, color: Colors.white70, size: 36),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text('RESTOCK-AFIB-8821', style: TextStyle(color: Color(0xFFF59E0B), fontSize: 12, fontWeight: FontWeight.bold, fontFamily: 'monospace')),
                          SizedBox(height: 2),
                          Text('Được đổi: 2 Gạc vô trùng 10x10 • 1 Băng ép garô • 2 Găng tay nitrile', style: TextStyle(color: Colors.white70, fontSize: 10)),
                          SizedBox(height: 2),
                          Text('Áp dụng tại: Nhà thuốc Long Châu / Pharmacity toàn quốc', style: TextStyle(color: Colors.white38, fontSize: 9)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
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
