const crypto = require('crypto');
const mongoose = require('mongoose');

const InteractionEventSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    source: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    versionKey: false,
  },
);

module.exports = mongoose.models.InteractionEvent || mongoose.model('InteractionEvent', InteractionEventSchema);
