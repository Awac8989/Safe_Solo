import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/widgets/top_toast.dart';
import '../../services/fast_assessment_service.dart';

/// ============================================================================
/// SAFESOLO - HỘP THOẠI KIỂM TRA ĐỘT QUỴ F.A.S.T TOÀN DIỆN THỊ GIÁC & GIỌNG NÓI
/// (F.A.S.T Full-Spectrum Vision & Speech AI Assessment Dialog)
///
/// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03
/// Phục vụ: Tự kiểm tra hoặc hỗ trợ người xung quanh đánh giá nhanh 3 dấu hiệu:
/// Face (Quét cơ mặt), Arm (Rơi tay 10s), Speech (Phân tích giọng nói), Time (Mốc Giờ Vàng 4.5h)
/// ============================================================================

class FastAiAssessmentDialog extends StatefulWidget {
  const FastAiAssessmentDialog({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => const FastAiAssessmentDialog(),
    );
  }

  @override
  State<FastAiAssessmentDialog> createState() => _FastAiAssessmentDialogState();
}

class _FastAiAssessmentDialogState extends State<FastAiAssessmentDialog>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController =
      TabController(length: 4, vsync: this);
  Timer? _tickerTimer;

  @override
  void initState() {
    super.initState();
    FastAssessmentService.instance.addListener(_onServiceUpdate);
    // Timer cập nhật đếm ngược Mốc Giờ Vàng mỗi giây
    _tickerTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  void _onServiceUpdate() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    FastAssessmentService.instance.removeListener(_onServiceUpdate);
    _tickerTimer?.cancel();
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final service = FastAssessmentService.instance;
    final result = service.currentResult;
    final size = MediaQuery.of(context).size;

    return Container(
      height: size.height * 0.88,
      decoration: const BoxDecoration(
        color: Color(0xFF0A0F1D),
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        children: [
          // THANH KÉO (DRAG HANDLE)
          const SizedBox(height: 12),
          Container(
            width: 44,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.white24,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 12),

          // TIÊU ĐỀ & ĐIỂM CPSS TỔNG HỢP
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: result.riskColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: result.riskColor.withValues(alpha: 0.35),
                    ),
                  ),
                  child: Icon(
                    Icons.psychology_alt_rounded,
                    color: result.riskColor,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Flexible(
                            child: Text(
                              'ĐỘT PHÁ 2: F.A.S.T AI CHECK',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.6,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: result.riskColor.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              '${result.positiveCount}/3 Dấu hiệu',
                              style: TextStyle(
                                color: result.riskColor,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Kiểm tra Thị giác, Giọng nói & Mốc Giờ Vàng (CPSS)',
                        style: const TextStyle(
                          color: Color(0xFF94A3B8),
                          fontSize: 11,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, color: Colors.white70),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // TAB BAR F - A - S - T
          TabBar(
            controller: _tabController,
            indicatorColor: result.riskColor,
            indicatorWeight: 3,
            labelColor: result.riskColor,
            unselectedLabelColor: const Color(0xFF94A3B8),
            labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
            tabs: [
              Tab(
                icon: const Icon(Icons.face_retouching_natural_rounded, size: 20),
                text: 'F - Mặt (${service.isFaceDroopPositive ? "⚠️" : "✓"})',
              ),
              Tab(
                icon: const Icon(Icons.front_hand_rounded, size: 20),
                text: 'A - Tay (${service.isArmWeaknessPositive ? "⚠️" : "✓"})',
              ),
              Tab(
                icon: const Icon(Icons.record_voice_over_rounded, size: 20),
                text: 'S - Giọng (${service.isSpeechImpairedPositive ? "⚠️" : "✓"})',
              ),
              Tab(
                icon: const Icon(Icons.timer_rounded, size: 20),
                text: 'T - Cấp cứu (${result.positiveCount})',
              ),
            ],
          ),

          // TAB CONTENT
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildFaceTab(service),
                _buildArmTab(service),
                _buildSpeechTab(service),
                _buildTimeTriageTab(service, result),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // TAB 1: F - FACE DROOPING (THỊ GIÁC QUÉT CƠ MẶT)
  // ===========================================================================

  Widget _buildFaceTab(FastAssessmentService service) {
    final hasPhoto = service.facePhotoPath != null;

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        // Khung quét khuôn mặt
        Center(
          child: Container(
            width: 220,
            height: 220,
            decoration: BoxDecoration(
              color: const Color(0xFF131D35),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: service.isFaceDroopPositive
                    ? const Color(0xFFEF4444)
                    : const Color(0xFF38EF7D),
                width: 2,
              ),
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                if (hasPhoto)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(22),
                    child: Image.file(
                      File(service.facePhotoPath!),
                      width: 220,
                      height: 220,
                      fit: BoxFit.cover,
                    ),
                  )
                else
                  Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.face_retouching_natural_rounded,
                        size: 64,
                        color: Colors.white.withValues(alpha: 0.3),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Chưa chụp ảnh selfie',
                        style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                      ),
                    ],
                  ),

                // Lưới Landmark định vị cơ mặt
                Positioned.fill(
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(22),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.15),
                        width: 1,
                      ),
                    ),
                    child: CustomPaint(
                      painter: _FaceLandmarkOverlayPainter(
                        isDroop: service.isFaceDroopPositive,
                      ),
                    ),
                  ),
                ),

                if (service.isFaceScanning)
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.black54,
                      borderRadius: BorderRadius.circular(22),
                    ),
                    child: const Center(
                      child: CircularProgressIndicator(color: Color(0xFF38EF7D)),
                    ),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),

        // Nút chụp ảnh Camera Trước
        ElevatedButton.icon(
          onPressed: () async {
            final ok = await service.captureAndAnalyzeFaceSelfie();
            if (ok && mounted) {
              TopToast.show(
                context,
                message: 'Đã phân tích đối xứng cơ mặt selfie!',
                icon: Icons.check_circle_rounded,
              );
            }
          },
          icon: const Icon(Icons.camera_alt_rounded),
          label: const Text(
            '📸 Chụp Ảnh Selfie & Quét Độ Lệch Cơ Mặt',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF2563EB),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
        const SizedBox(height: 14),

        // Thẻ kết quả phân tích
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFF131D35),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: service.isFaceDroopPositive
                  ? const Color(0xFFEF4444).withValues(alpha: 0.4)
                  : const Color(0xFF38EF7D).withValues(alpha: 0.2),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Chỉ số Đối xứng Cơ Mặt (FSI):',
                    style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                  ),
                  Text(
                    '${(service.faceSymmetryScore * 100).toStringAsFixed(0)}% (Ngưỡng >= 70%)',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: service.isFaceDroopPositive
                          ? const Color(0xFFEF4444)
                          : const Color(0xFF38EF7D),
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              LinearProgressIndicator(
                value: service.faceSymmetryScore,
                backgroundColor: Colors.white12,
                valueColor: AlwaysStoppedAnimation<Color>(
                  service.isFaceDroopPositive
                      ? const Color(0xFFEF4444)
                      : const Color(0xFF38EF7D),
                ),
                borderRadius: BorderRadius.circular(4),
              ),
              const SizedBox(height: 10),
              Text(
                service.faceAnalysisNotes,
                style: TextStyle(
                  fontSize: 12.5,
                  color: service.isFaceDroopPositive
                      ? const Color(0xFFFCA5A5)
                      : Colors.white70,
                  height: 1.35,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Khối Mô phỏng Thao trường Hội đồng (1-Click Simulation)
        _buildSimulationBar(
          title: 'Mô phỏng Trình diễn Hội đồng (Face)',
          isPositive: service.isFaceDroopPositive,
          positiveLabel: '🧪 Giả lập: Lệch cơ miệng phải (56%)',
          negativeLabel: '✅ Bình thường: Cân xứng (94%)',
          onPositiveTap: () => service.simulateFaceDroop(isDroop: true),
          onNegativeTap: () => service.simulateFaceDroop(isDroop: false),
        ),
      ],
    );
  }

  // ===========================================================================
  // TAB 2: A - ARM WEAKNESS (10S PRONATOR DRIFT)
  // ===========================================================================

  Widget _buildArmTab(FastAssessmentService service) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        // Minh họa tư thế Pronator Drift
        Center(
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: const Color(0xFF131D35),
              shape: BoxShape.circle,
              border: Border.all(
                color: service.isArmWeaknessPositive
                    ? const Color(0xFFEF4444)
                    : const Color(0xFF38EF7D),
                width: 2,
              ),
            ),
            child: Icon(
              Icons.pan_tool_alt_rounded,
              size: 64,
              color: service.isArmWeaknessPositive
                  ? const Color(0xFFEF4444)
                  : const Color(0xFF38EF7D),
            ),
          ),
        ),
        const SizedBox(height: 16),

        const Text(
          'Bài test Y khoa: 10 Giây Nhắm Mắt Giơ 2 Tay (Pronator Drift)',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: Colors.white,
            fontSize: 14,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 6),
        const Text(
          'Giơ thẳng 2 tay song song ngang vai, lật ngửa lòng bàn tay và nhắm mắt trong 10 giây. Cảm biến gia tốc kế (Watch 5 + Điện thoại) sẽ đo độ chìm trôi bất đối xứng.',
          textAlign: TextAlign.center,
          style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12, height: 1.35),
        ),
        const SizedBox(height: 18),

        // Nút thực hiện bài test 10 giây
        if (service.isArmTesting)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFF59E0B)),
            ),
            child: Column(
              children: [
                Text(
                  '${service.armCountdownSeconds} GIÂY',
                  style: const TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFFF59E0B),
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Giữ yên 2 tay ngang vai, nhắm mắt...',
                  style: TextStyle(color: Colors.white70, fontSize: 12),
                ),
                const SizedBox(height: 10),
                TextButton(
                  onPressed: service.cancelArmDriftTest,
                  child: const Text('Hủy bài test', style: TextStyle(color: Colors.white60)),
                ),
              ],
            ),
          )
        else
          ElevatedButton.icon(
            onPressed: () {
              HapticFeedback.heavyImpact();
              service.startArmDriftTest(onCompleted: () {
                if (mounted) {
                  TopToast.show(
                    context,
                    message: 'Hoàn thành bài kiểm tra cơ lực 10s!',
                    icon: Icons.check_circle_rounded,
                  );
                }
              });
            },
            icon: const Icon(Icons.play_arrow_rounded, size: 24),
            label: const Text(
              '⏳ Bắt Đầu Đếm Ngược Đo Cơ Lực 10s',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF10B981),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        const SizedBox(height: 14),

        // Thẻ kết quả cơ lực
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFF131D35),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: service.isArmWeaknessPositive
                  ? const Color(0xFFEF4444).withValues(alpha: 0.4)
                  : const Color(0xFF38EF7D).withValues(alpha: 0.2),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Độ Lệch BMAI Cảm biến 2 Cổ tay:',
                    style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                  ),
                  Text(
                    '${service.armAsymmetryScore.toStringAsFixed(2)}g',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: service.isArmWeaknessPositive
                          ? const Color(0xFFEF4444)
                          : const Color(0xFF38EF7D),
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                service.armAnalysisNotes,
                style: TextStyle(
                  fontSize: 12.5,
                  color: service.isArmWeaknessPositive
                      ? const Color(0xFFFCA5A5)
                      : Colors.white70,
                  height: 1.35,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Khối Mô phỏng Hội đồng
        _buildSimulationBar(
          title: 'Mô phỏng Trình diễn Hội đồng (Arm)',
          isPositive: service.isArmWeaknessPositive,
          positiveLabel: '🧪 Giả lập: Rơi tay phải (0.84g)',
          negativeLabel: '✅ Bình thường: Giữ vững (0.12g)',
          onPositiveTap: () => service.simulateArmDrift(isWeak: true),
          onNegativeTap: () => service.simulateArmDrift(isWeak: false),
        ),
      ],
    );
  }

  // ===========================================================================
  // TAB 3: S - SPEECH DIFFICULTY (PHÂN TÍCH ÂM PHỔ GIỌNG NÓI)
  // ===========================================================================

  Widget _buildSpeechTab(FastAssessmentService service) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        // Câu mẫu kiểm tra y khoa
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFF38EF7D).withValues(alpha: 0.3)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: const [
                  Icon(Icons.mic_rounded, color: Color(0xFF38EF7D), size: 18),
                  SizedBox(width: 8),
                  Text(
                    'CÂU MẪU ĐÁNH GIÁ PHÁT ÂM TIẾNG VIỆT:',
                    style: TextStyle(
                      color: Color(0xFF38EF7D),
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              const Text(
                '“Trời hôm nay nhiều mây nhưng không có mưa”',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                  fontStyle: FontStyle.italic,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Hoặc: “Bà Ba béo bán bánh bèo bên bờ biển”',
                style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Nút Ghi âm & Phân tích âm phổ
        ElevatedButton.icon(
          onPressed: () async {
            if (service.isSpeechRecording) {
              await service.stopSpeechRecordingAndAnalyze();
              if (mounted) {
                TopToast.show(
                  context,
                  message: 'Đã hoàn tất phân tích âm phổ giọng nói!',
                  icon: Icons.check_circle_rounded,
                );
              }
            } else {
              final ok = await service.startSpeechRecording();
              if (ok && mounted) {
                TopToast.show(
                  context,
                  message: 'Đang ghi âm câu nói... Hãy đọc câu mẫu!',
                  icon: Icons.mic_rounded,
                );
              }
            }
          },
          icon: Icon(
            service.isSpeechRecording
                ? Icons.stop_circle_rounded
                : Icons.mic_rounded,
            color: Colors.white,
          ),
          label: Text(
            service.isSpeechRecording
                ? '⏹️ DỪNG GHI ÂM & PHÂN TÍCH ÂM PHỔ'
                : '🎙️ BẮT ĐẦU NÓI CÂU MẪU',
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: service.isSpeechRecording
                ? const Color(0xFFEF4444)
                : const Color(0xFF8B5CF6),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
        const SizedBox(height: 14),

        // Thẻ kết quả giọng nói
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFF131D35),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: service.isSpeechImpairedPositive
                  ? const Color(0xFFEF4444).withValues(alpha: 0.4)
                  : const Color(0xFF38EF7D).withValues(alpha: 0.2),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Độ Rõ Nét Âm Tiết (Clarity Index):',
                    style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                  ),
                  Text(
                    '${(service.speechClarityScore * 100).toStringAsFixed(0)}%',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: service.isSpeechImpairedPositive
                          ? const Color(0xFFEF4444)
                          : const Color(0xFF38EF7D),
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              LinearProgressIndicator(
                value: service.speechClarityScore,
                backgroundColor: Colors.white12,
                valueColor: AlwaysStoppedAnimation<Color>(
                  service.isSpeechImpairedPositive
                      ? const Color(0xFFEF4444)
                      : const Color(0xFF38EF7D),
                ),
                borderRadius: BorderRadius.circular(4),
              ),
              const SizedBox(height: 10),
              Text(
                service.speechAnalysisNotes,
                style: TextStyle(
                  fontSize: 12.5,
                  color: service.isSpeechImpairedPositive
                      ? const Color(0xFFFCA5A5)
                      : Colors.white70,
                  height: 1.35,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Khối Mô phỏng Hội đồng
        _buildSimulationBar(
          title: 'Mô phỏng Trình diễn Hội đồng (Speech)',
          isPositive: service.isSpeechImpairedPositive,
          positiveLabel: '🧪 Giả lập: Rối loạn phát âm / Líu lưỡi',
          negativeLabel: '✅ Bình thường: Phát âm rành mạch',
          onPositiveTap: () => service.simulateSpeechImpairment(isImpaired: true),
          onNegativeTap: () => service.simulateSpeechImpairment(isImpaired: false),
        ),
      ],
    );
  }

  // ===========================================================================
  // TAB 4: T - TIME & TRIAGE (MỐC GIỜ VÀNG 4.5H & GỌI CẤP CỨU 115)
  // ===========================================================================

  Widget _buildTimeTriageTab(
    FastAssessmentService service,
    FastAssessmentResult result,
  ) {
    final remaining = result.remainingGoldenWindow;
    final hours = remaining.inHours.toString().padLeft(2, '0');
    final mins = (remaining.inMinutes % 60).toString().padLeft(2, '0');
    final secs = (remaining.inSeconds % 60).toString().padLeft(2, '0');

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        // Đồng hồ đếm ngược Giờ Vàng
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: const Color(0xFF131D35),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: result.riskColor.withValues(alpha: 0.4),
              width: 1.5,
            ),
          ),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.hourglass_top_rounded, color: result.riskColor, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'CỬA SỔ MỐC GIỜ VÀNG (GOLDEN WINDOW)',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.8,
                      color: result.riskColor,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                '$hours : $mins : $secs',
                style: TextStyle(
                  fontSize: 38,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 2,
                  color: result.riskColor,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Mốc 4.5 giờ từ khi khởi phát: Cửa sổ vàng quyết định can thiệp tiêu sợi huyết tĩnh mạch (rtPA) hoặc lấy huyết khối cơ học bảo tồn não.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 11.5, color: Color(0xFFCBD5E1), height: 1.35),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Bảng kết quả tổng hợp Cincinnati (CPSS)
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'KẾT QUẢ ĐÁNH GIÁ LÂM SÀNG CINCINNATI (CPSS):',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: Colors.white.withValues(alpha: 0.6),
                ),
              ),
              const SizedBox(height: 12),
              _buildCpssCheckRow(
                letter: 'F',
                title: 'Khuôn mặt (Face Droop)',
                isPositive: service.isFaceDroopPositive,
                statusText: service.isFaceDroopPositive
                    ? 'DƯƠNG TÍNH (Lệch cơ méo miệng)'
                    : 'Âm tính (Cân đối)',
              ),
              const Divider(color: Colors.white12, height: 16),
              _buildCpssCheckRow(
                letter: 'A',
                title: 'Cơ lực tay (Arm Weakness)',
                isPositive: service.isArmWeaknessPositive,
                statusText: service.isArmWeaknessPositive
                    ? 'DƯƠNG TÍNH (Rơi tay Pronator Drift)'
                    : 'Âm tính (Giữ vững)',
              ),
              const Divider(color: Colors.white12, height: 16),
              _buildCpssCheckRow(
                letter: 'S',
                title: 'Giọng nói (Speech Difficulty)',
                isPositive: service.isSpeechImpairedPositive,
                statusText: service.isSpeechImpairedPositive
                    ? 'DƯƠNG TÍNH (Nói ngọng / Rối loạn)'
                    : 'Âm tính (Rõ ràng)',
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: result.riskColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: result.riskColor.withValues(alpha: 0.4),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      result.isStrokeSuspected
                          ? Icons.warning_rounded
                          : Icons.verified_user_rounded,
                      color: result.riskColor,
                      size: 22,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        result.cpssRiskLevelVi,
                        style: TextStyle(
                          color: result.riskColor,
                          fontWeight: FontWeight.w800,
                          fontSize: 12.5,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),

        // Nút Cấp cứu 115
        ElevatedButton.icon(
          onPressed: () async {
            HapticFeedback.heavyImpact();
            await service.call115();
          },
          icon: const Icon(Icons.phone_in_talk_rounded, size: 22),
          label: const Text(
            '🚨 GỌI CẤP CỨU 115 NGAY LẬP TỨC',
            style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFFEF4444),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
          ),
        ),
        const SizedBox(height: 10),

        // Nút Phát dữ liệu FAST Telemetry & Blackbox
        OutlinedButton.icon(
          onPressed: () async {
            await service.dispatchFastEmergencyTelemetry();
            if (mounted) {
              TopToast.show(
                context,
                message: 'Đã gửi gói tin FAST Telemetry đến Blackbox & Web Admin!',
                icon: Icons.send_rounded,
              );
            }
          },
          icon: const Icon(Icons.cloud_upload_rounded, color: Color(0xFF38EF7D)),
          label: const Text(
            '📡 Gửi FAST Telemetry Cho Bác Sĩ / Web Admin',
            style: TextStyle(
              color: Color(0xFF38EF7D),
              fontWeight: FontWeight.bold,
              fontSize: 13,
            ),
          ),
          style: OutlinedButton.styleFrom(
            side: const BorderSide(color: Color(0xFF38EF7D)),
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCpssCheckRow({
    required String letter,
    required String title,
    required bool isPositive,
    required String statusText,
  }) {
    final color = isPositive ? const Color(0xFFEF4444) : const Color(0xFF38EF7D);

    return Row(
      children: [
        Container(
          width: 26,
          height: 26,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.15),
            shape: BoxShape.circle,
            border: Border.all(color: color.withValues(alpha: 0.4)),
          ),
          child: Center(
            child: Text(
              letter,
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w900,
                fontSize: 12,
              ),
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 12.5,
                ),
              ),
              Text(
                statusText,
                style: TextStyle(
                  color: color,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
        Icon(
          isPositive ? Icons.error_rounded : Icons.check_circle_rounded,
          color: color,
          size: 20,
        ),
      ],
    );
  }

  Widget _buildSimulationBar({
    required String title,
    required bool isPositive,
    required String positiveLabel,
    required String negativeLabel,
    required VoidCallback onPositiveTap,
    required VoidCallback onNegativeTap,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.science_rounded, size: 16, color: Color(0xFF60A5FA)),
              const SizedBox(width: 6),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF94A3B8),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: InkWell(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    onPositiveTap();
                  },
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEF4444).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: isPositive
                            ? const Color(0xFFEF4444)
                            : const Color(0xFFEF4444).withValues(alpha: 0.3),
                        width: isPositive ? 1.5 : 1,
                      ),
                    ),
                    child: Center(
                      child: Text(
                        positiveLabel,
                        style: const TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFFEF4444),
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: InkWell(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    onNegativeTap();
                  },
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: !isPositive
                            ? const Color(0xFF10B981)
                            : const Color(0xFF10B981).withValues(alpha: 0.3),
                        width: !isPositive ? 1.5 : 1,
                      ),
                    ),
                    child: Center(
                      child: Text(
                        negativeLabel,
                        style: const TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF10B981),
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Painter vẽ đường lưới đối xứng cơ mặt
class _FaceLandmarkOverlayPainter extends CustomPainter {
  _FaceLandmarkOverlayPainter({required this.isDroop});
  final bool isDroop;

  @override
  void paint(Canvas canvas, Size size) {
    final paintLine = Paint()
      ..color = Colors.white.withValues(alpha: 0.3)
      ..strokeWidth = 1.0
      ..style = PaintingStyle.stroke;

    final paintAccent = Paint()
      ..color = (isDroop ? const Color(0xFFEF4444) : const Color(0xFF38EF7D))
          .withValues(alpha: 0.8)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;

    // Đường trung tuyến dọc sống mũi
    canvas.drawLine(
      Offset(size.width / 2, 20),
      Offset(size.width / 2, size.height - 20),
      paintLine,
    );

    // Đường ngang nối hai mắt
    canvas.drawLine(
      Offset(30, size.height * 0.38),
      Offset(size.width - 30, size.height * 0.38),
      paintLine,
    );

    // Đường ngang nối khóe miệng
    final mouthYLeft = size.height * 0.72;
    final mouthYRight = isDroop ? size.height * 0.78 : size.height * 0.72;

    canvas.drawLine(
      Offset(size.width * 0.32, mouthYLeft),
      Offset(size.width * 0.68, mouthYRight),
      paintAccent,
    );

    // Điểm mốc khóe môi
    final paintPoint = Paint()
      ..color = isDroop ? const Color(0xFFEF4444) : const Color(0xFF38EF7D)
      ..style = PaintingStyle.fill;

    canvas.drawCircle(Offset(size.width * 0.32, mouthYLeft), 4, paintPoint);
    canvas.drawCircle(Offset(size.width * 0.68, mouthYRight), 4, paintPoint);
  }

  @override
  bool shouldRepaint(covariant _FaceLandmarkOverlayPainter oldDelegate) =>
      oldDelegate.isDroop != isDroop;
}
