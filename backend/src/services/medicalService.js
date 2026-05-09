const prisma = require('../config/database');

class MedicalService {
  // Create medical profile
  async createMedicalProfile(userId, profileData) {
    // Check if profile already exists
    const existingProfile = await prisma.medicalProfile.findUnique({
      where: { userId }
    });

    if (existingProfile) {
      throw new Error('Medical profile already exists for this user');
    }

    const profile = await prisma.medicalProfile.create({
      data: {
        userId,
        ...profileData
      }
    });

    return profile;
  }

  // Get medical profile
  async getMedicalProfile(userId) {
    const profile = await prisma.medicalProfile.findUnique({
      where: { userId }
    });

    if (!profile) {
      throw new Error('Medical profile not found');
    }

    return profile;
  }

  // Update medical profile
  async updateMedicalProfile(userId, updateData) {
    const profile = await prisma.medicalProfile.findUnique({
      where: { userId }
    });

    if (!profile) {
      throw new Error('Medical profile not found');
    }

    const updatedProfile = await prisma.medicalProfile.update({
      where: { userId },
      data: updateData
    });

    return updatedProfile;
  }

  // Delete medical profile
  async deleteMedicalProfile(userId) {
    const profile = await prisma.medicalProfile.findUnique({
      where: { userId }
    });

    if (!profile) {
      throw new Error('Medical profile not found');
    }

    await prisma.medicalProfile.delete({
      where: { userId }
    });

    return { message: 'Medical profile deleted successfully' };
  }

  // Get medical profile for emergency access (by guardian)
  async getEmergencyProfile(userId) {
    const profile = await prisma.medicalProfile.findUnique({
      where: { userId },
      select: {
        bloodType: true,
        allergies: true,
        medications: true,
        medicalConditions: true,
        emergencyContact: true,
        insuranceInfo: true
      }
    });

    if (!profile) {
      throw new Error('Medical profile not found');
    }

    return profile;
  }
}

module.exports = new MedicalService();