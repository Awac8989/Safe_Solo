const crypto = require('crypto');
const mongoose = require('mongoose');

const ChatRoomSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    roomType: { type: String, enum: ['DIRECT', 'INCIDENT', 'GROUP'], default: 'INCIDENT' },
    title: { type: String, default: '' },
    incidentId: { type: String, default: null, index: true },
    participantIds: { type: [String], default: [], index: true },
    responderIds: { type: [String], default: [] },
    status: { type: String, enum: ['ACTIVE', 'READ_ONLY'], default: 'ACTIVE' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
    closedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.models.ChatRoom || mongoose.model('ChatRoom', ChatRoomSchema);
