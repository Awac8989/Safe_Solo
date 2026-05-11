const crypto = require('crypto');
const mongoose = require('mongoose');

const EmergencyMemoSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    incidentId: { type: String, required: true, index: true },
    victimId: { type: String, required: true, index: true },
    duration: { type: Number, required: true },
    victimName: { type: String, default: '' },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    approxAddress: { type: String, default: null },
    contentUrl: { type: String, default: null },
    transcript: { type: String, default: '' },
    isAnonymous: { type: Boolean, default: true },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    versionKey: false,
  },
);

module.exports =
  mongoose.models.EmergencyMemo || mongoose.model('EmergencyMemo', EmergencyMemoSchema);
