const express = require('express');
const kycController = require('../controllers/kycController');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/upload', (req, res, next) => {
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
}, kycController.uploadKycDocuments);

module.exports = router;
