const bloodRelayService = require('../services/bloodRelayService');

class BloodRelayController {
  async createRequest(req, res, next) {
    try {
      const request = await bloodRelayService.createEmergencyBloodRequest(req.body);
      res.status(201).json({ success: true, data: request });
    } catch (err) {
      next(err);
    }
  }

  async searchDonors(req, res, next) {
    try {
      const { id } = req.params;
      const { hospitalLat, hospitalLng, maxDistance } = req.query;
      const donors = await bloodRelayService.findMatchingDonors(
        id,
        Number(hospitalLat || 10.7626),
        Number(hospitalLng || 106.6822),
        maxDistance ? Number(maxDistance) : 15000
      );
      res.json({ success: true, data: donors, count: donors.length });
    } catch (err) {
      next(err);
    }
  }

  async accept(req, res, next) {
    try {
      const { id } = req.params;
      const { donorUserId, donorBloodType, distanceMeters } = req.body;
      const result = await bloodRelayService.acceptBloodDonation(id, donorUserId, donorBloodType, distanceMeters);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async fulfill(req, res, next) {
    try {
      const { id } = req.params;
      const { donorUserId, unitsDonated } = req.body;
      const result = await bloodRelayService.confirmDonationFulfilled(id, donorUserId, unitsDonated);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BloodRelayController();
