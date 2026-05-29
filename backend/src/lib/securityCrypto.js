const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const ENCRYPTION_VERSION = 1;
const BCRYPT_PREFIX = /^\$2[aby]\$/;
const DEFAULT_KEY_ID = 'primary';

function getSecretEntries() {
  const rawKeyMap = String(process.env.DATA_ENCRYPTION_KEYS || '').trim();
  if (rawKeyMap) {
    const entries = rawKeyMap
      .split(';')
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => {
        const separator = chunk.indexOf('=');
        if (separator <= 0) {
          return null;
        }
        const kid = chunk.slice(0, separator).trim();
        const secret = chunk.slice(separator + 1).trim();
        if (!kid || !secret) {
          return null;
        }
        return { kid, secret };
      })
      .filter(Boolean);

    if (entries.length) {
      return entries;
    }
  }

  return [
    {
      kid: String(process.env.DATA_ENCRYPTION_KEY_ID || DEFAULT_KEY_ID).trim() || DEFAULT_KEY_ID,
      secret:
        process.env.DATA_ENCRYPTION_KEY ||
        process.env.APP_ENCRYPTION_KEY ||
        process.env.JWT_SECRET ||
        'safesolo-dev-encryption-key',
    },
  ];
}

function buildKey(secret) {
  return crypto.createHash('sha256').update(String(secret || '')).digest();
}

function getKeyring() {
  return getSecretEntries().map((entry) => ({
    kid: entry.kid,
    key: buildKey(entry.secret),
  }));
}

function getCurrentKey() {
  return getKeyring()[0];
}

function getKeyById(kid) {
  return getKeyring().find((entry) => entry.kid === kid) || null;
}

function createAad(context) {
  return Buffer.from(String(context || 'safesolo'), 'utf8');
}

function isEncryptedEnvelope(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      value.__enc === true &&
      value.alg === 'aes-256-gcm' &&
      typeof value.kid === 'string' &&
      typeof value.iv === 'string' &&
      typeof value.tag === 'string' &&
      typeof value.data === 'string',
  );
}

function encryptJson(value, context = 'safesolo') {
  const currentKey = getCurrentKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', currentKey.key, iv);
  cipher.setAAD(createAad(context));

  const plaintext = Buffer.from(JSON.stringify(value ?? null), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    __enc: true,
    v: ENCRYPTION_VERSION,
    alg: 'aes-256-gcm',
    kid: currentKey.kid,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  };
}

function tryDecryptWithKey(value, keySpec, context) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    keySpec.key,
    Buffer.from(value.iv, 'base64'),
  );
  decipher.setAAD(createAad(context));
  decipher.setAuthTag(Buffer.from(value.tag, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(value.data, 'base64')),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString('utf8'));
}

function decryptJson(value, context = 'safesolo') {
  if (!isEncryptedEnvelope(value)) {
    return value;
  }

  const candidates = [];
  const matching = getKeyById(value.kid);
  if (matching) {
    candidates.push(matching);
  }
  for (const entry of getKeyring()) {
    if (!candidates.some((item) => item.kid === entry.kid)) {
      candidates.push(entry);
    }
  }

  let lastError = null;
  for (const entry of candidates) {
    try {
      return tryDecryptWithKey(value, entry, context);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Unable to decrypt payload with configured keyring');
}

function isCurrentEncryptionEnvelope(value) {
  if (!isEncryptedEnvelope(value)) {
    return false;
  }
  const currentKey = getCurrentKey();
  return Number(value.v || 0) >= ENCRYPTION_VERSION && value.kid === currentKey.kid;
}

function isHashedPin(value) {
  return typeof value === 'string' && BCRYPT_PREFIX.test(value);
}

async function hashPin(pin) {
  const normalized = String(pin || '').trim();
  if (!normalized) {
    return '';
  }
  if (isHashedPin(normalized)) {
    return normalized;
  }
  return bcrypt.hash(normalized, 10);
}

async function verifyPin(rawPin, storedValue) {
  const normalized = String(rawPin || '').trim();
  const saved = String(storedValue || '').trim();
  if (!saved) {
    return normalized === '';
  }
  if (isHashedPin(saved)) {
    return bcrypt.compare(normalized, saved);
  }
  return normalized === saved;
}

module.exports = {
  encryptJson,
  decryptJson,
  isEncryptedEnvelope,
  isCurrentEncryptionEnvelope,
  hashPin,
  verifyPin,
  isHashedPin,
  getCurrentKey,
};
