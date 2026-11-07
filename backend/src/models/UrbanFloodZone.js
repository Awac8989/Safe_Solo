const crypto = require('crypto');
const mongoose = require('mongoose');

const urbanFloodZoneSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    zoneCode: { type: String, required: true, unique: true, index: true },
    zoneName: { type: String, required: true },
    district: { type: String, default: 'TP. Hồ Chí Minh' },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
      },
    },
    currentWaterDepthCm: { type: Number, default: 0 },
    tideState: {
      type: String,
      enum: ['NORMAL_LOW', 'RISING_HIGH_TIDE', 'PEAK_TIDE', 'RECEDING_EBB', 'STAGNANT_RAINWATER'],
      default: 'NORMAL_LOW',
    },
    passabilityStatus: {
      type: String,
      enum: ['PASSABLE_ALL', 'MOTORBIKE_CAUTION', 'CAR_SEDAN_BLOCKED', 'SUV_ONLY', 'IMPASSABLE_BOAT_ONLY'],
      default: 'PASSABLE_ALL',
    },
    electrocutionRisk: { type: Boolean, default: false },
    groundTransformerSubmerged: { type: Boolean, default: false },
    lastReportedAt: { type: Date, default: Date.now },
    reportedBy: {
      type: String,
      enum: ['IOT_ULTRASONIC_SENSOR', 'COMMUNITY_HERO', 'CIVIL_DEFENSE_114', 'METEOROLOGICAL_CENTER'],
      default: 'IOT_ULTRASONIC_SENSOR',
    },
    historicalMaxDepthCm: { type: Number, default: 0 },
    activeWarnings: [{ type: String }],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

urbanFloodZoneSchema.index({ location: '2dsphere' });

module.exports = mongoose.models.UrbanFloodZone || mongoose.model('UrbanFloodZone', urbanFloodZoneSchema);

