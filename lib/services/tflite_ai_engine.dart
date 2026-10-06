import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:tflite_flutter/tflite_flutter.dart';

class TfLiteAiEngine {
  TfLiteAiEngine._();
  static final TfLiteAiEngine instance = TfLiteAiEngine._();

  Interpreter? _interpreter;
  bool _isInitialized = false;

  Future<void> initialize() async {
    if (_isInitialized) return;
    try {
      _interpreter = await Interpreter.fromAsset('assets/models/safesolo_ai.tflite');
      _isInitialized = true;
      debugPrint('[TfLiteAiEngine] Model loaded successfully.');
    } catch (e) {
      debugPrint('[TfLiteAiEngine] Failed to load model: $e. Falling back to heuristic engine.');
      _isInitialized = false;
    }
  }

  /// 1. Adaptive Check-in Prediction
  /// Calculates the optimal next check-in interval based on the user's recent activity score.
  /// If TFLite is unavailable, uses a fallback heuristic method.
  int predictOptimalCheckinInterval(List<double> activityScores, int currentIntervalMin) {
    if (_isInitialized && _interpreter != null) {
      try {
        var input = [activityScores]; // e.g. [[0.5, 0.8, ...]]
        var output = List<double>.filled(1, 0).reshape([1, 1]);
        _interpreter!.run(input, output);
        int predicted = (output[0][0] * 60).round(); // Assume output is in hours
        return predicted.clamp(15, 720);
      } catch (e) {
        debugPrint('[TfLiteAiEngine] Inference failed: $e. Using fallback.');
      }
    }

    // Fallback heuristic:
    if (activityScores.isEmpty) return currentIntervalMin;
    double avgActivity = activityScores.reduce((a, b) => a + b) / activityScores.length;
    
    // High activity (e.g. gym) -> shorter interval. Low activity (sleep) -> longer.
    if (avgActivity > 0.7) {
      return math.max(15, currentIntervalMin ~/ 2);
    } else if (avgActivity < 0.2) {
      return math.min(720, currentIntervalMin * 2);
    }
    return currentIntervalMin;
  }

  /// 2. Anomaly Detection for Vitals
  /// Uses personal baseline to detect anomalies instead of fixed thresholds.
  bool detectVitalsAnomaly({
    required double currentHr,
    required double currentSpo2,
    required double baselineHr,
    required double baselineSpo2,
  }) {
    if (_isInitialized && _interpreter != null) {
      try {
        var input = [[currentHr, currentSpo2, baselineHr, baselineSpo2]];
        var output = List<double>.filled(1, 0).reshape([1, 1]);
        _interpreter!.run(input, output);
        return output[0][0] > 0.5; // > 0.5 means anomaly
      } catch (e) {
        debugPrint('[TfLiteAiEngine] Inference failed: $e. Using fallback.');
      }
    }

    // Fallback personalized heuristic
    // HR is more than 30% off baseline, or SpO2 dropped more than 5% below baseline
    bool hrAnomaly = (currentHr - baselineHr).abs() / baselineHr > 0.3;
    bool spo2Anomaly = (baselineSpo2 - currentSpo2) > 5.0;
    
    // Absolute bounds just in case baseline is corrupted
    bool absoluteAnomaly = currentHr > 160 || currentHr < 40 || currentSpo2 < 85;

    return hrAnomaly || spo2Anomaly || absoluteAnomaly;
  }
}
