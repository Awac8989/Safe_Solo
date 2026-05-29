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
  const payload = decryptJson(row?.encryptedSensitive, `user:${row?._id}:sensitive`) || {};
  return {
    approxAddress: payload.approxAddress || row?.approxAddress || null,
    medicalNotes: payload.medicalNotes || row?.medicalNotes || '',
    emergencyContacts:
      normalizeContacts(payload.emergencyContacts).length
        ? normalizeContacts(payload.emergencyContacts)
        : normalizeContacts(row?.emergencyContacts),
  };
}

function mergeUserSensitivePayload(row) {
  const sensitive = decryptUserSensitivePayload(row);
  return {
    ...row,
    approxAddress: sensitive.approxAddress,
    medicalNotes: sensitive.medicalNotes,
    emergencyContacts: sensitive.emergencyContacts,
    emergencyContactPhones:
      Array.isArray(row?.emergencyContactPhones) && row.emergencyContactPhones.length
        ? row.emergencyContactPhones
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
