const User = require('../models/User');
const { AppError } = require('../lib/errors');

class TrustService {
  async calculateAndUpdateTrustScore(volunteerId, rating = 5) {
    const volunteer = await User.findById(volunteerId);
    if (!volunteer) {
      throw new AppError('Volunteer not found', 404);
    }

    const oldCount = Number(volunteer.rescuesCount || 0);
    const oldScore = Number(volunteer.trustScore || 50);

    // 1. Nếu là điểm phạt âm (ví dụ: -20 điểm khi bỏ ca)
    if (rating < 0) {
      volunteer.trustScore = Math.max(0, Number((oldScore + rating).toFixed(2)));
      await volunteer.save();
      return volunteer;
    }

    // 2. Nếu là điểm thưởng nhiệm vụ đặc biệt (Delta > 5, ví dụ +15 hoặc +20 điểm)
    if (rating > 5) {
      volunteer.rescuesCount = oldCount + 1;
      volunteer.trustScore = Math.min(100, Number((oldScore + rating).toFixed(2)));
      await volunteer.save();
      return volunteer;
    }

    // 3. Nếu là đánh giá theo thang điểm sao 1 - 5 truyền thống
    const newCount = oldCount + 1;
    volunteer.rescuesCount = newCount;
    volunteer.trustScore = Number(
      (((oldScore * oldCount) + Number(rating)) / newCount).toFixed(2),
    );
    await volunteer.save();

    return volunteer;
  }
}

module.exports = new TrustService();
