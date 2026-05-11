const User = require('../models/User');
const { AppError } = require('../lib/errors');
const { toIso } = require('../lib/mongoCore');

class LocationService {
  async updateUserLocation(userId, lat, lng, extra = {}) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    user.lastKnownLocation = {
      lat,
      lng,
      updatedAt: new Date(),
    };
    user.batteryLevel = extra.batteryLevel ?? user.batteryLevel;
    user.approxAddress = extra.approxAddress ?? user.approxAddress;
    await user.save();

    return {
      id: user._id,
      lastLat: user.lastKnownLocation.lat,
      lastLng: user.lastKnownLocation.lng,
      lastLocationTime: toIso(user.lastKnownLocation.updatedAt),
      batteryLevel: user.batteryLevel,
      approxAddress: user.approxAddress,
    };
  }

  async getUserLocation(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    return {
      id: user._id,
      lastLat: user.lastKnownLocation?.lat ?? null,
      lastLng: user.lastKnownLocation?.lng ?? null,
      lastLocationTime: toIso(user.lastKnownLocation?.updatedAt),
      batteryLevel: user.batteryLevel,
      approxAddress: user.approxAddress,
    };
  }
}

module.exports = new LocationService();
