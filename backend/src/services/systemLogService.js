const { withState, createId, nowIso } = require('../data/store');

class SystemLogService {
  async createLog({ incidentId = null, actionType, description, metadata = {} }) {
    return withState((state) => {
      const log = {
        id: createId('log'),
        incidentId,
        actionType,
        description,
        metadata,
        createdAt: nowIso(),
      };

      state.systemLogs.push(log);
      return log;
    });
  }

  async listLogs({ incidentId = null } = {}) {
    const { readState } = require('../data/store');
    const state = readState();
    return state.systemLogs
      .filter((item) => (incidentId ? item.incidentId === incidentId : true))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
}

module.exports = new SystemLogService();
