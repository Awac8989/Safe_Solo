const SystemLog = require('../models/SystemLog');
const { toIso } = require('../lib/mongoCore');

function mapSystemLog(doc) {
  if (!doc) {
    return null;
  }
  const row = doc.toObject ? doc.toObject() : doc;
  return {
    id: row._id,
    incidentId: row.incidentId || null,
    actionType: row.actionType,
    description: row.description,
    metadata: row.metadata || {},
    createdAt: toIso(row.createdAt),
  };
}

class SystemLogService {
  async createLog({ incidentId = null, actionType, description, metadata = {} }) {
    const log = await SystemLog.create({
      incidentId,
      actionType,
      description,
      metadata,
    });
    return mapSystemLog(log);
  }

  async listLogs({ incidentId = null } = {}) {
    const query = incidentId ? { incidentId } : {};
    const logs = await SystemLog.find(query).sort({ createdAt: -1 });
    return logs.map(mapSystemLog);
  }
}

module.exports = new SystemLogService();
