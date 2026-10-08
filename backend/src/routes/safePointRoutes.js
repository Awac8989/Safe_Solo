const express = require('express');
const router = express.Router();
const safePointController = require('../controllers/safePointController');

router.post('/', (req, res, next) => safePointController.register(req, res, next));
router.get('/nearby', (req, res, next) => safePointController.getNearby(req, res, next));
router.get('/waypoint-aed', (req, res, next) => safePointController.getOptimalWaypoint(req, res, next));
router.post('/:id/unlock', (req, res, next) => safePointController.unlockCabinet(req, res, next));
router.post('/:id/inspect', (req, res, next) => safePointController.inspect(req, res, next));

module.exports = router;
