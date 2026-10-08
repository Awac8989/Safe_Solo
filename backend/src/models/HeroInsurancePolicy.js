const crypto = require('crypto');
const mongoose = require('mongoose');

const heroInsurancePolicySchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    incidentId: { type: String, required: true, index: true },
    volunteerId: { type: String, required: true, index: true },
    policyNumber: { type: String, required: true, unique: true },

    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, required: true },

    coverageDetails: {
      postExposureProphylaxisPEP: { type: Boolean, default: true },
      accidentalInjuryMaxLimitVND: { type: Number, default: 20000000 },
      vehicleDamageMaxLimitVND: { type: Number, default: 5000000 },
    },

    // Bù đắp vật tư y tế tiêu hao (First-aid consumable restock)
    restockVoucher: {
      voucherCode: { type: String, default: null },
      itemsIssued: [
        {
          itemType: String, // 'TOURNIQUET_CAT', 'STERILE_GAUZE', 'NITRILE_GLOVES'
          quantity: Number,
        },
      ],
      issuedAt: Date,
      status: {
        type: String,
        enum: ['NONE', 'ISSUED', 'SHIPPED', 'DELIVERED'],
        default: 'NONE',
      },
    },

    claimStatus: {
      type: String,
      enum: ['NONE', 'FILED', 'UNDER_REVIEW', 'APPROVED', 'PAID_OUT', 'REJECTED'],
      default: 'NONE',
    },
    claimDetails: {
      claimType: { type: String, enum: ['BLOOD_EXPOSURE', 'VEHICLE_ACCIDENT', 'PERSONAL_INJURY'] },
      hospitalReportUrl: String,
      policeReportUrl: String,
      estimatedLossVND: Number,
      payoutAmountVND: Number,
      settledAt: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.models.HeroInsurancePolicy || mongoose.model('HeroInsurancePolicy', heroInsurancePolicySchema);
