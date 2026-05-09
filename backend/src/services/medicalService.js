const { readState, withState, createId, nowIso } = require('../data/store');
const { AppError } = require('../lib/errors');

class MedicalService {
  async createMedicalProfile(userId, profileData) {
    return withState((state) => {
      const existing = state.medicalProfiles.find((item) => item.userId === userId);
      if (existing) {
        throw new AppError('Medical profile already exists for this user', 409);
      }

      const profile = {
        id: createId('med'),
        userId,
        bloodType: profileData.bloodType || null,
        allergies: profileData.allergies || [],
        medications: profileData.medications || [],
        medicalConditions: profileData.medicalConditions || [],
        emergencyContact: profileData.emergencyContact || null,
        insuranceInfo: profileData.insuranceInfo || null,
        doctor: profileData.doctor || null,
        qrCodeValue: `SAFE-MED-${userId}`,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };

      state.medicalProfiles.push(profile);
      return profile;
    });
  }

  async getMedicalProfile(userId) {
    const state = readState();
    const profile = state.medicalProfiles.find((item) => item.userId === userId);
    if (!profile) {
      throw new AppError('Medical profile not found', 404);
    }
    return profile;
  }

  async updateMedicalProfile(userId, updateData) {
    return withState((state) => {
      const profile = state.medicalProfiles.find((item) => item.userId === userId);
      if (!profile) {
        throw new AppError('Medical profile not found', 404);
      }

      Object.assign(profile, {
        ...updateData,
        updatedAt: nowIso(),
      });

      if (!profile.qrCodeValue) {
        profile.qrCodeValue = `SAFE-MED-${userId}`;
      }

      return profile;
    });
  }

  async deleteMedicalProfile(userId) {
    return withState((state) => {
      const index = state.medicalProfiles.findIndex((item) => item.userId === userId);
      if (index < 0) {
        throw new AppError('Medical profile not found', 404);
      }

      state.medicalProfiles.splice(index, 1);
      return { message: 'Medical profile deleted successfully' };
    });
  }

  async getEmergencyProfile(userId) {
    const profile = await this.getMedicalProfile(userId);
    return {
      bloodType: profile.bloodType,
      allergies: profile.allergies,
      medications: profile.medications,
      medicalConditions: profile.medicalConditions,
      emergencyContact: profile.emergencyContact,
      insuranceInfo: profile.insuranceInfo,
      doctor: profile.doctor,
      qrCodeValue: profile.qrCodeValue,
    };
  }
}

module.exports = new MedicalService();
