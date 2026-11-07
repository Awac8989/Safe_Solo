const express = require('express');
const radarController = require('../controllers/radarController');
const { validate, radarSchemas } = require('../middleware/validation');
const auth = require('../middleware/auth');

const router = express.Router();

// Public SBAR Handoff QR verification for 115 Doctors & Hospitals
router.get('/sbar-verify/:hash', radarController.verifySbarHandoff);

// All subsequent routes require authentication
router.use(auth);

// SOS broadcast and incident management
router.post('/broadcast', validate(radarSchemas.broadcast), radarController.broadcastSOS);
router.get('/nearby', validate(radarSchemas.nearby, 'query'), radarController.getNearbyIncidents);

// Incident-specific routes
router.post('/:incidentId/accept', radarController.acceptIncident);
router.get('/:incidentId', radarController.getIncidentDetails);
router.put('/:incidentId/resolve', radarController.resolveIncident);

// Telemetry, First Aid and 115 Handoff routes
router.post('/:incidentId/arrive', radarController.arriveAtScene);
router.post('/:incidentId/beacon', radarController.triggerBeacon);
router.post('/:incidentId/telemetry', radarController.updateTelemetry);
router.post('/:incidentId/first-aid', radarController.recordFirstAid);
router.post('/:incidentId/handoff', radarController.handoffToMedical);
router.post('/:incidentId/scene-safety', radarController.assessSceneSafety);
router.post('/:incidentId/bystander-guidance', radarController.triggerBystanderGuidance);
router.get('/:incidentId/emergency-pass', radarController.getEmergencyPass);
router.post('/:incidentId/clinical-assessment', radarController.recordClinicalAssessment);
router.post('/:incidentId/aar', radarController.submitAfterActionReview);

// Tele-FirstAid Live Consultation with 115 ER Doctor
router.post('/tele-consult/request', radarController.initiateTeleConsultation);
router.post('/tele-consult/doctor-join', radarController.connectDoctorTeleConsultation);
router.post('/tele-consult/issue-order', radarController.issueVerbalMedicalOrder);
router.post('/tele-consult/execute-order', radarController.confirmMedicalOrderExecuted);

module.exports = router;