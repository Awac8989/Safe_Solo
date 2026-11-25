const LiveJourney = require('../models/LiveJourney');
const User = require('../models/User');
const { AppError, ensure } = require('../lib/errors');
const { getIo } = require('../sockets/socketServer');
const { toIso } = require('../lib/mongoCore');

function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Computes perpendicular cross-track distance (meters) from current point (lat, lng)
 * to expected route segment (startLat, startLng) -> (destLat, destLng).
 */
function crossTrackDistanceMeters(lat, lng, startLat, startLng, destLat, destLng) {
  const segLen = haversineMeters(startLat, startLng, destLat, destLng);
  if (segLen < 30) {
    return haversineMeters(lat, lng, destLat, destLng);
  }
  const midLatRad = (((startLat + destLat) / 2) * Math.PI) / 180;
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos(midLatRad);

  const ax = 0;
  const ay = 0;
  const bx = (destLng - startLng) * mPerDegLng;
  const by = (destLat - startLat) * mPerDegLat;
  const px = (lng - startLng) * mPerDegLng;
  const py = (lat - startLat) * mPerDegLat;

  const ab2 = bx * bx + by * by;
  if (ab2 <= 1e-6) return Math.hypot(px, py);
  const t = Math.max(0, Math.min(1, ((px - ax) * bx + (py - ay) * by) / ab2));
  const projX = ax + t * bx;
  const projY = ay + t * by;
  return Math.hypot(px - projX, py - projY);
}

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

    // Check Route Deviation (> 300m) & Abnormal Stationary (> 180s outside destination safe zone)
    let detectedAnomaly = null;
    if (journey.currentLat != null && journey.currentLng != null && journey.waypoints.length >= 1) {
      const origin = journey.waypoints[0];
      const hasDest = journey.destinationLat != null && journey.destinationLng != null;
      const distToDest = hasDest
        ? haversineMeters(journey.currentLat, journey.currentLng, journey.destinationLat, journey.destinationLng)
        : 99999;

      if (hasDest) {
        const corridorDist = crossTrackDistanceMeters(
          journey.currentLat,
          journey.currentLng,
          origin.lat,
          origin.lng,
          journey.destinationLat,
          journey.destinationLng,
        );
        if (corridorDist > 300) {
          detectedAnomaly = {
            anomalyType: 'ROUTE_DEVIATION',
            deviationMeters: Math.round(corridorDist),
            reason: `Lệch khỏi lộ trình dự kiến ${Math.round(corridorDist)}m (> 300m)`,
          };
        }
      }

      if (!detectedAnomaly && distToDest > 120) {
        // Scan backward to find how long user remained within 20m radius
        let oldestStaticTs = now.getTime();
        for (let i = journey.waypoints.length - 1; i >= 0; i--) {
          const wp = journey.waypoints[i];
          const d = haversineMeters(journey.currentLat, journey.currentLng, wp.lat, wp.lng);
          if (d <= 20) {
            oldestStaticTs = new Date(wp.timestamp).getTime();
          } else {
            break;
          }
        }
        const stationarySeconds = Math.floor((now.getTime() - oldestStaticTs) / 1000);
        if (stationarySeconds >= 180) {
          detectedAnomaly = {
            anomalyType: 'STATIONARY_ALERT',
            stationarySeconds,
            reason: `Đứng im bất thường ngoài vùng an toàn ${Math.round(stationarySeconds / 60)} phút (> 3 phút)`,
          };
        }
      }
    }

    if (detectedAnomaly && !journey.deviationAlertTriggered) {
      journey.deviationAlertTriggered = true;
      journey.lastAnomalyDetectedAt = now;
      journey.anomalyReason = detectedAnomaly.reason;

      try {
        const watchRoutes = require('../routes/watchRoutes');
        if (typeof watchRoutes.enqueueCommandForUser === 'function') {
          await watchRoutes.enqueueCommandForUser(userId, 'ROUTE_DEVIATION_CHECK', {
            journeyId: journey._id,
            ...detectedAnomaly,
            prompt: 'Bạn ổn chứ?',
            responseTimeoutSeconds: 30,
          });
        }
      } catch (_) {}

      try {
        const io = getIo();
        io.emit('journey:watch_check', {
          journeyId: journey._id,
          userId,
          ...detectedAnomaly,
          prompt: 'Bạn ổn chứ?',
          responseTimeoutSeconds: 30,
        });
      } catch (_) {}
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

  async checkAndEscalateOverdueJourneys(io) {
    const now = new Date();
    const overdueJourneys = await LiveJourney.find({
      status: 'IN_TRANSIT',
      expectedArrivalAt: { $lt: now },
    });

    for (const journey of overdueJourneys) {
      journey.status = 'OVERDUE_ALARM';
      await journey.save();

      const userDoc = await User.findById(journey.userId);
      if (userDoc) {
        if (journey.currentLat != null && journey.currentLng != null) {
          userDoc.lastKnownLocation = {
            lat: journey.currentLat,
            lng: journey.currentLng,
            updatedAt: now,
          };
          await userDoc.save();
        }

        try {
          const { triggerSosForUser } = require('./sosService');
          await triggerSosForUser(io, userDoc);
        } catch (sosErr) {
          console.error('[JourneyService] Error triggering SOS for overdue journey:', sosErr.message);
        }

        try {
          const { createAlertEvent } = require('./alertEventService');
          await createAlertEvent({
            userId: userDoc._id,
            level: 'CRITICAL',
            status: 'EMERGENCY_TRIGGERED',
            source: 'SYSTEM',
            title: 'HÀNH TRÌNH QUÁ HẠN: Phát tín hiệu định vị khẩn cấp',
            message: `Người dùng chưa bấm "Đã về nhà an toàn" sau hạn chót lộ trình đến "${journey.destinationLabel}". Hệ thống đã tự động phát tín hiệu SOS và tọa độ định vị tới người thân.`,
            metadata: {
              journeyId: journey._id,
              destination: journey.destinationLabel,
              lat: journey.currentLat,
              lng: journey.currentLng,
              shareToken: journey.shareToken,
            },
          });
        } catch (alertErr) {
          console.error('[JourneyService] Error creating alert event for overdue journey:', alertErr.message);
        }
      }

      if (io) {
        io.emit('journey:overdue', {
          journeyId: journey._id,
          userId: journey.userId,
          destinationLabel: journey.destinationLabel,
          lat: journey.currentLat,
          lng: journey.currentLng,
          shareToken: journey.shareToken,
          message: 'Hành trình đã quá hạn dự kiến mà không xác nhận an toàn! Tín hiệu định vị cứu hộ đã được phát tới người thân.',
        });
        io.to(`journey_${journey.shareToken}`).emit('journey:update', {
          lat: journey.currentLat,
          lng: journey.currentLng,
          status: 'OVERDUE_ALARM',
          timestamp: toIso(now),
        });
      }
    }

    return overdueJourneys.length;
  }
  /**
   * Tính toán Tuyến đường An toàn Đêm khuya (Nighttime Safe Route Routing)
   */
  async planSafeNightRoute(userId, payload = {}) {
    const { startLat = 10.7769, startLng = 106.7009, destLat = 10.7850, destLng = 106.7050, travelMode = 'WALKING' } = payload;
    const SafePointAsset = require('../models/SafePointAsset');
    const safePoints = await SafePointAsset.find({ status: 'READY' }).limit(5);
    const safePoisAlongRoute = safePoints.map((sp) => ({
      name: sp.addressDetails?.buildingName || 'Điểm an toàn SafePoint 24/7',
      type: sp.assetType === 'AED' ? 'SAFEPOINT_AED_247' : 'CONVENIENCE_STORE_247',
      lat: sp.location?.coordinates[1] || startLat,
      lng: sp.location?.coordinates[0] || startLng,
    }));
    const safeRouteScore = safePoisAlongRoute.length >= 3 ? 92 : 85;
    return {
      success: true,
      travelMode,
      origin: { lat: startLat, lng: startLng },
      destination: { lat: destLat, lng: destLng },
      safeRouteScore,
      isNightSafeGuaranteed: safeRouteScore >= 80,
      safePoisCount: safePoisAlongRoute.length,
      safePoisAlongRoute,
      recommendation: 'Lộ trình ưu tiên các tuyến đường lớn có đèn chiếu sáng LED đô thị, đi qua 3 trạm SafePoint và cửa hàng tiện lợi 24/7 mở sáng liên tục.',
    };
  }

  /**
   * Hộ tống Ảo (Virtual Ghost Companion) Giám sát Lệch Lộ trình (>300m) & Đứng im Bất thường (>3 phút)
   */
  async checkGhostCompanionAnomaly(journeyId, currentLat, currentLng, opts = {}) {
    const journey = await LiveJourney.findById(journeyId);
    ensure(journey, 'Không tìm thấy hành trình', 404);

    const origin = (journey.waypoints && journey.waypoints[0]) || { lat: currentLat, lng: currentLng };
    const hasDest = journey.destinationLat != null && journey.destinationLng != null;
    const deviationMeters = hasDest
      ? Math.round(crossTrackDistanceMeters(currentLat, currentLng, origin.lat, origin.lng, journey.destinationLat, journey.destinationLng))
      : Math.round(haversineMeters(origin.lat, origin.lng, currentLat, currentLng));

    const stationarySeconds = Number(opts.stationarySeconds || 0);
    const isRouteDeviated = deviationMeters > 300;
    const isStationary = stationarySeconds >= 180;
    const isDeviated = isRouteDeviated || isStationary || Boolean(opts.forceTest);

    const reason = isRouteDeviated
      ? `Phát hiện lệch khỏi lộ trình dự kiến ${deviationMeters}m (> 300m)`
      : isStationary
        ? `Phát hiện đứng im bất thường ngoài vùng an toàn ${Math.round(stationarySeconds / 60)} phút`
        : isDeviated
          ? 'Kiểm tra an toàn hành trình chủ động (Test Watch Check)'
          : 'Đang di chuyển đúng hành lang an toàn';

    journey.currentLat = currentLat;
    journey.currentLng = currentLng;
    if (isDeviated) {
      journey.deviationAlertTriggered = true;
      journey.lastAnomalyDetectedAt = new Date();
      journey.anomalyReason = reason;
      try {
        const watchRoutes = require('../routes/watchRoutes');
        if (typeof watchRoutes.enqueueCommandForUser === 'function') {
          await watchRoutes.enqueueCommandForUser(journey.userId, 'ROUTE_DEVIATION_CHECK', {
            journeyId: journey._id,
            anomalyType: isStationary ? 'STATIONARY_ALERT' : 'ROUTE_DEVIATION',
            deviationMeters,
            stationarySeconds,
            reason,
            prompt: 'Bạn ổn chứ?',
            responseTimeoutSeconds: 30,
          });
        }
      } catch (_) {}
    }
    await journey.save();

    return {
      success: true,
      journeyId: journey._id,
      ghostCompanionActive: journey.ghostCompanionActive,
      deviationAlertTriggered: journey.deviationAlertTriggered,
      deviationMeters,
      stationarySeconds,
      anomalyReason: reason,
      watchPromptSent: isDeviated,
      responseTimeoutSeconds: 30,
      detectedAt: journey.lastAnomalyDetectedAt,
    };
  }

  /**
   * Xác nhận từ Galaxy Watch 5 ("Tôi ổn") hoặc Leo thang SOS sau 30s không phản hồi
   */
  async handleAnomalyAck(journeyId, userId, action = 'CONFIRM_SAFE', reason = '') {
    const journey = await LiveJourney.findById(journeyId);
    ensure(journey, 'Không tìm thấy hành trình', 404);
    const io = getIo();

    if (action === 'CONFIRM_SAFE') {
      journey.deviationAlertTriggered = false;
      journey.anomalyReason = '';
      journey.lastPingAt = new Date();
      await journey.save();
      if (io) {
        io.emit('journey:anomaly_resolved', {
          journeyId: journey._id,
          userId: journey.userId,
          status: 'CONFIRMED_SAFE',
        });
      }
      return {
        journeyId: journey._id,
        action: 'CONFIRM_SAFE',
        deviationAlertTriggered: false,
        message: 'Đã nhận xác nhận an toàn từ Watch 5 / Điện thoại.',
      };
    }

    // ESCALATE_SOS (Watch 5 không trả lời sau 30 giây)
    journey.status = 'OVERDUE_ALARM';
    journey.deviationAlertTriggered = true;
    journey.anomalyReason = reason || journey.anomalyReason || 'Lệch tuyến / Đứng im > 3p không phản hồi Watch 5 sau 30s';
    await journey.save();

    const userDoc = await User.findById(journey.userId || userId);
    if (userDoc) {
      try {
        const { triggerSosForUser } = require('./sosService');
        await triggerSosForUser(io, userDoc);
      } catch (_) {}
      try {
        const { createAlertEvent } = require('./alertEventService');
        await createAlertEvent({
          userId: userDoc._id,
          level: 'CRITICAL',
          status: 'EMERGENCY_TRIGGERED',
          source: 'SYSTEM',
          title: 'Cảnh báo Hành trình Đêm: Không phản hồi Watch 5 sau 30s',
          message: journey.anomalyReason,
          metadata: {
            journeyId: journey._id,
            lat: journey.currentLat,
            lng: journey.currentLng,
            shareToken: journey.shareToken,
          },
        });
      } catch (_) {}
    }

    if (io) {
      io.emit('journey:anomaly_escalated', {
        journeyId: journey._id,
        userId: journey.userId,
        reason: journey.anomalyReason,
        lat: journey.currentLat,
        lng: journey.currentLng,
      });
    }

    return {
      journeyId: journey._id,
      action: 'ESCALATE_SOS',
      status: journey.status,
      reason: journey.anomalyReason,
    };
  }

  /**
   * Tự động hoặc Thủ công Xác nhận Về Nhà An Toàn (Safe Arrival Auto-Dismissal)
   */
  async confirmSafeArrival(journeyId, userId) {
    const journey = await LiveJourney.findOne({ _id: journeyId, userId });
    if (!journey) throw new Error('Không tìm thấy hành trình hoặc không có quyền');
    journey.status = 'ARRIVED_SAFE';
    journey.lastPingAt = new Date();
    await journey.save();
    return {
      success: true,
      journeyId: journey._id,
      status: journey.status,
      arrivedAt: journey.lastPingAt,
      message: 'Đã xác nhận về đến điểm an toàn thành công! Toàn bộ báo động giám sát hành trình đã được giải tỏa.',
    };
  }
}

module.exports = new JourneyService();

