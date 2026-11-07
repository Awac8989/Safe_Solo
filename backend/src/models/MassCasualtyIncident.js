const crypto = require('crypto');
const mongoose = require('mongoose');

const massCasualtyIncidentSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    mciCode: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    incidentType: {
      type: String,
      enum: ['APARTMENT_FIRE', 'MULTI_VEHICLE_COLLISION', 'STRUCTURAL_COLLAPSE', 'CHEMICAL_LEAK', 'EXPLOSION', 'OTHER'],
      default: 'APARTMENT_FIRE',
    },
    mciLevel: {
      type: String,
      enum: ['LEVEL_1_SMALL', 'LEVEL_2_MEDIUM', 'LEVEL_3_MAJOR'],
      default: 'LEVEL_1_SMALL',
    },
    status: {
      type: String,
      enum: ['DECLARED', 'TRIAGE_IN_PROGRESS', 'TRANSPORTING', 'ALL_CLEARED'],
      default: 'DECLARED',
      index: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
      },
      address: { type: String, default: '' },
    },
    declaredBy: { type: String, default: 'CHỈ HUY TRƯỞNG TÁC CHIẾN 115' },
    casualtyTally: {
      red: { type: Number, default: 0 },
      yellow: { type: Number, default: 0 },
      green: { type: Number, default: 0 },
      black: { type: Number, default: 0 },
      totalTagged: { type: Number, default: 0 },
      totalTransported: { type: Number, default: 0 },
    },
    victims: [
      {
        victimTagId: { type: String, required: true },
        triageCategory: {
          type: String,
          enum: ['RED', 'YELLOW', 'GREEN', 'BLACK'],
          required: true,
        },
        priorityRank: { type: Number, default: 1 },
        clinicalAssessment: {
          canWalk: Boolean,
          spontaneousBreathing: Boolean,
          airwayRepositioned: Boolean,
          breathsAfterAirwayOpen: Boolean,
          respiratoryRate: Number,
          capillaryRefillSec: Number,
          radialPulsePresent: Boolean,
          canFollowSimpleCommands: Boolean,
        },
        triageRationale: String,
        assignedHospital: {
          hospitalCode: String,
          hospitalName: String,
          etaMinutes: Number,
        },
        decontaminationRequired: { type: Boolean, default: false },
        transportStatus: {
          type: String,
          enum: ['PENDING_AMBULANCE', 'IN_TRANSIT', 'ARRIVED_AT_HOSPITAL'],
          default: 'PENDING_AMBULANCE',
        },
        taggedAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

massCasualtyIncidentSchema.index({ location: '2dsphere' });

module.exports =
  mongoose.models.MassCasualtyIncident ||
  mongoose.model('MassCasualtyIncident', massCasualtyIncidentSchema);

