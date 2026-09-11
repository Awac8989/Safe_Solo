import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/app_strings.dart';
import '../../core/providers/app_provider.dart';
import '../../models/watch_protocol.dart';
import '../../services/api_service.dart';
import '../../services/pedometer_service.dart';
import '../../services/wear_os_service.dart';
import '../../services/watch_sync_manager.dart';

/// ============================================================================
/// SAFESOLO - QUẢN LÝ THIẾT BỊ ĐEO & ĐỒNG BỘ ĐỒNG HỒ THÔNG MINH (WEAR OS)
/// Thiết kế 3 Tab chuyên nghiệp theo phong cách Galaxy Wearable & Apple Watch
/// Tab 1: Tổng quan thiết bị & Sinh tồn BioActive
/// Tab 2: Cảm biến gia tốc IMU & Bảo vệ chống té ngã
/// Tab 3: Giao thức 2 chiều SSWP & Nhật ký gói tin
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
  final String _rssiText = '-54 dBm (Rất tốt)';
  final List<Map<String, dynamic>> _telemetryLogs = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _wearOs.initialize();
    _syncManager.initialize();

    // Lắng nghe gói tin hai chiều từ Watch qua SafeSolo Watch Protocol
    _packetSub = _syncManager.packetStream.listen((packet) {
      if (!mounted) return;
      _addTelemetryLog(
        type: packet.action,
        source: packet.sender == WatchSender.watch ? 'Galaxy Watch 5 (SSWP)' : 'Phone Controller',
        detail: 'Gói tin ${packet.type.name.toUpperCase()}: ${packet.payload}',
        isSuccess: true,
      );
    });

    // Khởi tạo các log mẫu ban đầu
    _addTelemetryLog(
      type: 'BLE_HANDSHAKE',
      source: 'Galaxy Watch 5 (SM-R900)',
      detail: 'Kết nối Bluetooth Low Energy 5.2 thành công. Mã hóa AES-128.',
      isSuccess: true,
    );
    _addTelemetryLog(
      type: 'SENSOR_INIT',
      source: 'BioActive Sensor PPG',
      detail: 'Đã hiệu chuẩn cảm biến nhịp tim quang học và gia tốc 3 trục MEMS.',
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

  /// Đồng bộ gói tin thông số hiện tại lên Cloud Backend
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
        type: 'TELEMETRY_SYNC',
        source: 'Cloud Dispatch Gateway',
        detail: 'Đã truyền thành công gói tin sinh tồn (${_wearOs.heartRate} bpm, ${_wearOs.spO2}% SpO2, ${_wearOs.battery}% PIN)',
        isSuccess: true,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Color(0xFF0284C7),
            content: Text('✓ Đã đồng bộ thông số đồng hồ lên Trung tâm Điều phối an toàn!'),
          ),
        );
      }
    } catch (e) {
      _addTelemetryLog(
        type: 'SYNC_ERROR',
        source: 'API Gateway',
        detail: 'Lỗi gửi gói tin: $e',
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
      type: 'FIND_MY_WATCH',
      source: 'Phone -> Galaxy Watch 5',
      detail: 'Đã truyền lệnh FIND_WATCH_PING kích hoạt chuông rung Haptic cảnh báo vị trí đồng hồ.',
      isSuccess: true,
    );

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        backgroundColor: Color(0xFF059669),
        content: Text('🔔 Đã gửi tín hiệu rung tìm đồng hồ Samsung Galaxy Watch 5!'),
      ),
    );
  }

  /// Yêu cầu đồng hồ đo nhịp tim BioActive tức thời
  Future<void> _triggerInstantMeasurement() async {
    setState(() => _isMeasuring = true);
    _syncManager.sendInstantMeasureRequest();

    await Future.delayed(const Duration(milliseconds: 1200));
    if (!mounted) return;

    setState(() {
      _isMeasuring = false;
    });

    _addTelemetryLog(
      type: 'PPG_MEASUREMENT',
      source: 'BioActive PPG Sensor',
      detail: 'Kết quả đo tức thời: ${_wearOs.heartRate} bpm (Nhịp tim xoang đều).',
      isSuccess: true,
    );

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: const Color(0xFF0284C7),
        content: Text('✓ Đã đồng bộ dữ liệu đo mới nhất: ${_wearOs.heartRate} BPM'),
      ),
    );
  }

  /// Mô phỏng té ngã khẩn cấp để kiểm tra hệ thống
  void _simulateFallTest() {
    _syncManager.emitFallAlert(svm: 3.4, tilt: 75.0, isSimulated: true);
    _addTelemetryLog(
      type: 'FALL_TEST',
      source: 'Simulated IMU Event',
      detail: 'Đã phát hiện va chạm giả lập 3.4g và độ nghiêng 75° (Test mode).',
      isSuccess: true,
    );

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        backgroundColor: Color(0xFFD97706),
        content: Text('⚠️ Đã phát tín hiệu kiểm tra rơi tự do (Fall Test Triggered)!'),
      ),
    );
  }

  /// Kích hoạt phím SOS từ đồng hồ khẩn cấp
  void _triggerHardwareSos() {
    final user = context.read<AppProvider>().user;
    _syncManager.emitHardwareSos(userId: user?.id);
    _wearOs.triggerHardwareSos(userId: user?.id);

    _addTelemetryLog(
      type: 'EMERGENCY_SOS',
      source: 'Galaxy Watch 5 Hardware Button',
      detail: 'BÁO ĐỘNG ĐỎ CẤP 3: Phát tín hiệu SOS khẩn cấp tới Trung tâm Cứu nạn!',
      isSuccess: true,
    );

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        backgroundColor: Colors.red,
        content: Text('🚨 ĐÃ PHÁT TÍN HIỆU SOS KHẨN CẤP TỪ THIẾT BỊ ĐEO!'),
      ),
    );
  }

  /// Hộp thoại ghép nối Smartwatch bằng mã PIN 6 số
  void _showPairingDialog() {
    final textController = TextEditingController(text: _syncManager.pairingCode);
    final user = context.read<AppProvider>().user;

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0F172A),
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.sync_alt_rounded, color: Color(0xFF38BDF8), size: 22),
                      SizedBox(width: 8),
                      Text(
                        'Ghép nối Galaxy Watch 5',
                        style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: Colors.white60),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'Nhập mã số 6 chữ số hiển thị trên mặt đồng hồ Samsung Galaxy Watch 5 để kích hoạt luồng đồng bộ cứu hộ thời gian thực hai chiều.',
                style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 13, height: 1.4),
              ),
              const SizedBox(height: 18),
              TextField(
                controller: textController,
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
                  hintText: '742-891',
                  hintStyle: const TextStyle(color: Colors.white24),
                  filled: true,
                  fillColor: const Color(0xFF1E293B),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: Color(0xFF0284C7)),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0284C7),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: () async {
                        final code = textController.text.trim();
                        if (code.isNotEmpty) {
                          Navigator.pop(ctx);
                          final ok = await _syncManager.verifyPairingCode(code, userId: user?.id ?? 'user_default');
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                backgroundColor: ok ? const Color(0xFF059669) : Colors.red,
                                content: Text(ok
                                    ? '✓ Đã ghép nối thành công với Samsung Galaxy Watch 5!'
                                    : 'Lỗi ghép nối. Vui lòng kiểm tra lại mã số.'),
                              ),
                            );
                          }
                        }
                      },
                      child: const Text('XÁC NHẬN GHÉP NỐI', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            ],
          ),
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
              'Samsung Galaxy Watch 5 · Wear OS 4.0',
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
            Tab(icon: Icon(Icons.monitor_heart_rounded, size: 18), text: 'Sinh tồn'),
            Tab(icon: Icon(Icons.sensors_rounded, size: 18), text: 'Cảm biến & Ngã'),
            Tab(icon: Icon(Icons.sync_alt_rounded, size: 18), text: 'Đồng bộ & SSWP'),
          ],
        ),
      ),
      body: AnimatedBuilder(
        animation: Listenable.merge([_wearOs, _pedometer, _syncManager]),
        builder: (context, _) {
          final isConnected = _pedometer.isPaired;
          final isOffWrist = _wearOs.isOffWrist;

          return TabBarView(
            controller: _tabController,
            children: [
              // ===============================================================
              // TAB 1: TỔNG QUAN THIẾT BỊ & CHỈ SỐ SINH TỒN
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
                      strings.text('THÔNG SỐ SINH TỒN BIOACTIVE TRỰC TIẾP', 'LIVE BIOACTIVE TELEMETRY'),
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
              // TAB 2: CẢM BIẾN IMU & CHỐNG TÉ NGÃ
              // ===============================================================
              SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      strings.text('GIÁM SÁT GIA TỐC KÉ VÀ TƯ THẾ (IMU)', 'INERTIAL MOTION SENSING (IMU)'),
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
                    // Nút mô phỏng té ngã
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
                          'MÔ PHỎNG SỰ KIỆN TÉ NGÃ (FALL TEST)',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    Text(
                      strings.text('CẤU HÌNH NGƯỠNG AN TOÀN SINH TỒN', 'SAFETY THRESHOLD CONFIGURATION'),
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
              // TAB 3: GIAO THỨC SSWP & NHẬT KÝ GÓI TIN ĐỒNG BỘ 2 CHIỀU
              // ===============================================================
              SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildBiDirectionalSyncModelCard(),
                    const SizedBox(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          strings.text('NHẬT KÝ TRUYỀN TIN (SSWP PACKET STREAM)', 'SENSOR TELEMETRY STREAM'),
                          style: const TextStyle(
                            color: Color(0xFF94A3B8),
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1.1,
                          ),
                        ),
                        Text(
                          '${_telemetryLogs.length} gói tin',
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

  /// Thẻ trạng thái kết nối phần cứng Bluetooth LE
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
                            isConnected ? 'ĐÃ KẾT NỐI' : 'NGẮT KẾT NỐI',
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
                      'SM-R900 · BLE 5.2 · UUID: 0000180D',
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 12),
                    ),
                    const SizedBox(height: 8),
                    // Tình trạng đeo cổ tay
                    Row(
                      children: [
                        Icon(
                          isOffWrist ? Icons.cancel_outlined : Icons.check_circle_rounded,
                          size: 14,
                          color: isOffWrist ? const Color(0xFFFBBF24) : const Color(0xFF34D399),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          isOffWrist ? 'Đã tháo khỏi cổ tay (Off-wrist)' : 'Đang đeo trên cổ tay (BioActive On)',
                          style: TextStyle(
                            color: isOffWrist ? const Color(0xFFFBBF24) : const Color(0xFF34D399),
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
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
          // Hàng chỉ số nhanh: Pin, Sóng BLE, Lần đồng bộ
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildQuickStat(
                icon: Icons.battery_charging_full_rounded,
                iconColor: const Color(0xFF10B981),
                label: 'Pin đồng hồ',
                value: '${_wearOs.battery}%',
              ),
              _buildQuickStat(
                icon: Icons.bluetooth_audio_rounded,
                iconColor: const Color(0xFF38BDF8),
                label: 'Cường độ sóng',
                value: _rssiText,
              ),
              _buildQuickStat(
                icon: Icons.sync_rounded,
                iconColor: const Color(0xFFA78BFA),
                label: 'Độ trễ (${_syncManager.connectionType == WatchConnectionType.localBle ? 'BLE' : 'Sync'})',
                value: '${_syncManager.latencyMs} ms',
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
                Row(
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
                    Text(
                      'Kênh: ${_syncManager.connectionStatusLabel}',
                      style: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
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
                        const Icon(Icons.sync_alt_rounded, color: Color(0xFF38BDF8), size: 12),
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
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: iconColor, size: 16),
            const SizedBox(width: 4),
            Text(
              value,
              style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
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
                  side: const BorderSide(color: Color(0xFF0284C7)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: _isMeasuring ? null : _triggerInstantMeasurement,
                icon: _isMeasuring
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF38BDF8)))
                    : const Icon(Icons.favorite_rounded, size: 18),
                label: Text(
                  _isMeasuring ? 'Đang đọc PPG...' : 'Đo nhịp tim tức thì',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF34D399),
                  side: const BorderSide(color: Color(0xFF059669)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: _pingFindWatch,
                icon: const Icon(Icons.vibration_rounded, size: 18),
                label: const Text(
                  'Tìm đồng hồ (Rung)',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
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
              backgroundColor: const Color(0xFF00C853),
              foregroundColor: Colors.black,
              padding: const EdgeInsets.symmetric(vertical: 13),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              elevation: 4,
            ),
            onPressed: () => Navigator.of(context).pushNamed('/wear-os'),
            icon: const Icon(Icons.watch_rounded, size: 20),
            label: const Text(
              'Xem Mô Phỏng Mặt Đồng Hồ (WearOS Interface)',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
            ),
          ),
        ),
      ],
    );
  }

  /// Lưới thông số sinh tồn đo từ cảm biến BioActive
  Widget _buildBiometricGrid() {
    return GridView.count(
      crossAxisCount: 2,
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      childAspectRatio: 1.35,
      children: [
        // NHỊP TIM (PPG)
        _buildMetricTile(
          icon: Icons.favorite_rounded,
          iconColor: const Color(0xFFEF4444),
          title: 'Nhịp tim PPG',
          value: '${_wearOs.heartRate}',
          unit: 'BPM',
          status: _wearOs.heartRate > 100
              ? 'Nhịp nhanh'
              : _wearOs.heartRate < 55
                  ? 'Nhịp chậm'
                  : 'Bình thường',
          statusColor: _wearOs.heartRate > 100 ? const Color(0xFFEF4444) : const Color(0xFF10B981),
          extra: 'Đo liên tục qua quang học',
        ),

        // SPO2 OXY TRONG MÁU
        _buildMetricTile(
          icon: Icons.water_drop_rounded,
          iconColor: const Color(0xFF38BDF8),
          title: 'Oxy máu SpO2',
          value: '${_wearOs.spO2}',
          unit: '%',
          status: _wearOs.spO2 >= 95 ? 'Tối ưu' : 'Cần chú ý (<95%)',
          statusColor: _wearOs.spO2 >= 95 ? const Color(0xFF10B981) : const Color(0xFFFBBF24),
          extra: 'Cảm biến hồng ngoại đỏ',
        ),

        // BƯỚC CHÂN TRONG NGÀY
        _buildMetricTile(
          icon: Icons.directions_walk_rounded,
          iconColor: const Color(0xFFF59E0B),
          title: 'Vận động hôm nay',
          value: NumberFormat('#,###').format(_wearOs.steps),
          unit: 'bước',
          status: '${_wearOs.distanceKm} km',
          statusColor: const Color(0xFF94A3B8),
          extra: '${_wearOs.calories} kcal tiêu hao',
        ),

        // MỨC PIN THIẾT BỊ
        _buildMetricTile(
          icon: Icons.battery_full_rounded,
          iconColor: const Color(0xFF10B981),
          title: 'Năng lượng pin',
          value: '${_wearOs.battery}',
          unit: '%',
          status: _wearOs.battery > 20 ? 'Bình thường' : 'Pin yếu',
          statusColor: _wearOs.battery > 20 ? const Color(0xFF10B981) : const Color(0xFFEF4444),
          extra: 'Ước tính còn ~32 giờ',
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
              Text(
                title,
                style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.w600),
              ),
              Icon(icon, color: iconColor, size: 18),
            ],
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                value,
                style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
              ),
              const SizedBox(width: 4),
              Text(
                unit,
                style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 12),
              ),
            ],
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  status,
                  style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
              Text(
                extra,
                style: const TextStyle(color: Color(0xFF64748B), fontSize: 9),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// Cảm biến gia tốc & Phát hiện té ngã
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
              Row(
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
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Cảm biến quán tính 6 trục (IMU)',
                        style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                      ),
                      Text(
                        'Gia tốc kế 3D + Con quay hồi chuyển',
                        style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                      ),
                    ],
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: isMonitoring ? const Color(0xFF10B981).withValues(alpha: 0.15) : const Color(0xFFEF4444).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  isMonitoring ? 'ĐANG GIÁM SÁT' : 'TẠM TẮT',
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
          // Chỉ số Vector tổng hợp SVM & Góc nghiêng
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
                      const Text('Gia tốc SVM (g)', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
                      const SizedBox(height: 4),
                      Text(
                        '${svm.toStringAsFixed(2)} g',
                        style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        svm > 2.5 ? '⚠️ Va đập mạnh' : 'Trọng lực 1.0g tĩnh',
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
                      const Text('Góc nghiêng thân', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
                      const SizedBox(height: 4),
                      Text(
                        '${tilt.toStringAsFixed(1)}°',
                        style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        tilt > 60 ? '⚠️ Tư thế nằm ngang' : 'Tư thế đứng chuẩn',
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
            'Thuật toán lọc Kalman và ngưỡng rơi tự do Kinematic Fall Trigger: Khi phát hiện SVM > 2.5g kèm theo góc nghiêng > 60° bất động, hệ thống lập tức đếm ngược 30 giây kích hoạt cứu hộ khẩn cấp.',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 11, height: 1.4),
          ),
        ],
      ),
    );
  }

  /// Cấu hình ngưỡng an toàn
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
            title: 'Cảnh báo nhịp tim quá cao',
            valueText: '> 120 BPM',
            description: 'Kích hoạt cảnh báo khi nhịp tim duy trì cao bất thường',
          ),
          const Divider(color: Color(0xFF334155), height: 20),
          _buildThresholdRow(
            title: 'Cảnh báo nồng độ oxy nguy cấp',
            valueText: '< 90% SpO2',
            description: 'Tự động gọi cấp cứu khi SpO2 hạ dưới ngưỡng sinh tồn',
          ),
          const Divider(color: Color(0xFF334155), height: 20),
          _buildThresholdRow(
            title: 'Độ nhạy phát hiện té ngã (IMU)',
            valueText: '2.5 g (Chuẩn)',
            description: 'Phát hiện va chạm rơi tự do chuẩn xác, hạn chế báo động giả',
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

  /// Sơ đồ trực quan luồng đồng bộ 2 chiều SSWP
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
              Text(
                'MÔ HÌNH ĐỒNG BỘ 2 CHIỀU (SSWP)',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.8,
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
              'Chỉ số sinh tồn PPG (Nhịp tim) & SpO2',
              'Cảm biến IMU phát hiện té ngã (Shockwave g)',
              'Sự kiện bấm phím cứng SOS cứu hộ',
              'Số bước chân Pedometer và lượng Calo',
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
              'Lệnh rung Haptic tìm đồng hồ (Find My Watch)',
              'Yêu cầu đo nhịp tim BioActive tức thời',
              'Đồng bộ danh bạ người bảo hộ & Hạn chót điểm danh',
              'Cập nhật tình trạng kết nối Cloud Relay',
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

  /// Danh sách nhật ký truyền tin cảm biến BLE
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
            'Chưa có dữ liệu truyền tin nào.',
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
                          Text(
                            log['type'] as String,
                            style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                          ),
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

  /// Nút phát SOS khẩn cấp
  Widget _buildSosTriggerButton(AppStrings strings) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: ElevatedButton.icon(
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFFDC2626),
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          elevation: 4,
        ),
        onPressed: _triggerHardwareSos,
        icon: const Icon(Icons.sos_rounded, size: 28),
        label: Text(
          strings.text('KÍCH HOẠT SOS KHẨN CẤP TỪ ĐỒNG HỒ', 'TRIGGER EMERGENCY SOS FROM WATCH'),
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, letterSpacing: 0.5),
        ),
      ),
    );
  }
}
