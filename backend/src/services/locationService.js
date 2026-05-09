const { readState, withState, nowIso } = require('../data/store');
const { AppError } = require('../lib/errors');

class LocationService {
  async updateUserLocation(userId, lat, lng, extra = {}) {
    return withState((state) => {
      const user = state.users.find((item) => item.id === userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      user.lastLat = lat;
      user.lastLng = lng;
      user.lastLocationTime = nowIso();
      user.batteryLevel = extra.batteryLevel ?? user.batteryLevel;
      user.approxAddress = extra.approxAddress ?? user.approxAddress;
      user.updatedAt = nowIso();

      return {
        id: user.id,
        lastLat: user.lastLat,
        lastLng: user.lastLng,
        lastLocationTime: user.lastLocationTime,
        batteryLevel: user.batteryLevel,
        approxAddress: user.approxAddress,
      };
    });
  }

  async getUserLocation(userId) {
    const state = readState();
    const user = state.users.find((item) => item.id === userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    return {
      id: user.id,
      lastLat: user.lastLat,
      lastLng: user.lastLng,
      lastLocationTime: user.lastLocationTime,
      batteryLevel: user.batteryLevel,
      approxAddress: user.approxAddress,
    };
  }
}

module.exports = new LocationService();
