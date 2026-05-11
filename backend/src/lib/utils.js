function splitFullName(value) {
  const text = String(value || '').trim();
  if (!text) {
    return { firstName: '', lastName: '' };
  }

  const parts = text.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

function fullName(user) {
  if (user?.fullName) {
    return String(user.fullName).trim();
  }
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function sanitizeUser(user) {
  const name = fullName(user);
  const parsedName = splitFullName(name);
  const lastKnownLocation = user.lastKnownLocation || null;
  const nextCheckinDeadline = user.nextCheckinDeadline || user.nextDeadline || null;
  const lastCheckInAt = user.lastCheckInAt || user.lastCheckinTime || null;
  const graceHours = user.graceHours || Math.max(1, Math.round(Number(user.timerIntervalMinutes || 1440) / 60));

  return {
    id: user.id || user._id,
    email: user.email,
    phone: user.phone || user.phoneNumber || null,
    firstName: user.firstName || parsedName.firstName,
    lastName: user.lastName || parsedName.lastName,
    fullName: name,
    dateOfBirth: user.dateOfBirth || null,
    gender: user.gender || null,
    avatar: user.avatar || null,
    isActive: user.isActive !== false,
    isVerified: user.isVerified !== false,
    isKycVerified: Boolean(user.isKycVerified),
    trustScore: Number(user.trustScore || 0),
    rescuesCount: Number(user.rescuesCount || 0),
    nextCheckinDeadline,
    lastCheckInAt,
    graceHours: Number(graceHours || 24),
    lastLat: user.lastLat ?? lastKnownLocation?.lat ?? null,
    lastLng: user.lastLng ?? lastKnownLocation?.lng ?? null,
    lastLocationTime: user.lastLocationTime || lastKnownLocation?.updatedAt || null,
    batteryLevel: user.batteryLevel ?? null,
    approxAddress: user.approxAddress || null,
    security: user.security || {},
    role: user.role || 'USER',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function fuzzCoordinates(lat, lng) {
  const latOffset = (Math.random() - 0.5) * 0.001;
  const lngOffset = (Math.random() - 0.5) * 0.001;
  return {
    fuzzedLat: Number((lat + latOffset).toFixed(6)),
    fuzzedLng: Number((lng + lngOffset).toFixed(6)),
  };
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function paginate(items, limit = 20, offset = 0) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  return {
    items: items.slice(safeOffset, safeOffset + safeLimit),
    pagination: {
      limit: safeLimit,
      offset: safeOffset,
      count: Math.max(items.length - safeOffset, 0),
      total: items.length,
    },
  };
}

module.exports = {
  fullName,
  splitFullName,
  normalizeEmail,
  sanitizeUser,
  fuzzCoordinates,
  haversineKm,
  paginate,
};
