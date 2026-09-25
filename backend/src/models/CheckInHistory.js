const crypto = require('crypto');
const mongoose = require('mongoose');

const CheckInHistorySchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, index: true },
    checkinTime: { type: Date, required: true, default: Date.now },
    type: {
      type: String,
      enum: [
        'HARD_TAP',
        'SOFT_PASSIVE',
        'SNOOZE',
        'EMOTIONAL_MOMENT',
        'DURESS_FAKE',
        'ROUTINE',
        'VOICE_KEYWORD',
        'SMS_FALLBACK',
        'FAMILY_PING_REPLY',
        'WATCH_CHECKIN',
      ],
      default: 'HARD_TAP',
    },
    passiveSource: {
      type: String,
      enum: [
        'SCREEN_UNLOCK',
        'CHARGER_PLUGGED',
        'CHARGER_UNPLUGGED',
        'PEDOMETER_BURST',
        'GEOFENCE_ENTER',
        'SAFE_GEOFENCE',
        'HOME_WIFI',
        'DEVICE_ACTIVITY',
        'NONE',
      ],
      default: 'NONE',
    },
    isDuress: { type: Boolean, default: false },
    snoozeMinutes: { type: Number, default: 0 },
    routineType: {
      type: String,
      enum: [
        'MEDICINE',
        'MEDICATION',
        'WALK',
        'MORNING_WALK',
        'READ',
        'SLEEP',
        'BLOOD_PRESSURE',
        'CUSTOM',
        'NONE',
      ],
      default: 'NONE',
    },
    mediaSnapshot: {
      photoUrl: { type: String, default: null },
      audioVoiceUrl: { type: String, default: null },
      note: { type: String, default: null },
      moodEmoji: { type: String, default: null },
    },
    locationAtCheckin: { type: mongoose.Schema.Types.Mixed, default: null },
    isSystemAutoTriggered: { type: Boolean, default: false },
    familyPingRef: {
      senderId: { type: String, default: null },
      senderName: { type: String, default: null },
      promptMessage: { type: String, default: null },
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    versionKey: false,
  },
);

module.exports = mongoose.models.CheckInHistory || mongoose.model('CheckInHistory', CheckInHistorySchema);
