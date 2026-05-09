const emergencyService = require('../services/emergencyService');

class EmergencyController {
  async silentSos(req, res, next) {
    try {
      res.status(200).json({ success: true, message: 'Alarm disabled' });

      setImmediate(async () => {
        try {
          await emergencyService.createSilentSosIncident(req.user.id);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Silent SOS background failure:', error.message);
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new EmergencyController();
