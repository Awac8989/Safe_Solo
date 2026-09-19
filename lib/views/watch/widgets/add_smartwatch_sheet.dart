import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/app_strings.dart';
import '../../../core/providers/app_provider.dart';
import '../../../services/ble_watch_service.dart';
import '../../../services/watch_sync_manager.dart';

/// Modal Bottom Sheet cho chức năng: Thêm & Ghép nối Đồng hồ thông minh thật (BLE / Wear OS)
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
  final BleWatchService _ble = BleWatchService.instance;
  bool _showPinInput = false;
  bool _isProcessing = false;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();

    _ble.addListener(_onBleChanged);
    // Tự động quét sóng Bluetooth tìm đồng hồ thật khi mở modal
    if (!WatchSyncManager.kIsTesting) {
      _startBleScanning();
    }
  }

  void _onBleChanged() {
    if (mounted) setState(() {});
  }

  Future<void> _startBleScanning() async {
    await _ble.startScan(timeout: const Duration(seconds: 15));
  }

  @override
  void dispose() {
    _ble.removeListener(_onBleChanged);
    _pulseController.dispose();
    _pinController.dispose();
    super.dispose();
  }

  Future<void> _handleConnectBle(DiscoveredBleWatch watch) async {
    setState(() => _isProcessing = true);
    final success = await _ble.connectToWatch(watch.device);
    if (!mounted) return;
    setState(() => _isProcessing = false);

    if (success) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: const Color(0xFF10B981),
          content: Text('✓ Đã kết nối thành công với ${watch.name}! Đang nhận nhịp tim & pin thật qua Bluetooth.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: const Color(0xFFEF4444),
          content: Text(_ble.statusMessage ?? 'Không thể kết nối Bluetooth với đồng hồ.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
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
          content: Text('✓ Đã kết nối với Galaxy Watch! Dữ liệu đang đồng bộ thời gian thực.'),
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
          content: Text('✓ Đã xác nhận mã PIN & kết nối Galaxy Watch thành công!'),
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
    if (_ble.isConnected) {
      await _ble.disconnect();
    }
    await _sync.unpairDevice();
    if (!mounted) return;
    setState(() => _isProcessing = false);
    Navigator.pop(context);

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        backgroundColor: Color(0xFF64748B),
        content: Text('Đã ngắt kết nối đồng hồ. Dữ liệu đã ngưng đồng bộ.'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    final isPaired = _sync.isPaired;
    final discovered = _ble.discoveredWatches;

    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 28,
      ),
      child: SingleChildScrollView(
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
                      child: const Icon(Icons.bluetooth_searching_rounded, color: Color(0xFF38BDF8), size: 22),
                    ),
                    const SizedBox(width: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          strings.text('Kết Nối Đồng Hồ Thật', 'Connect Real Smartwatch'),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 17,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          isPaired
                              ? 'Đã kết nối · ${_sync.connectionStatusLabel}'
                              : 'Quét sóng Bluetooth LE & Relay thời gian thực',
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

            const SizedBox(height: 16),

            if (!isPaired) ...[
              // Thanh trạng thái quét sóng Radar
              Container(
                padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
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
                        width: 30,
                        height: 30,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: const Color(0xFF38BDF8), width: 2),
                        ),
                        child: const Center(
                          child: Icon(Icons.bluetooth_audio_rounded, color: Color(0xFF38BDF8), size: 16),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _ble.isScanning ? 'Đang dò tìm đồng hồ thật xung quanh...' : 'Đã quét xong Bluetooth',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Galaxy Watch, Apple Watch, Garmin, Mi Band (BLE)',
                            style: TextStyle(color: Colors.white.withValues(alpha: 0.55), fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                    TextButton(
                      style: TextButton.styleFrom(
                        foregroundColor: const Color(0xFF38BDF8),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      onPressed: _ble.isScanning ? _ble.stopScan : _startBleScanning,
                      child: Text(_ble.isScanning ? 'Dừng' : 'Quét lại', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 14),

              // Danh sách đồng hồ thật phát hiện qua Bluetooth
              if (discovered.isNotEmpty) ...[
                const Padding(
                  padding: EdgeInsets.only(left: 4, bottom: 8),
                  child: Text(
                    'ĐỒNG HỒ BLUETOOTH THẬT PHÁT HIỆN ĐƯỢC:',
                    style: TextStyle(color: Color(0xFF38BDF8), fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.8),
                  ),
                ),
                ...discovered.map((watch) {
                  return Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF0F2642), Color(0xFF112E51)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFF0284C7)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                            color: const Color(0xFF38BDF8).withValues(alpha: 0.2),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.watch_rounded, color: Color(0xFF38BDF8), size: 24),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                watch.name,
                                style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${watch.device.remoteId.str} · ${watch.rssi} dBm',
                                style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0284C7),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            minimumSize: const Size(80, 36),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          onPressed: _isProcessing ? null : () => _handleConnectBle(watch),
                          child: const Text('KẾT NỐI', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                  );
                }),
                const SizedBox(height: 10),
              ] else ...[
                // Khi chưa quét thấy thiết bị BLE, hiển thị thẻ Galaxy Watch trực tiếp
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
                  ),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 46,
                            height: 46,
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
                                const Text(
                                  'Samsung Galaxy Watch (Wear OS)',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  'Wear OS 4.0/5.0 · Cảm biến BioActive & Gia tốc',
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
                      const SizedBox(height: 14),
                      SizedBox(
                        width: double.infinity,
                        height: 44,
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0284C7),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            elevation: 0,
                          ),
                          onPressed: _isProcessing ? null : _handleQuickPair,
                          icon: _isProcessing
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              : const Icon(Icons.bolt_rounded, size: 20),
                          label: Text(
                            _isProcessing ? 'ĐANG KẾT NỐI...' : 'GHÉP NỐI NHANH WEAR OS (1-CHẠM)',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 14),

              // Tùy chọn nhập mã PIN 6 số từ mặt đồng hồ Galaxy Watch
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
              // ĐÃ KẾT NỐI ĐỒNG HỒ THẬT
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.4)),
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 36),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _sync.deviceModel,
                                style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Kênh: ${_sync.connectionStatusLabel} · Độ trễ ${_sync.latencyMs}ms',
                                style: const TextStyle(color: Color(0xFF34D399), fontSize: 12),
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
                    if (_ble.latestHeartRate != null || _ble.latestBattery != null) ...[
                      const Divider(color: Colors.white24, height: 20),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          if (_ble.latestHeartRate != null)
                            Row(
                              children: [
                                const Icon(Icons.favorite_rounded, color: Color(0xFFF43F5E), size: 18),
                                const SizedBox(width: 6),
                                Text('${_ble.latestHeartRate} BPM', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                              ],
                            ),
                          if (_ble.latestBattery != null)
                            Row(
                              children: [
                                const Icon(Icons.battery_charging_full_rounded, color: Color(0xFF10B981), size: 18),
                                const SizedBox(width: 6),
                                Text('${_ble.latestBattery}% Pin', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                              ],
                            ),
                        ],
                      ),
                    ],
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

            // Nút mở màn hình đồng hồ WearOS
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
      ),
    );
  }
}
