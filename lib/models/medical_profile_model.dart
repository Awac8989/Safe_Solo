class MedicalProfileModel {
  const MedicalProfileModel({
    required this.userId,
    required this.fullName,
    required this.birthYear,
    required this.bloodType,
    required this.allergies,
    required this.conditions,
    required this.medications,
    required this.emergencyPhone,
    required this.insuranceProvider,
    required this.insuranceNumber,
  });

  final String userId;
  final String fullName;
  final String birthYear;
  final String bloodType;
  final String allergies;
  final String conditions;
  final String medications;
  final String emergencyPhone;
  final String insuranceProvider;
  final String insuranceNumber;

  factory MedicalProfileModel.fromJson(Map<String, dynamic> json) {
    return MedicalProfileModel(
      userId: json['userId'] as String? ?? '',
      fullName: json['fullName'] as String? ?? '',
      birthYear: json['birthYear'] as String? ?? '',
      bloodType: json['bloodType'] as String? ?? 'O+',
      allergies: json['allergies'] as String? ?? '',
      conditions: json['conditions'] as String? ?? '',
      medications: json['medications'] as String? ?? '',
      emergencyPhone: json['emergencyPhone'] as String? ?? '',
      insuranceProvider: json['insuranceProvider'] as String? ?? '',
      insuranceNumber: json['insuranceNumber'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
    'userId': userId,
    'fullName': fullName,
    'birthYear': birthYear,
    'bloodType': bloodType,
    'allergies': allergies,
    'conditions': conditions,
    'medications': medications,
    'emergencyPhone': emergencyPhone,
    'insuranceProvider': insuranceProvider,
    'insuranceNumber': insuranceNumber,
  };
}
