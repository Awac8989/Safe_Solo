const mciTriageService = require('../services/mciTriageService');

class MciTriageController {
  async declareMci(req, res, next) {
    try {
      const mci = await mciTriageService.declareMassCasualtyIncident(req.body);
      res.status(201).json({ success: true, data: mci });
    } catch (err) {
      next(err);
    }
  }

  async performTriage(req, res, next) {
    try {
      const { id } = req.params;
      const { triageOfficerId, assessmentData } = req.body;
      const result = await mciTriageService.performStartTriage(id, triageOfficerId, assessmentData || req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async autoBalance(req, res, next) {
    try {
      const { id } = req.params;
      const result = await mciTriageService.autoBalanceHospitalEvacuation(id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new MciTriageController();

