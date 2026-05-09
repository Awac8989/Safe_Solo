const express = require('express');
const emergencyController = require('../controllers/emergencyController');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

router.post('/silent-sos', emergencyController.silentSos);

module.exports = router;
