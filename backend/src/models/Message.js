const crypto = require('crypto');
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    roomId: { type: String, required: true, index: true },
    senderId: { type: String, default: null, index: true },
    messageType: {
      type: String,
      enum: ['TEXT', 'AUDIO', 'SYSTEM', 'LOCATION', 'VOICE_NOTE'],
      required: true,
    },
    content: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: false,
    versionKey: false,
  },
);

module.exports = mongoose.models.Message || mongoose.model('Message', MessageSchema);
