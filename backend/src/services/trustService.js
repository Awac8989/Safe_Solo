const User = require('../models/User');
const { AppError } = require('../lib/errors');

class TrustService {
  async calculateAndUpdateTrustScore(volunteerId, rating = 5) {
    const volunteer = await User.findById(volunteerId);
    if (!volunteer) {
      throw new AppError('Volunteer not found', 404);
    }

    const oldCount = Number(volunteer.rescuesCount || 0);
    const oldScore = Number(volunteer.trustScore || 5);
    const newCount = oldCount + 1;
    volunteer.rescuesCount = newCount;
    volunteer.trustScore = Number((((oldScore * oldCount) + Number(rating)) / newCount).toFixed(2));
    await volunteer.save();

    return volunteer;
  }
}

module.exports = new TrustService();
