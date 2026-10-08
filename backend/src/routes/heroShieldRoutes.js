const express = require('express');
const router = express.Router();
const heroShieldController = require('../controllers/heroShieldController');

router.post('/policies', (req, res, next) => heroShieldController.issuePolicy(req, res, next));
router.post('/restock', (req, res, next) => heroShieldController.issueRestock(req, res, next));
router.post('/policies/:id/claim', (req, res, next) => heroShieldController.fileClaim(req, res, next));
router.post('/policies/:id/settle', (req, res, next) => heroShieldController.settleClaim(req, res, next));

module.exports = router;
