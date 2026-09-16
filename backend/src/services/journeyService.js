const LiveJourney = require('../models/LiveJourney');
const User = require('../models/User');
const { AppError, ensure } = require('../lib/errors');
const { getIo } = require('../sockets/socketServer');
const { toIso } = require('../lib/mongoCore');

class JourneyService {
  async startJourney(userId, payload) {
    ensure(payload.durationMinutes && payload.durationMinutes > 0, 'Duration in minutes is required', 400);

    // Cancel any existing active journey for this user
    await LiveJourney.updateMany(
      { userId, status: 'IN_TRANSIT' },
      { $set: { status: 'CANCELLED' } }
    );

    const durationMinutes = Number(payload.durationMinutes) || 20;
    const now = new Date();
    const expectedArrivalAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

    const waypoints = [];
    if (payload.startLat != null && payload.startLng != null) {
      waypoints.push({
        lat: Number(payload.startLat),
        lng: Number(payload.startLng),
        timestamp: now,
      });
    }

    const journey = await LiveJourney.create({
      userId,
      destinationLabel: payload.destinationLabel || 'Điểm đến an toàn',
      destinationLat: payload.destinationLat != null ? Number(payload.destinationLat) : null,
      destinationLng: payload.destinationLng != null ? Number(payload.destinationLng) : null,
      durationMinutes,
      startedAt: now,
      expectedArrivalAt,
      status: 'IN_TRANSIT',
      currentLat: payload.startLat != null ? Number(payload.startLat) : null,
      currentLng: payload.startLng != null ? Number(payload.startLng) : null,
      batteryLevel: payload.batteryLevel != null ? Number(payload.batteryLevel) : null,
      waypoints,
    });

    const io = getIo();
    if (io) {
      io.emit('journey:started', {
        journeyId: journey._id,
        userId,
        destinationLabel: journey.destinationLabel,
        shareToken: journey.shareToken,
        expectedArrivalAt: toIso(journey.expectedArrivalAt),
      });
    }

    return this._formatJourney(journey);
  }

  async getActiveJourney(userId) {
    const journey = await LiveJourney.findOne({
      userId,
      status: 'IN_TRANSIT',
    }).sort({ startedAt: -1 });

    if (!journey) {
      return null;
    }
    return this._formatJourney(journey);
  }

  async pingJourney(journeyId, userId, payload) {
    const journey = await LiveJourney.findOne({ _id: journeyId, userId });
    ensure(journey, 'Journey not found or unauthorized', 404);

    if (journey.status !== 'IN_TRANSIT') {
      return this._formatJourney(journey);
    }

    const now = new Date();
    if (payload.lat != null && payload.lng != null) {
      const lat = Number(payload.lat);
      const lng = Number(payload.lng);
      journey.currentLat = lat;
      journey.currentLng = lng;
      journey.waypoints.push({ lat, lng, timestamp: now });
      // Keep at most 200 recent waypoints
      if (journey.waypoints.length > 200) {
        journey.waypoints.shift();
      }
    }

    journey.lastPingAt = now;
    if (payload.batteryLevel != null) {
      journey.batteryLevel = Number(payload.batteryLevel);
    }

    // Check if overdue
    if (now > journey.expectedArrivalAt && journey.status === 'IN_TRANSIT') {
      journey.status = 'OVERDUE_ALARM';
      const io = getIo();
      if (io) {
        io.emit('journey:overdue', {
          journeyId: journey._id,
          userId,
          shareToken: journey.shareToken,
          message: 'Hành trình đã quá hạn dự kiến mà chưa xác nhận đến nơi an toàn!',
        });
      }
    }

    await journey.save();

    const io = getIo();
    if (io) {
      io.to(`journey_${journey.shareToken}`).emit('journey:update', {
        lat: journey.currentLat,
        lng: journey.currentLng,
        batteryLevel: journey.batteryLevel,
        status: journey.status,
        timestamp: toIso(now),
      });
    }

    return this._formatJourney(journey);
  }

  async finishJourney(journeyId, userId) {
    const journey = await LiveJourney.findOne({ _id: journeyId, userId });
    ensure(journey, 'Journey not found or unauthorized', 404);

    journey.status = 'ARRIVED_SAFE';
    await journey.save();

    const io = getIo();
    if (io) {
      io.to(`journey_${journey.shareToken}`).emit('journey:arrived', {
        journeyId: journey._id,
        status: 'ARRIVED_SAFE',
      });
    }

    return this._formatJourney(journey);
  }

  async extendJourney(journeyId, userId, extraMinutes = 10) {
    const journey = await LiveJourney.findOne({ _id: journeyId, userId });
    ensure(journey, 'Journey not found or unauthorized', 404);

    const extension = (Number(extraMinutes) || 10) * 60 * 1000;
    const baseTime = journey.expectedArrivalAt.getTime() > Date.now()
      ? journey.expectedArrivalAt.getTime()
      : Date.now();
    journey.expectedArrivalAt = new Date(baseTime + extension);
    if (journey.status === 'OVERDUE_ALARM') {
      journey.status = 'IN_TRANSIT';
    }
    await journey.save();

    const io = getIo();
    if (io) {
      io.to(`journey_${journey.shareToken}`).emit('journey:extended', {
        journeyId: journey._id,
        expectedArrivalAt: toIso(journey.expectedArrivalAt),
      });
    }

    return this._formatJourney(journey);
  }

  async cancelJourney(journeyId, userId) {
    const journey = await LiveJourney.findOne({ _id: journeyId, userId });
    ensure(journey, 'Journey not found or unauthorized', 404);

    journey.status = 'CANCELLED';
    await journey.save();
    return this._formatJourney(journey);
  }

  async getPublicTracking(shareToken) {
    const journey = await LiveJourney.findOne({ shareToken });
    ensure(journey, 'Hành trình không tồn tại hoặc đã hết hiệu lực', 404);

    const user = await User.findById(journey.userId);
    const firstName = user ? (user.name || user.fullName || 'Người dùng SafeSolo').split(' ').pop() : 'Bạn bè';

    const now = Date.now();
    const remainingSeconds = Math.max(0, Math.round((journey.expectedArrivalAt.getTime() - now) / 1000));

    return {
      journeyId: journey._id,
      shareToken: journey.shareToken,
      userName: firstName,
      destinationLabel: journey.destinationLabel,
      destinationLat: journey.destinationLat,
      destinationLng: journey.destinationLng,
      startedAt: toIso(journey.startedAt),
      expectedArrivalAt: toIso(journey.expectedArrivalAt),
      durationMinutes: journey.durationMinutes,
      status: journey.status,
      remainingSeconds,
      currentLat: journey.currentLat,
      currentLng: journey.currentLng,
      batteryLevel: journey.batteryLevel,
      lastPingAt: toIso(journey.lastPingAt),
      waypoints: (journey.waypoints || []).map((wp) => ({
        lat: wp.lat,
        lng: wp.lng,
        timestamp: toIso(wp.timestamp),
      })),
    };
  }

  _formatJourney(journey) {
    const now = Date.now();
    const remainingSeconds = Math.max(0, Math.round((journey.expectedArrivalAt.getTime() - now) / 1000));
    return {
      id: journey._id,
      userId: journey.userId,
      destinationLabel: journey.destinationLabel,
      destinationLat: journey.destinationLat,
      destinationLng: journey.destinationLng,
      durationMinutes: journey.durationMinutes,
      startedAt: toIso(journey.startedAt),
      expectedArrivalAt: toIso(journey.expectedArrivalAt),
      status: journey.status,
      shareToken: journey.shareToken,
      currentLat: journey.currentLat,
      currentLng: journey.currentLng,
      batteryLevel: journey.batteryLevel,
      lastPingAt: toIso(journey.lastPingAt),
      remainingSeconds,
      waypoints: (journey.waypoints || []).map((wp) => ({
        lat: wp.lat,
        lng: wp.lng,
        timestamp: toIso(wp.timestamp),
      })),
    };
  }
}

module.exports = new JourneyService();
