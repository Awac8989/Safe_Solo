const express = require('express');
const router = express.Router();
const mciTriageController = require('../controllers/mciTriageController');

router.post('/declare', (req, res, next) => mciTriageController.declareMci(req, res, next));
router.post('/:id/triage', (req, res, next) => mciTriageController.performTriage(req, res, next));
router.post('/:id/balance-evacuation', (req, res, next) => mciTriageController.autoBalance(req, res, next));

module.exports = router;

