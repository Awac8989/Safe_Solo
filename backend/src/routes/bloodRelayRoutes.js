const express = require('express');
const router = express.Router();
const bloodRelayController = require('../controllers/bloodRelayController');

router.post('/', (req, res, next) => bloodRelayController.createRequest(req, res, next));
router.get('/:id/donors', (req, res, next) => bloodRelayController.searchDonors(req, res, next));
router.post('/:id/accept', (req, res, next) => bloodRelayController.accept(req, res, next));
router.post('/:id/fulfill', (req, res, next) => bloodRelayController.fulfill(req, res, next));

module.exports = router;
