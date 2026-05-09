const express = require('express');
const kycController = require('../controllers/kycController');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.post('/upload', kycController.uploadKycDocuments);

module.exports = router;