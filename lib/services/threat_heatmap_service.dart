import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

/// ============================================================================
/// SAFESOLO — PHÂN HỆ 138: AI THREAT HEATMAP SERVICE
/// Bản đồ nhiệt nguy hiểm động theo giờ dựa trên HazardReport cộng đồng
///
/// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03 - TDMU
/// Thuật toán: Exponential Decay Heatmap với Time-of-Day multiplier
/// Tích hợp: MapLibre GL heatmapLayer, Web Admin TOC GIS
/// ============================================================================

/// Mức nguy hiểm của báo cáo
enum HazardSeverity {
  low,      // Nguy hiểm thấp — tập trung đông người, tranh cãi
  medium,   // Nguy hiểm vừa — cướp giật, trộm cắp
  high,     // Nguy hiểm cao — cướp có vũ khí, bạo lực
  critical, // Nguy hiểm cực cao — tấn công tập thể, thảm sát
}

/// Điểm báo cáo nguy hiểm để tính heatmap
class HazardPoint {
  const HazardPoint({
    required this.id,
    required this.latitude,
    required this.longitude,
    required this.severity,
    required this.reportedAt,
    required this.hourOfDay,  // 0–23
    required this.category,
    this.description = '',
  });

  final String id;
  final double latitude;
  final double longitude;
  final HazardSeverity severity;
  final DateTime reportedAt;
  final int hourOfDay;  // Giờ trong ngày khi xảy ra sự cố
  final String category;
  final String description;

  /// Điểm cơ bản theo severity (theo thang AH2020)
  int get baseScore {
    switch (severity) {
      case HazardSeverity.low:      return 1;
      case HazardSeverity.medium:   return 4;
      case HazardSeverity.high:     return 7;
      case HazardSeverity.critical: return 10;
    }
  }
}

/// Điểm heatmap đã tính toán
class HeatmapPoint {
  const HeatmapPoint({
    required this.latitude,
    required this.longitude,
    required this.weight,         // 0.0 → 1.0 (normalized)
    required this.rawHeatScore,
    required this.contributingReports,
  });

  final double latitude;
  final double longitude;
  final double weight;
  final double rawHeatScore;
  final int contributingReports;

  /// Convert sang GeoJSON Feature cho MapLibre
  Map<String, dynamic> toGeoJsonFeature() => {
    'type': 'Feature',
    'geometry': {
      'type': 'Point',
      'coordinates': [longitude, latitude],
    },
    'properties': {
      'weight': weight,
      'rawScore': rawHeatScore,
      'reports': contributingReports,
    },
  };
}

/// Thống kê heatmap tổng hợp
class HeatmapStats {
  const HeatmapStats({
    required this.totalReports,
    required this.hotspotCount,
    required this.mostDangerousHour,
    required this.mostDangerousZone,
    required this.safetyScore,
  });

  final int totalReports;
  final int hotspotCount;         // Số điểm nóng (weight > 0.7)
  final int mostDangerousHour;    // Giờ nguy hiểm nhất trong ngày
  final String mostDangerousZone; // Khu vực nguy hiểm nhất
  final double safetyScore;       // 0–100 (100 = an toàn tuyệt đối)

  String get safetyLabel {
    if (safetyScore >= 80) return '🟢 An toàn';
    if (safetyScore >= 60) return '🟡 Cần chú ý';
    if (safetyScore >= 40) return '🟠 Nguy hiểm';
    return '🔴 Rất nguy hiểm';
  }
}

/// Service tính toán và quản lý AI Threat Heatmap
/// Phân hệ 138 — AI Threat Heatmap
class ThreatHeatmapService extends ChangeNotifier {
  ThreatHeatmapService._();
  static final ThreatHeatmapService instance = ThreatHeatmapService._();

  /// Bán kính cluster điểm nguy hiểm (độ kinh/vĩ ≈ 50m)
  static const double kClusterRadius = 0.0005;

  /// Thời gian decay: 72 giờ (sau 72h, trọng số → ~5%)
  static const double kDecayLambda = 0.1;

  List<HazardPoint> _hazardPoints = [];
  List<HeatmapPoint> _heatmapPoints = [];
  HeatmapStats? _stats;
  DateTime _lastComputed = DateTime.fromMillisecondsSinceEpoch(0);

  List<HeatmapPoint> get heatmapPoints => List.unmodifiable(_heatmapPoints);
  HeatmapStats? get stats => _stats;
  int get reportCount => _hazardPoints.length;

  /// Thêm báo cáo nguy hiểm mới (từ cộng đồng hoặc API)
  void addHazardReport(HazardPoint point) {
    _hazardPoints.add(point);
    // Recompute nếu đã quá 60 giây kể từ lần trước
    if (DateTime.now().difference(_lastComputed).inSeconds > 60) {
      computeHeatmap();
    }
    notifyListeners();
  }

  /// Tải danh sách báo cáo từ backend (HazardReport collection)
  void loadFromBackend(List<Map<String, dynamic>> reports) {
    _hazardPoints = reports.map((r) => HazardPoint(
      id: r['_id'] ?? '',
      latitude: (r['location']?['coordinates']?[1] ?? 10.9).toDouble(),
      longitude: (r['location']?['coordinates']?[0] ?? 106.6).toDouble(),
      severity: _parseSeverity(r['severity'] ?? 'medium'),
      reportedAt: DateTime.tryParse(r['createdAt'] ?? '') ?? DateTime.now(),
      hourOfDay: r['hourOfDay'] ?? DateTime.now().hour,
      category: r['category'] ?? 'Khác',
      description: r['description'] ?? '',
    )).toList();

    computeHeatmap();
  }

  /// Tính toán heatmap từ tập báo cáo hiện tại
  void computeHeatmap() {
    if (_hazardPoints.isEmpty) {
      _heatmapPoints = [];
      _stats = null;
      _lastComputed = DateTime.now();
      notifyListeners();
      return;
    }

    final now = DateTime.now();
    final currentHour = now.hour;

    // === BƯỚC 1: Tính heat score cho mỗi điểm ===
    // HeatWeight(r) = BaseScore × Recency × TimeOfDay
    final scoredPoints = _hazardPoints.map((point) {
      final hoursAgo = now.difference(point.reportedAt).inHours.toDouble().clamp(0, 720);

      // Recency: exponential decay e^(-λ × hours_ago)
      final recency = math.exp(-kDecayLambda * hoursAgo / 24);

      // TimeOfDay: 1.5× nếu giờ hiện tại ≡ giờ báo cáo ± 2h
      final hourDiff = (currentHour - point.hourOfDay).abs();
      final timeOfDay = (hourDiff <= 2 || hourDiff >= 22) ? 1.5 : 1.0;

      final score = point.baseScore * recency * timeOfDay;
      return {'point': point, 'score': score};
    }).toList();

    // === BƯỚC 2: Cluster điểm gần nhau (Geohash-like) ===
    final clusters = <List<Map<String, dynamic>>>[];
    final assigned = <int>{};

    for (int i = 0; i < scoredPoints.length; i++) {
      if (assigned.contains(i)) continue;
      final cluster = [scoredPoints[i]];
      assigned.add(i);
      final pi = scoredPoints[i]['point'] as HazardPoint;

      for (int j = i + 1; j < scoredPoints.length; j++) {
        if (assigned.contains(j)) continue;
        final pj = scoredPoints[j]['point'] as HazardPoint;
        final dist = math.sqrt(
          math.pow(pi.latitude - pj.latitude, 2) +
          math.pow(pi.longitude - pj.longitude, 2),
        );
        if (dist <= kClusterRadius) {
          cluster.add(scoredPoints[j]);
          assigned.add(j);
        }
      }
      clusters.add(cluster);
    }

    // === BƯỚC 3: Tính tâm cluster + tổng score ===
    double maxScore = 0;
    final rawPoints = clusters.map((cluster) {
      double totalScore = 0;
      double avgLat = 0, avgLng = 0;
      for (final item in cluster) {
        totalScore += (item['score'] as double);
        final p = item['point'] as HazardPoint;
        avgLat += p.latitude;
        avgLng += p.longitude;
      }
      avgLat /= cluster.length;
      avgLng /= cluster.length;
      if (totalScore > maxScore) maxScore = totalScore;
      return {'lat': avgLat, 'lng': avgLng, 'score': totalScore, 'count': cluster.length};
    }).toList();

    // === BƯỚC 4: Normalize weight 0–1 ===
    _heatmapPoints = rawPoints.map((rp) {
      final weight = maxScore > 0 ? (rp['score'] as double) / maxScore : 0.0;
      return HeatmapPoint(
        latitude: rp['lat'] as double,
        longitude: rp['lng'] as double,
        weight: weight.clamp(0.0, 1.0),
        rawHeatScore: rp['score'] as double,
        contributingReports: rp['count'] as int,
      );
    }).toList();

    // === BƯỚC 5: Tính stats ===
    final hotspots = _heatmapPoints.where((p) => p.weight > 0.7).length;
    final avgSafety = _heatmapPoints.isNotEmpty
        ? (1 - _heatmapPoints.map((p) => p.weight).reduce((a, b) => a + b) / _heatmapPoints.length) * 100
        : 100.0;

    // Giờ nguy hiểm nhất
    final hourCounts = List.filled(24, 0.0);
    for (final p in _hazardPoints) {
      hourCounts[p.hourOfDay] += p.baseScore;
    }
    final mostDangerousHour = hourCounts.indexOf(hourCounts.reduce(math.max));

    _stats = HeatmapStats(
      totalReports: _hazardPoints.length,
      hotspotCount: hotspots,
      mostDangerousHour: mostDangerousHour,
      mostDangerousZone: _findMostDangerousZone(),
      safetyScore: avgSafety.clamp(0, 100),
    );

    _lastComputed = DateTime.now();
    notifyListeners();

    if (kDebugMode) {
      debugPrint('[ThreatHeatmap] Computed ${_heatmapPoints.length} heatmap points from ${_hazardPoints.length} reports');
    }
  }

  /// Xuất GeoJSON FeatureCollection cho MapLibre
  Map<String, dynamic> toGeoJson() => {
    'type': 'FeatureCollection',
    'features': _heatmapPoints.map((p) => p.toGeoJsonFeature()).toList(),
  };

  /// Lấy mức nguy hiểm tại tọa độ cụ thể
  double getHeatWeightAt(double lat, double lng) {
    double maxWeight = 0;
    for (final p in _heatmapPoints) {
      final dist = math.sqrt(
        math.pow(lat - p.latitude, 2) + math.pow(lng - p.longitude, 2),
      );
      if (dist <= kClusterRadius * 3) {
        final localWeight = p.weight * math.exp(-dist / kClusterRadius);
        if (localWeight > maxWeight) maxWeight = localWeight;
      }
    }
    return maxWeight.clamp(0.0, 1.0);
  }

  /// Load dữ liệu demo cho bản trình diễn
  void loadDemoData() {
    final now = DateTime.now();
    final points = [
      HazardPoint(id: '1', latitude: 10.9804, longitude: 106.6519,
          severity: HazardSeverity.high, reportedAt: now.subtract(const Duration(hours: 2)),
          hourOfDay: 22, category: 'Cướp giật', description: 'Cướp xe máy đường Bình Dương'),
      HazardPoint(id: '2', latitude: 10.9810, longitude: 106.6525,
          severity: HazardSeverity.medium, reportedAt: now.subtract(const Duration(hours: 5)),
          hourOfDay: 23, category: 'Trộm cắp', description: 'Trộm xe trong hẻm'),
      HazardPoint(id: '3', latitude: 10.9790, longitude: 106.6510,
          severity: HazardSeverity.critical, reportedAt: now.subtract(const Duration(hours: 1)),
          hourOfDay: now.hour, category: 'Bạo lực', description: 'Đánh nhau nhóm thanh niên'),
      HazardPoint(id: '4', latitude: 10.9850, longitude: 106.6480,
          severity: HazardSeverity.low, reportedAt: now.subtract(const Duration(hours: 12)),
          hourOfDay: 10, category: 'Khác', description: 'Người lạ theo dõi'),
      HazardPoint(id: '5', latitude: 10.9770, longitude: 106.6540,
          severity: HazardSeverity.high, reportedAt: now.subtract(const Duration(hours: 3)),
          hourOfDay: 21, category: 'Cướp giật', description: 'Giật điện thoại'),
    ];

    for (final p in points) {
      _hazardPoints.add(p);
    }
    computeHeatmap();
  }

  // === PRIVATE ===

  HazardSeverity _parseSeverity(String s) {
    switch (s.toLowerCase()) {
      case 'low': return HazardSeverity.low;
      case 'medium': return HazardSeverity.medium;
      case 'high': return HazardSeverity.high;
      case 'critical': return HazardSeverity.critical;
      default: return HazardSeverity.medium;
    }
  }

  String _findMostDangerousZone() {
    if (_heatmapPoints.isEmpty) return 'Chưa có dữ liệu';
    final hottest = _heatmapPoints.reduce((a, b) => a.weight > b.weight ? a : b);
    return 'Vĩ: ${hottest.latitude.toStringAsFixed(4)}, Kinh: ${hottest.longitude.toStringAsFixed(4)}';
  }
}
