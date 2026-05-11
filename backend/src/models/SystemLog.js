const crypto = require('crypto');
const mongoose = require('mongoose');

const SystemLogSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    incidentId: { type: String, default: null, index: true },
    actionType: { type: String, required: true },
    description: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    versionKey: false,
  },
);

module.exports = mongoose.models.SystemLog || mongoose.model('SystemLog', SystemLogSchema);
