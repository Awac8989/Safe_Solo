const crypto = require('crypto');
const mongoose = require('mongoose');

const DeviceSignalSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, index: true },
    signalType: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    versionKey: false,
  },
);

module.exports = mongoose.models.DeviceSignal || mongoose.model('DeviceSignal', DeviceSignalSchema);
