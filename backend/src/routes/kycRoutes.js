const express = require('express');
const kycController = require('../controllers/kycController');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/upload', auth, (req, res, next) => kycController.uploadKycDocuments(req, res, next));
router.post('/exam/submit', auth, (req, res, next) => kycController.submitClinicalExam(req, res, next));
router.get('/status', auth, (req, res, next) => kycController.getKycStatus(req, res, next));

module.exports = router;
