function nowIso() {
  return new Date().toISOString();
}

function computeDeadlineIso(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function toIso(value) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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

function mapUserDoc(doc) {
  if (!doc) {
    return null;
  }

  const row = doc.toObject ? doc.toObject() : doc;
  return {
    _id: row._id,
    fullName: row.fullName,
    phoneNumber: row.phoneNumber,
    role: row.role,
    email: row.email || '',
    avatar: row.avatar || null,
    isActive: Boolean(row.isActive),
    isVerified: Boolean(row.isVerified),
    isKycVerified: Boolean(row.isKycVerified),
    trustScore: Number(row.trustScore || 0),
    rescuesCount: Number(row.rescuesCount || 0),
    batteryLevel: row.batteryLevel ?? null,
    approxAddress: row.approxAddress || null,
    medicalNotes: row.medicalNotes || '',
    emergencyContacts: normalizeContacts(row.emergencyContacts),
    timerIntervalMinutes: row.timerIntervalMinutes,
    lastCheckinTime: toIso(row.lastCheckinTime),
    nextDeadline: toIso(row.nextDeadline),
    currentStatus: row.currentStatus,
    lastKnownLocation: row.lastKnownLocation
      ? {
          lat: Number(row.lastKnownLocation.lat),
          lng: Number(row.lastKnownLocation.lng),
          updatedAt: toIso(row.lastKnownLocation.updatedAt) || toIso(new Date()),
        }
      : null,
    lastReminderAt: toIso(row.lastReminderAt),
    lastWarningAt: toIso(row.lastWarningAt),
    lastSosAt: toIso(row.lastSosAt),
    quietHoursStart: row.quietHoursStart || '23:00',
    quietHoursEnd: row.quietHoursEnd || '06:00',
    sleepModeUntil: toIso(row.sleepModeUntil),
    falseAlertGraceMinutes: row.falseAlertGraceMinutes ?? 3,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function mapAlertPolicyDoc(doc) {
  if (!doc) {
    return null;
  }
  const row = doc.toObject ? doc.toObject() : doc;
  return {
    _id: row._id,
    userId: row.userId,
    level1Minutes: row.level1Minutes,
    level2Minutes: row.level2Minutes,
    level3Minutes: row.level3Minutes,
    level4Enabled: Boolean(row.level4Enabled),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function mapMedicalProfileDoc(doc) {
  if (!doc) {
    return null;
  }
  const row = doc.toObject ? doc.toObject() : doc;
  return {
    userId: row.userId,
    fullName: row.fullName || '',
    birthYear: row.birthYear || '',
    bloodType: row.bloodType || 'O+',
    allergies: row.allergies || '',
    conditions: row.conditions || '',
    medications: row.medications || '',
    emergencyPhone: row.emergencyPhone || '',
    insuranceProvider: row.insuranceProvider || '',
    insuranceNumber: row.insuranceNumber || '',
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function mapAutomationSettingDoc(doc) {
  if (!doc) {
    return null;
  }
  const row = doc.toObject ? doc.toObject() : doc;
  return {
    userId: row.userId,
    dailyReminderTime: row.dailyReminderTime || '08:00',
    shakeSos: Boolean(row.shakeSos),
    shakeSensitivity: row.shakeSensitivity ?? 3,
    fallDetection: Boolean(row.fallDetection),
    geofenceAutoCheckin: Boolean(row.geofenceAutoCheckin),
    pillReminder: Boolean(row.pillReminder),
    pillTime: row.pillTime || '08:00',
    homeLocation: row.homeLocation || null,
    lastGeofenceEventAt: toIso(row.lastGeofenceEventAt),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function mapSecuritySettingDoc(doc) {
  if (!doc) {
    return null;
  }
  const row = doc.toObject ? doc.toObject() : doc;
  return {
    userId: row.userId,
    stealthMode: Boolean(row.stealthMode),
    autoWipeDays: row.autoWipeDays ?? 0,
    encryptionEnabled: Boolean(row.encryptionEnabled),
    lastAutoWipeDueAt: toIso(row.lastAutoWipeDueAt),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

module.exports = {
  nowIso,
  computeDeadlineIso,
  normalizeContacts,
  mapUserDoc,
  mapAlertPolicyDoc,
  mapMedicalProfileDoc,
  mapAutomationSettingDoc,
  mapSecuritySettingDoc,
  toIso,
};
