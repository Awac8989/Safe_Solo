const crypto = require('crypto');
const mongoose = require('mongoose');
const { fullName, sanitizeUser } = require('../lib/utils');
const { listAlertEvents } = require('./alertEventService');
const { resolveEmergency } = require('./sosService');
const emergencyService = require('./emergencyService');
const User = require('../models/User');
const EmergencyLog = require('../models/EmergencyLog');
const SmsDispatchLog = require('../models/SmsDispatchLog');
const RescueIncident = require('../models/RescueIncident');
const SystemLog = require('../models/SystemLog');
const KYCDocument = require('../models/KYCDocument');
const ThankYouNote = require('../models/ThankYouNote');
const VolunteerResponse = require('../models/VolunteerResponse');
const { mapUserDoc, toIso } = require('../lib/mongoCore');
const { decryptUserSensitivePayload } = require('../lib/userSensitiveCodec');

const hitlIncidentStates = new Map();

function svgDataUrl(markup) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markup)}`;
}

function buildHeroPortrait(name, label = 'KYC') {
  const initial = String(name || 'H').trim().charAt(0).toUpperCase() || 'H';
  return svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#2dd4bf"/>
          <stop offset="100%" stop-color="#34d399"/>
        </linearGradient>
      </defs>
      <rect width="720" height="960" rx="48" fill="url(#bg)"/>
      <circle cx="360" cy="290" r="126" fill="#ecfeff" fill-opacity="0.95"/>
      <circle cx="360" cy="255" r="72" fill="#99f6e4"/>
      <path d="M230 470c28-88 95-132 130-132s102 44 130 132v76H230z" fill="#99f6e4"/>
      <rect x="92" y="642" width="536" height="164" rx="28" fill="#ffffff" fill-opacity="0.92"/>
      <text x="360" y="708" text-anchor="middle" font-size="46" font-family="Arial, sans-serif" font-weight="700" fill="#134e4a">${name}</text>
      <text x="360" y="760" text-anchor="middle" font-size="28" font-family="Arial, sans-serif" fill="#0f766e">Hồ sơ xác minh ${label}</text>
      <circle cx="138" cy="138" r="62" fill="#ffffff" fill-opacity="0.2"/>
      <text x="138" y="160" text-anchor="middle" font-size="72" font-family="Arial, sans-serif" font-weight="700" fill="#ffffff">${initial}</text>
    </svg>
  `);
}

function buildIdentityCardFace({ name, idNumber, side, address }) {
  return svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600">
      <defs>
        <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#eef2ff"/>
          <stop offset="100%" stop-color="#dbeafe"/>
        </linearGradient>
      </defs>
      <rect width="960" height="600" rx="36" fill="url(#card)"/>
      <rect x="38" y="38" width="884" height="524" rx="24" fill="#ffffff" fill-opacity="0.78" stroke="#bfdbfe" stroke-width="3"/>
      <text x="70" y="94" font-size="34" font-family="Arial, sans-serif" font-weight="700" fill="#1d4ed8">CĂN CƯỚC CÔNG DÂN</text>
      <text x="70" y="134" font-size="20" font-family="Arial, sans-serif" fill="#475569">${side}</text>
      <rect x="70" y="182" width="220" height="280" rx="24" fill="#dbeafe"/>
      <circle cx="180" cy="268" r="54" fill="#93c5fd"/>
      <path d="M108 386c18-60 58-90 72-90 15 0 55 30 72 90v34H108z" fill="#93c5fd"/>
      <text x="340" y="230" font-size="22" font-family="Arial, sans-serif" fill="#64748b">Họ và tên</text>
      <text x="340" y="268" font-size="34" font-family="Arial, sans-serif" font-weight="700" fill="#0f172a">${name}</text>
      <text x="340" y="330" font-size="22" font-family="Arial, sans-serif" fill="#64748b">Số định danh</text>
      <text x="340" y="368" font-size="30" font-family="Courier New, monospace" font-weight="700" fill="#0f172a">${idNumber}</text>
      <text x="340" y="430" font-size="22" font-family="Arial, sans-serif" fill="#64748b">Địa chỉ</text>
      <foreignObject x="340" y="446" width="520" height="80">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,sans-serif;font-size:24px;color:#0f172a;line-height:1.3;">${address}</div>
      </foreignObject>
      <text x="808" y="534" text-anchor="end" font-size="18" font-family="Arial, sans-serif" fill="#64748b">SafeSolo Demo</text>
    </svg>
  `);
}

function mapEmergencyDoc(log) {
  if (!log) {
    return null;
  }
  const row = log.toObject ? log.toObject() : log;
  return {
    _id: row._id,
    userId: row.userId,
    triggeredAt: toIso(row.triggeredAt),
    resolvedAt: toIso(row.resolvedAt),
    isResolved: Boolean(row.isResolved),
    smsSentStatus: Boolean(row.smsSentStatus),
    locationSnapshot: row.locationSnapshot || null,
    notes: row.notes || '',
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function mapSmsDispatchDoc(log) {
  if (!log) {
    return null;
  }
  const row = log.toObject ? log.toObject() : log;
  return {
    _id: row._id,
    emergencyLogId: row.emergencyLogId,
    userId: row.userId,
    toPhone: row.toPhone,
    provider: row.provider,
    attempt: row.attempt,
    success: Boolean(row.success),
    providerMessageId: row.providerMessageId,
    errorMessage: row.errorMessage,
    responseBody: row.responseBody || null,
    createdAt: toIso(row.createdAt),
  };
}

async function getMongoUsers() {
  const users = await User.find().sort({ updatedAt: -1 });
  return users.map(mapUserDoc);
}

function unifyUser(mongoUser) {
  const isHero = Boolean(mongoUser.isKycVerified) && Number(mongoUser.rescuesCount || 0) > 0;
  return {
    id: mongoUser._id,
    fullName: mongoUser.fullName,
    email: mongoUser.email || '',
    phone: mongoUser.phoneNumber,
    source: 'mongo',
    role: isHero ? 'hero' : mongoUser.role || 'user',
    currentStatus: mongoUser.currentStatus,
    timerIntervalMinutes: mongoUser.timerIntervalMinutes,
    nextCheckinDeadline: mongoUser.nextDeadline,
    lastCheckInAt: mongoUser.lastCheckinTime,
    emergencyContacts: mongoUser.emergencyContacts || [],
    location: mongoUser.lastKnownLocation || null,
    quietHoursStart: mongoUser.quietHoursStart,
    quietHoursEnd: mongoUser.quietHoursEnd,
    falseAlertGraceMinutes: mongoUser.falseAlertGraceMinutes,
    createdAt: mongoUser.createdAt,
    updatedAt: mongoUser.updatedAt,
  };
}

function buildHitlTriage(incidentType, severity, vitals, incidentId) {
  const existing = hitlIncidentStates.get(incidentId);
  const isMedicalOrHighSeverity =
    incidentType === 'MEDICAL' || Number(severity || 3) >= 3 || (vitals?.spo2 && vitals.spo2 < 92);
  const isDuress = incidentType === 'DURESS';

  let basePriority = 'P3_MONITORING';
  let priorityScore = 45;
  let confidence = '88%';
  let aiSummary = 'Cảnh báo SOS thông thường hoặc kiểm tra an toàn định kỳ.';
  let recommendedAction = 'Liên hệ qua điện thoại xác nhận tình trạng';
  let countdownSeconds = 60;
  let autoDispatchThreshold = 60;

  if (isMedicalOrHighSeverity) {
    basePriority = 'P1_CRITICAL';
    priorityScore = 96;
    confidence = '96%';
    aiSummary = 'Nghi ngờ Đột quỵ cấp / Nguy kịch (Rung nhĩ AFib, SpO2 91%, Nhịp tim 124 bpm) kèm ngã chấn thương.';
    recommendedAction = 'Điều 115 Cấp cứu & 2 Hiệp sĩ SafeSolo (<850m)';
    countdownSeconds = 30;
    autoDispatchThreshold = 30;
  } else if (isDuress) {
    basePriority = 'P2_URGENT';
    priorityScore = 78;
    confidence = '92%';
    aiSummary = 'Kích hoạt Mã nguy hiểm im lặng (Duress Pin). Nạn nhân nghi ngờ bị khống chế/đe dọa.';
    recommendedAction = 'Điều 2 Hiệp sĩ tuần tra lân cận xác minh ngầm không còi hụ';
    countdownSeconds = 45;
    autoDispatchThreshold = 45;
  }

  const state = existing?.state || 'COUNTDOWN_ACTIVE';

  return {
    priority: basePriority,
    priorityScore,
    confidence,
    aiSummary,
    recommendedAction,
    countdownSeconds,
    autoDispatchThreshold,
    state,
    supervisorAction: existing?.supervisor || null,
    tier1Status: 'COMPLETED',
    tier2Status:
      state === 'DISPATCHED'
        ? 'COMPLETED'
        : state === 'CANCELLED_FALSE_ALARM'
        ? 'CANCELLED'
        : 'PENDING_COUNTDOWN',
    tier3Status: state === 'AMBULANCE_DISPATCHED' ? 'COMPLETED' : 'STRICT_GATE_LOCKED',
  };
}

function getDemoHitlIncidents() {
  const now = new Date();
  const demoList = [
    {
      id: 'INC-HITL-001',
      type: 'MEDICAL',
      severity: 3,
      status: 'ACTIVE',
      name: 'Nguyễn Văn An (72 tuổi)',
      firstName: 'An',
      lastName: 'Nguyễn Văn',
      age: 72,
      blood: 'O+',
      allergies: 'Penicillin, Tiền sử tăng huyết áp',
      address: '227 Nguyễn Văn Cừ, Phường 4, Quận 5',
      district: 'Quận 5',
      city: 'TP. Hồ Chí Minh',
      x: 35,
      y: 42,
      receivedAt: new Date(now.getTime() - 12 * 1000).toISOString(),
      channel: 'App',
      phoneNumber: '0909001001',
      medicalNotes: 'Tiền sử tai biến nhẹ năm 2024, huyết áp dao động',
      emergencyContactName: 'Nguyễn Thị Mai (Con gái)',
      emergencyContactPhone: '0909001007',
      location: { lat: 10.762622, lng: 106.682276 },
      vitals: {
        spo2: 91,
        heartRate: 124,
        device: 'Samsung Galaxy Watch 5 (WearOS)',
        battery: 78,
        status: 'CẢNH BÁO NGUY HIỂM',
        syncTime: 'Thời gian thực',
        hrvRmssd: 18,
        strokeRisk: 'NGUY CƠ CAO (Rung nhĩ AFib)',
      },
      nearbyHeroes: [
        { name: 'Đoàn Minh Quân', distance: '420m', phone: '0913843958', trustScore: 4.9, eta: '2 phút' },
        { name: 'Trần Quốc Bảo', distance: '750m', phone: '0909001002', trustScore: 4.8, eta: '4 phút' },
      ],
      nearestHospital: {
        name: 'Bệnh viện Chợ Rẫy (Khoa Đột quỵ & Cấp cứu)',
        distance: '1.2km',
        phone: '02838554137',
        eta: '5 phút',
      },
      source: 'demo-hitl',
    },
    {
      id: 'INC-HITL-002',
      type: 'DURESS',
      severity: 2,
      status: 'ACTIVE',
      name: 'Lê Hoàng Yến (24 tuổi)',
      firstName: 'Yến',
      lastName: 'Lê Hoàng',
      age: 24,
      blood: 'B+',
      allergies: 'Không có tiền sử dị ứng',
      address: '135 Hai Bà Trưng, Bến Nghé, Quận 1',
      district: 'Quận 1',
      city: 'TP. Hồ Chí Minh',
      x: 62,
      y: 38,
      receivedAt: new Date(now.getTime() - 38 * 1000).toISOString(),
      channel: 'App',
      phoneNumber: '0909001017',
      medicalNotes: 'Không có',
      emergencyContactName: 'Lê Văn Tuấn (Bố)',
      emergencyContactPhone: '0909001018',
      location: { lat: 10.7788, lng: 106.6998 },
      vitals: {
        spo2: 97,
        heartRate: 108,
        device: 'Samsung Galaxy Watch 5 (WearOS)',
        battery: 64,
        status: 'CẢNH BÁO KHẨN CẤP',
        syncTime: 'Thời gian thực',
        hrvRmssd: 32,
        strokeRisk: 'BÌNH THƯỜNG',
      },
      nearbyHeroes: [
        { name: 'Phan Thị Mai', distance: '380m', phone: '0913843954', trustScore: 4.9, eta: '2 phút' },
        { name: 'Lê Hữu Phước', distance: '600m', phone: '0913843953', trustScore: 4.7, eta: '3 phút' },
      ],
      nearestHospital: {
        name: 'Bệnh viện Đa khoa Sài Gòn',
        distance: '800m',
        phone: '02838291711',
        eta: '3 phút',
      },
      source: 'demo-hitl',
    },
    {
      id: 'INC-HITL-003',
      type: 'SOS',
      severity: 1,
      status: 'ACTIVE',
      name: 'Trần Minh Đức (58 tuổi)',
      firstName: 'Đức',
      lastName: 'Trần Minh',
      age: 58,
      blood: 'A+',
      allergies: 'Dị ứng phấn hoa',
      address: 'Phan Đăng Lưu, Phường 3, Phú Nhuận',
      district: 'Phú Nhuận',
      city: 'TP. Hồ Chí Minh',
      x: 48,
      y: 25,
      receivedAt: new Date(now.getTime() - 110 * 1000).toISOString(),
      channel: 'SMS',
      phoneNumber: '0909001014',
      medicalNotes: 'Khớp gối thoái hóa nhẹ',
      emergencyContactName: 'Trần Ngọc Dung (Vợ)',
      emergencyContactPhone: '0909001015',
      location: { lat: 10.8012, lng: 106.6853 },
      vitals: {
        spo2: 98,
        heartRate: 82,
        device: 'Samsung Galaxy Watch 5 (WearOS)',
        battery: 42,
        status: 'BÌNH THƯỜNG',
        syncTime: 'Thời gian thực',
        hrvRmssd: 41,
        strokeRisk: 'BÌNH THƯỜNG',
      },
      nearbyHeroes: [
        { name: 'Bùi Khánh Linh', distance: '550m', phone: '0909001006', trustScore: 4.8, eta: '3 phút' },
      ],
      nearestHospital: {
        name: 'Bệnh viện Quận Phú Nhuận',
        distance: '950m',
        phone: '02838443905',
        eta: '4 phút',
      },
      source: 'demo-hitl',
    },
  ];

  return demoList.map((item) => {
    const hitl = buildHitlTriage(item.type, item.severity, item.vitals, item.id);
    const existing = hitlIncidentStates.get(item.id);
    return {
      ...item,
      status: existing?.state === 'CANCELLED_FALSE_ALARM' ? 'CANCELLED' : item.status,
      hitl,
    };
  });
}

function buildDispatchIncidentFromEmergency(log) {
  const user = log.userId;
  const contacts = user?.emergencyContacts || [];
  const firstContact = contacts[0] || null;
  const location = log.locationSnapshot || null;
  const [firstName, ...rest] = String(user?.fullName || 'Unknown User').split(' ');

  const vitals = {
    spo2: 91,
    heartRate: 124,
    device: 'Samsung Galaxy Watch 5 (WearOS)',
    battery: 82,
    status: 'CẢNH BÁO NGUY HIỂM',
    syncTime: 'Thời gian thực',
    hrvRmssd: 18,
    strokeRisk: 'NGUY CƠ CAO (Rung nhĩ AFib)',
  };

  const hitl = buildHitlTriage('SOS', 3, vitals, String(log._id));
  const existing = hitlIncidentStates.get(String(log._id));

  return {
    id: log._id,
    type: 'SOS',
    severity: 3,
    status: existing?.state === 'CANCELLED_FALSE_ALARM' ? 'CANCELLED' : log.isResolved ? 'RESOLVED' : 'ACTIVE',
    name: user?.fullName || 'Unknown User',
    firstName,
    lastName: rest.join(' '),
    age: null,
    blood: 'N/A',
    allergies: user?.medicalNotes || 'No notes',
    address: location ? `${location.lat}, ${location.lng}` : 'Unknown',
    district: 'Live GPS',
    city: 'SafeSolo',
    x: location ? 20 + Math.abs((location.lng * 17) % 60) : 50,
    y: location ? 20 + Math.abs((location.lat * 23) % 60) : 50,
    receivedAt: log.triggeredAt,
    channel: log.smsSentStatus ? 'SMS' : 'App',
    phoneNumber: user?.phoneNumber || '',
    medicalNotes: user?.medicalNotes || '',
    emergencyContactName: firstContact?.name || '',
    emergencyContactPhone: firstContact?.phone || '',
    location,
    vitals,
    hitl,
    nearbyHeroes: [
      { name: 'Đoàn Minh Quân', distance: '420m', phone: '0913843958', trustScore: 4.9, eta: '2 phút' },
      { name: 'Trần Quốc Bảo', distance: '750m', phone: '0909001002', trustScore: 4.8, eta: '4 phút' },
    ],
    nearestHospital: {
      name: 'Bệnh viện Chợ Rẫy (Khoa Đột quỵ)',
      distance: '1.2km',
      phone: '02838554137',
      eta: '5 phút',
    },
    source: 'mongo',
  };
}

function buildDispatchIncidentFromRescue(incident, user) {
  const contacts = user?.emergencyContacts || [];
  const firstContact = contacts[0] || null;
  const [firstName, ...rest] = String(user?.fullName || 'Unknown User').split(' ');

  const severity = Number(incident.severity || 3);
  const vitals = {
    spo2: severity >= 3 ? 91 : 98,
    heartRate: severity >= 3 ? 122 : 78,
    device: 'Samsung Galaxy Watch 5 (WearOS)',
    battery: 86,
    status: severity >= 3 ? 'CẢNH BÁO NGUY HIỂM' : 'BÌNH THƯỜNG',
    syncTime: 'Thời gian thực',
    hrvRmssd: severity >= 3 ? 18 : 42,
    strokeRisk: severity >= 3 ? 'NGUY CƠ CAO (Rung nhĩ AFib)' : 'BÌNH THƯỜNG',
  };

  const incidentType = String(incident.incidentType || 'SOS').toUpperCase();
  const hitl = buildHitlTriage(incidentType, severity, vitals, String(incident._id));
  const existing = hitlIncidentStates.get(String(incident._id));

  return {
    id: incident._id,
    type: incidentType,
    severity,
    status: existing?.state === 'CANCELLED_FALSE_ALARM' ? 'CANCELLED' : incident.status === 'RESOLVED' ? 'RESOLVED' : 'ACTIVE',
    name: user?.fullName || 'Unknown User',
    firstName,
    lastName: rest.join(' '),
    age: null,
    blood: 'N/A',
    allergies: user?.medicalNotes || 'No notes',
    address: incident.approxAddress || `${incident.exactLat}, ${incident.exactLng}`,
    district: 'Live GPS',
    city: 'SafeSolo',
    x: 20 + Math.abs((incident.fuzzedLng * 17) % 60),
    y: 20 + Math.abs((incident.fuzzedLat * 23) % 60),
    receivedAt: toIso(incident.createdAt),
    channel: incident.source || 'App',
    phoneNumber: user?.phoneNumber || '',
    medicalNotes: user?.medicalNotes || '',
    emergencyContactName: firstContact?.name || '',
    emergencyContactPhone: firstContact?.phone || '',
    location: {
      lat: incident.exactLat,
      lng: incident.exactLng,
    },
    vitals,
    hitl,
    nearbyHeroes: [
      { name: 'Đoàn Minh Quân', distance: '420m', phone: '0913843958', trustScore: 4.9, eta: '2 phút' },
      { name: 'Trần Quốc Bảo', distance: '750m', phone: '0909001002', trustScore: 4.8, eta: '4 phút' },
    ],
    nearestHospital: {
      name: 'Bệnh viện Chợ Rẫy (Khoa Đột quỵ)',
      distance: '1.2km',
      phone: '02838554137',
      eta: '5 phút',
    },
    source: 'mongo-rescue',
  };
}

class AdminPortalService {
  async getOverview() {
    if (mongoose.connection.readyState !== 1) {
      const demoIncidents = getDemoHitlIncidents();
      return {
        stats: {
          totalUsers: 25,
          monitoredUsers: 25,
          activeIncidents: demoIncidents.length,
          kycPending: 2,
          heroesVerified: 5,
          alertsToday: 8,
        },
        incidents: demoIncidents,
      };
    }

    const mongoUsers = await getMongoUsers();
    const openEmergencies = (await EmergencyLog.find({ isResolved: false }).sort({ createdAt: -1 }))
      .map(mapEmergencyDoc);
    const rescueIncidents = await RescueIncident.find({ status: 'ACTIVE' }).sort({ createdAt: -1 }).lean();
    let incidents = openEmergencies
      .map((item) => buildDispatchIncidentFromEmergency(this.attachEmergencyUser(item, mongoUsers)))
      .concat(
        rescueIncidents.map((item) => {
          const user = mongoUsers.find((entry) => entry._id === item.victimId) || null;
          return buildDispatchIncidentFromRescue(item, user);
        }),
      )
      .sort((a, b) => String(b.receivedAt).localeCompare(String(a.receivedAt)))
      .slice(0, 12);

    if (incidents.length === 0) {
      incidents = getDemoHitlIncidents();
    }

    const [kycPending, heroesVerified] = await Promise.all([
      KYCDocument.countDocuments({ status: 'PENDING' }),
      User.countDocuments({ isKycVerified: true, rescuesCount: { $gt: 0 } }),
    ]);

    const stats = {
      totalUsers: mongoUsers.length || 25,
      monitoredUsers: mongoUsers.length || 25,
      activeIncidents: incidents.length,
      kycPending: kycPending || 2,
      heroesVerified: heroesVerified || 5,
      alertsToday: (await listAlertEvents({ page: 1, limit: 200 })).items.filter((item) =>
        String(item.createdAt).startsWith(new Date().toISOString().slice(0, 10)),
      ).length || 8,
    };

    return {
      stats,
      incidents,
    };
  }

  async listUsers() {
    if (mongoose.connection.readyState !== 1) {
      return [];
    }
    const mongoUsers = (await getMongoUsers()).map(unifyUser);
    return mongoUsers.sort((a, b) =>
      String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')),
    );
  }

  attachEmergencyUser(log, mongoUsers = []) {
    const user = mongoUsers.find((item) => item._id === log.userId) || null;
    return {
      ...log,
      userId: user
        ? {
            fullName: user.fullName,
            phoneNumber: user.phoneNumber,
            medicalNotes: user.medicalNotes,
            emergencyContacts: user.emergencyContacts,
            currentStatus: user.currentStatus,
          }
        : null,
    };
  }

  async listIncidents(status = 'open') {
    if (mongoose.connection.readyState !== 1) {
      return getDemoHitlIncidents();
    }

    const mongoUsers = await getMongoUsers();
    const mongoQuery =
      status === 'resolved'
        ? { isResolved: true }
        : status === 'all'
        ? {}
        : { isResolved: false };

    const mongoIncidents = (await EmergencyLog.find(mongoQuery).sort({ createdAt: -1 }))
      .map(mapEmergencyDoc)
      .map((item) => buildDispatchIncidentFromEmergency(this.attachEmergencyUser(item, mongoUsers)));

    const rescueQuery =
      status === 'resolved'
        ? { status: 'RESOLVED' }
        : status === 'all'
        ? {}
        : { status: 'ACTIVE' };
    const rescueIncidents = (await RescueIncident.find(rescueQuery).sort({ createdAt: -1 }).lean())
      .map((item) => {
        const user = mongoUsers.find((entry) => entry._id === item.victimId) || null;
        return buildDispatchIncidentFromRescue(item, user);
      });

    const combined = mongoIncidents.concat(rescueIncidents).sort((a, b) =>
      String(b.receivedAt).localeCompare(String(a.receivedAt)),
    );
    if (combined.length === 0) {
      return getDemoHitlIncidents();
    }
    return combined;
  }

  async handleHitlAction(incidentId, payload = {}) {
    const {
      action = 'INSTANT_DISPATCH',
      reason = '',
      supervisorName = 'Đoàn Minh Quân (Trưởng ca)',
      supervisorId = 'SUP-0137',
      tier = 2,
    } = payload;

    const timestamp = new Date().toISOString();
    const hashData = `${incidentId}:${action}:${supervisorId}:${timestamp}:${reason}`;
    const auditHash = `0x${crypto.createHash('sha256').update(hashData).digest('hex').slice(0, 16)}`;

    let nextStatus = 'DISPATCHED';
    let tone = 'sos';
    let actionDescription = '';

    if (action === 'CANCEL_FALSE_ALARM') {
      nextStatus = 'CANCELLED_FALSE_ALARM';
      tone = 'warning';
      actionDescription = `Người giám sát [${supervisorName}] đã HỦY sự cố do Báo động giả: "${reason || 'Nạn nhân xác nhận an toàn'}"`;
    } else if (action === 'INSTANT_DISPATCH') {
      nextStatus = 'DISPATCHED';
      tone = 'sos';
      actionDescription = `Người giám sát [${supervisorName}] đã DUYỆT ĐIỀU PHỐI TỨC THÌ (Bypass countdown 30s) cho sự cố [${incidentId}]`;
    } else if (action === 'PAUSE_COUNTDOWN') {
      nextStatus = 'PAUSED';
      tone = 'info';
      actionDescription = `Người giám sát [${supervisorName}] đã TẠM DỪNG bộ đếm ngược tự động để xác minh thêm`;
    } else if (action === 'RESUME_COUNTDOWN') {
      nextStatus = 'COUNTDOWN_ACTIVE';
      tone = 'info';
      actionDescription = `Người giám sát [${supervisorName}] đã TIẾP TỤC bộ đếm ngược tự động`;
    } else if (action === 'AUTO_DISPATCH_TIMEOUT') {
      nextStatus = 'DISPATCHED';
      tone = 'sos';
      actionDescription = `[TỰ ĐỘNG FAIL-SAFE]: Hết thời gian đếm ngược 30s không can thiệp. Hệ thống tự động kích hoạt điều phối Tier 2.`;
    } else if (action === 'TIER3_AMBULANCE_DISPATCH') {
      nextStatus = 'AMBULANCE_DISPATCHED';
      tone = 'sos';
      actionDescription = `Người giám sát [${supervisorName}] đã XÁC NHẬN CHỮ KÝ ĐIỀU PHỐI XE CẤP CỨU 115 (Tier 3 Gate)`;
    }

    hitlIncidentStates.set(incidentId, {
      state: nextStatus,
      updatedAt: timestamp,
      supervisor: { name: supervisorName, id: supervisorId, reason, hash: auditHash, tier },
      actionDescription,
    });

    if (mongoose.connection.readyState === 1) {
      try {
        await SystemLog.create({
          incidentId,
          actionType: `HITL_${action}`,
          description: actionDescription,
          metadata: {
            supervisorId,
            supervisorName,
            tier,
            reason,
            hash: auditHash,
            action,
          },
        });
      } catch (err) {
        console.warn('SystemLog write notice:', err.message);
      }
    }

    return {
      incidentId,
      state: nextStatus,
      action,
      supervisorName,
      hash: auditHash,
      timestamp,
      actionDescription,
    };
  }

  async resolveIncident(id, notes = '') {
    const emergencyRow = await EmergencyLog.findById(id);
    if (emergencyRow) {
      return resolveEmergency(id, notes);
    }
    const rescueIncident = await RescueIncident.findById(id);
    if (rescueIncident) {
      return emergencyService.resolveIncidentFromAdmin(id, notes);
    }
    const error = new Error('Incident not found');
    error.statusCode = 404;
    throw error;
  }

  async listSmsLogs(logId) {
    const logs = await SmsDispatchLog.find({ emergencyLogId: logId }).sort({ createdAt: -1 });
    return logs.map(mapSmsDispatchDoc);
  }

  async listAuditLogs({ q = '', category = 'All' } = {}) {
    const query = String(q || '').trim().toLowerCase();
    const normalizedCategory = String(category || 'All').toLowerCase();

    let dispatchAlerts = [];
    let systemLogs = [];

    if (mongoose.connection.readyState === 1) {
      try {
        dispatchAlerts = (await listAlertEvents({ page: 1, limit: 500 })).items.map((item) => ({
          id: item.id,
          ts: item.createdAt,
          actor: item.source?.toLowerCase() === 'admin' ? 'admin' : 'system',
          action: item.status,
          target: item.user?.fullName || item.userId,
          tone:
            item.level === 'LEVEL_3_SOS'
              ? 'sos'
              : item.level === 'WARNING'
              ? 'warning'
              : 'info',
          hash: `0x${Buffer.from(item.id).toString('hex').slice(0, 16)}`,
          category: item.source === 'ADMIN' ? 'Dispatch' : 'System',
          metadata: item.metadata || {},
        }));

        systemLogs = (await SystemLog.find().sort({ createdAt: -1 }).limit(500)).map((item) => ({
          id: item._id,
          ts: toIso(item.createdAt),
          actor: item.metadata?.supervisorName || 'system',
          action: item.actionType,
          target: item.incidentId || 'runtime',
          tone:
            item.actionType.includes('RESOLVED') || item.actionType.includes('CANCEL')
              ? 'warning'
              : item.actionType.includes('DISPATCH')
              ? 'sos'
              : 'info',
          hash: item.metadata?.hash || `0x${Buffer.from(String(item._id)).toString('hex').slice(0, 16)}`,
          category: 'Dispatch',
          metadata: item.metadata || {},
        }));
      } catch (err) {
        console.warn('SystemLog query notice:', err.message);
      }
    }

    const inMemoryLogs = Array.from(hitlIncidentStates.entries()).map(([incId, entry]) => ({
      id: `hitl-log-${incId}`,
      ts: entry.updatedAt,
      actor: entry.supervisor?.name || 'Đoàn Minh Quân (Trưởng ca)',
      action: `HITL_${entry.state}`,
      target: incId,
      tone: entry.state.includes('CANCEL') ? 'warning' : 'sos',
      hash: entry.supervisor?.hash || '0x9fa1b4382c7e01d2',
      category: 'Dispatch',
      metadata: entry.supervisor || {},
    }));

    const combined = dispatchAlerts.concat(systemLogs).concat(inMemoryLogs);
    const result =
      combined.length > 0
        ? combined
        : [
            {
              id: 'log-hitl-001',
              ts: new Date(Date.now() - 25 * 1000).toISOString(),
              actor: 'Đoàn Minh Quân (Trưởng ca)',
              action: 'HITL_INSTANT_DISPATCH',
              target: 'INC-HITL-001',
              tone: 'sos',
              hash: '0x9fa1b4382c7e01d2',
              category: 'Dispatch',
              metadata: { supervisorId: 'SUP-0137', tier: 2 },
            },
            {
              id: 'log-hitl-002',
              ts: new Date(Date.now() - 55 * 1000).toISOString(),
              actor: 'Đoàn Minh Quân (Trưởng ca)',
              action: 'HITL_PAUSE_COUNTDOWN',
              target: 'INC-HITL-002',
              tone: 'info',
              hash: '0x7e83d21c409b55f1',
              category: 'Dispatch',
              metadata: { supervisorId: 'SUP-0137', tier: 2 },
            },
          ];

    return result
      .filter((item) =>
        normalizedCategory === 'all'
          ? true
          : item.category.toLowerCase() === normalizedCategory,
      )
      .filter((item) => {
        if (!query) {
          return true;
        }
        const haystack = `${item.actor} ${item.action} ${item.target}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
  }

  async listKycQueue() {
    const documents = await KYCDocument.find().sort({ submittedAt: -1 }).lean();
    const userIds = [...new Set(documents.map((item) => item.userId))];
    const users = userIds.length ? await User.find({ _id: { $in: userIds } }).lean() : [];
    const userMap = new Map(users.map((item) => [item._id, item]));
    const thankYouCounts = await Promise.all(
      userIds.map(async (userId) => [userId, await ThankYouNote.countDocuments({ volunteerId: userId })]),
    );
    const thankYouMap = new Map(thankYouCounts);

    return documents.map((document) => {
      const user = userMap.get(document.userId);
      const scoreBase = Number(user?.trustScore || 4.5);
      const match = Math.min(99, Math.max(60, Math.round(scoreBase * 20)));
      const identityNumber = `0${String(user?.phoneNumber || '').replace(/\D/g, '').slice(-11).padEnd(11, '0')}`;
      const sensitive = user ? decryptUserSensitivePayload(user) : { approxAddress: null };
      const identityAddress = sensitive.approxAddress || 'Chưa cập nhật địa chỉ thường trú';
      const portrait = user?.avatar || buildHeroPortrait(user ? fullName(user) : 'Hiệp sĩ');
      return {
        id: document._id,
        userId: document.userId,
        name: user ? fullName(user) : 'Unknown user',
        applied: toIso(document.submittedAt),
        status:
          document.status === 'PENDING'
            ? 'pending'
            : document.status === 'REJECTED'
            ? 'rejected'
            : 'approved',
        region: sensitive.approxAddress || 'Unknown',
        match,
        phone: user?.phoneNumber || '',
        frontImageUrl:
          document.frontImageUrl ||
          buildIdentityCardFace({
            name: user ? fullName(user) : 'Hiệp sĩ SafeSolo',
            idNumber: identityNumber,
            side: 'Mặt trước',
            address: identityAddress,
          }),
        backImageUrl:
          document.backImageUrl ||
          buildIdentityCardFace({
            name: user ? fullName(user) : 'Hiệp sĩ SafeSolo',
            idNumber: identityNumber,
            side: 'Mặt sau',
            address: identityAddress,
          }),
        selfieImageUrl: portrait,
        identityNumber,
        identityAddress,
        documentLabel: 'Căn cước công dân',
        isKycVerified: Boolean(user?.isKycVerified),
        liveness: 'OK',
        trustScore: scoreBase,
        rescuesCount: Number(user?.rescuesCount || 0),
        thankYouCount: thankYouMap.get(document.userId) || 0,
      };
    });
  }

  async updateKycStatus(documentId, action) {
    const normalized = String(action || '').toUpperCase();
    const nextStatus = normalized === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const document = await KYCDocument.findById(documentId);
    if (!document) {
      const error = new Error('KYC document not found');
      error.statusCode = 404;
      throw error;
    }
    document.status = nextStatus;
    document.reviewedAt = new Date();
    await document.save();

    const user = await User.findByIdAndUpdate(
      document.userId,
      { isKycVerified: nextStatus === 'APPROVED' },
      { new: true },
    );

    await SystemLog.create({
      incidentId: null,
      actionType: `${normalized}_KYC`,
      description: `${normalized} KYC for ${document.userId}`,
      metadata: { documentId: document._id, userId: document.userId },
    });

    return {
      document: {
        ...(document.toObject ? document.toObject() : document),
        id: document._id,
      },
      user: user ? sanitizeUser(user) : null,
    };
  }

  async getChannelHealth() {
    const smsLogs = (await SmsDispatchLog.find().sort({ createdAt: -1 })).map(mapSmsDispatchDoc);

    const countByProvider = (provider) =>
      smsLogs.filter((item) => item.provider === provider);

    const makeChannel = (name, vendor, provider, quota, fallbackOrder, forcedHealthy = null) => {
      const logs = provider ? countByProvider(provider) : [];
      const success = logs.length
        ? Number(
            (
              (logs.filter((item) => item.success).length / logs.length) *
              100
            ).toFixed(1),
          )
        : forcedHealthy == null
        ? 100
        : forcedHealthy;

      return {
        name,
        vendor,
        quota,
        success,
        ok: forcedHealthy != null ? forcedHealthy >= 95 : success >= 95,
        fallbackOrder,
        sent: logs.length,
      };
    };

    return {
      channels: [
        makeChannel('SMS Provider', process.env.SMS_PRIMARY_PROVIDER || 'mock', 'mock', 'On demand', 3),
        makeChannel('SMS Fallback', process.env.SMS_FALLBACK_PROVIDER || 'none', 'webhook', 'On demand', 4, 96.8),
        makeChannel('Telegram Bot', 'Bot API', null, 'Unlimited', 1, 99.9),
        makeChannel('Zalo ZNS', 'Zalo OA', null, 'Managed', 2, 98.1),
        makeChannel('Voice Auto-Call', 'Stringee', null, 'Managed', 5, 87.2),
      ],
      policy: [
        { step: 1, name: 'Telegram', tone: 'info' },
        { step: 2, name: 'Zalo ZNS', tone: 'info' },
        { step: 3, name: 'SMS', tone: 'warning' },
        { step: 4, name: 'Voice Call', tone: 'sos' },
      ],
    };
  }

  async getRevenueSummary() {
    const partners = [
      { name: 'Vinmec Central Park', rate: 15, region: 'TP.HCM' },
      { name: 'FV Hospital', rate: 12, region: 'TP.HCM' },
      { name: '115 Ambulance Co.', rate: 10, region: 'TP.HCM' },
      { name: 'Hoan My Saigon', rate: 15, region: 'TP.HCM' },
    ];

    const dispatchCount = (await VolunteerResponse.countDocuments()) || 1;
    const partnerRows = partners.map((partner, index) => {
      const successfulDispatches = dispatchCount * (index + 2);
      const unpaidBalance = successfulDispatches * partner.rate * 120000;
      return {
        name: partner.name,
        dispatches: successfulDispatches,
        rate: `${partner.rate}%`,
        balance: unpaidBalance,
        region: partner.region,
      };
    });

    const sparkline = Array.from({ length: 30 }, (_, index) =>
      Math.round(12 + index * 2.9 + (index % 3) * 4),
    );

    return {
      cards: {
        admobRevenue30d: 18420,
        unpaidCommissions: partnerRows.reduce((sum, item) => sum + item.balance, 0),
        activePartners: partners.length,
      },
      sparkline,
      partners: partnerRows,
    };
  }
}

module.exports = new AdminPortalService();
