const mongoose = require('mongoose');

const AutomationSettingSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    dailyReminderTime: { type: String, default: '08:00' },
    shakeSos: { type: Boolean, default: true },
    shakeSensitivity: { type: Number, default: 3 },
    fallDetection: { type: Boolean, default: false },
    geofenceAutoCheckin: { type: Boolean, default: true },
    pillReminder: { type: Boolean, default: false },
    pillTime: { type: String, default: '08:00' },
    homeLocation: { type: mongoose.Schema.Types.Mixed, default: null },
    lastGeofenceEventAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.models.AutomationSetting || mongoose.model('AutomationSetting', AutomationSettingSchema);
