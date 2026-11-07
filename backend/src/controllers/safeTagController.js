const safeTagService = require('../services/safeTagService');

class SafeTagController {
  async issueTag(req, res, next) {
    try {
      const { userId, tagType, customCode } = req.body;
      const tag = await safeTagService.issueSafeTag(userId, tagType, customCode);
      const nfcUrl = safeTagService.generateNfcCompactPayload(tag);
      res.status(201).json({ success: true, data: tag, nfcUrl });
    } catch (err) {
      next(err);
    }
  }

  async resolvePublic(req, res, next) {
    try {
      const { code } = req.params;
      const scanMetadata = {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        location: req.body.location || null,
      };
      const result = await safeTagService.resolvePublicICEData(code, scanMetadata);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async resolveMedical(req, res, next) {
    try {
      const { code } = req.params;
      const { doctorOrHeroUserId, incidentId } = req.body;
      const result = await safeTagService.resolveMedicalTier2Data(code, doctorOrHeroUserId, incidentId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async requestOtp(req, res, next) {
    try {
      const { code } = req.params;
      const result = await safeTagService.requestTier2Otp(code);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async verifyOtp(req, res, next) {
    try {
      const { code } = req.params;
      const { otp } = req.body;
      const metadata = { ip: req.ip, userAgent: req.get('user-agent') };
      const result = await safeTagService.verifyTier2Otp(code, otp, metadata);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async emergencyBypass(req, res, next) {
    try {
      const { code } = req.params;
      const { paramedicId, paramedicLicense, emergencyIncidentId, clinicalJustification } = req.body;
      const metadata = { ip: req.ip, userAgent: req.get('user-agent') };
      const result = await safeTagService.emergencyBypassTier2(code, {
        paramedicId,
        paramedicLicense,
        emergencyIncidentId,
        clinicalJustification,
        clientMetadata: metadata,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async reportLost(req, res, next) {
    try {
      const { code } = req.params;
      const { userId } = req.body;
      const result = await safeTagService.reportLostTag(code, userId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async reactivate(req, res, next) {
    try {
      const { code } = req.params;
      const { userId } = req.body;
      const result = await safeTagService.reactivateTag(code, userId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getOfflineCard(req, res, next) {
    try {
      const { code } = req.params;
      const result = await safeTagService.generateOfflineHtmlCard(code);
      res.type('html').send(result.htmlContent);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new SafeTagController();
