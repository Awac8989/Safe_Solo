const crypto = require('crypto');
const mongoose = require('mongoose');

const KYCDocumentSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, unique: true, index: true },
    // Lớp 1: eKYC Định danh pháp lý CCCD
    frontImageUrl: { type: String, required: true },
    backImageUrl: { type: String, required: true },
    faceMatchPercentage: { type: Number, default: 0 },

    // Lớp 2: Medical KYC - Chứng chỉ Chuyên môn Sơ cấp cứu / Y tế
    certificateImageUrl: { type: String, default: null },
    certificateNumber: { type: String, default: null },
    issuingOrganization: {
      type: String,
      enum: [
        'RED_CROSS_VN',
        'EMERGENCY_CENTER_115',
        'AHA_HEARTSAVER',
        'HOSPITAL_TRAINING_CTR',
        'MINISTRY_OF_HEALTH',
        'OTHER_ACCREDITED',
      ],
      default: 'RED_CROSS_VN',
    },
    certificateType: {
      type: String,
      enum: [
        'FIRST_AID_STANDARD',
        'BLS_CPR_AED',
        'PHTLS_TRAUMA',
        'MEDICAL_PRACTICE_LICENSE',
      ],
      default: 'FIRST_AID_STANDARD',
    },
    specialtyTier: {
      type: String,
      enum: ['NONE', 'TIER_1_BLS', 'TIER_2_PHTLS', 'TIER_3_MEDIC'],
      default: 'TIER_1_BLS',
      index: true,
    },
    skillsList: {
      type: [String],
      default: ['CPR_AED', 'AIRWAY_CHOKING'],
    },
    issueDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null, index: true },

    // Sát hạch Trắc nghiệm Lâm sàng
    theoryExamScore: { type: Number, default: 0 },
    theoryExamPassed: { type: Boolean, default: false },
    theoryExamTakenAt: { type: Date, default: null },

    // Cam kết Giới hạn hành nghề
    scopeOfPracticeAgreed: { type: Boolean, default: true },
    scopeOfPracticeAgreedAt: { type: Date, default: Date.now },

    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'],
      default: 'PENDING',
      index: true,
    },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: String, default: null },
    rejectionReason: { type: String, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports =
  mongoose.models.KYCDocument || mongoose.model('KYCDocument', KYCDocumentSchema);
