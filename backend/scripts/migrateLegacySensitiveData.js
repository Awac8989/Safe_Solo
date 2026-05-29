require('dotenv').config();

const database = require('../src/config/database');
const MedicalProfile = require('../src/models/MedicalProfile');
const Vault = require('../src/models/Vault');
const User = require('../src/models/User');
const Message = require('../src/models/Message');
const EmergencyMemo = require('../src/models/EmergencyMemo');
const {
  buildEncryptedMedicalUpdate,
  decryptMedicalPayload,
} = require('../src/lib/medicalProfileCodec');
const {
  encryptJson,
  decryptJson,
  isEncryptedEnvelope,
  isCurrentEncryptionEnvelope,
  hashPin,
  isHashedPin,
} = require('../src/lib/securityCrypto');
const {
  decryptMessagePayload,
  encryptMessagePayload,
  decryptEmergencyMemoPayload,
  encryptEmergencyMemoPayload,
} = require('../src/lib/sensitivePayloadCodec');
const {
  buildEncryptedUserSensitiveUpdate,
  decryptUserSensitivePayload,
} = require('../src/lib/userSensitiveCodec');

async function migrateMedicalProfiles() {
  const docs = await MedicalProfile.find();
  let migrated = 0;
  let skipped = 0;

  for (const doc of docs) {
    const payload = decryptMedicalPayload(doc) || {};
    const alreadyEncrypted = isCurrentEncryptionEnvelope(doc.encryptedProfile) && Number(doc.encryptionVersion || 0) >= 1;
    const hasLegacyData = Boolean(
      String(doc.fullName || '').trim() ||
        String(doc.birthYear || '').trim() ||
        String(doc.allergies || '').trim() ||
        String(doc.conditions || '').trim() ||
        String(doc.medications || '').trim() ||
        String(doc.emergencyPhone || '').trim() ||
        String(doc.insuranceProvider || '').trim() ||
        String(doc.insuranceNumber || '').trim() ||
        (Array.isArray(doc.allergiesList) && doc.allergiesList.length) ||
        (Array.isArray(doc.medicationsList) && doc.medicationsList.length) ||
        (Array.isArray(doc.medicalConditions) && doc.medicalConditions.length) ||
        doc.emergencyContact ||
        doc.insuranceInfo ||
        doc.doctor ||
        doc.qrCodeValue,
    );

    if (alreadyEncrypted && !hasLegacyData) {
      skipped += 1;
      continue;
    }

    Object.assign(doc, buildEncryptedMedicalUpdate(doc.userId, payload));
    await doc.save();
    migrated += 1;
  }

  return { migrated, skipped, total: docs.length };
}

async function migrateVaults() {
  const docs = await Vault.find();
  let migrated = 0;
  let skipped = 0;

  for (const doc of docs) {
    if (isCurrentEncryptionEnvelope(doc.content) && doc.encryptedAt) {
      skipped += 1;
      continue;
    }

    const plainContent = isEncryptedEnvelope(doc.content)
      ? decryptJson(doc.content, `vault:${doc.userId}`)
      : doc.content || {
          documents: [],
          encrypted: true,
          lastEncryptedAt: new Date().toISOString(),
        };

    doc.content = encryptJson(plainContent, `vault:${doc.userId}`);
    doc.encryptedAt = doc.encryptedAt || new Date();
    await doc.save();
    migrated += 1;
  }

  return { migrated, skipped, total: docs.length };
}

async function migrateUserPins() {
  const users = await User.find({
    $or: [{ realPin: { $exists: true, $ne: '' } }, { duressPin: { $exists: true, $ne: '' } }],
  });

  let migrated = 0;
  let skipped = 0;

  for (const user of users) {
    let changed = false;

    if (user.realPin && !isHashedPin(user.realPin)) {
      user.realPin = await hashPin(user.realPin);
      changed = true;
    }
    if (user.duressPin && !isHashedPin(user.duressPin)) {
      user.duressPin = await hashPin(user.duressPin);
      changed = true;
    }

    if (changed) {
      await user.save();
      migrated += 1;
    } else {
      skipped += 1;
    }
  }

  return { migrated, skipped, total: users.length };
}

async function migrateUserSensitivePayloads() {
  const users = await User.find();
  let migrated = 0;
  let skipped = 0;

  for (const user of users) {
    const sensitive = decryptUserSensitivePayload(user);
    const legacyPlaintextExists = Boolean(
      String(user.approxAddress || '').trim() ||
        String(user.medicalNotes || '').trim() ||
        (Array.isArray(user.emergencyContacts) && user.emergencyContacts.length),
    );
    const currentEncrypted =
      isCurrentEncryptionEnvelope(user.encryptedSensitive) &&
      Number(user.encryptionVersion || 0) >= 1 &&
      Array.isArray(user.emergencyContactPhones);

    if (currentEncrypted && !legacyPlaintextExists) {
      skipped += 1;
      continue;
    }

    Object.assign(
      user,
      buildEncryptedUserSensitiveUpdate(user._id, {
        approxAddress: sensitive.approxAddress,
        medicalNotes: sensitive.medicalNotes,
        emergencyContacts: sensitive.emergencyContacts,
      }),
    );
    await user.save();
    migrated += 1;
  }

  return { migrated, skipped, total: users.length };
}

async function migrateMessages() {
  const docs = await Message.find();
  let migrated = 0;
  let skipped = 0;

  for (const doc of docs) {
    if (isCurrentEncryptionEnvelope(doc.encryptedPayload) && Number(doc.encryptionVersion || 0) >= 1) {
      skipped += 1;
      continue;
    }

    const payload = decryptMessagePayload(doc);
    doc.encryptedPayload = encryptMessagePayload({
      roomId: doc.roomId,
      content: payload.content || '',
      metadata: payload.metadata ?? null,
    });
    doc.encryptionVersion = 1;
    doc.content = '';
    doc.metadata = null;
    await doc.save();
    migrated += 1;
  }

  return { migrated, skipped, total: docs.length };
}

async function migrateEmergencyMemos() {
  const docs = await EmergencyMemo.find();
  let migrated = 0;
  let skipped = 0;

  for (const doc of docs) {
    if (isCurrentEncryptionEnvelope(doc.encryptedPayload) && Number(doc.encryptionVersion || 0) >= 1) {
      skipped += 1;
      continue;
    }

    const payload = decryptEmergencyMemoPayload(doc);
    doc.encryptedPayload = encryptEmergencyMemoPayload({
      incidentId: doc.incidentId,
      victimName: payload.victimName || '',
      approxAddress: payload.approxAddress || null,
      contentUrl: payload.contentUrl || null,
      transcript: payload.transcript || '',
    });
    doc.encryptionVersion = 1;
    doc.victimName = '';
    doc.approxAddress = null;
    doc.contentUrl = null;
    doc.transcript = '';
    await doc.save();
    migrated += 1;
  }

  return { migrated, skipped, total: docs.length };
}

async function main() {
  console.log('Connecting to MongoDB...');
  await database.$connect();
  console.log('Connected.');

  const [medical, vaults, pins, userSensitive, messages, memos] = await Promise.all([
    migrateMedicalProfiles(),
    migrateVaults(),
    migrateUserPins(),
    migrateUserSensitivePayloads(),
    migrateMessages(),
    migrateEmergencyMemos(),
  ]);

  console.log('\nMigration summary');
  console.log('-----------------');
  console.log(`Medical profiles : migrated ${medical.migrated}, skipped ${medical.skipped}, total ${medical.total}`);
  console.log(`Vaults           : migrated ${vaults.migrated}, skipped ${vaults.skipped}, total ${vaults.total}`);
  console.log(`User PINs        : migrated ${pins.migrated}, skipped ${pins.skipped}, total ${pins.total}`);
  console.log(`User sensitive   : migrated ${userSensitive.migrated}, skipped ${userSensitive.skipped}, total ${userSensitive.total}`);
  console.log(`Messages         : migrated ${messages.migrated}, skipped ${messages.skipped}, total ${messages.total}`);
  console.log(`Emergency memos  : migrated ${memos.migrated}, skipped ${memos.skipped}, total ${memos.total}`);

  await database.$disconnect();
  console.log('\nDone.');
}

main().catch(async (error) => {
  console.error('Migration failed:', error);
  try {
    await database.$disconnect();
  } catch (_) {
    // ignore disconnect errors during failure cleanup
  }
  process.exit(1);
});
