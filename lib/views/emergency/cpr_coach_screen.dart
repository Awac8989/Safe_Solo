import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/app_theme.dart';
import '../../services/cpr_quality_coach_service.dart';

/// ============================================================================
/// SAFESOLO — MÀN HÌNH HUẤN LUYỆN & HỖ TRỢ ÉP TIM CHẤT LƯỢNG CAO (PHÂN HỆ 139)
/// Đồ thị nhịp đập, thước đo độ sâu 5-6 cm chuẩn AHA, đếm 30:2 chu kỳ
///
/// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03 - TDMU
/// ============================================================================

class CprCoachScreen extends StatefulWidget {
  const CprCoachScreen({super.key});

  @override
  State<CprCoachScreen> createState() => _CprCoachScreenState();
}

class _CprCoachScreenState extends State<CprCoachScreen> {
  final _coach = CprQualityCoachService.instance;

  @override
  void initState() {
    super.initState();
    _coach.addListener(_onUpdate);
  }

  @override
  void dispose() {
    _coach.removeListener(_onUpdate);
    super.dispose();
  }

  void _onUpdate() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final isActive = _coach.isActive;
    final isVentilation = _coach.currentPhase == CprPhase.ventilations;

    return Scaffold(
      backgroundColor: const Color(0xFF0D1117),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          'CPR Quality Coach (AHA 2020)',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () {
            if (_coach.isActive) {
              _coach.stopSession();
            }
            Navigator.of(context).pop();
          },
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          child: Column(
            children: [
              // Thông báo giọng nói / Chỉ đạo
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: isVentilation ? const Color(0xFF1E88E5) : const Color(0xFF1F2937),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isVentilation ? Colors.lightBlueAccent : const Color(0xFF374151),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      isVentilation ? Icons.air_rounded : Icons.record_voice_over_rounded,
                      color: Colors.white,
                      size: 28,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        _coach.voiceFeedbackPrompt,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Vòng tròn hiển thị nhịp & độ sâu lớn
              Expanded(
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      // Chỉ số nhịp đập & độ sâu
                      Text(
                        isVentilation ? 'THỔI NGẠT' : '${_coach.currentDepthCm.toStringAsFixed(1)} cm',
                        style: TextStyle(
                          color: isVentilation
                              ? Colors.lightBlueAccent
                              : (_coach.currentDepthCm >= 5.0 && _coach.currentDepthCm <= 6.0)
                                  ? const Color(0xFF10B981)
                                  : const Color(0xFFEF4444),
                          fontSize: 48,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        isVentilation
                            ? 'Thổi 2 hơi trong < 10 giây'
                            : 'Mục tiêu chuẩn AHA: 5.0 - 6.0 cm',
                        style: const TextStyle(color: Colors.white60, fontSize: 13),
                      ),

                      const SizedBox(height: 24),

                      // Tần số BPM
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                        decoration: BoxDecoration(
                          color: const Color(0xFF111827),
                          borderRadius: BorderRadius.circular(30),
                          border: Border.all(color: const Color(0xFF374151)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.speed_rounded, color: Color(0xFFF59E0B), size: 20),
                            const SizedBox(width: 8),
                            Text(
                              '${_coach.currentBpm.toStringAsFixed(0)} BPM (Chuẩn: 100-120)',
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 30),

                      // Tiến trình chu kỳ 30 nhịp
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            'Chu kỳ ${_coach.cycleCount}',
                            style: const TextStyle(color: Colors.white70, fontSize: 14),
                          ),
                          const SizedBox(width: 16),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: const Color(0xFF374151),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              'Nhịp: ${((_coach.compressionCount - 1) % 30) + 1} / 30',
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 15,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

              // Nút bắt đầu / dừng
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton.icon(
                  onPressed: () {
                    HapticFeedback.heavyImpact();
                    if (_coach.isActive) {
                      final report = _coach.stopSession();
                      _showReportDialog(context, report);
                    } else {
                      _coach.startSession();
                    }
                  },
                  icon: Icon(_coach.isActive ? Icons.stop_rounded : Icons.play_arrow_rounded),
                  label: Text(
                    _coach.isActive ? 'DỪNG & XEM BÁO CÁO' : 'BẮT ĐẦU ÉP TIM (START CPR)',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _coach.isActive ? const Color(0xFFDC2626) : const Color(0xFF10B981),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }

  void _showReportDialog(BuildContext context, CprSessionReport report) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1F2937),
        title: const Row(
          children: [
            Icon(Icons.assessment_rounded, color: Color(0xFF10B981)),
            SizedBox(width: 10),
            Text('Báo Cáo Chất Lượng CPR', style: TextStyle(color: Colors.white, fontSize: 17)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _reportRow('Thời gian:', '${report.totalDurationSeconds} giây'),
            _reportRow('Tổng số nhịp ép:', '${report.totalCompressions} lần'),
            _reportRow('Số chu kỳ hoàn tất:', '${report.completedCycles} chu kỳ 30:2'),
            _reportRow('Độ sâu trung bình:', '${report.averageDepthCm} cm'),
            _reportRow('Tốc độ trung bình:', '${report.averageRateBpm} BPM'),
            _reportRow('Tỷ lệ đạt chuẩn độ sâu:', '${report.optimalDepthPercentage}%'),
            _reportRow('Tỷ lệ đạt chuẩn nhịp:', '${report.optimalRatePercentage}%'),
            const Divider(color: Colors.white24, height: 20),
            Text(
              'Đánh giá: ${report.summaryRating}',
              style: const TextStyle(color: Color(0xFF10B981), fontWeight: FontWeight.bold, fontSize: 13),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Đóng', style: TextStyle(color: Colors.white70)),
          ),
        ],
      ),
    );
  }

  Widget _reportRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.white60, fontSize: 13)),
          Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
        ],
      ),
    );
  }
}
