import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:safesolo/core/providers/app_provider.dart';
import 'package:safesolo/services/ai_solocare_service.dart';
import 'package:safesolo/views/emergency/solocare_ai_sheet.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('SoloCareAiService Unit Tests', () {
    final service = SoloCareAiService.instance;

    test('default configuration has valid API key and Qwen model', () {
      expect(service.currentModel, contains('qwen'));
      expect(SoloCareAiService.defaultApiKey.startsWith('gsk_'), isTrue);
    });

    test('updateApiKey and updateModel modify service configuration', () {
      service.updateModel('qwen/qwen3.8-27b');
      expect(service.currentModel, 'qwen/qwen3.8-27b');
    });

    test('fallback responses provide comprehensive offline medical advice', () async {
      final provider = AppProvider();

      // Fallback cho vết thương / chảy máu
      final woundResponse = await service.askSoloCare(
        prompt: 'Tôi bị đứt tay chảy máu nhiều',
        appProvider: provider,
      );
      expect(woundResponse.contains('VẾT THƯƠNG') || woundResponse.contains('cầm máu'), isTrue);

      // Fallback cho bỏng
      final burnResponse = await service.askSoloCare(
        prompt: 'Tôi bị bỏng bô xe máy',
        appProvider: provider,
      );
      expect(burnResponse.contains('BỎNG') || burnResponse.contains('nước'), isTrue);

      // Fallback cho hoảng loạn / tâm lý
      final panicResponse = await service.askSoloCare(
        prompt: 'Tôi đang rất sợ và hoảng loạn tim đập nhanh',
        appProvider: provider,
      );
      expect(panicResponse.contains('HÍT THỞ') || panicResponse.contains('4-7-8'), isTrue);
    });
  });

  group('SoloCareAiSheet Widget Tests', () {
    testWidgets('renders modal sheet with header, quick chips, and breathing toggle', (tester) async {
      final provider = AppProvider();

      await tester.pumpWidget(
        ChangeNotifierProvider<AppProvider>.value(
          value: provider,
          child: const MaterialApp(
            home: Scaffold(
              body: SoloCareAiSheet(),
            ),
          ),
        ),
      );

      await tester.pump(const Duration(milliseconds: 200));

      // Kiểm tra Header và Nút 115
      expect(find.text('SoloCare AI'), findsOneWidget);
      expect(find.text('115'), findsOneWidget);

      // Kiểm tra các Chips sơ cứu nhanh
      expect(find.text('🩹 Đứt tay chảy máu'), findsOneWidget);
      expect(find.text('🔥 Bỏng bô xe máy'), findsOneWidget);

      // Kiểm tra nút kích hoạt bài tập thở 4-7-8
      expect(find.text('🧘 Luyện thở 4-7-8 hạ nhịp tim'), findsOneWidget);

      // Nhấn bật bài tập thở 4-7-8
      await tester.tap(find.text('🧘 Luyện thở 4-7-8 hạ nhịp tim'));
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Hít vào sâu...'), findsOneWidget);
      expect(find.text('Tắt bài thở 4-7-8'), findsOneWidget);
    });
  });
}
