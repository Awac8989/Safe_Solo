const express = require('express');
const emergencyController = require('../controllers/emergencyController');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

router.post('/silent-sos', emergencyController.silentSos);
router.post('/evidence/upload', emergencyController.uploadEvidence);

module.exports = router;
