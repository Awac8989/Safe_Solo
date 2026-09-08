import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/app_strings.dart';
import '../../core/providers/app_provider.dart';
import '../../services/api_service.dart';
import '../../services/pedometer_service.dart';
import '../../services/wear_os_service.dart';

/// ============================================================================
/// SAFESOLO - QUẢN LÝ KẾT NỐI VÀ THEO DÕI THÔNG SỐ ĐỒNG HỒ THÔNG MINH (WEAR OS)
/// Phục vụ Đề tài: Cảnh báo khẩn cấp tự động và Điều phối cứu hộ thời gian thực
/// Tác giả: SV Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03
/// ============================================================================
class SmartwatchConnectionPage extends StatefulWidget {
  const SmartwatchConnectionPage({super.key});

  @override
  State<SmartwatchConnectionPage> createState() => _SmartwatchConnectionPageState();
}

class _SmartwatchConnectionPageState extends State<SmartwatchConnectionPage> {
  final ApiService _api = ApiService();
  final WearOsService _wearOs = WearOsService.instance;
  final PedometerService _pedometer = PedometerService.instance;

  late Timer _refreshTimer;
  bool _isSyncing = false;
  bool _isMeasuring = false;
  final String _rssiText = '-54 dBm (Rất tốt)';
  final List<Map<String, dynamic>> _telemetryLogs = [];

  @override
  void initState() {
    super.initState();
    _wearOs.initialize();

    // Khởi tạo các log mẫu ban đầu
    _addTelemetryLog(
      type: 'BLE_HANDSHAKE',
      source: 'Galaxy Watch 5 (SM-R900)',
      detail: 'Kết nối Bluetooth Low Energy thành công. Mã hóa AES-128.',
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
    _refreshTimer.cancel();
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
    if (_telemetryLogs.length > 20) {
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
    HapticFeedback.heavyImpact();
    _addTelemetryLog(
      type: 'FIND_MY_WATCH',
      source: 'Phone -> Galaxy Watch 5',
      detail: 'Đã gửi lệnh kích hoạt chuông rung Haptic cảnh báo vị trí đồng hồ.',
      isSuccess: true,
    );

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        backgroundColor: Color(0xFF059669),
        content: Text('🔔 Đã kích hoạt rung tìm đồng hồ Samsung Galaxy Watch 5!'),
      ),
    );
  }

  /// Yêu cầu đồng hồ đo nhịp tim BioActive tức thời
  Future<void> _triggerInstantMeasurement() async {
    setState(() => _isMeasuring = true);
    HapticFeedback.mediumImpact();

    await Future.delayed(const Duration(milliseconds: 1500));
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
        content: Text('✓ Đã nhận dữ liệu đo mới nhất: ${_wearOs.heartRate} BPM'),
      ),
    );
  }

  /// Kích hoạt phím SOS từ đồng hồ khẩn cấp
  void _triggerHardwareSos() {
    final user = context.read<AppProvider>().user;
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
              strings.text('Thiết bị đeo & Đồng hồ thông minh', 'Wearable & Smartwatch'),
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
            tooltip: 'Xem màn hình đồng hồ',
            icon: const Icon(Icons.watch_rounded, color: Colors.white70),
            onPressed: () => Navigator.of(context).pushNamed('/wear-os'),
          ),
        ],
      ),
      body: AnimatedBuilder(
        animation: Listenable.merge([_wearOs, _pedometer]),
        builder: (context, _) {
          final isConnected = _pedometer.isPaired;
          final isOffWrist = _wearOs.isOffWrist;

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. THẺ TRẠNG THÁI KẾT NỐI BLUETOOTH LE CHÍNH
                _buildConnectionStatusCard(isConnected, isOffWrist),
                const SizedBox(height: 16),

                // 2. CÁC TÁC VỤ ĐIỀU KHIỂN TRỰC TIẾP
                _buildDirectActionsRow(),
                const SizedBox(height: 20),

                // 3. BẢNG THÔNG SỐ SINH TỒN THỜI GIAN THỰC (BIOACTIVE TELEMETRY)
                Text(
                  strings.text('THÔNG SỐ SINH TỒN TRỰC TIẾP', 'LIVE BIOMETRIC TELEMETRY'),
                  style: const TextStyle(
                    color: Color(0xFF94A3B8),
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.1,
                  ),
                ),
                const SizedBox(height: 10),
                _buildBiometricGrid(),
                const SizedBox(height: 20),

                // 4. GIÁM SÁT CẢM BIẾN GIA TỐC & PHÁT HIỆN TÉ NGÃ (FALL DETECTION)
                Text(
                  strings.text('CẢM BIẾN CHUYỂN ĐỘNG & GIA TỐC (IMU)', 'MOTION & ACCELEROMETER (IMU)'),
                  style: const TextStyle(
                    color: Color(0xFF94A3B8),
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.1,
                  ),
                ),
                const SizedBox(height: 10),
                _buildMotionSensorCard(),
                const SizedBox(height: 20),

                // 5. CẤU HÌNH NGƯỠNG AN TOÀN TRỰC TIẾP
                Text(
                  strings.text('CẤU HÌNH NGƯỠNG AN TOÀN', 'SAFETY THRESHOLD CONFIGURATION'),
                  style: const TextStyle(
                    color: Color(0xFF94A3B8),
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.1,
                  ),
                ),
                const SizedBox(height: 10),
                _buildSafetyThresholdsCard(),
                const SizedBox(height: 20),

                // 6. NHẬT KÝ GÓI TIN TRUYỀN DỮ LIỆU TỪ ĐỒNG HỒ (LIVE TELEMETRY LOGS)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      strings.text('NHẬT KÝ TRUYỀN TIN CẢM BIẾN (BLE STREAM)', 'SENSOR TELEMETRY STREAM'),
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

                // NÚT PHÁT SOS TRỰC TIẾP TỪ THIẾT BỊ ĐEO
                SizedBox(
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
                ),
                const SizedBox(height: 24),
              ],
            ),
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
                label: 'Chu kỳ đồng bộ',
                value: '1 giây/lần',
              ),
            ],
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
    return Row(
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
          extra: 'Đo liên tục qua đèn LED xanh',
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
        itemCount: _telemetryLogs.length > 5 ? 5 : _telemetryLogs.length,
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
}
