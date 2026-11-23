import 'package:flutter/foundation.dart';

/// ============================================================================
/// SAFESOLO — PHÂN HỆ 140: DRUG CONTRAINDICATION SHIELD SERVICE
/// Khóa an toàn chống chỉ định thuốc & phản vệ cấp tính tại hiện trường
/// So khớp thuốc dự định dùng với Hồ sơ dị ứng I.C.E & tiền sử bệnh án
///
/// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03 - TDMU
/// Tiêu chuẩn: WHO Patient Safety & Phác đồ Chống Sốc Phản Vệ Thông tư 51/2017/TT-BYT
/// ============================================================================

enum DrugSafetyStatus {
  safe,            // An toàn để sử dụng
  warning,         // Cảnh báo thận trọng (liều lượng / bệnh lý nền)
  contraindicated, // TUYỆT ĐỐI CHỐNG CHỈ ĐỊNH (Nguy cơ tử vong / Phản vệ nặng)
}

class DrugSafetyCheckResult {
  const DrugSafetyCheckResult({
    required this.drugName,
    required this.status,
    required this.reason,
    required this.recommendedAlternative,
    required this.matchedAllergy,
  });

  final String drugName;
  final DrugSafetyStatus status;
  final String reason;
  final String recommendedAlternative;
  final String? matchedAllergy;

  bool get isBlocked => status == DrugSafetyStatus.contraindicated;
}

class DrugShieldService {
  DrugShieldService._();
  static final DrugShieldService instance = DrugShieldService._();

  /// Cơ sở tri thức đối soát chống chỉ định thuốc cấp cứu
  static final Map<String, List<String>> _drugAllergyKeywords = {
    'Penicillin': ['penicillin', 'amoxicillin', 'ampicillin', 'augmentin', 'kháng sinh nhóm beta-lactam'],
    'Cephalosporin': ['cephalosporin', 'ceftriaxone', 'cefuroxime', 'kefzol', 'beta-lactam'],
    'Aspirin': ['aspirin', 'nsaid', 'kháng viêm không steroid', 'ibuprofen', 'naproxen', 'viêm loét dạ dày'],
    'Morphin': ['morphin', 'opioid', 'suy hô hấp', 'chấn thương sọ não', 'dị ứng morphin'],
    'Paracetamol': ['paracetamol', 'panadol', 'suy gan cấp', 'ngộ độc gan'],
    'Iodine Contrast': ['iod', 'thuốc cản quang', 'dị ứng hải sản', 'suy thận nặng'],
    'Nitroglycerin': ['huyết áp thấp', 'đang dùng sildenafil', 'nhồi máu thất phải'],
    'Adrenaline': ['tăng huyết áp ác tính', 'u tủy thượng thận'],
  };

  /// Kiểm tra chéo thuốc với danh sách dị ứng và bệnh lý từ hồ sơ I.C.E
  DrugSafetyCheckResult checkDrugSafety({
    required String drugName,
    required String victimAllergies,
    required String victimConditions,
  }) {
    final lowerDrug = drugName.toLowerCase().trim();
    final lowerAllergies = victimAllergies.toLowerCase();
    final lowerConditions = victimConditions.toLowerCase();

    // 1. Kiểm tra đối soát dị ứng trực tiếp
    for (final entry in _drugAllergyKeywords.entries) {
      final key = entry.key.toLowerCase();
      if (lowerDrug.contains(key) || key.contains(lowerDrug)) {
        for (final allergen in entry.value) {
          if (lowerAllergies.contains(allergen)) {
            return DrugSafetyCheckResult(
              drugName: drugName,
              status: DrugSafetyStatus.contraindicated,
              reason: 'Nạn nhân có tiền sử dị ứng với "$allergen". Nguy cơ sốc phản vệ tối cấp độ 4 tử vong!',
              recommendedAlternative: _getAlternative(entry.key),
              matchedAllergy: allergen,
            );
          }
        }
      }
    }

    // 2. Kiểm tra bệnh lý nền chống chỉ định
    if ((lowerDrug.contains('aspirin') || lowerDrug.contains('ibuprofen')) &&
        (lowerConditions.contains('viêm loét dạ dày') || lowerConditions.contains('xuất huyết tiêu hóa') || lowerConditions.contains('dengue'))) {
      return DrugSafetyCheckResult(
        drugName: drugName,
        status: DrugSafetyStatus.contraindicated,
        reason: 'Nạn nhân có bệnh nền Xuất huyết / Loét dạ dày / Nghi ngờ Sốt xuất huyết. Tuyệt đối cấm dùng NSAID!',
        recommendedAlternative: 'Sử dụng Paracetamol liều chuẩn 500mg để hạ sốt giảm đau.',
        matchedAllergy: null,
      );
    }

    if (lowerDrug.contains('morphin') &&
        (lowerConditions.contains('sọ não') || lowerConditions.contains('suy hô hấp') || lowerConditions.contains('copd'))) {
      return DrugSafetyCheckResult(
        drugName: drugName,
        status: DrugSafetyStatus.contraindicated,
        reason: 'Nạn nhân chấn thương sọ não / suy hô hấp. Morphin gây ức chế trung tâm hô hấp và che lấp tri giác!',
        recommendedAlternative: 'Giảm đau không opioid hoặc cố định bất động chi tốt.',
        matchedAllergy: null,
      );
    }

    // 3. Nếu không vi phạm
    return DrugSafetyCheckResult(
      drugName: drugName,
      status: DrugSafetyStatus.safe,
      reason: 'Thuốc an toàn theo hồ sơ I.C.E hiện tại. Không phát hiện xung đột dị ứng nguy hiểm.',
      recommendedAlternative: 'Tuân thủ đúng liều lượng và phác đồ PHTLS.',
      matchedAllergy: null,
    );
  }

  String _getAlternative(String drugClass) {
    switch (drugClass) {
      case 'Penicillin':
      case 'Cephalosporin':
        return 'Chuyển sang nhóm Macrolide (Azithromycin) hoặc Quinolone (Levofloxacin) nếu có chỉ định.';
      case 'Aspirin':
        return 'Paracetamol 500mg IV hoặc Paracetamol đường uống.';
      case 'Morphin':
        return 'Ketamine liều thấp giảm đau (Sub-dissociative 0.2-0.3 mg/kg) hoặc Paracetamol truyền tĩnh mạch.';
      case 'Iodine Contrast':
        return 'Chụp MRI không cản từ hoặc Siêu âm Doppler tại giường POCUS.';
      default:
        return 'Tham vấn bác sĩ chuyên khoa cấp cứu 115 trước khi dùng.';
    }
  }
}
