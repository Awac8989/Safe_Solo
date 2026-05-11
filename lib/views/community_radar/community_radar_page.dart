import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:provider/provider.dart';

import '../../core/app_strings.dart';
import '../../core/app_theme.dart';
import '../../core/constants.dart';
import '../../core/maptiler_tile_provider.dart';
import '../../core/providers/app_provider.dart';

class CommunityRadarPage extends StatefulWidget {
  const CommunityRadarPage({
    super.key,
    this.reason = 'Cấp cứu y tế',
    this.note = 'Người cao tuổi đang cần hỗ trợ gấp',
  });

  final String reason;
  final String note;

  @override
  State<CommunityRadarPage> createState() => _CommunityRadarPageState();
}

class _CommunityRadarPageState extends State<CommunityRadarPage>
    with SingleTickerProviderStateMixin {
  bool _accepted = false;
  AppStrings _strings(BuildContext context) =>
      AppStrings(context.read<AppProvider>().language);
  late final AnimationController _blink = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _blink.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final strings = _strings(context);
    const victim = LatLng(10.7766, 106.7009);
    const me = LatLng(10.7818, 106.6968);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            FadeTransition(
              opacity: Tween(begin: 0.45, end: 1.0).animate(_blink),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
                decoration: BoxDecoration(
                  gradient: AppColors.warnGradient,
                  boxShadow: AppShadows.warn,
                ),
                child: Row(
                  children: [
                    const Icon(Icons.campaign_rounded, color: Colors.white),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.reason,
                            style: AppTextStyles.title.copyWith(color: Colors.white),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            widget.note,
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
              child: GoogleMap(
                initialCameraPosition: const CameraPosition(
                  target: victim,
                  zoom: 14.5,
                ),
                mapToolbarEnabled: false,
                myLocationButtonEnabled: false,
                myLocationEnabled: false,
                tileOverlays: AppConstants.hasMapTiler
                    ? {
                        TileOverlay(
                          tileOverlayId: const TileOverlayId('maptiler_radar'),
                          tileProvider: MapTilerTileProvider(),
                          transparency: 0.05,
                          zIndex: 1,
                        ),
                      }
                    : {},
                circles: {
                  const Circle(
                    circleId: CircleId('danger'),
                    center: victim,
                    radius: 50,
                    fillColor: Color(0x44F05454),
                    strokeColor: AppColors.destructive,
                    strokeWidth: 2,
                  ),
                },
                polylines: _accepted
                    ? {
                        const Polyline(
                          polylineId: PolylineId('route'),
                          points: [me, victim],
                          color: AppColors.primary,
                          width: 5,
                        ),
                      }
                    : {},
                markers: {
                  Marker(
                    markerId: const MarkerId('victim'),
                    position: victim,
                    infoWindow: InfoWindow(
                      title: strings.text(
                        '≈ Q.7, TP.HCM',
                        '≈ District 7, Ho Chi Minh City',
                      ),
                    ),
                  ),
                  if (_accepted)
                    const Marker(
                      markerId: MarkerId('volunteer'),
                      position: me,
                      infoWindow: InfoWindow(title: 'Volunteer'),
                    ),
                },
              ),
            ),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(18),
              decoration: const BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.vertical(
                  top: Radius.circular(AppRadius.xxl),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    strings.text('Vị trí ẩn danh', 'Anonymous location'),
                    style: AppTextStyles.caption,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _accepted
                        ? '123 Nguyen Huu Tho, Q.7, TP.HCM'
                        : strings.text(
                            '≈ Q.7, TP.HCM',
                            '≈ District 7, Ho Chi Minh City',
                          ),
                    style: AppTextStyles.title,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _accepted
                        ? strings.text(
                            'Trạng thái: Đang trên đường · ETA 6 phút',
                            'Status: On the way · ETA 6 minutes',
                          )
                        : strings.text(
                            'Địa chỉ chính xác chỉ mở sau khi xác minh KYC và nhận lời.',
                            'The exact address is revealed only after KYC verification and acceptance.',
                          ),
                    style: AppTextStyles.body.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _accepted ? null : _confirmKyc,
                      child: Text(
                        _accepted
                            ? strings.text('Đang trên đường', 'On the way')
                            : strings.text('TÔI SẼ ĐI CỨU', 'I WILL RESPOND'),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmKyc() async {
    final strings = _strings(context);
    final accepted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(strings.text('Xác minh KYC', 'KYC verification')),
        content: Text(
          strings.text(
            'Vui lòng xác nhận bạn đã có CCCD/KYC hợp lệ trước khi nhận ca cứu hộ này.',
            'Please confirm that you have valid ID/KYC before accepting this rescue.',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(strings.text('Chưa sẵn sàng', 'Not yet')),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text(strings.text('Đã xác minh', 'Verified')),
          ),
        ],
      ),
    );

    if (accepted == true) {
      setState(() => _accepted = true);
    }
  }
}
