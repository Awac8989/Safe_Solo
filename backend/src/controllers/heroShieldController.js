const heroShieldService = require('../services/heroShieldService');

class HeroShieldController {
  async issuePolicy(req, res, next) {
    try {
      const { incidentId, volunteerId } = req.body;
      const policy = await heroShieldService.issuePolicyOnDispatch(incidentId, volunteerId);
      res.status(201).json({ success: true, data: policy });
    } catch (err) {
      next(err);
    }
  }

  async issueRestock(req, res, next) {
    try {
      const { incidentId, volunteerId, firstAidActions } = req.body;
      const result = await heroShieldService.issueConsumableRestockVoucher(incidentId, volunteerId, firstAidActions);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async fileClaim(req, res, next) {
    try {
      const { id } = req.params;
      const policy = await heroShieldService.fileInsuranceClaim(id, req.body);
      res.json({ success: true, data: policy });
    } catch (err) {
      next(err);
    }
  }

  async settleClaim(req, res, next) {
    try {
      const { id } = req.params;
      const { payoutAmountVND } = req.body;
      const policy = await heroShieldService.settleInsuranceClaim(id, payoutAmountVND);
      res.json({ success: true, data: policy });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new HeroShieldController();
