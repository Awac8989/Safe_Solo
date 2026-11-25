const express = require('express');

const controller = require('../controllers/adminPortalController');
const adminAuthController = require('../controllers/adminAuthController');
const { requireAdminAuth, requireAdminRole } = require('../middleware/adminAuth');

const router = express.Router();

// Công xác thực ca trực TOC (cấp JWT thật)
router.post('/auth/login', adminAuthController.loginAdmin);

// Bắt buộc JWT Admin TOC hợp lệ cho toàn bộ API quản trị bên dưới
router.use(requireAdminAuth);

router.get('/auth/me', adminAuthController.getAdminMe);

// Nhóm tác chiến chung cho mọi vai trò TOC đã đăng nhập (superadmin, dispatcher, moderator)
const allowAllTocRoles = requireAdminRole('superadmin', 'dispatcher', 'moderator');
// Nhóm điều phối khẩn cấp & sinh tồn (superadmin, dispatcher)
const allowDispatchRoles = requireAdminRole('superadmin', 'dispatcher');
// Nhóm thẩm định pháp lý & KYC (superadmin, moderator)
const allowKycRoles = requireAdminRole('superadmin', 'moderator');
// Nhóm quản trị hạ tầng, tài chính B2B & phân tích cấp cao (chỉ superadmin)
const allowSuperAdminOnly = requireAdminRole('superadmin');

router.get('/overview', allowAllTocRoles, controller.getOverview);
router.get('/users', allowAllTocRoles, controller.listUsers);
router.get('/incidents', allowAllTocRoles, controller.listIncidents);
router.patch('/incidents/:id/resolve', allowDispatchRoles, controller.resolveIncident);
router.post('/incidents/:id/hitl-action', allowDispatchRoles, controller.handleHitlAction);
router.post('/incidents/:id/run-clinical-sop', allowDispatchRoles, controller.runClinicalSop);
router.get('/incidents/:id/sms-logs', allowAllTocRoles, controller.listSmsLogs);
router.get('/audit', allowAllTocRoles, controller.listAuditLogs);
router.get('/kyc', allowKycRoles, controller.listKycQueue);
router.patch('/kyc/:id', allowKycRoles, controller.updateKycStatus);
router.get('/channels', allowDispatchRoles, controller.getChannelHealth);
router.post('/channels/test-dispatch', allowDispatchRoles, controller.testDispatchOmnichannel);
router.get('/revenue', allowSuperAdminOnly, controller.getRevenueSummary);
router.post('/revenue/settle-partner', allowSuperAdminOnly, controller.settlePartnerCommission);
router.get('/heroes/radar', allowAllTocRoles, controller.getHeroRadar);
router.get('/safe-havens', allowAllTocRoles, controller.getSafeHavens);
router.get('/thank-you-notes', allowAllTocRoles, controller.getThankYouNotes);
router.get('/incidents/:id/dossier', allowAllTocRoles, controller.getIncidentDossier);
router.get('/hazards', allowAllTocRoles, controller.listHazards);
router.patch('/hazards/:id/verify', allowAllTocRoles, controller.verifyHazard);
router.post('/hazards', allowAllTocRoles, controller.createHazard);
router.post('/hazards/:id/broadcast-telegram', allowDispatchRoles, controller.broadcastHazardTelegram);
router.get('/vitals/active', allowDispatchRoles, controller.getMultiVictimVitals);
router.post('/vitals/:id/instant-dispatch', allowDispatchRoles, controller.instantDispatchVictim);
router.post('/users/:id/ping-checkin', allowDispatchRoles, controller.pingUserCheckin);
router.post('/users/:id/escalate-guardian', allowDispatchRoles, controller.escalateUserGuardian);
router.get('/b2b/overview', allowSuperAdminOnly, controller.getB2BOverview);
router.post('/b2b/ping-worker', allowSuperAdminOnly, controller.pingB2BWorker);
router.get('/heroes/fleet', allowAllTocRoles, controller.getHeroFleet);
router.post('/heroes/:id/bounty', allowDispatchRoles, controller.disburseHeroBounty);
router.post('/heroes/:id/message', allowDispatchRoles, controller.sendHeroDirectMessage);

// P1: Incident Timeline Playback (Flight Recorder)
router.get('/incidents/:id/playback', allowAllTocRoles, controller.getIncidentPlayback);

// P2: Dynamic Danger Geofences
router.get('/geofences', allowAllTocRoles, controller.listGeofences);
router.post('/geofences', allowDispatchRoles, controller.createGeofence);
router.patch('/geofences/:id/toggle', allowDispatchRoles, controller.toggleGeofence);
router.delete('/geofences/:id', allowDispatchRoles, controller.deleteGeofence);
router.post('/geofences/:id/broadcast', allowDispatchRoles, controller.broadcastGeofenceAlert);

// P3: AI SOP & Incident Briefing
router.get('/incidents/:id/ai-briefing', allowAllTocRoles, controller.getAiIncidentBriefing);
router.post('/incidents/:id/sop-action', allowDispatchRoles, controller.executeSopAction);

// Admin Disaster Alerts (Flooding, Landslides, Extreme Danger Broadcasts)
router.get('/disaster-alerts', allowAllTocRoles, controller.listDisasterAlerts);
router.post('/disaster-alerts', allowDispatchRoles, controller.createDisasterAlert);
router.patch('/disaster-alerts/:id/resolve', allowDispatchRoles, controller.resolveDisasterAlert);
router.put('/disaster-alerts/:id/resolve', allowDispatchRoles, controller.resolveDisasterAlert);

// Analytics Dashboard
router.get('/analytics', allowSuperAdminOnly, controller.getAnalyticsDashboard);

module.exports = router;
