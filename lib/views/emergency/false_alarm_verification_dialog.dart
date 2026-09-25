import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_strings.dart';
import '../../core/providers/app_provider.dart';
import '../../core/widgets/top_toast.dart';
import '../../services/false_alarm_suppression_service.dart';

/// ============================================================================
/// SAFESOLO - HỘP THOẠI XÁC THỰC KHỬ BÁO ĐỘNG GIẢ ĐA TẦNG (TWO-PHASE GRACE MODAL)
/// Phục vụ: Đếm ngược 20 giây + Nhận diện phản hồi giọng nói rảnh tay tiếng Việt
/// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03
/// ============================================================================

class FalseAlarmVerificationDialog extends StatefulWidget {
  const FalseAlarmVerificationDialog({
    super.key,
    required this.incidentType,
    this.details,
    this.initialSeconds = 20,
  });

  final String incidentType;
  final String? details;
  final int initialSeconds;

  static Future<bool?> show(
    BuildContext context, {
    required String incidentType,
    String? details,
    int initialSeconds = 20,
  }) {
    return showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => FalseAlarmVerificationDialog(
        incidentType: incidentType,
        details: details,
        initialSeconds: initialSeconds,
      ),
    );
  }

  @override
  State<FalseAlarmVerificationDialog> createState() =>
      _FalseAlarmVerificationDialogState();
}

class _FalseAlarmVerificationDialogState
    extends State<FalseAlarmVerificationDialog> {
  final FalseAlarmSuppressionService _service =
      FalseAlarmSuppressionService.instance;

  String _lastVoiceTranscript = '';

  @override
  void initState() {
    super.initState();
    _service.addListener(_onServiceUpdate);
    _service.startGraceVerification(
      incidentType: widget.incidentType,
      details: widget.details,
      initialSeconds: widget.initialSeconds,
      onAutoEscalate: _handleEscalation,
    );
  }

  @override
  void dispose() {
    _service.removeListener(_onServiceUpdate);
    if (_service.state == VerificationState.graceCountdown) {
      _service.reset();
    }
    super.dispose();
  }

  void _onServiceUpdate() {
    if (!mounted) return;
    if (_service.state == VerificationState.suppressed) {
      Navigator.of(context, rootNavigator: true).pop(false);
      TopToast.show(
        context,
        message: 'Đã hủy cảnh báo. Báo động giả được triệt tiêu thành công!',
        icon: Icons.check_circle_outline_rounded,
      );
    } else if (_service.state == VerificationState.escalated) {
      _handleEscalation();
    } else {
      setState(() {});
    }
  }

  void _handleEscalation() {
    if (!mounted) return;
    context
        .read<AppProvider>()
        .simulateEmergencyStatus(status: 'ALERT_TRIGGERED');
    Navigator.of(context, rootNavigator: true).pop(true);
    TopToast.show(
      context,
      message: 'Hết thời gian chờ: Đã tự động kích hoạt Cứu hộ Khẩn cấp Cấp 3!',
      icon: Icons.warning_rounded,
    );
  }

  void _simulateVoiceInput(String spokenText) {
    setState(() {
      _lastVoiceTranscript = spokenText;
    });

    final handled = _service.evaluateVoiceResponse(spokenText);
    if (!handled && mounted) {
      TopToast.show(
        context,
        message: 'Chưa nhận diện được: "$spokenText". Hãy nói "Tôi ổn" hoặc bấm nút.',
        icon: Icons.mic_none_rounded,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    final remaining = _service.countdownSeconds;
    final progress =
        (remaining / widget.initialSeconds).clamp(0.0, 1.0);

    return PopScope(
      canPop: false,
      child: Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 24),
        child: Container(
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A), // Dark Clinical Navy
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: const Color(0xFFFF9800).withValues(alpha: 0.6),
              width: 1.8,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFFFF9800).withValues(alpha: 0.25),
                blurRadius: 30,
                spreadRadius: 2,
              ),
            ],
          ),
          padding: const EdgeInsets.all(22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Header Tag
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFF9800).withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: const Color(0xFFFF9800).withValues(alpha: 0.5),
                      ),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.shield_outlined,
                            size: 13, color: Color(0xFFFF9800)),
                        SizedBox(width: 5),
                        Text(
                          'CƠ CHẾ KHỬ BÁO ĐỘNG GIẢ ĐA TẦNG',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.8,
                            color: Color(0xFFFFB74D),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Title
              Text(
                strings.text(
                  'BẠN CÓ AN TOÀN KHÔNG?',
                  'ARE YOU SAFE?',
                ),
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                  letterSpacing: 0.5,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 4),
              Text(
                'SafeSolo vừa phát hiện: ${widget.incidentType}',
                style: const TextStyle(
                  fontSize: 12,
                  color: Color(0xFFFCA5A5),
                  fontWeight: FontWeight.w600,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),

              // VÒNG ĐẾM NGƯỢC RADIAL CIRCLE (20s)
              Stack(
                alignment: Alignment.center,
                children: [
                  SizedBox(
                    width: 130,
                    height: 130,
                    child: CircularProgressIndicator(
                      value: progress,
                      strokeWidth: 9,
                      backgroundColor: Colors.white12,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        remaining <= 5
                            ? const Color(0xFFEF4444)
                            : const Color(0xFFFF9800),
                      ),
                    ),
                  ),
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '$remaining',
                        style: TextStyle(
                          fontSize: 44,
                          fontWeight: FontWeight.w900,
                          color: remaining <= 5
                              ? const Color(0xFFEF4444)
                              : Colors.white,
                          height: 1.0,
                        ),
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'GIÂY',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF94A3B8),
                          letterSpacing: 1.0,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 18),

              // Hướng dẫn âm thanh
              const Text(
                'Hết thời gian đếm ngược mà không có phản hồi, hệ thống sẽ tự động phát tín hiệu cấp cứu tới Người bảo hộ và 115.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 11,
                  color: Color(0xFF94A3B8),
                  height: 1.35,
                ),
              ),
              const SizedBox(height: 16),

              // KHỐI LẮNG NGHE GIỌNG NÓI TIẾNG VIỆT
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: Colors.white12),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.mic_rounded,
                            color: Color(0xFF38BDF8), size: 16),
                        const SizedBox(width: 6),
                        Text(
                          _lastVoiceTranscript.isEmpty
                              ? 'ĐANG LẮNG NGHE GIỌNG NÓI RẢNH TAY...'
                              : 'ĐÃ NGHE: "$_lastVoiceTranscript"',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF38BDF8),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    // Các chip từ khóa mẫu để demo trước Hội đồng
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      alignment: WrapAlignment.center,
                      children: [
                        _buildVoiceChip(
                          text: '🗣️ "Tôi ổn"',
                          onTap: () => _simulateVoiceInput('Tôi ổn'),
                          isSafe: true,
                        ),
                        _buildVoiceChip(
                          text: '🗣️ "Nhầm rồi"',
                          onTap: () => _simulateVoiceInput('Nhầm rồi'),
                          isSafe: true,
                        ),
                        _buildVoiceChip(
                          text: '🗣️ "Cứu tôi với"',
                          onTap: () => _simulateVoiceInput('Cứu tôi với'),
                          isSafe: false,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),

              // 2 PHÍM BẤM XÁC THỰC LỚN
              // Nút 1: TÔI ỔN (HỦY BÁO ĐỘNG)
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => _service.cancelAsFalseAlarm(
                    reason: 'Người dùng bấm phím "TÔI ỔN"',
                  ),
                  icon: const Icon(Icons.check_circle_rounded, size: 22),
                  label: const Text(
                    'TÔI ỔN - HỦY BÁO ĐỘNG (I AM SAFE)',
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 13,
                      letterSpacing: 0.4,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF10B981),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    elevation: 3,
                  ),
                ),
              ),
              const SizedBox(height: 10),

              // Nút 2: CẤP CỨU NGAY (BỎ QUA ĐẾM NGƯỢC)
              SizedBox(
                width: double.infinity,
                child: TextButton.icon(
                  onPressed: () => _service.confirmEmergencyNow(
                    reason: 'Người dùng bấm Cấp cứu tức thời',
                  ),
                  icon: const Icon(Icons.emergency_rounded,
                      size: 16, color: Color(0xFFEF4444)),
                  label: const Text(
                    'BỎ QUA CHỜ - PHÁT LỆNH CẤP CỨU NGAY',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 11,
                      color: Color(0xFFEF4444),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildVoiceChip({
    required String text,
    required VoidCallback onTap,
    required bool isSafe,
  }) {
    final color = isSafe ? const Color(0xFF10B981) : const Color(0xFFEF4444);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withValues(alpha: 0.4)),
        ),
        child: Text(
          text,
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
      ),
    );
  }
}
