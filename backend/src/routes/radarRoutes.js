const express = require('express');
const radarController = require('../controllers/radarController');
const { validate, radarSchemas } = require('../middleware/validation');
const auth = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(auth);

// SOS broadcast and incident management
router.post('/broadcast', validate(radarSchemas.broadcast), radarController.broadcastSOS);
router.get('/nearby', validate(radarSchemas.nearby, 'query'), radarController.getNearbyIncidents);

// Incident-specific routes
router.post('/:incidentId/accept', radarController.acceptIncident);
router.get('/:incidentId', radarController.getIncidentDetails);
router.put('/:incidentId/resolve', radarController.resolveIncident);

module.exports = router;