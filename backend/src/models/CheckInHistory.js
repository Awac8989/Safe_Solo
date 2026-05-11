const crypto = require('crypto');
const mongoose = require('mongoose');

const CheckInHistorySchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, index: true },
    checkinTime: { type: Date, required: true, default: Date.now },
    locationAtCheckin: { type: mongoose.Schema.Types.Mixed, default: null },
    isSystemAutoTriggered: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    versionKey: false,
  },
);

module.exports = mongoose.models.CheckInHistory || mongoose.model('CheckInHistory', CheckInHistorySchema);
