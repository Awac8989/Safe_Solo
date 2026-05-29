const User = require('../models/User');
const { AppError } = require('../lib/errors');
const { toIso } = require('../lib/mongoCore');
const { buildEncryptedUserSensitiveUpdate, decryptUserSensitivePayload } = require('../lib/userSensitiveCodec');

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
    if (Object.prototype.hasOwnProperty.call(extra, 'approxAddress')) {
      const sensitive = decryptUserSensitivePayload(user);
      Object.assign(
        user,
        buildEncryptedUserSensitiveUpdate(userId, {
          ...sensitive,
          approxAddress: extra.approxAddress ?? sensitive.approxAddress,
        }),
      );
    }
    await user.save();

    const sensitive = decryptUserSensitivePayload(user);
    return {
      id: user._id,
      lastLat: user.lastKnownLocation.lat,
      lastLng: user.lastKnownLocation.lng,
      lastLocationTime: toIso(user.lastKnownLocation.updatedAt),
      batteryLevel: user.batteryLevel,
      approxAddress: sensitive.approxAddress,
    };
  }

  async getUserLocation(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const sensitive = decryptUserSensitivePayload(user);
    return {
      id: user._id,
      lastLat: user.lastKnownLocation?.lat ?? null,
      lastLng: user.lastKnownLocation?.lng ?? null,
      lastLocationTime: toIso(user.lastKnownLocation?.updatedAt),
      batteryLevel: user.batteryLevel,
      approxAddress: sensitive.approxAddress,
    };
  }
}

module.exports = new LocationService();
