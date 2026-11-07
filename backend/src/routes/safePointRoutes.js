const express = require('express');
const router = express.Router();
const safePointController = require('../controllers/safePointController');

router.get('/nearby', (req, res, next) => safePointController.getNearby(req, res, next));
router.get('/optimal-aed', (req, res, next) => safePointController.getOptimalWaypoint(req, res, next));
router.get('/waypoint-aed', (req, res, next) => safePointController.getOptimalWaypoint(req, res, next));

router.all('/oxygen/locate', (req, res, next) => safePointController.locateOxygen(req, res, next));
router.all('/epipen/locate', (req, res, next) => safePointController.locateEpiPen(req, res, next));
router.all('/heatstroke/locate', (req, res, next) => safePointController.locateHeatstroke(req, res, next));

router.post('/:id/unlock-request', (req, res, next) => safePointController.unlockCabinet(req, res, next));
router.post('/:id/unlock', (req, res, next) => safePointController.unlockCabinet(req, res, next));

router.post('/:id/unlock-confirm', (req, res, next) => safePointController.confirmUnlock(req, res, next));
router.post('/:id/confirm', (req, res, next) => safePointController.confirmUnlock(req, res, next));

router.get('/fleet-health', (req, res, next) => safePointController.getFleetHealth(req, res, next));
router.post('/:id/telemetry', (req, res, next) => safePointController.reportTelemetry(req, res, next));
router.post('/:id/tamper-resolve', (req, res, next) => safePointController.resolveTamper(req, res, next));

module.exports = router;
