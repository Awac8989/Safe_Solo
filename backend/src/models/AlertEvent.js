const crypto = require('crypto');
const mongoose = require('mongoose');

const AlertEventSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, index: true },
    level: { type: String, required: true },
    status: { type: String, required: true },
    source: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    versionKey: false,
  },
);

module.exports = mongoose.models.AlertEvent || mongoose.model('AlertEvent', AlertEventSchema);
