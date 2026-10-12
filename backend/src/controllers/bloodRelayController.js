const bloodRelayService = require('../services/bloodRelayService');

class BloodRelayController {
  async getActiveRequests(req, res, next) {
    try {
      const { hospitalLat, hospitalLng } = req.query;
      const data = await bloodRelayService.getActiveRequests(
        hospitalLat ? Number(hospitalLat) : undefined,
        hospitalLng ? Number(hospitalLng) : undefined
      );
      res.json({ success: true, count: data.length, data });
    } catch (err) {
      next(err);
    }
  }

  async createRequest(req, res, next) {
    try {
      const request = await bloodRelayService.createEmergencyBloodRequest(req.body);
      res.status(201).json({ success: true, message: 'Đã phát lệnh điều phối máu thành công', data: request });
    } catch (err) {
      next(err);
    }
  }

  async accept(req, res, next) {
    try {
      const { id } = req.params;
      const { donorId, donorUserId, etaMinutes } = req.body;
      const targetDonorId = donorId || donorUserId;
      const result = await bloodRelayService.acceptBloodDonation(id, targetDonorId, etaMinutes);
      res.json({ success: true, message: 'Đã xác nhận tình nguyện viên hiến máu', data: result });
    } catch (err) {
      next(err);
    }
  }

  async fulfill(req, res, next) {
    try {
      const { id } = req.params;
      const { donorId, donorUserId, hospitalStaffNote } = req.body;
      const targetDonorId = donorId || donorUserId;
      const result = await bloodRelayService.confirmDonationFulfilled(id, targetDonorId, hospitalStaffNote);
      res.json({ success: true, message: 'Đã hoàn tất ca tiếp nhận máu thành công', data: result });
    } catch (err) {
      next(err);
    }
  }

  async getMatchingDonors(req, res, next) {
    try {
      const { id } = req.params;
      const { lat, lng, radius } = req.query;
      const data = await bloodRelayService.findMatchingDonors(
        id,
        lat ? Number(lat) : undefined,
        lng ? Number(lng) : undefined,
        radius ? Number(radius) : undefined
      );
      res.json({ success: true, count: data.length, data });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BloodRelayController();
