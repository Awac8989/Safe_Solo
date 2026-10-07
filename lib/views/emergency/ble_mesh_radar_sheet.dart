import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/widgets/top_toast.dart';
import '../../services/ble_mesh_relay_service.dart';

/// ============================================================================
/// SAFESOLO - RADAR MẠNG LƯỚI CỨU HỘ DÃ CHIẾN BLE MESH
/// (BLE Mesh Store-and-Forward Emergency Multi-Hop Radar Sheet)
///
/// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03
/// Phục vụ: Trực quan hóa đường truyền đa chặng từ tầng hầm mất sóng lên Web Admin
/// ============================================================================

class BleMeshRadarSheet extends StatefulWidget {
  const BleMeshRadarSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => const BleMeshRadarSheet(),
    );
  }

  @override
  State<BleMeshRadarSheet> createState() => _BleMeshRadarSheetState();
}

class _BleMeshRadarSheetState extends State<BleMeshRadarSheet>
    with SingleTickerProviderStateMixin {
  late final AnimationController _radarController = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 3),
  )..repeat();

  @override
  void initState() {
    super.initState();
    BleMeshRelayService.instance.addListener(_onMeshUpdate);
  }

  void _onMeshUpdate() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    BleMeshRelayService.instance.removeListener(_onMeshUpdate);
    _radarController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final mesh = BleMeshRelayService.instance;
    final size = MediaQuery.of(context).size;
    final hasPackets = mesh.vaultPackets.isNotEmpty;
    final activePacket = hasPackets ? mesh.vaultPackets.first : null;

    return Container(
      height: size.height * 0.88,
      decoration: const BoxDecoration(
        color: Color(0xFF0A0F1D),
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        children: [
          // Drag handle
          const SizedBox(height: 12),
          Container(
            width: 44,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.white24,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 14),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF38EF7D).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: const Color(0xFF38EF7D).withValues(alpha: 0.35),
                    ),
                  ),
                  child: const Icon(
                    Icons.hub_rounded,
                    color: Color(0xFF38EF7D),
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
                          const Flexible(
                            child: Text(
                              'ĐỘT PHÁ 3: BLE MESH RELAY',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.6,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFF38EF7D).withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              mesh.isMeshActive ? 'MESH ACTIVE' : 'STANDBY',
                              style: const TextStyle(
                                color: Color(0xFF38EF7D),
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'Mạng Cứu Hộ Dã Chiến Đa Chặng Khi Mất Sóng 4G',
                        style: TextStyle(
                          color: Color(0xFF94A3B8),
                          fontSize: 11,
                        ),
                        overflow: TextOverflow.ellipsis,
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
          ),
          const SizedBox(height: 10),

          // Main Scrollable Body
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                // 1. Radar Pulse Animation Canvas
                Center(
                  child: SizedBox(
                    width: 200,
                    height: 200,
                    child: AnimatedBuilder(
                      animation: _radarController,
                      builder: (context, _) {
                        return CustomPaint(
                          painter: _MeshRadarCanvasPainter(
                            sweepProgress: _radarController.value,
                            peers: mesh.discoveredPeers,
                            isDelivered: activePacket?.isDelivered ?? false,
                          ),
                        );
                      },
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Radar metrics summary
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF131D35),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.white10),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildMiniMetric(
                        label: 'NỐT TRONG TẦM',
                        value: '${mesh.discoveredPeers.length} nốt',
                        color: const Color(0xFF38EF7D),
                      ),
                      _buildMiniMetric(
                        label: 'BÁN KÍNH BLE',
                        value: '~50-80m',
                        color: const Color(0xFF60A5FA),
                      ),
                      _buildMiniMetric(
                        label: 'TỶ LỆ CHUYỂN TIẾP',
                        value: '${mesh.deliveryRatePercent.toStringAsFixed(0)}%',
                        color: const Color(0xFFFBBF24),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),

                // 2. Multi-hop Journey Stepper Card
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF131D35),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: activePacket?.isDelivered == true
                          ? const Color(0xFF38EF7D).withValues(alpha: 0.4)
                          : const Color(0xFFEF4444).withValues(alpha: 0.3),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'LỘ TRÌNH CHUYỂN TIẾP ĐA CHẶNG (STORE & FORWARD):',
                            style: TextStyle(
                              color: Color(0xFF94A3B8),
                              fontSize: 10.5,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            activePacket?.formattedStatusVi ?? 'Chưa phát gói tin',
                            style: TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.bold,
                              color: activePacket?.isDelivered == true
                                  ? const Color(0xFF38EF7D)
                                  : const Color(0xFFEF4444),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),

                      // Chặng 0: Nguồn phát
                      _buildJourneyStepRow(
                        hopNumber: '0',
                        title: 'Nạn nhân kẹt tầng hầm (Mất 4G / Offline)',
                        subtitle: activePacket != null
                            ? '${activePacket.victimName} • ${activePacket.pdrFloor} (PDR) • ${activePacket.incidentType}'
                            : 'Chờ kích hoạt tín hiệu cứu nạn dã chiến...',
                        isComplete: activePacket != null,
                        color: const Color(0xFFEF4444),
                        icon: Icons.person_pin_circle_rounded,
                      ),
                      _buildConnectorLine(activePacket != null),

                      // Chặng 1: Nốt trung gian tiếp sức
                      _buildJourneyStepRow(
                        hopNumber: '1',
                        title: 'Nốt chuyển tiếp (Người đi đường / Companion Node)',
                        subtitle: activePacket != null && activePacket.hopCount >= 1
                            ? 'Galaxy S23 tiếp nhận qua BLE Mesh Store • Mang lên mặt đất'
                            : 'Đang phát sóng BLE Coded tìm thiết bị lướt qua tiếp sức...',
                        isComplete: activePacket != null && activePacket.hopCount >= 1,
                        color: const Color(0xFFF59E0B),
                        icon: Icons.cell_tower_rounded,
                      ),
                      _buildConnectorLine(activePacket?.isDelivered == true),

                      // Chặng 2: Trạm Cứu hộ Đám mây / Web Admin
                      _buildJourneyStepRow(
                        hopNumber: '2',
                        title: 'Web Admin & Trung tâm Cứu hộ 115',
                        subtitle: activePacket?.isDelivered == true
                            ? 'ĐÃ NHẬN GÓI TIN! Tọa độ Hầm B2 & Telemetry đã hiển thị trên Bản đồ Web'
                            : 'Chờ nốt trung gian chạm vùng có sóng 4G để Uplink...',
                        isComplete: activePacket?.isDelivered == true,
                        color: const Color(0xFF38EF7D),
                        icon: Icons.cloud_done_rounded,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),

                // 3. Action & Simulation Buttons Bar
                ElevatedButton.icon(
                  onPressed: () async {
                    HapticFeedback.heavyImpact();
                    await mesh.simulateBasementEntrapmentSos();
                    if (!mounted) return;
                    TopToast.show(
                      context,
                      message: 'Đã phát sóng cứu hộ dã chiến BLE Mesh từ Tầng hầm B2!',
                      icon: Icons.sensors_rounded,
                    );
                  },
                  icon: const Icon(Icons.emergency_rounded, size: 20),
                  label: const Text(
                    '💥 Kích Hoạt SOS Kẹt Hầm B2 (Mất Hoàn Toàn 4G)',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFEF4444),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
                const SizedBox(height: 10),

                ElevatedButton.icon(
                  onPressed: () async {
                    HapticFeedback.mediumImpact();
                    await mesh.simulatePeerRelayBridge(peerReaches4g: true);
                    if (!mounted) return;
                    TopToast.show(
                      context,
                      message: 'Nốt Galaxy S23 đã nhận tin và chuyển tiếp lên Web Admin!',
                      icon: Icons.verified_rounded,
                    );
                  },
                  icon: const Icon(Icons.share_arrival_time_rounded, size: 20),
                  label: const Text(
                    '🧪 Giả Lập Nốt Tiếp Sức Lên Mặt Đất Có 4G -> Uplink Cloud',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
                const SizedBox(height: 10),

                OutlinedButton.icon(
                  onPressed: () {
                    mesh.resetMeshDemo();
                    if (mounted) {
                      TopToast.show(
                        context,
                        message: 'Đã khôi phục trạng thái mạng Mesh!',
                        icon: Icons.refresh_rounded,
                      );
                    }
                  },
                  icon: const Icon(Icons.refresh_rounded, color: Color(0xFF94A3B8)),
                  label: const Text(
                    'Khôi Phục Trạng Thái Ban Đầu',
                    style: TextStyle(color: Color(0xFF94A3B8)),
                  ),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Colors.white24),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMiniMetric({
    required String label,
    required String value,
    required Color color,
  }) {
    return Column(
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 9,
            color: Color(0xFF94A3B8),
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w800,
            color: color,
          ),
        ),
      ],
    );
  }

  Widget _buildJourneyStepRow({
    required String hopNumber,
    required String title,
    required String subtitle,
    required bool isComplete,
    required Color color,
    required IconData icon,
  }) {
    final activeColor = isComplete ? color : const Color(0xFF475569);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: activeColor.withValues(alpha: 0.15),
            shape: BoxShape.circle,
            border: Border.all(color: activeColor.withValues(alpha: 0.6)),
          ),
          child: Center(
            child: Icon(icon, color: activeColor, size: 16),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'CHẶNG $hopNumber: $title',
                style: TextStyle(
                  color: isComplete ? Colors.white : Colors.white60,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: TextStyle(
                  color: isComplete ? const Color(0xFFCBD5E1) : Colors.white38,
                  fontSize: 11,
                  height: 1.3,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildConnectorLine(bool isActive) {
    return Container(
      margin: const EdgeInsets.only(left: 15, top: 4, bottom: 4),
      width: 2,
      height: 18,
      color: isActive
          ? const Color(0xFF38EF7D).withValues(alpha: 0.6)
          : Colors.white12,
    );
  }
}

/// Painter vẽ Radar quét dã chiến và các nốt mạng BLE
class _MeshRadarCanvasPainter extends CustomPainter {
  _MeshRadarCanvasPainter({
    required this.sweepProgress,
    required this.peers,
    required this.isDelivered,
  });

  final double sweepProgress;
  final List<BleMeshPeerNode> peers;
  final bool isDelivered;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final maxRadius = size.width / 2;

    final circlePaint = Paint()
      ..color = const Color(0xFF38EF7D).withValues(alpha: 0.15)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;

    // Vòng tròn đồng tâm (10m, 25m, 50m)
    canvas.drawCircle(center, maxRadius * 0.33, circlePaint);
    canvas.drawCircle(center, maxRadius * 0.66, circlePaint);
    canvas.drawCircle(center, maxRadius, circlePaint);

    // Trục chữ thập
    canvas.drawLine(
      Offset(center.dx, 0),
      Offset(center.dx, size.height),
      circlePaint,
    );
    canvas.drawLine(
      Offset(0, center.dy),
      Offset(size.width, center.dy),
      circlePaint,
    );

    // Tia quét radar (Sweep line)
    final sweepAngle = sweepProgress * 2 * math.pi;
    final sweepEnd = Offset(
      center.dx + maxRadius * math.cos(sweepAngle),
      center.dy + maxRadius * math.sin(sweepAngle),
    );

    final sweepPaint = Paint()
      ..color = const Color(0xFF38EF7D).withValues(alpha: 0.8)
      ..strokeWidth = 1.5;

    canvas.drawLine(center, sweepEnd, sweepPaint);

    // Nốt gốc (Nạn nhân ở tâm)
    final originPaint = Paint()
      ..color = const Color(0xFFEF4444)
      ..style = PaintingStyle.fill;
    canvas.drawCircle(center, 6, originPaint);

    // Vẽ các nốt tiếp sức xung quanh
    final peerPaint = Paint()
      ..color = isDelivered ? const Color(0xFF38EF7D) : const Color(0xFFFBBF24)
      ..style = PaintingStyle.fill;

    if (peers.isNotEmpty) {
      // Nốt 1 ở góc Đông Bắc (~45 độ)
      final peer1Pos = Offset(
        center.dx + maxRadius * 0.55 * math.cos(math.pi / 4),
        center.dy - maxRadius * 0.55 * math.sin(math.pi / 4),
      );
      canvas.drawCircle(peer1Pos, 5, peerPaint);

      // Đường liên kết nối Mesh từ tâm tới nốt
      final linkPaint = Paint()
        ..color = (isDelivered ? const Color(0xFF38EF7D) : const Color(0xFFFBBF24))
            .withValues(alpha: 0.4)
        ..strokeWidth = 1.2
        ..style = PaintingStyle.stroke;
      canvas.drawLine(center, peer1Pos, linkPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _MeshRadarCanvasPainter oldDelegate) => true;
}
