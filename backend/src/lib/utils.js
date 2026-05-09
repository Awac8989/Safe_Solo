function fullName(user) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone || null,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: fullName(user),
    dateOfBirth: user.dateOfBirth || null,
    gender: user.gender || null,
    avatar: user.avatar || null,
    isActive: Boolean(user.isActive),
    isVerified: Boolean(user.isVerified),
    isKycVerified: Boolean(user.isKycVerified),
    trustScore: Number(user.trustScore || 0),
    rescuesCount: Number(user.rescuesCount || 0),
    nextCheckinDeadline: user.nextCheckinDeadline || null,
    lastCheckInAt: user.lastCheckInAt || null,
    graceHours: Number(user.graceHours || 24),
    lastLat: user.lastLat ?? null,
    lastLng: user.lastLng ?? null,
    lastLocationTime: user.lastLocationTime || null,
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
  normalizeEmail,
  sanitizeUser,
  fuzzCoordinates,
  haversineKm,
  paginate,
};
