const crypto = require('crypto');
const mongoose = require('mongoose');

const AlertPolicySchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, unique: true, index: true },
    level1Minutes: { type: Number, default: 30, min: 0 },
    level2Minutes: { type: Number, default: 5, min: 0 },
    level3Minutes: { type: Number, default: 15, min: 0 },
    level4Enabled: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.models.AlertPolicy || mongoose.model('AlertPolicy', AlertPolicySchema);
