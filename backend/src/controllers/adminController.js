const { resolveEmergency } = require('../services/sosService');
const { listAlertEvents } = require('../services/alertEventService');
const EmergencyLog = require('../models/EmergencyLog');
const SmsDispatchLog = require('../models/SmsDispatchLog');
const User = require('../models/User');
const { mapUserDoc, toIso } = require('../lib/mongoCore');

function mapEmergencyDoc(log) {
  if (!log) {
    return null;
  }
  const row = log.toObject ? log.toObject() : log;
  return {
    _id: row._id,
    userId: row.userId,
    triggeredAt: toIso(row.triggeredAt),
    resolvedAt: toIso(row.resolvedAt),
    isResolved: Boolean(row.isResolved),
    smsSentStatus: Boolean(row.smsSentStatus),
    locationSnapshot: row.locationSnapshot || null,
    notes: row.notes || '',
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function mapSmsDispatchDoc(doc) {
  if (!doc) {
    return null;
  }
  const row = doc.toObject ? doc.toObject() : doc;
  return {
    _id: row._id,
    emergencyLogId: row.emergencyLogId,
    userId: row.userId,
    toPhone: row.toPhone,
    provider: row.provider,
    attempt: row.attempt,
    success: Boolean(row.success),
    providerMessageId: row.providerMessageId,
    errorMessage: row.errorMessage,
    responseBody: row.responseBody || null,
    createdAt: toIso(row.createdAt),
  };
}

async function attachUsers(logs) {
  const userIds = [...new Set(logs.map((item) => item.userId).filter(Boolean))];
  const users = await User.find({ _id: { $in: userIds } });
  const userMap = new Map(users.map((user) => [user._id, mapUserDoc(user)]));

  return logs.map((log) => {
    const user = userMap.get(log.userId);
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
  });
}

async function listEmergencies(req, res) {
  const { status } = req.query;
  const query =
    status === 'open'
      ? { isResolved: false }
      : status === 'resolved'
      ? { isResolved: true }
      : {};

  const docs = await EmergencyLog.find(query).sort({ createdAt: -1 });
  const logs = await attachUsers(docs.map(mapEmergencyDoc));
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
  const timeline = await listAlertEvents({ userId, page, limit });
  return res.json(timeline);
}

async function listEmergencySmsLogs(req, res) {
  const { id } = req.params;
  const logs = await SmsDispatchLog.find({ emergencyLogId: id }).sort({ createdAt: -1 });
  return res.json(logs.map(mapSmsDispatchDoc));
}

module.exports = {
  listEmergencies,
  resolveEmergencyLog,
  listAlertTimeline,
  listEmergencySmsLogs,
};
