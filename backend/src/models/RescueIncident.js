const crypto = require('crypto');
const mongoose = require('mongoose');

const RescueIncidentSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    victimId: { type: String, required: true, index: true },
    status: { type: String, enum: ['ACTIVE', 'RESOLVED'], default: 'ACTIVE' },
    incidentType: { type: String, required: true },
    severity: { type: Number, default: 3 },
    source: { type: String, default: 'SOS' },
    exactLat: { type: Number, required: true },
    exactLng: { type: Number, required: true },
    fuzzedLat: { type: Number, required: true },
    fuzzedLng: { type: Number, required: true },
    approxAddress: { type: String, default: null },
    batteryLevel: { type: Number, default: null },
    communityRequestedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.models.RescueIncident || mongoose.model('RescueIncident', RescueIncidentSchema);
