const User = require('../models/User');
const CheckInHistory = require('../models/CheckInHistory');
const MedicalProfile = require('../models/MedicalProfile');
const AutomationSetting = require('../models/AutomationSetting');
const SecuritySetting = require('../models/SecuritySetting');
const DeviceSignal = require('../models/DeviceSignal');
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
const {
  nowIso,
  computeDeadlineIso,
  normalizeContacts,
  mapUserDoc,
  mapMedicalProfileDoc,
  mapAutomationSettingDoc,
  mapSecuritySettingDoc,
  toIso,
} = require('../lib/mongoCore');

function isValidHourMinute(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

async function ensureUserById(userId) {
  return User.findById(userId);
}

async function ensureUserByPhone(phoneNumber) {
  return User.findOne({ phoneNumber: String(phoneNumber || '').trim() });
}

function mapDeviceSignalDoc(doc) {
  if (!doc) {
    return null;
  }
  const row = doc.toObject ? doc.toObject() : doc;
  return {
    id: row._id,
    userId: row.userId,
    signalType: row.signalType,
    payload: row.payload || {},
    createdAt: toIso(row.createdAt),
  };
}

async function ensureMedicalProfile(userId, fallback = {}) {
  let profile = await MedicalProfile.findOne({ userId });
  if (!profile) {
    profile = await MedicalProfile.create({
      userId,
      fullName: fallback.fullName || '',
      birthYear: '',
      bloodType: 'O+',
      allergies: '',
      conditions: '',
      medications: '',
      emergencyPhone: fallback.emergencyPhone || '',
      insuranceProvider: '',
      insuranceNumber: '',
    });
  }

  return mapMedicalProfileDoc(profile);
}

async function ensureAutomationSettings(userId) {
  let settings = await AutomationSetting.findOne({ userId });
  if (!settings) {
    settings = await AutomationSetting.create({ userId });
  }

  return mapAutomationSettingDoc(settings);
}

async function ensureSecuritySettings(userId) {
  let settings = await SecuritySetting.findOne({ userId });
  if (!settings) {
    settings = await SecuritySetting.create({ userId });
  }

  return mapSecuritySettingDoc(settings);
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

  const existed = await ensureUserByPhone(phoneNumber);
  if (existed) {
    return res.status(409).json({ message: 'phoneNumber already exists' });
  }

  const interval = Number(timerIntervalMinutes) || 720;
  const now = new Date();
  const userDoc = await User.create({
    fullName: fullName.trim(),
    phoneNumber: phoneNumber.trim(),
    role: role === 'admin' ? 'admin' : 'user',
    medicalNotes: medicalNotes || '',
    emergencyContacts: normalizeContacts(Array.isArray(emergencyContacts) ? emergencyContacts : []),
    timerIntervalMinutes: interval,
    lastCheckinTime: now,
    nextDeadline: new Date(Date.now() + interval * 60 * 1000),
    currentStatus: 'SAFE',
    lastKnownLocation: location
      ? { lat: Number(location.lat), lng: Number(location.lng), updatedAt: now }
      : null,
    quietHoursStart: '23:00',
    quietHoursEnd: '06:00',
    falseAlertGraceMinutes: 3,
  });

  await Promise.all([
    ensureAlertPolicy(userDoc._id),
    ensureMedicalProfile(userDoc._id, {
      fullName: fullName.trim(),
      emergencyPhone: emergencyContacts?.[0]?.phone || '',
    }),
    ensureAutomationSettings(userDoc._id),
    ensureSecuritySettings(userDoc._id),
  ]);

  await createInteractionEvent({
    userId: userDoc._id,
    type: 'ACCOUNT_REGISTERED',
    source: 'MOBILE_APP',
    metadata: { timerIntervalMinutes: interval },
  });
  await createAlertEvent({
    userId: userDoc._id,
    level: 'INFO',
    status: 'REGISTERED',
    source: 'USER',
    title: 'Dang ky tai khoan',
    message: `${fullName.trim()} da dang ky SafeSolo`,
    metadata: { timerIntervalMinutes: interval },
  });

  return res.status(201).json(mapUserDoc(userDoc));
}

async function checkin(req, res) {
  const { id } = req.params;
  const { location } = req.body;

  if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
    return res.status(400).json({ message: 'location.lat and location.lng are required numbers' });
  }

  const userDoc = await ensureUserById(id);
  if (!userDoc) {
    return res.status(404).json({ message: 'User not found' });
  }

  const now = new Date();
  userDoc.lastCheckinTime = now;
  userDoc.nextDeadline = new Date(Date.now() + userDoc.timerIntervalMinutes * 60 * 1000);
  userDoc.lastKnownLocation = { lat: location.lat, lng: location.lng, updatedAt: now };
  userDoc.currentStatus = 'SAFE';
  await userDoc.save();

  await CheckInHistory.create({
    userId: id,
    checkinTime: now,
    locationAtCheckin: { lat: location.lat, lng: location.lng },
    isSystemAutoTriggered: false,
  });

  await createInteractionEvent({
    userId: id,
    type: 'CHECKIN_TAP_OK',
    source: 'MOBILE_APP',
    metadata: { location },
  });
  await createAlertEvent({
    userId: id,
    level: 'INFO',
    status: 'CHECKIN_OK',
    source: 'USER',
    title: 'Check-in thanh cong',
    message: 'Nguoi dung da xac nhan an toan',
    metadata: { location },
  });

  return res.json({ message: 'Check-in successful', user: mapUserDoc(userDoc) });
}

async function updateTimer(req, res) {
  const { id } = req.params;
  const { timerIntervalMinutes } = req.body;
  const interval = Number(timerIntervalMinutes);

  if (!interval || interval < 30) {
    return res.status(400).json({ message: 'timerIntervalMinutes must be >= 30' });
  }

  const userDoc = await ensureUserById(id);
  if (!userDoc) {
    return res.status(404).json({ message: 'User not found' });
  }

  userDoc.timerIntervalMinutes = interval;
  userDoc.nextDeadline = new Date(Date.now() + interval * 60 * 1000);
  await userDoc.save();

  await createAlertEvent({
    userId: id,
    level: 'INFO',
    status: 'TIMER_UPDATED',
    source: 'SYSTEM',
    title: 'Cap nhat chu ky check-in',
    message: `Chu ky moi: ${interval} phut`,
    metadata: { timerIntervalMinutes: interval },
  });

  return res.json({ message: 'Timer updated', user: mapUserDoc(userDoc) });
}

async function updateLocation(req, res) {
  const { id } = req.params;
  const { location } = req.body;

  if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
    return res.status(400).json({ message: 'location.lat and location.lng are required numbers' });
  }

  const userDoc = await ensureUserById(id);
  if (!userDoc) {
    return res.status(404).json({ message: 'User not found' });
  }

  userDoc.lastKnownLocation = { lat: location.lat, lng: location.lng, updatedAt: new Date() };
  await userDoc.save();

  return res.json({ message: 'Location updated', user: mapUserDoc(userDoc) });
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

  const userDoc = await ensureUserById(id);
  if (!userDoc) {
    return res.status(404).json({ message: 'User not found' });
  }

  userDoc.quietHoursStart = quietHoursStart;
  userDoc.quietHoursEnd = quietHoursEnd;
  userDoc.falseAlertGraceMinutes = grace;
  await userDoc.save();

  await createAlertEvent({
    userId: id,
    level: 'INFO',
    status: 'PREFERENCES_UPDATED',
    source: 'USER',
    title: 'Cap nhat quiet hours',
    message: `Quiet hours ${quietHoursStart} - ${quietHoursEnd}, grace ${grace} phut`,
    metadata: { quietHoursStart, quietHoursEnd, falseAlertGraceMinutes: grace },
  });

  return res.json({ message: 'Preferences updated', user: mapUserDoc(userDoc) });
}

async function setSleepMode(req, res) {
  const { id } = req.params;
  const { minutes } = req.body;
  const duration = Number(minutes);

  if (Number.isNaN(duration) || duration < 0 || duration > 1440) {
    return res.status(400).json({ message: 'minutes must be between 0 and 1440' });
  }

  const userDoc = await ensureUserById(id);
  if (!userDoc) {
    return res.status(404).json({ message: 'User not found' });
  }

  userDoc.sleepModeUntil = duration === 0 ? null : new Date(Date.now() + duration * 60 * 1000);
  await userDoc.save();

  await createAlertEvent({
    userId: id,
    level: 'INFO',
    status: duration === 0 ? 'SLEEP_MODE_OFF' : 'SLEEP_MODE_ON',
    source: 'USER',
    title: duration === 0 ? 'Tat sleep mode' : 'Bat sleep mode',
    message: duration === 0 ? 'Da tat che do tam dung canh bao' : `Tam dung canh bao trong ${duration} phut`,
    metadata: { minutes: duration, sleepModeUntil: toIso(userDoc.sleepModeUntil) },
  });

  return res.json({ message: 'Sleep mode updated', user: mapUserDoc(userDoc) });
}

async function listUsers(_req, res) {
  const users = await User.find().sort({ createdAt: -1 });
  return res.json(users.map(mapUserDoc));
}

async function getUserById(req, res) {
  const { id } = req.params;
  const userDoc = await ensureUserById(id);
  if (!userDoc) {
    return res.status(404).json({ message: 'User not found' });
  }
  return res.json(mapUserDoc(userDoc));
}

async function getAlertPolicy(req, res) {
  const { id } = req.params;
  const userDoc = await ensureUserById(id);
  if (!userDoc) {
    return res.status(404).json({ message: 'User not found' });
  }
  return res.json(await ensureAlertPolicy(id));
}

async function updateAlertPolicyByUser(req, res) {
  const { id } = req.params;
  const userDoc = await ensureUserById(id);
  if (!userDoc) {
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

  const policy = await updateAlertPolicy(id, {
    level1Minutes,
    level2Minutes,
    level3Minutes,
    level4Enabled,
  });

  await createAlertEvent({
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
  const userDoc = await ensureUserById(id);
  if (!userDoc) {
    return res.status(404).json({ message: 'User not found' });
  }

  const events = await listInteractionEvents(id, req.query.limit);
  return res.json(events);
}

async function createUserInteraction(req, res) {
  const { id } = req.params;
  const userDoc = await ensureUserById(id);
  if (!userDoc) {
    return res.status(404).json({ message: 'User not found' });
  }

  const { type, source, metadata } = req.body;
  if (!type || !source) {
    return res.status(400).json({ message: 'type and source are required' });
  }

  await createInteractionEvent({
    userId: id,
    type,
    source,
    metadata: metadata || {},
  });

  return res.status(201).json({ message: 'Interaction event recorded' });
}

async function listGuardians(req, res) {
  const { id } = req.params;
  const userDoc = await ensureUserById(id);
  if (!userDoc) {
    return res.status(404).json({ message: 'User not found' });
  }

  return res.json(mapUserDoc(userDoc).emergencyContacts || []);
}

async function createGuardian(req, res) {
  const { id } = req.params;
  const userDoc = await ensureUserById(id);
  if (!userDoc) {
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

  const contacts = normalizeContacts(userDoc.emergencyContacts);
  if (contacts.some((item) => item.phone === guardian.phone)) {
    return res.status(409).json({ message: 'Guardian phone already exists' });
  }
  if (contacts.length >= 3) {
    return res.status(400).json({ message: 'Maximum 3 guardians allowed' });
  }

  userDoc.emergencyContacts = [...contacts, guardian];
  await userDoc.save();

  await createAlertEvent({
    userId: id,
    level: 'INFO',
    status: 'GUARDIAN_ADDED',
    source: 'USER',
    title: 'Them Guardian',
    message: `${guardian.name} da duoc them vao mang bao ho`,
    metadata: guardian,
  });

  return res.status(201).json(normalizeContacts(userDoc.emergencyContacts));
}

async function deleteGuardian(req, res) {
  const { id, phone } = req.params;
  const userDoc = await ensureUserById(id);
  if (!userDoc) {
    return res.status(404).json({ message: 'User not found' });
  }

  const targetPhone = decodeURIComponent(phone);
  const contacts = normalizeContacts(userDoc.emergencyContacts);
  const nextContacts = contacts.filter((item) => item.phone !== targetPhone);
  if (nextContacts.length === contacts.length) {
    return res.status(404).json({ message: 'Guardian not found' });
  }

  userDoc.emergencyContacts = nextContacts;
  await userDoc.save();

  await createAlertEvent({
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
  const userDoc = await ensureUserById(id);
  if (!userDoc) {
    return res.status(404).json({ message: 'User not found' });
  }
  return res.json(await ensureMedicalProfile(id, {
    fullName: userDoc.fullName,
    emergencyPhone: normalizeContacts(userDoc.emergencyContacts)[0]?.phone || '',
  }));
}

async function updateMedicalProfile(req, res) {
  const { id } = req.params;
  const userDoc = await ensureUserById(id);
  if (!userDoc) {
    return res.status(404).json({ message: 'User not found' });
  }

  const profile = await MedicalProfile.findOneAndUpdate(
    { userId: id },
    {
      userId: id,
      fullName: String(req.body.fullName || '').trim(),
      birthYear: String(req.body.birthYear || '').trim(),
      bloodType: String(req.body.bloodType || 'O+').trim() || 'O+',
      allergies: String(req.body.allergies || '').trim(),
      conditions: String(req.body.conditions || '').trim(),
      medications: String(req.body.medications || '').trim(),
      emergencyPhone: String(req.body.emergencyPhone || '').trim(),
      insuranceProvider: String(req.body.insuranceProvider || '').trim(),
      insuranceNumber: String(req.body.insuranceNumber || '').trim(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await createAlertEvent({
    userId: id,
    level: 'INFO',
    status: 'MEDICAL_PROFILE_UPDATED',
    source: 'USER',
    title: 'Cap nhat ho so y te',
    message: 'Medical profile da duoc dong bo len backend',
    metadata: { bloodType: req.body.bloodType || 'O+' },
  });

  return res.json(mapMedicalProfileDoc(profile));
}

async function getAutomationSettings(req, res) {
  const { id } = req.params;
  const userDoc = await ensureUserById(id);
  if (!userDoc) {
    return res.status(404).json({ message: 'User not found' });
  }
  return res.json(await ensureAutomationSettings(id));
}

async function updateAutomationSettings(req, res) {
  const { id } = req.params;
  const userDoc = await ensureUserById(id);
  if (!userDoc) {
    return res.status(404).json({ message: 'User not found' });
  }

  const current = await ensureAutomationSettings(id);
  const dailyReminderTime = String(req.body.dailyReminderTime || current.dailyReminderTime).trim();
  const pillTime = String(req.body.pillTime || current.pillTime).trim();
  if (!isValidHourMinute(dailyReminderTime) || !isValidHourMinute(pillTime)) {
    return res.status(400).json({ message: 'dailyReminderTime and pillTime must be HH:mm' });
  }

  const shakeSos = req.body.shakeSos ?? current.shakeSos;
  const fallDetection = req.body.fallDetection ?? current.fallDetection;
  const geofenceAutoCheckin = req.body.geofenceAutoCheckin ?? current.geofenceAutoCheckin;
  const pillReminder = req.body.pillReminder ?? current.pillReminder;
  const settings = await AutomationSetting.findOneAndUpdate(
    { userId: id },
    {
      userId: id,
      dailyReminderTime,
      shakeSos: Boolean(shakeSos),
      shakeSensitivity: Number(req.body.shakeSensitivity ?? current.shakeSensitivity) || 3,
      fallDetection: Boolean(fallDetection),
      geofenceAutoCheckin: Boolean(geofenceAutoCheckin),
      pillReminder: Boolean(pillReminder),
      pillTime,
      homeLocation: req.body.homeLocation ?? current.homeLocation,
      lastGeofenceEventAt: current.lastGeofenceEventAt,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await createAlertEvent({
    userId: id,
    level: 'INFO',
    status: 'AUTOMATION_UPDATED',
    source: 'USER',
    title: 'Cap nhat tu dong hoa',
    message: 'Cac quy tac daily reminder, geofence va sensor da duoc cap nhat',
    metadata: {
      dailyReminderTime,
      pillTime,
      geofenceAutoCheckin: Boolean(geofenceAutoCheckin),
      fallDetection: Boolean(fallDetection),
      shakeSos: Boolean(shakeSos),
    },
  });

  return res.json(mapAutomationSettingDoc(settings));
}

async function getSecuritySettings(req, res) {
  const { id } = req.params;
  const userDoc = await ensureUserById(id);
  if (!userDoc) {
    return res.status(404).json({ message: 'User not found' });
  }
  return res.json(await ensureSecuritySettings(id));
}

async function updateSecuritySettings(req, res) {
  const { id } = req.params;
  const userDoc = await ensureUserById(id);
  if (!userDoc) {
    return res.status(404).json({ message: 'User not found' });
  }

  const current = await ensureSecuritySettings(id);
  const autoWipeDays = Number(req.body.autoWipeDays ?? current.autoWipeDays);
  const stealthMode = req.body.stealthMode ?? current.stealthMode;
  const encryptionEnabled = req.body.encryptionEnabled ?? current.encryptionEnabled;
  if (Number.isNaN(autoWipeDays) || autoWipeDays < 0 || autoWipeDays > 60) {
    return res.status(400).json({ message: 'autoWipeDays must be between 0 and 60' });
  }

  const settings = await SecuritySetting.findOneAndUpdate(
    { userId: id },
    {
      userId: id,
      stealthMode: Boolean(stealthMode),
      autoWipeDays,
      encryptionEnabled: Boolean(encryptionEnabled),
      lastAutoWipeDueAt: current.lastAutoWipeDueAt,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await createAlertEvent({
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

  return res.json(mapSecuritySettingDoc(settings));
}

async function listDeviceSignals(req, res) {
  const { id } = req.params;
  const userDoc = await ensureUserById(id);
  if (!userDoc) {
    return res.status(404).json({ message: 'User not found' });
  }
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const docs = await DeviceSignal.find({ userId: id }).sort({ createdAt: -1 }).limit(limit);
  return res.json(docs.map(mapDeviceSignalDoc));
}

async function createDeviceSignal(req, res) {
  const { id } = req.params;
  const userDoc = await ensureUserById(id);
  if (!userDoc) {
    return res.status(404).json({ message: 'User not found' });
  }

  const signalType = String(req.body.signalType || '').trim();
  const payload = req.body.payload || {};
  if (!signalType) {
    return res.status(400).json({ message: 'signalType is required' });
  }

  await DeviceSignal.create({
    userId: id,
    signalType,
    payload,
  });

  await createInteractionEvent({
    userId: id,
    type: signalType,
    source: 'DEVICE_SIGNAL',
    metadata: payload,
  });

  const automation = await ensureAutomationSettings(id);
  let action = 'RECORDED';

  if (signalType === 'GEOFENCE_HOME_ARRIVAL' && automation.geofenceAutoCheckin) {
    const lat = Number(payload.lat);
    const lng = Number(payload.lng);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      const now = new Date();
      userDoc.lastCheckinTime = now;
      userDoc.nextDeadline = new Date(
        Date.now() + (userDoc.timerIntervalMinutes || 720) * 60 * 1000,
      );
      userDoc.lastKnownLocation = { lat, lng, updatedAt: now };
      userDoc.currentStatus = 'SAFE';
      await userDoc.save();

      await CheckInHistory.create({
        userId: id,
        checkinTime: now,
        locationAtCheckin: { lat, lng },
        isSystemAutoTriggered: true,
      });

      await AutomationSetting.findOneAndUpdate(
        { userId: id },
        { lastGeofenceEventAt: now },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      await createAlertEvent({
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
    await triggerSosForUser(io, mapUserDoc(userDoc));
    await createAlertEvent({
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
