// ============================================================================
// [TEN_NGHIEP_VU]: DIEU_PHOI_MAU_HIEM_SAFEBLOOD_MOBILE
// [DUONG_DAN]: lib/views/medical/blood_relay_page.dart
// [CHUC_NANG]: Tiep nhan ca keu goi mau hiem STAT ISBT-128, Cap the Fast-Track QR
// ============================================================================

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/providers/app_provider.dart';
import '../../core/widgets/top_toast.dart';
import '../../services/api_service.dart';

class BloodRelayPage extends StatefulWidget {
  const BloodRelayPage({super.key});

  @override
  State<BloodRelayPage> createState() => _BloodRelayPageState();
}

class _BloodRelayPageState extends State<BloodRelayPage> {
  bool _isLoading = true;
  List<Map<String, dynamic>> _requests = [];
  String _selectedFilter = 'ALL'; // ALL, O_MINUS, B_MINUS, A_MINUS, AB_MINUS

  // Modal fast-track pass
  Map<String, dynamic>? _activeFastTrackPass;

  @override
  void initState() {
    super.initState();
    _loadRequests();
  }

  Future<void> _loadRequests() async {
    setState(() => _isLoading = true);
    try {
      final list = await ApiService.instance.fetchActiveBloodRelays();
      if (mounted) {
        setState(() {
          _requests = list;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        TopToast.show(
          context,
          message: 'Không thể tải danh sách ca tiếp ứng máu: $e',
          icon: Icons.error_outline_rounded,
        );
      }
    }
  }

  List<Map<String, dynamic>> get _filteredRequests {
    if (_selectedFilter == 'ALL') return _requests;
    return _requests.where((r) {
      final bg = (r['targetBloodGroup'] ?? '').toString();
      return bg.toUpperCase().replaceAll('-', '_MINUS') == _selectedFilter;
    }).toList();
  }

  Future<void> _handleAccept(Map<String, dynamic> request) async {
    final reqId = request['_id']?.toString() ?? request['id']?.toString() ?? '';
    final hospital = request['hospitalLocation'] as Map<String, dynamic>? ?? {};
    final hospitalName = hospital['hospitalName']?.toString() ?? 'Bệnh viện Cấp cứu';
    final targetBlood = request['targetBloodGroup']?.toString() ?? 'O-';

    int selectedEta = 15;

    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEF4444).withValues(alpha: 0.2),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.bloodtype_rounded, color: Color(0xFFEF4444), size: 24),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'XÁC NHẬN TIẾP ỨNG HIẾN MÁU STAT',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          '$hospitalName · Nhóm máu: $targetBlood',
                          style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              const Text(
                'Thời gian dự kiến bạn có mặt tại bệnh viện (ETA):',
                style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 13, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                children: [10, 15, 20, 30, 45].map((eta) {
                  final isSelected = selectedEta == eta;
                  return ChoiceChip(
                    label: Text('$eta phút'),
                    selected: isSelected,
                    onSelected: (val) {
                      if (val) setSheetState(() => selectedEta = eta);
                    },
                    selectedColor: const Color(0xFFEF4444),
                    labelStyle: TextStyle(
                      color: isSelected ? Colors.white : const Color(0xFF94A3B8),
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                    backgroundColor: const Color(0xFF0F172A),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF334155)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.verified_user_rounded, color: Color(0xFF10B981), size: 18),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Bạn sẽ được cấp Thẻ Fast-Track QR ưu tiên trực tiếp tại cổng cấp cứu mà không cần xếp hàng.',
                        style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(ctx, false),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF94A3B8),
                        side: const BorderSide(color: Color(0xFF475569)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Hủy'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      onPressed: () => Navigator.pop(ctx, true),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFEF4444),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        elevation: 3,
                      ),
                      child: const Text(
                        'Xác Nhận Xuất Phát',
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    if (confirmed != true) return;
    if (!mounted) return;

    final app = context.read<AppProvider>();
    final donorId = app.user?.id ?? 'DONOR_USER_DEFAULT';

    try {
      final res = await ApiService.instance.acceptBloodRelay(
        reqId,
        donorId: donorId,
        etaMinutes: selectedEta,
      );

      final fastTrackCode = res['fastTrackCode']?.toString() ?? 'FAST-BLOOD-${DateTime.now().millisecondsSinceEpoch % 10000}';

      if (!mounted) return;
      setState(() {
        _activeFastTrackPass = {
          'requestCode': res['requestCode'] ?? request['requestCode'] ?? reqId,
          'hospitalName': hospitalName,
          'targetBloodGroup': targetBlood,
          'fastTrackCode': fastTrackCode,
          'etaMinutes': selectedEta,
          'address': hospital['address']?.toString() ?? 'Khoa Cấp cứu Bệnh viện',
          'phone': hospital['contactPhone']?.toString() ?? '115',
        };
      });

      _showFastTrackModal();
      _loadRequests();
    } catch (e) {
      if (!mounted) return;
      TopToast.show(
        context,
        message: 'Lỗi xác nhận tiếp ứng: $e',
        icon: Icons.error_outline_rounded,
      );
    }
  }

  void _showFastTrackModal() {
    if (_activeFastTrackPass == null) return;
    final pass = _activeFastTrackPass!;

    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogCtx) => Dialog(
        backgroundColor: const Color(0xFF0F172A),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: const BoxDecoration(
                  color: Color(0xFFEF4444),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.emergency_rounded, color: Colors.white, size: 28),
              ),
              const SizedBox(height: 12),
              const Text(
                'THẺ FAST-TRACK CẤP CỨU MÁU',
                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w900),
              ),
              const Text(
                'Xuất trình tại Cổng Cấp cứu để được dẫn đường ưu tiên',
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: QrImageView(
                  data: 'SAFEBLOOD_FASTTRACK:${pass["fastTrackCode"]}|HOSPITAL:${pass["hospitalName"]}|BLOOD:${pass["targetBloodGroup"]}',
                  size: 180,
                  version: QrVersions.auto,
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFF334155)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.qr_code_rounded, color: Color(0xFFEF4444), size: 16),
                    const SizedBox(width: 8),
                    Text(
                      pass['fastTrackCode'].toString(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.w800,
                        fontSize: 14,
                        letterSpacing: 1.2,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              Text(
                'Bệnh viện: ${pass["hospitalName"]}',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                textAlign: TextAlign.center,
              ),
              Text(
                'Nhóm máu cần: ${pass["targetBloodGroup"]} · ETA: ${pass["etaMinutes"]} phút',
                style: const TextStyle(color: Color(0xFFEF4444), fontWeight: FontWeight.w700, fontSize: 12),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(dialogCtx),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF334155),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Đóng Thẻ'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _callHospital(String phone) async {
    final clean = phone.replaceAll(RegExp(r'[^0-9+]'), '');
    if (clean.isEmpty) return;
    final uri = Uri(scheme: 'tel', path: clean);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  Future<void> _showCreateRequestModal() async {
    String selectedBlood = 'O-';
    int units = 2;
    final hospitalNameController = TextEditingController(text: 'Bệnh viện Chợ Rẫy - Trung tâm Cấp cứu 115');
    final addressController = TextEditingController(text: '201B Nguyễn Chí Thanh, Phường 12, Quận 5, TP.HCM');
    final phoneController = TextEditingController(text: '02838554137');
    final reasonController = TextEditingController(text: 'Sốc mất máu cấp do vỡ tạng sau tai nạn đâm va.');
    bool isSubmitting = false;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (bottomCtx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEF4444).withValues(alpha: 0.2),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.emergency_share_rounded, color: Color(0xFFEF4444), size: 24),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'PHÁT LỆNH ĐIỀU PHỐI MÁU STAT',
                            style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w900),
                          ),
                          Text(
                            'Kêu gọi cộng đồng Hiệp sĩ tiếp sức máu khẩn cấp',
                            style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                const Text('Nhóm máu cần tiếp ứng:', style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 13, fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: ['O-', 'O+', 'A-', 'B-', 'AB-'].map((bg) {
                    final isSel = selectedBlood == bg;
                    return ChoiceChip(
                      label: Text(bg),
                      selected: isSel,
                      onSelected: (val) {
                        if (val) setModalState(() => selectedBlood = bg);
                      },
                      selectedColor: const Color(0xFFEF4444),
                      backgroundColor: const Color(0xFF0F172A),
                      labelStyle: TextStyle(
                        color: isSel ? Colors.white : const Color(0xFF94A3B8),
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    const Expanded(
                      child: Text('Số đơn vị máu cần:', style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 13, fontWeight: FontWeight.w700)),
                    ),
                    Row(
                      children: [
                        IconButton(
                          onPressed: units > 1 ? () => setModalState(() => units--) : null,
                          icon: const Icon(Icons.remove_circle_outline, color: Color(0xFF94A3B8)),
                        ),
                        Text('$units túi (350ml)', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 14)),
                        IconButton(
                          onPressed: units < 6 ? () => setModalState(() => units++) : null,
                          icon: const Icon(Icons.add_circle_outline, color: Color(0xFFEF4444)),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: hospitalNameController,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    labelText: 'Tên bệnh viện / Đơn vị tiếp nhận',
                    labelStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                    filled: true,
                    fillColor: const Color(0xFF0F172A),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: addressController,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    labelText: 'Địa chỉ tiếp nhận',
                    labelStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                    filled: true,
                    fillColor: const Color(0xFF0F172A),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: reasonController,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  maxLines: 2,
                  decoration: InputDecoration(
                    labelText: 'Chẩn đoán lâm sàng / Lý do cấp cứu',
                    labelStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                    filled: true,
                    fillColor: const Color(0xFF0F172A),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: isSubmitting
                        ? null
                        : () async {
                            setModalState(() => isSubmitting = true);
                            try {
                              final app = context.read<AppProvider>();
                              await ApiService.instance.createBloodRelayRequest(
                                targetBloodGroup: selectedBlood,
                                unitsRequired: units,
                                hospitalName: hospitalNameController.text.trim(),
                                address: addressController.text.trim(),
                                contactPhone: phoneController.text.trim(),
                                clinicalJustification: reasonController.text.trim(),
                                requestedByDoctorId: app.user?.id,
                              );
                              if (!ctx.mounted) return;
                              Navigator.pop(ctx);
                              if (!mounted) return;
                              TopToast.show(
                                context,
                                message: 'Đã phát lệnh kêu gọi tiếp ứng máu thành công!',
                                icon: Icons.check_circle_rounded,
                              );
                              _loadRequests();
                            } catch (e) {
                              setModalState(() => isSubmitting = false);
                              if (!mounted) return;
                              TopToast.show(context, message: 'Lỗi phát lệnh: $e');
                            }
                          },
                    icon: isSubmitting
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Icon(Icons.send_rounded, size: 16),
                    label: Text(
                      isSubmitting ? 'Đang gửi...' : 'Phát Lệnh Kêu Gọi Máu Ngay',
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFEF4444),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B132B),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1C2541),
        elevation: 0,
        title: const Row(
          children: [
            Icon(Icons.bloodtype_rounded, color: Color(0xFFEF4444), size: 22),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                'SafeBlood Urgent Relay',
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 17),
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            onPressed: _loadRequests,
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF94A3B8)),
          ),
        ],
      ),
      body: Column(
        children: [
          // Banner Giờ Vàng
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF881337), Color(0xFF1E293B)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              border: Border(bottom: BorderSide(color: const Color(0xFFEF4444).withValues(alpha: 0.3))),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: const BoxDecoration(
                    color: Color(0xFFEF4444),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.flash_on_rounded, color: Colors.white, size: 18),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'ĐIỀU PHỐI MÁU HIẾM STAT (ISBT-128)',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13),
                      ),
                      Text(
                        'Kết nối trực tiếp kíp trực Bệnh viện 115 & Hiệp sĩ tình nguyện',
                        style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Bộ lọc nhóm máu
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: const Color(0xFF131D38),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildFilterChip('Tất cả', 'ALL'),
                  const SizedBox(width: 6),
                  _buildFilterChip('O- (Máu hiếm toàn năng)', 'O_MINUS'),
                  const SizedBox(width: 6),
                  _buildFilterChip('B-', 'B_MINUS'),
                  const SizedBox(width: 6),
                  _buildFilterChip('A-', 'A_MINUS'),
                  const SizedBox(width: 6),
                  _buildFilterChip('AB-', 'AB_MINUS'),
                ],
              ),
            ),
          ),

          // Danh sách yêu cầu
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: Color(0xFFEF4444)),
                  )
                : _filteredRequests.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.check_circle_outline_rounded, size: 54, color: const Color(0xFF10B981).withValues(alpha: 0.6)),
                            const SizedBox(height: 12),
                            const Text(
                              'Hiện không có ca kêu gọi máu khẩn cấp',
                              style: TextStyle(color: Color(0xFF94A3B8), fontSize: 14, fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: 4),
                            const Text(
                              'Hệ thống đang ở trạng thái trực chiến bình thường',
                              style: TextStyle(color: Color(0xFF64748B), fontSize: 12),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _filteredRequests.length,
                        itemBuilder: (ctx, idx) => _buildRequestCard(_filteredRequests[idx]),
                      ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showCreateRequestModal,
        backgroundColor: const Color(0xFFEF4444),
        icon: const Icon(Icons.add_circle_outline_rounded, color: Colors.white),
        label: const Text(
          'Kêu Gọi Máu STAT',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13),
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label, String value) {
    final isSelected = _selectedFilter == value;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (val) {
        if (val) setState(() => _selectedFilter = value);
      },
      selectedColor: const Color(0xFFEF4444),
      backgroundColor: const Color(0xFF1E293B),
      labelStyle: TextStyle(
        color: isSelected ? Colors.white : const Color(0xFF94A3B8),
        fontWeight: isSelected ? FontWeight.w800 : FontWeight.w500,
        fontSize: 11,
      ),
    );
  }

  Widget _buildRequestCard(Map<String, dynamic> r) {
    final hospital = r['hospitalLocation'] as Map<String, dynamic>? ?? {};
    final hospitalName = hospital['hospitalName']?.toString() ?? 'Bệnh viện Cấp cứu';
    final targetBlood = r['targetBloodGroup']?.toString() ?? 'O-';
    final units = r['unitsRequired'] ?? 2;
    final address = hospital['address']?.toString() ?? 'TP. Hồ Chí Minh';
    final phone = hospital['contactPhone']?.toString() ?? '115';
    final justification = r['clinicalJustification']?.toString() ?? 'Cần máu gấp trong phẫu thuật cấp cứu';

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF1C2541),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFEF4444).withValues(alpha: 0.4), width: 1.2),
        boxShadow: const [
          BoxShadow(
            color: Color(0x18EF4444),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEF4444),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        targetBlood,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 14,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFF334155),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        'CẦN $units ĐƠN VỊ',
                        style: const TextStyle(
                          color: Color(0xFFCBD5E1),
                          fontWeight: FontWeight.w700,
                          fontSize: 10,
                        ),
                      ),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFDC2626).withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: const Color(0xFFDC2626)),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.warning_amber_rounded, color: Color(0xFFEF4444), size: 12),
                      SizedBox(width: 4),
                      Text(
                        'STAT KHẨN CẤP',
                        style: TextStyle(color: Color(0xFFEF4444), fontWeight: FontWeight.w800, fontSize: 10),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              hospitalName,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w800,
                fontSize: 15,
              ),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.location_on_outlined, color: Color(0xFF94A3B8), size: 14),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    address,
                    style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFF334155)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.medical_information_outlined, color: Color(0xFF38BDF8), size: 16),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      justification,
                      style: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 11, height: 1.3),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                OutlinedButton.icon(
                  onPressed: () => _callHospital(phone),
                  icon: const Icon(Icons.phone_in_talk_rounded, size: 14),
                  label: const Text('Gọi 115', style: TextStyle(fontSize: 12)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF38BDF8),
                    side: const BorderSide(color: Color(0xFF38BDF8)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => _handleAccept(r),
                    icon: const Icon(Icons.volunteer_activism_rounded, size: 16),
                    label: const Text('Nhận Ca Tiếp Ứng', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFEF4444),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
