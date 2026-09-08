const {
  encryptJson,
  decryptJson,
} = require('./securityCrypto');

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

function buildUserSensitivePayload(source = {}) {
  return {
    approxAddress: source.approxAddress || null,
    medicalNotes: source.medicalNotes || '',
    emergencyContacts: normalizeContacts(source.emergencyContacts),
  };
}

function buildEmergencyContactPhones(contacts = []) {
  return [...new Set(normalizeContacts(contacts).map((item) => item.phone).filter(Boolean))];
}

function buildEncryptedUserSensitiveUpdate(userId, source = {}) {
  const payload = buildUserSensitivePayload(source);
  return {
    approxAddress: null,
    medicalNotes: '',
    emergencyContacts: [],
    emergencyContactPhones: buildEmergencyContactPhones(payload.emergencyContacts),
    encryptedSensitive: encryptJson(payload, `user:${userId}:sensitive`),
    encryptionVersion: 1,
    encryptedAt: new Date(),
  };
}

function decryptUserSensitivePayload(row) {
  const raw = row && typeof row.toObject === 'function' ? row.toObject() : row;
  const payload = decryptJson(raw?.encryptedSensitive, `user:${raw?._id}:sensitive`) || {};
  return {
    approxAddress: payload.approxAddress || raw?.approxAddress || null,
    medicalNotes: payload.medicalNotes || raw?.medicalNotes || '',
    emergencyContacts:
      normalizeContacts(payload.emergencyContacts).length
        ? normalizeContacts(payload.emergencyContacts)
        : normalizeContacts(raw?.emergencyContacts),
  };
}

function mergeUserSensitivePayload(row) {
  const raw = row && typeof row.toObject === 'function' ? row.toObject() : row;
  const sensitive = decryptUserSensitivePayload(raw);
  return {
    ...raw,
    approxAddress: sensitive.approxAddress,
    medicalNotes: sensitive.medicalNotes,
    emergencyContacts: sensitive.emergencyContacts,
    emergencyContactPhones:
      Array.isArray(raw?.emergencyContactPhones) && raw.emergencyContactPhones.length
        ? raw.emergencyContactPhones
        : buildEmergencyContactPhones(sensitive.emergencyContacts),
  };
}

module.exports = {
  buildUserSensitivePayload,
  buildEncryptedUserSensitiveUpdate,
  decryptUserSensitivePayload,
  mergeUserSensitivePayload,
  buildEmergencyContactPhones,
};
