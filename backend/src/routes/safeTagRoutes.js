const express = require('express');
const router = express.Router();
const safeTagController = require('../controllers/safeTagController');

router.post('/issue', (req, res, next) => safeTagController.issueTag(req, res, next));
router.get('/public/:code', (req, res, next) => safeTagController.resolvePublic(req, res, next));
router.post('/medical/:code', (req, res, next) => safeTagController.resolveMedical(req, res, next));

module.exports = router;
