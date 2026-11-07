import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_strings.dart';
import '../../core/constants.dart';
import '../../core/maptiler_tile_provider.dart';
import '../../core/providers/app_provider.dart';
import '../../core/widgets/push_to_talk_button.dart';
import '../../core/widgets/top_toast.dart';
import '../../core/widgets/voice_waveform.dart';
import '../../models/rescue_incident_model.dart';
import '../../services/audio_note_service.dart';
import '../../services/ghost_mode_service.dart';
import '../../services/survival_siren_service.dart';
import '../../services/wear_os_service.dart';
import '../emergency/emergency_ice_sheet.dart';
import '../emergency/first_aid_guide_page.dart';
import '../emergency/offline_emergency_sheet.dart';

/// ============================================================================
/// SAFESOLO - BÀN TÁC CHIẾN CỨU NẠN THỜI GIAN THỰC (EMERGENCY WAR ROOM)
/// Phục vụ: Giám sát toàn diện người bị nạn, kết nối Hiệp sĩ & Tổng đài 115
/// Tác giả: Đoàn Minh Quân - SafeSolo Safety System
/// ============================================================================

class SosMapPage extends StatefulWidget {
  const SosMapPage({
    super.key,
    this.victimName,
    this.incident,
  });

  final String? victimName;
  final RescueIncidentModel? incident;

  @override
  State<SosMapPage> createState() => _SosMapPageState();
}

class _SosMapPageState extends State<SosMapPage> with TickerProviderStateMixin {
  late final AnimationController _blink = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 800),
  )..repeat(reverse: true);

  late final AnimationController _radarWave = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2000),
  )..repeat();

  GoogleMapController? _mapController;
  Timer? _elapsedTicker;
  Timer? _backendSyncTicker;
  int _elapsedSeconds = 15;

  final SurvivalSirenService _sirenService = SurvivalSirenService.instance;

  final List<_EmergencyMessage> _messages = [];
  RecordedAudioNote? _voiceNote;
  final TextEditingController _chatController = TextEditingController();

  @override
  void initState() {
    super.initState();
    // Khởi tạo tin nhắn hệ thống đầu tiên
    _messages.add(
      _EmergencyMessage(
        author: 'Hệ thống SafeSolo',
        text: '🚨 Báo động khẩn cấp P1 đã kích hoạt. Hệ thống đang quét Hiệp sĩ có chứng chỉ Sơ cấp cứu trong bán kính 1.2km.',
        system: true,
      ),
    );
    _messages.add(
      _EmergencyMessage(
        author: 'Guardian',
        text: 'Người thân đã nhận được tọa độ GPS và link theo dõi thời gian thực.',
        system: true,
      ),
    );

    // Đồng hồ đếm thời gian từ lúc phát sinh sự cố
    _elapsedTicker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() => _elapsedSeconds++);
      }
    });

    // Định kỳ đồng bộ trạng thái sự cố từ Backend mỗi 8 giây
    _backendSyncTicker = Timer.periodic(const Duration(seconds: 8), (_) {
      if (mounted) {
        context.read<AppProvider>().syncActiveIncidentFromBackend();
      }
    });
  }

  @override
  void dispose() {
    _blink.dispose();
    _radarWave.dispose();
    _elapsedTicker?.cancel();
    _backendSyncTicker?.cancel();
    _chatController.dispose();
    _sirenService.stopAll();
    super.dispose();
  }

  AppStrings _strings(BuildContext context) =>
      AppStrings(context.read<AppProvider>().language);

  String _formatElapsed(int seconds) {
    final m = (seconds ~/ 60).toString().padLeft(2, '0');
    final s = (seconds % 60).toString().padLeft(2, '0');
    return 'T+$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final appProvider = context.watch<AppProvider>();
    final user = appProvider.user;
    final strings = _strings(context);

    // Lấy thông tin sự cố hiện tại (ưu tiên từ state provider, rồi đến widget param)
    final incident = appProvider.activeRescueIncident ?? widget.incident;

    final displayName = widget.victimName ??
        (user?.fullName.isNotEmpty == true ? user!.fullName : 'Nạn nhân (Bạn)');

    final double lat = incident?.exactLat ??
        user?.lastKnownLocation?.lat ??
        10.7766;
    final double lng = incident?.exactLng ??
        user?.lastKnownLocation?.lng ??
        106.7009;
    final victim = LatLng(lat, lng);

    // Tọa độ Hiệp sĩ hoặc Guardian lân cận
    final heroLat = lat + 0.0035;
    final heroLng = lng - 0.0032;
    final heroLocation = LatLng(heroLat, heroLng);

    // Tọa độ Trạm SafePoint / Tủ sốc tim AED gần nhất
    final aedLocation = LatLng(lat - 0.0028, lng + 0.0022);

    final batteryPercent = incident?.batteryLevel ??
        WearOsService.instance.battery;

    return Scaffold(
      backgroundColor: const Color(0xFF0A0F1D),
      body: SafeArea(
        child: Column(
          children: [
            // 1. BANNER CHỈ HUY KHẨN CẤP ĐA TẦNG (TACTICAL MISSION HEADER)
            _buildMissionHeader(
              context,
              strings: strings,
              displayName: displayName,
              incident: incident,
              batteryPercent: batteryPercent,
            ),

            // 1.1 BANNER CHỈ ĐƯỜNG TỦ SỐC TIM AED & SAFEPOINT GẦN NHẤT (GOLDEN TIME)
            _buildAedProximityBanner(context, aedLocation: aedLocation),

            // 2. BẢN ĐỒ TÁC CHIẾN TƯƠNG TÁC CAO & CÔNG CỤ SINH TỒN
            Expanded(
              child: Stack(
                children: [
                  GoogleMap(
                    initialCameraPosition: CameraPosition(
                      target: victim,
                      zoom: 15.5,
                    ),
                    onMapCreated: (ctrl) => _mapController = ctrl,
                    mapToolbarEnabled: false,
                    myLocationButtonEnabled: false,
                    myLocationEnabled: true,
                    compassEnabled: true,
                    tileOverlays: AppConstants.hasMapTiler
                        ? {
                            TileOverlay(
                              tileOverlayId: const TileOverlayId('maptiler_sos'),
                              tileProvider: MapTilerTileProvider(),
                              transparency: 0.05,
                              zIndex: 1,
                            ),
                          }
                        : {},
                    markers: {
                      // Marker Nạn nhân
                      Marker(
                        markerId: const MarkerId('victim'),
                        position: victim,
                        infoWindow: InfoWindow(
                          title: 'Vị trí nạn nhân ($displayName)',
                          snippet: 'Tọa độ GPS độ chính xác cao',
                        ),
                        icon: BitmapDescriptor.defaultMarkerWithHue(
                          BitmapDescriptor.hueRed,
                        ),
                      ),
                      // Marker Hiệp sĩ cứu hộ
                      Marker(
                        markerId: const MarkerId('hero'),
                        position: heroLocation,
                        infoWindow: InfoWindow(
                          title: incident?.assignedVolunteerName ?? 'Hiệp sĩ phản ứng nhanh (BLS)',
                          snippet: 'Đang di chuyển đến hiện trường (ETA 3p)',
                        ),
                        icon: BitmapDescriptor.defaultMarkerWithHue(
                          BitmapDescriptor.hueAzure,
                        ),
                      ),
                      // Marker Trạm SafePoint / Tủ AED
                      Marker(
                        markerId: const MarkerId('aed_point'),
                        position: aedLocation,
                        infoWindow: const InfoWindow(
                          title: 'Điểm sơ cứu SafePoint & Máy sốc tim OpenAED',
                          snippet: 'Cách 350m · Sẵn sàng 24/7',
                        ),
                        icon: BitmapDescriptor.defaultMarkerWithHue(
                          BitmapDescriptor.hueGreen,
                        ),
                      ),
                    },
                    polylines: {
                      Polyline(
                        polylineId: const PolylineId('hero_route'),
                        points: [heroLocation, victim],
                        color: const Color(0xFF38BDF8),
                        width: 5,
                        patterns: [
                          PatternItem.dash(20),
                          PatternItem.gap(10),
                        ],
                      ),
                    },
                    circles: {
                      Circle(
                        circleId: const CircleId('radar_inner'),
                        center: victim,
                        radius: 70,
                        fillColor: const Color(0xFFEF4444).withValues(alpha: 0.35),
                        strokeColor: const Color(0xFFEF4444),
                        strokeWidth: 2,
                      ),
                      Circle(
                        circleId: const CircleId('radar_outer'),
                        center: victim,
                        radius: 200,
                        fillColor: const Color(0xFFEF4444).withValues(alpha: 0.1),
                        strokeColor: const Color(0xFFEF4444).withValues(alpha: 0.4),
                        strokeWidth: 1,
                      ),
                    },
                  ),

                  // Nút định tâm vị trí (Recenter Button)
                  Positioned(
                    top: 16,
                    right: 16,
                    child: FloatingActionButton.small(
                      heroTag: 'recenter_map',
                      backgroundColor: const Color(0xFF1E293B),
                      foregroundColor: Colors.white,
                      onPressed: () {
                        _mapController?.animateCamera(
                          CameraUpdate.newLatLngZoom(victim, 16.0),
                        );
                      },
                      child: const Icon(Icons.my_location_rounded),
                    ),
                  ),

                  // Thanh Công Cụ Sinh Tồn 1-Chạm Nổi (Floating Survival Action Bar)
                  Positioned(
                    top: 16,
                    left: 16,
                    child: _buildFloatingSurvivalTools(context, incident: incident),
                  ),

                  // 3. BOTTOM SHEET TIẾN TRÌNH CỨU NẠN & KÊNH TÁC CHIẾN
                  DraggableScrollableSheet(
                    initialChildSize: 0.40,
                    minChildSize: 0.22,
                    maxChildSize: 0.88,
                    builder: (sheetContext, scrollController) {
                      return _buildTacticalCockpit(
                        sheetContext,
                        scrollController,
                        strings: strings,
                        incident: incident,
                        displayName: displayName,
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

  /// 1. Header Chỉ Huy Tác Chiến Đa Tầng
  Widget _buildMissionHeader(
    BuildContext context, {
    required AppStrings strings,
    required String displayName,
    required RescueIncidentModel? incident,
    required int batteryPercent,
  }) {
    return FadeTransition(
      opacity: Tween(begin: 0.75, end: 1.0).animate(_blink),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFFDC2626), Color(0xFF991B1B)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.red.withValues(alpha: 0.4),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          children: [
            Row(
              children: [
                // Pulse Siren Icon
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.emergency_rounded,
                    color: Colors.white,
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
                          Flexible(
                            child: Text(
                              displayName,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 17,
                                fontWeight: FontWeight.bold,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 8),
                          // Timer T+00:00
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.35),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              _formatElapsed(_elapsedSeconds),
                              style: const TextStyle(
                                color: Colors.amberAccent,
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                fontFamily: 'monospace',
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          const Icon(Icons.bolt_rounded, color: Colors.amberAccent, size: 14),
                          const SizedBox(width: 2),
                          Expanded(
                            child: Text(
                              'Pin $batteryPercent% · GPS 3s/lần · Hộp đen đang thu âm',
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.9),
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // Nút Mở Thẻ Y Tế I.C.E
                IconButton(
                  tooltip: 'Thẻ Y tế Sinh tồn I.C.E & SBAR',
                  icon: const Icon(Icons.medical_information_rounded, color: Colors.white),
                  onPressed: () => EmergencyIceSheet.show(context, incident: incident),
                ),

                // Nút Đóng / Thoát
                IconButton(
                  tooltip: 'Đóng Bàn tác chiến',
                  icon: const Icon(Icons.close_rounded, color: Colors.white),
                  onPressed: () => _handleSafeExitPrompt(context),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  /// 1.1 Banner Chỉ Đường Tủ Sốc Tim AED & Trạm SafePoint (Thời Gian Vàng 4 Phút)
  Widget _buildAedProximityBanner(BuildContext context, {required LatLng aedLocation}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF064E3B), // Emerald 900
        border: Border(
          bottom: BorderSide(
            color: const Color(0xFF10B981).withValues(alpha: 0.5),
            width: 1.2,
          ),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: const Color(0xFF10B981),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.flash_on_rounded, color: Colors.white, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    const Flexible(
                      child: Text(
                        'TỦ SỐC TIM AED GẦN NHẤT',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.3,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                      decoration: BoxDecoration(
                        color: Colors.amber.withValues(alpha: 0.25),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: Colors.amber, width: 0.8),
                      ),
                      child: const Text(
                        'MÃ MỞ: 1150',
                        style: TextStyle(
                          color: Colors.amberAccent,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 1),
                Text(
                  'Cách 350m · Đi bộ ~4 phút · SafePoint Trực 24/7',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.85),
                    fontSize: 11,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 6),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF10B981),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              visualDensity: VisualDensity.compact,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            icon: const Icon(Icons.directions_walk_rounded, size: 14),
            label: const Text(
              'Chỉ đường',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
            ),
            onPressed: () {
              final url = Uri.parse(
                'https://www.google.com/maps/dir/?api=1&destination=${aedLocation.latitude},${aedLocation.longitude}&travelmode=walking',
              );
              launchUrl(url, mode: LaunchMode.externalApplication);
            },
          ),
        ],
      ),
    );
  }

  /// 2. Thanh Công Cụ Sinh Tồn Nổi 1-Chạm (Quick Survival Bar)
  Widget _buildFloatingSurvivalTools(BuildContext context, {required RescueIncidentModel? incident}) {
    return ValueListenableBuilder<bool>(
      valueListenable: _sirenService.sirenActiveNotifier,
      builder: (context, isSirenOn, _) {
        return Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A).withValues(alpha: 0.92),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white12),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.4),
                blurRadius: 10,
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Nút 1: Gọi 115 Trực tiếp
              _QuickActionCircleButton(
                icon: Icons.phone_in_talk_rounded,
                color: const Color(0xFFEF4444),
                tooltip: 'Gọi Cấp cứu 115',
                onTap: () => launchUrl(Uri.parse('tel:115')),
              ),
              const SizedBox(height: 8),

              // Nút 2: Còi Hú & Chớp Đèn Morse SOS
              _QuickActionCircleButton(
                icon: isSirenOn ? Icons.volume_up_rounded : Icons.campaign_rounded,
                color: isSirenOn ? Colors.amber : const Color(0xFF38BDF8),
                tooltip: isSirenOn ? 'Tắt Còi Sinh Tồn' : 'Bật Còi Hú & Chớp Đèn SOS',
                onTap: () {
                  _sirenService.toggleSiren();
                  _sirenService.toggleStrobe();
                  TopToast.show(
                    context,
                    message: isSirenOn
                        ? 'Đã tắt còi hú và đèn flash sinh tồn.'
                        : '🚨 ĐÃ BẬT CÒI HÚ & CHỚP ĐÈN SINH TỒN ĐỊNH VỊ NẠN NHÂN!',
                    icon: Icons.notifications_active_rounded,
                  );
                },
              ),
              const SizedBox(height: 8),

              // Nút 3: Loa Báo Động Quần Chúng Cứu Trợ (Bystander Broadcast)
              ValueListenableBuilder<bool>(
                valueListenable: _sirenService.bystanderVoiceNotifier,
                builder: (context, isVoiceOn, _) {
                  return _QuickActionCircleButton(
                    icon: isVoiceOn ? Icons.record_voice_over_rounded : Icons.voice_over_off_rounded,
                    color: isVoiceOn ? const Color(0xFFF43F5E) : const Color(0xFF64748B),
                    tooltip: isVoiceOn ? 'Tắt Loa Cứu Viện Quần Chúng' : 'Bật Loa Cứu Viện Quần Chúng (Song ngữ)',
                    onTap: () {
                      _sirenService.toggleBystanderBroadcast();
                      TopToast.show(
                        context,
                        message: _sirenService.bystanderVoiceNotifier.value
                            ? '📢 ĐÃ BẬT LOA BÁO ĐỘNG QUẦN CHÚNG XUNG QUANH HỖ TRỢ CẤP CỨU!'
                            : 'Đã tắt phát loa cứu viện quần chúng.',
                        icon: Icons.record_voice_over_rounded,
                      );
                    },
                  );
                },
              ),
              const SizedBox(height: 8),

              // Nút 4: Cẩm Nang Ép Tim CPR & Đột Quỵ FAST
              _QuickActionCircleButton(
                icon: Icons.favorite_rounded,
                color: const Color(0xFF10B981),
                tooltip: 'Sơ cứu CPR & FAST Metronome',
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute<void>(builder: (_) => const FirstAidGuidePage()),
                  );
                },
              ),
              const SizedBox(height: 8),

              // Nút 5: Thẻ Y Tế I.C.E
              _QuickActionCircleButton(
                icon: Icons.badge_rounded,
                color: const Color(0xFFA855F7),
                tooltip: 'Mở Thẻ Y tế I.C.E & SBAR QR',
                onTap: () => EmergencyIceSheet.show(context, incident: incident),
              ),
            ],
          ),
        );
      },
    );
  }

  /// 3. Bàn Tác Chiến Dưới Cùng (Cockpit & Chat)
  Widget _buildTacticalCockpit(
    BuildContext sheetContext,
    ScrollController scrollController, {
    required AppStrings strings,
    required RescueIncidentModel? incident,
    required String displayName,
  }) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF0F172A),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(
            color: Colors.black54,
            blurRadius: 20,
            offset: Offset(0, -4),
          ),
        ],
      ),
      child: ListView(
        controller: scrollController,
        padding: const EdgeInsets.fromLTRB(18, 12, 18, 24),
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 48,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(99),
              ),
            ),
          ),
          const SizedBox(height: 14),

          // TIẾN TRÌNH CỨU NẠN ĐA TẦNG (4-STAGE LIFECYCLE STEPPER)
          _buildDispatchStepper(incident),

          const SizedBox(height: 16),

          // THÔNG TIN HIỆP SĨ TIẾP CẬN (HERO STATUS CARD)
          _buildHeroDispatchCard(incident),

          const SizedBox(height: 16),

          // NÚT LỚN "TÔI ĐÃ AN TOÀN" (SAFE RESOLUTION BUTTON)
          _buildSafeResolveButton(sheetContext),

          const SizedBox(height: 20),
          const Divider(color: Colors.white12, height: 1),
          const SizedBox(height: 16),

          // KÊNH GIAO TIẾP TÁC CHIẾN & BỘ ĐÀM PTT
          Row(
            children: [
              const Icon(Icons.forum_rounded, color: Color(0xFF38BDF8), size: 18),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'KÊNH THÔNG TIN TÁC CHIẾN (WAR ROOM)',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.5,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              TextButton.icon(
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  visualDensity: VisualDensity.compact,
                ),
                icon: const Icon(Icons.wifi_off_rounded, size: 14, color: Colors.amber),
                label: const Text('SMS Dự phòng', style: TextStyle(color: Colors.amber, fontSize: 12)),
                onPressed: () => OfflineEmergencySheet.show(context),
              ),
            ],
          ),

          const SizedBox(height: 10),

          // Danh sách tin nhắn khẩn cấp
          for (final msg in _messages) ...[
            _EmergencyMessageTile(item: msg),
            const SizedBox(height: 8),
          ],

          const SizedBox(height: 12),

          // Hộp Voice Note PTT rảnh tay
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white10),
            ),
            child: Row(
              children: [
                const Icon(Icons.mic_rounded, color: Color(0xFF38BDF8)),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text(
                    'Giữ nút Bộ đàm để gửi voice note âm thanh hiện trường tới người thân và Hiệp sĩ:',
                    style: TextStyle(color: Colors.white70, fontSize: 12),
                  ),
                ),
                const SizedBox(width: 8),
                PushToTalkButton(
                  size: PushToTalkSize.medium,
                  onSend: (note) {
                    setState(() {
                      _voiceNote = note;
                      _messages.add(
                        _EmergencyMessage(
                          author: 'Bạn (Nạn nhân)',
                          text: 'Đã gửi ghi âm hiện trường (${note.durationSeconds}s)',
                          voiceSeconds: note.durationSeconds,
                        ),
                      );
                    });
                  },
                ),
              ],
            ),
          ),

          if (_voiceNote != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFF0284C7).withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF0284C7).withValues(alpha: 0.4)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.graphic_eq_rounded, color: Color(0xFF38BDF8)),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: VoiceWaveform(
                      bars: 26,
                      progress: 0.45,
                      height: 20,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    '${_voiceNote!.durationSeconds}s',
                    style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 12),

          // Ô nhập tin nhắn nhanh
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _chatController,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(
                    hintText: 'Nhắn tình trạng cho Hiệp sĩ & Người thân...',
                    hintStyle: const TextStyle(color: Colors.white38, fontSize: 13),
                    filled: true,
                    fillColor: const Color(0xFF1E293B),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filled(
                style: IconButton.styleFrom(
                  backgroundColor: const Color(0xFF38BDF8),
                  foregroundColor: const Color(0xFF0F172A),
                ),
                icon: const Icon(Icons.send_rounded),
                onPressed: () {
                  final text = _chatController.text.trim();
                  if (text.isEmpty) return;
                  setState(() {
                    _messages.add(
                      _EmergencyMessage(
                        author: 'Bạn (Nạn nhân)',
                        text: text,
                      ),
                    );
                    _chatController.clear();
                  });
                },
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// Tiến trình cứu nạn 4 bước chuẩn
  Widget _buildDispatchStepper(RescueIncidentModel? incident) {
    int currentStep = 1; // 0: Alerted, 1: Dispatching, 2: En Route, 3: On Scene
    if (incident != null) {
      if (incident.status == RescueIncidentStatus.onScene ||
          incident.status == RescueIncidentStatus.handedOver115) {
        currentStep = 3;
      } else if (incident.status == RescueIncidentStatus.enRoute ||
          incident.status == RescueIncidentStatus.accepted) {
        currentStep = 2;
      } else if (incident.status == RescueIncidentStatus.dispatchingR1 ||
          incident.status == RescueIncidentStatus.dispatchingR2) {
        currentStep = 1;
      } else {
        currentStep = 0;
      }
    }

    final steps = [
      '1. Phát lệnh',
      '2. Quét Hiệp sĩ',
      '3. Đang tiếp cận',
      '4. Sơ cứu / 115',
    ];

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  incident?.statusTitleVi ?? 'ĐANG ĐIỀU PHỐI HIỆP SĨ CỨU TRỢ',
                  style: TextStyle(
                    color: incident?.statusColor ?? const Color(0xFFEF4444),
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              const Icon(Icons.radar_rounded, color: Color(0xFF38BDF8), size: 16),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              for (int i = 0; i < steps.length; i++) ...[
                Expanded(
                  child: Column(
                    children: [
                      Container(
                        width: double.infinity,
                        height: 4,
                        decoration: BoxDecoration(
                          color: i <= currentStep
                              ? const Color(0xFF10B981)
                              : Colors.white12,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        steps[i],
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: i <= currentStep ? Colors.white : Colors.white38,
                          fontSize: 10,
                          fontWeight: i == currentStep ? FontWeight.bold : FontWeight.normal,
                        ),
                      ),
                    ],
                  ),
                ),
                if (i < steps.length - 1) const SizedBox(width: 4),
              ],
            ],
          ),
        ],
      ),
    );
  }

  /// Thẻ thông tin Hiệp sĩ
  Widget _buildHeroDispatchCard(RescueIncidentModel? incident) {
    final heroName = incident?.assignedVolunteerName ?? 'Lê Văn Hoàng (Hiệp sĩ BLS)';
    final heroPhone = incident?.assignedVolunteerPhone ?? '0918234567';
    final heroSkill = incident?.assignedVolunteerSkillTier ?? 'TIER_1_BLS';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            const Color(0xFF0284C7).withValues(alpha: 0.15),
            const Color(0xFF1E293B),
          ],
        ),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFF38BDF8).withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          const CircleAvatar(
            radius: 24,
            backgroundColor: Color(0xFF0284C7),
            child: Icon(Icons.shield_rounded, color: Colors.white, size: 26),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        heroName,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981).withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        heroSkill.replaceAll('TIER_', 'T'),
                        style: const TextStyle(
                          color: Color(0xFF34D399),
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                const Text(
                  'Đang di chuyển tiếp cận · Cách 420m (ETA 2.5 phút)',
                  style: TextStyle(color: Color(0xFF38BDF8), fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton.filled(
            style: IconButton.styleFrom(
              backgroundColor: const Color(0xFF10B981),
              foregroundColor: Colors.white,
            ),
            icon: const Icon(Icons.phone_in_talk_rounded, size: 20),
            onPressed: () => launchUrl(Uri.parse('tel:$heroPhone')),
          ),
        ],
      ),
    );
  }

  /// Nút Lớn "TÔI ĐÃ AN TOÀN"
  Widget _buildSafeResolveButton(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: ElevatedButton.icon(
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF10B981),
          foregroundColor: Colors.white,
          elevation: 4,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
        icon: const Icon(Icons.check_circle_rounded, size: 22),
        label: const Text(
          'TÔI ĐÃ AN TOÀN (NHẬP PIN HỦY SOS)',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            letterSpacing: 0.5,
          ),
        ),
        onPressed: () => _showPinDeescalationModal(context),
      ),
    );
  }

  /// Hộp thoại nhập mã PIN giải trừ an toàn (Real PIN vs Duress PIN)
  void _showPinDeescalationModal(BuildContext context) {
    final pinController = TextEditingController();
    final appProvider = context.read<AppProvider>();
    final duressPin = appProvider.security.duressPin.trim();

    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogCtx) {
        return AlertDialog(
          backgroundColor: const Color(0xFF1E293B),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Row(
            children: [
              Icon(Icons.lock_rounded, color: Color(0xFF38BDF8), size: 22),
              SizedBox(width: 8),
              Text(
                'Xác nhận Giải trừ SOS',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Nhập mã PIN an toàn để thông báo kết thúc ca cứu nạn hoặc mã ngụy trang khẩn cấp:',
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: pinController,
                obscureText: true,
                autofocus: true,
                keyboardType: TextInputType.number,
                maxLength: 6,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  letterSpacing: 6,
                ),
                textAlign: TextAlign.center,
                decoration: InputDecoration(
                  counterText: '',
                  hintText: '••••',
                  hintStyle: const TextStyle(color: Colors.white24),
                  filled: true,
                  fillColor: const Color(0xFF0F172A),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogCtx).pop(),
              child: const Text('QUAY LẠI', style: TextStyle(color: Colors.white54)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF10B981),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: () async {
                final input = pinController.text.trim();
                Navigator.of(dialogCtx).pop();

                // 1. KỊCH BẢN DURESS PIN (MÃ CƯỠNG BỨC): Bị kẻ xấu ép tắt
                if (duressPin.isNotEmpty && input == duressPin) {
                  unawaited(context.read<AppProvider>().triggerSilentSos());
                  unawaited(GhostModeService.instance.startGhostMode(triggerSource: 'DURESS_PIN'));
                  await _sirenService.stopAll();

                  if (!context.mounted) return;
                  TopToast.show(
                    context,
                    message: 'Đã hủy báo động an toàn.',
                    icon: Icons.check_circle_outline_rounded,
                  );
                  Navigator.of(context).pop();
                  return;
                }

                // 2. GIẢI TRỪ THẬT VỚI REAL PIN
                try {
                  final success = await context.read<AppProvider>().resolveActiveRescueIncident(pin: input);
                  if (success) {
                    await _sirenService.stopAll();
                    if (!context.mounted) return;
                    TopToast.show(
                      context,
                      message: 'Đã hoàn tất ca cứu hộ. Trạng thái người dùng chuyển về AN TOÀN!',
                      icon: Icons.verified_user_rounded,
                    );
                    Navigator.of(context).pop();
                  }
                } catch (e) {
                  if (!context.mounted) return;
                  TopToast.show(
                    context,
                    message: e.toString().replaceAll('Exception: ', ''),
                    icon: Icons.error_outline_rounded,
                  );
                }
              },
              child: const Text('XÁC NHẬN AN TOÀN'),
            ),
          ],
        );
      },
    );
  }

  void _handleSafeExitPrompt(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (dialogCtx) {
        return AlertDialog(
          backgroundColor: const Color(0xFF1E293B),
          title: const Text('Thoát Bàn Tác Chiến?', style: TextStyle(color: Colors.white)),
          content: const Text(
            'Báo động SOS vẫn đang hoạt động chạy ngầm dưới nền để bảo vệ bạn. Bạn có muốn thu nhỏ màn hình bản đồ?',
            style: TextStyle(color: Color(0xFF94A3B8)),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogCtx).pop(),
              child: const Text('Ở LẠI', style: TextStyle(color: Colors.white54)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF38BDF8)),
              onPressed: () {
                Navigator.of(dialogCtx).pop();
                Navigator.of(context).pop();
              },
              child: const Text('THU NHỎ VỀ HOME', style: TextStyle(color: Color(0xFF0F172A))),
            ),
          ],
        );
      },
    );
  }
}

class _QuickActionCircleButton extends StatelessWidget {
  const _QuickActionCircleButton({
    required this.icon,
    required this.color,
    required this.tooltip,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.18),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color.withValues(alpha: 0.4)),
          ),
          child: Icon(icon, color: color, size: 22),
        ),
      ),
    );
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

class _EmergencyMessageTile extends StatelessWidget {
  const _EmergencyMessageTile({required this.item});

  final _EmergencyMessage item;

  @override
  Widget build(BuildContext context) {
    if (item.system) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.white10),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.info_outline_rounded, color: Color(0xFF38BDF8), size: 16),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                item.text,
                style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
              ),
            ),
          ],
        ),
      );
    }

    final isMe = item.author.contains('Bạn');
    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isMe ? const Color(0xFF0284C7) : const Color(0xFF334155),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              item.author,
              style: TextStyle(
                color: isMe ? Colors.white70 : const Color(0xFF38BDF8),
                fontSize: 10,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              item.text,
              style: const TextStyle(color: Colors.white, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}
