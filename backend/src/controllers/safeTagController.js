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
}

module.exports = new SafeTagController();
