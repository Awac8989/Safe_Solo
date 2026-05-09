const express = require('express');

const {
  registerUser,
  checkin,
  updateTimer,
  updateLocation,
  updatePreferences,
  setSleepMode,
  listUsers,
  getUserById,
  getAlertPolicy,
  updateAlertPolicyByUser,
  listUserInteractions,
  createUserInteraction,
  listGuardians,
  createGuardian,
  deleteGuardian,
  getMedicalProfile,
  updateMedicalProfile,
  getAutomationSettings,
  updateAutomationSettings,
  getSecuritySettings,
  updateSecuritySettings,
  listDeviceSignals,
  createDeviceSignal,
} = require('../controllers/userController');
const {
  listEmergencies,
  resolveEmergencyLog,
  listAlertTimeline,
  listEmergencySmsLogs,
} = require('../controllers/adminController');
const authRoutes = require('./authRoutes');
const chatRoutes = require('./chatRoutes');
const radarRoutes = require('./radarRoutes');
const feedRoutes = require('./feedRoutes');
const emergencyRoutes = require('./emergencyRoutes');
const guardianRoutes = require('./guardianRoutes');
const medicalRoutes = require('./medicalRoutes');
const communityRoutes = require('./communityRoutes');
const kycRoutes = require('./kycRoutes');
const locationRoutes = require('./locationRoutes');

const apiRouter = express.Router();

// Prisma Routes
apiRouter.use('/auth', authRoutes);
apiRouter.use('/chat', chatRoutes);
apiRouter.use('/radar', radarRoutes);
apiRouter.use('/feed', feedRoutes);
apiRouter.use('/emergencies', emergencyRoutes);
apiRouter.use('/guardians', guardianRoutes);
apiRouter.use('/medical', medicalRoutes);
apiRouter.use('/community', communityRoutes);
apiRouter.use('/kyc', kycRoutes);
apiRouter.use('/location', locationRoutes);

// Legacy/Admin Routes (SQLite)
apiRouter.post('/users/register', registerUser);
apiRouter.get('/users', listUsers);
apiRouter.get('/users/:id', getUserById);
apiRouter.post('/users/:id/checkin', checkin);
apiRouter.patch('/users/:id/timer', updateTimer);
apiRouter.patch('/users/:id/location', updateLocation);
apiRouter.patch('/users/:id/preferences', updatePreferences);
apiRouter.patch('/users/:id/sleep-mode', setSleepMode);
apiRouter.get('/users/:id/alert-policy', getAlertPolicy);
apiRouter.patch('/users/:id/alert-policy', updateAlertPolicyByUser);
apiRouter.get('/users/:id/interactions', listUserInteractions);
apiRouter.post('/users/:id/interactions', createUserInteraction);
apiRouter.get('/users/:id/guardians', listGuardians);
apiRouter.post('/users/:id/guardians', createGuardian);
apiRouter.delete('/users/:id/guardians/:phone', deleteGuardian);
apiRouter.get('/users/:id/medical-profile', getMedicalProfile);
apiRouter.put('/users/:id/medical-profile', updateMedicalProfile);
apiRouter.get('/users/:id/automation-settings', getAutomationSettings);
apiRouter.patch('/users/:id/automation-settings', updateAutomationSettings);
apiRouter.get('/users/:id/security-settings', getSecuritySettings);
apiRouter.patch('/users/:id/security-settings', updateSecuritySettings);
apiRouter.get('/users/:id/device-signals', listDeviceSignals);
apiRouter.post('/users/:id/device-signals', createDeviceSignal);

apiRouter.get('/admin/emergencies', listEmergencies);
apiRouter.patch('/admin/emergencies/:id/resolve', resolveEmergencyLog);
apiRouter.get('/admin/emergencies/:id/sms-logs', listEmergencySmsLogs);
apiRouter.get('/admin/alerts', listAlertTimeline);

module.exports = { apiRouter };
