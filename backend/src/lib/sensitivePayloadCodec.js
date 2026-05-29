const { decryptJson, encryptJson, isEncryptedEnvelope } = require('./securityCrypto');

function encryptMessagePayload(message) {
  return encryptJson(
    {
      content: String(message.content || ''),
      metadata: message.metadata ?? null,
    },
    `message:${message.roomId}`,
  );
}

function decryptMessagePayload(message) {
  const row = message?.toObject ? message.toObject() : message;
  if (!row) {
    return { content: '', metadata: null };
  }
  if (!isEncryptedEnvelope(row.encryptedPayload)) {
    return {
      content: row.content || '',
      metadata: row.metadata ?? null,
    };
  }
  try {
    const payload = decryptJson(row.encryptedPayload, `message:${row.roomId}`);
    return {
      content: String(payload?.content || ''),
      metadata: payload?.metadata ?? null,
    };
  } catch (_error) {
    return {
      content: row.content || '',
      metadata: row.metadata ?? null,
    };
  }
}

function encryptEmergencyMemoPayload(memo) {
  return encryptJson(
    {
      victimName: String(memo.victimName || ''),
      approxAddress: memo.approxAddress || null,
      contentUrl: memo.contentUrl || null,
      transcript: String(memo.transcript || ''),
    },
    `memo:${memo.incidentId}`,
  );
}

function decryptEmergencyMemoPayload(memo) {
  const row = memo?.toObject ? memo.toObject() : memo;
  if (!row) {
    return {
      victimName: '',
      approxAddress: null,
      contentUrl: null,
      transcript: '',
    };
  }
  if (!isEncryptedEnvelope(row.encryptedPayload)) {
    return {
      victimName: row.victimName || '',
      approxAddress: row.approxAddress || null,
      contentUrl: row.contentUrl || null,
      transcript: row.transcript || '',
    };
  }
  try {
    const payload = decryptJson(row.encryptedPayload, `memo:${row.incidentId}`);
    return {
      victimName: String(payload?.victimName || ''),
      approxAddress: payload?.approxAddress || null,
      contentUrl: payload?.contentUrl || null,
      transcript: String(payload?.transcript || ''),
    };
  } catch (_error) {
    return {
      victimName: row.victimName || '',
      approxAddress: row.approxAddress || null,
      contentUrl: row.contentUrl || null,
      transcript: row.transcript || '',
    };
  }
}

module.exports = {
  encryptMessagePayload,
  decryptMessagePayload,
  encryptEmergencyMemoPayload,
  decryptEmergencyMemoPayload,
};
