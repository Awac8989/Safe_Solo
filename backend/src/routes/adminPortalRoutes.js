const express = require('express');

const controller = require('../controllers/adminPortalController');

const router = express.Router();

router.get('/overview', controller.getOverview);
router.get('/users', controller.listUsers);
router.get('/incidents', controller.listIncidents);
router.patch('/incidents/:id/resolve', controller.resolveIncident);
router.get('/incidents/:id/sms-logs', controller.listSmsLogs);
router.get('/audit', controller.listAuditLogs);
router.get('/kyc', controller.listKycQueue);
router.patch('/kyc/:id', controller.updateKycStatus);
router.get('/channels', controller.getChannelHealth);
router.get('/revenue', controller.getRevenueSummary);

module.exports = router;
