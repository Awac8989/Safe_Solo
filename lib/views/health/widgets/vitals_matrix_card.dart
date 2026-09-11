import 'package:flutter/material.dart';

/// ============================================================================
/// SAFESOLO - MA TRẬN CHỈ SỐ SINH TỒN BIOACTIVE & ĐIỂM SỐ AN TOÀN (0-100)
/// Lấy cảm hứng từ Samsung Health BioActive Sensors & Whoop Recovery Index
/// ============================================================================
class VitalsMatrixCard extends StatefulWidget {
  const VitalsMatrixCard({
    super.key,
    required this.heartRate,
    required this.spO2,
    required this.currentSvmG,
    required this.currentTiltAngle,
    required this.isOffWrist,
    this.isMeasuring = false,
    this.onMeasureNow,
    this.onViewWearableDetails,
  });

  final int heartRate;
  final int spO2;
  final double currentSvmG;
  final double currentTiltAngle;
  final bool isOffWrist;
  final bool isMeasuring;
  final VoidCallback? onMeasureNow;
  final VoidCallback? onViewWearableDetails;

  @override
  State<VitalsMatrixCard> createState() => _VitalsMatrixCardState();
}

class _VitalsMatrixCardState extends State<VitalsMatrixCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  /// Tính điểm số an toàn sinh tồn tổng hợp (0 - 100)
  int _calculateSafetyScore() {
    int score = 100;
    // Nhịp tim lý tưởng: 60 - 95 bpm
    if (widget.heartRate > 100) {
      score -= ((widget.heartRate - 100) * 1.5).toInt().clamp(0, 30);
    } else if (widget.heartRate < 55) {
      score -= ((55 - widget.heartRate) * 2).toInt().clamp(0, 30);
    }

    // SpO2 lý tưởng: >= 95%
    if (widget.spO2 < 95) {
      score -= ((95 - widget.spO2) * 5).clamp(0, 40);
    }

    // Nếu tháo đồng hồ
    if (widget.isOffWrist) {
      score -= 10;
    }

    return score.clamp(35, 100);
  }

  @override
  Widget build(BuildContext context) {
    final safetyScore = _calculateSafetyScore();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 1. THẺ ĐIỂM SỐ AN TOÀN SINH TỒN SAFESOLO (HEALTH & SAFETY SCORE)
        _buildSafetyScoreCard(safetyScore),
        const SizedBox(height: 16),

        // 2. LƯỚI THẺ CHỈ SỐ SINH TỒN (NHỊP TIM PPG & SPO2)
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Thẻ Nhịp tim BioActive PPG
            Expanded(
              child: _buildHeartRateCard(),
            ),
            const SizedBox(width: 12),
            // Thẻ Nồng độ Oxy máu SpO2
            Expanded(
              child: _buildSpO2Card(),
            ),
          ],
        ),
        const SizedBox(height: 12),

        // 3. THẺ CẢM BIẾN GIA TỐC VÀ CHỐNG TÉ NGÃ (IMU FALL GUARD)
        _buildImuMotionCard(),
      ],
    );
  }

  /// Thẻ điểm số an toàn sinh tồn SafeSolo (0 - 100)
  Widget _buildSafetyScoreCard(int score) {
    Color scoreColor;
    String scoreStatus;
    String scoreDesc;

    if (score >= 90) {
      scoreColor = const Color(0xFF10B981);
      scoreStatus = 'TỐI ƯU · AN TOÀN CAO';
      scoreDesc = 'Chỉ số sinh tồn và nhịp tim đạt chuẩn y tế tuyệt vời.';
    } else if (score >= 75) {
      scoreColor = const Color(0xFF38BDF8);
      scoreStatus = 'TỐT · BÌNH THƯỜNG';
      scoreDesc = 'Trạng thái cơ thể ổn định, không có dấu hiệu bất thường.';
    } else if (score >= 60) {
      scoreColor = const Color(0xFFF59E0B);
      scoreStatus = 'CẦN THEO DÕI';
      scoreDesc = 'Nhịp tim hoặc Oxy máu có dao động nhẹ, chú ý nghỉ ngơi.';
    } else {
      scoreColor = const Color(0xFFEF4444);
      scoreStatus = 'CẢNH BÁO';
      scoreDesc = 'Phát hiện chỉ số sinh tồn vượt ngưỡng an toàn quy định.';
    }

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            const Color(0xFF0F172A),
            scoreColor.withValues(alpha: 0.15),
            const Color(0xFF1E293B),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: scoreColor.withValues(alpha: 0.4), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: scoreColor.withValues(alpha: 0.12),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              // Vòng tròn điểm số với hiệu ứng phát sáng
              Stack(
                alignment: Alignment.center,
                children: [
                  SizedBox(
                    width: 72,
                    height: 72,
                    child: CircularProgressIndicator(
                      value: score / 100,
                      strokeWidth: 7,
                      backgroundColor: Colors.white.withValues(alpha: 0.1),
                      valueColor: AlwaysStoppedAnimation<Color>(scoreColor),
                      strokeCap: StrokeCap.round,
                    ),
                  ),
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '$score',
                        style: TextStyle(
                          color: scoreColor,
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          height: 1.0,
                        ),
                      ),
                      const Text(
                        '/100',
                        style: TextStyle(color: Colors.white38, fontSize: 10),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(width: 18),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: scoreColor.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: scoreColor.withValues(alpha: 0.5)),
                      ),
                      child: Text(
                        scoreStatus,
                        style: TextStyle(
                          color: scoreColor,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.8,
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Chỉ số Sinh tồn SafeSolo',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      scoreDesc,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.7),
                        fontSize: 12,
                        height: 1.3,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Divider(color: Colors.white12, height: 1),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildMiniStatusChip(
                icon: Icons.favorite_rounded,
                label: '${widget.heartRate} bpm',
                color: const Color(0xFFF43F5E),
              ),
              _buildMiniStatusChip(
                icon: Icons.bloodtype_rounded,
                label: '${widget.spO2}% SpO2',
                color: const Color(0xFF06B6D4),
              ),
              _buildMiniStatusChip(
                icon: Icons.shield_rounded,
                label: widget.isOffWrist ? 'Đã tháo tay' : 'Đang đeo',
                color: widget.isOffWrist ? const Color(0xFFF59E0B) : const Color(0xFF10B981),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMiniStatusChip({
    required IconData icon,
    required String label,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 14),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  /// Thẻ Nhịp tim PPG kèm sóng đồ thị xung đập ECG
  Widget _buildHeartRateCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF161F30),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF43F5E).withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              ScaleTransition(
                scale: Tween<double>(begin: 0.85, end: 1.15).animate(_pulseController),
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF43F5E).withValues(alpha: 0.2),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.favorite_rounded, color: Color(0xFFF43F5E), size: 16),
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                'NHỊP TIM PPG',
                style: TextStyle(
                  color: Color(0xFF94A3B8),
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.0,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                '${widget.heartRate}',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  fontFamily: 'monospace',
                ),
              ),
              const SizedBox(width: 6),
              const Text(
                'BPM',
                style: TextStyle(color: Color(0xFFF43F5E), fontSize: 12, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 10),
          // Sóng đồ thị nhịp tim minh họa
          SizedBox(
            height: 28,
            width: double.infinity,
            child: CustomPaint(
              painter: _HeartRateWaveformPainter(color: const Color(0xFFF43F5E)),
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Nhịp xoang đều · 62-98 hôm nay',
            style: TextStyle(color: Colors.white54, fontSize: 10),
          ),
        ],
      ),
    );
  }

  /// Thẻ Nồng độ Oxy máu SpO2
  Widget _buildSpO2Card() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF161F30),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF06B6D4).withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: const Color(0xFF06B6D4).withValues(alpha: 0.2),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.bloodtype_rounded, color: Color(0xFF06B6D4), size: 16),
              ),
              const SizedBox(width: 8),
              const Text(
                'OXY MÁU SpO2',
                style: TextStyle(
                  color: Color(0xFF94A3B8),
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.0,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                '${widget.spO2}',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  fontFamily: 'monospace',
                ),
              ),
              const SizedBox(width: 4),
              const Text(
                '%',
                style: TextStyle(color: Color(0xFF06B6D4), fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 10),
          // Thước đo SpO2 phân cấp màu
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: Row(
              children: [
                Expanded(
                  flex: 10,
                  child: Container(height: 6, color: const Color(0xFFEF4444)),
                ),
                const SizedBox(width: 2),
                Expanded(
                  flex: 5,
                  child: Container(height: 6, color: const Color(0xFFF59E0B)),
                ),
                const SizedBox(width: 2),
                Expanded(
                  flex: 85,
                  child: Container(height: 6, color: const Color(0xFF10B981)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            widget.spO2 >= 95 ? 'Bão hòa tối ưu (95-100%)' : 'Dưới mức khuyến cáo',
            style: TextStyle(
              color: widget.spO2 >= 95 ? const Color(0xFF34D399) : const Color(0xFFF87171),
              fontSize: 10,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  /// Thẻ Cảm biến gia tốc MEMS và An toàn té ngã (IMU Fall Guard)
  Widget _buildImuMotionCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF161F30),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF38BDF8).withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFF38BDF8).withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.screen_rotation_rounded, color: Color(0xFF38BDF8), size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Text(
                      'CẢM BIẾN GIA TỐC & TÉ NGÃ',
                      style: TextStyle(
                        color: Color(0xFF94A3B8),
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.8,
                      ),
                    ),
                    Spacer(),
                    Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 14),
                    SizedBox(width: 4),
                    Text(
                      'Bảo vệ 24/7',
                      style: TextStyle(color: Color(0xFF10B981), fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  'Gia tốc trọng trường: ${widget.currentSvmG.toStringAsFixed(2)}g · Góc nghiêng: ${widget.currentTiltAngle.toStringAsFixed(1)}°',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          if (widget.onMeasureNow != null) ...[
            const SizedBox(width: 8),
            IconButton(
              tooltip: 'Đo nhịp tim tức thời',
              onPressed: widget.isMeasuring ? null : widget.onMeasureNow,
              icon: widget.isMeasuring
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF38BDF8)),
                    )
                  : const Icon(Icons.play_circle_fill_rounded, color: Color(0xFF38BDF8), size: 28),
            ),
          ],
        ],
      ),
    );
  }
}

/// Painter vẽ dạng sóng ECG biểu thị xung nhịp tim đập
class _HeartRateWaveformPainter extends CustomPainter {
  _HeartRateWaveformPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final path = Path();
    final midY = size.height * 0.6;
    final w = size.width;

    path.moveTo(0, midY);
    path.lineTo(w * 0.2, midY);
    path.lineTo(w * 0.3, midY - 3);
    path.lineTo(w * 0.35, midY + 4);
    path.lineTo(w * 0.42, midY);
    path.lineTo(w * 0.48, midY);
    // Đỉnh sóng nhọn QRS
    path.lineTo(w * 0.54, midY - 14);
    path.lineTo(w * 0.60, midY + 8);
    path.lineTo(w * 0.66, midY);
    path.lineTo(w * 0.74, midY);
    // Sóng T tròn
    path.quadraticBezierTo(w * 0.82, midY - 6, w * 0.90, midY);
    path.lineTo(w, midY);

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _HeartRateWaveformPainter oldDelegate) =>
      oldDelegate.color != color;
}
