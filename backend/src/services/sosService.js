const crypto = require('crypto');

const User = require('../models/User');
const EmergencyLog = require('../models/EmergencyLog');
const { sendEmergencySms } = require('./smsService');
const { createAlertEvent } = require('./alertEventService');
const { getIo } = require('../sockets/socketServer');
const { mapUserDoc, toIso } = require('../lib/mongoCore');

function mapEmergencyDoc(doc) {
  if (!doc) {
    return null;
  }

  const row = doc.toObject ? doc.toObject() : doc;
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

async function triggerSosForMongoUser(io, userDoc) {
  const user = mapUserDoc(userDoc);
  if (!user || user.currentStatus === 'SOS') {
    return null;
  }

  const emergencyLog = await EmergencyLog.create({
    _id: crypto.randomUUID(),
    userId: user._id,
    triggeredAt: new Date(),
    isResolved: false,
    smsSentStatus: false,
    locationSnapshot: user.lastKnownLocation,
    notes: '',
  });

  const smsResults = await sendEmergencySms({
    emergencyLogId: emergencyLog._id,
    user,
    contacts: user.emergencyContacts,
    location: user.lastKnownLocation,
  });

  const successCount = smsResults.filter((item) => item.success).length;
  emergencyLog.smsSentStatus = successCount > 0;
  await emergencyLog.save();

  userDoc.currentStatus = 'SOS';
  userDoc.lastSosAt = new Date();
  await userDoc.save();

  const payload = {
    type: 'EMERGENCY_SOS',
    userId: user._id,
    fullName: user.fullName,
    phoneNumber: user.phoneNumber,
    medicalNotes: user.medicalNotes,
    emergencyContacts: user.emergencyContacts,
    location: user.lastKnownLocation,
    triggeredAt: toIso(emergencyLog.triggeredAt),
    emergencyLogId: emergencyLog._id,
  };

  io.emit('EMERGENCY_SOS', payload);

  const alertEvent = await createAlertEvent({
    userId: user._id,
    level: 'LEVEL_3_SOS',
    status: 'SOS_DISPATCHED',
    source: 'SYSTEM',
    title: 'Kich hoat SOS',
    message: 'He thong da gui canh bao khan cap den danh ba tin cay',
    metadata: {
      emergencyLogId: emergencyLog._id,
      smsSent: successCount,
      smsAttempted: smsResults.length,
      smsFailed: smsResults.length - successCount,
      location: user.lastKnownLocation,
    },
  });
  io.emit('ALERT_EVENT', alertEvent);

  return payload;
}

async function triggerSosForUser(io, userLike) {
  if (!userLike) {
    return null;
  }

  const mongoUser = await User.findById(userLike._id || userLike.id);
  if (!mongoUser || userLike.currentStatus === 'SOS') {
    return null;
  }

  return triggerSosForMongoUser(io, mongoUser);
}

async function resolveEmergency(logId, notes) {
  const mongoLog = await EmergencyLog.findById(logId);
  if (!mongoLog) {
    const error = new Error('Emergency log not found');
    error.statusCode = 404;
    throw error;
  }

  mongoLog.isResolved = true;
  mongoLog.resolvedAt = new Date();
  mongoLog.notes = notes || mongoLog.notes || '';
  await mongoLog.save();

  await User.findByIdAndUpdate(mongoLog.userId, {
    currentStatus: 'SAFE',
    lastReminderAt: null,
    lastWarningAt: null,
  });

  const event = await createAlertEvent({
    userId: mongoLog.userId,
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
  return mapEmergencyDoc(mongoLog);
}

module.exports = { triggerSosForUser, resolveEmergency };
