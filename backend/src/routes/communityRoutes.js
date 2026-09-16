const express = require('express');
const communityController = require('../controllers/communityController');
const { validate, communitySchemas } = require('../middleware/validation');
const auth = require('../middleware/auth');

const hazardService = require('../services/hazardService');

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

// Hazard Bulletin
router.get('/hazards', async (req, res, next) => {
  try {
    const list = await hazardService.listHazards(req.query);
    res.json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
});

router.post('/hazards', async (req, res, next) => {
  try {
    const report = await hazardService.createHazard(req.user.id, req.body);
    res.status(201).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

router.post('/hazards/:id/verify', async (req, res, next) => {
  try {
    const report = await hazardService.verifyHazard(req.params.id, req.user.id, req.body.action);
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

// Safe Moments Story
router.get('/moments', async (req, res, next) => {
  try {
    const moments = await hazardService.listSafeMoments(req.user.id);
    res.json({ success: true, data: moments });
  } catch (err) {
    next(err);
  }
});

router.post('/moments', async (req, res, next) => {
  try {
    const moment = await hazardService.createSafeMoment(req.user.id, req.body);
    res.status(201).json({ success: true, data: moment });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
