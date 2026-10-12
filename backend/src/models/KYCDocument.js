const crypto = require('crypto');
const mongoose = require('mongoose');

const KYCDocumentSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, index: true },

    // Lớp 1: eKYC Định danh pháp lý CCCD gắn chip
    frontImageUrl: { type: String, required: true },
    backImageUrl: { type: String, required: true },
    selfieImageUrl: { type: String, default: null },
    faceMatchPercentage: { type: Number, default: 92 },
    livenessVerified: { type: Boolean, default: true },

    // Lớp 2: Bằng cấp & Thẻ ngành Chuyên môn bắt buộc (Y tá, Công an, Cứu hỏa, Thám hiểm)
    professionCategory: {
      type: String,
      enum: [
        'MEDICAL_NURSE',        // Y tá, Điều dưỡng, Bác sĩ, Paramedic
        'POLICE_SECURITY',       // Công an, Cảnh sát, Lực lượng an ninh
        'FIRE_RESCUE',          // Cảnh sát PCCC & Cứu nạn cứu hộ chuyên nghiệp
        'WILDERNESS_EXPLORER',  // Nhà thám hiểm, Cứu hộ dã ngoại (WFR), Leo núi sinh tồn
        'RED_CROSS_FIRST_AID',  // Tình nguyện viên sơ cấp cứu Chữ Thập Đỏ đạt chuẩn
        'UNQUALIFIED_CIVILIAN', // Chưa có bằng cấp chuyên môn (không đủ chuẩn thăng hạng)
      ],
      default: 'MEDICAL_NURSE',
      index: true,
    },
    credentialName: {
      type: String,
      required: true,
      default: 'Chứng chỉ Chuyên môn Sơ cấp cứu Ngoại viện',
    },
    credentialNumber: {
      type: String,
      required: true,
      default: 'CERT-0001',
    },
    issuingAuthority: {
      type: String,
      required: true,
      default: 'Bộ Y tế & Trung tâm Cấp cứu 115',
    },
    workingUnit: {
      type: String,
      default: 'Trung tâm Cấp cứu Ngoại viện',
    },
    yearsOfExperience: {
      type: Number,
      default: 3,
    },
    credentialImageUrl: {
      type: String,
      default: null,
    },
    credentialBackImageUrl: {
      type: String,
      default: null,
    },

    // Phân bậc năng lực Hiệp Sĩ (Specialty Tier)
    specialtyTier: {
      type: String,
      enum: [
        'TIER_1_BLS',               // Sơ cứu cơ bản BLS / CPR
        'TIER_2_PHTLS',             // Cứu thương tiền viện PHTLS / Chấn thương
        'TIER_3_MEDIC',             // Bác sĩ / Nhân viên y tế chuyên nghiệp
        'TIER_PARAMEDIC_MEDIC',     // Y tá / Bác sĩ cấp cứu ngoại viện (BLS/ACLS)
        'TIER_POLICE_SECURITY',     // Công an / Cảnh sát trấn áp tội phạm & mã Duress
        'TIER_FIRE_RESCUE',         // Cứu hỏa & Cứu nạn cứu hộ chuyên nghiệp (PCCC)
        'TIER_WILDERNESS_EXPLORER', // Nhà thám hiểm & Cứu nạn địa hình hiểm trở (WFR)
        'TIER_BLS_FIRST_AID',       // Sơ cấp cứu Chữ Thập Đỏ cơ bản
        'UNVERIFIED',               // Chưa đủ điều kiện
      ],
      default: 'TIER_PARAMEDIC_MEDIC',
      index: true,
    },
    skillsList: {
      type: [String],
      default: ['CPR_AED', 'AIRWAY_CHOKING'],
    },
    issueDate: { type: Date, default: () => new Date(Date.now() - 365 * 24 * 3600 * 1000) },
    expiryDate: { type: Date, default: () => new Date(Date.now() + 365 * 24 * 3600 * 1000 * 2), index: true },

    // Lớp 3: Sát hạch kiến thức lý thuyết & tình huống thực địa (AHA / CNCH / Pháp lý)
    theoryExamScore: { type: Number, default: 19 }, // Thang điểm 20
    theoryExamPassed: { type: Boolean, default: true },
    theoryExamTakenAt: { type: Date, default: Date.now },

    // Cam kết tuân thủ Điều 87 Luật Khám chữa bệnh 2023 & Giới hạn thẩm quyền
    scopeOfPracticeAgreed: { type: Boolean, default: true },
    scopeOfPracticeAgreedAt: { type: Date, default: Date.now },

    // Trạng thái thẩm định
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
  }
);

module.exports =
  mongoose.models.KYCDocument || mongoose.model('KYCDocument', KYCDocumentSchema);
