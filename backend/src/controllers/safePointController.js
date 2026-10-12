const safePointService = require('../services/safePointService');

class SafePointController {
  async getNearby(req, res, next) {
    try {
      const lat = req.query.lat || req.query.latitude || 10.7769;
      const lng = req.query.lng || req.query.longitude || 106.7009;
      const radius = req.query.radius || req.query.radiusMeters || 50000;
      const assetType = req.query.assetType || req.query.type || null;

      const assets = await safePointService.findNearbySafePoints(lat, lng, radius, assetType);
      res.json({ success: true, count: assets.length, data: assets });
    } catch (err) {
      next(err);
    }
  }

  async getOptimalWaypoint(req, res, next) {
    try {
      const { heroLat, heroLng, victimLat, victimLng, maxDetour } = req.query;
      if (!heroLat || !heroLng || !victimLat || !victimLng) {
        return res.status(400).json({ success: false, message: 'Thiếu tọa độ của Hiệp sĩ và Nạn nhân' });
      }
      const waypoint = await safePointService.findOptimalAEDWaypoint(
        Number(heroLat),
        Number(heroLng),
        Number(victimLat),
        Number(victimLng),
        maxDetour ? Number(maxDetour) : 600
      );
      res.json({ success: true, data: waypoint });
    } catch (err) {
      next(err);
    }
  }

  async unlockCabinet(req, res, next) {
    try {
      const { id } = req.params;
      const rescuerId = req.body.rescuerId || req.body.userId || 'DISPATCHER_DESK';
      const incidentId = req.body.incidentId;
      const purpose = req.body.purpose;

      const result = await safePointService.unlockSafePointCabinet(id, rescuerId, incidentId, purpose);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async confirmUnlock(req, res, next) {
    try {
      const { id } = req.params;
      const rescuerId = req.body.rescuerId || 'DISPATCHER_DESK';
      const otpEntered = req.body.otpEntered || req.body.otp || '';

      const result = await safePointService.confirmSafePointCabinet(id, rescuerId, otpEntered);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new SafePointController();
