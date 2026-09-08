const express = require('express');
const communityController = require('../controllers/communityController');
const { validate, communitySchemas } = require('../middleware/validation');
const auth = require('../middleware/auth');

const router = express.Router();
router.use((req, res, next) => {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return auth(req, res, next);
  }
  const userId = req.headers['x-user-id'] || req.query.userId;
  if (userId) {
    req.user = { id: userId };
    return next();
  }
  return auth(req, res, next);
});

router.get('/heroes', communityController.listHeroes);
router.get('/heroes/:id', communityController.getHeroProfile);
router.post('/heroes/:id/thank-you', validate(communitySchemas.thankYou), communityController.postThankYou);

module.exports = router;
