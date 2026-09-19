import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:safesolo/models/disaster_alert_model.dart';
import 'package:safesolo/views/home/widgets/disaster_alert_card.dart';

void main() {
  group('DisasterAlertModel Tests', () {
    test('Correctly deserializes FLOODING alert from JSON', () {
      final json = {
        'id': 'alert_flood_1',
        'title': 'CẢNH BÁO NGẬP LỤT SÂU TẠI BÌNH THẠNH',
        'category': 'FLOODING',
        'severity': 'CRITICAL',
        'description': 'Mực nước vượt 1.0m, ngập nặng đường Ung Văn Khiêm.',
        'safetyAdvice': 'Không cố di chuyển qua vùng nước ngập, ngắt aptomat điện gia đình.',
        'evacuationRoute': 'Di chuyển qua đường Điện Biên Phủ lên hướng cầu Sài Gòn.',
        'lat': 10.8012,
        'lng': 106.7145,
        'radiusKm': 3.5,
        'distanceKm': 0.75,
        'isActive': true,
        'affectedRadiusKm': 3.5,
        'broadcastBy': 'Admin Trung Tâm Điều Phối',
        'createdAt': DateTime.now().toIso8601String(),
      };

      final alert = DisasterAlertModel.fromJson(json);

      expect(alert.id, equals('alert_flood_1'));
      expect(alert.category, equals(DisasterCategory.flooding));
      expect(alert.severity, equals(DisasterSeverity.critical));
      expect(alert.isCritical, isTrue);
      expect(alert.distanceKm, equals(0.75));
      expect(alert.categoryLabel, equals('Ngập nước sâu'));
      expect(alert.severityLabel, equals('NGUY CẤP (BÁO ĐỘNG ĐỎ)'));
    });

    test('Correctly deserializes LANDSLIDE alert from JSON', () {
      final json = {
        'id': 'alert_landslide_1',
        'title': 'CẢNH BÁO SẠT LỞ ĐẤT ĐÁ ĐÈO PRENN',
        'category': 'LANDSLIDE',
        'severity': 'WARNING',
        'description': 'Đất đá sườn dốc có dấu hiệu nứt gãy và sạt trượt.',
        'safetyAdvice': 'Tuyệt đối không lưu thông qua đoạn đèo km 224.',
        'lat': 11.9012,
        'lng': 108.4452,
        'radiusKm': 5.0,
        'distanceKm': 2.3,
        'isActive': true,
      };

      final alert = DisasterAlertModel.fromJson(json);

      expect(alert.id, equals('alert_landslide_1'));
      expect(alert.category, equals(DisasterCategory.landslide));
      expect(alert.severity, equals(DisasterSeverity.warning));
      expect(alert.isCritical, isFalse);
      expect(alert.categoryLabel, equals('Sạt lở đất đá'));
    });
  });

  group('DisasterAlertCard Widget Tests', () {
    testWidgets('renders DisasterAlertCard with siren pulse and correct details', (tester) async {
      final testAlert = DisasterAlertModel(
        id: 'alert_101',
        title: 'CẢNH BÁO LŨ QUÉT KHẨN CẤP',
        category: DisasterCategory.criticalDanger,
        severity: DisasterSeverity.critical,
        description: 'Lũ quét và sạt lở dữ dội tại thượng nguồn.',
        safetyAdvice: 'Sơ tán khẩn cấp lên các điểm cao an toàn.',
        evacuationRouteTip: 'Trục đường cứu hộ 723',
        address: 'Huyện Đơn Dương',
        lat: 11.8,
        lng: 108.5,
        radiusMeters: 4000,
        distanceKm: 1.2,
        createdAt: DateTime.now(),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DisasterAlertCard(
              alerts: [testAlert],
            ),
          ),
        ),
      );

      // Verify the card elements
      expect(find.text('CẢNH BÁO LŨ QUÉT KHẨN CẤP'), findsOneWidget);
      expect(find.text('ADMIN 115/114'), findsOneWidget);
      expect(find.byType(DisasterAlertCard), findsOneWidget);

      await tester.pump(const Duration(milliseconds: 200));
    });
  });
}
