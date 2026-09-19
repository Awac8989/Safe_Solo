const crypto = require('crypto');
const mongoose = require('mongoose');

const DisasterAlertSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    category: {
      type: String,
      enum: ['FLOODING', 'LANDSLIDE', 'CRITICAL_DANGER', 'STORM_SURGE', 'ROAD_HAZARD', 'DARK_ROAD'],
      default: 'FLOODING',
      index: true,
    },
    severity: {
      type: String,
      enum: ['CRITICAL', 'WARNING', 'ADVISORY'],
      default: 'CRITICAL',
      index: true,
    },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    radiusMeters: { type: Number, default: 2000 },
    address: { type: String, default: '' },
    safetyAdvice: { type: String, default: '' },
    evacuationRouteTip: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    status: {
      type: String,
      enum: ['ACTIVE', 'RESOLVED', 'EXPIRED'],
      default: 'ACTIVE',
      index: true,
    },
    issuedBy: { type: String, default: 'Ban Điều Phối Cứu Hộ SafeSolo 115/114' },
    broadcastCount: { type: Number, default: 1 },
    resolvedAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports =
  mongoose.models.DisasterAlert || mongoose.model('DisasterAlert', DisasterAlertSchema);
