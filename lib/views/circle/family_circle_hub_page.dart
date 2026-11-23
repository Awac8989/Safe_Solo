import 'package:flutter/material.dart';

import '../../core/app_theme.dart';
import '../../services/family_circle_service.dart';

/// ============================================================================
/// SAFESOLO — MÀN HÌNH BẢO VỆ GIA ĐÌNH 3 THẾ HỆ (PHÂN HỆ 141)
/// Quản lý trạng thái an toàn: Trẻ em (Geofence), Người già (Ngã & Thuốc), Độc hành
///
/// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03 - TDMU
/// ============================================================================

class FamilyCircleHubPage extends StatefulWidget {
  const FamilyCircleHubPage({super.key});

  @override
  State<FamilyCircleHubPage> createState() => _FamilyCircleHubPageState();
}

class _FamilyCircleHubPageState extends State<FamilyCircleHubPage> {
  final _family = FamilyCircleService.instance;

  @override
  void initState() {
    super.initState();
    _family.initializeDemoData();
    _family.addListener(_onUpdate);
  }

  @override
  void dispose() {
    _family.removeListener(_onUpdate);
    super.dispose();
  }

  void _onUpdate() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final members = _family.members;

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          'SafeSolo 3-Tier Family Circle',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Banner giới thiệu
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF1E3A8A), Color(0xFF3B82F6)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Row(
              children: [
                Icon(Icons.family_restroom_rounded, color: Colors.white, size: 36),
                SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Vòng Tròn Bảo Vệ Đa Thế Hệ',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'Trẻ em (Geofence) • Người cao tuổi (AI ngã) • Độc hành (Dead-Man 30m)',
                        style: TextStyle(color: Colors.white70, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),
          const Text(
            'Thành viên trong vòng tròn:',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
          ),
          const SizedBox(height: 12),

          ...members.map((member) => _buildMemberCard(member)),
        ],
      ),
    );
  }

  Widget _buildMemberCard(FamilyMemberProfile member) {
    Color tierColor;
    String tierLabel;
    IconData tierIcon;

    switch (member.tier) {
      case FamilyMemberTier.child:
        tierColor = const Color(0xFF38BDF8);
        tierLabel = 'Tier 1: Trẻ em (Geofence)';
        tierIcon = Icons.school_rounded;
        break;
      case FamilyMemberTier.elderly:
        tierColor = const Color(0xFFF43F5E);
        tierLabel = 'Tier 2: Người cao tuổi (Fall AI)';
        tierIcon = Icons.elderly_rounded;
        break;
      case FamilyMemberTier.soloAdult:
        tierColor = const Color(0xFF10B981);
        tierLabel = 'Tier 3: Độc hành (Dead-Man 30m)';
        tierIcon = Icons.hiking_rounded;
        break;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: member.isSafe ? const Color(0xFF334155) : const Color(0xFFEF4444),
          width: member.isSafe ? 1 : 2,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor: tierColor.withOpacity(0.2),
                child: Icon(tierIcon, color: tierColor, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      member.name,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                    Text(
                      '${member.relationship} • $tierLabel',
                      style: TextStyle(color: tierColor, fontSize: 12, fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: member.isSafe ? const Color(0xFF10B981).withOpacity(0.2) : const Color(0xFFEF4444).withOpacity(0.2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  member.isSafe ? 'An toàn' : 'NGUY HIỂM',
                  style: TextStyle(
                    color: member.isSafe ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
          if (member.alertMessage != null) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                member.alertMessage!,
                style: TextStyle(
                  color: member.isSafe ? Colors.white70 : const Color(0xFFFCA5A5),
                  fontSize: 12,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
