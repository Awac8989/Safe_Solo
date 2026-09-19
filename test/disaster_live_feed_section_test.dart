import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/models/disaster_alert_model.dart';
import 'package:safesolo/views/home/widgets/disaster_live_feed_section.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('DisasterLiveFeedSection displays admin disaster alerts with time, address, and image',
      (WidgetTester tester) async {
    final provider = AppProvider();

    // Set custom alert to test admin broadcast synchronization
    final customAlert = DisasterAlertModel(
      id: 'alert-admin-flood-test',
      title: 'BÃO SỐ 4 ĐỔ BỘ & TRIỀU CƯỜNG NGẬP LỤT',
      description: 'Mưa lớn xả lũ hồ Dầu Tiếng kết hợp triều cường sông Sài Gòn làm ngập sâu.',
      category: DisasterCategory.flooding,
      severity: DisasterSeverity.critical,
      lat: 10.7500,
      lng: 106.6800,
      radiusMeters: 2000,
      address: 'Số 150 Huỳnh Tấn Phát, Tân Thuận Đông, Quận 7, TP.HCM',
      safetyAdvice: 'Kê cao tài sản, ngắt nguồn điện tầng trệt. Không lội qua vùng nước xiết.',
      evacuationRouteTip: 'Di chuyển về phía cầu Phú Mỹ theo đường Nguyễn Thị Thập.',
      status: 'ACTIVE',
      issuedBy: 'Ban Chỉ Huy PCTT & TKCN SafeSolo Admin',
      broadcastCount: 520,
      distanceKm: 0.8,
      imageUrl: 'https://images.unsplash.com/photo-1547683905-f686c993aae5',
      createdAt: DateTime(2026, 9, 18, 14, 30),
    );

    provider.setDisasterAlertsForTest([customAlert]);

    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: provider,
        child: const MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: DisasterLiveFeedSection(),
            ),
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();

    // 1. Check section header and Admin source
    expect(find.text('CẢNH BÁO BÃO LŨ & NGẬP LỤT'), findsOneWidget);
    expect(
      find.text('Cập nhật trực tiếp từ Ban Chỉ Huy Admin SafeSolo 115/114'),
      findsOneWidget,
    );

    // 2. Check disaster title
    expect(find.text('BÃO SỐ 4 ĐỔ BỘ & TRIỀU CƯỜNG NGẬP LỤT'), findsOneWidget);

    // 3. Check broadcast time from Admin
    expect(find.textContaining('Thời gian phát lệnh: 14:30 · 18/09/2026'), findsOneWidget);

    // 4. Check address
    expect(
      find.text('Số 150 Huỳnh Tấn Phát, Tân Thuận Đông, Quận 7, TP.HCM'),
      findsOneWidget,
    );

    // 5. Check distance
    expect(find.textContaining('0.8 km'), findsOneWidget);

    // 6. Check Safety and Evacuation tips
    expect(
      find.text('Kê cao tài sản, ngắt nguồn điện tầng trệt. Không lội qua vùng nước xiết.'),
      findsOneWidget,
    );
    expect(
      find.textContaining('Di chuyển về phía cầu Phú Mỹ'),
      findsOneWidget,
    );

    // 7. Check action button
    expect(find.text('Xem bản đồ sơ tán'), findsOneWidget);
  });
}
