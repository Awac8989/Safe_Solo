import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:safesolo/services/ai_signal_processor.dart';
import 'package:safesolo/services/hrv_stroke_service.dart';
import 'package:safesolo/views/health/widgets/hrv_stroke_card.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('AiSignalProcessor HRV & Stroke Risk Algorithms', () {
    final ai = AiSignalProcessor.instance;

    test('calculateHrvMetrics handles empty or single element safely', () {
      final defaultMetrics = ai.calculateHrvMetrics([]);
      expect(defaultMetrics.meanRrMs, 800.0);
      expect(defaultMetrics.sampleCount, 0);

      final singleMetrics = ai.calculateHrvMetrics([820]);
      expect(singleMetrics.meanRrMs, 800.0);
    });

    test('calculateHrvMetrics calculates correct Mean, SDNN, RMSSD, and pNN50', () {
      // 5 khoảng RR mẫu: 800, 860, 790, 870, 800
      final intervals = [800, 860, 790, 870, 800];
      final metrics = ai.calculateHrvMetrics(intervals);

      // Mean: (800+860+790+870+800)/5 = 4120/5 = 824.0
      expect(metrics.meanRrMs, 824.0);
      expect(metrics.sdnnMs, greaterThan(35.0));

      // Diffs: |860-800|=60 (>50), |790-860|=70 (>50), |870-790|=80 (>50), |800-870|=70 (>50) -> 4/4 = 100%
      expect(metrics.pnn50Percent, 100.0);
      expect(metrics.rmssdMs, greaterThan(65.0));
      expect(metrics.sampleCount, 5);
    });

    test('Clinical sample generators produce valid data ranges', () {
      final normal = ai.generateNormalRrSample(count: 30);
      expect(normal.length, 30);
      final normalMetrics = ai.calculateHrvMetrics(normal);
      expect(normalMetrics.meanRrMs, inInclusiveRange(750.0, 850.0));
      expect(normalMetrics.sdnnMs, inInclusiveRange(10.0, 45.0));

      final afib = ai.generateAfibArrhythmiaRrSample(count: 30);
      expect(afib.length, 30);
      final afibMetrics = ai.calculateHrvMetrics(afib);
      expect(afibMetrics.pnn50Percent, greaterThan(30.0));

      final exhaustion = ai.generateAutonomicExhaustionRrSample(count: 30);
      expect(exhaustion.length, 30);
      final exMetrics = ai.calculateHrvMetrics(exhaustion);
      expect(exMetrics.sdnnMs, lessThan(10.0));
    });

    test('evaluateStrokeCardiacRisk classifies Normal, AFib, and Exhaustion correctly', () {
      final normalRr = ai.generateNormalRrSample();
      final normalMetrics = ai.calculateHrvMetrics(normalRr);
      final normalRisk = ai.evaluateStrokeCardiacRisk(
        hrv: normalMetrics,
        heartRate: 72,
        spO2: 98,
      );
      expect(normalRisk.level, HrvRiskLevel.normal);
      expect(normalRisk.isAfibSuspected, isFalse);
      expect(normalRisk.riskPercent, lessThan(28.0));

      final afibRr = ai.generateAfibArrhythmiaRrSample();
      final afibMetrics = ai.calculateHrvMetrics(afibRr);
      final afibRisk = ai.evaluateStrokeCardiacRisk(
        hrv: afibMetrics,
        heartRate: 115,
        spO2: 92,
      );
      expect(afibRisk.level, HrvRiskLevel.critical);
      expect(afibRisk.isAfibSuspected, isTrue);
      expect(afibRisk.riskPercent, greaterThanOrEqualTo(60.0));

      final exRr = ai.generateAutonomicExhaustionRrSample();
      final exMetrics = ai.calculateHrvMetrics(exRr);
      final exRisk = ai.evaluateStrokeCardiacRisk(
        hrv: exMetrics,
        heartRate: 102,
        spO2: 96,
      );
      expect(exRisk.isAutonomicExhaustion, isTrue);
      expect(exRisk.level, isNot(HrvRiskLevel.normal));
    });
  });

  group('HrvStrokeService Integration Tests', () {
    final service = HrvStrokeService.instance;

    setUp(() {
      service.reset();
    });

    test('Service initializes with valid healthy baseline state', () {
      expect(service.rrIntervals.isNotEmpty, isTrue);
      expect(service.metrics.sampleCount, greaterThanOrEqualTo(20));
      expect(service.assessment.level, HrvRiskLevel.normal);
      expect(service.isMeasuring, isFalse);
    });

    test('recordRrInterval filters outliers and updates rolling buffer', () {
      final initialCount = service.rrIntervals.length;
      service.recordRrInterval(150); // Ngoại lai < 300ms
      expect(service.rrIntervals.length, initialCount);

      service.recordRrInterval(820); // Hợp lệ
      expect(service.rrIntervals.last, 820);
    });

    test('simulateScenario switches between Normal, Stress, and AFib modes', () {
      service.simulateScenario(HrvScenario.afibRisk);
      expect(service.currentScenario, HrvScenario.afibRisk);
      expect(service.assessment.level, HrvRiskLevel.critical);
      expect(service.assessment.isAfibSuspected, isTrue);

      service.simulateScenario(HrvScenario.moderateStress);
      expect(service.currentScenario, HrvScenario.moderateStress);
      expect(service.assessment.isAutonomicExhaustion, isTrue);

      service.simulateScenario(HrvScenario.normal);
      expect(service.currentScenario, HrvScenario.normal);
      expect(service.assessment.level, HrvRiskLevel.normal);
    });

    test('startHrvMeasurement toggles measuring state and updates progress', () async {
      final future = service.startHrvMeasurement(duration: const Duration(milliseconds: 300));
      expect(service.isMeasuring, isTrue);
      await future;
      expect(service.isMeasuring, isFalse);
      expect(service.measureProgress, 1.0);
    });
  });

  group('HrvStrokeCard Widget Tests', () {
    setUp(() {
      HrvStrokeService.instance.reset();
    });

    testWidgets('renders all HRV components, gauge, tachogram and triggers F.A.S.T modal', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: Padding(
                padding: EdgeInsets.all(16.0),
                child: HrvStrokeCard(),
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // Kiểm tra tiêu đề và chỉ số
      expect(find.text('Dự đoán Đột quỵ & Loạn nhịp (HRV)'), findsOneWidget);
      expect(find.text('Xác suất Nguy cơ Đột quỵ / AFib'), findsOneWidget);
      expect(find.text('RMSSD'), findsOneWidget);
      expect(find.text('SDNN'), findsOneWidget);
      expect(find.text('pNN50'), findsOneWidget);
      expect(find.text('Stress (SI)'), findsOneWidget);

      // Kiểm tra các nút hành động
      expect(find.text('Đo HRV 15s'), findsOneWidget);
      expect(find.text('Kiểm tra F.A.S.T'), findsOneWidget);

      // Nhấn nút F.A.S.T để mở Modal tầm soát
      await tester.tap(find.text('Kiểm tra F.A.S.T'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('Bảng Tầm Soát Đột Quỵ F.A.S.T'), findsOneWidget);
      expect(find.text('F - FACE (Mặt)'), findsOneWidget);
      expect(find.text('A - ARMS (Tay)'), findsOneWidget);
      expect(find.text('S - SPEECH (Lời nói)'), findsOneWidget);
      expect(find.text('GỌI CẤP CỨU 115 NGAY LẬP TỨC'), findsOneWidget);

      // Tương tác checkbox
      await tester.tap(find.byType(Checkbox).first);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));

      // Đóng modal
      await tester.tapAt(const Offset(20, 20));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
    });
  });
}
