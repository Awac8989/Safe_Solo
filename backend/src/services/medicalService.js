const MedicalProfile = require('../models/MedicalProfile');
const User = require('../models/User');
const { AppError } = require('../lib/errors');

function toLegacyProfile(profile, userId) {
  return {
    id: profile._id || `med-${userId}`,
    userId,
    bloodType: profile.bloodType || null,
    allergies: profile.allergiesList?.length ? profile.allergiesList : profile.allergies ? [profile.allergies] : [],
    medications: profile.medicationsList?.length ? profile.medicationsList : profile.medications ? [profile.medications] : [],
    medicalConditions: profile.medicalConditions?.length ? profile.medicalConditions : profile.conditions ? [profile.conditions] : [],
    emergencyContact: profile.emergencyContact || null,
    insuranceInfo: profile.insuranceInfo || null,
    doctor: profile.doctor || null,
    qrCodeValue: profile.qrCodeValue || `SAFE-MED-${userId}`,
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
      bloodType: profileData.bloodType || null,
      allergies: Array.isArray(profileData.allergies) ? profileData.allergies.join(', ') : '',
      medications: Array.isArray(profileData.medications) ? profileData.medications.join(', ') : '',
      conditions: Array.isArray(profileData.medicalConditions) ? profileData.medicalConditions.join(', ') : '',
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

    profile.bloodType = updateData.bloodType ?? profile.bloodType;
    profile.allergiesList = updateData.allergies ?? profile.allergiesList ?? [];
    profile.medicationsList = updateData.medications ?? profile.medicationsList ?? [];
    profile.medicalConditions = updateData.medicalConditions ?? profile.medicalConditions ?? [];
    profile.allergies = profile.allergiesList.join(', ');
    profile.medications = profile.medicationsList.join(', ');
    profile.conditions = profile.medicalConditions.join(', ');
    profile.emergencyContact = updateData.emergencyContact ?? profile.emergencyContact;
    profile.insuranceInfo = updateData.insuranceInfo ?? profile.insuranceInfo;
    profile.doctor = updateData.doctor ?? profile.doctor;
    profile.emergencyPhone = profile.emergencyContact?.phone || profile.emergencyPhone;
    profile.insuranceProvider = profile.insuranceInfo?.provider || profile.insuranceProvider;
    profile.insuranceNumber = profile.insuranceInfo?.number || profile.insuranceNumber;
    if (!profile.qrCodeValue) {
      profile.qrCodeValue = `SAFE-MED-${userId}`;
    }
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

    return {
      bloodType: profile.bloodType,
      allergies: profile.allergiesList?.length ? profile.allergiesList : profile.allergies ? [profile.allergies] : [],
      medications: profile.medicationsList?.length ? profile.medicationsList : profile.medications ? [profile.medications] : [],
      medicalConditions: profile.medicalConditions?.length ? profile.medicalConditions : profile.conditions ? [profile.conditions] : [],
      emergencyContact: profile.emergencyContact || {
        name: user?.fullName || '',
        phone: profile.emergencyPhone || user?.phoneNumber || '',
        relationship: 'Emergency',
      },
      insuranceInfo: profile.insuranceInfo || null,
      doctor: profile.doctor,
      qrCodeValue: profile.qrCodeValue || `SAFE-MED-${userId}`,
    };
  }
}

module.exports = new MedicalService();
