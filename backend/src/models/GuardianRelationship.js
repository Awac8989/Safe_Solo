const crypto = require('crypto');
const mongoose = require('mongoose');

const GuardianRelationshipSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    requesterId: { type: String, required: true, index: true },
    guardianId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'BLOCKED'],
      default: 'PENDING',
      index: true,
    },
    escalationLevel: { type: Number, default: 1, min: 1, max: 3 },
    guardianConfirmedAt: { type: Date, default: null },
    lastNotifiedAt: { type: Date, default: null },
    message: { type: String, default: '' },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports =
  mongoose.models.GuardianRelationship ||
  mongoose.model('GuardianRelationship', GuardianRelationshipSchema);
