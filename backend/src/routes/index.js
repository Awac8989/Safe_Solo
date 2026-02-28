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
} = require('../controllers/userController');
const {
  listEmergencies,
  resolveEmergencyLog,
  listAlertTimeline,
  listEmergencySmsLogs,
} = require('../controllers/adminController');

const apiRouter = express.Router();

apiRouter.post('/users/register', registerUser);
apiRouter.get('/users', listUsers);
apiRouter.get('/users/:id', getUserById);
apiRouter.post('/users/:id/checkin', checkin);
apiRouter.patch('/users/:id/timer', updateTimer);
apiRouter.patch('/users/:id/location', updateLocation);
apiRouter.patch('/users/:id/preferences', updatePreferences);
apiRouter.patch('/users/:id/sleep-mode', setSleepMode);

apiRouter.get('/admin/emergencies', listEmergencies);
apiRouter.patch('/admin/emergencies/:id/resolve', resolveEmergencyLog);
apiRouter.get('/admin/emergencies/:id/sms-logs', listEmergencySmsLogs);
apiRouter.get('/admin/alerts', listAlertTimeline);

module.exports = { apiRouter };