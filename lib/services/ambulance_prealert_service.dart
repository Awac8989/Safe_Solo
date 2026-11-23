import 'dart:async';
import 'package:flutter/foundation.dart';

/// ============================================================================
/// SAFESOLO — PHÂN HỆ 142: SMART AMBULANCE PRE-ALERT & TRAUMA GATEWAY
/// Giao tiếp thời gian thực với Phòng Cấp cứu Bệnh viện đích
/// Truyền phát dữ liệu sinh tồn, Glasgow, thời gian tiếp cận ETA, và chuẩn bị ICU
///
/// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03 - TDMU
/// Chuẩn tương thích: HL7 FHIR Emergency Care & ACEP Pre-hospital Alert Protocol
/// ============================================================================

enum PreAlertPriority {
  codeRed,    // Đỏ tối cấp (Ngừng tim / Đột quỵ / Sốc mất máu nặng) -> Sẵn sàng phòng mổ
  codeYellow, // Vàng (Gãy xương lớn, chấn thương kín, suy hô hấp nhẹ) -> Chuẩn bị phòng lưu
  codeGreen,  // Xanh (Ổn định, chấn thương phần mềm)
}

class TraumaPreAlertPayload {
  const TraumaPreAlertPayload({
    required this.incidentId,
    required this.targetHospitalName,
    required this.priority,
    required this.etaMinutes,
    required this.patientAgeGender,
    required this.bloodType,
    required this.glasgowScore,
    required this.heartRateBpm,
    required this.spO2Percent,
    required this.systolicBp,
    required this.traumaMechanism,
    required this.contraindications,
    required this.timestamp,
  });

  final String incidentId;
  final String targetHospitalName;
  final PreAlertPriority priority;
  final int etaMinutes;
  final String patientAgeGender;
  final String bloodType;
  final int glasgowScore; // 3-15
  final int heartRateBpm;
  final double spO2Percent;
  final int systolicBp;
  final String traumaMechanism;
  final List<String> contraindications;
  final DateTime timestamp;

  Map<String, dynamic> toJson() => {
    'incidentId': incidentId,
    'targetHospitalName': targetHospitalName,
    'priority': priority.name,
    'etaMinutes': etaMinutes,
    'patientAgeGender': patientAgeGender,
    'bloodType': bloodType,
    'glasgowScore': glasgowScore,
    'heartRateBpm': heartRateBpm,
    'spO2Percent': spO2Percent,
    'systolicBp': systolicBp,
    'traumaMechanism': traumaMechanism,
    'contraindications': contraindications,
    'timestamp': timestamp.toIso8601String(),
  };
}

class AmbulancePreAlertService extends ChangeNotifier {
  AmbulancePreAlertService._();
  static final AmbulancePreAlertService instance = AmbulancePreAlertService._();

  bool _isDispatched = false;
  bool get isDispatched => _isDispatched;

  TraumaPreAlertPayload? _activePayload;
  TraumaPreAlertPayload? get activePayload => _activePayload;

  String _hospitalAckStatus = 'Sẵn sàng phát lệnh';
  String get hospitalAckStatus => _hospitalAckStatus;

  /// Phát lệnh Pre-Alert tới Bệnh viện tuyến đầu
  Future<bool> dispatchPreAlert(TraumaPreAlertPayload payload) async {
    _isDispatched = true;
    _activePayload = payload;
    _hospitalAckStatus = 'Đang truyền gói FHIR tới ${payload.targetHospitalName}...';
    notifyListeners();

    // Giả lập bắt tay Socket.IO & HL7 FHIR Gateway
    await Future.delayed(const Duration(milliseconds: 800));
    _hospitalAckStatus = 'BV ĐÃ TIẾP NHẬN (ACK-200) — Ê-kíp Cấp Cứu Đang Chuẩn Bị!';
    notifyListeners();

    if (kDebugMode) {
      debugPrint('[PreAlert] Đã gửi báo trước tới: ${payload.targetHospitalName} (ETA: ${payload.etaMinutes}m)');
    }
    return true;
  }

  void cancelAlert() {
    _isDispatched = false;
    _activePayload = null;
    _hospitalAckStatus = 'Đã hủy lệnh báo trước';
    notifyListeners();
  }
}
