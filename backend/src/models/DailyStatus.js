const crypto = require('crypto');
const mongoose = require('mongoose');

const DailyStatusSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, index: true },
    moodEmoji: { type: String, required: true, trim: true },
    text: { type: String, default: '' },
    audioUrl: { type: String, default: null },
    visibility: { type: String, enum: ['FAMILY', 'COMMUNITY'], default: 'FAMILY', index: true },
    batteryLevel: { type: Number, default: null },
    isCheckIn: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.models.DailyStatus || mongoose.model('DailyStatus', DailyStatusSchema);
