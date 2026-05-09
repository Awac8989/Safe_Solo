import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../core/app_theme.dart';

class CommunityRadarPage extends StatefulWidget {
  const CommunityRadarPage({
    super.key,
    this.reason = 'Cap cuu y te',
    this.note = 'Nguoi cao tuoi dang can ho tro gap',
  });

  final String reason;
  final String note;

  @override
  State<CommunityRadarPage> createState() => _CommunityRadarPageState();
}

class _CommunityRadarPageState extends State<CommunityRadarPage>
    with SingleTickerProviderStateMixin {
  bool _accepted = false;
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
                  const Marker(
                    markerId: MarkerId('victim'),
                    position: victim,
                    infoWindow: InfoWindow(title: '≈ Q.7, TP.HCM'),
                  ),
                  if (_accepted)
                    const Marker(
                      markerId: MarkerId('volunteer'),
                      position: me,
                      infoWindow: InfoWindow(title: 'Tinh nguyen vien'),
                    ),
                },
              ),
            ),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(18),
              decoration: const BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xxl)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Vi tri an danh', style: AppTextStyles.caption),
                  const SizedBox(height: 6),
                  Text(
                    _accepted ? '123 Nguyen Huu Tho, Q.7, TP.HCM' : '≈ Q.7, TP.HCM',
                    style: AppTextStyles.title,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _accepted
                        ? 'Trang thai: Dang tren duong · ETA 6 phut'
                        : 'Dia chi chinh xac chi mo sau khi xac minh KYC va nhan loi.',
                    style: AppTextStyles.body.copyWith(color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _accepted ? null : _confirmKyc,
                      child: Text(_accepted ? 'Dang tren duong' : 'TOI SE DI CUU'),
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
    final accepted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Xac minh KYC'),
        content: const Text(
          'Vui long xac nhan ban da co CCCD/KYC hop le truoc khi nhan ca cuu ho nay.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Chua san sang'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Da xac minh'),
          ),
        ],
      ),
    );

    if (accepted == true) {
      setState(() => _accepted = true);
    }
  }
}
