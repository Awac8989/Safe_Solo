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

    // 1. Passive Check-in Customizations
    enabledPassiveSources: {
      type: [String],
      default: [
        'SCREEN_UNLOCK',
        'CHARGER_PLUGGED',
        'CHARGER_UNPLUGGED',
        'PEDOMETER_BURST',
        'GEOFENCE_ENTER',
        'SAFE_GEOFENCE',
        'HOME_WIFI',
        'DEVICE_ACTIVITY',
        'WAKE_UP_PULSE',
      ],
    },
    pedometerThreshold: { type: Number, default: 200, min: 50, max: 2000 },
    safeWifiList: {
      type: [
        {
          ssid: { type: String, required: true },
          bssid: { type: String, default: null },
          label: { type: String, default: 'Wi-Fi An Toàn' },
        },
      ],
      default: [],
    },
    multiFactorPassiveEnabled: { type: Boolean, default: false },
    multiFactorMinSignals: { type: Number, default: 2, min: 2, max: 5 },
    maxSoftCheckinAllowed: { type: Number, default: 3, min: 1, max: 10 },

    // 3. Custom Routine Checklist
    customRoutines: {
      type: [
        {
          id: { type: String, required: true },
          title: { type: String, required: true },
          isMandatory: { type: Boolean, default: false },
          completed: { type: Boolean, default: false },
          time: { type: String, default: null },
        },
      ],
      default: [
        { id: 'gas_valve', title: 'Khóa van bình gas an toàn', isMandatory: false, completed: false },
        { id: 'daily_pill', title: 'Uống thuốc định kỳ', isMandatory: true, completed: false },
        { id: 'lock_door', title: 'Chốt cửa chính và ban công', isMandatory: false, completed: false },
      ],
    },

    // 6. Telegram Bot Customizations
    telegramReminderOffsetMinutes: { type: Number, default: 15, min: 3, max: 120 },
    telegramCustomPrompt: { type: String, default: '' },

    // 7. Family Ping Quick-Reply Templates
    familyPingTemplates: {
      type: [String],
      default: [
        'Con đang lái xe, về đến nơi sẽ gọi lại.',
        'Đang làm việc, mọi thứ vẫn ổn.',
        'Đang tụ tập với bạn bè.',
        'Hơi mệt một chút, đang nằm nghỉ.',
      ],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.models.AutomationSetting || mongoose.model('AutomationSetting', AutomationSettingSchema);

