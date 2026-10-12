const express = require('express');
const router = express.Router();
const safePointController = require('../controllers/safePointController');

router.get('/nearby', (req, res, next) => safePointController.getNearby(req, res, next));
router.get('/optimal-aed', (req, res, next) => safePointController.getOptimalWaypoint(req, res, next));
router.get('/waypoint-aed', (req, res, next) => safePointController.getOptimalWaypoint(req, res, next));

router.post('/:id/unlock-request', (req, res, next) => safePointController.unlockCabinet(req, res, next));
router.post('/:id/unlock', (req, res, next) => safePointController.unlockCabinet(req, res, next));

router.post('/:id/unlock-confirm', (req, res, next) => safePointController.confirmUnlock(req, res, next));
router.post('/:id/confirm', (req, res, next) => safePointController.confirmUnlock(req, res, next));

module.exports = router;
