const crypto = require('crypto');

const {
  nowIso,
  mapUserRow,
  userStatements,
  checkinStatements,
} = require('../config/sqlite');
const { createAlertEvent } = require('../services/alertEventService');
const {
  createInteractionEvent,
  listInteractionEvents,
} = require('../services/interactionService');
const {
  ensureAlertPolicy,
  updateAlertPolicy,
} = require('../services/alertPolicyService');

function computeDeadlineIso(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

async function registerUser(req, res) {
  const {
    fullName,
    phoneNumber,
    medicalNotes,
    emergencyContacts,
    timerIntervalMinutes,
    role,
    location,
  } = req.body;

  if (!fullName || !phoneNumber) {
    return res.status(400).json({ message: 'fullName and phoneNumber are required' });
  }

  const existed = userStatements.getByPhone.get(phoneNumber.trim());
  if (existed) {
    return res.status(409).json({ message: 'phoneNumber already exists' });
  }

  const interval = Number(timerIntervalMinutes) || 720;
  const now = nowIso();
  const id = crypto.randomUUID();

  userStatements.create.run({
    id,
    full_name: fullName.trim(),
    phone_number: phoneNumber.trim(),
    role: role === 'admin' ? 'admin' : 'user',
    medical_notes: medicalNotes || '',
    emergency_contacts: JSON.stringify(Array.isArray(emergencyContacts) ? emergencyContacts : []),
    timer_interval_minutes: interval,
    last_checkin_time: now,
    next_deadline: computeDeadlineIso(interval),
    current_status: 'SAFE',
    last_known_location: location
      ? JSON.stringify({ lat: Number(location.lat), lng: Number(location.lng), updatedAt: now })
      : null,
    quiet_hours_start: '23:00',
    quiet_hours_end: '06:00',
    sleep_mode_until: null,
    false_alert_grace_minutes: 3,
    created_at: now,
    updated_at: now,
  });

  const created = userStatements.getById.get(id);
  ensureAlertPolicy(id);
  createInteractionEvent({
    userId: id,
    type: 'ACCOUNT_REGISTERED',
    source: 'MOBILE_APP',
    metadata: { timerIntervalMinutes: interval },
  });
  createAlertEvent({
    userId: id,
    level: 'INFO',
    status: 'REGISTERED',
    source: 'USER',
    title: 'Dang ky tai khoan',
    message: `${fullName.trim()} da dang ky SafeSolo`,
    metadata: { timerIntervalMinutes: interval },
  });
  return res.status(201).json(mapUserRow(created));
}

async function checkin(req, res) {
  const { id } = req.params;
  const { location } = req.body;

  if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
    return res.status(400).json({ message: 'location.lat and location.lng are required numbers' });
  }

  const user = userStatements.getById.get(id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const now = nowIso();
  const deadline = computeDeadlineIso(user.timer_interval_minutes);
  const locationJson = JSON.stringify({ lat: location.lat, lng: location.lng, updatedAt: now });

  userStatements.updateCheckin.run({
    id,
    last_checkin_time: now,
    next_deadline: deadline,
    last_known_location: locationJson,
    updated_at: now,
  });

  checkinStatements.create.run({
    id: crypto.randomUUID(),
    user_id: id,
    checkin_time: now,
    location_at_checkin: JSON.stringify({ lat: location.lat, lng: location.lng }),
    is_system_auto_triggered: 0,
    created_at: now,
  });

  const updated = userStatements.getById.get(id);
  createInteractionEvent({
    userId: id,
    type: 'CHECKIN_TAP_OK',
    source: 'MOBILE_APP',
    metadata: { location },
  });
  createAlertEvent({
    userId: id,
    level: 'INFO',
    status: 'CHECKIN_OK',
    source: 'USER',
    title: 'Check-in thanh cong',
    message: 'Nguoi dung da xac nhan an toan',
    metadata: { location },
  });
  return res.json({ message: 'Check-in successful', user: mapUserRow(updated) });
}

async function updateTimer(req, res) {
  const { id } = req.params;
  const { timerIntervalMinutes } = req.body;
  const interval = Number(timerIntervalMinutes);

  if (!interval || interval < 30) {
    return res.status(400).json({ message: 'timerIntervalMinutes must be >= 30' });
  }

  const user = userStatements.getById.get(id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  userStatements.updateTimer.run({
    id,
    timer_interval_minutes: interval,
    next_deadline: computeDeadlineIso(interval),
    updated_at: nowIso(),
  });

  const updated = userStatements.getById.get(id);
  createAlertEvent({
    userId: id,
    level: 'INFO',
    status: 'TIMER_UPDATED',
    source: 'SYSTEM',
    title: 'Cap nhat chu ky check-in',
    message: `Chu ky moi: ${interval} phut`,
    metadata: { timerIntervalMinutes: interval },
  });
  return res.json({ message: 'Timer updated', user: mapUserRow(updated) });
}

async function updateLocation(req, res) {
  const { id } = req.params;
  const { location } = req.body;

  if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
    return res.status(400).json({ message: 'location.lat and location.lng are required numbers' });
  }

  const user = userStatements.getById.get(id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const now = nowIso();
  userStatements.updateLocation.run({
    id,
    last_known_location: JSON.stringify({ lat: location.lat, lng: location.lng, updatedAt: now }),
    updated_at: now,
  });

  const updated = userStatements.getById.get(id);
  return res.json({ message: 'Location updated', user: mapUserRow(updated) });
}

function isValidHourMinute(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

async function updatePreferences(req, res) {
  const { id } = req.params;
  const { quietHoursStart, quietHoursEnd, falseAlertGraceMinutes } = req.body;

  if (!isValidHourMinute(quietHoursStart) || !isValidHourMinute(quietHoursEnd)) {
    return res.status(400).json({ message: 'quietHoursStart/quietHoursEnd must be HH:mm' });
  }

  const grace = Number(falseAlertGraceMinutes);
  if (Number.isNaN(grace) || grace < 0 || grace > 30) {
    return res.status(400).json({ message: 'falseAlertGraceMinutes must be between 0 and 30' });
  }

  const user = userStatements.getById.get(id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  userStatements.updatePreferences.run({
    id,
    quiet_hours_start: quietHoursStart,
    quiet_hours_end: quietHoursEnd,
    false_alert_grace_minutes: grace,
    updated_at: nowIso(),
  });

  const updated = userStatements.getById.get(id);
  createAlertEvent({
    userId: id,
    level: 'INFO',
    status: 'PREFERENCES_UPDATED',
    source: 'USER',
    title: 'Cap nhat quiet hours',
    message: `Quiet hours ${quietHoursStart} - ${quietHoursEnd}, grace ${grace} phut`,
    metadata: { quietHoursStart, quietHoursEnd, falseAlertGraceMinutes: grace },
  });

  return res.json({ message: 'Preferences updated', user: mapUserRow(updated) });
}

async function setSleepMode(req, res) {
  const { id } = req.params;
  const { minutes } = req.body;
  const duration = Number(minutes);

  if (Number.isNaN(duration) || duration < 0 || duration > 1440) {
    return res.status(400).json({ message: 'minutes must be between 0 and 1440' });
  }

  const user = userStatements.getById.get(id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const sleepUntil = duration === 0 ? null : new Date(Date.now() + duration * 60 * 1000).toISOString();

  userStatements.updateSleepMode.run({
    id,
    sleep_mode_until: sleepUntil,
    updated_at: nowIso(),
  });

  createAlertEvent({
    userId: id,
    level: 'INFO',
    status: duration === 0 ? 'SLEEP_MODE_OFF' : 'SLEEP_MODE_ON',
    source: 'USER',
    title: duration === 0 ? 'Tat sleep mode' : 'Bat sleep mode',
    message: duration === 0 ? 'Da tat che do tam dung canh bao' : `Tam dung canh bao trong ${duration} phut`,
    metadata: { minutes: duration, sleepModeUntil: sleepUntil },
  });

  const updated = userStatements.getById.get(id);
  return res.json({ message: 'Sleep mode updated', user: mapUserRow(updated) });
}

async function listUsers(_req, res) {
  const users = userStatements.list.all().map(mapUserRow);
  return res.json(users);
}

async function getUserById(req, res) {
  const { id } = req.params;
  const user = userStatements.getById.get(id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  return res.json(mapUserRow(user));
}

async function getAlertPolicy(req, res) {
  const { id } = req.params;
  const user = userStatements.getById.get(id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  return res.json(ensureAlertPolicy(id));
}

async function updateAlertPolicyByUser(req, res) {
  const { id } = req.params;
  const user = userStatements.getById.get(id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const level1Minutes = Number(req.body.level1Minutes);
  const level2Minutes = Number(req.body.level2Minutes);
  const level3Minutes = Number(req.body.level3Minutes);
  const level4Enabled = Boolean(req.body.level4Enabled);

  if (
    Number.isNaN(level1Minutes) ||
    Number.isNaN(level2Minutes) ||
    Number.isNaN(level3Minutes) ||
    level1Minutes < 0 ||
    level2Minutes < 0 ||
    level3Minutes < level2Minutes
  ) {
    return res.status(400).json({
      message: 'Invalid alert policy. Ensure level3Minutes >= level2Minutes.',
    });
  }

  const policy = updateAlertPolicy(id, {
    level1Minutes,
    level2Minutes,
    level3Minutes,
    level4Enabled,
  });

  createAlertEvent({
    userId: id,
    level: 'INFO',
    status: 'ALERT_POLICY_UPDATED',
    source: 'USER',
    title: 'Cap nhat alert policy',
    message: `L1=${level1Minutes}, L2=${level2Minutes}, L3=${level3Minutes}`,
    metadata: { level1Minutes, level2Minutes, level3Minutes, level4Enabled },
  });

  return res.json(policy);
}

async function listUserInteractions(req, res) {
  const { id } = req.params;
  const user = userStatements.getById.get(id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const events = listInteractionEvents(id, req.query.limit);
  return res.json(events);
}

async function createUserInteraction(req, res) {
  const { id } = req.params;
  const user = userStatements.getById.get(id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const { type, source, metadata } = req.body;
  if (!type || !source) {
    return res.status(400).json({ message: 'type and source are required' });
  }

  createInteractionEvent({
    userId: id,
    type,
    source,
    metadata: metadata || {},
  });

  return res.status(201).json({ message: 'Interaction event recorded' });
}

module.exports = {
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
};
