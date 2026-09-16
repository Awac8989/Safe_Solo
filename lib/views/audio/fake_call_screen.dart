import 'package:flutter/material.dart';
import '../../core/app_theme.dart';
import '../../models/fake_call_config.dart';
import '../../services/fake_call_service.dart';

class FakeCallScreen extends StatefulWidget {
  const FakeCallScreen({super.key});

  @override
  State<FakeCallScreen> createState() => _FakeCallScreenState();
}

class _FakeCallScreenState extends State<FakeCallScreen> with SingleTickerProviderStateMixin {
  final FakeCallService _service = FakeCallService.instance;
  late final AnimationController _ringController = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1000),
  )..repeat(reverse: true);

  @override
  void initState() {
    super.initState();
    if (_service.status == FakeCallStatus.idle) {
      _service.scheduleFakeCall();
    }
  }

  @override
  void dispose() {
    _ringController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<FakeCallStatus>(
      valueListenable: _service.statusNotifier,
      builder: (context, status, _) {
        if (status == FakeCallStatus.finished) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) Navigator.pop(context);
          });
          return const Scaffold(backgroundColor: Colors.black);
        }

        final config = _service.config;
        final isInCall = status == FakeCallStatus.inCall;

        return Scaffold(
          backgroundColor: const Color(0xFF0F172A),
          body: SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
              child: Column(
                children: [
                  const SizedBox(height: 20),

                  // Caller Name & Status
                  Text(
                    config.callerName,
                    style: const TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    isInCall
                        ? _formatDuration(_service.callDurationSeconds)
                        : (status == FakeCallStatus.pendingCountdown
                            ? 'Sẽ đổ chuông sau ${_service.countdownRemaining}s...'
                            : 'Cuộc gọi đến...'),
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: isInCall ? AppColors.success : Colors.white70,
                    ),
                  ),
                  const SizedBox(height: 40),

                  // Avatar / Pulsing Ring
                  Center(
                    child: AnimatedBuilder(
                      animation: _ringController,
                      builder: (context, child) {
                        final scale = isInCall ? 1.0 : 1.0 + (_ringController.value * 0.08);
                        return Transform.scale(
                          scale: scale,
                          child: Container(
                            width: 140,
                            height: 140,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: const Color(0xFF1E293B),
                              border: Border.all(
                                color: isInCall ? AppColors.success : AppColors.primary,
                                width: 4,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: (isInCall ? AppColors.success : AppColors.primary).withValues(alpha: 0.3),
                                  blurRadius: 24,
                                  spreadRadius: 4,
                                ),
                              ],
                            ),
                            child: Icon(
                              Icons.person_rounded,
                              size: 72,
                              color: isInCall ? AppColors.success : Colors.white,
                            ),
                          ),
                        );
                      },
                    ),
                  ),

                  const Spacer(),

                  // In-Call Dialogue Box (Lời thoại cứu hộ để người dùng nghe và đọc theo)
                  if (isInCall) ...[
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
                              Container(
                                padding: const EdgeInsets.all(6),
                                decoration: BoxDecoration(
                                  color: AppColors.success.withValues(alpha: 0.2),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.record_voice_over_rounded, color: AppColors.success, size: 16),
                              ),
                              const SizedBox(width: 8),
                              const Text(
                                'Giọng nói giải cứu (Voice Bot):',
                                style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w700),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Text(
                            config.scenarioDialogue,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              height: 1.4,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],

                  // Action Buttons (Ringing: Decline & Accept | InCall: End Call)
                  if (!isInCall)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        // Decline
                        Column(
                          children: [
                            GestureDetector(
                              onTap: () {
                                _service.endCall();
                                Navigator.pop(context);
                              },
                              child: Container(
                                width: 72,
                                height: 72,
                                decoration: const BoxDecoration(
                                  color: AppColors.destructive,
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.call_end_rounded, color: Colors.white, size: 32),
                              ),
                            ),
                            const SizedBox(height: 8),
                            const Text('Từ chối', style: TextStyle(color: Colors.white70, fontSize: 13)),
                          ],
                        ),

                        // Accept
                        Column(
                          children: [
                            GestureDetector(
                              onTap: () => _service.acceptCall(),
                              child: Container(
                                width: 72,
                                height: 72,
                                decoration: const BoxDecoration(
                                  color: AppColors.success,
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.call_rounded, color: Colors.white, size: 32),
                              ),
                            ),
                            const SizedBox(height: 8),
                            const Text('Trả lời', style: TextStyle(color: Colors.white70, fontSize: 13)),
                          ],
                        ),
                      ],
                    )
                  else
                    // End Call button
                    Center(
                      child: GestureDetector(
                        onTap: () {
                          _service.endCall();
                          Navigator.pop(context);
                        },
                        child: Container(
                          width: 72,
                          height: 72,
                          decoration: const BoxDecoration(
                            color: AppColors.destructive,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.call_end_rounded, color: Colors.white, size: 36),
                        ),
                      ),
                    ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  String _formatDuration(int totalSeconds) {
    final m = (totalSeconds ~/ 60).toString().padLeft(2, '0');
    final s = (totalSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }
}
