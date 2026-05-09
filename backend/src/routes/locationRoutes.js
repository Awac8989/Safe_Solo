const express = require('express');
const locationController = require('../controllers/locationController');
const { validate, locationSchemas } = require('../middleware/validation');
const auth = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(auth);

router.get('/', locationController.getLocation);
router.post('/ping', validate(locationSchemas.ping), locationController.pingLocation);

module.exports = router;