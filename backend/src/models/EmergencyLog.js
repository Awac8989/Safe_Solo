const mongoose = require('mongoose');

const EmergencyLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    triggeredAt: { type: Date, required: true, default: Date.now },
    resolvedAt: { type: Date },
    isResolved: { type: Boolean, default: false },
    smsSentStatus: { type: Boolean, default: false },
    locationSnapshot: {
      lat: Number,
      lng: Number,
      updatedAt: Date,
    },
    notes: { type: String, default: '' },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.model('EmergencyLog', EmergencyLogSchema);