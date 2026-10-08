const crypto = require('crypto');
const mongoose = require('mongoose');

const bloodRelayRequestSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    incidentId: { type: String, required: true, index: true },
    hospitalId: { type: String, required: true },
    hospitalName: { type: String, required: true },
    departmentName: { type: String, default: 'Khoa Cấp Cứu / Huyết học Truyền máu' },

    requestedBloodType: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      required: true,
      index: true,
    },
    unitsRequired: { type: Number, default: 2, min: 1, max: 10 },
    urgencyLevel: {
      type: String,
      enum: ['STAT_IMMEDIATE_30M', 'URGENT_2H', 'STANDARD_6H'],
      default: 'STAT_IMMEDIATE_30M',
    },

    status: {
      type: String,
      enum: ['SEARCHING', 'DISPATCHED', 'EN_ROUTE', 'FULFILLED', 'CANCELLED'],
      default: 'SEARCHING',
      index: true,
    },
    matchedDonors: [
      {
        donorUserId: { type: String, required: true },
        donorBloodType: String,
        distanceMeters: Number,
        acceptedAt: { type: Date, default: Date.now },
        arrivedAtHospitalAt: Date,
        bloodDonationCompleted: { type: Boolean, default: false },
        unitsDonated: { type: Number, default: 0 },
        qrFastTrackCode: String,
      },
    ],
    requestedByDoctorId: { type: String, required: true },
    closedAt: Date,
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.models.BloodRelayRequest || mongoose.model('BloodRelayRequest', bloodRelayRequestSchema);
