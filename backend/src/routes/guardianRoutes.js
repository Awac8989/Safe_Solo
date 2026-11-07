const express = require('express');
const guardianController = require('../controllers/guardianController');
const { validate, guardianSchemas } = require('../middleware/validation');
const auth = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Omnichannel alert engine routes
router.get('/omnichannel/status', guardianController.getOmnichannelStatus);
router.post('/alert/broadcast', guardianController.broadcastOmnichannelAlert);

// Guardian network routes
router.get('/', guardianController.getUserGuardians);
router.get('/search', guardianController.searchUsers);
router.get('/requests', guardianController.getPendingRequests);

// Relationship management
router.post('/request', validate(guardianSchemas.sendRequest), guardianController.sendGuardianRequest);
router.put('/respond', validate(guardianSchemas.respondToRequest), guardianController.respondToRequest);
router.delete('/:relationshipId', guardianController.removeRelationship);
router.put('/:relationshipId/block', guardianController.blockUser);

// Senior Solo Living, Dementia Geofence & Family Peace of Mind
router.post('/senior/dementia-check', guardianController.checkDementiaGeofence);
router.post('/senior/medication-confirm', guardianController.recordCriticalMedication);
router.get('/senior/peace-of-mind/:userId', guardianController.getPeaceOfMindIndex);

module.exports = router;