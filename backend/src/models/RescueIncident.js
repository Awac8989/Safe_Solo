const crypto = require('crypto');
const mongoose = require('mongoose');

const ACTIVE_STATUSES = [
  'ACTIVE',
  'TRIGGERED',
  'DISPATCHING_R1',
  'DISPATCHING_R2',
  'ACCEPTED',
  'EN_ROUTE',
  'ON_SCENE',
];

const RescueIncidentSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    victimId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: [
        'ACTIVE', // Legacy & general active
        'TRIGGERED', // Vừa kích hoạt, đang đếm ngược
        'DISPATCHING_R1', // Đang quét bán kính Vòng 1 (1.2km)
        'DISPATCHING_R2', // Đang quét bán kính Vòng 2 (4.5km)
        'ACCEPTED', // Hiệp sĩ đã nhận (Atomic lock)
        'EN_ROUTE', // Hiệp sĩ đang di chuyển đến
        'ON_SCENE', // Hiệp sĩ đã có mặt (< 25m)
        'HANDED_OVER_115', // Đã bàn giao bác sĩ/công an
        'RESOLVED_SAFE', // Nạn nhân an toàn, hoàn tất
        'ESCALATED_115', // Hết thời gian chờ, chuyển tổng đài 115
        'CANCELLED_FALSE_ALARM', // Hủy do báo động giả
        'RESOLVED', // Legacy resolved
      ],
      default: 'ACTIVE',
      index: true,
    },
    incidentType: { type: String, required: true },
    severity: { type: Number, default: 3 }, // 1: P0_SILENT, 2: P1_CRITICAL, 3: P2_URGENT, 4: P3_ASSIST
    severityLevel: {
      type: String,
      enum: ['P0_SILENT', 'P1_CRITICAL', 'P2_URGENT', 'P3_ASSIST'],
      default: 'P1_CRITICAL',
    },
    source: { type: String, default: 'SOS' },
    exactLat: { type: Number, required: true },
    exactLng: { type: Number, required: true },
    fuzzedLat: { type: Number, required: true },
    fuzzedLng: { type: Number, required: true },
    approxAddress: { type: String, default: null },
    batteryLevel: { type: Number, default: null },
    communityRequestedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },

    // Thông tin Hiệp sĩ được giao nhiệm vụ
    assignedVolunteerId: { type: String, default: null, index: true },
    backupVolunteerIds: [{ type: String }],
    dispatchRadiusKm: { type: Number, default: 1.2 },

    // Dữ liệu y tế của nạn nhân đóng băng tại thời điểm xảy ra sự cố (Medical Snapshot)
    medicalSnapshot: {
      bloodType: { type: String, default: 'UNKNOWN' },
      allergies: [{ type: String }],
      chronicConditions: [{ type: String }],
      emergencyNotes: { type: String, default: '' },
    },

    // Giám sát hành trình cứu hộ (Watchdog Telemetry)
    telemetry: {
      lastVictimUpdateAt: { type: Date, default: null },
      lastHeroMovementAt: { type: Date, default: null },
      heroSpeedKmh: { type: Number, default: 0 },
      distanceRemainingMeters: { type: Number, default: null },
    },

    // Lịch sử kiểm toán bất biến (Immutable Audit Trail) phục vụ pháp lý & tòa án
    auditTrail: [
      {
        action: { type: String, required: true },
        actorId: { type: String, default: null },
        timestamp: { type: Date, default: Date.now },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
      },
    ],

    // Biên bản bàn giao chuyên môn cho Đội ngũ Cấp cứu 115 / Cơ quan chức năng
    handoffRecord: {
      ambulancePlate: { type: String, default: null },
      paramedicName: { type: String, default: null },
      handedOverAt: { type: Date, default: null },
      qrVerificationHash: { type: String, default: null },
      notes: { type: String, default: '' },
    },

    evidenceAudioUrl: { type: String, default: null },
    legalConsentSigned: { type: Boolean, default: true },
    legalConsentSignedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

RescueIncidentSchema.statics.ACTIVE_STATUSES = ACTIVE_STATUSES;

module.exports =
  mongoose.models.RescueIncident || mongoose.model('RescueIncident', RescueIncidentSchema);
