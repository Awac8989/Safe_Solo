import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/app_strings.dart';
import '../../../core/providers/app_provider.dart';
import '../../../services/watch_sync_manager.dart';

/// Modal Bottom Sheet cho chức năng: Thêm & Ghép nối Đồng hồ thông minh
class AddSmartwatchSheet extends StatefulWidget {
  const AddSmartwatchSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (_) => const AddSmartwatchSheet(),
    );
  }

  @override
  State<AddSmartwatchSheet> createState() => _AddSmartwatchSheetState();
}

class _AddSmartwatchSheetState extends State<AddSmartwatchSheet>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;
  final TextEditingController _pinController = TextEditingController();
  final WatchSyncManager _sync = WatchSyncManager.instance;
  bool _showPinInput = false;
  bool _isProcessing = false;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _pinController.dispose();
    super.dispose();
  }

  Future<void> _handleQuickPair() async {
    setState(() => _isProcessing = true);
    final user = context.read<AppProvider>().user;
    final success = await _sync.quickPairDevice(userId: user?.id ?? 'user_default');
    if (!mounted) return;
    setState(() => _isProcessing = false);

    if (success) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Color(0xFF10B981),
          content: Text('✓ Đã ghép nối thành công với Samsung Galaxy Watch 5! Dữ liệu đang đồng bộ thời gian thực.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Color(0xFFEF4444),
          content: Text('Không thể kết nối với đồng hồ. Vui lòng kiểm tra lại thiết bị.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _handlePinPair() async {
    final code = _pinController.text.trim();
    if (code.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Colors.amber,
          content: Text('Vui lòng nhập mã ghép nối 6 chữ số từ mặt đồng hồ.'),
        ),
      );
      return;
    }

    setState(() => _isProcessing = true);
    final user = context.read<AppProvider>().user;
    final success = await _sync.verifyPairingCode(code, userId: user?.id ?? 'user_default');
    if (!mounted) return;
    setState(() => _isProcessing = false);

    if (success) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Color(0xFF10B981),
          content: Text('✓ Đã xác nhận mã PIN & kết nối Samsung Galaxy Watch 5 thành công!'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Color(0xFFEF4444),
          content: Text('Mã ghép nối không chính xác hoặc đã hết hạn.'),
        ),
      );
    }
  }

  Future<void> _handleUnpair() async {
    setState(() => _isProcessing = true);
    await _sync.unpairDevice();
    if (!mounted) return;
    setState(() => _isProcessing = false);
    Navigator.pop(context);

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        backgroundColor: Color(0xFF64748B),
        content: Text('Đã ngắt kết nối đồng hồ. Thông tin đồng hồ đã được ẩn trên App.'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    final isPaired = _sync.isPaired;

    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 28,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Thanh kéo
          Center(
            child: Container(
              width: 44,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 18),

          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: const Color(0xFF38BDF8).withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.watch_rounded, color: Color(0xFF38BDF8), size: 22),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        strings.text('Thêm Thiết Bị Đeo', 'Add Smartwatch'),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        isPaired
                            ? 'Đã kết nối với Galaxy Watch 5'
                            : 'Tìm kiếm & Ghép nối qua Bluetooth / Relay',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.6),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded, color: Colors.white60),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),

          const SizedBox(height: 20),

          if (!isPaired) ...[
            // Hiệu ứng dò tìm Radar
            Container(
              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF334155)),
              ),
              child: Row(
                children: [
                  RotationTransition(
                    turns: _pulseController,
                    child: Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: const Color(0xFF38BDF8), width: 2),
                      ),
                      child: const Center(
                        child: Icon(Icons.radar_rounded, color: Color(0xFF38BDF8), size: 16),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Đang dò tìm Smartwatch xung quanh...',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Hỗ trợ Wear OS 4.0 / Samsung Galaxy Watch 5',
                          style: TextStyle(color: Colors.white54, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: Color(0xFF10B981),
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Thẻ thiết bị phát hiện được
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF0F2642), Color(0xFF112E51)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: const Color(0xFF38BDF8), width: 1.5),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF0284C7).withValues(alpha: 0.2),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: const Color(0xFF38BDF8).withValues(alpha: 0.2),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.watch_rounded, color: Color(0xFF38BDF8), size: 28),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Row(
                              children: [
                                Text(
                                  'Samsung Galaxy Watch 5',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 3),
                            Text(
                              'SM-R900 · Wear OS 4.0 · -54 dBm',
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.65),
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFF10B981).withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFF10B981)),
                        ),
                        child: const Text(
                          'SẴN SÀNG',
                          style: TextStyle(
                            color: Color(0xFF34D399),
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  // Nút ghép nối nhanh 1-Chạm
                  SizedBox(
                    width: double.infinity,
                    height: 46,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0284C7),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        elevation: 0,
                      ),
                      onPressed: _isProcessing ? null : _handleQuickPair,
                      icon: _isProcessing
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.bolt_rounded, size: 20),
                      label: Text(
                        _isProcessing ? 'ĐANG KẾT NỐI...' : 'GHÉP NỐI NHANH (1-CHẠM)',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 14),

            // Tùy chọn nhập PIN
            GestureDetector(
              onTap: () => setState(() => _showPinInput = !_showPinInput),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 14),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.pin_rounded, color: Color(0xFF94A3B8), size: 18),
                        const SizedBox(width: 8),
                        Text(
                          _showPinInput ? 'Ẩn nhập mã PIN 6 số' : 'Hoặc ghép nối bằng mã PIN 6 số từ mặt đồng hồ',
                          style: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 12),
                        ),
                      ],
                    ),
                    Icon(
                      _showPinInput ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                      color: Colors.white54,
                    ),
                  ],
                ),
              ),
            ),

            if (_showPinInput) ...[
              const SizedBox(height: 12),
              TextField(
                controller: _pinController,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Color(0xFF38BDF8),
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 4,
                  fontFamily: 'monospace',
                ),
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  hintText: 'Nhập mã (VD: ${_sync.pairingCode})',
                  hintStyle: const TextStyle(color: Colors.white24, fontSize: 14, letterSpacing: 1),
                  filled: true,
                  fillColor: const Color(0xFF1E293B),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Color(0xFF0284C7)),
                  ),
                  contentPadding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF38BDF8),
                    side: const BorderSide(color: Color(0xFF0284C7)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: _isProcessing ? null : _handlePinPair,
                  child: const Text('XÁC NHẬN MÃ PIN', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ] else ...[
            // Đã kết nối: Hiển thị trạng thái & tùy chọn Ngắt kết nối
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.4)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 36),
                  const SizedBox(width: 14),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Samsung Galaxy Watch 5',
                          style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Đang kết nối · Luồng đồng bộ thời gian thực hai chiều',
                          style: TextStyle(color: Color(0xFF34D399), fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Mở Trung tâm thiết bị',
                    icon: const Icon(Icons.open_in_new_rounded, color: Colors.white70),
                    onPressed: () {
                      Navigator.pop(context);
                      Navigator.pushNamed(context, '/smartwatch');
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              height: 44,
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFFF87171),
                  side: const BorderSide(color: Color(0xFFEF4444)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: _isProcessing ? null : _handleUnpair,
                icon: const Icon(Icons.link_off_rounded, size: 18),
                label: const Text('NGẮT KẾT NỐI ĐỒNG HỒ', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          ],

          const SizedBox(height: 14),

          // Nút mở màn hình đồng hồ WearOS (Tiện test)
          TextButton.icon(
            style: TextButton.styleFrom(foregroundColor: Colors.white60),
            onPressed: () {
              Navigator.pop(context);
              Navigator.pushNamed(context, '/wear-os');
            },
            icon: const Icon(Icons.watch_rounded, size: 16),
            label: const Text('Xem giao diện đồng hồ WearOS', style: TextStyle(fontSize: 12)),
          ),
        ],
      ),
    );
  }
}
