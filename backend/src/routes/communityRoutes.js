const express = require('express');
const communityController = require('../controllers/communityController');
const { validate, communitySchemas } = require('../middleware/validation');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/heroes/:id', communityController.getHeroProfile);
router.post('/heroes/:id/thank-you', validate(communitySchemas.thankYou), communityController.postThankYou);

module.exports = router;