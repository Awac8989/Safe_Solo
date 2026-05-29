const MedicalProfile = require('../models/MedicalProfile');
const User = require('../models/User');
const { AppError } = require('../lib/errors');
const {
  buildEncryptedMedicalUpdate,
  decryptMedicalPayload,
} = require('../lib/medicalProfileCodec');

function toLegacyProfile(profile, userId) {
  const payload = decryptMedicalPayload(profile);
  return {
    id: profile._id || `med-${userId}`,
    userId,
    bloodType: payload?.bloodType || profile.bloodType || null,
    allergies: payload?.allergiesList?.length
      ? payload.allergiesList
      : payload?.allergies
        ? [payload.allergies]
        : [],
    medications: payload?.medicationsList?.length
      ? payload.medicationsList
      : payload?.medications
        ? [payload.medications]
        : [],
    medicalConditions: payload?.medicalConditions?.length
      ? payload.medicalConditions
      : payload?.conditions
        ? [payload.conditions]
        : [],
    emergencyContact: payload?.emergencyContact || null,
    insuranceInfo: payload?.insuranceInfo || null,
    doctor: payload?.doctor || null,
    qrCodeValue: payload?.qrCodeValue || `SAFE-MED-${userId}`,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

class MedicalService {
  async createMedicalProfile(userId, profileData) {
    const existing = await MedicalProfile.findOne({ userId });
    if (existing) {
      throw new AppError('Medical profile already exists for this user', 409);
    }

    const profile = await MedicalProfile.create({
      userId,
      ...buildEncryptedMedicalUpdate(userId, {
        bloodType: profileData.bloodType || null,
        allergies: Array.isArray(profileData.allergies) ? profileData.allergies.join(', ') : '',
        medications: Array.isArray(profileData.medications) ? profileData.medications.join(', ') : '',
        conditions: Array.isArray(profileData.medicalConditions)
          ? profileData.medicalConditions.join(', ')
          : '',
        allergiesList: profileData.allergies || [],
        medicationsList: profileData.medications || [],
        medicalConditions: profileData.medicalConditions || [],
        emergencyContact: profileData.emergencyContact || null,
        insuranceInfo: profileData.insuranceInfo || null,
        doctor: profileData.doctor || null,
        emergencyPhone: profileData.emergencyContact?.phone || '',
        insuranceProvider: profileData.insuranceInfo?.provider || '',
        insuranceNumber: profileData.insuranceInfo?.number || '',
        qrCodeValue: `SAFE-MED-${userId}`,
      }),
    });

    return toLegacyProfile(profile, userId);
  }

  async getMedicalProfile(userId) {
    const profile = await MedicalProfile.findOne({ userId });
    if (!profile) {
      throw new AppError('Medical profile not found', 404);
    }
    return toLegacyProfile(profile, userId);
  }

  async updateMedicalProfile(userId, updateData) {
    const profile = await MedicalProfile.findOne({ userId });
    if (!profile) {
      throw new AppError('Medical profile not found', 404);
    }

    const existing = decryptMedicalPayload(profile) || {};
    const merged = {
      ...existing,
      bloodType: updateData.bloodType ?? existing.bloodType ?? profile.bloodType,
      allergiesList: updateData.allergies ?? existing.allergiesList ?? [],
      medicationsList: updateData.medications ?? existing.medicationsList ?? [],
      medicalConditions: updateData.medicalConditions ?? existing.medicalConditions ?? [],
      emergencyContact: updateData.emergencyContact ?? existing.emergencyContact ?? null,
      insuranceInfo: updateData.insuranceInfo ?? existing.insuranceInfo ?? null,
      doctor: updateData.doctor ?? existing.doctor ?? null,
    };
    merged.allergies = merged.allergiesList.join(', ');
    merged.medications = merged.medicationsList.join(', ');
    merged.conditions = merged.medicalConditions.join(', ');
    merged.emergencyPhone = merged.emergencyContact?.phone || existing.emergencyPhone || '';
    merged.insuranceProvider = merged.insuranceInfo?.provider || existing.insuranceProvider || '';
    merged.insuranceNumber = merged.insuranceInfo?.number || existing.insuranceNumber || '';
    merged.qrCodeValue = existing.qrCodeValue || `SAFE-MED-${userId}`;

    Object.assign(profile, buildEncryptedMedicalUpdate(userId, merged));
    await profile.save();

    return toLegacyProfile(profile, userId);
  }

  async deleteMedicalProfile(userId) {
    const result = await MedicalProfile.deleteOne({ userId });
    if (!result.deletedCount) {
      throw new AppError('Medical profile not found', 404);
    }
    return { message: 'Medical profile deleted successfully' };
  }

  async getEmergencyProfile(userId) {
    const [profile, user] = await Promise.all([
      MedicalProfile.findOne({ userId }),
      User.findById(userId),
    ]);
    if (!profile) {
      throw new AppError('Medical profile not found', 404);
    }
    const payload = decryptMedicalPayload(profile) || {};

    return {
      bloodType: payload?.bloodType || profile.bloodType,
      allergies: payload?.allergiesList?.length
        ? payload.allergiesList
        : payload?.allergies
          ? [payload.allergies]
          : [],
      medications: payload?.medicationsList?.length
        ? payload.medicationsList
        : payload?.medications
          ? [payload.medications]
          : [],
      medicalConditions: payload?.medicalConditions?.length
        ? payload.medicalConditions
        : payload?.conditions
          ? [payload.conditions]
          : [],
      emergencyContact: payload?.emergencyContact || {
        name: user?.fullName || '',
        phone: payload?.emergencyPhone || user?.phoneNumber || '',
        relationship: 'Emergency',
      },
      insuranceInfo: payload?.insuranceInfo || null,
      doctor: payload?.doctor || null,
      qrCodeValue: payload?.qrCodeValue || `SAFE-MED-${userId}`,
    };
  }
}

module.exports = new MedicalService();
