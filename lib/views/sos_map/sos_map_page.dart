import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_theme.dart';
import '../../core/widgets/push_to_talk_button.dart';
import '../../core/widgets/voice_waveform.dart';
import '../community_radar/community_radar_page.dart';

class SosMapPage extends StatefulWidget {
  const SosMapPage({
    super.key,
    this.victimName = 'Ho Van Tai',
  });

  final String victimName;

  @override
  State<SosMapPage> createState() => _SosMapPageState();
}

class _SosMapPageState extends State<SosMapPage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _blink = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat(reverse: true);

  final List<_EmergencyMessage> _messages = [
    _EmergencyMessage(
      author: 'He thong',
      text: 'SOS da kich hoat luc 14:32 · pin 18%',
      system: true,
    ),
    _EmergencyMessage(
      author: 'Guardian Minh Anh',
      text: 'Toi dang den noi, ETA 6 phut.',
    ),
  ];

  int? _voiceSeconds;
  final TextEditingController _chatController = TextEditingController();

  @override
  void dispose() {
    _blink.dispose();
    _chatController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const victim = LatLng(10.7766, 106.7009);
    const guardian = LatLng(10.7818, 106.6968);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            FadeTransition(
              opacity: Tween(begin: 0.45, end: 1.0).animate(_blink),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(18, 14, 18, 14),
                decoration: BoxDecoration(
                  gradient: AppColors.dangerGradient,
                  boxShadow: AppShadows.danger,
                ),
                child: Row(
                  children: [
                    const Icon(Icons.warning_amber_rounded, color: Colors.white),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.victimName,
                            style: AppTextStyles.title.copyWith(color: Colors.white),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'SOS dang hoat dong · Pin 18%',
                            style: AppTextStyles.body.copyWith(color: Colors.white),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close_rounded, color: Colors.white),
                    ),
                  ],
                ),
              ),
            ),
            Expanded(
              child: Stack(
                children: [
                  GoogleMap(
                    initialCameraPosition: const CameraPosition(
                      target: victim,
                      zoom: 14.5,
                    ),
                    markers: {
                      const Marker(
                        markerId: MarkerId('victim'),
                        position: victim,
                        infoWindow: InfoWindow(title: 'Nan nhan'),
                      ),
                      const Marker(
                        markerId: MarkerId('guardian'),
                        position: guardian,
                        infoWindow: InfoWindow(title: 'Guardian'),
                      ),
                    },
                    polylines: {
                      const Polyline(
                        polylineId: PolylineId('route'),
                        points: [guardian, victim],
                        color: AppColors.primary,
                        width: 5,
                      ),
                    },
                    circles: {
                      const Circle(
                        circleId: CircleId('radar'),
                        center: victim,
                        radius: 80,
                        fillColor: Color(0x33F05454),
                        strokeColor: AppColors.destructive,
                        strokeWidth: 2,
                      ),
                    },
                  ),
                  DraggableScrollableSheet(
                    initialChildSize: 0.36,
                    minChildSize: 0.26,
                    maxChildSize: 0.8,
                    builder: (context, controller) {
                      return Container(
                        decoration: const BoxDecoration(
                          color: AppColors.card,
                          borderRadius: BorderRadius.vertical(
                            top: Radius.circular(AppRadius.xxl),
                          ),
                        ),
                        child: ListView(
                          controller: controller,
                          padding: const EdgeInsets.all(18),
                          children: [
                            Center(
                              child: Container(
                                width: 54,
                                height: 5,
                                decoration: BoxDecoration(
                                  color: AppColors.border,
                                  borderRadius: BorderRadius.circular(999),
                                ),
                              ),
                            ),
                            const SizedBox(height: 16),
                            Text('Chat khan cap', style: AppTextStyles.h3),
                            const SizedBox(height: 14),
                            for (final item in _messages) ...[
                              _MessageBubble(item: item),
                              const SizedBox(height: 10),
                            ],
                            const SizedBox(height: 10),
                            Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFF7EA),
                                borderRadius: BorderRadius.circular(AppRadius.lg),
                                border: Border.all(color: const Color(0xFFFFD7A3)),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Icon(Icons.graphic_eq_rounded, color: AppColors.warning),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text('Ghi am khan cap', style: AppTextStyles.bodyStrong),
                                        const SizedBox(height: 6),
                                        Text(
                                          'Nhan giu de gui voice note kem GPS hien tai vao kenh khan cap.',
                                          style: AppTextStyles.body.copyWith(color: AppColors.textSecondary),
                                        ),
                                      ],
                                    ),
                                  ),
                                  PushToTalkButton(
                                    size: PushToTalkSize.large,
                                    onSend: (seconds) {
                                      setState(() {
                                        _voiceSeconds = seconds;
                                        _messages.add(
                                          _EmergencyMessage(
                                            author: 'Ban',
                                            text: 'Voice note da gui kem GPS 10.7766, 106.7009',
                                            voiceSeconds: seconds,
                                          ),
                                        );
                                      });
                                    },
                                  ),
                                ],
                              ),
                            ),
                            if (_voiceSeconds != null) ...[
                              const SizedBox(height: 14),
                              Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: AppColors.accent,
                                  borderRadius: BorderRadius.circular(AppRadius.lg),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(Icons.play_arrow_rounded),
                                    const SizedBox(width: 10),
                                    const Expanded(
                                      child: VoiceWaveform(
                                        bars: 28,
                                        progress: 0.42,
                                        height: 22,
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Text('${_voiceSeconds}s'),
                                  ],
                                ),
                              ),
                            ],
                            const SizedBox(height: 16),
                            Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: () => _launch(Uri.parse('tel:115')),
                                    icon: const Icon(Icons.call_outlined),
                                    label: const Text('Goi 115'),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: ElevatedButton.icon(
                                    onPressed: () => _launch(
                                      Uri.parse(
                                        'https://www.google.com/maps/dir/?api=1&destination=${victim.latitude},${victim.longitude}',
                                      ),
                                    ),
                                    icon: const Icon(Icons.navigation_outlined),
                                    label: const Text('Chi duong'),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            SizedBox(
                              width: double.infinity,
                              child: TextButton.icon(
                                onPressed: _openBroadcast,
                                icon: const Icon(Icons.campaign_rounded),
                                label: const Text('Ban dang o qua xa? Mo Community Radar'),
                              ),
                            ),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                Expanded(
                                  child: TextField(
                                    controller: _chatController,
                                    decoration: const InputDecoration(
                                      hintText: 'Nhap tin nhan khan cap...',
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                SizedBox(
                                  width: 52,
                                  height: 52,
                                  child: ElevatedButton(
                                    onPressed: () {
                                      final text = _chatController.text.trim();
                                      if (text.isEmpty) {
                                        return;
                                      }
                                      setState(() {
                                        _messages.add(
                                          _EmergencyMessage(author: 'Ban', text: text),
                                        );
                                        _chatController.clear();
                                      });
                                    },
                                    style: ElevatedButton.styleFrom(padding: EdgeInsets.zero),
                                    child: const Icon(Icons.send_rounded),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openBroadcast() async {
    final noteController = TextEditingController(text: 'Nguoi nha can duoc tiep can nhanh');
    String selectedReason = 'Y te';

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setState) => AlertDialog(
            title: const Text('Keu goi cong dong'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: selectedReason,
                  decoration: const InputDecoration(labelText: 'Ly do'),
                  items: const ['Y te', 'Toi pham', 'Tai nan', 'Khac']
                      .map((item) => DropdownMenuItem(value: item, child: Text(item)))
                      .toList(),
                  onChanged: (value) => setState(() => selectedReason = value ?? selectedReason),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: noteController,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'Ghi chu',
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('Huy'),
              ),
              ElevatedButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                child: const Text('Phat canh bao'),
              ),
            ],
          ),
        );
      },
    );

    if (confirmed != true || !mounted) {
      return;
    }

    await Navigator.push(
      context,
      MaterialPageRoute<void>(
        builder: (_) => CommunityRadarPage(
          reason: selectedReason,
          note: noteController.text.trim(),
        ),
      ),
    );
  }

  Future<void> _launch(Uri uri) async {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}

class _EmergencyMessage {
  const _EmergencyMessage({
    required this.author,
    required this.text,
    this.system = false,
    this.voiceSeconds,
  });

  final String author;
  final String text;
  final bool system;
  final int? voiceSeconds;
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.item});

  final _EmergencyMessage item;

  @override
  Widget build(BuildContext context) {
    if (item.system) {
      return Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: AppColors.secondary,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(item.text, style: AppTextStyles.caption),
        ),
      );
    }

    final mine = item.author == 'Ban';
    return Row(
      mainAxisAlignment: mine ? MainAxisAlignment.end : MainAxisAlignment.start,
      children: [
        Flexible(
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: mine ? AppColors.primary : AppColors.accent,
              borderRadius: BorderRadius.circular(AppRadius.lg),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (!mine)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text(item.author, style: AppTextStyles.caption),
                  ),
                Text(
                  item.text,
                  style: AppTextStyles.body.copyWith(
                    color: mine ? Colors.white : AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
