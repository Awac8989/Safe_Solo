const mongoose = require('mongoose');

const SecuritySettingSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    stealthMode: { type: Boolean, default: false },
    autoWipeDays: { type: Number, default: 0 },
    encryptionEnabled: { type: Boolean, default: true },
    lastAutoWipeDueAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.models.SecuritySetting || mongoose.model('SecuritySetting', SecuritySettingSchema);
