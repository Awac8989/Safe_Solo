const { decryptJson, encryptJson } = require('./securityCrypto');

function buildMedicalPayload(input = {}) {
  return {
    fullName: String(input.fullName || '').trim(),
    birthYear: String(input.birthYear || '').trim(),
    bloodType: String(input.bloodType || 'O+').trim() || 'O+',
    allergies: String(input.allergies || '').trim(),
    conditions: String(input.conditions || '').trim(),
    medications: String(input.medications || '').trim(),
    emergencyPhone: String(input.emergencyPhone || '').trim(),
    insuranceProvider: String(input.insuranceProvider || '').trim(),
    insuranceNumber: String(input.insuranceNumber || '').trim(),
    allergiesList: Array.isArray(input.allergiesList) ? input.allergiesList : [],
    medicationsList: Array.isArray(input.medicationsList) ? input.medicationsList : [],
    medicalConditions: Array.isArray(input.medicalConditions) ? input.medicalConditions : [],
    emergencyContact: input.emergencyContact || null,
    insuranceInfo: input.insuranceInfo || null,
    doctor: input.doctor || null,
    qrCodeValue: String(input.qrCodeValue || '').trim(),
  };
}

function encryptMedicalPayload(userId, payload) {
  return encryptJson(buildMedicalPayload(payload), `medical:${userId}`);
}

function decryptMedicalPayload(doc) {
  if (!doc) {
    return null;
  }

  const row = doc.toObject ? doc.toObject() : doc;
  const legacy = buildMedicalPayload({
    fullName: row.fullName,
    birthYear: row.birthYear,
    bloodType: row.bloodType,
    allergies: row.allergies,
    conditions: row.conditions,
    medications: row.medications,
    emergencyPhone: row.emergencyPhone,
    insuranceProvider: row.insuranceProvider,
    insuranceNumber: row.insuranceNumber,
    allergiesList: row.allergiesList,
    medicationsList: row.medicationsList,
    medicalConditions: row.medicalConditions,
    emergencyContact: row.emergencyContact,
    insuranceInfo: row.insuranceInfo,
    doctor: row.doctor,
    qrCodeValue: row.qrCodeValue,
  });

  if (!row.encryptedProfile) {
    return legacy;
  }

  try {
    const decrypted = decryptJson(row.encryptedProfile, `medical:${row.userId}`);
    return {
      ...legacy,
      ...buildMedicalPayload(decrypted || {}),
    };
  } catch (_error) {
    return legacy;
  }
}

function buildEncryptedMedicalUpdate(userId, payload) {
  const normalized = buildMedicalPayload(payload);
  return {
    bloodType: normalized.bloodType,
    encryptedProfile: encryptMedicalPayload(userId, normalized),
    encryptionVersion: 1,
    fullName: '',
    birthYear: '',
    allergies: '',
    conditions: '',
    medications: '',
    emergencyPhone: '',
    insuranceProvider: '',
    insuranceNumber: '',
    allergiesList: [],
    medicationsList: [],
    medicalConditions: [],
    emergencyContact: null,
    insuranceInfo: null,
    doctor: null,
    qrCodeValue: '',
  };
}

module.exports = {
  buildMedicalPayload,
  decryptMedicalPayload,
  encryptMedicalPayload,
  buildEncryptedMedicalUpdate,
};
