const express = require('express');
const feedController = require('../controllers/feedController');
const { validate, feedSchemas } = require('../middleware/validation');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.post('/status', validate(feedSchemas.createStatus), feedController.createStatus);
router.get('/circle', feedController.getCircleFeed);

module.exports = router;