const floodRescueService = require('../services/floodRescueService');

class FloodRescueController {
  async seedSensors(req, res, next) {
    try {
      const zones = await floodRescueService.seedUrbanFloodSensors();
      res.json({ success: true, count: zones.length, data: zones });
    } catch (err) {
      next(err);
    }
  }

  async updateDepth(req, res, next) {
    try {
      const { zoneCode } = req.params;
      const zone = await floodRescueService.updateFloodSensorDepth(zoneCode, req.body);
      res.json({ success: true, data: zone });
    } catch (err) {
      next(err);
    }
  }

  async calculateRoute(req, res, next) {
    try {
      const result = await floodRescueService.calculateFloodSafeRoute(req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async triggerSos(req, res, next) {
    try {
      const { userId } = req.body;
      const result = await floodRescueService.triggerLoneDwellerFloodSOS(userId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new FloodRescueController();

