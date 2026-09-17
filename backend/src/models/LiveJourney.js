const crypto = require('crypto');
const mongoose = require('mongoose');

const WaypointSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
);

const LiveJourneySchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, index: true },
    destinationLabel: { type: String, default: 'Điểm đến an toàn', trim: true },
    destinationLat: { type: Number, default: null },
    destinationLng: { type: Number, default: null },
    durationMinutes: { type: Number, required: true, default: 20 },
    startedAt: { type: Date, default: Date.now },
    expectedArrivalAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['IN_TRANSIT', 'ARRIVED_SAFE', 'OVERDUE_ALARM', 'CANCELLED'],
      default: 'IN_TRANSIT',
      index: true,
    },
    shareToken: { type: String, default: () => crypto.randomBytes(8).toString('hex'), unique: true, index: true },
    currentLat: { type: Number, default: null },
    currentLng: { type: Number, default: null },
    lastPingAt: { type: Date, default: Date.now },
    batteryLevel: { type: Number, default: null },
    waypoints: [WaypointSchema],
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.models.LiveJourney || mongoose.model('LiveJourney', LiveJourneySchema);
