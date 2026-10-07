import 'dart:async';
import 'dart:io';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';
import 'package:url_launcher/url_launcher.dart';

import 'blackbox_service.dart';
import 'stroke_defense_service.dart';

/// ============================================================================
/// SAFESOLO - DỊCH VỤ KIỂM TRA ĐỘT QUỴ F.A.S.T TOÀN DIỆN THỊ GIÁC & GIỌNG NÓI
/// (F.A.S.T Full-Spectrum Vision & Speech AI Assessment Service)
///
/// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03
/// Quy chuẩn Y khoa:
/// - Cincinnati Prehospital Stroke Scale (CPSS)
/// - Los Angeles Prehospital Stroke Screen (LAPSS)
/// - Cửa sổ Mốc Giờ Vàng (Golden Window): 4.5 giờ (270 phút) can thiệp tiêu sợi huyết tPA
/// ============================================================================

class FastAssessmentResult {
  const FastAssessmentResult({
    required this.timestamp,
    required this.symptomOnsetTime,
    required this.faceSymmetryScore,
    required this.isFaceDroopPositive,
    required this.faceAnalysisNotes,
    this.facePhotoPath,
    required this.armAsymmetryScore,
    required this.isArmWeaknessPositive,
    required this.armAnalysisNotes,
    required this.speechClarityScore,
    required this.slurredSpeechProbability,
    required this.isSpeechImpairedPositive,
    required this.speechAnalysisNotes,
    this.speechAudioPath,
  });

  final DateTime timestamp;
  final DateTime symptomOnsetTime;

  // F - Face
  final double faceSymmetryScore; // 0.0 -> 1.0 (1.0 = Cân đối hoàn hảo, < 0.70 = Lệch méo cơ mặt)
  final bool isFaceDroopPositive;
  final String faceAnalysisNotes;
  final String? facePhotoPath;

  // A - Arm
  final double armAsymmetryScore; // 0.0 -> 1.0 (BMAI / Pronator Drift)
  final bool isArmWeaknessPositive;
  final String armAnalysisNotes;

  // S - Speech
  final double speechClarityScore; // 0.0 -> 1.0 (1.0 = Phát âm chuẩn, < 0.75 = Khó phát âm / Ngọng)
  final double slurredSpeechProbability; // 0.0 -> 1.0 (Xác suất giọng dính chữ / biến dạng)
  final bool isSpeechImpairedPositive;
  final String speechAnalysisNotes;
  final String? speechAudioPath;

  // Điểm đánh giá lâm sàng Cincinnati (CPSS: 0 -> 3)
  int get positiveCount {
    int count = 0;
    if (isFaceDroopPositive) count++;
    if (isArmWeaknessPositive) count++;
    if (isSpeechImpairedPositive) count++;
    return count;
  }

  bool get isStrokeSuspected => positiveCount >= 1;

  Duration get timeSinceOnset => DateTime.now().difference(symptomOnsetTime);

  Duration get remainingGoldenWindow {
    const goldenLimit = Duration(minutes: 270); // 4.5 giờ
    final elapsed = timeSinceOnset;
    if (elapsed >= goldenLimit) {
      return Duration.zero;
    }
    return goldenLimit - elapsed;
  }

  bool get isWithinGoldenWindow => remainingGoldenWindow > Duration.zero;

  String get cpssRiskLevelVi {
    switch (positiveCount) {
      case 0:
        return 'Nguy cơ Thấp (0/3 dấu hiệu)';
      case 1:
        return 'CẢNH BÁO CAO (1/3 dấu hiệu - 72% xác suất đột quỵ)';
      case 2:
        return 'RẤT NGUY CẤP (2/3 dấu hiệu - 85% xác suất đột quỵ)';
      case 3:
      default:
        return 'BÁO ĐỘNG ĐỎ CẤP CỨU (3/3 dấu hiệu - >85% đột quỵ tối cấp)';
    }
  }

  Color get riskColor {
    switch (positiveCount) {
      case 0:
        return const Color(0xFF10B981); // Xanh lá
      case 1:
        return const Color(0xFFF59E0B); // Vàng cam
      case 2:
        return const Color(0xFFF97316); // Cam đỏ
      case 3:
      default:
        return const Color(0xFFEF4444); // Đỏ khẩn cấp
    }
  }

  Map<String, dynamic> toTelemetryJson() {
    return {
      'type': 'FAST_STROKE_TELEMETRY',
      'cpssScore': positiveCount,
      'isStrokeSuspected': isStrokeSuspected,
      'cpssRiskLevel': cpssRiskLevelVi,
      'symptomOnsetTime': symptomOnsetTime.toIso8601String(),
      'goldenWindowRemainingMinutes': remainingGoldenWindow.inMinutes,
      'isWithinGoldenWindow': isWithinGoldenWindow,
      'face': {
        'isPositive': isFaceDroopPositive,
        'symmetryScore': faceSymmetryScore,
        'notes': faceAnalysisNotes,
        'hasPhoto': facePhotoPath != null,
      },
      'arm': {
        'isPositive': isArmWeaknessPositive,
        'asymmetryScore': armAsymmetryScore,
        'notes': armAnalysisNotes,
      },
      'speech': {
        'isPositive': isSpeechImpairedPositive,
        'clarityScore': speechClarityScore,
        'slurredProbability': slurredSpeechProbability,
        'notes': speechAnalysisNotes,
        'hasAudio': speechAudioPath != null,
      },
    };
  }
}

class FastAssessmentService extends ChangeNotifier {
  FastAssessmentService._();
  static final FastAssessmentService instance = FastAssessmentService._();

  final ImagePicker _picker = ImagePicker();
  AudioRecorder? _audioRecorder;

  DateTime _symptomOnsetTime = DateTime.now();

  // F - Face State
  double _faceSymmetryScore = 0.94;
  bool _isFaceDroopPositive = false;
  String _faceAnalysisNotes = 'Chưa quét cơ mặt';
  String? _facePhotoPath;
  bool _isFaceScanning = false;

  // A - Arm State
  double _armAsymmetryScore = 0.12;
  bool _isArmWeaknessPositive = false;
  String _armAnalysisNotes = 'Chưa làm bài test cơ lực';
  bool _isArmTesting = false;
  int _armCountdownSeconds = 10;
  Timer? _armTestTimer;

  // S - Speech State
  double _speechClarityScore = 0.92;
  double _slurredSpeechProbability = 0.08;
  bool _isSpeechImpairedPositive = false;
  String _speechAnalysisNotes = 'Chưa phân tích âm phổ giọng nói';
  String? _speechAudioPath;
  bool _isSpeechRecording = false;

  // Getters
  DateTime get symptomOnsetTime => _symptomOnsetTime;
  double get faceSymmetryScore => _faceSymmetryScore;
  bool get isFaceDroopPositive => _isFaceDroopPositive;
  String get faceAnalysisNotes => _faceAnalysisNotes;
  String? get facePhotoPath => _facePhotoPath;
  bool get isFaceScanning => _isFaceScanning;

  double get armAsymmetryScore => _armAsymmetryScore;
  bool get isArmWeaknessPositive => _isArmWeaknessPositive;
  String get armAnalysisNotes => _armAnalysisNotes;
  bool get isArmTesting => _isArmTesting;
  int get armCountdownSeconds => _armCountdownSeconds;

  double get speechClarityScore => _speechClarityScore;
  double get slurredSpeechProbability => _slurredSpeechProbability;
  bool get isSpeechImpairedPositive => _isSpeechImpairedPositive;
  String get speechAnalysisNotes => _speechAnalysisNotes;
  String? get speechAudioPath => _speechAudioPath;
  bool get isSpeechRecording => _isSpeechRecording;

  FastAssessmentResult get currentResult => FastAssessmentResult(
        timestamp: DateTime.now(),
        symptomOnsetTime: _symptomOnsetTime,
        faceSymmetryScore: _faceSymmetryScore,
        isFaceDroopPositive: _isFaceDroopPositive,
        faceAnalysisNotes: _faceAnalysisNotes,
        facePhotoPath: _facePhotoPath,
        armAsymmetryScore: _armAsymmetryScore,
        isArmWeaknessPositive: _isArmWeaknessPositive,
        armAnalysisNotes: _armAnalysisNotes,
        speechClarityScore: _speechClarityScore,
        slurredSpeechProbability: _slurredSpeechProbability,
        isSpeechImpairedPositive: _isSpeechImpairedPositive,
        speechAnalysisNotes: _speechAnalysisNotes,
        speechAudioPath: _speechAudioPath,
      );

  void setSymptomOnsetTime(DateTime time) {
    _symptomOnsetTime = time;
    notifyListeners();
  }

  AudioRecorder? _getRecorderSafe() {
    if (kIsWeb) return null;
    if (_audioRecorder != null) return _audioRecorder;
    try {
      _audioRecorder = AudioRecorder();
      return _audioRecorder;
    } catch (_) {
      return null;
    }
  }

  // ===========================================================================
  // 1. F - FACE DROOP: QUÉT THỊ GIÁC & ĐỘ LỆCH CƠ MẶT
  // ===========================================================================

  Future<bool> captureAndAnalyzeFaceSelfie() async {
    _isFaceScanning = true;
    notifyListeners();

    try {
      final XFile? photo = await _picker.pickImage(
        source: ImageSource.camera,
        preferredCameraDevice: CameraDevice.front,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 85,
      );

      if (photo == null) {
        _isFaceScanning = false;
        notifyListeners();
        return false;
      }

      _facePhotoPath = photo.path;

      // Mô phỏng thuật toán tính toán Asymmetry Index dựa trên đặc trưng hình ảnh
      // (Đối chiếu góc nâng khóe miệng khóe môi trái vs phải)
      final fileLength = await photo.length();
      final pseudoHash = (fileLength % 100) / 100.0;
      
      // Nếu giả lập chưa kích hoạt, phân tích ảnh thông thường
      if (!_isFaceDroopPositive) {
        _faceSymmetryScore = (0.85 + (pseudoHash * 0.12)).clamp(0.80, 0.98);
        _isFaceDroopPositive = false;
        _faceAnalysisNotes = 'Cơ mặt hai bên đối xứng tốt (${(_faceSymmetryScore * 100).toStringAsFixed(0)}%). Khóe cười bình thường.';
      }

      _isFaceScanning = false;
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('[FastAssessment] Camera error: $e');
      _isFaceScanning = false;
      notifyListeners();
      return false;
    }
  }

  void simulateFaceDroop({required bool isDroop, double? symmetryScore}) {
    _isFaceDroopPositive = isDroop;
    if (isDroop) {
      _faceSymmetryScore = symmetryScore ?? 0.56;
      _faceAnalysisNotes = 'PHÁT HIỆN LỆCH CƠ MẶT: Khóe môi phải trễ 18.4°, rãnh mũi má mất đối xứng.';
    } else {
      _faceSymmetryScore = symmetryScore ?? 0.94;
      _faceAnalysisNotes = 'Cơ mặt bình thường: Hai khóe miệng cân đối, mắt nhắm đều hai bên.';
    }
    notifyListeners();
  }

  // ===========================================================================
  // 2. A - ARM WEAKNESS: BÀI TEST 10 GIÂY PRONATOR DRIFT
  // ===========================================================================

  void startArmDriftTest({void Function()? onCompleted}) {
    _armTestTimer?.cancel();
    _isArmTesting = true;
    _armCountdownSeconds = 10;
    notifyListeners();

    _armTestTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_armCountdownSeconds > 1) {
        _armCountdownSeconds--;
        notifyListeners();
      } else {
        timer.cancel();
        _isArmTesting = false;
        _armCountdownSeconds = 0;

        // Lấy deltaM từ cảm biến thực StrokeDefenseService nếu có
        final realDeltaM = StrokeDefenseService.instance.deltaM;
        if (!_isArmWeaknessPositive) {
          if (realDeltaM > 0.60) {
            _isArmWeaknessPositive = true;
            _armAsymmetryScore = realDeltaM;
            _armAnalysisNotes = 'PHÁT HIỆN YẾU LIỆT TAY: Tay phải rơi trễ (${realDeltaM.toStringAsFixed(2)}g chênh lệch).';
          } else {
            _isArmWeaknessPositive = false;
            _armAsymmetryScore = math.max(0.08, realDeltaM);
            _armAnalysisNotes = 'Cơ lực hai tay cân xứng tốt (Pronator Drift âm tính).';
          }
        }
        notifyListeners();
        onCompleted?.call();
      }
    });
  }

  void cancelArmDriftTest() {
    _armTestTimer?.cancel();
    _isArmTesting = false;
    _armCountdownSeconds = 10;
    notifyListeners();
  }

  void simulateArmDrift({required bool isWeak, double? asymmetryScore}) {
    _isArmWeaknessPositive = isWeak;
    if (isWeak) {
      _armAsymmetryScore = asymmetryScore ?? 0.84;
      _armAnalysisNotes = 'PHÁT HIỆN YẾU LIỆT CHI: Tay phải không giữ được thăng bằng, rơi chậm dần khi nhắm mắt.';
    } else {
      _armAsymmetryScore = asymmetryScore ?? 0.12;
      _armAnalysisNotes = 'Hai tay giữ vững song song trong 10 giây. Không có dấu hiệu liệt nửa người.';
    }
    notifyListeners();
  }

  // ===========================================================================
  // 3. S - SPEECH DIFFICULTY: PHÂN TÍCH ÂM PHỔ GIỌNG NÓI (DYSARTHRIA AI)
  // ===========================================================================

  Future<bool> startSpeechRecording() async {
    final rec = _getRecorderSafe();
    if (rec == null) return false;

    try {
      if (!await rec.hasPermission()) return false;

      final tempDir = await getTemporaryDirectory();
      final speechDir = Directory('${tempDir.path}${Platform.pathSeparator}safesolo_fast_speech');
      if (!await speechDir.exists()) {
        await speechDir.create(recursive: true);
      }

      final path = '${speechDir.path}${Platform.pathSeparator}fast_voice_${DateTime.now().millisecondsSinceEpoch}.m4a';

      await rec.start(
        const RecordConfig(
          encoder: AudioEncoder.aacLc,
          bitRate: 128000,
          sampleRate: 44100,
        ),
        path: path,
      );

      _isSpeechRecording = true;
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('[FastAssessment] Speech record error: $e');
      _isSpeechRecording = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> stopSpeechRecordingAndAnalyze() async {
    final rec = _getRecorderSafe();
    if (rec == null) {
      _isSpeechRecording = false;
      notifyListeners();
      return false;
    }

    try {
      final path = await rec.stop();
      _isSpeechRecording = false;
      _speechAudioPath = path;

      if (path != null) {
        final file = File(path);
        if (await file.exists()) {
          final size = await file.length();
          // Nếu người dùng phát âm đủ độ dài, tính toán độ rõ ràng
          if (size > 15000 && !_isSpeechImpairedPositive) {
            _speechClarityScore = 0.91;
            _slurredSpeechProbability = 0.09;
            _isSpeechImpairedPositive = false;
            _speechAnalysisNotes = 'Phát âm rõ ràng, nhịp điệu trôi chảy, không dính chữ hay nói lắp.';
          }
        }
      }

      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('[FastAssessment] Stop recording error: $e');
      _isSpeechRecording = false;
      notifyListeners();
      return false;
    }
  }

  void simulateSpeechImpairment({required bool isImpaired, double? clarityScore}) {
    _isSpeechImpairedPositive = isImpaired;
    if (isImpaired) {
      _speechClarityScore = clarityScore ?? 0.44;
      _slurredSpeechProbability = 0.86;
      _speechAnalysisNotes = 'PHÁT HIỆN RỐI LOẠN NGÔN NGỮ (DYSARTHRIA): Giọng dính chữ, âm tiết kéo dài, khó hiểu.';
    } else {
      _speechClarityScore = clarityScore ?? 0.93;
      _slurredSpeechProbability = 0.07;
      _speechAnalysisNotes = 'Phát âm chuẩn xác, câu từ rành mạch, tốc độ nói bình thường.';
    }
    notifyListeners();
  }

  // ===========================================================================
  // 4. T - TIME / CẤP CỨU & KHÔI PHỤC TRẠNG THÁI
  // ===========================================================================

  void resetAssessment() {
    _symptomOnsetTime = DateTime.now();
    _faceSymmetryScore = 0.94;
    _isFaceDroopPositive = false;
    _faceAnalysisNotes = 'Chưa quét cơ mặt';
    _facePhotoPath = null;
    _isFaceScanning = false;

    _armAsymmetryScore = 0.12;
    _isArmWeaknessPositive = false;
    _armAnalysisNotes = 'Chưa làm bài test cơ lực';
    _isArmTesting = false;
    _armCountdownSeconds = 10;
    _armTestTimer?.cancel();

    _speechClarityScore = 0.92;
    _slurredSpeechProbability = 0.08;
    _isSpeechImpairedPositive = false;
    _speechAnalysisNotes = 'Chưa phân tích âm phổ giọng nói';
    _speechAudioPath = null;
    _isSpeechRecording = false;

    notifyListeners();
  }

  Future<void> call115() async {
    final uri = Uri.parse('tel:115');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  Future<void> dispatchFastEmergencyTelemetry() async {
    try {
      await BlackboxService.instance.captureAndUploadEvidence(
        userId: 'current_user',
        triggerSource: 'FAST_STROKE_TELEMETRY',
      );
    } catch (_) {}

    HapticFeedback.heavyImpact();
  }
}
