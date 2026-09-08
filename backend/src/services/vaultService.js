const Vault = require('../models/Vault');
const User = require('../models/User');
const { AppError } = require('../lib/errors');
const { decryptJson, encryptJson } = require('../lib/securityCrypto');

function defaultVaultContent() {
  return {
    documents: [],
    encrypted: true,
    lastEncryptedAt: new Date().toISOString(),
  };
}

class VaultService {
  async getVault(userId) {
    let vault = await Vault.findOne({ userId });
    if (!vault) {
      vault = await Vault.create({
        userId,
        content: encryptJson(defaultVaultContent(), `vault:${userId}`),
        encryptedAt: new Date(),
        shreddedAt: null,
      });
    }
    return {
      ...vault.toObject(),
      content: decryptJson(vault.content, `vault:${userId}`),
    };
  }

  async upsertVault(userId, content) {
    let vault = await Vault.findOne({ userId });
    const encryptedContent = encryptJson(content, `vault:${userId}`);
    if (!vault) {
      vault = await Vault.create({
        userId,
        content: encryptedContent,
        encryptedAt: new Date(),
        shreddedAt: null,
      });
    } else {
      vault.content = encryptedContent;
      vault.encryptedAt = new Date();
      vault.shreddedAt = null;
      await vault.save();
    }
    return {
      ...vault.toObject(),
      content,
    };
  }

  async shredVaultForUser(userId) {
    const vault = await Vault.findOne({ userId });
    if (!vault) {
      throw new AppError('Vault not found', 404);
    }
    const shreddedContent = {
      shredded: true,
      lastEncryptedAt: new Date().toISOString(),
    };
    vault.content = encryptJson(shreddedContent, `vault:${userId}`);
    vault.encryptedAt = new Date();
    vault.shreddedAt = new Date();
    await vault.save();
    return {
      ...vault.toObject(),
      content: shreddedContent,
    };
  }

  async releaseVaultToGuardians(userId) {
    const vault = await Vault.findOne({ userId });
    if (!vault || vault.shreddedAt) {
      return null;
    }

    let decryptedContent = null;
    try {
      decryptedContent = decryptJson(vault.content, `vault:${userId}`);
    } catch (_e) {
      decryptedContent = vault.content;
    }

    vault.releasedAt = new Date();
    await vault.save();

    const user = await User.findById(userId).lean();
    const guardians = user?.emergencyContacts || [];

    return {
      vaultId: vault._id,
      userId,
      releasedAt: vault.releasedAt,
      guardiansNotified: guardians.length,
      guardians: guardians.map((g) => ({ name: g.name, phone: g.phone })),
      content: decryptedContent,
    };
  }
}

module.exports = new VaultService();
