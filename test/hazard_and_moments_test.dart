import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/models/hazard_report_model.dart';
import 'package:safesolo/models/safe_moment_model.dart';
import 'package:safesolo/views/circle/widgets/safe_moments_carousel.dart';
import 'package:safesolo/views/community/hazard_feed_page.dart';
import 'package:safesolo/views/community/safety_guides_page.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('Hazard & SafeMoment Models Tests', () {
    test('HazardReportModel serializes and deserializes properly', () {
      final now = DateTime.now();
      final model = HazardReportModel(
        id: 'h-1',
        title: 'Đèn đường hỏng ngõ 42',
        description: 'Đoạn đường rất tối sau 22h đêm',
        category: HazardCategory.darkRoad,
        lat: 21.0285,
        lng: 105.8542,
        address: 'Ngõ 42 Tràng Tiền, Hoàn Kiếm, Hà Nội',
        authorName: 'Minh Anh',
        distanceKm: 0.8,
        confirmCount: 5,
        createdAt: now,
      );

      final json = model.toJson();
      expect(json['id'], 'h-1');
      expect(json['category'], 'darkRoad');
      expect(json['confirmCount'], 5);

      final fromJson = HazardReportModel.fromJson(json);
      expect(fromJson.id, 'h-1');
      expect(fromJson.title, 'Đèn đường hỏng ngõ 42');
      expect(fromJson.categoryLabel, 'Đoạn đường tối');
      expect(fromJson.distanceKm, 0.8);
    });

    test('SafeMomentModel serializes and deserializes properly', () {
      final now = DateTime.now();
      final moment = SafeMomentModel(
        id: 'm-1',
        authorName: 'Mẹ',
        mood: 'calm',
        caption: 'Mẹ đã về đến nhà an toàn.',
        voiceNoteUrl: 'mom_voice.aac',
        createdAt: now,
      );

      final json = moment.toJson();
      expect(json['id'], 'm-1');
      expect(json['authorName'], 'Mẹ');
      expect(json['voiceNoteUrl'], 'mom_voice.aac');

      final fromJson = SafeMomentModel.fromJson(json);
      expect(fromJson.id, 'm-1');
      expect(fromJson.authorName, 'Mẹ');
      expect(fromJson.mood, 'calm');
    });
  });

  group('HazardFeedPage & Community Widgets Tests', () {
    testWidgets('renders HazardFeedPage with radar header, category chips and report button', (tester) async {
      await tester.pumpWidget(
        ChangeNotifierProvider(
          create: (_) => AppProvider(),
          child: const MaterialApp(
            home: HazardFeedPage(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Bản tin Cảnh báo Radar'), findsOneWidget);
      expect(find.text('BÁO CÁO NGUY CƠ'), findsOneWidget);
      expect(find.text('Tất cả'), findsWidgets);
    });

    testWidgets('renders SafetyGuidesPage with categories and guide cards', (tester) async {
      await tester.pumpWidget(
        ChangeNotifierProvider(
          create: (_) => AppProvider(),
          child: const MaterialApp(
            home: SafetyGuidesPage(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Cẩm nang an toàn độc lập'), findsOneWidget);
      expect(find.text('Dò tìm camera quay lén trong phòng trọ/khách sạn'), findsOneWidget);
      expect(find.text('Xử lý khi nghi ngờ bị bám đuôi trên đường về đêm'), findsOneWidget);
    });

    testWidgets('renders SafeMomentsCarousel with check-in button and moments list', (tester) async {
      await tester.pumpWidget(
        ChangeNotifierProvider(
          create: (_) => AppProvider(),
          child: const MaterialApp(
            home: Scaffold(
              body: SafeMomentsCarousel(),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Khoảnh khắc an toàn 24h'), findsOneWidget);
      expect(find.text('+ Điểm danh'), findsOneWidget);
      expect(find.text('Mẹ'), findsOneWidget);
    });
  });
}
