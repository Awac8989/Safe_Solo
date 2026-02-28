const { resolveEmergency } = require('../services/sosService');
const {
  mapEmergencyRow,
  mapSmsDispatchRow,
  mapUserRow,
  emergencyStatements,
  smsDispatchStatements,
  userStatements,
} = require('../config/sqlite');
const { listAlertEvents } = require('../services/alertEventService');

function attachUser(log) {
  const userRow = userStatements.getById.get(log.userId);
  const user = userRow ? mapUserRow(userRow) : null;

  return {
    ...log,
    userId: user
      ? {
          fullName: user.fullName,
          phoneNumber: user.phoneNumber,
          medicalNotes: user.medicalNotes,
          emergencyContacts: user.emergencyContacts,
          currentStatus: user.currentStatus,
        }
      : null,
  };
}

async function listEmergencies(req, res) {
  const { status } = req.query;

  let rows;
  if (status === 'open') {
    rows = emergencyStatements.listOpen.all();
  } else if (status === 'resolved') {
    rows = emergencyStatements.listResolved.all();
  } else {
    rows = emergencyStatements.listAll.all();
  }

  const logs = rows.map((row) => attachUser(mapEmergencyRow(row)));
  return res.json(logs);
}

async function resolveEmergencyLog(req, res) {
  const { id } = req.params;
  const { notes } = req.body;

  const log = await resolveEmergency(id, notes);
  return res.json({ message: 'Emergency resolved', log });
}

async function listAlertTimeline(req, res) {
  const { userId, page, limit } = req.query;
  const timeline = listAlertEvents({ userId, page, limit });
  return res.json(timeline);
}

async function listEmergencySmsLogs(req, res) {
  const { id } = req.params;
  const logs = smsDispatchStatements.listByEmergency
    .all(id)
    .map(mapSmsDispatchRow);
  return res.json(logs);
}

module.exports = {
  listEmergencies,
  resolveEmergencyLog,
  listAlertTimeline,
  listEmergencySmsLogs,
};