const prisma = require('../config/database');

class VaultService {
  async shredVaultForUser(userId) {
    const vault = await prisma.vault.findUnique({
      where: { userId },
    });

    if (!vault) {
      return null;
    }

    return prisma.vault.update({
      where: { id: vault.id },
      data: {
        content: {
          shredded: true,
          shreddedAt: new Date().toISOString(),
        },
        shreddedAt: new Date(),
      },
    });
  }
}

module.exports = new VaultService();
