const express = require('express');
const router = express.Router();
const floodRescueController = require('../controllers/floodRescueController');

router.post('/seed', (req, res, next) => floodRescueController.seedSensors(req, res, next));
router.get('/zones', (req, res, next) => floodRescueController.seedSensors(req, res, next));
router.patch('/zones/:zoneCode/depth', (req, res, next) => floodRescueController.updateDepth(req, res, next));
router.post('/route/safe-plan', (req, res, next) => floodRescueController.calculateRoute(req, res, next));
router.post('/sos', (req, res, next) => floodRescueController.triggerSos(req, res, next));

module.exports = router;

