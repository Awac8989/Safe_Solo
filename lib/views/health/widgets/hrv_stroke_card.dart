import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../services/ai_signal_processor.dart';
import '../../../services/hrv_stroke_service.dart';

/// ============================================================================
/// SAFESOLO - THẺ PHÂN TÍCH HRV & DỰ ĐOÁN ĐỘT QUỴ SỚM (HRV & STROKE CARD)
/// Thiết kế chuẩn Y khoa Điện toán: BioActive Tachogram, Đo đạc 15s, Bảng F.A.S.T
/// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03
/// ============================================================================
class HrvStrokeCard extends StatefulWidget {
  const HrvStrokeCard({super.key});

  @override
  State<HrvStrokeCard> createState() => _HrvStrokeCardState();
}

class _HrvStrokeCardState extends State<HrvStrokeCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  Color _getRiskColor(HrvRiskLevel level) {
    switch (level) {
      case HrvRiskLevel.normal:
        return const Color(0xFF10B981); // Emerald Green
      case HrvRiskLevel.moderate:
        return const Color(0xFFF59E0B); // Amber Yellow
      case HrvRiskLevel.critical:
        return const Color(0xFFEF4444); // Crimson Red
    }
  }

  String _getRiskLevelText(HrvRiskLevel level) {
    switch (level) {
      case HrvRiskLevel.normal:
        return 'AN TOÀN · CÂN BẰNG';
      case HrvRiskLevel.moderate:
        return 'CẢNH BÁO SỚM';
      case HrvRiskLevel.critical:
        return 'NGUY CƠ CAO (F.A.S.T)';
    }
  }

  /// Mở bảng tầm soát đột quỵ F.A.S.T
  void _openFastScreeningSheet(BuildContext context, StrokeCardiacRiskAssessment assessment) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _FastScreeningModal(assessment: assessment),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hrvService = HrvStrokeService.instance;

    return ListenableBuilder(
      listenable: hrvService,
      builder: (context, _) {
        final assessment = hrvService.assessment;
        final metrics = hrvService.metrics;
        final riskColor = _getRiskColor(assessment.level);

        return Container(
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(
              color: riskColor.withValues(alpha: assessment.level == HrvRiskLevel.critical ? 0.8 : 0.35),
              width: assessment.level == HrvRiskLevel.critical ? 1.8 : 1.2,
            ),
            boxShadow: [
              BoxShadow(
                color: riskColor.withValues(alpha: 0.14),
                blurRadius: 16,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. TIÊU ĐỀ & TRẠNG THÁI NGUY CƠ
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: riskColor.withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      Icons.graphic_eq_rounded,
                      color: riskColor,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Dự đoán Đột quỵ & Loạn nhịp (HRV)',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 14.5,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Phân tích biến thiên R-R lâm sàng trước 15-30 phút',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.6),
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: riskColor.withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: riskColor.withValues(alpha: 0.6)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (assessment.level == HrvRiskLevel.critical)
                          AnimatedBuilder(
                            animation: _pulseController,
                            builder: (context, _) => Container(
                              width: 6,
                              height: 6,
                              margin: const EdgeInsets.only(right: 6),
                              decoration: BoxDecoration(
                                color: riskColor,
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: riskColor,
                                    blurRadius: 4 * _pulseController.value,
                                  ),
                                ],
                              ),
                            ),
                          ),
                        Text(
                          _getRiskLevelText(assessment.level),
                          style: TextStyle(
                            color: riskColor,
                            fontSize: 10.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // 2. THANH ĐO NGUY CƠ ĐỘT QUỴ & LOẠN NHỊP (%)
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.28),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.white10),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Xác suất Nguy cơ Đột quỵ / AFib',
                          style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600),
                        ),
                        Text(
                          '${assessment.riskPercent}%',
                          style: TextStyle(
                            color: riskColor,
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Stack(
                        children: [
                          Container(
                            height: 8,
                            color: Colors.white12,
                          ),
                          FractionallySizedBox(
                            widthFactor: (assessment.riskPercent / 100.0).clamp(0.05, 1.0),
                            child: Container(
                              height: 8,
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [
                                    const Color(0xFF10B981),
                                    assessment.riskPercent > 60
                                        ? const Color(0xFFEF4444)
                                        : assessment.riskPercent > 28
                                            ? const Color(0xFFF59E0B)
                                            : const Color(0xFF34D399),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      assessment.title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      assessment.recommendation,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.7),
                        fontSize: 11.5,
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              // 3. MA TRẬN 4 CHỈ SỐ HRV MIỀN THỜI GIAN
              Row(
                children: [
                  Expanded(
                    child: _buildMetricTile(
                      label: 'RMSSD',
                      value: '${metrics.rmssdMs} ms',
                      subLabel: 'Phó giao cảm',
                      highlight: metrics.rmssdMs < 18 || metrics.rmssdMs > 75,
                      riskColor: riskColor,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildMetricTile(
                      label: 'SDNN',
                      value: '${metrics.sdnnMs} ms',
                      subLabel: 'Tổng hòa HRV',
                      highlight: metrics.sdnnMs < 25,
                      riskColor: riskColor,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildMetricTile(
                      label: 'pNN50',
                      value: '${metrics.pnn50Percent}%',
                      subLabel: 'Loạn nhịp R-R',
                      highlight: metrics.pnn50Percent > 25,
                      riskColor: riskColor,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildMetricTile(
                      label: 'Stress (SI)',
                      value: '${metrics.stressIndex.toInt()}',
                      subLabel: 'Áp lực tim',
                      highlight: metrics.stressIndex > 250,
                      riskColor: riskColor,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // 4. BIỂU ĐỒ TACHOGRAM R-R INTERVALS
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Đồ thị Sóng Mạch Tachogram (${hrvService.rrIntervals.length} nhịp)',
                        style: const TextStyle(color: Colors.white70, fontSize: 11.5, fontWeight: FontWeight.w600),
                      ),
                      Text(
                        'R-R: ${metrics.meanRrMs.toInt()} ms',
                        style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Container(
                    height: 52,
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.black26,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.white10),
                    ),
                    child: CustomPaint(
                      painter: _TachogramPainter(
                        intervals: hrvService.rrIntervals,
                        lineColor: riskColor,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // 5. THANH TIẾN ĐỘ ĐO KIỂM 15 GIÂY (NẾU ĐANG ĐO)
              if (hrvService.isMeasuring) ...[
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Đang hiệu chỉnh đo lường BioActive PPG...',
                          style: TextStyle(color: Color(0xFF38BDF8), fontSize: 11, fontWeight: FontWeight.w600),
                        ),
                        Text(
                          '${(hrvService.measureProgress * 15).toInt()}s / 15s',
                          style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: LinearProgressIndicator(
                        value: hrvService.measureProgress,
                        minHeight: 6,
                        backgroundColor: Colors.white12,
                        valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF38BDF8)),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
              ],

              // 6. CÁC NÚT TÁC VỤ & BỘ CHỌN KỊCH BẢN MÔ PHỎNG LÂM SÀNG
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0284C7),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: hrvService.isMeasuring
                          ? null
                          : () => hrvService.startHrvMeasurement(),
                      icon: const Icon(Icons.speed_rounded, size: 16),
                      label: Text(
                        hrvService.isMeasuring ? 'Đang đo...' : 'Đo HRV 15s',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFEF4444),
                        side: BorderSide(color: const Color(0xFFEF4444).withValues(alpha: 0.6)),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: () => _openFastScreeningSheet(context, assessment),
                      icon: const Icon(Icons.health_and_safety_outlined, size: 16),
                      label: const Text(
                        'Kiểm tra F.A.S.T',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // 7. CÁC CHIP MÔ PHỎNG (CHỨC NĂNG DÀNH CHO HỘI ĐỒNG BẢO VỆ ĐỒ ÁN)
              Wrap(
                spacing: 8,
                runSpacing: 6,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  const Text(
                    'Thử nghiệm:',
                    style: TextStyle(color: Colors.white54, fontSize: 11),
                  ),
                  _buildScenarioChip(
                    label: 'Ổn định',
                    scenario: HrvScenario.normal,
                    current: hrvService.currentScenario,
                    onSelected: () => hrvService.simulateScenario(HrvScenario.normal),
                  ),
                  _buildScenarioChip(
                    label: 'Căng thẳng',
                    scenario: HrvScenario.moderateStress,
                    current: hrvService.currentScenario,
                    onSelected: () => hrvService.simulateScenario(HrvScenario.moderateStress),
                  ),
                  _buildScenarioChip(
                    label: 'Rung nhĩ (AFib)',
                    scenario: HrvScenario.afibRisk,
                    current: hrvService.currentScenario,
                    onSelected: () => hrvService.simulateScenario(HrvScenario.afibRisk),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildMetricTile({
    required String label,
    required String value,
    required String subLabel,
    required bool highlight,
    required Color riskColor,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
      decoration: BoxDecoration(
        color: highlight ? riskColor.withValues(alpha: 0.15) : Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: highlight ? riskColor.withValues(alpha: 0.4) : Colors.white10,
        ),
      ),
      child: Column(
        children: [
          Text(
            label,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.65),
              fontSize: 10,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            style: TextStyle(
              color: highlight ? riskColor : Colors.white,
              fontSize: 12.5,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            subLabel,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.45),
              fontSize: 9,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildScenarioChip({
    required String label,
    required HrvScenario scenario,
    required HrvScenario current,
    required VoidCallback onSelected,
  }) {
    final isSelected = scenario == current;
    return InkWell(
      onTap: onSelected,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF38BDF8).withValues(alpha: 0.25) : Colors.white.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected ? const Color(0xFF38BDF8) : Colors.white12,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? const Color(0xFF38BDF8) : Colors.white70,
            fontSize: 10.5,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ),
    );
  }
}

/// Bảng vẽ đồ thị phân tán chuỗi xung R-R (Tachogram)
class _TachogramPainter extends CustomPainter {
  _TachogramPainter({required this.intervals, required this.lineColor});

  final List<int> intervals;
  final Color lineColor;

  @override
  void paint(Canvas canvas, Size size) {
    if (intervals.length < 2) return;

    final minVal = intervals.reduce((a, b) => a < b ? a : b).toDouble();
    final maxVal = intervals.reduce((a, b) => a > b ? a : b).toDouble();
    final range = (maxVal - minVal) > 0 ? (maxVal - minVal) : 100.0;

    final paint = Paint()
      ..color = lineColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0
      ..strokeCap = StrokeCap.round;

    final fillPaint = Paint()
      ..color = lineColor.withValues(alpha: 0.15)
      ..style = PaintingStyle.fill;

    final path = Path();
    final fillPath = Path();

    final stepX = size.width / (intervals.length - 1);

    for (int i = 0; i < intervals.length; i++) {
      final normY = 1.0 - ((intervals[i] - minVal) / range).clamp(0.0, 1.0);
      final x = i * stepX;
      final y = 4.0 + (normY * (size.height - 8.0));

      if (i == 0) {
        path.moveTo(x, y);
        fillPath.moveTo(x, size.height);
        fillPath.lineTo(x, y);
      } else {
        path.lineTo(x, y);
        fillPath.lineTo(x, y);
      }

      // Điểm mốc đỉnh
      canvas.drawCircle(Offset(x, y), 2.2, Paint()..color = lineColor);
    }

    fillPath.lineTo(size.width, size.height);
    fillPath.close();

    canvas.drawPath(fillPath, fillPaint);
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _TachogramPainter oldDelegate) {
    return oldDelegate.intervals != intervals || oldDelegate.lineColor != lineColor;
  }
}

/// Modal tầm soát đột quỵ cấp F.A.S.T theo chuẩn Bộ Y tế
class _FastScreeningModal extends StatefulWidget {
  const _FastScreeningModal({required this.assessment});
  final StrokeCardiacRiskAssessment assessment;

  @override
  State<_FastScreeningModal> createState() => _FastScreeningModalState();
}

class _FastScreeningModalState extends State<_FastScreeningModal> {
  bool _faceDrop = false;
  bool _armWeakness = false;
  bool _speechDifficulty = false;

  Future<void> _call115() async {
    final uri = Uri.parse('tel:115');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dangerCount = (_faceDrop ? 1 : 0) + (_armWeakness ? 1 : 0) + (_speechDifficulty ? 1 : 0);

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
      decoration: const BoxDecoration(
        color: Color(0xFF0F172A),
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
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
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFEF4444).withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.medical_services_rounded, color: Color(0xFFEF4444), size: 24),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Bảng Tầm Soát Đột Quỵ F.A.S.T',
                      style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      'Quy chuẩn Quốc tế & Bộ Y tế Việt Nam',
                      style: TextStyle(color: Colors.white54, fontSize: 11.5),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Text(
            'Hãy tự kiểm tra hoặc nhờ người xung quanh quan sát 3 dấu hiệu sau:',
            style: TextStyle(color: Colors.white70, fontSize: 12.5),
          ),
          const SizedBox(height: 12),

          // F - FACE
          _buildCheckTile(
            code: 'F - FACE (Mặt)',
            title: 'Cười hoặc nhe răng: Miệng có bị méo hoặc nhân trung lệch?',
            value: _faceDrop,
            onChanged: (v) => setState(() => _faceDrop = v ?? false),
          ),
          // A - ARMS
          _buildCheckTile(
            code: 'A - ARMS (Tay)',
            title: 'Giơ đều 2 tay lên cao: Một bên tay có bị rũ xuống hoặc yếu?',
            value: _armWeakness,
            onChanged: (v) => setState(() => _armWeakness = v ?? false),
          ),
          // S - SPEECH
          _buildCheckTile(
            code: 'S - SPEECH (Lời nói)',
            title: 'Lặp lại một câu đơn giản: Giọng có bị ngọng, dính chữ, khó nói?',
            value: _speechDifficulty,
            onChanged: (v) => setState(() => _speechDifficulty = v ?? false),
          ),
          const SizedBox(height: 14),

          // T - TIME
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: dangerCount > 0 ? const Color(0xFFEF4444).withValues(alpha: 0.2) : Colors.white.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: dangerCount > 0 ? const Color(0xFFEF4444) : Colors.white12,
              ),
            ),
            child: Row(
              children: [
                Icon(
                  dangerCount > 0 ? Icons.warning_amber_rounded : Icons.access_time_rounded,
                  color: dangerCount > 0 ? const Color(0xFFEF4444) : const Color(0xFF38BDF8),
                  size: 24,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'T - TIME (Thời gian vàng cấp cứu: 3 - 4.5 giờ)',
                        style: TextStyle(
                          color: dangerCount > 0 ? const Color(0xFFEF4444) : Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        dangerCount > 0
                            ? 'Xác nhận có $dangerCount dấu hiệu nghi ngờ đột quỵ! Cần gọi ngay 115 hoặc đưa tới bệnh viện có khoa đột quỵ gần nhất!'
                            : 'Nếu có bất kỳ 1 trong 3 dấu hiệu trên, mỗi phút trôi qua 2 triệu tế bào não sẽ chết đi.',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.75),
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),

          // Nút bấm gọi 115 ngay lập tức
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFEF4444),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: _call115,
              icon: const Icon(Icons.phone_in_talk_rounded),
              label: const Text(
                'GỌI CẤP CỨU 115 NGAY LẬP TỨC',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCheckTile({
    required String code,
    required String title,
    required bool value,
    required ValueChanged<bool?> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: InkWell(
        onTap: () => onChanged(!value),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: value ? const Color(0xFFEF4444).withValues(alpha: 0.15) : Colors.white.withValues(alpha: 0.04),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: value ? const Color(0xFFEF4444).withValues(alpha: 0.5) : Colors.white10,
            ),
          ),
          child: Row(
            children: [
              Checkbox(
                value: value,
                onChanged: onChanged,
                activeColor: const Color(0xFFEF4444),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      code,
                      style: TextStyle(
                        color: value ? const Color(0xFFEF4444) : const Color(0xFF38BDF8),
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 1),
                    Text(
                      title,
                      style: const TextStyle(color: Colors.white, fontSize: 11.5),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
