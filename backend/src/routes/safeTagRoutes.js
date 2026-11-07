const express = require('express');
const router = express.Router();
const safeTagController = require('../controllers/safeTagController');

router.post('/issue', (req, res, next) => safeTagController.issueTag(req, res, next));
router.get('/public/:code', (req, res, next) => safeTagController.resolvePublic(req, res, next));
router.post('/medical/:code', (req, res, next) => safeTagController.resolveMedical(req, res, next));
router.post('/request-otp/:code', (req, res, next) => safeTagController.requestOtp(req, res, next));
router.post('/verify-otp/:code', (req, res, next) => safeTagController.verifyOtp(req, res, next));
router.post('/emergency-bypass/:code', (req, res, next) => safeTagController.emergencyBypass(req, res, next));
router.post('/report-lost/:code', (req, res, next) => safeTagController.reportLost(req, res, next));
router.post('/reactivate/:code', (req, res, next) => safeTagController.reactivate(req, res, next));
router.get('/offline-card/:code', (req, res, next) => safeTagController.getOfflineCard(req, res, next));

module.exports = router;
