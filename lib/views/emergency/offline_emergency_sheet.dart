import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_strings.dart';
import '../../core/app_theme.dart';
import '../../core/providers/app_provider.dart';
import '../../core/widgets/top_toast.dart';
import '../../services/offline_resilience_service.dart';
import '../../services/offline_sos_service.dart';

class OfflineEmergencySheet extends StatefulWidget {
  const OfflineEmergencySheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const OfflineEmergencySheet(),
    );
  }

  @override
  State<OfflineEmergencySheet> createState() => _OfflineEmergencySheetState();
}

class _OfflineEmergencySheetState extends State<OfflineEmergencySheet> with SingleTickerProviderStateMixin {
  final OfflineResilienceService _resilience = OfflineResilienceService.instance;
  late final AnimationController _sirenPulseController = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 700),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _sirenPulseController.dispose();
    super.dispose();
  }

  void _toggleSiren() {
    setState(() {
      if (_resilience.isSirenActive) {
        _resilience.stopAcousticRescueSiren();
        TopToast.show(context, message: 'Đã tắt còi cứu hộ âm học.', icon: Icons.volume_off_rounded);
      } else {
        _resilience.startAcousticRescueSiren();
        TopToast.show(
          context,
          message: 'Đang phát còi cứu hộ 115dB Morse SOS tìm kiếm!',
          icon: Icons.campaign_rounded,
        );
      }
    });
  }

  Future<void> _sendOfflineEmergencySms(BuildContext context) async {
    final app = context.read<AppProvider>();
    final victimName = app.user?.name ?? 'Người dùng SafeSolo';
    final med = app.medical;
    final guardianPhone = med.emergencyPhone.isNotEmpty ? med.emergencyPhone : '115';

    final smsBody = _resilience.formatComprehensiveOfflineSms(
      victimName: victimName,
      bloodType: med.bloodType,
      criticalAllergy: med.allergies,
      batteryLevel: 85,
    );

    final launched = await OfflineSosService.instance.sendEmergencySms(
      phoneNumber: guardianPhone,
      message: smsBody,
    );

    if (!context.mounted) return;
    if (!launched) {
      TopToast.show(context, message: 'SMS Sẵn sàng: $smsBody', icon: Icons.sms_rounded);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    final pdr = _resilience.calculatePdrEstimate();
    final isSirenOn = _resilience.isSirenActive;

    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF0F172A), // Tactical Slate Dark
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Pull bar
          Center(
            child: Container(
              width: 44,
              height: 5,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
          const SizedBox(height: 18),

          // Header with offline badges
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: const BoxDecoration(
                  color: Color(0xFFEF4444),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.wifi_off_rounded, color: Colors.white, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      strings.text('Cứu Hộ Ngoại Tuyến (Offline & 0-GPS)', 'Offline Emergency Hub'),
                      style: AppTextStyles.title.copyWith(color: Colors.white, fontSize: 17),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      strings.text(
                        'Kích hoạt khi mất 3G/4G, mất GPS hoặc kẹt tầng hầm B1-B3',
                        'Active when 0-Internet, 0-GPS or trapped in basements',
                      ),
                      style: AppTextStyles.caption.copyWith(color: Colors.white60),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Status indicators
          Row(
            children: [
              _buildStatusPill(
                icon: Icons.signal_cellular_alt_rounded,
                label: 'Mạng: Mất Internet (Dùng SMS)',
                color: const Color(0xFFF59E0B),
              ),
              const SizedBox(width: 8),
              _buildStatusPill(
                icon: Icons.explore_off_rounded,
                label: 'GPS: Kích hoạt PDR Quán tính',
                color: const Color(0xFF3B82F6),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // PDR (Pedestrian Dead Reckoning) Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.my_location_rounded, color: Color(0xFF38BDF8), size: 18),
                    const SizedBox(width: 8),
                    Text(
                      strings.text('ƯỚC TÍNH VỊ TRÍ TRONG NHÀ / HẦM (PDR)', 'INDOOR DEAD RECKONING (PDR)'),
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF38BDF8),
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  pdr.summaryText,
                  style: const TextStyle(color: Colors.white, fontSize: 14, height: 1.4),
                ),
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.terrain_rounded, color: Color(0xFFFBBF24), size: 16),
                      const SizedBox(width: 6),
                      Text(
                        'Độ cao áp kế: ${pdr.floorLabel}',
                        style: const TextStyle(
                          color: Color(0xFFFBBF24),
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Acoustic Siren Rescue Button
          AnimatedBuilder(
            animation: _sirenPulseController,
            builder: (context, child) {
              final scale = isSirenOn ? 1.0 + (_sirenPulseController.value * 0.04) : 1.0;
              return Transform.scale(
                scale: scale,
                child: GestureDetector(
                  onTap: _toggleSiren,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                    decoration: BoxDecoration(
                      color: isSirenOn ? const Color(0xFFDC2626) : const Color(0xFF334155),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: isSirenOn ? Colors.white : Colors.white24,
                        width: isSirenOn ? 2 : 1,
                      ),
                      boxShadow: isSirenOn
                          ? [
                              BoxShadow(
                                color: Colors.red.withValues(alpha: 0.5),
                                blurRadius: 18,
                                spreadRadius: 4,
                              ),
                            ]
                          : [],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          isSirenOn ? Icons.campaign_rounded : Icons.volume_up_rounded,
                          color: Colors.white,
                          size: 26,
                        ),
                        const SizedBox(width: 12),
                        Text(
                          isSirenOn
                            ? strings.text('ĐANG PHÁT CÒI CỨU HỘ 115dB (CHẠM ĐỂ TẮT)', 'SIREN ACTIVE (TAP TO STOP)')
                            : strings.text('BẬT CÒI CỨU HỘ ÂM HỌC ĐỊNH VỊ 115dB', 'ACTIVATE 115dB RESCUE SIREN'),
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 13,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 14),

          // 1-Tap Offline Emergency SMS Button
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton.icon(
              onPressed: () => _sendOfflineEmergencySms(context),
              icon: const Icon(Icons.sms_rounded, color: Colors.white),
              label: Text(
                strings.text(
                  'GỬI SMS CỨU HỘ NGOẠI TUYẾN (KÈM PDR & Y TẾ)',
                  'SEND OFFLINE RESCUE SMS (PDR + MEDICAL)',
                ),
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Colors.white),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2563EB), // Emergency Blue
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusPill({
    required IconData icon,
    required String label,
    required Color color,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.4)),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 16),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  color: color,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
