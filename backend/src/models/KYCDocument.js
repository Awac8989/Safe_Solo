const crypto = require('crypto');
const mongoose = require('mongoose');

const KYCDocumentSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, unique: true, index: true },
    frontImageUrl: { type: String, required: true },
    backImageUrl: { type: String, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports =
  mongoose.models.KYCDocument || mongoose.model('KYCDocument', KYCDocumentSchema);
