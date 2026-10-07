const crypto = require('crypto');
const mongoose = require('mongoose');

const VolunteerResponseSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    incidentId: { type: String, required: true, index: true },
    volunteerId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: [
        'ALERTED', // Đã nhận push báo động đỏ
        'ACCEPTED', // Đã trượt nhận nhiệm vụ
        'EN_ROUTE', // Đang phóng xe tới hiện trường
        'ARRIVED', // Đã đến hiện trường (< 25m)
        'ON_SCENE', // Đang thực hiện sơ cứu tại hiện trường
        'REJECTED', // Chủ động từ chối
        'TIMEOUT', // Hết 30s không phản hồi
        'ABANDONED_TIMEOUT', // Bị thu hồi và phạt do đứng im > 90s
        'COMPLETED', // Hoàn thành bàn giao an toàn
      ],
      default: 'EN_ROUTE',
      index: true,
    },

    // Bảo vệ pháp lý Good Samaritan Shield (Luật KCB 2023)
    goodSamaritanAgreementSigned: { type: Boolean, default: true },
    signedAt: { type: Date, default: Date.now },

    // Ghi nhận sơ cấp cứu thực tế tại hiện trường
    firstAidActionsPerformed: [
      {
        actionType: {
          type: String,
          enum: [
            'CPR',
            'TOURNIQUET_HEMOSTASIS',
            'AIRWAY_RECOVERY',
            'RECOVERY_POSITION',
            'AED_SHOCK',
            'OTHER',
          ],
        },
        startedAt: { type: Date, default: Date.now },
        durationSeconds: { type: Number, default: 0 },
        notes: { type: String, default: '' },
      },
    ],

    etaSeconds: { type: Number, default: null },
    distanceMeters: { type: Number, default: null },

    // Tọa độ cập nhật cuối cùng của Hiệp sĩ khi di chuyển
    lastLocationUpdate: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      updatedAt: { type: Date, default: null },
      speedKmh: { type: Number, default: 0 },
    },

    rejectionReason: { type: String, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports =
  mongoose.models.VolunteerResponse ||
  mongoose.model('VolunteerResponse', VolunteerResponseSchema);
