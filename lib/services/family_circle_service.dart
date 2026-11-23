import 'dart:async';
import 'package:flutter/foundation.dart';

/// ============================================================================
/// SAFESOLO — PHÂN HỆ 141: SAFESOLO 3-TIER FAMILY CIRCLE HUB SERVICE
/// Bảo vệ toàn diện gia đình 3 thế hệ:
/// - Tier 1 (Trẻ em): Giám sát hàng rào địa lý Geo-Fence an toàn trường học / nhà
/// - Tier 2 (Người cao tuổi): Cảnh báo ngã AI & Giám sát uống thuốc định kỳ
/// - Tier 3 (Người độc thân / Đi xa): Dead-Man Switch định kỳ 30 phút & GPS Trail
///
/// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03 - TDMU
/// ============================================================================

enum FamilyMemberTier {
  child,      // Trẻ em học sinh (Cần Geofence & Check-in tan trường)
  elderly,    // Người cao tuổi (Cần phát hiện té ngã & Nhắc thuốc)
  soloAdult,  // Người lớn độc hành (Cần Dead-Man Switch & SOS hành trình)
}

class FamilyMemberProfile {
  const FamilyMemberProfile({
    required this.id,
    required this.name,
    required this.relationship,
    required this.tier,
    required this.phone,
    this.avatarUrl,
    required this.lastKnownLat,
    required this.lastKnownLng,
    required this.lastUpdated,
    required this.isSafe,
    this.alertMessage,
  });

  final String id;
  final String name;
  final String relationship;
  final FamilyMemberTier tier;
  final String phone;
  final String? avatarUrl;
  final double lastKnownLat;
  final double lastKnownLng;
  final DateTime lastUpdated;
  final bool isSafe;
  final String? alertMessage;
}

class FamilyCircleService extends ChangeNotifier {
  FamilyCircleService._();
  static final FamilyCircleService instance = FamilyCircleService._();

  final List<FamilyMemberProfile> _members = [];
  List<FamilyMemberProfile> get members => List.unmodifiable(_members);

  bool _isInitialized = false;

  void initializeDemoData() {
    if (_isInitialized) return;
    _isInitialized = true;
    _members.addAll([
      FamilyMemberProfile(
        id: 'fam_01',
        name: 'Bé Minh Triết',
        relationship: 'Con trai',
        tier: FamilyMemberTier.child,
        phone: '0908111222',
        lastKnownLat: 10.9805,
        lastKnownLng: 106.6745,
        lastUpdated: DateTime.now().subtract(const Duration(minutes: 5)),
        isSafe: true,
        alertMessage: 'Đang trong Vùng an toàn: Trường Tiểu học Phú Hòa',
      ),
      FamilyMemberProfile(
        id: 'fam_02',
        name: 'Bà Nội (Nguyễn Thị Mai)',
        relationship: 'Mẹ',
        tier: FamilyMemberTier.elderly,
        phone: '0912333444',
        lastKnownLat: 10.9782,
        lastKnownLng: 106.6720,
        lastUpdated: DateTime.now().subtract(const Duration(minutes: 2)),
        isSafe: true,
        alertMessage: 'Nhịp tim 76 bpm bình thường. Đã uống thuốc tim mạch sáng.',
      ),
      FamilyMemberProfile(
        id: 'fam_03',
        name: 'Đoàn Minh Quân',
        relationship: 'Bản thân',
        tier: FamilyMemberTier.soloAdult,
        phone: '0987654321',
        lastKnownLat: 10.9800,
        lastKnownLng: 106.6730,
        lastUpdated: DateTime.now(),
        isSafe: true,
        alertMessage: 'Dead-Man Switch 30m đang kích hoạt. Hành trình an toàn.',
      ),
    ]);
    notifyListeners();
  }

  /// Kích hoạt cảnh báo vi phạm rào chắn trường học (Trẻ em)
  void triggerGeofenceBreach(String memberId, String locationName) {
    final idx = _members.indexWhere((m) => m.id == memberId);
    if (idx != -1) {
      final old = _members[idx];
      _members[idx] = FamilyMemberProfile(
        id: old.id,
        name: old.name,
        relationship: old.relationship,
        tier: old.tier,
        phone: old.phone,
        lastKnownLat: old.lastKnownLat,
        lastKnownLng: old.lastKnownLng,
        lastUpdated: DateTime.now(),
        isSafe: false,
        alertMessage: 'CẢNH BÁO: Rời khỏi vùng an toàn $locationName lúc ${DateTime.now().hour}:${DateTime.now().minute.toString().padLeft(2, '0')}',
      );
      notifyListeners();
    }
  }

  /// Kích hoạt cảnh báo té ngã người cao tuổi
  void triggerElderlyFallAlert(String memberId) {
    final idx = _members.indexWhere((m) => m.id == memberId);
    if (idx != -1) {
      final old = _members[idx];
      _members[idx] = FamilyMemberProfile(
        id: old.id,
        name: old.name,
        relationship: old.relationship,
        tier: old.tier,
        phone: old.phone,
        lastKnownLat: old.lastKnownLat,
        lastKnownLng: old.lastKnownLng,
        lastUpdated: DateTime.now(),
        isSafe: false,
        alertMessage: 'KHẨN CẤP: Phát hiện va đập té ngã! Không thấy cử động sau 30 giây.',
      );
      notifyListeners();
    }
  }
}
