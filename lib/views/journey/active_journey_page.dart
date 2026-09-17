import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../core/app_theme.dart';
import '../../core/constants.dart';
import '../../core/providers/app_provider.dart';
import '../../core/widgets/top_toast.dart';
import '../sos_map/sos_map_page.dart';

class ActiveJourneyPage extends StatefulWidget {
  const ActiveJourneyPage({super.key});

  @override
  State<ActiveJourneyPage> createState() => _ActiveJourneyPageState();
}

class _ActiveJourneyPageState extends State<ActiveJourneyPage> with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat(reverse: true);

  Timer? _countdownTimer;
  DateTime _now = DateTime.now();

  @override
  void initState() {
    super.initState();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() => _now = DateTime.now());
      }
    });
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _countdownTimer?.cancel();
    super.dispose();
  }

  Future<void> _handleFinish() async {
    final provider = context.read<AppProvider>();
    await provider.finishLiveJourney();
    if (!mounted) return;
    TopToast.show(context, message: '🎉 Bạn đã đến nơi an toàn! Hành trình kết thúc.');
    Navigator.pop(context);
  }

  Future<void> _handleExtend() async {
    final provider = context.read<AppProvider>();
    await provider.extendLiveJourney(minutes: 10);
    if (!mounted) return;
    TopToast.show(context, message: 'Đã gia hạn hành trình thêm 10 phút.');
  }

  Future<void> _handleCancel() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Hủy bảo vệ hành trình?'),
        content: const Text('Bạn có chắc muốn dừng giám sát hành trình chuyến đi này?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Không')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.destructive),
            child: const Text('Dừng bảo vệ', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm == true && mounted) {
      await context.read<AppProvider>().cancelLiveJourney();
      if (mounted) Navigator.pop(context);
    }
  }

  void _shareTrackingLink(String shareToken) {
    final link = '${AppConstants.backendBaseUrl}/journeys/track/$shareToken';
    Clipboard.setData(ClipboardData(text: link));
    TopToast.show(context, message: 'Đã sao chép link theo dõi trực tiếp để gửi người thân!');
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AppProvider>();
    final journey = provider.activeJourney;

    if (journey == null || journey.isCancelled || journey.isArrived) {
      return Scaffold(
        appBar: AppBar(title: const Text('Hành trình An toàn')),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.check_circle_outline_rounded, size: 72, color: AppColors.success),
              const SizedBox(height: 16),
              const Text('Không có hành trình nào đang hoạt động', style: TextStyle(fontSize: 16)),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Quay lại'),
              ),
            ],
          ),
        ),
      );
    }

    final diffSeconds = journey.expectedArrivalAt.difference(_now).inSeconds;
    final isOverdue = diffSeconds <= 0;
    final absSeconds = diffSeconds.abs();
    final m = (absSeconds ~/ 60).toString().padLeft(2, '0');
    final s = (absSeconds % 60).toString().padLeft(2, '0');
    final timerText = isOverdue ? '-$m:$s' : '$m:$s';

    return Scaffold(
      backgroundColor: isOverdue ? const Color(0xFFFEF2F2) : AppColors.background,
      appBar: AppBar(
        title: const Text('Live Journey Guard'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            tooltip: 'Hủy hành trình',
            icon: const Icon(Icons.close_rounded),
            onPressed: _handleCancel,
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: Column(
            children: [
              // Banner tình trạng
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: isOverdue ? AppColors.destructive.withValues(alpha: 0.1) : AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isOverdue ? AppColors.destructive.withValues(alpha: 0.3) : AppColors.border,
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      isOverdue ? Icons.warning_amber_rounded : Icons.shield_rounded,
                      color: isOverdue ? AppColors.destructive : AppColors.primary,
                      size: 24,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            isOverdue ? 'CẢNH BÁO: QUÁ HẠN HÀNH TRÌNH' : 'ĐANG BẢO VỆ CHUYẾN ĐI',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              color: isOverdue ? AppColors.destructive : AppColors.primary,
                              letterSpacing: 0.5,
                            ),
                          ),
                          Text(
                            journey.destinationLabel,
                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),

              // Vòng tròn đếm ngược radar
              AnimatedBuilder(
                animation: _pulseController,
                builder: (context, child) {
                  final scale = 1.0 + (_pulseController.value * 0.05);
                  return Transform.scale(
                    scale: scale,
                    child: Container(
                      width: 210,
                      height: 210,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white,
                        boxShadow: [
                          BoxShadow(
                            color: (isOverdue ? AppColors.destructive : AppColors.primary).withValues(alpha: 0.2),
                            blurRadius: 30,
                            spreadRadius: 8,
                          ),
                        ],
                        border: Border.all(
                          color: isOverdue ? AppColors.destructive : AppColors.primary,
                          width: 5,
                        ),
                      ),
                      child: Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              isOverdue ? 'QUÁ HẠN' : 'CÒN LẠI',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: isOverdue ? AppColors.destructive : AppColors.textSecondary,
                                letterSpacing: 1.2,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              timerText,
                              style: TextStyle(
                                fontSize: 44,
                                fontWeight: FontWeight.w900,
                                color: isOverdue ? AppColors.destructive : AppColors.textPrimary,
                                fontFeatures: const [FontFeature.tabularFigures()],
                              ),
                            ),
                            const SizedBox(height: 4),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.gps_fixed_rounded,
                                  size: 14,
                                  color: isOverdue ? AppColors.destructive : AppColors.success,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  'GPS Live Ping 30s',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: isOverdue ? AppColors.destructive : AppColors.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),

              const Spacer(),

              // Nút sao chép / gửi Magic Link
              OutlinedButton.icon(
                onPressed: () => _shareTrackingLink(journey.shareToken),
                icon: const Icon(Icons.share_rounded, size: 18),
                label: const Text('Chia sẻ link lộ trình trực tiếp cho người thân'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  side: const BorderSide(color: AppColors.primary),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
              ),
              const SizedBox(height: 12),

              // Hàng nút: +10 Phút & SOS Khẩn cấp
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _handleExtend,
                      icon: const Icon(Icons.more_time_rounded, size: 18),
                      label: const Text('+10 Phút'),
                      style: OutlinedButton.styleFrom(
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute<void>(
                            builder: (_) => const SosMapPage(victimName: 'Hành trình SafeSolo'),
                          ),
                        );
                      },
                      icon: const Icon(Icons.sos_rounded, color: Colors.white, size: 20),
                      label: const Text('SOS KHẨN CẤP', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.destructive,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Nút lớn: ĐÃ ĐẾN NƠI AN TOÀN
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton.icon(
                  onPressed: _handleFinish,
                  icon: const Icon(Icons.check_circle_rounded, color: Colors.white, size: 26),
                  label: const Text(
                    'TÔI ĐÃ ĐẾN NƠI AN TOÀN',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.success,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    elevation: 3,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
