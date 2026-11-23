import 'package:flutter/material.dart';

import '../../services/vneid_nfc_service.dart';

/// ============================================================================
/// SAFESOLO — MÀN HÌNH QUÉT CCCD NFC (Phân hệ 135 — VNeID NFC AutoFill)
/// Giao diện hướng dẫn và thực hiện quét chip CCCD gắn chip
///
/// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03 - TDMU
/// ============================================================================

class VneidNfcScanPage extends StatefulWidget {
  /// Callback khi scan thành công — trả về CccdNfcResult
  final void Function(CccdNfcResult result)? onSuccess;

  const VneidNfcScanPage({super.key, this.onSuccess});

  @override
  State<VneidNfcScanPage> createState() => _VneidNfcScanPageState();
}

class _VneidNfcScanPageState extends State<VneidNfcScanPage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseCtrl;
  late final Animation<double> _pulseAnim;
  final _service = VneidNfcService.instance;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    _pulseAnim = Tween(begin: 0.85, end: 1.0).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );
    _service.addListener(_onServiceChanged);
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    _service.removeListener(_onServiceChanged);
    super.dispose();
  }

  void _onServiceChanged() {
    if (!mounted) return;
    setState(() {});

    // Khi thành công, gọi callback
    if (_service.state == NfcScanState.success && _service.lastResult != null) {
      widget.onSuccess?.call(_service.lastResult!);
      Future.delayed(const Duration(seconds: 1), () {
        if (mounted) Navigator.of(context).pop(_service.lastResult);
      });
    }
  }

  Future<void> _startScan() async {
    await _service.scanAndAutoFill();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E21),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          'Quét CCCD Gắn Chip',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: ListenableBuilder(
        listenable: _service,
        builder: (context, _) => _service.state == NfcScanState.success
            ? _buildSuccess()
            : _buildScanUI(),
      ),
    );
  }

  Widget _buildScanUI() {
    final isActive = _service.state != NfcScanState.idle &&
        _service.state != NfcScanState.error;

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const SizedBox(height: 20),

          // Tiêu đề
          Text(
            'Điền Hồ Sơ Y Tế Tự Động',
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          const Text(
            'Chạm mặt sau CCCD vào điện thoại\n(vùng gần camera) để đọc chip NFC',
            style: TextStyle(fontSize: 14, color: Colors.white70),
            textAlign: TextAlign.center,
          ),

          const SizedBox(height: 48),

          // Animation NFC pulse
          AnimatedBuilder(
            animation: _pulseAnim,
            builder: (context, child) => Transform.scale(
              scale: isActive ? _pulseAnim.value : 1.0,
              child: child,
            ),
            child: Container(
              width: 180,
              height: 180,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isActive
                    ? const Color(0xFF1565C0).withOpacity(0.3)
                    : Colors.grey.withOpacity(0.1),
                border: Border.all(
                  color: isActive ? const Color(0xFF42A5F5) : Colors.grey,
                  width: 3,
                ),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.nfc_rounded,
                    size: 72,
                    color: isActive ? const Color(0xFF42A5F5) : Colors.grey,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'NFC',
                    style: TextStyle(
                      color: isActive ? const Color(0xFF42A5F5) : Colors.grey,
                      fontWeight: FontWeight.bold,
                      fontSize: 18,
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 32),

          // Status message
          if (_service.statusMessage.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFF1E2A45),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (isActive)
                    const SizedBox(
                      width: 16, height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2, color: Color(0xFF42A5F5),
                      ),
                    ),
                  if (isActive) const SizedBox(width: 10),
                  Text(
                    _service.statusMessage,
                    style: const TextStyle(color: Colors.white, fontSize: 14),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
          ],

          // Hướng dẫn vị trí NFC theo thiết bị
          _buildDeviceGuide(),

          const Spacer(),

          // Nút scan
          if (!isActive)
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _startScan,
                icon: const Icon(Icons.nfc_rounded),
                label: const Text('Bắt đầu quét CCCD'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1565C0),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),

          if (_service.state == NfcScanState.error) ...[
            const SizedBox(height: 12),
            TextButton(
              onPressed: _startScan,
              child: const Text('Thử lại', style: TextStyle(color: Color(0xFF42A5F5))),
            ),
          ],

          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _buildDeviceGuide() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E2A45),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '📱 Vị trí NFC theo thiết bị:',
            style: TextStyle(color: Colors.white70, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          _guideRow('Honor Magic 7 Pro', 'Mặt lưng, góc trên-trái (gần camera)'),
          _guideRow('Samsung Galaxy A53/A71', 'Mặt lưng, giữa phía trên'),
          _guideRow('Galaxy Watch 5', 'Không hỗ trợ NFC đọc CCCD'),
        ],
      ),
    );
  }

  Widget _guideRow(String device, String position) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          const Icon(Icons.phone_android, size: 14, color: Colors.grey),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              '$device: $position',
              style: const TextStyle(color: Colors.white60, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSuccess() {
    final result = _service.lastResult!;
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const SizedBox(height: 40),
          const Icon(Icons.check_circle_rounded, color: Color(0xFF4CAF50), size: 80),
          const SizedBox(height: 20),
          const Text(
            '✅ Đọc CCCD Thành Công!',
            style: TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Hồ sơ y tế sẽ được điền tự động',
            style: TextStyle(color: Colors.white70),
          ),
          const SizedBox(height: 32),
          _buildResultCard(result),
          const Spacer(),
          const Text(
            'Đang chuyển về hồ sơ y tế...',
            style: TextStyle(color: Colors.grey),
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _buildResultCard(CccdNfcResult result) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1B5E20).withOpacity(0.3),
        border: Border.all(color: const Color(0xFF4CAF50), width: 1.5),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          _resultRow('Họ và tên', result.displayFullName),
          _resultRow('Số CCCD', result.documentNumber),
          _resultRow('Ngày sinh', result.displayDateOfBirth),
          _resultRow('Giới tính', result.gender == 'M' ? 'Nam' : 'Nữ'),
          _resultRow('Địa chỉ', result.permanentAddress),
        ],
      ),
    );
  }

  Widget _resultRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 90,
            child: Text(label, style: const TextStyle(color: Colors.white54, fontSize: 13)),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
