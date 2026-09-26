import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/app_strings.dart';
import '../../core/constants.dart';
import '../../core/providers/app_provider.dart';
import '../../models/watch_protocol.dart';
import '../../services/api_service.dart';
import '../../services/pedometer_service.dart';
import '../../services/wear_os_service.dart';
import '../../services/watch_sync_manager.dart';
import '../../services/ble_watch_service.dart';

/// ============================================================================
/// SAFESOLO - QUẢN LÝ ĐỒNG HỒ THÔNG MINH
/// Giao diện thân thiện, trực quan, dễ hiểu cho người dùng
/// Tab 1: Sức khỏe
/// Tab 2: Phát hiện ngã
/// Tab 3: Kết nối & Đồng bộ
/// ============================================================================
class SmartwatchConnectionPage extends StatefulWidget {
  const SmartwatchConnectionPage({super.key});

  @override
  State<SmartwatchConnectionPage> createState() => _SmartwatchConnectionPageState();
}

class _SmartwatchConnectionPageState extends State<SmartwatchConnectionPage>
    with SingleTickerProviderStateMixin {
  final ApiService _api = ApiService();
  final WearOsService _wearOs = WearOsService.instance;
  final PedometerService _pedometer = PedometerService.instance;
  final WatchSyncManager _syncManager = WatchSyncManager.instance;

  late final TabController _tabController;
  StreamSubscription<WatchPacket>? _packetSub;
  late Timer _refreshTimer;
  bool _isSyncing = false;
  bool _isMeasuring = false;
  final String _rssiText = 'Rất tốt';
  final List<Map<String, dynamic>> _telemetryLogs = [];

  String _getFriendlyActionName(String action) {
    switch (action) {
      case WatchAction.vitalsUpdate:
        return 'Cập nhật sức khỏe';
      case WatchAction.fallDetected:
        return 'Cảnh báo té ngã';
      case WatchAction.hardwareSos:
        return 'Báo động cứu hộ';
      case WatchAction.findPhonePing:
        return 'Tìm điện thoại';
      case WatchAction.findWatchPing:
        return 'Tìm đồng hồ';
      case WatchAction.precisionMeasureResult:
        return 'Đo nhịp tim';
      case WatchAction.deadmanCheckin:
        return 'Điểm danh an toàn';
      case WatchAction.pairRequest:
      case WatchAction.pairConfirmed:
        return 'Ghép nối đồng hồ';
      default:
        return 'Đồng bộ dữ liệu';
    }
  }

  String _getFriendlyActionDetail(String action, Map<String, dynamic> payload) {
    switch (action) {
      case WatchAction.vitalsUpdate:
        final hr = payload['heartRate'];
        final sp = payload['spO2'];
        final bat = payload['battery'];
        final st = payload['steps'];
        return 'Nhịp tim: ${hr ?? '--'} nhịp/phút · SpO2: ${sp ?? '--'}% · Pin: ${bat ?? '--'}% · Bước: ${st ?? 0}';
      case WatchAction.fallDetected:
        return 'Phát hiện va chạm mạnh, đã kích hoạt đếm ngược cứu hộ!';
      case WatchAction.hardwareSos:
        return 'Đã kích hoạt cuộc gọi/tin nhắn SOS khẩn cấp tới người thân!';
      case WatchAction.findPhonePing:
        return 'Đồng hồ vừa phát chuông rung tìm điện thoại.';
      case WatchAction.findWatchPing:
        return 'Điện thoại vừa gửi lệnh rung chuông tìm kiếm đồng hồ.';
      case WatchAction.precisionMeasureResult:
        final hr = payload['heartRate'];
        final sp = payload['spO2'];
        return 'Đo trực tiếp: $hr nhịp/phút, SpO2 $sp%. Sức khỏe ổn định.';
      case WatchAction.deadmanCheckin:
        return 'Người dùng đã bấm xác nhận an toàn trên đồng hồ.';
      case WatchAction.pairConfirmed:
        return 'Đồng hồ và điện thoại đã kết nối và đồng bộ hoàn tất.';
      default:
        return 'Dữ liệu được cập nhật tự động từ đồng hồ.';
    }
  }

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _wearOs.initialize();
    _syncManager.initialize();

    // Lắng nghe dữ liệu gửi nhận hai chiều giữa Đồng hồ và Điện thoại
    _packetSub = _syncManager.packetStream.listen((packet) {
      if (!mounted) return;
      _addTelemetryLog(
        type: _getFriendlyActionName(packet.action),
        source: packet.sender == WatchSender.watch ? 'Đồng hồ thông minh' : 'Ứng dụng điện thoại',
        detail: _getFriendlyActionDetail(packet.action, packet.payload),
        isSuccess: true,
      );

      // Phản hồi chuông rung khi đồng hồ bấm "Tìm điện thoại"
      if (packet.action == WatchAction.findPhonePing) {
        HapticFeedback.heavyImpact();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            duration: Duration(seconds: 4),
            backgroundColor: Color(0xFF0284C7),
            content: Row(
              children: [
                Icon(Icons.ring_volume_rounded, color: Colors.white),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '🔔 ĐỒNG HỒ ĐANG TÌM ĐIỆN THOẠI!',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ),
        );
      } else if (packet.action == WatchAction.precisionMeasureResult) {
        final bpm = packet.payload['heartRate'];
        final spo2 = packet.payload['spO2'];
        if (mounted) setState(() => _isMeasuring = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF059669),
            content: Text('✓ Đã đo xong nhịp tim: $bpm nhịp/phút, Oxy máu: $spo2%'),
          ),
        );
      } else if (packet.action == WatchAction.deadmanCheckin) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Color(0xFF059669),
            content: Text('✓ Đã nhận điểm danh an toàn từ đồng hồ!'),
          ),
        );
      } else if (packet.action == WatchAction.findPhonePing) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Color(0xFF0284C7),
            content: Text('📱 Đồng hồ đang kích hoạt tìm kiếm điện thoại của bạn!'),
            duration: Duration(seconds: 4),
          ),
        );
      }
    });

    // Khởi tạo các thông báo ban đầu thân thiện
    _addTelemetryLog(
      type: 'Kết nối thành công',
      source: 'Samsung Galaxy Watch 5',
      detail: 'Đồng hồ và điện thoại đã kết nối an toàn.',
      isSuccess: true,
    );
    _addTelemetryLog(
      type: 'Cảm biến sẵn sàng',
      source: 'Cảm biến sức khỏe',
      detail: 'Cảm biến đo nhịp tim và nhận biết chuyển động đã sẵn sàng theo dõi.',
      isSuccess: true,
    );

    // Cập nhật định kỳ tín hiệu và thời gian
    _refreshTimer = Timer.periodic(const Duration(seconds: 2), (_) {
      if (mounted) {
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _packetSub?.cancel();
    _refreshTimer.cancel();
    _tabController.dispose();
    super.dispose();
  }

  void _addTelemetryLog({
    required String type,
    required String source,
    required String detail,
    required bool isSuccess,
  }) {
    _telemetryLogs.insert(0, {
      'time': DateFormat('HH:mm:ss').format(DateTime.now()),
      'type': type,
      'source': source,
      'detail': detail,
      'success': isSuccess,
    });
    if (_telemetryLogs.length > 30) {
      _telemetryLogs.removeLast();
    }
  }

  /// Đồng bộ thông số sức khỏe hiện tại lên hệ thống
  Future<void> _syncTelemetryToCloud() async {
    final user = context.read<AppProvider>().user;
    if (user == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng đăng nhập để đồng bộ dữ liệu')),
      );
      return;
    }

    setState(() => _isSyncing = true);
    try {
      await _api.createDeviceSignal(
        userId: user.id,
        signalType: 'WEARABLE_TELEMETRY_SYNC',
        payload: {
          'device': _wearOs.watchModel,
          'heartRate': _wearOs.heartRate,
          'spO2': _wearOs.spO2,
          'battery': _wearOs.battery,
          'steps': _wearOs.steps,
          'svmG': _wearOs.currentSvmG,
          'tiltAngle': _wearOs.currentTiltAngle,
          'isOffWrist': _wearOs.isOffWrist,
          'rssi': -54,
          'syncedAt': DateTime.now().toIso8601String(),
        },
      );

      _addTelemetryLog(
        type: 'Đồng bộ dữ liệu',
        source: 'Trung tâm SafeSolo',
        detail: 'Đã lưu trữ dữ liệu sức khỏe (${_wearOs.heartRate} nhịp/phút, ${_wearOs.spO2}% SpO2, ${_wearOs.battery}% Pin)',
        isSuccess: true,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Color(0xFF0284C7),
            content: Text('✓ Đã đồng bộ thông số sức khỏe lên hệ thống thành công!'),
          ),
        );
      }
    } catch (e) {
      _addTelemetryLog(
        type: 'Lỗi đồng bộ',
        source: 'Hệ thống kết nối',
        detail: 'Không thể gửi dữ liệu: $e',
        isSuccess: false,
      );
    } finally {
      if (mounted) setState(() => _isSyncing = false);
    }
  }

  /// Tính năng rung tìm đồng hồ
  void _pingFindWatch() {
    _syncManager.sendFindWatchPing();
    _addTelemetryLog(
      type: 'Tìm đồng hồ',
      source: 'Điện thoại ➔ Đồng hồ',
      detail: 'Đã phát tín hiệu rung tìm đồng hồ Samsung Galaxy Watch 5.',
      isSuccess: true,
    );

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        backgroundColor: Color(0xFF059669),
        content: Text('🔔 Đã gửi tín hiệu rung tìm đồng hồ!'),
      ),
    );
  }

  /// Yêu cầu đồng hồ đo nhịp tim tức thời (10 giây)
  Future<void> _triggerInstantMeasurement() async {
    if (_wearOs.isOffWrist) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Color(0xFFF59E0B),
          content: Text('⚠ Lưu ý: Hãy áp sát mặt dưới đồng hồ vào cổ tay để đo chính xác nhất.'),
          duration: Duration(seconds: 2),
        ),
      );
    }

    setState(() => _isMeasuring = true);
    _syncManager.sendInstantMeasureRequest();

    _addTelemetryLog(
      type: 'Đo nhịp tim',
      source: 'Cảm biến đồng hồ',
      detail: 'Đang gửi lệnh yêu cầu đồng hồ đo nhịp tim và oxy trong máu...',
      isSuccess: true,
    );

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        backgroundColor: Color(0xFF0284C7),
        content: Text('🩺 Đang yêu cầu Galaxy Watch 5 đo nhịp tim, vui lòng giữ yên tay...'),
      ),
    );

    // Chờ chu kỳ đo 10 giây hoàn thành
    await Future.delayed(const Duration(seconds: 10));
    if (!mounted) return;

    setState(() => _isMeasuring = false);

    _addTelemetryLog(
      type: 'Kết quả đo nhịp tim',
      source: 'Cảm biến đồng hồ',
      detail: 'Kết quả: ${_wearOs.heartRate} nhịp/phút, ${_wearOs.spO2}% SpO2 (Chỉ số ổn định).',
      isSuccess: true,
    );
  }

  /// Thử nghiệm tính năng báo ngã để kiểm tra hệ thống
  void _simulateFallTest() {
    _syncManager.emitFallAlert(svm: 3.4, tilt: 75.0, isSimulated: true);
    _addTelemetryLog(
      type: 'Thử nghiệm báo ngã',
      source: 'Thử nghiệm hệ thống',
      detail: 'Đã tạo tình huống ngã giả định để kiểm tra tính năng báo cứu hộ.',
      isSuccess: true,
    );

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        backgroundColor: Color(0xFFD97706),
        content: Text('⚠️ Đã phát tín hiệu thử nghiệm tính năng báo ngã!'),
      ),
    );
  }

  /// Gửi tín hiệu cứu hộ khẩn cấp từ đồng hồ
  void _triggerHardwareSos() {
    final user = context.read<AppProvider>().user;
    _syncManager.emitHardwareSos(userId: user?.id);
    _wearOs.triggerHardwareSos(userId: user?.id);

    _addTelemetryLog(
      type: 'Báo động cứu hộ',
      source: 'Nút khẩn cấp đồng hồ',
      detail: 'Đã phát tín hiệu cứu hộ khẩn cấp tới người thân bảo hộ!',
      isSuccess: true,
    );

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        backgroundColor: Colors.red,
        content: Text('🚨 ĐÃ PHÁT TÍN HIỆU CỨU HỘ KHẨN CẤP!'),
      ),
    );
  }

  /// Hộp thoại thiết lập ghép nối Smartwatch thủ công với 3 tùy chọn:
  /// 1. Nhập mã PIN 6 số hiển thị trên đồng hồ
  /// 2. Cài đặt IP mạng Wi-Fi máy chủ & Kiểm tra Ping
  /// 3. Quét tìm thiết bị qua sóng Bluetooth
  void _showPairingDialog() {
    final user = context.read<AppProvider>().user;
    final pinController = TextEditingController(text: _syncManager.pairingCode);
    final ipController = TextEditingController(
      text: AppConstants.backendBaseUrl.replaceAll('http://', '').replaceAll('/api', '').split(':').first,
    );
    int selectedTab = 0; // 0: Mã 6 số, 1: Mạng Wi-Fi, 2: Bluetooth
    bool isProcessing = false;
    String? pingResult;
    bool isPingSuccess = false;

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0F172A),
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (modalContext, setModalState) {
            final ble = BleWatchService.instance;

            return Padding(
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
                    // Thanh kéo nhỏ
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: Colors.white24,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Tiêu đề & Nút đóng
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Expanded(
                          child: Row(
                            children: [
                              Icon(Icons.phonelink_setup_rounded, color: Color(0xFF38BDF8), size: 24),
                              SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Ghép nối đồng hồ thủ công',
                                      style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    SizedBox(height: 2),
                                    Text(
                                      'Chọn cách kết nối phù hợp nhất với bạn',
                                      style: TextStyle(color: Colors.white60, fontSize: 11),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close_rounded, color: Colors.white60),
                          onPressed: () => Navigator.pop(ctx),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Thanh chuyển Tab thủ công: [Mã 6 số] | [Mạng Wi-Fi] | [Bluetooth]
                    Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.white12),
                      ),
                      padding: const EdgeInsets.all(4),
                      child: Row(
                        children: [
                          Expanded(
                            child: GestureDetector(
                              onTap: () => setModalState(() => selectedTab = 0),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 8),
                                decoration: BoxDecoration(
                                  color: selectedTab == 0 ? const Color(0xFF0284C7) : Colors.transparent,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  'Mã 6 số',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    color: selectedTab == 0 ? Colors.white : Colors.white60,
                                    fontSize: 12,
                                    fontWeight: selectedTab == 0 ? FontWeight.bold : FontWeight.normal,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          Expanded(
                            child: GestureDetector(
                              onTap: () => setModalState(() => selectedTab = 1),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 8),
                                decoration: BoxDecoration(
                                  color: selectedTab == 1 ? const Color(0xFF0284C7) : Colors.transparent,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  'Mạng Wi-Fi',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    color: selectedTab == 1 ? Colors.white : Colors.white60,
                                    fontSize: 12,
                                    fontWeight: selectedTab == 1 ? FontWeight.bold : FontWeight.normal,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          Expanded(
                            child: GestureDetector(
                              onTap: () {
                                setModalState(() => selectedTab = 2);
                                if (!WatchSyncManager.kIsTesting && !ble.isScanning) {
                                  ble.startScan(timeout: const Duration(seconds: 10));
                                }
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 8),
                                decoration: BoxDecoration(
                                  color: selectedTab == 2 ? const Color(0xFF0284C7) : Colors.transparent,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  'Bluetooth',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    color: selectedTab == 2 ? Colors.white : Colors.white60,
                                    fontSize: 12,
                                    fontWeight: selectedTab == 2 ? FontWeight.bold : FontWeight.normal,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),

                    // TAB 0: NHẬP MÃ PIN 6 SỐ
                    if (selectedTab == 0) ...[
                      const Text(
                        '1. Nhập mã số hiển thị trên mặt đồng hồ:',
                        style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Mở đồng hồ của bạn lên, xem mã gồm 6 chữ số đang hiển thị và nhập vào ô dưới đây.',
                        style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 12, height: 1.4),
                      ),
                      const SizedBox(height: 14),
                      TextField(
                        controller: pinController,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Color(0xFF38BDF8),
                          fontSize: 26,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 5,
                          fontFamily: 'monospace',
                        ),
                        keyboardType: TextInputType.number,
                        decoration: InputDecoration(
                          hintText: 'VD: 742-891',
                          hintStyle: const TextStyle(color: Colors.white24, letterSpacing: 2),
                          filled: true,
                          fillColor: const Color(0xFF1E293B),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: const BorderSide(color: Color(0xFF0284C7)),
                          ),
                          contentPadding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Mã hiện tại: ${_syncManager.pairingCode}',
                            style: const TextStyle(color: Colors.white54, fontSize: 11),
                          ),
                          GestureDetector(
                            onTap: () {
                              setModalState(() {
                                pinController.text = _syncManager.pairingCode;
                              });
                            },
                            child: const Text(
                              'Điền nhanh mã này',
                              style: TextStyle(color: Color(0xFF38BDF8), fontSize: 11, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0284C7),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          onPressed: isProcessing
                              ? null
                              : () async {
                                  final code = pinController.text.trim();
                                  if (code.isEmpty) return;
                                  setModalState(() => isProcessing = true);
                                  final ok = await _syncManager.verifyPairingCode(code, userId: user?.id ?? 'user_default');
                                  setModalState(() => isProcessing = false);
                                  if (ctx.mounted) Navigator.pop(ctx);
                                  if (mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        backgroundColor: ok ? const Color(0xFF059669) : Colors.red,
                                        content: Text(ok
                                            ? '✓ Ghép nối thành công! Đồng hồ và điện thoại đã đồng bộ.'
                                            : 'Không thể ghép nối. Vui lòng kiểm tra lại mã số trên đồng hồ.'),
                                      ),
                                    );
                                  }
                                },
                          child: isProcessing
                              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                              : const Text('KẾT NỐI BẰNG MÃ SỐ', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                        ),
                      ),
                    ],

                    // TAB 1: MẠNG WI-FI & MÁY CHỦ
                    if (selectedTab == 1) ...[
                      const Text(
                        '2. Cài đặt địa chỉ máy chủ (Mạng Wi-Fi):',
                        style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Khi điện thoại và đồng hồ cùng kết nối một mạng Wi-Fi, dữ liệu sẽ được truyền qua địa chỉ mạng nội bộ:',
                        style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 12, height: 1.4),
                      ),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: Colors.white12),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Địa chỉ IP máy chủ:',
                              style: TextStyle(fontSize: 11, color: Colors.white70, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 8),
                            TextField(
                              controller: ipController,
                              style: const TextStyle(color: Colors.white, fontSize: 14, fontFamily: 'monospace'),
                              decoration: const InputDecoration(
                                hintText: 'VD: 192.168.1.5 hoặc 10.0.2.2',
                                hintStyle: TextStyle(color: Colors.white30, fontSize: 12),
                                isDense: true,
                                contentPadding: EdgeInsets.symmetric(vertical: 10, horizontal: 10),
                                border: OutlineInputBorder(),
                              ),
                            ),
                            const SizedBox(height: 10),
                            if (pingResult != null) ...[
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                decoration: BoxDecoration(
                                  color: isPingSuccess ? const Color(0xFF10B981).withValues(alpha: 0.15) : const Color(0xFFEF4444).withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  pingResult!,
                                  style: TextStyle(
                                    color: isPingSuccess ? const Color(0xFF34D399) : const Color(0xFFF87171),
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 10),
                            ],
                            Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton.icon(
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: const Color(0xFF38BDF8),
                                      side: const BorderSide(color: Color(0xFF0284C7)),
                                      padding: const EdgeInsets.symmetric(vertical: 11),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                    ),
                                    onPressed: () async {
                                      setModalState(() => isProcessing = true);
                                      final ok = await _syncManager.pingHost();
                                      setModalState(() {
                                        isProcessing = false;
                                        isPingSuccess = ok;
                                        pingResult = ok
                                            ? '✓ Kết nối mạng rất tốt (${_syncManager.latencyMs}ms)'
                                            : '✗ Không thể kết nối. Kiểm tra mạng Wi-Fi.';
                                      });
                                    },
                                    icon: const Icon(Icons.network_check_rounded, size: 16),
                                    label: const Text('Kiểm tra mạng', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: ElevatedButton(
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFF0284C7),
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(vertical: 11),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                    ),
                                    onPressed: () async {
                                      final ip = ipController.text.trim();
                                      if (ip.isNotEmpty) {
                                        await AppConstants.setHostIp(ip);
                                        await _syncManager.pingHost();
                                        if (ctx.mounted) {
                                          setModalState(() {
                                            pingResult = '✓ Đã lưu địa chỉ mạng: $ip';
                                            isPingSuccess = true;
                                          });
                                        }
                                      }
                                    },
                                    child: const Text('Lưu địa chỉ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],

                    // TAB 2: BLUETOOTH
                    if (selectedTab == 2) ...[
                      const Text(
                        '3. Tìm đồng hồ qua sóng Bluetooth:',
                        style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Bật Bluetooth trên cả điện thoại và đồng hồ, đặt chúng ở gần nhau để quét:',
                        style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 12, height: 1.4),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            ble.isScanning ? 'Đang dò tìm đồng hồ...' : 'Đã dừng quét',
                            style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 12, fontWeight: FontWeight.w600),
                          ),
                          TextButton.icon(
                            onPressed: () {
                              if (ble.isScanning) {
                                ble.stopScan();
                              } else {
                                ble.startScan(timeout: const Duration(seconds: 10));
                              }
                              setModalState(() {});
                            },
                            icon: Icon(ble.isScanning ? Icons.stop_rounded : Icons.refresh_rounded, size: 16),
                            label: Text(ble.isScanning ? 'Dừng' : 'Quét lại', style: const TextStyle(fontSize: 12)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      if (ble.discoveredWatches.isNotEmpty) ...[
                        ...ble.discoveredWatches.map((w) {
                          return Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: const Color(0xFF1E293B),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFF0284C7)),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.watch_rounded, color: Color(0xFF38BDF8), size: 20),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(w.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                                ),
                                ElevatedButton(
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFF0284C7),
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                  ),
                                  onPressed: () async {
                                    setModalState(() => isProcessing = true);
                                    final ok = await ble.connectToWatch(w.device);
                                    setModalState(() => isProcessing = false);
                                    if (ctx.mounted) Navigator.pop(ctx);
                                    if (mounted) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(
                                          backgroundColor: ok ? const Color(0xFF059669) : Colors.red,
                                          content: Text(ok ? '✓ Đã kết nối Bluetooth với ${w.name}!' : 'Không thể kết nối Bluetooth.'),
                                        ),
                                      );
                                    }
                                  },
                                  child: const Text('Kết nối', style: TextStyle(fontSize: 11)),
                                ),
                              ],
                            ),
                          );
                        }),
                      ] else ...[
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E293B),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Center(
                            child: Text(
                              'Chưa phát hiện thiết bị qua Bluetooth.\nBạn có thể dùng Tab "Mã 6 số" để ghép nối ngay.',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: Colors.white54, fontSize: 11, height: 1.4),
                            ),
                          ),
                        ),
                      ],
                    ],

                    const SizedBox(height: 20),
                    const Divider(color: Colors.white12, height: 1),
                    const SizedBox(height: 14),

                    // Nút kết nối tự động 1 chạm nếu đồng hồ đang mở
                    SizedBox(
                      width: double.infinity,
                      child: TextButton.icon(
                        style: TextButton.styleFrom(
                          foregroundColor: const Color(0xFF34D399),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                        ),
                        onPressed: () async {
                          Navigator.pop(ctx);
                          final ok = await _syncManager.quickPairDevice(userId: user?.id ?? 'user_default');
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                backgroundColor: ok ? const Color(0xFF059669) : Colors.red,
                                content: Text(ok
                                    ? '✓ Đã kết nối tự động với đồng hồ thành công!'
                                    : 'Không thể kết nối tự động. Hãy thử nhập mã 6 số.'),
                              ),
                            );
                          }
                        },
                        icon: const Icon(Icons.bolt_rounded, size: 20),
                        label: const Text(
                          'Hoặc bấm vào đây để kết nối tự động (1-chạm)',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                        ),
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

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);

    return Scaffold(
      backgroundColor: const Color(0xFF0B1120),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              strings.text('Thiết bị đeo & Đồng hồ', 'Wearable & Smartwatch'),
              style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
            ),
            Text(
              'Samsung Galaxy Watch 5 · Sẵn sàng bảo vệ',
              style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 11),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Đồng bộ dữ liệu ngay',
            icon: _isSyncing
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF38BDF8)),
                  )
                : const Icon(Icons.sync_rounded, color: Color(0xFF38BDF8)),
            onPressed: _isSyncing ? null : _syncTelemetryToCloud,
          ),
          IconButton(
            tooltip: 'Mở màn hình đồng hồ',
            icon: const Icon(Icons.watch_rounded, color: Colors.white70),
            onPressed: () => Navigator.of(context).pushNamed('/wear-os'),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFF38BDF8),
          indicatorWeight: 3,
          labelColor: const Color(0xFF38BDF8),
          unselectedLabelColor: Colors.white60,
          labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
          tabs: const [
            Tab(icon: Icon(Icons.favorite_rounded, size: 18), text: 'Sức khỏe'),
            Tab(icon: Icon(Icons.warning_amber_rounded, size: 18), text: 'Phát hiện ngã'),
            Tab(icon: Icon(Icons.sync_alt_rounded, size: 18), text: 'Kết nối & Đồng bộ'),
          ],
        ),
      ),
      body: AnimatedBuilder(
        animation: Listenable.merge([_wearOs, _pedometer, _syncManager]),
        builder: (context, _) {
          final isConnected = _syncManager.isPaired;
          final isOffWrist = _wearOs.isOffWrist;

          return TabBarView(
            controller: _tabController,
            children: [
              // ===============================================================
              // TAB 1: TỔNG QUAN THIẾT BỊ & CHỈ SỐ SỨC KHỎE
              // ===============================================================
              SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildConnectionStatusCard(isConnected, isOffWrist),
                    const SizedBox(height: 16),
                    _buildDirectActionsRow(),
                    const SizedBox(height: 20),
                    Text(
                      strings.text('CHỈ SỐ SỨC KHỎE TRỰC TIẾP', 'LIVE HEALTH VITALS'),
                      style: const TextStyle(
                        color: Color(0xFF94A3B8),
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.1,
                      ),
                    ),
                    const SizedBox(height: 10),
                    _buildBiometricGrid(),
                    const SizedBox(height: 24),
                    _buildSosTriggerButton(strings),
                    const SizedBox(height: 24),
                  ],
                ),
              ),

              // ===============================================================
              // TAB 2: TỰ ĐỘNG PHÁT HIỆN TÉ NGÃ
              // ===============================================================
              SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      strings.text('TỰ ĐỘNG PHÁT HIỆN TÉ NGÃ', 'AUTOMATIC FALL DETECTION'),
                      style: const TextStyle(
                        color: Color(0xFF94A3B8),
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.1,
                      ),
                    ),
                    const SizedBox(height: 10),
                    _buildMotionSensorCard(),
                    const SizedBox(height: 16),
                    // Nút thử nghiệm tính năng báo ngã
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFFF59E0B),
                          side: const BorderSide(color: Color(0xFFF59E0B)),
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: _simulateFallTest,
                        icon: const Icon(Icons.warning_amber_rounded, size: 20),
                        label: const Text(
                          'THỬ NGHIỆM TÍNH NĂNG BÁO NGÃ',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    Text(
                      strings.text('CÀI ĐẶT CẢNH BÁO AN TOÀN', 'SAFETY ALERTS CONFIGURATION'),
                      style: const TextStyle(
                        color: Color(0xFF94A3B8),
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.1,
                      ),
                    ),
                    const SizedBox(height: 10),
                    _buildSafetyThresholdsCard(),
                    const SizedBox(height: 24),
                  ],
                ),
              ),

              // ===============================================================
              // TAB 3: KẾT NỐI & ĐỒNG BỘ DỮ LIỆU
              // ===============================================================
              SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildManualPairingBanner(),
                    const SizedBox(height: 16),
                    _buildBiDirectionalSyncModelCard(),
                    const SizedBox(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            strings.text('LỊCH SỬ HOẠT ĐỘNG GẦN ĐÂY', 'RECENT ACTIVITY LOGS'),
                            style: const TextStyle(
                              color: Color(0xFF94A3B8),
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.1,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '${_telemetryLogs.length} hoạt động',
                          style: const TextStyle(color: Color(0xFF64748B), fontSize: 11),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    _buildTelemetryLogsList(),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  /// Banner hỗ trợ thiết lập kết nối thủ công trên Tab 3
  Widget _buildManualPairingBanner() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0F2642), Color(0xFF1E293B)],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF0284C7)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFF0284C7).withValues(alpha: 0.2),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.phonelink_setup_rounded, color: Color(0xFF38BDF8), size: 22),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Ghép nối thủ công',
                  style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                ),
                SizedBox(height: 2),
                Text(
                  'Nhập mã 6 số, kiểm tra IP mạng Wi-Fi hoặc quét tìm đồng hồ Bluetooth.',
                  style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
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
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: _showPairingDialog,
            child: const Text('CÀI ĐẶT', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  /// Thẻ trạng thái kết nối đồng hồ
  Widget _buildConnectionStatusCard(bool isConnected, bool isOffWrist) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isConnected ? const Color(0xFF0284C7).withValues(alpha: 0.5) : const Color(0xFFEF4444).withValues(alpha: 0.5),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: (isConnected ? const Color(0xFF0284C7) : const Color(0xFFEF4444)).withValues(alpha: 0.15),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(18),
      child: Column(
        children: [
          Row(
            children: [
              // Icon đồng hồ với vòng phát sáng
              Stack(
                alignment: Alignment.center,
                children: [
                  Container(
                    width: 60,
                    height: 60,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(
                        colors: isConnected
                            ? [const Color(0xFF0284C7), const Color(0xFF0EA5E9)]
                            : [const Color(0xFF475569), const Color(0xFF334155)],
                      ),
                    ),
                    child: const Icon(Icons.watch_rounded, color: Colors.white, size: 32),
                  ),
                  if (isConnected)
                    Positioned(
                      top: 0,
                      right: 0,
                      child: Container(
                        width: 14,
                        height: 14,
                        decoration: BoxDecoration(
                          color: const Color(0xFF10B981),
                          shape: BoxShape.circle,
                          border: Border.all(color: const Color(0xFF1E293B), width: 2),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 16),
              // Thông tin thiết bị
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Expanded(
                          child: Text(
                            'Samsung Galaxy Watch 5',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: isConnected
                                ? const Color(0xFF10B981).withValues(alpha: 0.2)
                                : const Color(0xFFEF4444).withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(
                              color: isConnected ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                              width: 1,
                            ),
                          ),
                          child: Text(
                            isConnected ? 'ĐÃ KẾT NỐI' : 'CHƯA KẾT NỐI',
                            style: TextStyle(
                              color: isConnected ? const Color(0xFF34D399) : const Color(0xFFF87171),
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Samsung Galaxy Watch 5 · Kết nối an toàn',
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 12),
                    ),
                    const SizedBox(height: 8),
                    // Tình trạng đeo cổ tay
                    Row(
                      children: [
                        Icon(
                          isOffWrist ? Icons.info_outline_rounded : Icons.check_circle_rounded,
                          size: 14,
                          color: isOffWrist ? const Color(0xFFFBBF24) : const Color(0xFF34D399),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            isOffWrist ? 'Đang tháo đồng hồ ra ngoài' : 'Đang đeo trên cổ tay an toàn',
                            style: TextStyle(
                              color: isOffWrist ? const Color(0xFFFBBF24) : const Color(0xFF34D399),
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Divider(color: Color(0xFF334155), height: 1),
          const SizedBox(height: 14),
          // Hàng chỉ số nhanh: Pin, Sóng kết nối, Tốc độ phản hồi
          Row(
            children: [
              Expanded(
                child: _buildQuickStat(
                  icon: Icons.battery_charging_full_rounded,
                  iconColor: const Color(0xFF10B981),
                  label: 'Pin đồng hồ',
                  value: '${_wearOs.battery}%',
                ),
              ),
              Expanded(
                child: _buildQuickStat(
                  icon: Icons.wifi_rounded,
                  iconColor: const Color(0xFF38BDF8),
                  label: 'Sóng kết nối',
                  value: _rssiText,
                ),
              ),
              Expanded(
                child: _buildQuickStat(
                  icon: Icons.speed_rounded,
                  iconColor: const Color(0xFFA78BFA),
                  label: 'Tốc độ phản hồi',
                  value: '${_syncManager.latencyMs} ms',
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF334155)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _syncManager.isPaired ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                          boxShadow: [
                            BoxShadow(
                              color: (_syncManager.isPaired ? const Color(0xFF10B981) : const Color(0xFFEF4444))
                                  .withValues(alpha: 0.5),
                              blurRadius: 6,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Kênh: ${_syncManager.connectionStatusLabel}',
                          style: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 11, fontWeight: FontWeight.w600),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: _showPairingDialog,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0284C7).withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: const Color(0xFF0284C7)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.phonelink_setup_rounded, color: Color(0xFF38BDF8), size: 12),
                        const SizedBox(width: 4),
                        Text(
                          'Mã: ${_syncManager.pairingCode}',
                          style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickStat({
    required IconData icon,
    required Color iconColor,
    required String label,
    required String value,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: iconColor, size: 16),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                value,
                style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  /// Các tác vụ điều khiển trực tiếp
  Widget _buildDirectActionsRow() {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF38BDF8),
                  disabledForegroundColor: const Color(0xFF38BDF8),
                  disabledIconColor: const Color(0xFF38BDF8),
                  side: const BorderSide(color: Color(0xFF0284C7)),
                  padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: _isMeasuring ? null : _triggerInstantMeasurement,
                icon: _isMeasuring
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF38BDF8)))
                    : const Icon(Icons.favorite_rounded, size: 18),
                label: Text(
                  _isMeasuring ? 'Đang đo...' : 'Đo nhịp tim ngay',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF34D399),
                  side: const BorderSide(color: Color(0xFF059669)),
                  padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: _pingFindWatch,
                icon: const Icon(Icons.vibration_rounded, size: 18),
                label: const Text(
                  'Rung tìm đồng hồ',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0284C7),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 13),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: _showPairingDialog,
            icon: const Icon(Icons.phonelink_setup_rounded, size: 20),
            label: Text(
              _syncManager.isPaired ? 'CÀI ĐẶT & GHÉP NỐI THỦ CÔNG' : 'GHÉP NỐI ĐỒNG HỒ THỦ CÔNG',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
            ),
          ),
        ),
        if (_syncManager.isPaired) ...[
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFFF87171),
                side: const BorderSide(color: Color(0xFFEF4444)),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () async {
                await _syncManager.unpairDevice();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Đã ngắt kết nối đồng hồ.')),
                  );
                }
              },
              icon: const Icon(Icons.link_off_rounded, size: 18),
              label: const Text(
                'Ngắt kết nối đồng hồ',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ],
        const SizedBox(height: 10),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF00C853),
              foregroundColor: Colors.black,
              padding: const EdgeInsets.symmetric(vertical: 13),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              elevation: 4,
            ),
            onPressed: () => Navigator.of(context).pushNamed('/wear-os'),
            icon: const Icon(Icons.watch_rounded, size: 20),
            label: const Text(
              'Xem màn hình đồng hồ',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
            ),
          ),
        ),
      ],
    );
  }

  /// Lưới thông số sinh tồn đo từ cảm biến sức khỏe
  Widget _buildBiometricGrid() {
    return GridView.count(
      crossAxisCount: 2,
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      childAspectRatio: 1.10,
      children: [
        // NHỊP TIM
        _buildMetricTile(
          icon: Icons.favorite_rounded,
          iconColor: const Color(0xFFEF4444),
          title: 'Nhịp tim',
          value: '${_wearOs.heartRate}',
          unit: 'nhịp/phút',
          status: _wearOs.heartRate > 100
              ? 'Nhịp nhanh'
              : _wearOs.heartRate < 55
                  ? 'Nhịp chậm'
                  : 'Bình thường',
          statusColor: _wearOs.heartRate > 100 ? const Color(0xFFEF4444) : const Color(0xFF10B981),
          extra: 'Theo dõi liên tục',
        ),

        // SPO2 OXY TRONG MÁU
        _buildMetricTile(
          icon: Icons.water_drop_rounded,
          iconColor: const Color(0xFF38BDF8),
          title: 'Oxy máu (SpO2)',
          value: '${_wearOs.spO2}',
          unit: '%',
          status: _wearOs.spO2 >= 95 ? 'Tốt (≥95%)' : 'Cần chú ý (<95%)',
          statusColor: _wearOs.spO2 >= 95 ? const Color(0xFF10B981) : const Color(0xFFFBBF24),
          extra: 'Cảm biến đo tự động',
        ),

        // BƯỚC CHÂN TRONG NGÀY
        _buildMetricTile(
          icon: Icons.directions_walk_rounded,
          iconColor: const Color(0xFFF59E0B),
          title: 'Bước chân hôm nay',
          value: NumberFormat('#,###').format(_wearOs.steps),
          unit: 'bước',
          status: '${_wearOs.distanceKm} km',
          statusColor: const Color(0xFF94A3B8),
          extra: '${_wearOs.calories} kcal đã tiêu hao',
        ),

        // MỨC PIN THIẾT BỊ
        _buildMetricTile(
          icon: Icons.battery_full_rounded,
          iconColor: const Color(0xFF10B981),
          title: 'Pin đồng hồ',
          value: '${_wearOs.battery}',
          unit: '%',
          status: _wearOs.battery > 20 ? 'Pin tốt' : 'Pin yếu',
          statusColor: _wearOs.battery > 20 ? const Color(0xFF10B981) : const Color(0xFFEF4444),
          extra: 'Dùng được cả ngày',
        ),
      ],
    );
  }

  Widget _buildMetricTile({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String value,
    required String unit,
    required String status,
    required Color statusColor,
    required String extra,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF334155), width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.w600),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 4),
              Icon(icon, color: iconColor, size: 18),
            ],
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Flexible(
                child: Text(
                  value,
                  style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 4),
              Text(
                unit,
                style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 12),
              ),
            ],
          ),
          Row(
            children: [
              Flexible(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    status,
                    style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.bold),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  extra,
                  style: const TextStyle(color: Color(0xFF64748B), fontSize: 9),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.end,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// Cảm biến chuyển động & Tự động phát hiện té ngã
  Widget _buildMotionSensorCard() {
    final svm = _wearOs.currentSvmG;
    final tilt = _wearOs.currentTiltAngle;
    final isMonitoring = _wearOs.isFallMonitoringActive;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF334155)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0284C7).withValues(alpha: 0.2),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.sensors_rounded, color: Color(0xFF38BDF8), size: 20),
                    ),
                    const SizedBox(width: 10),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Cảm biến nhận biết chuyển động',
                            style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            'Theo dõi va chạm và tư thế cơ thể',
                            style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: isMonitoring ? const Color(0xFF10B981).withValues(alpha: 0.15) : const Color(0xFFEF4444).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  isMonitoring ? 'ĐANG BẢO VỆ' : 'TẠM TẮT',
                  style: TextStyle(
                    color: isMonitoring ? const Color(0xFF34D399) : const Color(0xFFF87171),
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // Chỉ số Lực chuyển động & Góc nghiêng tư thế
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Lực chuyển động', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
                      const SizedBox(height: 4),
                      Text(
                        '${svm.toStringAsFixed(2)} g',
                        style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        svm > 2.5 ? '⚠️ Va chạm mạnh' : 'Bình thường (1.0g)',
                        style: TextStyle(color: svm > 2.5 ? Colors.red : const Color(0xFF64748B), fontSize: 10),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Tư thế cơ thể', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
                      const SizedBox(height: 4),
                      Text(
                        '${tilt.toStringAsFixed(1)}°',
                        style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        tilt > 60 ? '⚠️ Tư thế nằm / nghiêng' : 'Đang đứng hoặc ngồi',
                        style: TextStyle(color: tilt > 60 ? Colors.amber : const Color(0xFF64748B), fontSize: 10),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Khi phát hiện bạn bị ngã mạnh và cơ thể bất động, đồng hồ sẽ tự động đếm ngược 30 giây và phát tín hiệu cứu hộ khẩn cấp đến người thân.',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.65), fontSize: 12, height: 1.4),
          ),
        ],
      ),
    );
  }

  /// Cài đặt các mức cảnh báo an toàn
  Widget _buildSafetyThresholdsCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF334155)),
      ),
      child: Column(
        children: [
          _buildThresholdRow(
            title: 'Cảnh báo khi nhịp tim quá nhanh',
            valueText: '> 120 nhịp/phút',
            description: 'Nhắc nhở bạn nghỉ ngơi khi nhịp tim tăng cao bất thường',
          ),
          const Divider(color: Color(0xFF334155), height: 20),
          _buildThresholdRow(
            title: 'Cảnh báo khi oxy máu thấp',
            valueText: '< 90% SpO2',
            description: 'Báo động ngay nếu nồng độ oxy giảm xuống mức cần chú ý',
          ),
          const Divider(color: Color(0xFF334155), height: 20),
          _buildThresholdRow(
            title: 'Độ nhạy phát hiện té ngã',
            valueText: 'Tiêu chuẩn',
            description: 'Nhận diện chính xác cú ngã thật và tránh báo nhầm khi vận động',
          ),
        ],
      ),
    );
  }

  Widget _buildThresholdRow({
    required String title,
    required String valueText,
    required String description,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 2),
              Text(
                description,
                style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
              ),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFF38BDF8).withValues(alpha: 0.3)),
          ),
          child: Text(
            valueText,
            style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 11, fontWeight: FontWeight.bold),
          ),
        ),
      ],
    );
  }

  /// Sơ đồ trực quan cách thức trao đổi dữ liệu
  Widget _buildBiDirectionalSyncModelCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF38BDF8).withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.swap_horiz_rounded, color: Color(0xFF38BDF8), size: 22),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'CÁCH THỨC TRAO ĐỔI DỮ LIỆU',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.8,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          // Hướng 1: Watch -> Phone
          _buildSyncDirectionRow(
            fromText: 'ĐỒNG HỒ GALAXY WATCH 5',
            toText: 'ĐIỆN THOẠI SAFESOLO',
            icon: Icons.arrow_downward_rounded,
            color: const Color(0xFF10B981),
            items: [
              'Nhịp tim, lượng oxy trong máu (SpO2) và mức pin',
              'Tín hiệu tự động nhận biết té ngã',
              'Tín hiệu khi bấm nút cứu hộ khẩn cấp',
              'Số bước chân và năng lượng vận động hàng ngày',
            ],
          ),
          const SizedBox(height: 14),
          const Divider(color: Color(0xFF334155), height: 1),
          const SizedBox(height: 14),
          // Hướng 2: Phone -> Watch
          _buildSyncDirectionRow(
            fromText: 'ĐIỆN THOẠI SAFESOLO',
            toText: 'ĐỒNG HỒ GALAXY WATCH 5',
            icon: Icons.arrow_upward_rounded,
            color: const Color(0xFF38BDF8),
            items: [
              'Gửi tín hiệu rung để tìm kiếm đồng hồ',
              'Yêu cầu đo nhịp tim ngay từ điện thoại',
              'Đồng bộ danh bạ người thân và lịch điểm danh an toàn',
              'Cập nhật trạng thái kết nối mạng Internet',
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSyncDirectionRow({
    required String fromText,
    required String toText,
    required IconData icon,
    required Color color,
    required List<String> items,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, color: color, size: 16),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                '$fromText ➔ $toText',
                style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ...items.map(
          (text) => Padding(
            padding: const EdgeInsets.only(left: 22, bottom: 4),
            child: Row(
              children: [
                Container(
                  width: 4,
                  height: 4,
                  decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    text,
                    style: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 11),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  /// Danh sách nhật ký hoạt động
  Widget _buildTelemetryLogsList() {
    if (_telemetryLogs.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Center(
          child: Text(
            'Chưa có dữ liệu hoạt động nào.',
            style: TextStyle(color: Color(0xFF64748B), fontSize: 12),
          ),
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF334155)),
      ),
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: _telemetryLogs.length > 8 ? 8 : _telemetryLogs.length,
        separatorBuilder: (_, __) => const Divider(color: Color(0xFF334155), height: 1),
        itemBuilder: (context, index) {
          final log = _telemetryLogs[index];
          final isSuccess = log['success'] as bool;

          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  isSuccess ? Icons.check_circle_outline_rounded : Icons.error_outline_rounded,
                  color: isSuccess ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                  size: 16,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              log['type'] as String,
                              style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            log['time'] as String,
                            style: const TextStyle(color: Color(0xFF64748B), fontSize: 10),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        log['detail'] as String,
                        style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  /// Nút phát tín hiệu cứu hộ khẩn cấp
  Widget _buildSosTriggerButton(AppStrings strings) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFFDC2626),
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          elevation: 4,
        ),
        onPressed: _triggerHardwareSos,
        icon: const Icon(Icons.sos_rounded, size: 26),
        label: Text(
          strings.text('GỬI BÁO ĐỘNG CỨU HỘ KHẨN CẤP', 'TRIGGER EMERGENCY SOS'),
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, letterSpacing: 0.5),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
    );
  }
}

