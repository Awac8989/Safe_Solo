const crypto = require('crypto');
const mongoose = require('mongoose');

const HazardReportSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, index: true },
    authorName: { type: String, default: 'Hiệp sĩ SafeSolo' },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    category: {
      type: String,
      enum: ['DARK_ROAD', 'SUSPICIOUS_PERSON', 'ROAD_HAZARD', 'FLOODING', 'ACCIDENT', 'OTHER'],
      default: 'DARK_ROAD',
      index: true,
    },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    address: { type: String, default: '' },
    status: {
      type: String,
      enum: ['ACTIVE', 'RESOLVED', 'EXPIRED'],
      default: 'ACTIVE',
      index: true,
    },
    isAnonymous: { type: Boolean, default: false },
    confirmCount: { type: Number, default: 1 },
    resolvedCount: { type: Number, default: 0 },
    upvotedUserIds: [{ type: String }],
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports =
  mongoose.models.HazardReport || mongoose.model('HazardReport', HazardReportSchema);
