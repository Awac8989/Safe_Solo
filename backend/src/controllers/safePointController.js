const safePointService = require('../services/safePointService');

class SafePointController {
  async register(req, res, next) {
    try {
      const asset = await safePointService.registerSafePoint(req.body);
      res.status(201).json({ success: true, data: asset });
    } catch (err) {
      next(err);
    }
  }

  async getNearby(req, res, next) {
    try {
      const { lat, lng, radius = 1000, assetType } = req.query;
      if (!lat || !lng) {
        return res.status(400).json({ success: false, message: 'Thiếu tham số tọa độ lat, lng' });
      }
      const assets = await safePointService.findNearbySafePoints(lat, lng, radius, assetType);
      res.json({ success: true, data: assets, count: assets.length });
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
      const { userId, incidentId } = req.body;
      const result = await safePointService.unlockSafePointCabinet(id, userId, incidentId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async inspect(req, res, next) {
    try {
      const { id } = req.params;
      const { inspectorUserId, inspectionData } = req.body;
      const updated = await safePointService.inspectSafePoint(id, inspectorUserId, inspectionData);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new SafePointController();
