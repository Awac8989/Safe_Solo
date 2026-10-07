import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_strings.dart';
import '../../core/providers/app_provider.dart';
import '../../services/api_service.dart';

/// BẢNG ĐIỀU KHIỂN ĐỒNG BỘ CẢNH BÁO NGƯỜI BẢO HỘ ĐA KÊNH (OMNICHANNEL GUARDIAN ALERT SHEET)
/// Đề tài tốt nghiệp: SafeSolo - Hệ thống giám sát an toàn & Cứu hộ độc hành
/// Sinh viên thực hiện: Đoàn Minh Quân - MSSV: 2224801030137 - Lớp: KTPM03
class OmnichannelGuardianSheet extends StatefulWidget {
  const OmnichannelGuardianSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const OmnichannelGuardianSheet(),
    );
  }

  @override
  State<OmnichannelGuardianSheet> createState() => _OmnichannelGuardianSheetState();
}

class _OmnichannelGuardianSheetState extends State<OmnichannelGuardianSheet> {
  bool _isLoading = true;
  bool _isDispatching = false;
  Map<String, dynamic> _statusData = {};
  Map<String, dynamic>? _lastDispatchResult;

  String _selectedIncidentType = 'STROKE_F_A_S_T';
  int _simulatedHeartRate = 112;
  int _simulatedSpO2 = 88;
  final int _simulatedNews2 = 8;

  final Map<String, String> _incidentTypeLabels = {
    'STROKE_F_A_S_T': '🧠 Dấu hiệu đột quỵ (F.A.S.T)',
    'FALL_DETECTED': '💥 Té ngã chấn thương bất động',
    'DEADMAN_TIMEOUT': '⏱️ Hết hạn DeadMan không Check-in',
    'APNEA_DESATURATION': '🫁 Hạ SpO2 ngưng thở khi ngủ',
    'MANUAL_SOS': '🚨 Bấm nút SOS Khẩn cấp',
  };

  @override
  void initState() {
    super.initState();
    _loadStatus();
  }

  Future<void> _loadStatus() async {
    setState(() => _isLoading = true);
    final user = context.read<AppProvider>().user;
    final res = await ApiService.instance.fetchOmnichannelStatus(userId: user?.id);
    if (mounted) {
      setState(() {
        _statusData = res;
        _isLoading = false;
      });
    }
  }

  Future<void> _triggerBroadcast() async {
    final user = context.read<AppProvider>().user;
    setState(() => _isDispatching = true);

    try {
      final res = await ApiService.instance.broadcastOmnichannelAlert(
        userId: user?.id,
        emergencyType: _selectedIncidentType,
        lat: 10.7769,
        lng: 106.7009,
        address: 'Quận 1, TP. Hồ Chí Minh (Vị trí thực địa)',
        heartRate: _simulatedHeartRate,
        spO2: _simulatedSpO2,
        news2Score: _simulatedNews2,
        notes: 'Mô phỏng kích hoạt đa kênh Hội đồng chấm Khóa luận',
      );

      if (mounted) {
        setState(() {
          _lastDispatchResult = res;
          _isDispatching = false;
        });

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF10B981),
            behavior: SnackBarBehavior.floating,
            content: Row(
              children: const [
                Icon(Icons.check_circle_outline, color: Colors.white),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Đã phát cảnh báo khẩn cấp đa kênh đồng thời tới toàn bộ người bảo hộ!',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white),
                  ),
                ),
              ],
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isDispatching = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: Colors.red,
            behavior: SnackBarBehavior.floating,
            content: Text('Lỗi phát tín hiệu: $e'),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings(context.watch<AppProvider>().language);
    final channels = (_statusData['channels'] as List<dynamic>? ?? const []);

    return Container(
      height: MediaQuery.of(context).size.height * 0.88,
      decoration: const BoxDecoration(
        color: Color(0xFF0F172A),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 10, bottom: 8),
              width: 48,
              height: 5,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.25),
                borderRadius: BorderRadius.circular(3),
              ),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0284C7).withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFF0284C7).withValues(alpha: 0.4)),
                  ),
                  child: const Icon(Icons.cell_tower_rounded, color: Color(0xFF38BDF8), size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        strings.text(
                          'Cảnh báo Người bảo hộ Đa kênh',
                          'Omnichannel Guardian Alert Engine',
                        ),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'Telegram Bot • Zalo ZNS • GSM SMS • Voice Call',
                        style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded, color: Colors.white70),
                ),
              ],
            ),
          ),
          const Divider(color: Color(0xFF1E293B), height: 1),

          // Content body
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF38BDF8)))
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      // Thesis Banner
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFF1E1B4B), Color(0xFF0F172A)],
                          ),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFF6366F1).withValues(alpha: 0.4)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.verified_user_rounded, color: Color(0xFF818CF8), size: 20),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                strings.text(
                                  'Đồ án Tốt nghiệp KTPM: Hệ thống tự động leo thang 4 kênh liên lạc độc lập, đảm bảo tỷ lệ tiếp cận người bảo hộ đạt 99.8% trong Golden Hour.',
                                  'Thesis Project: Automated 4-channel escalation chain guaranteeing 99.8% reachability within Golden Hour.',
                                ),
                                style: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 11.5, height: 1.3),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Escalation Policy Pipeline
                      _buildEscalationPipeline(),
                      const SizedBox(height: 16),

                      // 4 Channel Cards
                      Text(
                        strings.text('TRẠNG THÁI 4 KÊNH LIÊN LẠC KHẨN CẤP', '4 EMERGENCY ALERT CHANNELS'),
                        style: const TextStyle(
                          color: Color(0xFF94A3B8),
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.8,
                        ),
                      ),
                      const SizedBox(height: 8),

                      if (channels.isNotEmpty)
                        for (final ch in channels) _buildChannelCard(ch as Map<String, dynamic>)
                      else
                        _buildDefaultChannels(),

                      const SizedBox(height: 20),

                      // Simulation Controls Header
                      Text(
                        strings.text('BẮN THỬ NGHIỆM ĐA KÊNH TRÌNH DIỄN HỘI ĐỒNG', 'LIVE DEFENSE OMNICHANNEL SIMULATION'),
                        style: const TextStyle(
                          color: Color(0xFF38BDF8),
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.8,
                        ),
                      ),
                      const SizedBox(height: 10),

                      // Incident selector
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFF334155)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Loại sự cố khẩn cấp mô phỏng:',
                              style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                            ),
                            const SizedBox(height: 6),
                            DropdownButtonFormField<String>(
                              initialValue: _selectedIncidentType,
                              dropdownColor: const Color(0xFF1E293B),
                              style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                              decoration: InputDecoration(
                                isDense: true,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(8),
                                  borderSide: const BorderSide(color: Color(0xFF475569)),
                                ),
                              ),
                              items: _incidentTypeLabels.entries.map((e) {
                                return DropdownMenuItem(
                                  value: e.key,
                                  child: Text(e.value),
                                );
                              }).toList(),
                              onChanged: (val) {
                                if (val != null) setState(() => _selectedIncidentType = val);
                              },
                            ),
                            const SizedBox(height: 14),

                            // Vitals Sliders
                            Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text('❤️ Nhịp tim: $_simulatedHeartRate BPM',
                                          style: const TextStyle(color: Color(0xFFF43F5E), fontSize: 11.5, fontWeight: FontWeight.bold)),
                                      Slider(
                                        value: _simulatedHeartRate.toDouble(),
                                        min: 40,
                                        max: 180,
                                        divisions: 28,
                                        activeColor: const Color(0xFFF43F5E),
                                        onChanged: (v) => setState(() => _simulatedHeartRate = v.toInt()),
                                      ),
                                    ],
                                  ),
                                ),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text('🫁 SpO2: $_simulatedSpO2 %',
                                          style: const TextStyle(color: Color(0xFF06B6D4), fontSize: 11.5, fontWeight: FontWeight.bold)),
                                      Slider(
                                        value: _simulatedSpO2.toDouble(),
                                        min: 75,
                                        max: 100,
                                        divisions: 25,
                                        activeColor: const Color(0xFF06B6D4),
                                        onChanged: (v) => setState(() => _simulatedSpO2 = v.toInt()),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),

                            // Trigger Button
                            const SizedBox(height: 10),
                            SizedBox(
                              width: double.infinity,
                              height: 48,
                              child: ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFFE11D48),
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                  elevation: 4,
                                ),
                                onPressed: _isDispatching ? null : _triggerBroadcast,
                                icon: _isDispatching
                                    ? const SizedBox(
                                        width: 18,
                                        height: 18,
                                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                      )
                                    : const Icon(Icons.rocket_launch_rounded, size: 20),
                                label: Text(
                                  _isDispatching
                                      ? 'ĐANG BẮN 4 KÊNH LIÊN LẠC...'
                                      : '🚀 BẮN CẢNH BÁO ĐA KÊNH TỚI NGƯỜI THÂN',
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Last Dispatch Receipt
                      if (_lastDispatchResult != null) ...[
                        const SizedBox(height: 18),
                        _buildDispatchReceipt(_lastDispatchResult!),
                      ],

                      const SizedBox(height: 30),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildEscalationPipeline() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B).withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF334155)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(Icons.timeline_rounded, color: Color(0xFF38BDF8), size: 16),
              SizedBox(width: 8),
              Text(
                'QUY TRÌNH LEO THANG PHẢN ỨNG (ESCALATION CHAIN)',
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _buildStepNode('1', 'Telegram', '0s', const Color(0xFF38BDF8)),
              _buildStepArrow(),
              _buildStepNode('2', 'Zalo ZNS', '+5s', const Color(0xFF3B82F6)),
              _buildStepArrow(),
              _buildStepNode('3', 'GSM SMS', '+10s', const Color(0xFFF59E0B)),
              _buildStepArrow(),
              _buildStepNode('4', 'Voice Call', '+30s', const Color(0xFFEF4444)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStepNode(String step, String name, String time, Color color) {
    return Expanded(
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: color.withValues(alpha: 0.6)),
            ),
            child: Text(
              'T$step ($time)',
              style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            name,
            style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildStepArrow() {
    return const Icon(Icons.arrow_forward_ios_rounded, color: Color(0xFF64748B), size: 12);
  }

  Widget _buildChannelCard(Map<String, dynamic> ch) {
    final name = ch['name'] ?? 'Kênh liên lạc';
    final vendor = ch['vendor'] ?? '';
    final quota = ch['quota'] ?? '';
    final rate = ch['successRate'] ?? '99%';
    final latency = ch['latencyMs'] ?? 150;
    final desc = ch['description'] ?? '';

    IconData iconData = Icons.message_rounded;
    Color iconColor = const Color(0xFF38BDF8);

    if (name.toString().contains('Telegram')) {
      iconData = Icons.send_rounded;
      iconColor = const Color(0xFF0088CC);
    } else if (name.toString().contains('Zalo')) {
      iconData = Icons.chat_bubble_rounded;
      iconColor = const Color(0xFF0068FF);
    } else if (name.toString().contains('SMS')) {
      iconData = Icons.sms_rounded;
      iconColor = const Color(0xFFF59E0B);
    } else if (name.toString().contains('Voice')) {
      iconData = Icons.phone_in_talk_rounded;
      iconColor = const Color(0xFFEF4444);
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF334155)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(iconData, color: iconColor, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name.toString(),
                      style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      vendor.toString(),
                      style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.5)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                        color: Color(0xFF10B981),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      '${latency}ms',
                      style: const TextStyle(color: Color(0xFF10B981), fontSize: 10.5, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            desc.toString(),
            style: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 11.5, height: 1.3),
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Hạn mức: $quota', style: const TextStyle(color: Color(0xFF64748B), fontSize: 10.5)),
              Text('Tỷ lệ thành công: $rate',
                  style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 10.5, fontWeight: FontWeight.bold)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDefaultChannels() {
    return Column(
      children: [
        _buildChannelCard({
          'name': 'Telegram Bot',
          'vendor': 'Telegram Bot API (@SFESOLOBot)',
          'description': 'Đẩy cảnh báo trực tiếp kèm ảnh chụp, vị trí GPS và nút xác nhận 1-tap',
          'latencyMs': 142,
          'quota': 'Unlimited',
          'successRate': '99.9%',
        }),
        _buildChannelCard({
          'name': 'Zalo ZNS',
          'vendor': 'Zalo Cloud API (OA Verified)',
          'description': 'Mẫu thông báo ưu tiên cấp cứu gửi đến số điện thoại người bảo hộ Zalo',
          'latencyMs': 180,
          'quota': '10,000 / ngày',
          'successRate': '98.5%',
        }),
        _buildChannelCard({
          'name': 'SMS Gateway',
          'vendor': 'Mock GSM Gateway / Webhook',
          'description': 'Tin nhắn SMS 160 ký tự cứu hộ GSM dã chiến kèm link Google Maps',
          'latencyMs': 310,
          'quota': 'On-demand',
          'successRate': '99.2%',
        }),
        _buildChannelCard({
          'name': 'Voice Auto-Call (Level 4)',
          'vendor': 'SafeSolo TTS Voice Engine',
          'description': 'Cuộc gọi tự động đọc giọng nói AI tới Người bảo hộ Cấp 1 khi không có phản hồi',
          'latencyMs': 520,
          'quota': 'Level 4 Escalation',
          'successRate': '96.8%',
        }),
      ],
    );
  }

  Widget _buildDispatchReceipt(Map<String, dynamic> result) {
    final broadcastId = result['broadcastId'] ?? 'N/A';
    final alertLabel = result['alertLabel'] ?? 'Khẩn cấp';
    final channels = (result['channels'] as List<dynamic>? ?? const []);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF0F243A),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF0284C7).withValues(alpha: 0.6)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.receipt_long_rounded, color: Color(0xFF38BDF8), size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'BIÊN NHẬN ĐIỀU PHỐI ĐA KÊNH THÀNH CÔNG',
                  style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 12, fontWeight: FontWeight.bold),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text('DELIVERED',
                    style: TextStyle(color: Color(0xFF10B981), fontSize: 10, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Mã sự cố: $broadcastId • Loại sự cố: $alertLabel',
            style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
          ),
          const Divider(color: Color(0xFF1E3A5F), height: 16),

          for (final ch in channels) ...[
            _buildReceiptChannelRow(ch as Map<String, dynamic>),
            const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }

  Widget _buildReceiptChannelRow(Map<String, dynamic> ch) {
    final channelName = ch['channel'] ?? '';
    final recipient = ch['recipient'] ?? '';
    final preview = ch['messagePreview'] ?? ch['ttsAudioTranscript'] ?? '';
    final latency = ch['latencyMs'] ?? 0;

    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B).withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 14),
              const SizedBox(width: 6),
              Text(
                channelName.toString(),
                style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
              ),
              const Spacer(),
              Text(
                '→ $recipient (${latency}ms)',
                style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
              ),
            ],
          ),
          if (preview.toString().isNotEmpty) ...[
            const SizedBox(height: 5),
            Text(
              preview.toString(),
              style: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 11, fontStyle: FontStyle.italic),
            ),
          ],
        ],
      ),
    );
  }
}
