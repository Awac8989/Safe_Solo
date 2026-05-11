const Vault = require('../models/Vault');
const { AppError } = require('../lib/errors');

class VaultService {
  async getVault(userId) {
    let vault = await Vault.findOne({ userId });
    if (!vault) {
      vault = await Vault.create({
        userId,
        content: { documents: [], encrypted: true, lastEncryptedAt: new Date().toISOString() },
        shreddedAt: null,
      });
    }
    return vault;
  }

  async upsertVault(userId, content) {
    let vault = await Vault.findOne({ userId });
    if (!vault) {
      vault = await Vault.create({
        userId,
        content,
        shreddedAt: null,
      });
    } else {
      vault.content = content;
      vault.shreddedAt = null;
      await vault.save();
    }
    return vault;
  }

  async shredVaultForUser(userId) {
    const vault = await Vault.findOne({ userId });
    if (!vault) {
      throw new AppError('Vault not found', 404);
    }
    vault.content = {
      shredded: true,
      lastEncryptedAt: new Date().toISOString(),
    };
    vault.shreddedAt = new Date();
    await vault.save();
    return vault;
  }
}

module.exports = new VaultService();
