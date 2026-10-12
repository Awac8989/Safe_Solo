const crypto = require('crypto');
const mongoose = require('mongoose');

const bloodRelayRequestSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    requestCode: {
      type: String,
      default: () => `BLD-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      unique: true,
      index: true,
    },
    incidentId: { type: String, default: null, index: true },
    patientId: { type: String, default: null },

    targetBloodGroup: {
      type: String,
      required: true,
      index: true,
    },
    compatibleBloodGroups: {
      type: [String],
      default: [],
    },
    unitsRequired: { type: Number, default: 2, min: 1, max: 20 },
    urgencyLevel: {
      type: String,
      enum: ['EXTREME_IMMEDIATE', 'URGENT_1_HOUR', 'HIGH_PRIORITY_4_HOURS', 'STAT_IMMEDIATE_30M', 'URGENT_2H', 'STANDARD_6H'],
      default: 'EXTREME_IMMEDIATE',
    },

    hospitalLocation: {
      hospitalName: { type: String, required: true },
      address: { type: String, default: '' },
      roomOrDepartment: { type: String, default: 'Trung tâm Cấp cứu 115 & Khoa Huyết học Truyền máu' },
      contactPhone: { type: String, default: '02838554137' },
      coordinates: { type: [Number], default: [106.6598, 10.7578] }, // [lng, lat]
    },

    clinicalJustification: {
      type: String,
      default: 'Cấp cứu sốc mất máu ngoại viện do đa chấn thương giao thông đứt động mạch.',
    },

    status: {
      type: String,
      enum: ['PENDING_DONORS', 'DONORS_COMMITTED', 'IN_TRANSIT', 'DELIVERED_AND_FULFILLED', 'CANCELLED', 'SEARCHING', 'DISPATCHED', 'EN_ROUTE', 'FULFILLED'],
      default: 'PENDING_DONORS',
      index: true,
    },

    matchedDonors: [
      {
        donorId: { type: String, required: true },
        donorName: { type: String, default: 'Hiệp sĩ SafeSolo' },
        bloodGroup: { type: String, default: 'O_MINUS' },
        contactPhone: { type: String, default: '' },
        committedUnits: { type: Number, default: 1 },
        status: {
          type: String,
          enum: ['NOTIFIED', 'ACCEPTED', 'ARRIVED', 'DONATED', 'DECLINED'],
          default: 'NOTIFIED',
        },
        etaMinutes: { type: Number, default: 15 },
        distanceKm: { type: Number, default: 2.5 },
        acceptedAt: { type: Date, default: Date.now },
      },
    ],

    requestedByDoctorId: { type: String, default: 'DOC-115-CHORAY' },
    closedAt: Date,
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.models.BloodRelayRequest || mongoose.model('BloodRelayRequest', bloodRelayRequestSchema);
