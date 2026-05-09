const { readState, withState, createId, nowIso } = require('../data/store');
const { AppError } = require('../lib/errors');

class VaultService {
  async getVault(userId) {
    const state = readState();
    let vault = state.vaults.find((item) => item.userId === userId);
    if (!vault) {
      vault = {
        id: createId('vault'),
        userId,
        content: { documents: [], encrypted: true, lastEncryptedAt: nowIso() },
        shreddedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      withState((draft) => {
        draft.vaults.push(vault);
      });
    }
    return vault;
  }

  async upsertVault(userId, content) {
    return withState((state) => {
      let vault = state.vaults.find((item) => item.userId === userId);
      if (!vault) {
        vault = {
          id: createId('vault'),
          userId,
          content,
          shreddedAt: null,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        state.vaults.push(vault);
      } else {
        vault.content = content;
        vault.shreddedAt = null;
        vault.updatedAt = nowIso();
      }
      return vault;
    });
  }

  async shredVaultForUser(userId) {
    return withState((state) => {
      const vault = state.vaults.find((item) => item.userId === userId);
      if (!vault) {
        throw new AppError('Vault not found', 404);
      }
      vault.content = {
        shredded: true,
        lastEncryptedAt: nowIso(),
      };
      vault.shreddedAt = nowIso();
      vault.updatedAt = nowIso();
      return vault;
    });
  }
}

module.exports = new VaultService();
