const crypto = require('crypto');
const mongoose = require('mongoose');

const VaultSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, unique: true, index: true },
    content: { type: mongoose.Schema.Types.Mixed, default: { documents: [], encrypted: true } },
    encryptedAt: { type: Date, default: null },
    shreddedAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.models.Vault || mongoose.model('Vault', VaultSchema);
