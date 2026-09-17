import 'package:flutter/material.dart';
import '../../core/app_theme.dart';
import '../../services/walkie_talkie_service.dart';

class WalkieTalkieDialog extends StatefulWidget {
  const WalkieTalkieDialog({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const WalkieTalkieDialog(),
    );
  }

  @override
  State<WalkieTalkieDialog> createState() => _WalkieTalkieDialogState();
}

class _WalkieTalkieDialogState extends State<WalkieTalkieDialog> with SingleTickerProviderStateMixin {
  final WalkieTalkieService _service = WalkieTalkieService.instance;
  late final AnimationController _pulseController = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat(reverse: true);

  final List<Map<String, String>> _channels = [
    {'id': 'channel_emergency_main', 'name': '🚨 Kênh Cứu hộ Tác chiến'},
    {'id': 'channel_family_circle', 'name': '👨‍👩‍👧 Kênh Gia đình'},
    {'id': 'channel_community_radar', 'name': '🛡️ Kênh Hiệp sĩ Radar'},
  ];

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<WalkieTalkieState>(
      valueListenable: _service.stateNotifier,
      builder: (context, state, _) {
        final isTransmitting = state.isTransmitting;
        final isReceiving = state.isReceiving;

        Color mainColor;
        String statusText;
        if (isTransmitting) {
          mainColor = AppColors.destructive;
          statusText = 'ĐANG PHÁT ÂM THANH TRỰC TIẾP (${state.talkSeconds}s)';
        } else if (isReceiving) {
          mainColor = AppColors.warning;
          statusText = 'ĐANG NGHE: ${state.activeSpeaker?.toUpperCase() ?? "HIỆP SĨ"}';
        } else {
          mainColor = AppColors.primary;
          statusText = 'SẴN SÀNG · NHẤN GIỮ ĐỂ NÓI';
        }

        return Container(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
          decoration: const BoxDecoration(
            color: Color(0xFF1E293B), // Dark tactical theme
            borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Pull bar
              Center(
                child: Container(
                  width: 44,
                  height: 5,
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Title & Channel Selector
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: mainColor.withValues(alpha: 0.2),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.radio_rounded, color: mainColor, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'SafeSolo Walkie-Talkie',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white),
                        ),
                        Text(
                          state.channelName,
                          style: const TextStyle(fontSize: 13, color: Colors.white70),
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
              const SizedBox(height: 16),

              // Dropdown Channel Switcher
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: Colors.white12),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: state.channelId,
                    isExpanded: true,
                    dropdownColor: const Color(0xFF0F172A),
                    icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Colors.white70),
                    items: _channels.map((ch) {
                      return DropdownMenuItem<String>(
                        value: ch['id'],
                        child: Text(
                          ch['name']!,
                          style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                        ),
                      );
                    }).toList(),
                    onChanged: (newId) {
                      if (newId == null) return;
                      final target = _channels.firstWhere((c) => c['id'] == newId);
                      _service.joinChannel(channelId: target['id']!, channelName: target['name']!);
                    },
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Status Indicator Banner
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: mainColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: mainColor.withValues(alpha: 0.4)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(color: mainColor, shape: BoxShape.circle),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      statusText,
                      style: TextStyle(color: mainColor, fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 0.5),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 28),

              // Big Round PTT Push Button
              GestureDetector(
                onTapDown: (_) => _service.startTalking(),
                onTapUp: (_) => _service.stopTalking(),
                onTapCancel: () => _service.stopTalking(),
                child: AnimatedBuilder(
                  animation: _pulseController,
                  builder: (context, child) {
                    final scale = isTransmitting ? 1.0 + (_pulseController.value * 0.08) : 1.0;
                    return Transform.scale(
                      scale: scale,
                      child: Container(
                        width: 170,
                        height: 170,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: mainColor,
                          boxShadow: [
                            BoxShadow(
                              color: mainColor.withValues(alpha: 0.4),
                              blurRadius: isTransmitting ? 32 : 16,
                              spreadRadius: isTransmitting ? 8 : 2,
                            ),
                          ],
                        ),
                        child: Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                isTransmitting ? Icons.mic_rounded : Icons.mic_none_rounded,
                                color: Colors.white,
                                size: 52,
                              ),
                              const SizedBox(height: 6),
                              Text(
                                isTransmitting ? 'ĐANG NÓI...' : 'GIỮ ĐỂ NÓI',
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.white,
                                  letterSpacing: 1.0,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                isTransmitting ? 'Buông để gửi' : 'PTT Audio',
                                style: const TextStyle(fontSize: 10, color: Colors.white70),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 24),

              // Audio Waveform Visualization
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: state.audioWave.map((h) {
                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    width: 6,
                    height: (h * 32).clamp(6.0, 32.0),
                    decoration: BoxDecoration(
                      color: isTransmitting ? AppColors.destructive : Colors.white24,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 20),

              // Demo incoming ping button
              TextButton.icon(
                onPressed: isTransmitting
                    ? null
                    : () {
                        _service.simulateIncomingSpeech(speakerName: 'Hiệp sĩ Tuấn Anh', durationSeconds: 3);
                      },
                icon: const Icon(Icons.volume_up_rounded, size: 16, color: Colors.white54),
                label: const Text(
                  'Thử tín hiệu nhận từ Hiệp sĩ cứu hộ',
                  style: TextStyle(color: Colors.white54, fontSize: 12),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
