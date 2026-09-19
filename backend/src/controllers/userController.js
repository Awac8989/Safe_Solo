const User = require('../models/User');
const CheckInHistory = require('../models/CheckInHistory');
const AlertEvent = require('../models/AlertEvent');
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
const {
  buildEncryptedMedicalUpdate,
} = require('../lib/medicalProfileCodec');
const {
  buildEncryptedUserSensitiveUpdate,
  decryptUserSensitivePayload,
} = require('../lib/userSensitiveCodec');
const {
  registerPushToken: registerFcmPushToken,
  removePushToken: removeFcmPushToken,
} = require('../services/fcmService');

function isValidHourMinute(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

async function ensureUserById(userId) {
  if (!userId) return null;
  let user = await User.findById(userId);
  if (!user) {
    const now = new Date();
    try {
      user = await User.create({
        _id: userId,
        fullName: 'Đoàn Minh Quân',
        phoneNumber: '0901111004',
        email: 'hiepsi.safesolo@gmail.com',
        role: 'user',
        timerIntervalMinutes: 720,
        lastCheckinTime: now,
        nextDeadline: new Date(now.getTime() + 720 * 60 * 1000),
        currentStatus: 'SAFE',
        isKycVerified: true,
        authProvider: userId.startsWith('google_') ? 'google' : 'phone',
        emergencyContacts: [
          {
            name: 'Mẹ Lan',
            phone: '0901112222',
            relation: 'Người thân',
            priority: 1,
          },
        ],
      });
    } catch (_) {
      user = await User.findById(userId);
    }
  }
  if (user && (!user.emergencyContacts || user.emergencyContacts.length === 0)) {
    user.emergencyContacts = [
      {
        name: 'Mẹ Lan',
        phone: '0901112222',
        relation: 'Người thân',
        priority: 1,
      },
    ];
    try {
      await user.save();
    } catch (_) {}
  }
  return user;
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

function normalizePeriod(period) {
  const value = String(period || 'month').toLowerCase();
  return ['day', 'week', 'month'].includes(value) ? value : 'month';
}

function buildPeriodRange(period) {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);
  if (period === 'day') {
    start.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  }
  return { start, end };
}

function formatBucketLabel(date, period) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  if (period === 'day') {
    return `${String(date.getHours()).padStart(2, '0')}:00`;
  }
  if (period === 'week') {
    return `${day}/${month}`;
  }
  return `${day}/${month}`;
}

function bucketKey(date, period) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  if (period === 'day') {
    const hour = String(date.getHours()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}`;
  }
  return `${year}-${month}-${day}`;
}

function moodKeyFromMetadata(metadata = {}) {
  const value = String(metadata.mood || metadata.moodLabel || metadata.mood_key || '').toLowerCase();
  if (['calm', 'safe', 'binh an', 'bình an'].includes(value)) {
    return 'calm';
  }
  if (['happy', 'positive', 'tich cuc', 'tích cực'].includes(value)) {
    return 'happy';
  }
  if (['tired', 'fatigued', 'hoi met', 'hơi mệt'].includes(value)) {
    return 'tired';
  }
  if (['sick', 'ill', 'can luu y', 'cần lưu ý'].includes(value)) {
    return 'sick';
  }
  if (['focused', 'dang tap trung', 'đang tập trung'].includes(value)) {
    return 'focused';
  }
  return 'calm';
}

async function getHealthReport(req, res) {
  const { id } = req.params;
  const period = normalizePeriod(req.query.period);
  const { start, end } = buildPeriodRange(period);

  const userDoc = await ensureUserById(id);
  if (!userDoc) {
    return res.status(404).json({ message: 'User not found' });
  }

  const [checkins, alerts, interactions] = await Promise.all([
    CheckInHistory.find({
      userId: id,
      checkinTime: { $gte: start, $lte: end },
    }).sort({ checkinTime: 1 }).lean(),
    AlertEvent.find({
      userId: id,
      createdAt: { $gte: start, $lte: end },
    }).sort({ createdAt: 1 }).lean(),
    listInteractionEvents(id, 500),
  ]);

  const filteredInteractions = interactions.filter((item) => {
    const createdAt = item.createdAt ? new Date(item.createdAt) : null;
    return createdAt && createdAt >= start && createdAt <= end;
  });

  const seriesMap = new Map();
  const ensureBucket = (date) => {
    const key = bucketKey(date, period);
    if (!seriesMap.has(key)) {
      seriesMap.set(key, {
        key,
        label: formatBucketLabel(date, period),
        checkIns: 0,
        autoCheckIns: 0,
        alertCount: 0,
        sosCount: 0,
        moodCounts: {
          calm: 0,
          happy: 0,
          tired: 0,
          sick: 0,
          focused: 0,
        },
      });
    }
    return seriesMap.get(key);
  };

  const moodCounts = {
    calm: 0,
    happy: 0,
    tired: 0,
    sick: 0,
    focused: 0,
  };
  let totalCheckIns = 0;
  let autoCheckIns = 0;

  checkins.forEach((item) => {
    const createdAt = new Date(item.checkinTime || item.createdAt || Date.now());
    const bucket = ensureBucket(createdAt);
    bucket.checkIns += 1;
    totalCheckIns += 1;
    if (item.isSystemAutoTriggered) {
      bucket.autoCheckIns += 1;
      autoCheckIns += 1;
    }
  });

  alerts.forEach((item) => {
    const createdAt = new Date(item.createdAt || Date.now());
    const bucket = ensureBucket(createdAt);
    bucket.alertCount += 1;
    const status = String(item.status || '').toUpperCase();
    const level = String(item.level || '').toUpperCase();
    if (status.includes('SOS') || level === 'SOS') {
      bucket.sosCount += 1;
    }
  });

  filteredInteractions.forEach((item) => {
    const createdAt = new Date(item.createdAt || Date.now());
    const bucket = ensureBucket(createdAt);
    const mood = moodKeyFromMetadata(item.metadata || {});
    moodCounts[mood] += 1;
    bucket.moodCounts[mood] += 1;
  });

  const overdueCount = alerts.filter((item) =>
    new Set([
      'REMINDER_SENT',
      'WARNING_TRIGGERED',
      'RESCUE_CALL_QUEUED',
      'DEADMAN_LEVEL_1',
      'DEADMAN_LEVEL_2',
      'DEADMAN_LEVEL_3',
      'CHECKIN_OVERDUE',
    ]).has(String(item.status || '').toUpperCase()),
  ).length;

  const sosCount = alerts.filter((item) => {
    const status = String(item.status || '').toUpperCase();
    const level = String(item.level || '').toUpperCase();
    return status.includes('SOS') || status === 'SILENT_DURESS' || level === 'SOS';
  }).length;

  const recentCheckins = checkins.slice(-10).reverse().map((item) => ({
    id: item._id,
    checkinTime: toIso(item.checkinTime || item.createdAt),
    createdAt: toIso(item.createdAt || item.checkinTime),
    locationAtCheckin: item.locationAtCheckin || null,
    isSystemAutoTriggered: Boolean(item.isSystemAutoTriggered),
  }));

  const recentAlerts = alerts.slice(-10).reverse().map((item) => ({
    id: item._id,
    level: item.level,
    status: item.status,
    title: item.title,
    message: item.message,
    createdAt: toIso(item.createdAt),
  }));

  const dailySeries = [...seriesMap.values()].sort((a, b) => a.key.localeCompare(b.key));

  return res.json({
    period,
    range: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
    summary: {
      totalCheckIns,
      autoCheckIns,
      overdueCount,
      sosCount,
      moodCounts,
    },
    dailySeries,
    recentCheckins,
    recentAlerts,
  });
}

async function ensureMedicalProfile(userId, fallback = {}) {
  let profile = await MedicalProfile.findOne({ userId });
  if (!profile) {
    profile = await MedicalProfile.create({
      userId,
      ...buildEncryptedMedicalUpdate(userId, {
        fullName: fallback.fullName || '',
        birthYear: '',
        bloodType: 'O+',
        allergies: '',
        conditions: '',
        medications: '',
        emergencyPhone: fallback.emergencyPhone || '',
        insuranceProvider: '',
        insuranceNumber: '',
      }),
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
    ...buildEncryptedUserSensitiveUpdate(phoneNumber.trim(), {
      medicalNotes: medicalNotes || '',
      emergencyContacts: Array.isArray(emergencyContacts) ? emergencyContacts : [],
      approxAddress: null,
    }),
  });

  Object.assign(
    userDoc,
    buildEncryptedUserSensitiveUpdate(userDoc._id, {
      medicalNotes: medicalNotes || '',
      emergencyContacts: Array.isArray(emergencyContacts) ? emergencyContacts : [],
      approxAddress: null,
    }),
  );
  await userDoc.save();

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
  try {
    const { id } = req.params;
    const {
      location,
      type = 'HARD_TAP',
      passiveSource,
      isDuress = false,
      snoozeMinutes = 30,
      routineType,
      mediaSnapshot,
      familyPingRef,
      metadata = {},
    } = req.body;

    const userDoc = await ensureUserById(id);
    if (!userDoc) {
      return res.status(404).json({ message: 'User not found' });
    }

    const now = new Date();
    const normalizedType = String(type || 'HARD_TAP').toUpperCase();
    const isDuressCheckin = Boolean(isDuress || normalizedType === 'DURESS_FAKE');

    const validRoutineTypes = [
      'MEDICINE',
      'MEDICATION',
      'WALK',
      'MORNING_WALK',
      'READ',
      'SLEEP',
      'BLOOD_PRESSURE',
      'CUSTOM',
      'NONE',
    ];
    const normalizedRoutineType = routineType && validRoutineTypes.includes(String(routineType).toUpperCase())
      ? String(routineType).toUpperCase()
      : (routineType ? 'CUSTOM' : 'NONE');

    const validPassiveSources = [
      'SCREEN_UNLOCK',
      'CHARGER_PLUGGED',
      'CHARGER_UNPLUGGED',
      'PEDOMETER_BURST',
      'GEOFENCE_ENTER',
      'SAFE_GEOFENCE',
      'HOME_WIFI',
      'DEVICE_ACTIVITY',
      'NONE',
    ];
    const normalizedPassiveSource = passiveSource && validPassiveSources.includes(String(passiveSource).toUpperCase())
      ? String(passiveSource).toUpperCase()
      : (passiveSource ? 'DEVICE_ACTIVITY' : 'NONE');

    // Determine location snapshot
    let checkinLocation = null;
    if (location && typeof location.lat === 'number' && typeof location.lng === 'number') {
      checkinLocation = { lat: location.lat, lng: location.lng, updatedAt: now };
      userDoc.lastKnownLocation = checkinLocation;
    } else if (userDoc.lastKnownLocation && typeof userDoc.lastKnownLocation.lat === 'number') {
      checkinLocation = {
        lat: userDoc.lastKnownLocation.lat,
        lng: userDoc.lastKnownLocation.lng,
        updatedAt: userDoc.lastKnownLocation.updatedAt || now,
      };
    }

    // Branch 1: DURESS CHECK-IN (Coercion / Secret Trigger)
    if (isDuressCheckin) {
      await CheckInHistory.create({
        userId: id,
        checkinTime: now,
        locationAtCheckin: checkinLocation,
        type: 'DURESS_FAKE',
        isDuress: true,
        isSystemAutoTriggered: false,
        metadata: {
          ...metadata,
          reason: 'Coerced check-in trigger',
          deceptionActive: true,
        },
      });

      await createInteractionEvent({
        userId: id,
        type: 'CHECKIN_DURESS',
        source: 'MOBILE_APP',
        metadata: { location: checkinLocation, isDuress: true },
      });

      await createAlertEvent({
        userId: id,
        level: 'CRITICAL',
        status: 'EMERGENCY_TRIGGERED',
        source: 'USER',
        title: 'CANH BAO CUONG EP (Duress Check-in)',
        message: 'Nguoi dung kich hoat check-in ngam duoi su uy hiep / cuong ep!',
        metadata: { location: checkinLocation, isDuress: true },
      });

      const io = getIo();
      triggerSosForUser(io, mapUserDoc(userDoc)).catch((err) => {
        console.error('[Duress] Failed to trigger silent SOS:', err);
      });

      if (io) {
        io.emit('emergency:duress', {
          userId: id,
          user: mapUserDoc(userDoc),
          location: checkinLocation,
          timestamp: now.toISOString(),
          message: 'Silent Duress SOS Triggered by secret gesture/PIN',
        });
      }

      return res.status(200).json({
        message: 'Check-in successful',
        user: mapUserDoc(userDoc),
        duressActivated: true,
      });
    }

    // Branch 2: SNOOZE (Extend timer 15-120m)
    if (normalizedType === 'SNOOZE') {
      const currentSnoozes = userDoc.snoozeCountToday || 0;
      if (currentSnoozes >= 3) {
        return res.status(400).json({
          message: 'Da dat gioi han hoan diem danh hom nay (toi da 3 lan). Vui long xac nhan diem danh an toan.',
          maxSnoozesReached: true,
        });
      }

      const snoozeMins = Math.min(Math.max(Number(snoozeMinutes || 30), 15), 120);
      const newDeadline = new Date(Date.now() + snoozeMins * 60 * 1000);

      userDoc.snoozeCountToday = currentSnoozes + 1;
      userDoc.nextDeadline = newDeadline;
      userDoc.currentStatus = 'SAFE';
      await userDoc.save();

      await CheckInHistory.create({
        userId: id,
        checkinTime: now,
        locationAtCheckin: checkinLocation,
        type: 'SNOOZE',
        snoozeMinutes: snoozeMins,
        isSystemAutoTriggered: false,
        metadata,
      });

      await createInteractionEvent({
        userId: id,
        type: 'CHECKIN_SNOOZE',
        source: 'MOBILE_APP',
        metadata: { snoozeMinutes: snoozeMins, newDeadline },
      });

      await createAlertEvent({
        userId: id,
        level: 'INFO',
        status: 'CHECKIN_OK',
        source: 'USER',
        title: 'Hoan diem danh thanh cong',
        message: `Nguoi dung hoan diem danh them ${snoozeMins} phut`,
        metadata: { snoozeMinutes: snoozeMins, newDeadline },
      });

      return res.status(200).json({
        message: `Da hoan diem danh them ${snoozeMins} phut`,
        user: mapUserDoc(userDoc),
        snoozeMinutes: snoozeMins,
        snoozeCountToday: userDoc.snoozeCountToday,
      });
    }

    // Branch 3: SOFT_PASSIVE (Zero-touch: screen unlock, pedometer, charger, safe home geofence)
    if (normalizedType === 'SOFT_PASSIVE') {
      const maxSoft = userDoc.maxSoftCheckinAllowed || 3;
      const currentConsecutive = userDoc.consecutiveSoftCheckins || 0;

      if (currentConsecutive >= maxSoft) {
        return res.status(200).json({
          message: 'Da dat gioi han diem danh thu dong lien tiep. Can mo ung dung bam xac nhan an toan truc tiep.',
          requireHardCheckin: true,
          consecutiveSoftCheckins: currentConsecutive,
          user: mapUserDoc(userDoc),
        });
      }

      const extensionMins = userDoc.softExtensionMinutes || 45;
      const extensionMs = extensionMins * 60 * 1000;
      const currentDeadlineMs = userDoc.nextDeadline ? userDoc.nextDeadline.getTime() : Date.now();
      const newDeadline = new Date(Math.max(currentDeadlineMs, Date.now() + extensionMs));

      userDoc.consecutiveSoftCheckins = currentConsecutive + 1;
      userDoc.lastCheckinTime = now;
      userDoc.nextDeadline = newDeadline;
      userDoc.currentStatus = 'SAFE';
      await userDoc.save();

      await CheckInHistory.create({
        userId: id,
        checkinTime: now,
        locationAtCheckin: checkinLocation,
        type: 'SOFT_PASSIVE',
        passiveSource: normalizedPassiveSource,
        isSystemAutoTriggered: true,
        metadata,
      });

      await createInteractionEvent({
        userId: id,
        type: 'CHECKIN_PASSIVE_AUTO',
        source: 'DEVICE_SENSOR',
        metadata: { passiveSource: normalizedPassiveSource, consecutive: userDoc.consecutiveSoftCheckins },
      });

      return res.status(200).json({
        message: 'Diem danh thu dong thanh cong',
        user: mapUserDoc(userDoc),
        requireHardCheckin: false,
        consecutiveSoftCheckins: userDoc.consecutiveSoftCheckins,
        remainingSoftAllowed: maxSoft - userDoc.consecutiveSoftCheckins,
      });
    }

    // Branch 4: HARD_TAP / EMOTIONAL_MOMENT / ROUTINE / FAMILY_PING_REPLY
    userDoc.consecutiveSoftCheckins = 0; // Reset soft check-in counter
    userDoc.snoozeCountToday = 0; // Reset snooze count
    userDoc.lastCheckinTime = now;
    userDoc.nextDeadline = new Date(Date.now() + userDoc.timerIntervalMinutes * 60 * 1000);
    userDoc.currentStatus = 'SAFE';

    // If responding to a pending family ping
    if (familyPingRef && Array.isArray(userDoc.pendingFamilyPings)) {
      const pingIndex = userDoc.pendingFamilyPings.findIndex(
        (p) => String(p._id) === String(familyPingRef) || String(p.id) === String(familyPingRef)
      );
      if (pingIndex >= 0) {
        userDoc.pendingFamilyPings[pingIndex].status = 'ANSWERED';
      }
    }

    await userDoc.save();

    await CheckInHistory.create({
      userId: id,
      checkinTime: now,
      locationAtCheckin: checkinLocation,
      type: normalizedType,
      routineType: normalizedRoutineType,
      mediaSnapshot: mediaSnapshot || null,
      familyPingRef: familyPingRef || null,
      isSystemAutoTriggered: false,
      metadata,
    });

    await createInteractionEvent({
      userId: id,
      type: normalizedType === 'EMOTIONAL_MOMENT' ? 'CHECKIN_EMOTIONAL' : 'CHECKIN_TAP_OK',
      source: 'MOBILE_APP',
      metadata: { location: checkinLocation, type: normalizedType, routineType: normalizedRoutineType },
    });

    await createAlertEvent({
      userId: id,
      level: 'INFO',
      status: 'CHECKIN_OK',
      source: 'USER',
      title: normalizedType === 'EMOTIONAL_MOMENT' ? 'Diem danh khoanh khac gia dinh' : 'Check-in thanh cong',
      message: normalizedType === 'EMOTIONAL_MOMENT'
        ? 'Nguoi dung gui khoanh khac check-in kem anh / loi nhan'
        : 'Nguoi dung da xac nhan an toan',
      metadata: { location: checkinLocation, type: normalizedType },
    });

    return res.json({ message: 'Check-in successful', user: mapUserDoc(userDoc) });
  } catch (err) {
    console.error('[UserController.checkin] error:', err);
    return res.status(500).json({ message: 'Loi may chu: ' + err.message });
  }
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

  const contacts = decryptUserSensitivePayload(userDoc).emergencyContacts;
  if (contacts.some((item) => item.phone === guardian.phone)) {
    return res.status(409).json({ message: 'Guardian phone already exists' });
  }
  if (contacts.length >= 3) {
    return res.status(400).json({ message: 'Maximum 3 guardians allowed' });
  }

  const sensitive = decryptUserSensitivePayload(userDoc);
  Object.assign(
    userDoc,
    buildEncryptedUserSensitiveUpdate(id, {
      ...sensitive,
      emergencyContacts: [...contacts, guardian],
    }),
  );
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

  return res.status(201).json(normalizeContacts(decryptUserSensitivePayload(userDoc).emergencyContacts));
}

async function deleteGuardian(req, res) {
  const { id, phone } = req.params;
  const userDoc = await ensureUserById(id);
  if (!userDoc) {
    return res.status(404).json({ message: 'User not found' });
  }

  const targetPhone = decodeURIComponent(phone);
  const contacts = decryptUserSensitivePayload(userDoc).emergencyContacts;
  const nextContacts = contacts.filter((item) => item.phone !== targetPhone);
  if (nextContacts.length === contacts.length) {
    return res.status(404).json({ message: 'Guardian not found' });
  }

  const sensitive = decryptUserSensitivePayload(userDoc);
  Object.assign(
    userDoc,
    buildEncryptedUserSensitiveUpdate(id, {
      ...sensitive,
      emergencyContacts: nextContacts,
    }),
  );
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
    emergencyPhone: decryptUserSensitivePayload(userDoc).emergencyContacts[0]?.phone || '',
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
      ...buildEncryptedMedicalUpdate(id, {
        fullName: String(req.body.fullName || '').trim(),
        birthYear: String(req.body.birthYear || '').trim(),
        bloodType: String(req.body.bloodType || 'O+').trim() || 'O+',
        allergies: String(req.body.allergies || '').trim(),
        conditions: String(req.body.conditions || '').trim(),
        medications: String(req.body.medications || '').trim(),
        emergencyPhone: String(req.body.emergencyPhone || '').trim(),
        insuranceProvider: String(req.body.insuranceProvider || '').trim(),
        insuranceNumber: String(req.body.insuranceNumber || '').trim(),
      }),
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

  let io = null;
  try {
    io = getIo();
  } catch (_) {
    io = { emit() {} };
  }

  // Real-time broadcast to Web Admin Dispatch and Knights
  io.emit('DEVICE_SIGNAL_UPDATE', {
    userId: id,
    userName: userDoc.name,
    signalType,
    payload,
    timestamp: new Date(),
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
    (signalType === 'WATCH_FALL_DETECTED') ||
    (signalType === 'WATCH_EMERGENCY_SOS') ||
    (signalType === 'WATCH_CRITICAL_SPO2') ||
    (signalType === 'SHAKE_SOS' && automation.shakeSos)
  ) {
    await triggerSosForUser(io, mapUserDoc(userDoc));
    await createAlertEvent({
      userId: id,
      level: (signalType === 'WATCH_EMERGENCY_SOS' || signalType === 'SHAKE_SOS')
        ? 'LEVEL_3_SOS'
        : 'LEVEL_2_ALARM',
      status: signalType,
      source: signalType.startsWith('WATCH_') ? 'SAMSUNG_GALAXY_WATCH_5' : 'DEVICE_SIGNAL',
      title: signalType === 'WATCH_FALL_DETECTED'
        ? 'Samsung Watch 5: Phat hien te nga'
        : signalType === 'WATCH_CRITICAL_SPO2'
        ? 'Samsung Watch 5: SpO2 tut nguy cap'
        : signalType === 'WATCH_EMERGENCY_SOS'
        ? 'Samsung Watch 5: SOS Khan cap'
        : (signalType === 'FALL_DETECTED' ? 'Phat hien te nga' : 'Lac may tao SOS'),
      message: signalType.startsWith('WATCH_')
        ? `Tin hieu tu Samsung Galaxy Watch 5 (BioActive). SpO2: ${payload.spO2 ?? 'N/A'}%, Tim: ${payload.heartRate ?? 'N/A'} BPM`
        : (signalType === 'FALL_DETECTED'
          ? 'Backend da nhan te nga va kich hoat chuoi cuu ho'
          : 'Backend da nhan lac may va kich hoat SOS'),
      metadata: payload,
    });
    action = 'SOS_TRIGGERED';
  }

  return res.status(201).json({ message: 'Device signal recorded', action });
}

async function registerPushToken(req, res) {
  const { id } = req.params;
  const value = String(req.body?.pushToken || req.body?.token || '').trim();

  if (!value) {
    return res.status(400).json({ message: 'pushToken is required' });
  }

  const userDoc = await ensureUserById(id);
  if (!userDoc) {
    return res.status(404).json({ message: 'User not found' });
  }

  await registerFcmPushToken(id, value);
  return res.status(200).json({ message: 'Push token registered' });
}

async function deletePushToken(req, res) {
  const { id, token } = req.params;

  const userDoc = await ensureUserById(id);
  if (!userDoc) {
    return res.status(404).json({ message: 'User not found' });
  }

  await removeFcmPushToken(id, token);
  return res.status(200).json({ message: 'Push token removed' });
}

async function sendFamilyPing(req, res) {
  const { id } = req.params;
  const { fromName, fromPhone, message } = req.body;

  const targetUser = await ensureUserById(id);
  if (!targetUser) {
    return res.status(404).json({ message: 'User not found' });
  }

  const pingItem = {
    fromName: String(fromName || 'Nguoi than').trim(),
    fromPhone: String(fromPhone || '').trim(),
    message: String(message || 'Gui cai om am ap! Ban van khoe chu?').trim(),
    requestedAt: new Date(),
    status: 'PENDING',
  };

  if (!Array.isArray(targetUser.pendingFamilyPings)) {
    targetUser.pendingFamilyPings = [];
  }
  targetUser.pendingFamilyPings.push(pingItem);
  await targetUser.save();

  const io = getIo();
  if (io) {
    io.emit('family:ping_received', {
      targetUserId: id,
      ping: pingItem,
    });
  }

  return res.status(201).json({
    message: 'Family ping sent successfully',
    ping: pingItem,
    user: mapUserDoc(targetUser),
  });
}

async function respondFamilyPing(req, res) {
  const { id } = req.params;
  const { pingId, responseMessage, location } = req.body;

  const targetUser = await ensureUserById(id);
  if (!targetUser) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (Array.isArray(targetUser.pendingFamilyPings)) {
    const ping = targetUser.pendingFamilyPings.find(
      (p) => String(p._id) === String(pingId) || String(p.id) === String(pingId)
    );
    if (ping) {
      ping.status = 'ANSWERED';
    }
  }

  const now = new Date();
  targetUser.lastCheckinTime = now;
  targetUser.nextDeadline = new Date(Date.now() + targetUser.timerIntervalMinutes * 60 * 1000);
  targetUser.consecutiveSoftCheckins = 0;
  targetUser.snoozeCountToday = 0;
  targetUser.currentStatus = 'SAFE';
  if (location && typeof location.lat === 'number' && typeof location.lng === 'number') {
    targetUser.lastKnownLocation = { lat: location.lat, lng: location.lng, updatedAt: now };
  }
  await targetUser.save();

  await CheckInHistory.create({
    userId: id,
    checkinTime: now,
    locationAtCheckin: targetUser.lastKnownLocation,
    type: 'FAMILY_PING_REPLY',
    familyPingRef: pingId || null,
    metadata: { responseMessage: responseMessage || 'Van khoe, ca nha yen tam!' },
    isSystemAutoTriggered: false,
  });

  const io = getIo();
  if (io) {
    io.emit('family:ping_replied', {
      userId: id,
      pingId,
      responseMessage: responseMessage || 'Van khoe',
      timestamp: now.toISOString(),
    });
  }

  return res.status(200).json({
    message: 'Da phan hoi loi nhan gia dinh va hoan tat diem danh',
    user: mapUserDoc(targetUser),
  });
}

async function listCheckInMoments(req, res) {
  const { id } = req.params;
  const targetUser = await ensureUserById(id);
  if (!targetUser) {
    return res.status(404).json({ message: 'User not found' });
  }

  const moments = await CheckInHistory.find({
    userId: id,
    $or: [
      { type: { $in: ['EMOTIONAL_MOMENT', 'ROUTINE', 'FAMILY_PING_REPLY'] } },
      { 'mediaSnapshot.photoUrl': { $exists: true, $ne: null } },
      { 'mediaSnapshot.note': { $exists: true, $ne: null } },
      { routineType: { $exists: true, $ne: null } },
    ],
  })
    .sort({ checkinTime: -1 })
    .limit(50);

  return res.status(200).json({
    moments: moments.map((m) => ({
      id: m._id,
      userId: m.userId,
      checkinTime: toIso(m.checkinTime),
      type: m.type,
      routineType: m.routineType,
      mediaSnapshot: m.mediaSnapshot,
      familyPingRef: m.familyPingRef,
      metadata: m.metadata,
    })),
  });
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
  getHealthReport,
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
  registerPushToken,
  deletePushToken,
  sendFamilyPing,
  respondFamilyPing,
  listCheckInMoments,
};
