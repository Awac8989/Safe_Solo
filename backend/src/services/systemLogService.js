const prisma = require('../config/database');

class SystemLogService {
  async createLog({ incidentId = null, actionType, description }) {
    return prisma.systemLog.create({
      data: {
        incidentId,
        action_type: actionType,
        description,
      },
    });
  }
}

module.exports = new SystemLogService();
