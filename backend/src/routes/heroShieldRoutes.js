const express = require('express');
const router = express.Router();
const heroShieldController = require('../controllers/heroShieldController');

// Web Admin & Mobile App APIs
router.get('/heroes-list', (req, res, next) => heroShieldController.getHeroesList(req, res, next));
router.get('/policies/:heroId', (req, res, next) => heroShieldController.getPolicies(req, res, next));
router.get('/vouchers/:heroId', (req, res, next) => heroShieldController.getVouchers(req, res, next));
router.post('/vouchers/:code/redeem', (req, res, next) => heroShieldController.redeemVoucher(req, res, next));
router.post('/restock-voucher', (req, res, next) => heroShieldController.issueRestockVoucher(req, res, next));
router.post('/complete-mission', (req, res, next) => heroShieldController.completeMission(req, res, next));

// Micro-Insurance Claims & Good Samaritan Fund
router.get('/claims', (req, res, next) => heroShieldController.getClaims(req, res, next));
router.get('/claims/:heroId', (req, res, next) => heroShieldController.getClaims(req, res, next));
router.post('/policies', (req, res, next) => heroShieldController.issuePolicy(req, res, next));
router.post('/policies/:id/claim', (req, res, next) => heroShieldController.fileClaim(req, res, next));
router.post('/policies/:id/settle', (req, res, next) => heroShieldController.settleClaim(req, res, next));
router.post('/claims/:id/settle', (req, res, next) => heroShieldController.settleClaim(req, res, next));

module.exports = router;
