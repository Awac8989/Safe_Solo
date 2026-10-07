import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/widgets/top_toast.dart';
import '../../services/ghost_mode_service.dart';

/// ============================================================================
/// SAFESOLO - BẢNG ĐIỀU KHIỂN VẾT TÍCH TRINH SÁT BÓNG MA & HỘP ĐEN ÂM THANH
/// (Ghost Mode Live Breadcrumbs & Covert Audio Radar Sheet)
///
/// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03
/// Phục vụ: Giám sát lộ trình di chuyển tẩu thoát thời gian thực của nạn nhân
/// trong tình huống bị bắt cóc/cưỡng bức (Duress PIN), vẽ vệt đường GPS/PDR
/// và truyền nhận bằng chứng Hộp đen âm thanh 15 giây liên tục lên Web Admin.
/// ============================================================================

class GhostBreadcrumbsSheet extends StatefulWidget {
  const GhostBreadcrumbsSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const GhostBreadcrumbsSheet(),
    );
  }

  @override
  State<GhostBreadcrumbsSheet> createState() => _GhostBreadcrumbsSheetState();
}

class _GhostBreadcrumbsSheetState extends State<GhostBreadcrumbsSheet>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: GhostModeService.instance,
      builder: (context, _) {
        final ghost = GhostModeService.instance;
        final waypoints = ghost.breadcrumbs;
        final currentWpt = ghost.currentWaypoint;
        final isActive = ghost.isGhostModeActive;

        return DraggableScrollableSheet(
          initialChildSize: 0.90,
          maxChildSize: 0.96,
          minChildSize: 0.50,
          builder: (context, scrollController) {
            return Container(
              decoration: const BoxDecoration(
                color: Color(0xFF090D1A),
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                border: Border(
                  top: BorderSide(color: Color(0xFF8B5CF6), width: 2),
                ),
              ),
              child: ListView(
                controller: scrollController,
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                children: [
                  // Thanh kéo handle
                  Center(
                    child: Container(
                      width: 48,
                      height: 5,
                      decoration: BoxDecoration(
                        color: Colors.white24,
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),

                  // HEADER TÁC CHIẾN
                  _buildHeader(isActive: isActive, ghost: ghost),
                  const SizedBox(height: 14),

                  // VECTOR RADAR TRAIL CANVAS (BẢN ĐỒ VẾT TÍCH TRINH SÁT)
                  _buildRadarTrailCanvas(waypoints: waypoints),
                  const SizedBox(height: 14),

                  // BẢNG ĐO LƯỜNG TÁC CHIẾN (TELEMETRY MATRIX)
                  _buildTelemetryMatrix(currentWpt: currentWpt, ghost: ghost),
                  const SizedBox(height: 14),

                  // KỊCH BẢN THAO TÁC HỘI ĐỒNG
                  _buildActionControls(ghost: ghost, isActive: isActive),
                  const SizedBox(height: 18),

                  // DANH SÁCH CÁC TRẠM VẾT TÍCH (WAYPOINTS LOG)
                  _buildWaypointsList(waypoints: waypoints),
                  const SizedBox(height: 24),

                  // NẾU KÉT SẮT ẢO ĐANG BẬT
                  if (ghost.isDecoyVaultShown) _buildDecoyVaultPreview(ghost: ghost),
                ],
              ),
            );
          },
        );
      },
    );
  }

  // ===========================================================================
  // WIDGETS CON
  // ===========================================================================

  Widget _buildHeader({required bool isActive, required GhostModeService ghost}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFF8B5CF6).withValues(alpha: 0.2),
                shape: BoxShape.circle,
                border: Border.all(
                  color: const Color(0xFF8B5CF6).withValues(alpha: 0.5),
                ),
              ),
              child: const Icon(
                Icons.visibility_off_rounded,
                color: Color(0xFFA78BFA),
                size: 22,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Text(
                        'ĐỘT PHÁ 5: GHOST BREADCRUMBS',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.8,
                          color: Color(0xFFA78BFA),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding:
                            const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: isActive
                              ? const Color(0xFFEF4444).withValues(alpha: 0.25)
                              : Colors.white10,
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(
                            color: isActive
                                ? const Color(0xFFEF4444)
                                : Colors.white24,
                          ),
                        ),
                        child: Text(
                          isActive ? 'COVERT ACTIVE' : 'STANDBY',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                            color: isActive
                                ? const Color(0xFFEF4444)
                                : Colors.white60,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  const Text(
                    'Vết Tích Trinh Sát & Hộp Đen Âm Thanh',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        const Text(
          'Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03 • Khóa Luận Tốt Nghiệp',
          style: TextStyle(
            fontSize: 10.5,
            color: Color(0xFF94A3B8),
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildRadarTrailCanvas({
    required List<BreadcrumbWaypoint> waypoints,
  }) {
    return Container(
      height: 220,
      decoration: BoxDecoration(
        color: const Color(0xFF0D1527),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF8B5CF6).withValues(alpha: 0.3)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF8B5CF6).withValues(alpha: 0.1),
            blurRadius: 16,
            spreadRadius: 2,
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Stack(
          children: [
            // Custom Painter vẽ lưới radar & vệt đường nối waypoints
            AnimatedBuilder(
              animation: _pulseController,
              builder: (context, _) {
                return CustomPaint(
                  size: const Size(double.infinity, 220),
                  painter: _BreadcrumbsRadarPainter(
                    waypoints: waypoints,
                    pulseValue: _pulseController.value,
                  ),
                );
              },
            ),

            // Nhãn HUD góc trên
            Positioned(
              top: 10,
              left: 12,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.6),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: Colors.white12),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.radar_rounded, size: 12, color: Color(0xFFA78BFA)),
                    const SizedBox(width: 4),
                    Text(
                      'TACTICAL PDR TRAIL (${waypoints.length} WAYPOINTS)',
                      style: const TextStyle(
                        fontSize: 9.5,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFFA78BFA),
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Nhãn hiển thị độ phóng cự ly góc dưới
            Positioned(
              bottom: 10,
              right: 12,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text(
                  'Phạm vi quét: 1.2 km²  •  Lưới 200m',
                  style: TextStyle(
                    fontSize: 9,
                    color: Color(0xFF94A3B8),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTelemetryMatrix({
    required BreadcrumbWaypoint? currentWpt,
    required GhostModeService ghost,
  }) {
    final speed = currentWpt?.speedKmh ?? 0.0;
    final heading = currentWpt?.headingCardinal ?? 'Đông (E)';
    final altitude = currentWpt?.altitudeMeters ?? 12.0;
    final isUnderground = altitude < 0.0;
    final evidenceCount = ghost.totalEvidenceUploadedCount;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF131D35),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: _buildTelemetryCell(
                  icon: Icons.speed_rounded,
                  iconColor: const Color(0xFFF59E0B),
                  title: 'TỐC ĐỘ DI CHUYỂN',
                  value: '${speed.toStringAsFixed(1)} km/h',
                  subtitle: speed > 30 ? 'Xe di chuyển nhanh' : (speed > 5 ? 'Đang chạy' : 'Đứng yên/Khuất'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildTelemetryCell(
                  icon: Icons.explore_rounded,
                  iconColor: const Color(0xFF60A5FA),
                  title: 'HƯỚNG LA BÀN',
                  value: '${currentWpt?.headingDegrees.toStringAsFixed(0) ?? '0'}°',
                  subtitle: heading,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _buildTelemetryCell(
                  icon: Icons.layers_rounded,
                  iconColor: isUnderground ? const Color(0xFFEF4444) : const Color(0xFF38EF7D),
                  title: 'ĐỘ CAO PDR',
                  value: '${altitude >= 0 ? '+' : ''}${altitude.toStringAsFixed(1)} m',
                  subtitle: isUnderground ? 'KẸT HẦM B2 KHÔNG SÓNG' : 'Mặt đất thông thoáng',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildTelemetryCell(
                  icon: Icons.mic_external_on_rounded,
                  iconColor: const Color(0xFFA78BFA),
                  title: 'HỘP ĐEN ÂM THANH',
                  value: '$evidenceCount GÓI ĐÃ TẢI',
                  subtitle: 'Chu kỳ 15s ghi ngầm Web Admin',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTelemetryCell({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String value,
    required String subtitle,
  }) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFF1A2644),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: iconColor, size: 14),
              const SizedBox(width: 5),
              Expanded(
                child: Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 9.5,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF94A3B8),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w900,
              color: Colors.white,
            ),
          ),
          Text(
            subtitle,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 9.5,
              fontWeight: FontWeight.w500,
              color: iconColor,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionControls({
    required GhostModeService ghost,
    required bool isActive,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'THAO TÁC MÔ PHỎNG HỘI ĐỒNG (TACTICAL DEMO ACTIONS):',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            letterSpacing: 0.6,
            color: Color(0xFFCBD5E1),
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _buildTacticalButton(
              icon: Icons.directions_car_rounded,
              label: '🚗 Mô Phỏng Bị Ép Buộc (6 Trạm Q.1)',
              color: const Color(0xFFF59E0B),
              onTap: () {
                HapticFeedback.mediumImpact();
                ghost.simulateKidnapMovementRoute();
                TopToast.show(
                  context,
                  message: 'Đã kích hoạt mô phỏng tuyến đường tẩu thoát 6 trạm!',
                  icon: Icons.directions_car_rounded,
                );
              },
            ),
            _buildTacticalButton(
              icon: Icons.cloud_upload_rounded,
              label: '🎙️ Ghi Âm & Uplink Hộp Đen Ngầm',
              color: const Color(0xFFA78BFA),
              onTap: () async {
                HapticFeedback.lightImpact();
                await ghost.startGhostMode(triggerSource: 'DURESS_PIN');
                if (!mounted) return;
                TopToast.show(
                  context,
                  message: 'Đã gửi bằng chứng hộp đen ngầm 15s lên Web Admin!',
                  icon: Icons.lock_clock_rounded,
                );
              },
            ),
            _buildTacticalButton(
              icon: Icons.shield_outlined,
              label: ghost.isDecoyVaultShown
                  ? '🔒 Đóng Két Sắt Giả (Decoy Vault)'
                  : '🛡️ Trình Diễn Két Sắt Giả (Decoy Vault)',
              color: const Color(0xFF38EF7D),
              onTap: () {
                ghost.toggleDecoyVault(!ghost.isDecoyVaultShown);
              },
            ),
            _buildTacticalButton(
              icon: isActive ? Icons.stop_circle_rounded : Icons.play_circle_rounded,
              label: isActive ? '⏹️ Tắt Chế Độ Bóng Ma' : '▶️ Bật Chế Độ Bóng Ma',
              color: isActive ? const Color(0xFFEF4444) : const Color(0xFF60A5FA),
              onTap: () {
                if (isActive) {
                  ghost.stopGhostMode();
                  TopToast.show(context, message: 'Đã dừng theo dõi bóng ma.');
                } else {
                  ghost.startGhostMode(triggerSource: 'DURESS_PIN');
                  TopToast.show(context, message: 'Đã bật theo dõi bóng ma!');
                }
              },
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildTacticalButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withValues(alpha: 0.4)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWaypointsList({required List<BreadcrumbWaypoint> waypoints}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'NHẬT KÝ VẾT TÍCH TRINH SÁT (BREADCRUMB TIMELINE):',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.6,
                color: Color(0xFFCBD5E1),
              ),
            ),
            Text(
              '${waypoints.length} Điểm',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: Color(0xFFA78BFA),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ...waypoints.reversed.map((wpt) {
          final isRecent = wpt == waypoints.last;
          final isUnderground = wpt.altitudeMeters < 0;

          return Container(
            margin: const EdgeInsets.only(bottom: 6),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: isRecent
                  ? const Color(0xFF8B5CF6).withValues(alpha: 0.15)
                  : const Color(0xFF131D35),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: isRecent
                    ? const Color(0xFF8B5CF6).withValues(alpha: 0.4)
                    : Colors.white.withValues(alpha: 0.05),
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: isRecent
                        ? const Color(0xFF8B5CF6)
                        : (isUnderground ? const Color(0xFFEF4444) : Colors.white12),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Icon(
                      isRecent
                          ? Icons.my_location_rounded
                          : (isUnderground ? Icons.warning_rounded : Icons.location_on_rounded),
                      size: 14,
                      color: Colors.white,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              wpt.locationName,
                              style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.bold,
                                color: isRecent ? Colors.white : const Color(0xFFE2E8F0),
                              ),
                            ),
                          ),
                          Text(
                            wpt.timeFormatted,
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF94A3B8),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Tọa độ: ${wpt.coordinateFormatted}  •  Tốc độ: ${wpt.speedKmh.toStringAsFixed(1)} km/h  •  Độ cao: ${wpt.altitudeMeters.toStringAsFixed(1)}m',
                        style: TextStyle(
                          fontSize: 10,
                          color: isUnderground ? const Color(0xFFFCA5A5) : const Color(0xFF94A3B8),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        }),
      ],
    );
  }

  Widget _buildDecoyVaultPreview({required GhostModeService ghost}) {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF38EF7D).withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.shield_rounded, color: Color(0xFF38EF7D), size: 18),
              const SizedBox(width: 8),
              const Text(
                'KÉT SẮT NGỤY TRANG (DECOY DUMMY VAULT)',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF38EF7D),
                  letterSpacing: 0.6,
                ),
              ),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.close, size: 16, color: Colors.white70),
                onPressed: () => ghost.toggleDecoyVault(false),
              ),
            ],
          ),
          const Text(
            'Hồ sơ giả lập hiển thị khi nạn nhân bị kẻ xấu cưỡng bức mở điện thoại. Dữ liệu y tế và nhật ký thật được mã hóa bảo vệ tuyệt đối.',
            style: TextStyle(fontSize: 11, color: Color(0xFFCBD5E1)),
          ),
          const SizedBox(height: 8),
          ...ghost.decoyMedicalRecords.map((item) {
            return Container(
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.black26,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item['title'] ?? '',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  Text(
                    '${item['date']} • ${item['doctor']}',
                    style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
                  ),
                  Text(
                    item['note'] ?? '',
                    style: const TextStyle(fontSize: 10, color: Color(0xFFCBD5E1)),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

/// ============================================================================
/// RADAR VECTOR PAINTER: VẼ TUYẾN ĐƯỜNG VẾT TÍCH BẰNG GRADIENT & SÓNG RADAR
/// ============================================================================

class _BreadcrumbsRadarPainter extends CustomPainter {
  _BreadcrumbsRadarPainter({
    required this.waypoints,
    required this.pulseValue,
  });

  final List<BreadcrumbWaypoint> waypoints;
  final double pulseValue;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final maxRadius = math.min(size.width, size.height) * 0.45;

    // 1. Vẽ các vòng tròn radar đồng tâm
    final gridPaint = Paint()
      ..color = const Color(0xFF8B5CF6).withValues(alpha: 0.12)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;

    for (int i = 1; i <= 3; i++) {
      final r = maxRadius * (i / 3.0);
      canvas.drawCircle(center, r, gridPaint);
    }

    // 2. Vẽ 2 trục chữ thập radar
    canvas.drawLine(
      Offset(center.dx - maxRadius, center.dy),
      Offset(center.dx + maxRadius, center.dy),
      gridPaint,
    );
    canvas.drawLine(
      Offset(center.dx, center.dy - maxRadius),
      Offset(center.dx, center.dy + maxRadius),
      gridPaint,
    );

    // 3. Nếu có ít nhất 1 waypoint, tính toán ánh xạ tọa độ lên canvas
    if (waypoints.isEmpty) return;

    double minLat = waypoints.first.latitude;
    double maxLat = waypoints.first.latitude;
    double minLng = waypoints.first.longitude;
    double maxLng = waypoints.first.longitude;

    for (final wpt in waypoints) {
      if (wpt.latitude < minLat) minLat = wpt.latitude;
      if (wpt.latitude > maxLat) maxLat = wpt.latitude;
      if (wpt.longitude < minLng) minLng = wpt.longitude;
      if (wpt.longitude > maxLng) maxLng = wpt.longitude;
    }

    final latSpan = math.max(0.001, maxLat - minLat);
    final lngSpan = math.max(0.001, maxLng - minLng);

    Offset mapToCanvas(BreadcrumbWaypoint wpt) {
      final normX = (wpt.longitude - minLng) / lngSpan;
      final normY = 1.0 - ((wpt.latitude - minLat) / latSpan); // Đảo trục Y cho kinh độ vĩ độ
      final x = (size.width * 0.15) + normX * (size.width * 0.70);
      final y = (size.height * 0.18) + normY * (size.height * 0.64);
      return Offset(x, y);
    }

    final mappedPoints = waypoints.map(mapToCanvas).toList();

    // 4. Vẽ đường nối vệt di chuyển (Breadcrumbs Path)
    if (mappedPoints.length >= 2) {
      final path = Path();
      path.moveTo(mappedPoints.first.dx, mappedPoints.first.dy);
      for (int i = 1; i < mappedPoints.length; i++) {
        path.lineTo(mappedPoints[i].dx, mappedPoints[i].dy);
      }

      final pathPaint = Paint()
        ..shader = const LinearGradient(
          colors: [Color(0xFF38EF7D), Color(0xFFF59E0B), Color(0xFF8B5CF6)],
        ).createShader(Rect.fromLTWH(0, 0, size.width, size.height))
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3.0
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round;

      canvas.drawPath(path, pathPaint);
    }

    // 5. Vẽ các chấm waypoint
    for (int i = 0; i < mappedPoints.length; i++) {
      final pt = mappedPoints[i];
      final isLast = i == mappedPoints.length - 1;
      final isFirst = i == 0;

      if (isFirst) {
        // Điểm xuất phát
        canvas.drawCircle(pt, 5, Paint()..color = const Color(0xFF38EF7D));
      } else if (!isLast) {
        // Điểm trung gian
        canvas.drawCircle(pt, 3.5, Paint()..color = const Color(0xFFF59E0B));
      } else {
        // Điểm hiện tại (Vị trí mới nhất): Vẽ vòng sóng radar tỏa xung nhịp
        final pulseRadius = 7.0 + (pulseValue * 14.0);
        final pulsePaint = Paint()
          ..color = const Color(0xFF8B5CF6).withValues(alpha: (1.0 - pulseValue) * 0.8)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.0;

        canvas.drawCircle(pt, pulseRadius, pulsePaint);
        canvas.drawCircle(pt, 6, Paint()..color = const Color(0xFFA78BFA));
        canvas.drawCircle(pt, 3, Paint()..color = Colors.white);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _BreadcrumbsRadarPainter oldDelegate) {
    return oldDelegate.pulseValue != pulseValue ||
        oldDelegate.waypoints.length != waypoints.length;
  }
}
