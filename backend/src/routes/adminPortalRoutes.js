const express = require('express');

const controller = require('../controllers/adminPortalController');

const router = express.Router();

router.get('/overview', controller.getOverview);
router.get('/users', controller.listUsers);
router.get('/incidents', controller.listIncidents);
router.patch('/incidents/:id/resolve', controller.resolveIncident);
router.post('/incidents/:id/hitl-action', controller.handleHitlAction);
router.get('/incidents/:id/sms-logs', controller.listSmsLogs);
router.get('/audit', controller.listAuditLogs);
router.get('/kyc', controller.listKycQueue);
router.patch('/kyc/:id', controller.updateKycStatus);
router.get('/channels', controller.getChannelHealth);
router.get('/revenue', controller.getRevenueSummary);
router.get('/heroes/radar', controller.getHeroRadar);
router.get('/safe-havens', controller.getSafeHavens);
router.get('/thank-you-notes', controller.getThankYouNotes);
router.get('/incidents/:id/dossier', controller.getIncidentDossier);
router.get('/hazards', controller.listHazards);
router.patch('/hazards/:id/verify', controller.verifyHazard);
router.post('/hazards', controller.createHazard);
router.get('/vitals/active', controller.getMultiVictimVitals);
router.get('/b2b/overview', controller.getB2BOverview);
router.get('/heroes/fleet', controller.getHeroFleet);
router.post('/heroes/:id/bounty', controller.disburseHeroBounty);

// P1: Incident Timeline Playback (Flight Recorder)
router.get('/incidents/:id/playback', controller.getIncidentPlayback);

// P2: Dynamic Danger Geofences
router.get('/geofences', controller.listGeofences);
router.post('/geofences', controller.createGeofence);
router.patch('/geofences/:id/toggle', controller.toggleGeofence);
router.delete('/geofences/:id', controller.deleteGeofence);
router.post('/geofences/:id/broadcast', controller.broadcastGeofenceAlert);

// P3: AI SOP & Incident Briefing
router.get('/incidents/:id/ai-briefing', controller.getAiIncidentBriefing);
router.post('/incidents/:id/sop-action', controller.executeSopAction);

// Admin Disaster Alerts (Flooding, Landslides, Extreme Danger Broadcasts)
router.get('/disaster-alerts', controller.listDisasterAlerts);
router.post('/disaster-alerts', controller.createDisasterAlert);
router.patch('/disaster-alerts/:id/resolve', controller.resolveDisasterAlert);
router.put('/disaster-alerts/:id/resolve', controller.resolveDisasterAlert);

module.exports = router;
