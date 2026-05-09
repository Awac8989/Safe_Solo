const crypto = require('crypto');

const {
  nowIso,
  mapUserRow,
  mapMedicalProfileRow,
  mapAutomationSettingsRow,
  mapSecuritySettingsRow,
  mapDeviceSignalRow,
  userStatements,
  checkinStatements,
  medicalProfileStatements,
  automationSettingsStatements,
  securitySettingsStatements,
  deviceSignalStatements,
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
const { triggerSosForUser } = require('../services/sosService');
const { getIo } = require('../sockets/socketServer');

function computeDeadlineIso(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function ensureMedicalProfile(userId, fallback = {}) {
  let row = medicalProfileStatements.getByUserId.get(userId);
  if (!row) {
    const now = nowIso();
    medicalProfileStatements.upsert.run({
      user_id: userId,
      full_name: fallback.fullName || '',
      birth_year: '',
      blood_type: 'O+',
      allergies: '',
      conditions: '',
      medications: '',
      emergency_phone: fallback.emergencyPhone || '',
      insurance_provider: '',
      insurance_number: '',
      created_at: now,
      updated_at: now,
    });
    row = medicalProfileStatements.getByUserId.get(userId);
  }
  return mapMedicalProfileRow(row);
}

function ensureAutomationSettings(userId) {
  let row = automationSettingsStatements.getByUserId.get(userId);
  if (!row) {
    const now = nowIso();
    automationSettingsStatements.upsert.run({
      user_id: userId,
      daily_reminder_time: '08:00',
      shake_sos: 1,
      shake_sensitivity: 3,
      fall_detection: 0,
      geofence_auto_checkin: 1,
      pill_reminder: 0,
      pill_time: '08:00',
      home_location: null,
      last_geofence_event_at: null,
      created_at: now,
      updated_at: now,
    });
    row = automationSettingsStatements.getByUserId.get(userId);
  }
  return mapAutomationSettingsRow(row);
}

function ensureSecuritySettings(userId) {
  let row = securitySettingsStatements.getByUserId.get(userId);
  if (!row) {
    const now = nowIso();
    securitySettingsStatements.upsert.run({
      user_id: userId,
      stealth_mode: 0,
      auto_wipe_days: 0,
      encryption_enabled: 1,
      last_auto_wipe_due_at: null,
      created_at: now,
      updated_at: now,
    });
    row = securitySettingsStatements.getByUserId.get(userId);
  }
  return mapSecuritySettingsRow(row);
}

function normalizeContacts(rawContacts) {
  if (!Array.isArray(rawContacts)) {
    return [];
  }
  return rawContacts
    .map((item) => ({
      name: String(item?.name || '').trim(),
      phone: String(item?.phone || '').trim(),
      relation: String(item?.relation || '').trim(),
    }))
    .filter((item) => item.name && item.phone && item.relation);
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
  ensureMedicalProfile(id, { fullName: fullName.trim(), emergencyPhone: emergencyContacts?.[0]?.phone || '' });
  ensureAutomationSettings(id);
  ensureSecuritySettings(id);
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

async function listGuardians(req, res) {
  const { id } = req.params;
  const user = userStatements.getById.get(id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  return res.json(mapUserRow(user).emergencyContacts || []);
}

async function createGuardian(req, res) {
  const { id } = req.params;
  const user = userStatements.getById.get(id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const guardian = {
    name: String(req.body.name || '').trim(),
    phone: String(req.body.phone || '').trim(),
    relation: String(req.body.relation || '').trim(),
  };

  if (!guardian.name || !guardian.phone || !guardian.relation) {
    return res.status(400).json({ message: 'name, phone, and relation are required' });
  }

  const contacts = normalizeContacts(mapUserRow(user).emergencyContacts);
  if (contacts.some((item) => item.phone === guardian.phone)) {
    return res.status(409).json({ message: 'Guardian phone already exists' });
  }
  if (contacts.length >= 3) {
    return res.status(400).json({ message: 'Maximum 3 guardians allowed' });
  }

  const nextContacts = [...contacts, guardian];
  userStatements.updateContacts.run({
    id,
    emergency_contacts: JSON.stringify(nextContacts),
    updated_at: nowIso(),
  });

  createAlertEvent({
    userId: id,
    level: 'INFO',
    status: 'GUARDIAN_ADDED',
    source: 'USER',
    title: 'Them Guardian',
    message: `${guardian.name} da duoc them vao mang bao ho`,
    metadata: guardian,
  });

  return res.status(201).json(nextContacts);
}

async function deleteGuardian(req, res) {
  const { id, phone } = req.params;
  const user = userStatements.getById.get(id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const targetPhone = decodeURIComponent(phone);
  const contacts = normalizeContacts(mapUserRow(user).emergencyContacts);
  const nextContacts = contacts.filter((item) => item.phone !== targetPhone);
  if (nextContacts.length == contacts.length) {
    return res.status(404).json({ message: 'Guardian not found' });
  }

  userStatements.updateContacts.run({
    id,
    emergency_contacts: JSON.stringify(nextContacts),
    updated_at: nowIso(),
  });

  createAlertEvent({
    userId: id,
    level: 'INFO',
    status: 'GUARDIAN_REMOVED',
    source: 'USER',
    title: 'Xoa Guardian',
    message: `Da xoa guardian ${targetPhone}`,
    metadata: { phone: targetPhone },
  });

  return res.json(nextContacts);
}

async function getMedicalProfile(req, res) {
  const { id } = req.params;
  const user = userStatements.getById.get(id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  return res.json(ensureMedicalProfile(id, {
    fullName: user.full_name,
    emergencyPhone: normalizeContacts(mapUserRow(user).emergencyContacts)[0]?.phone || '',
  }));
}

async function updateMedicalProfile(req, res) {
  const { id } = req.params;
  const user = userStatements.getById.get(id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const now = nowIso();
  medicalProfileStatements.upsert.run({
    user_id: id,
    full_name: String(req.body.fullName || '').trim(),
    birth_year: String(req.body.birthYear || '').trim(),
    blood_type: String(req.body.bloodType || 'O+').trim() || 'O+',
    allergies: String(req.body.allergies || '').trim(),
    conditions: String(req.body.conditions || '').trim(),
    medications: String(req.body.medications || '').trim(),
    emergency_phone: String(req.body.emergencyPhone || '').trim(),
    insurance_provider: String(req.body.insuranceProvider || '').trim(),
    insurance_number: String(req.body.insuranceNumber || '').trim(),
    created_at: now,
    updated_at: now,
  });

  createAlertEvent({
    userId: id,
    level: 'INFO',
    status: 'MEDICAL_PROFILE_UPDATED',
    source: 'USER',
    title: 'Cap nhat ho so y te',
    message: 'Medical profile da duoc dong bo len backend',
    metadata: { bloodType: req.body.bloodType || 'O+' },
  });

  return res.json(ensureMedicalProfile(id));
}

async function getAutomationSettings(req, res) {
  const { id } = req.params;
  const user = userStatements.getById.get(id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  return res.json(ensureAutomationSettings(id));
}

async function updateAutomationSettings(req, res) {
  const { id } = req.params;
  const user = userStatements.getById.get(id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const current = ensureAutomationSettings(id);
  const dailyReminderTime = String(req.body.dailyReminderTime || current.dailyReminderTime).trim();
  const pillTime = String(req.body.pillTime || current.pillTime).trim();
  if (!isValidHourMinute(dailyReminderTime) || !isValidHourMinute(pillTime)) {
    return res.status(400).json({ message: 'dailyReminderTime and pillTime must be HH:mm' });
  }

  const now = nowIso();
  const shakeSos = req.body.shakeSos ?? current.shakeSos;
  const fallDetection = req.body.fallDetection ?? current.fallDetection;
  const geofenceAutoCheckin = req.body.geofenceAutoCheckin ?? current.geofenceAutoCheckin;
  const pillReminder = req.body.pillReminder ?? current.pillReminder;
  automationSettingsStatements.upsert.run({
    user_id: id,
    daily_reminder_time: dailyReminderTime,
    shake_sos: shakeSos ? 1 : 0,
    shake_sensitivity: Number(req.body.shakeSensitivity ?? current.shakeSensitivity) || 3,
    fall_detection: fallDetection ? 1 : 0,
    geofence_auto_checkin: geofenceAutoCheckin ? 1 : 0,
    pill_reminder: pillReminder ? 1 : 0,
    pill_time: pillTime,
    home_location: req.body.homeLocation ? JSON.stringify(req.body.homeLocation) : JSON.stringify(current.homeLocation),
    last_geofence_event_at: current.lastGeofenceEventAt,
    created_at: now,
    updated_at: now,
  });

  createAlertEvent({
    userId: id,
    level: 'INFO',
    status: 'AUTOMATION_UPDATED',
    source: 'USER',
    title: 'Cap nhat tu dong hoa',
    message: 'Cac quy tac daily reminder, geofence va sensor da duoc cap nhat',
    metadata: {
      dailyReminderTime,
      pillTime,
        geofenceAutoCheckin: Boolean(req.body.geofenceAutoCheckin ?? current.geofenceAutoCheckin),
      fallDetection: Boolean(fallDetection),
      shakeSos: Boolean(shakeSos),
    },
  });

  return res.json(ensureAutomationSettings(id));
}

async function getSecuritySettings(req, res) {
  const { id } = req.params;
  const user = userStatements.getById.get(id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  return res.json(ensureSecuritySettings(id));
}

async function updateSecuritySettings(req, res) {
  const { id } = req.params;
  const user = userStatements.getById.get(id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const current = ensureSecuritySettings(id);
  const autoWipeDays = Number(req.body.autoWipeDays ?? current.autoWipeDays);
  const stealthMode = req.body.stealthMode ?? current.stealthMode;
  const encryptionEnabled = req.body.encryptionEnabled ?? current.encryptionEnabled;
  if (Number.isNaN(autoWipeDays) || autoWipeDays < 0 || autoWipeDays > 60) {
    return res.status(400).json({ message: 'autoWipeDays must be between 0 and 60' });
  }

  const now = nowIso();
  securitySettingsStatements.upsert.run({
    user_id: id,
    stealth_mode: stealthMode ? 1 : 0,
    auto_wipe_days: autoWipeDays,
    encryption_enabled: encryptionEnabled ? 1 : 0,
    last_auto_wipe_due_at: current.lastAutoWipeDueAt,
    created_at: now,
    updated_at: now,
  });

  createAlertEvent({
    userId: id,
    level: 'INFO',
    status: 'SECURITY_UPDATED',
    source: 'USER',
    title: 'Cap nhat bao mat',
      message: 'Stealth mode, auto-wipe va trang thai ma hoa da duoc cap nhat',
      metadata: {
      stealthMode: Boolean(stealthMode),
      autoWipeDays,
      encryptionEnabled: Boolean(encryptionEnabled),
    },
  });

  return res.json(ensureSecuritySettings(id));
}

async function listDeviceSignals(req, res) {
  const { id } = req.params;
  const user = userStatements.getById.get(id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  return res.json(deviceSignalStatements.listByUser.all(id, limit).map(mapDeviceSignalRow));
}

async function createDeviceSignal(req, res) {
  const { id } = req.params;
  const user = userStatements.getById.get(id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const signalType = String(req.body.signalType || '').trim();
  const payload = req.body.payload || {};
  if (!signalType) {
    return res.status(400).json({ message: 'signalType is required' });
  }

  const createdAt = nowIso();
  deviceSignalStatements.create.run({
    id: crypto.randomUUID(),
    user_id: id,
    signal_type: signalType,
    payload_json: JSON.stringify(payload),
    created_at: createdAt,
  });

  createInteractionEvent({
    userId: id,
    type: signalType,
    source: 'DEVICE_SIGNAL',
    metadata: payload,
  });

  const automation = ensureAutomationSettings(id);
  let action = 'RECORDED';

  if (signalType === 'GEOFENCE_HOME_ARRIVAL' && automation.geofenceAutoCheckin) {
    const lat = Number(payload.lat);
    const lng = Number(payload.lng);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      const now = nowIso();
      userStatements.updateCheckin.run({
        id,
        last_checkin_time: now,
        next_deadline: computeDeadlineIso(user.timer_interval_minutes),
        last_known_location: JSON.stringify({ lat, lng, updatedAt: now }),
        updated_at: now,
      });
      checkinStatements.create.run({
        id: crypto.randomUUID(),
        user_id: id,
        checkin_time: now,
        location_at_checkin: JSON.stringify({ lat, lng }),
        is_system_auto_triggered: 1,
        created_at: now,
      });
      automationSettingsStatements.touchGeofenceEvent.run({
        user_id: id,
        last_geofence_event_at: now,
        updated_at: now,
      });
      createAlertEvent({
        userId: id,
        level: 'INFO',
        status: 'AUTO_CHECKIN_HOME',
        source: 'SYSTEM',
        title: 'Auto check-in khi ve nha',
        message: 'Da tu dong check-in khi phat hien den khu vuc nha',
        metadata: payload,
      });
      action = 'AUTO_CHECKIN';
    }
  } else if (
    (signalType === 'FALL_DETECTED' && automation.fallDetection) ||
    (signalType === 'SHAKE_SOS' && automation.shakeSos)
  ) {
    let io = null;
    try {
      io = getIo();
    } catch (_) {
      io = { emit() {} };
    }
    await triggerSosForUser(io, mapUserRow(user));
    createAlertEvent({
      userId: id,
      level: signalType === 'FALL_DETECTED' ? 'LEVEL_2_ALARM' : 'LEVEL_3_SOS',
      status: signalType,
      source: 'DEVICE_SIGNAL',
      title: signalType === 'FALL_DETECTED' ? 'Phat hien te nga' : 'Lac may tao SOS',
      message: signalType === 'FALL_DETECTED'
        ? 'Backend da nhan te nga va kich hoat chuoi cuu ho'
        : 'Backend da nhan lac may va kich hoat SOS',
      metadata: payload,
    });
    action = 'SOS_TRIGGERED';
  }

  return res.status(201).json({ message: 'Device signal recorded', action });
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
  listGuardians,
  createGuardian,
  deleteGuardian,
  getMedicalProfile,
  updateMedicalProfile,
  getAutomationSettings,
  updateAutomationSettings,
  getSecuritySettings,
  updateSecuritySettings,
  listDeviceSignals,
  createDeviceSignal,
};
