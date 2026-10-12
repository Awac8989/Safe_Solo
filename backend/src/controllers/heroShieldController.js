const heroShieldService = require('../services/heroShieldService');

class HeroShieldController {
  async getHeroesList(_req, res, next) {
    try {
      const heroes = await heroShieldService.getHeroCandidatesList();
      res.json({ success: true, count: heroes.length, data: heroes });
    } catch (err) {
      next(err);
    }
  }

  async getPolicies(req, res, next) {
    try {
      const { heroId } = req.params;
      const policies = await heroShieldService.getPoliciesByHero(heroId);
      res.json({ success: true, count: policies.length, data: policies });
    } catch (err) {
      next(err);
    }
  }

  async getVouchers(req, res, next) {
    try {
      const { heroId } = req.params;
      const vouchers = await heroShieldService.getVouchersByHero(heroId);
      res.json({ success: true, count: vouchers.length, data: vouchers });
    } catch (err) {
      next(err);
    }
  }

  async getClaims(req, res, next) {
    try {
      const heroId = req.params.heroId || req.query.heroId || 'ALL';
      const claims = await heroShieldService.getClaims(heroId);
      res.json({ success: true, count: claims.length, data: claims });
    } catch (err) {
      next(err);
    }
  }

  async issueRestockVoucher(req, res, next) {
    try {
      const { heroId, incidentId, sbarHandoffId, consumedSuppliesNote } = req.body;
      const voucher = await heroShieldService.issueRestockVoucherFromSbar({
        heroId,
        incidentId,
        sbarHandoffId,
        consumedSuppliesNote,
      });
      res.status(201).json({
        success: true,
        message: 'Đã cấp Voucher bồi hoàn vật tư y tế thành công!',
        data: voucher,
      });
    } catch (err) {
      next(err);
    }
  }

  async redeemVoucher(req, res, next) {
    try {
      const { code } = req.params;
      const result = await heroShieldService.redeemRestockVoucher(code);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async completeMission(req, res, next) {
    try {
      const result = await heroShieldService.completeMissionFromApp(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async issuePolicy(req, res, next) {
    try {
      const { incidentId, volunteerId } = req.body;
      const policy = await heroShieldService.issuePolicyOnDispatch(incidentId, volunteerId);
      res.status(201).json({ success: true, data: policy });
    } catch (err) {
      next(err);
    }
  }

  async fileClaim(req, res, next) {
    try {
      const { id } = req.params;
      const policy = await heroShieldService.fileInsuranceClaim(id, req.body);
      res.json({ success: true, message: 'Đã nộp hồ sơ yêu cầu bồi thường bảo hiểm thành công!', data: policy });
    } catch (err) {
      next(err);
    }
  }

  async settleClaim(req, res, next) {
    try {
      const { id } = req.params;
      const { payoutAmountVND } = req.body;
      const policy = await heroShieldService.settleInsuranceClaim(id, payoutAmountVND);
      res.json({
        success: true,
        message: `Đã thẩm định và chi trả bồi thường ${Number(payoutAmountVND || 1500000).toLocaleString('vi-VN')}đ vào ví Hiệp Sĩ thành công!`,
        data: policy,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new HeroShieldController();
