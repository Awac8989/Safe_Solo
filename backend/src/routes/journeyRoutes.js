const express = require('express');
const journeyService = require('../services/journeyService');
const auth = require('../middleware/auth');

const router = express.Router();

// Public route for browser tracking link (No login required)
router.get('/track/:shareToken', async (req, res, next) => {
  try {
    const data = await journeyService.getPublicTracking(req.params.shareToken);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// Authenticated routes for mobile user
router.use(auth);

router.get('/active', async (req, res, next) => {
  try {
    const data = await journeyService.getActiveJourney(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/start', async (req, res, next) => {
  try {
    const data = await journeyService.startJourney(req.user.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/ping', async (req, res, next) => {
  try {
    const data = await journeyService.pingJourney(req.params.id, req.user.id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/finish', async (req, res, next) => {
  try {
    const data = await journeyService.finishJourney(req.params.id, req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/extend', async (req, res, next) => {
  try {
    const minutes = req.body.minutes || 10;
    const data = await journeyService.extendJourney(req.params.id, req.user.id, minutes);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', async (req, res, next) => {
  try {
    const data = await journeyService.cancelJourney(req.params.id, req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
