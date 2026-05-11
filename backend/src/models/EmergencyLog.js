const crypto = require('crypto');
const mongoose = require('mongoose');

const EmergencyLogSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, index: true },
    triggeredAt: { type: Date, required: true, default: Date.now },
    resolvedAt: { type: Date, default: null },
    isResolved: { type: Boolean, default: false },
    smsSentStatus: { type: Boolean, default: false },
    locationSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    notes: { type: String, default: '' },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.models.EmergencyLog || mongoose.model('EmergencyLog', EmergencyLogSchema);
