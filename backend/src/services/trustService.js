const prisma = require('../config/database');

class TrustService {
  async calculateAndUpdateTrustScore(volunteerId, rating) {
    const volunteer = await prisma.user.findUnique({
      where: { id: volunteerId },
      select: {
        trust_score: true,
        rescues_count: true
      }
    });

    if (!volunteer) {
      throw new Error('Volunteer not found');
    }

    const newRescuesCount = volunteer.rescues_count + 1;
    const newTrustScore = ((volunteer.trust_score * volunteer.rescues_count) + rating) / newRescuesCount;

    return prisma.user.update({
      where: { id: volunteerId },
      data: {
        trust_score: newTrustScore,
        rescues_count: newRescuesCount
      }
    });
  }
}

module.exports = new TrustService();