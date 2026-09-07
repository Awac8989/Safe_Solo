import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/app_strings.dart';
import '../../core/app_theme.dart';
import '../../core/providers/app_provider.dart';
import '../../services/api_service.dart';
import '../../services/pedometer_service.dart';

class WatchSimulatorPage extends StatefulWidget {
  const WatchSimulatorPage({super.key});

  @override
  State<WatchSimulatorPage> createState() => _WatchSimulatorPageState();
}

class _WatchSimulatorPageState extends State<WatchSimulatorPage>
    with SingleTickerProviderStateMixin {
  final ApiService _api = ApiService();
  final PedometerService _pedometer = PedometerService.instance;

  late int _steps;
  late int _heartRate;
  late int _spO2;
  late int _battery;
  late bool _isOffWrist;
  String _watchStatus = 'resting';
  bool _isSosActive = false;
  bool _isFallActive = false;
  bool _isSyncing = false;

  late Timer _clockTimer;
  DateTime _currentTime = DateTime.now();

  late final AnimationController _pulseController = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 800),
  )..repeat(reverse: true);

  @override
  void initState() {
    super.initState();
    _steps = _pedometer.steps;
    _heartRate = _pedometer.heartRate;
    _spO2 = _pedometer.spO2;
    _battery = _pedometer.battery;
    _isOffWrist = _pedometer.isOffWrist;

    _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() => _currentTime = DateTime.now());
      }
    });
  }

  @override
  void dispose() {
    _clockTimer.cancel();
    _pulseController.dispose();
    super.dispose();
  }

  void _syncToPedometerService() {
    _pedometer.updateFromWatchSimulator(
      steps: _steps,
      heartRate: _heartRate,
      spO2: _spO2,
      battery: _battery,
      isOffWrist: _isOffWrist,
      status: _watchStatus,
    );
  }

  Future<void> _sendSignalToBackend({
    required String signalType,
    required Map<String, dynamic> payload,
  }) async {
    final user = context.read<AppProvider>().user;
    if (user == null) return;
    setState(() => _isSyncing = true);
    try {
      await _api.createDeviceSignal(
        userId: user.id,
        signalType: signalType,
        payload: {
          'device': 'Samsung Galaxy Watch 5 (WearOS)',
          'spO2': _spO2,
          'heartRate': _heartRate,
          'battery': _battery,
          'steps': _steps,
          'isOffWrist': _isOffWrist,
          ...payload,
        },
      );
    } catch (e) {
      debugPrint('Sync signal error: $e');
    } finally {
      if (mounted) setState(() => _isSyncing = false);
    }
  }

  void _triggerCriticalSpO2() {
    setState(() {
      _spO2 = 86;
      _heartRate = 126;
      _isSosActive = true;
    });
    _syncToPedometerService();
    _pedometer.emitWatchEmergencyAlert(
      type: 'WATCH_CRITICAL_SPO2',
      message: 'Cảm biến BioActive trên Samsung Galaxy Watch 5 phát hiện SpO2 hạ còn 86%',
    );
    _sendSignalToBackend(
      signalType: 'WATCH_CRITICAL_SPO2',
      payload: {'alert': 'SpO2 giảm thấp nguy kịch dưới 90% (86%)'},
    );
    _showEmergencyCountdownDialog(
      title: 'CẢNH BÁO NGUY HIỂM: SpO2 < 90%',
      message:
          'Cảm biến BioActive trên Samsung Galaxy Watch 5 phát hiện SpO2 hạ còn 86% và nhịp tim 126 bpm. Hệ thống sẽ tự động kích hoạt Cảnh báo Leo thang Cấp 3 SOS sau 30 giây.',
    );
  }

  void _triggerFallSimulation() {
    setState(() {
      _isFallActive = true;
      _watchStatus = 'hard_fall';
      _heartRate = 118;
    });
    _syncToPedometerService();
    _pedometer.emitWatchEmergencyAlert(
      type: 'WATCH_FALL_DETECTED',
      message: 'Phát hiện gia tốc rơi tự do và va chạm mạnh (Hard Fall)',
    );
    _sendSignalToBackend(
      signalType: 'WATCH_FALL_DETECTED',
      payload: {'alert': 'Phát hiện gia tốc rơi tự do và va chạm mạnh (Hard Fall)'},
    );
    _showEmergencyCountdownDialog(
      title: 'PHÁT HIỆN TÉ NGÃ TỪ GALAXY WATCH 5',
      message:
          'Cảm biến gia tốc 3 trục trên Samsung Galaxy Watch 5 phát hiện va chạm mạnh bất thường kèm trạng thái bất động. Đếm ngược 30 giây trước khi điều phối xe cứu hộ khẩn cấp.',
    );
  }

  void _triggerHardSos() {
    setState(() => _isSosActive = true);
    _syncToPedometerService();
    _pedometer.emitWatchEmergencyAlert(
      type: 'WATCH_EMERGENCY_SOS',
      message: 'Người dùng nhấn phím SOS phần cứng trên Watch 5',
    );
    _sendSignalToBackend(
      signalType: 'WATCH_EMERGENCY_SOS',
      payload: {'alert': 'Người dùng nhấn phím SOS phần cứng trên Watch 5'},
    );
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        backgroundColor: Colors.red,
        content: Text('🚨 ĐÃ GỬI TÍN HIỆU SOS KHẨN CẤP TỪ SAMSUNG WATCH 5!'),
      ),
    );
  }

  void _showEmergencyCountdownDialog({
    required String title,
    required String message,
  }) {
    int countdown = 30;
    Timer? timer;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (ctx, setDialogState) {
          timer ??= Timer.periodic(const Duration(seconds: 1), (t) {
            if (countdown > 1) {
              setDialogState(() => countdown--);
            } else {
              t.cancel();
              Navigator.pop(ctx);
              _triggerHardSos();
            }
          });

          return AlertDialog(
            backgroundColor: const Color(0xFF1E293B),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: Row(
              children: [
                const Icon(Icons.warning_amber_rounded, color: Colors.red, size: 28),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(color: Colors.red, fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(message, style: const TextStyle(color: Colors.white70, fontSize: 13)),
                const SizedBox(height: 20),
                Stack(
                  alignment: Alignment.center,
                  children: [
                    SizedBox(
                      width: 80,
                      height: 80,
                      child: CircularProgressIndicator(
                        value: countdown / 30,
                        strokeWidth: 6,
                        valueColor: const AlwaysStoppedAnimation<Color>(Colors.red),
                        backgroundColor: Colors.white12,
                      ),
                    ),
                    Text(
                      '$countdown',
                      style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () {
                  timer?.cancel();
                  setState(() {
                    _isSosActive = false;
                    _isFallActive = false;
                    _spO2 = 98;
                    _heartRate = 78;
                  });
                  _syncToPedometerService();
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Đã hủy cảnh báo. Tình trạng bình thường.')),
                  );
                },
                child: const Text('TÔI ỔN (HỦY)', style: TextStyle(color: Colors.white70)),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                onPressed: () {
                  timer?.cancel();
                  Navigator.pop(ctx);
                  _triggerHardSos();
                },
                child: const Text('GỌI CỨU HỘ NGAY', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    final timeStr = DateFormat('HH:mm').format(_currentTime);
    final secStr = DateFormat(':ss').format(_currentTime);

    final isCritical = _spO2 < 90 || _heartRate > 120 || _isSosActive || _isFallActive;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Giả lập Samsung Galaxy Watch 5'),
        actions: [
          IconButton(
            tooltip: 'Mở Giao diện WearOS Thực tế',
            icon: const Icon(Icons.watch_rounded, color: Color(0xFF38BDF8)),
            onPressed: () => Navigator.of(context).pushNamed('/wear-os'),
          ),
          IconButton(
            tooltip: 'Đồng bộ lên Cloud',
            icon: _isSyncing
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.cloud_upload_outlined),
            onPressed: () => _sendSignalToBackend(
              signalType: 'WATCH_VITALS_STREAM',
              payload: {'status': _watchStatus},
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        child: Column(
          children: [
            // Physical Samsung Watch 5 Simulation Box
            Center(
              child: Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.center,
                children: [
                  // Outer Watch Case (Armor Aluminum chassis)
                  Container(
                    width: 270,
                    height: 270,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(
                        colors: isCritical
                            ? [const Color(0xFF7F1D1D), const Color(0xFF1E293B)]
                            : [const Color(0xFF1E293B), const Color(0xFF0F172A)],
                        radius: 0.85,
                      ),
                      border: Border.all(
                        color: isCritical
                            ? Colors.red
                            : const Color(0xFF38BDF8).withValues(alpha: 0.6),
                        width: 5,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: isCritical
                              ? Colors.red.withValues(alpha: 0.35)
                              : const Color(0xFF38BDF8).withValues(alpha: 0.25),
                          blurRadius: 28,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                  ),

                  // Watch Face Round Screen (1.4-inch Super AMOLED)
                  Container(
                    width: 240,
                    height: 240,
                    padding: const EdgeInsets.all(16),
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.black,
                    ),
                    child: _isOffWrist
                        ? Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.do_not_disturb_on_total_silence_rounded,
                                  color: Colors.amber, size: 38),
                              const SizedBox(height: 8),
                              const Text(
                                'OFF-WRIST',
                                style: TextStyle(
                                  color: Colors.amber,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                strings.text('Đã tháo đồng hồ', 'Watch removed'),
                                style: const TextStyle(color: Colors.white60, fontSize: 10),
                              ),
                            ],
                          )
                        : Column(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              // Top Bar on Watch
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    children: [
                                      const Icon(Icons.bluetooth_connected_rounded,
                                          color: Color(0xFF38BDF8), size: 12),
                                      const SizedBox(width: 3),
                                      Text(
                                        '$_battery%',
                                        style: const TextStyle(
                                            color: Colors.white70, fontSize: 10, fontWeight: FontWeight.w600),
                                      ),
                                    ],
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                    decoration: BoxDecoration(
                                      color: isCritical ? Colors.red : const Color(0xFF10B981),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      isCritical ? 'SOS' : 'LIVE',
                                      style: const TextStyle(
                                          color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                ],
                              ),

                              // Digital Clock Face
                              Column(
                                children: [
                                  FittedBox(
                                    fit: BoxFit.scaleDown,
                                    child: Row(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      crossAxisAlignment: CrossAxisAlignment.baseline,
                                      textBaseline: TextBaseline.alphabetic,
                                      children: [
                                        Text(
                                          timeStr,
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 30,
                                            fontWeight: FontWeight.w800,
                                            fontFamily: 'monospace',
                                            letterSpacing: -1,
                                          ),
                                        ),
                                        Text(
                                          secStr,
                                          style: const TextStyle(
                                            color: Color(0xFF38BDF8),
                                            fontSize: 15,
                                            fontWeight: FontWeight.w600,
                                            fontFamily: 'monospace',
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const Text(
                                    'Samsung Galaxy Watch 5',
                                    style: TextStyle(color: Colors.white70, fontSize: 9, letterSpacing: 0.5),
                                  ),
                                ],
                              ),

                              // BioActive Sensor Live Metrics Row
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceAround,
                                children: [
                                  // Heart Rate
                                  Column(
                                    children: [
                                      ScaleTransition(
                                        scale: Tween(begin: 0.88, end: 1.15).animate(_pulseController),
                                        child: Icon(Icons.favorite_rounded,
                                            color: _heartRate > 120 ? Colors.red : const Color(0xFFF43F5E), size: 16),
                                      ),
                                      Text(
                                        '$_heartRate',
                                        style: TextStyle(
                                          color: _heartRate > 120 ? Colors.red : Colors.white,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 13,
                                        ),
                                      ),
                                      const Text('BPM', style: TextStyle(color: Colors.white38, fontSize: 8)),
                                    ],
                                  ),
                                  // SpO2
                                  Column(
                                    children: [
                                      Icon(Icons.bloodtype_rounded,
                                          color: _spO2 < 90 ? Colors.red : const Color(0xFF06B6D4), size: 16),
                                      Text(
                                        '$_spO2%',
                                        style: TextStyle(
                                          color: _spO2 < 90 ? Colors.red : Colors.white,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 13,
                                        ),
                                      ),
                                      const Text('SpO2', style: TextStyle(color: Colors.white38, fontSize: 8)),
                                    ],
                                  ),
                                  // Steps
                                  Column(
                                    children: [
                                      const Icon(Icons.directions_walk_rounded, color: Color(0xFF38BDF8), size: 16),
                                      Text(
                                        '$_steps',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 13,
                                        ),
                                      ),
                                      const Text('Steps', style: TextStyle(color: Colors.white38, fontSize: 8)),
                                    ],
                                  ),
                                ],
                              ),
                            ],
                          ),
                  ),

                  // Physical Home Key (Top Right)
                  Positioned(
                    right: -14,
                    top: 60,
                    child: InkWell(
                      onTap: _triggerHardSos,
                      child: Container(
                        width: 16,
                        height: 44,
                        decoration: BoxDecoration(
                          color: Colors.redAccent,
                          borderRadius: const BorderRadius.horizontal(right: Radius.circular(6)),
                          boxShadow: [
                            BoxShadow(color: Colors.red.withValues(alpha: 0.4), blurRadius: 6),
                          ],
                        ),
                        child: const Center(
                          child: RotatedBox(
                            quarterTurns: 1,
                            child: Text('SOS', style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ),
                    ),
                  ),

                  // Physical Back Key (Bottom Right)
                  Positioned(
                    right: -12,
                    bottom: 60,
                    child: InkWell(
                      onTap: () {
                        setState(() {
                          _steps += 50;
                          _watchStatus = 'walking';
                        });
                        _syncToPedometerService();
                      },
                      child: Container(
                        width: 14,
                        height: 38,
                        decoration: const BoxDecoration(
                          color: Color(0xFF475569),
                          borderRadius: BorderRadius.horizontal(right: Radius.circular(6)),
                        ),
                        child: const Center(
                          child: RotatedBox(
                            quarterTurns: 1,
                            child: Text('STEP', style: TextStyle(color: Colors.white70, fontSize: 7)),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Hardware Action Controls
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.orange.shade800,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    icon: const Icon(Icons.personal_injury_rounded, size: 18),
                    label: const Text('MÔ PHỎNG TÉ NGÃ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    onPressed: _triggerFallSimulation,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red.shade700,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    icon: const Icon(Icons.emergency_share_rounded, size: 18),
                    label: const Text('BẤM SOS KHẨN CẤP', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    onPressed: _triggerHardSos,
                  ),
                ),
              ],
            ),

            const SizedBox(height: 20),

            // Vital Sliders Console
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Bảng điều khiển thông số BioActive',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      TextButton.icon(
                        icon: const Icon(Icons.warning_amber_rounded, color: Colors.red, size: 16),
                        label: const Text('SpO2 < 90%', style: TextStyle(color: Colors.red, fontSize: 11)),
                        onPressed: _triggerCriticalSpO2,
                      ),
                    ],
                  ),
                  const Divider(),

                  // SpO2 Slider
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Nồng độ Oxy trong máu (SpO2): $_spO2%',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: _spO2 < 90 ? Colors.red : Colors.cyan.shade600,
                          )),
                      if (_spO2 < 90)
                        const Text('NGUY HIỂM', style: TextStyle(color: Colors.red, fontSize: 10, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  Slider(
                    value: _spO2.toDouble(),
                    min: 70,
                    max: 100,
                    divisions: 30,
                    activeColor: _spO2 < 90 ? Colors.red : const Color(0xFF06B6D4),
                    onChanged: (v) {
                      setState(() => _spO2 = v.round());
                      _syncToPedometerService();
                      if (_spO2 < 90 && !_isSosActive) {
                        _triggerCriticalSpO2();
                      }
                    },
                  ),

                  // Heart Rate Slider
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Tần số Nhịp tim (Heart Rate): $_heartRate bpm',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: _heartRate > 120 ? Colors.red : const Color(0xFFE11D48),
                          )),
                      if (_heartRate > 120)
                        const Text('NHỊP TIM CAO', style: TextStyle(color: Colors.red, fontSize: 10, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  Slider(
                    value: _heartRate.toDouble(),
                    min: 40,
                    max: 180,
                    divisions: 140,
                    activeColor: _heartRate > 120 ? Colors.red : const Color(0xFFF43F5E),
                    onChanged: (v) {
                      setState(() => _heartRate = v.round());
                      _syncToPedometerService();
                    },
                  ),

                  // Steps Slider
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Bước chân tích lũy: $_steps bước', style: const TextStyle(fontWeight: FontWeight.w600)),
                      Text('${(_steps * 0.04).toStringAsFixed(1)} kcal',
                          style: const TextStyle(color: Colors.orange, fontSize: 12, fontWeight: FontWeight.w600)),
                    ],
                  ),
                  Slider(
                    value: _steps.toDouble().clamp(0, 20000),
                    min: 0,
                    max: 20000,
                    divisions: 200,
                    activeColor: const Color(0xFF38BDF8),
                    onChanged: (v) {
                      setState(() => _steps = v.round());
                      _syncToPedometerService();
                    },
                  ),

                  // Off-wrist Switch
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Cảm biến tháo vòng tay (Off-wrist)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    subtitle: const Text('Tự ngắt báo động khi tháo sạc ban đêm', style: TextStyle(fontSize: 11)),
                    value: _isOffWrist,
                    onChanged: (v) {
                      setState(() => _isOffWrist = v);
                      _syncToPedometerService();
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
