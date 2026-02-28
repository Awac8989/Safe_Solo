const crypto = require('crypto');

const {
  nowIso,
  mapEmergencyRow,
  mapUserRow,
  userStatements,
  emergencyStatements,
} = require('../config/sqlite');
const { sendEmergencySms } = require('./smsService');
const { createAlertEvent } = require('./alertEventService');
const { getIo } = require('../sockets/socketServer');

async function triggerSosForUser(io, userLike) {
  if (!userLike || userLike.currentStatus === 'SOS') {
    return null;
  }

  const userRow = userStatements.getById.get(userLike._id || userLike.id);
  if (!userRow) {
    return null;
  }
  const user = mapUserRow(userRow);

  if (user.currentStatus === 'SOS') {
    return null;
  }

  const now = nowIso();
  const emergencyId = crypto.randomUUID();
  emergencyStatements.create.run({
    id: emergencyId,
    user_id: user._id,
    triggered_at: now,
    is_resolved: 0,
    sms_sent_status: 0,
    location_snapshot: user.lastKnownLocation ? JSON.stringify(user.lastKnownLocation) : null,
    notes: '',
    created_at: now,
    updated_at: now,
  });

  const smsResults = await sendEmergencySms({
    emergencyLogId: emergencyId,
    user,
    contacts: user.emergencyContacts,
    location: user.lastKnownLocation,
  });

  const successCount = smsResults.filter((item) => item.success).length;
  emergencyStatements.updateSmsStatus.run({
    id: emergencyId,
    sms_sent_status: successCount > 0 ? 1 : 0,
    updated_at: nowIso(),
  });

  userStatements.updateStatusFields.run({
    id: user._id,
    current_status: 'SOS',
    last_reminder_at: user.lastReminderAt || null,
    last_warning_at: user.lastWarningAt || null,
    last_sos_at: now,
    updated_at: now,
  });

  const payload = {
    type: 'EMERGENCY_SOS',
    userId: user._id,
    fullName: user.fullName,
    phoneNumber: user.phoneNumber,
    medicalNotes: user.medicalNotes,
    emergencyContacts: user.emergencyContacts,
    location: user.lastKnownLocation,
    triggeredAt: now,
    emergencyLogId: emergencyId,
  };

  io.emit('EMERGENCY_SOS', payload);

  const alertEvent = createAlertEvent({
    userId: user._id,
    level: 'LEVEL_3_SOS',
    status: 'SOS_DISPATCHED',
    source: 'SYSTEM',
    title: 'Kich hoat SOS',
    message: 'He thong da gui canh bao khan cap den danh ba tin cay',
    metadata: {
      emergencyLogId: emergencyId,
      smsSent: successCount,
      smsAttempted: smsResults.length,
      smsFailed: smsResults.length - successCount,
      location: user.lastKnownLocation,
    },
  });
  io.emit('ALERT_EVENT', alertEvent);

  return payload;
}

async function resolveEmergency(logId, notes) {
  const row = emergencyStatements.getById.get(logId);
  if (!row) {
    const error = new Error('Emergency log not found');
    error.statusCode = 404;
    throw error;
  }

  const now = nowIso();
  emergencyStatements.resolve.run({
    id: logId,
    resolved_at: now,
    notes: notes || row.notes || '',
    updated_at: now,
  });

  userStatements.clearToSafe.run({
    id: row.user_id,
    updated_at: now,
  });

  const event = createAlertEvent({
    userId: row.user_id,
    level: 'INFO',
    status: 'EMERGENCY_RESOLVED',
    source: 'ADMIN',
    title: 'Da xu ly su co',
    message: 'Su co SOS da duoc danh dau xu ly',
    metadata: { emergencyLogId: logId, notes: notes || '' },
  });
  try {
    getIo().emit('ALERT_EVENT', event);
  } catch (_) {
    // ignore when socket server is not initialized
  }

  const updated = emergencyStatements.getById.get(logId);
  return mapEmergencyRow(updated);
}

module.exports = { triggerSosForUser, resolveEmergency };