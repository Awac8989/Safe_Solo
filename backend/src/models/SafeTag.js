const crypto = require('crypto');
const mongoose = require('mongoose');

const safeTagSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    tagCode: { type: String, required: true, unique: true, index: true }, // Mã in khắc laser trên thẻ (e.g. STAG-88219)
    tagType: {
      type: String,
      enum: ['SILICONE_WRISTBAND', 'HELMET_STICKER', 'NECKLACE_PENDANT', 'WALLET_CARD'],
      default: 'SILICONE_WRISTBAND',
    },
    userId: { type: String, required: true, index: true },

    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED', 'LOST_REPORTED'],
      default: 'ACTIVE',
      index: true,
    },

    // Payload công khai hiển thị cho bất kỳ ai quét NFC/QR (Tầng 1)
    publicPayload: {
      displayName: { type: String, required: true },
      bloodType: { type: String, default: 'UNKNOWN' },
      criticalAllergies: [{ type: String }],
      criticalConditions: [{ type: String }], // e.g. ["Đái tháo đường Tuýp 1", "Động kinh"]
      emergencyContacts: [
        {
          relationship: String,
          phoneNumber: String,
        },
      ],
    },

    // Chữ ký bảo mật xác thực nguồn gốc tránh giả mạo
    digitalSignature: { type: String, default: null },

    // Quản lý mã OTP truy cập Tầng 2 lâm sàng
    pendingOtp: {
      code: { type: String, default: null },
      expiresAt: { type: Date, default: null },
      targetPhone: { type: String, default: null },
    },

    // Lịch sử giải tỏa khẩn cấp trực tiếp của Bác sĩ 115 (Emergency Bypass)
    emergencyAccessBypasses: [
      {
        accessedAt: { type: Date, default: Date.now },
        paramedicId: { type: String, required: true },
        paramedicLicense: { type: String, required: true },
        emergencyIncidentId: { type: String, default: null },
        clinicalJustification: { type: String, required: true },
        ipAddress: { type: String, default: '0.0.0.0' },
      },
    ],

    // Lịch sử quét thẻ khẩn cấp ngoại viện
    scanHistory: [
      {
        scannedAt: { type: Date, default: Date.now },
        scannerIp: String,
        scannerUserAgent: String,
        scannedLocation: {
          lat: Number,
          lng: Number,
        },
        accessTier: {
          type: String,
          enum: ['TIER_1_PUBLIC', 'TIER_2_MEDICAL_AUTHENTICATED'],
          default: 'TIER_1_PUBLIC',
        },
        authorizedDoctorOrHeroId: { type: String, default: null },
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.models.SafeTag || mongoose.model('SafeTag', safeTagSchema);
