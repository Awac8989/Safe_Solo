import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../services/stroke_timelock_service.dart';

/// ============================================================================
/// SAFESOLO — WIDGET BỘ ĐẾM CỬA SỔ VÀNG ĐỘT QUỴ (Phân hệ 136)
/// Hiển thị countdown tPA + thông tin hành động khẩn cấp
///
/// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03 - TDMU
/// ============================================================================

class StrokeTimelockWidget extends StatelessWidget {
  final bool compact; // Chế độ compact cho Watch hoặc card nhỏ

  const StrokeTimelockWidget({super.key, this.compact = false});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: StrokeTimelockService.instance,
      builder: (context, _) {
        final service = StrokeTimelockService.instance;
        final snap = service.snapshot;

        if (service.state == StrokeTimerState.idle) {
          return _buildStartCard(context);
        }

        return compact ? _buildCompact(snap) : _buildFull(context, snap);
      },
    );
  }

  Widget _buildStartCard(BuildContext context) {
    return GestureDetector(
      onTap: () => _showStartDialog(context),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFF1E2A45),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF42A5F5).withOpacity(0.5)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFF1565C0).withOpacity(0.3),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.timer_outlined, color: Color(0xFF42A5F5), size: 28),
            ),
            const SizedBox(width: 14),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Bộ Đếm Cửa Sổ Vàng tPA',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Nhấn để kích hoạt khi F.A.S.T dương tính',
                    style: TextStyle(color: Colors.white54, fontSize: 12),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Colors.white38),
          ],
        ),
      ),
    );
  }

  Widget _buildFull(BuildContext context, StrokeTimerSnapshot snap) {
    final isExpired = snap.alertLevel == StrokeAlertLevel.expired;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: snap.alertColor.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: snap.alertColor, width: 2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Icon(
                isExpired ? Icons.timer_off_rounded : Icons.timer_rounded,
                color: snap.alertColor,
                size: 22,
              ),
              const SizedBox(width: 8),
              const Text(
                'CỬA SỔ VÀNG tPA',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                  letterSpacing: 1.2,
                ),
              ),
              const Spacer(),
              GestureDetector(
                onTap: () {
                  HapticFeedback.mediumImpact();
                  StrokeTimelockService.instance.stop();
                },
                child: const Icon(Icons.close, color: Colors.white38, size: 20),
              ),
            ],
          ),

          const SizedBox(height: 20),

          // Countdown lớn
          Center(
            child: TweenAnimationBuilder<int>(
              tween: IntTween(begin: snap.remainingMinutes + 1, end: snap.remainingMinutes),
              duration: const Duration(milliseconds: 500),
              builder: (context, value, _) => Text(
                snap.remainingText,
                style: TextStyle(
                  color: snap.alertColor,
                  fontSize: 42,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -1,
                ),
              ),
            ),
          ),

          const SizedBox(height: 8),

          // Progress bar
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: snap.progressPercent,
              backgroundColor: Colors.white12,
              valueColor: AlwaysStoppedAnimation(snap.alertColor),
              minHeight: 10,
            ),
          ),

          const SizedBox(height: 16),

          // Alert message
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: snap.alertColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              snap.alertMessage,
              style: TextStyle(color: snap.alertColor, fontSize: 13, fontWeight: FontWeight.w600),
              textAlign: TextAlign.center,
            ),
          ),

          const SizedBox(height: 14),

          // Thống kê
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _statBox('Đã trôi qua', '${snap.elapsedMinutes} phút'),
              _statBox('Tế bào não mất', snap.brainCellsText),
              _statBox('Bệnh viện', snap.nearestHospital, maxLines: 2),
            ],
          ),

          const SizedBox(height: 14),

          // Danh sách BV có tPA
          ExpansionTile(
            tilePadding: EdgeInsets.zero,
            childrenPadding: EdgeInsets.zero,
            title: const Text(
              'Bệnh viện có can thiệp tPA',
              style: TextStyle(color: Colors.white70, fontSize: 12),
            ),
            iconColor: Colors.white38,
            collapsedIconColor: Colors.white38,
            children: StrokeTimelockService.kStrokeHospitals.map((h) => ListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 4),
              dense: true,
              title: Text(h['name']!, style: const TextStyle(color: Colors.white, fontSize: 12)),
              subtitle: Text(h['type']!, style: const TextStyle(color: Colors.white54, fontSize: 11)),
              trailing: Text(h['phone']!, style: const TextStyle(color: Color(0xFF42A5F5), fontSize: 11)),
            )).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildCompact(StrokeTimerSnapshot snap) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: snap.alertColor.withOpacity(0.15),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: snap.alertColor),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.timer_rounded, color: snap.alertColor, size: 16),
          const SizedBox(width: 6),
          Text(
            snap.remainingText,
            style: TextStyle(
              color: snap.alertColor,
              fontWeight: FontWeight.bold,
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }

  Widget _statBox(String label, String value, {int maxLines = 1}) {
    return Column(
      children: [
        Text(label, style: const TextStyle(color: Colors.white38, fontSize: 10)),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
          textAlign: TextAlign.center,
          maxLines: maxLines,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }

  void _showStartDialog(BuildContext context) {
    DateTime? selectedTime;
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          backgroundColor: const Color(0xFF1A2035),
          title: const Text(
            '⏱️ Khởi động Bộ Đếm tPA',
            style: TextStyle(color: Colors.white, fontSize: 16),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Thời điểm khởi phát triệu chứng?',
                style: TextStyle(color: Colors.white70),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () {
                        setState(() => selectedTime = DateTime.now());
                      },
                      style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1565C0)),
                      child: const Text('Ngay bây giờ'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () async {
                        final t = await showTimePicker(
                          context: context,
                          initialTime: TimeOfDay.now(),
                        );
                        if (t != null) {
                          final now = DateTime.now();
                          setState(() => selectedTime = DateTime(
                            now.year, now.month, now.day, t.hour, t.minute,
                          ));
                        }
                      },
                      style: OutlinedButton.styleFrom(foregroundColor: Colors.white70),
                      child: const Text('Chọn giờ'),
                    ),
                  ),
                ],
              ),
              if (selectedTime != null) ...[
                const SizedBox(height: 10),
                Text(
                  'Khởi phát: ${selectedTime!.hour}:${selectedTime!.minute.toString().padLeft(2, '0')}',
                  style: const TextStyle(color: Color(0xFF42A5F5)),
                ),
              ],
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Hủy', style: TextStyle(color: Colors.white38)),
            ),
            ElevatedButton(
              onPressed: selectedTime == null ? null : () {
                StrokeTimelockService.instance.start(onsetTime: selectedTime!);
                HapticFeedback.heavyImpact();
                Navigator.pop(ctx);
              },
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFF44336)),
              child: const Text('Kích hoạt'),
            ),
          ],
        ),
      ),
    );
  }
}
