// ============================================================================
// [TEN_NGHIEP_VU]: TRANG_TRANG_CUU_HO_SAFEPOINT_AED_MOBILE
// [DUONG_DAN]: lib/views/emergency/safepoints_map_page.dart
// [CHUC_NANG]: Tim tram SafePoint gan nhat, Nhan ma TOTP 300s mo tu soc tim AHA
// ============================================================================

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/providers/app_provider.dart';
import '../../core/widgets/top_toast.dart';
import '../../services/api_service.dart';

class SafePointsMapPage extends StatefulWidget {
  const SafePointsMapPage({super.key});

  @override
  State<SafePointsMapPage> createState() => _SafePointsMapPageState();
}

class _SafePointsMapPageState extends State<SafePointsMapPage> {
  bool _isLoading = true;
  List<Map<String, dynamic>> _stations = [];
  String _selectedType = 'ALL'; // ALL, AED, FIRST_AID, OXYGEN

  // Unlock state
  Map<String, dynamic>? _activeUnlockStation;
  int _remainingSeconds = 300;
  Timer? _countdownTimer;

  @override
  void initState() {
    super.initState();
    _loadStations();
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadStations() async {
    setState(() => _isLoading = true);
    try {
      final list = await ApiService.instance.fetchNearbySafePoints(
        type: _selectedType == 'ALL' ? null : _selectedType,
      );
      if (mounted) {
        setState(() {
          _stations = list;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        TopToast.show(
          context,
          message: 'Không thể tải trạm SafePoint: $e',
          icon: Icons.error_outline_rounded,
        );
      }
    }
  }

  Future<void> _handleUnlockRequest(Map<String, dynamic> station) async {
    final stationId = station['_id']?.toString() ?? station['id']?.toString() ?? '';
    final stationName = station['name']?.toString() ?? 'Trạm SafePoint Cứu Hộ';
    final app = context.read<AppProvider>();
    final rescuerId = app.user?.id ?? 'FIRST_RESPONDER_MOBILE';

    try {
      final res = await ApiService.instance.requestSafePointUnlock(
        stationId,
        rescuerId: rescuerId,
        purpose: 'Cấp cứu ngừng tuần hoàn ngoại viện (AHA CPR/AED)',
      );

      final otp = res['unlockOtp']?.toString() ?? '889922';
      final validSec = (res['validSeconds'] as num?)?.toInt() ?? 300;

      _countdownTimer?.cancel();
      setState(() {
        _activeUnlockStation = station;
        _remainingSeconds = validSec;
      });

      _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
        if (_remainingSeconds > 0) {
          setState(() => _remainingSeconds--);
        } else {
          timer.cancel();
          if (mounted) {
            setState(() {
              _activeUnlockStation = null;
            });
            TopToast.show(
              context,
              message: 'Mã TOTP mở tủ đã hết hạn.',
              icon: Icons.timer_off_rounded,
            );
          }
        }
      });

      if (!mounted) return;
      _showUnlockModal(stationName, otp);
    } catch (e) {
      if (!mounted) return;
      TopToast.show(
        context,
        message: 'Lỗi sinh mã mở tủ: $e',
        icon: Icons.error_outline_rounded,
      );
    }
  }

  void _showUnlockModal(String stationName, String otp) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFF475569),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981).withValues(alpha: 0.2),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.key_rounded, color: Color(0xFF10B981), size: 24),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'MÃ MỞ TỦ CỨU SINH TOTP (300S)',
                          style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w900),
                        ),
                        Text(
                          stationName,
                          style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFF10B981), width: 1.5),
                  boxShadow: const [
                    BoxShadow(color: Color(0x2010B981), blurRadius: 16, offset: Offset(0, 4)),
                  ],
                ),
                child: Column(
                  children: [
                    const Text(
                      'BẤM MÃ SỐ TRÊN BÀN PHÍM TỦ CỨU HỘ:',
                      style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      otp,
                      style: const TextStyle(
                        color: Color(0xFF34D399),
                        fontFamily: 'monospace',
                        fontSize: 36,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 8,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.timer_outlined, color: Color(0xFFF59E0B), size: 14),
                        const SizedBox(width: 6),
                        Text(
                          'Hiệu lực còn lại: ${_remainingSeconds ~/ 60}:${(_remainingSeconds % 60).toString().padLeft(2, "0")}',
                          style: const TextStyle(
                            color: Color(0xFFF59E0B),
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF334155)),
                ),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'HƯỚNG DẪN MỞ TỦ & SỐC TIM AHA 2020:',
                      style: TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.w800, fontSize: 11),
                    ),
                    SizedBox(height: 4),
                    Text(
                      '1. Nhập mã OTP 6 số trên bàn phím tủ SafePoint và xoay chốt mở.\n'
                      '2. Lấy máy AED, cởi áo nạn nhân và dán 2 bản cực theo hình minh họa.\n'
                      '3. Đứng lùi lại khi máy phát lệnh: "Đang phân tích nhịp tim - Không chạm vào người bệnh".\n'
                      '4. Nếu máy yêu cầu, nhấn nút Shock (Màu cam) và tiếp tục ép tim CPR 30:2.',
                      style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 11, height: 1.4),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  OutlinedButton.icon(
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: otp));
                      TopToast.show(context, message: 'Đã sao chép mã OTP mở tủ!');
                    },
                    icon: const Icon(Icons.copy_rounded, size: 14),
                    label: const Text('Sao chép'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF94A3B8),
                      side: const BorderSide(color: Color(0xFF475569)),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () async {
                        final stationId = _activeUnlockStation?['_id']?.toString() ?? _activeUnlockStation?['id']?.toString() ?? '';
                        final app = context.read<AppProvider>();
                        try {
                          await ApiService.instance.confirmSafePointUnlock(
                            stationId,
                            unlockOtp: otp,
                            rescuerId: app.user?.id ?? 'FIRST_RESPONDER',
                          );
                          if (!ctx.mounted) return;
                          Navigator.pop(ctx);
                          if (!mounted) return;
                          TopToast.show(
                            context,
                            message: 'Đã xác nhận mở tủ thành công! Trạm chuyển sang trạng thái đang cứu hộ.',
                            icon: Icons.check_circle_rounded,
                          );
                          _loadStations();
                        } catch (e) {
                          if (!mounted) return;
                          TopToast.show(context, message: 'Lỗi xác nhận: $e');
                        }
                      },
                      icon: const Icon(Icons.check_circle_outline_rounded, size: 16),
                      label: const Text('Đã Mở Tủ Thành Công', style: TextStyle(fontWeight: FontWeight.w800)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF10B981),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
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
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        title: const Row(
          children: [
            Icon(Icons.shield_rounded, color: Color(0xFF10B981), size: 22),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                'Trạm SafePoint & Máy Sốc Tim AED',
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16),
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            onPressed: _loadStations,
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF94A3B8)),
          ),
        ],
      ),
      body: Column(
        children: [
          // Banner OpenAED
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF064E3B), Color(0xFF1E293B)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              border: Border(bottom: BorderSide(color: const Color(0xFF10B981).withValues(alpha: 0.3))),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: const BoxDecoration(
                    color: Color(0xFF10B981),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.favorite_rounded, color: Colors.white, size: 18),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'MẠNG LƯỚI KHỬ RUNG TIM CỘNG ĐỒNG (OPENAED)',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13),
                      ),
                      Text(
                        'Mở tủ khẩn cấp không cần chìa vật lý · Còi báo 110dB chống trộm',
                        style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Filter Chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                _buildFilterChip('ALL', 'Tất cả'),
                const SizedBox(width: 8),
                _buildFilterChip('AED', 'Máy sốc tim AED'),
                const SizedBox(width: 8),
                _buildFilterChip('FIRST_AID', 'Tủ sơ cứu'),
                const SizedBox(width: 8),
                _buildFilterChip('OXYGEN', 'Bình oxy STAT'),
              ],
            ),
          ),

          // Danh sách trạm
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: Color(0xFF10B981)),
                  )
                : () {
                    final displayStations = _selectedType == 'ALL'
                        ? _stations
                        : _stations.where((s) => s['type'] == _selectedType).toList();
                    if (displayStations.isEmpty) {
                      return Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.location_off_rounded, size: 54, color: const Color(0xFF94A3B8).withValues(alpha: 0.5)),
                            const SizedBox(height: 12),
                            const Text(
                              'Không tìm thấy trạm SafePoint trong danh mục này',
                              style: TextStyle(color: Color(0xFF94A3B8), fontSize: 14, fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      );
                    }
                    return ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: displayStations.length,
                      itemBuilder: (ctx, idx) => _buildStationCard(displayStations[idx]),
                    );
                  }(),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String type, String label) {
    final isSelected = _selectedType == type;
    return InkWell(
      onTap: () => setState(() => _selectedType = type),
      borderRadius: BorderRadius.circular(20),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF10B981) : const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? const Color(0xFF10B981) : const Color(0xFF334155),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : const Color(0xFF94A3B8),
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ),
    );
  }

  Widget _buildStationCard(Map<String, dynamic> st) {
    final name = st['name']?.toString() ?? 'Trạm SafePoint Cứu Hộ';
    final code = st['code']?.toString() ?? 'SP-001';
    final type = st['type']?.toString() ?? 'AED';
    final isOperational = (st['status']?.toString() ?? 'ACTIVE') == 'ACTIVE';
    final location = st['location'] as Map<String, dynamic>? ?? {};
    final address = location['address']?.toString() ?? 'TP. Hồ Chí Minh';
    final building = location['buildingName']?.toString();
    final hardware = st['hardwareState'] as Map<String, dynamic>? ?? {};
    final battery = (hardware['batteryLevelPercent'] as num?)?.toInt() ??
        (st['batteryPercent'] as num?)?.toInt() ?? 98;
    final isAed = type == 'AED';

    final distNum = (st['distanceMeters'] as num?)?.toDouble();
    String? distanceLabel;
    if (distNum != null) {
      distanceLabel = distNum >= 1000
          ? '${(distNum / 1000).toStringAsFixed(1)} km'
          : '${distNum.toInt()} m';
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isAed ? const Color(0xFF10B981).withValues(alpha: 0.4) : const Color(0xFF334155),
          width: 1.2,
        ),
        boxShadow: const [
          BoxShadow(color: Color(0x10000000), blurRadius: 10, offset: Offset(0, 3)),
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
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: isAed ? const Color(0xFF10B981) : const Color(0xFF3B82F6),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        isAed ? 'MÁY SỐC TIM AED' : type,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 10),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      code,
                      style: const TextStyle(color: Color(0xFF94A3B8), fontFamily: 'monospace', fontSize: 11, fontWeight: FontWeight.w700),
                    ),
                    if (distanceLabel != null) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0F172A),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          distanceLabel,
                          style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 10, fontWeight: FontWeight.w800),
                        ),
                      ),
                    ],
                  ],
                ),
                Row(
                  children: [
                    Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: isOperational ? const Color(0x2210B981) : const Color(0x22EF4444),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(
                          color: isOperational ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                          width: 0.8,
                        ),
                      ),
                      child: Text(
                        isOperational ? 'SẴN SÀNG' : 'BẢO TRÌ',
                        style: TextStyle(
                          color: isOperational ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const Icon(Icons.battery_charging_full_rounded, color: Color(0xFF10B981), size: 14),
                    const SizedBox(width: 4),
                    Text(
                      '$battery%',
                      style: const TextStyle(color: Color(0xFF10B981), fontSize: 11, fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              name,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15),
            ),
            if (building != null && building.isNotEmpty) ...[
              const SizedBox(height: 2),
              Text(
                building,
                style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 12, fontWeight: FontWeight.w600),
              ),
            ],
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.location_on_outlined, color: Color(0xFF94A3B8), size: 14),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    address,
                    style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => _handleUnlockRequest(st),
                icon: const Icon(Icons.lock_open_rounded, size: 16),
                label: const Text('MỞ TỦ CẤP CỨU (LẤY MÃ TOTP 300S)', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF10B981),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
