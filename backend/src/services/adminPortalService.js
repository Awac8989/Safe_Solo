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
const HazardReport = require('../models/HazardReport');
const DisasterAlert = require('../models/DisasterAlert');
const { mapUserDoc, toIso } = require('../lib/mongoCore');
const { decryptUserSensitivePayload } = require('../lib/userSensitiveCodec');

const hitlIncidentStates = new Map();
const incidentSopStates = new Map();

const dangerGeofences = [
  {
    id: 'geo-zone-1',
    name: 'Điểm ngập sâu ngã tư Nguyễn Hữu Cảnh - Ung Văn Khiêm',
    category: 'FLOODING',
    severity: 'CRITICAL',
    center: { lat: 10.7981, lng: 106.7142 },
    radiusMeters: 450,
    address: 'Đường Nguyễn Hữu Cảnh, P. 25, Q. Bình Thạnh',
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    expiresAt: new Date(Date.now() + 3600000 * 8).toISOString(),
    activePeopleCount: 14,
    broadcastCount: 86,
    description: 'Triều cường dâng cao ngập 0.6m, nhiều xe máy chết máy và té ngã.',
  },
  {
    id: 'geo-zone-2',
    name: 'Đoạn đường tối & mất an ninh gầm cầu Ba Son',
    category: 'DARK_ROAD',
    severity: 'WARNING',
    center: { lat: 10.7765, lng: 106.7082 },
    radiusMeters: 350,
    address: 'Khu vực gầm Cầu Ba Son, Bến Nghé, Quận 1',
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    expiresAt: new Date(Date.now() + 3600000 * 36).toISOString(),
    activePeopleCount: 6,
    broadcastCount: 124,
    description: 'Hệ thống đèn đường đang sửa chữa, có phản ánh nhóm đối tượng khả nghi theo đuôi.',
  },
  {
    id: 'geo-zone-3',
    name: 'Khu vực công trình rào chắn & bẫy đinh đường Hoàng Sa',
    category: 'ROAD_HAZARD',
    severity: 'WARNING',
    center: { lat: 10.7892, lng: 106.6921 },
    radiusMeters: 280,
    address: 'Đường Hoàng Sa, P. Đa Kao, Quận 1',
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    expiresAt: new Date(Date.now() + 3600000 * 16).toISOString(),
    activePeopleCount: 9,
    broadcastCount: 42,
    description: 'Đoạn cua hẹp rào tôn che khuất tầm nhìn, phát hiện nhiều đinh kim loại trên mặt đường.',
  },
];

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
  const isHero =
    Boolean(mongoUser.isKycVerified) ||
    String(mongoUser.role || '').toLowerCase() === 'hero' ||
    Number(mongoUser.rescuesCount || 0) > 0;
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
    trustScore: Number(mongoUser.trustScore || 4.8),
    rescuesCount: Number(mongoUser.rescuesCount || 0),
    isKycVerified: Boolean(mongoUser.isKycVerified),
    createdAt: mongoUser.createdAt,
    updatedAt: mongoUser.updatedAt,
  };
}

function selectRealNearbyHeroes(mongoUsers = []) {
  const verifiedHeroes = (mongoUsers || []).filter(
    (u) => Boolean(u.isKycVerified) || String(u.role).toLowerCase() === 'hero' || Number(u.rescuesCount || 0) > 0,
  );

  const fallbackHeroes = [
    { name: 'Đoàn Minh Quân', distance: '380m', phone: '0913843958', trustScore: 4.9, eta: '2 phút' },
    { name: 'Minh Anh Hero', distance: '620m', phone: '0913843951', trustScore: 4.9, eta: '3 phút' },
    { name: 'Bảo An Hero', distance: '850m', phone: '0913843952', trustScore: 4.8, eta: '4 phút' },
  ];

  if (!verifiedHeroes.length) {
    return fallbackHeroes;
  }

  const distances = ['320m', '480m', '650m', '820m', '980m'];
  const etas = ['1 phút', '2 phút', '3 phút', '4 phút', '5 phút'];

  return verifiedHeroes.slice(0, 3).map((hero, idx) => ({
    name: hero.fullName || 'Hiệp sĩ SafeSolo',
    phone: hero.phoneNumber || hero.phone || '0913843958',
    distance: distances[idx % distances.length],
    trustScore: Number(hero.trustScore || 4.8),
    eta: etas[idx % etas.length],
  }));
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

function getDemoHitlIncidents(mongoUsers = []) {
  const realHeroes = selectRealNearbyHeroes(mongoUsers);
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
      nearbyHeroes: realHeroes.slice(0, 2),
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
      nearbyHeroes: realHeroes.length > 2 ? realHeroes.slice(1, 3) : realHeroes.slice(0, 2),
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
      nearbyHeroes: realHeroes.slice(0, 1),
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

function buildDispatchIncidentFromEmergency(log, mongoUsers = []) {
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
    nearbyHeroes: selectRealNearbyHeroes(mongoUsers),
    nearestHospital: {
      name: 'Bệnh viện Chợ Rẫy (Khoa Đột quỵ)',
      distance: '1.2km',
      phone: '02838554137',
      eta: '5 phút',
    },
    source: 'mongo',
  };
}

function buildDispatchIncidentFromRescue(incident, user, mongoUsers = []) {
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
    nearbyHeroes: selectRealNearbyHeroes(mongoUsers),
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
      .map((item) => buildDispatchIncidentFromEmergency(this.attachEmergencyUser(item, mongoUsers), mongoUsers))
      .concat(
        rescueIncidents.map((item) => {
          const user = mongoUsers.find((entry) => entry._id === item.victimId) || null;
          return buildDispatchIncidentFromRescue(item, user, mongoUsers);
        }),
      )
      .sort((a, b) => String(b.receivedAt).localeCompare(String(a.receivedAt)))
      .slice(0, 12);

    if (incidents.length === 0) {
      incidents = getDemoHitlIncidents(mongoUsers);
    }

    const verifiedHeroesCount = mongoUsers.filter(
      (u) => Boolean(u.isKycVerified) || String(u.role).toLowerCase() === 'hero' || Number(u.rescuesCount || 0) > 0,
    ).length;

    const [kycPending] = await Promise.all([
      KYCDocument.countDocuments({ status: 'PENDING' }),
    ]);

    const stats = {
      totalUsers: mongoUsers.length || 25,
      monitoredUsers: mongoUsers.length || 25,
      activeIncidents: incidents.length,
      kycPending: kycPending ?? 0,
      heroesVerified: verifiedHeroesCount || 10,
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
      .map((item) => buildDispatchIncidentFromEmergency(this.attachEmergencyUser(item, mongoUsers), mongoUsers));

    const rescueQuery =
      status === 'resolved'
        ? { status: 'RESOLVED' }
        : status === 'all'
        ? {}
        : { status: 'ACTIVE' };
    const rescueIncidents = (await RescueIncident.find(rescueQuery).sort({ createdAt: -1 }).lean())
      .map((item) => {
        const user = mongoUsers.find((entry) => entry._id === item.victimId) || null;
        return buildDispatchIncidentFromRescue(item, user, mongoUsers);
      });

    const combined = mongoIncidents.concat(rescueIncidents).sort((a, b) =>
      String(b.receivedAt).localeCompare(String(a.receivedAt)),
    );
    if (combined.length === 0) {
      return getDemoHitlIncidents(mongoUsers);
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

  async getHeroRadar() {
    const mongoUsers = await getMongoUsers();
    const verifiedHeroes = mongoUsers.filter(
      (u) => Boolean(u.isKycVerified) || String(u.role).toLowerCase() === 'hero' || Number(u.rescuesCount || 0) > 0,
    );

    // Realistic coordinates spread across Ho Chi Minh City centers
    const baseLocations = [
      { lat: 10.762622, lng: 106.682276, district: 'Quận 5' },
      { lat: 10.776530, lng: 106.700980, district: 'Quận 1' },
      { lat: 10.778840, lng: 106.699820, district: 'Quận 1' },
      { lat: 10.801200, lng: 106.685300, district: 'Phú Nhuận' },
      { lat: 10.785600, lng: 106.689000, district: 'Quận 3' },
      { lat: 10.768900, lng: 106.671200, district: 'Quận 10' },
      { lat: 10.755400, lng: 106.662100, district: 'Quận 5' },
      { lat: 10.805200, lng: 106.695400, district: 'Bình Thạnh' },
    ];

    const equipmentPresets = [
      ['Túi sơ cứu First-Aid', 'Bình xịt', 'Bộ nẹp y tế', 'Đèn pin công suất cao'],
      ['Túi y tế chuẩn Chữ Thập Đỏ', 'Dây câu bình ắc quy', 'Bơm lốp điện'],
      ['Bộ sơ cứu bỏng & chấn thương', 'Cáng cứu thương xếp gọn', 'Găng tay y tế'],
      ['Bộ sơ cấp cứu CPR chuyên dụng', 'Thiết bị đo SpO2 cầm tay', 'Nước muối sinh lý'],
    ];

    const skillsPresets = [
      ['Chứng chỉ Sơ cấp cứu Hội Chữ Thập Đỏ', 'Kỹ thuật ép tim CPR', 'Cố định gãy xương'],
      ['Sơ cứu tai nạn giao thông', 'Xử trí Đột quỵ & AFib', 'Hồi sức tim phổi'],
      ['Ứng phó khẩn cấp ban đêm', 'Sơ cứu ngạt nước & bỏng'],
    ];

    const heroes = (verifiedHeroes.length ? verifiedHeroes : [
      { _id: 'hero-01', fullName: 'Đoàn Minh Quân', phone: '0913843958', trustScore: 4.9, rescuesCount: 12 },
      { _id: 'hero-02', fullName: 'Minh Anh Hero', phone: '0913843951', trustScore: 4.8, rescuesCount: 10 },
      { _id: 'hero-03', fullName: 'Bảo An Hero', phone: '0913843952', trustScore: 4.8, rescuesCount: 11 },
      { _id: 'hero-04', fullName: 'Lê Hữu Phước', phone: '0913843953', trustScore: 4.9, rescuesCount: 12 },
      { _id: 'hero-05', fullName: 'Phan Thị Mai', phone: '0913843954', trustScore: 4.7, rescuesCount: 5 },
      { _id: 'hero-06', fullName: 'Võ Nhật Huy', phone: '0913843955', trustScore: 4.85, rescuesCount: 7 },
    ]).map((hero, idx) => {
      const loc = baseLocations[idx % baseLocations.length];
      const status = idx === 0 ? 'AVAILABLE' : idx === 1 ? 'BUSY' : idx === 4 ? 'OFF_DUTY' : 'AVAILABLE';
      return {
        id: hero.id || hero._id,
        name: hero.fullName,
        phone: hero.phone || hero.phoneNumber || '0913843958',
        role: 'hero',
        status,
        statusLabel: status === 'AVAILABLE' ? 'Sẵn sàng cứu hộ' : status === 'BUSY' ? 'Đang làm nhiệm vụ' : 'Tạm nghỉ',
        trustScore: Number(hero.trustScore || 4.8),
        rescuesCount: Number(hero.rescuesCount || 0),
        battery: Math.max(45, 98 - idx * 7),
        location: {
          lat: loc.lat + (Math.sin(idx * 1.5) * 0.003),
          lng: loc.lng + (Math.cos(idx * 1.5) * 0.003),
          district: loc.district,
        },
        equipment: equipmentPresets[idx % equipmentPresets.length],
        skills: skillsPresets[idx % skillsPresets.length],
        lastSeenAt: new Date(Date.now() - idx * 45 * 1000).toISOString(),
      };
    });

    return heroes;
  }

  async getSafeHavens() {
    return [
      {
        id: 'sh-01',
        name: 'Bệnh viện Chợ Rẫy (Khoa Cấp cứu & Đột quỵ)',
        type: 'HOSPITAL',
        typeLabel: 'Bệnh viện Cấp cứu 115',
        phone: '02838554137',
        address: '201B Nguyễn Chí Thanh, Phường 12, Quận 5',
        location: { lat: 10.7578, lng: 106.6598 },
        available247: true,
        specialty: 'Đột quỵ cấp, AFib, Chấn thương nặng',
      },
      {
        id: 'sh-02',
        name: 'Bệnh viện Đa khoa Sài Gòn',
        type: 'HOSPITAL',
        typeLabel: 'Bệnh viện Đa khoa',
        phone: '02838291711',
        address: '125 Lê Lợi, Phường Bến Thành, Quận 1',
        location: { lat: 10.7719, lng: 106.6989 },
        available247: true,
        specialty: 'Cấp cứu đa khoa nội ngoại trú',
      },
      {
        id: 'sh-03',
        name: 'Bệnh viện Nhân dân Gia Định',
        type: 'HOSPITAL',
        typeLabel: 'Bệnh viện Cấp cứu 115',
        phone: '02838412692',
        address: '1 Nơ Trang Long, Phường 7, Bình Thạnh',
        location: { lat: 10.8038, lng: 106.6948 },
        available247: true,
        specialty: 'Cấp cứu hồi sức tích cực',
      },
      {
        id: 'sh-04',
        name: 'Công an Quận 1 (Trụ sở trực ban)',
        type: 'POLICE',
        typeLabel: 'Đồn Công an',
        phone: '02838297643',
        address: '73 Yersin, Phường Cầu Ông Lãnh, Quận 1',
        location: { lat: 10.7667, lng: 106.6985 },
        available247: true,
        specialty: 'An ninh trật tự, tiếp nhận nguy hại khẩn cấp',
      },
      {
        id: 'sh-05',
        name: 'Công an Phường Bến Nghé',
        type: 'POLICE',
        typeLabel: 'Đồn Công an',
        phone: '02838222384',
        address: '10 Chu Mạnh Trinh, Bến Nghé, Quận 1',
        location: { lat: 10.7812, lng: 106.7029 },
        available247: true,
        specialty: 'Điểm lánh nạn bảo vệ công dân',
      },
      {
        id: 'sh-06',
        name: 'Trạm Trú Ẩn An Toàn - Circle K 24/7',
        type: 'CONVENIENCE',
        typeLabel: 'Trạm An Toàn 24/7',
        phone: '19003110',
        address: '69 Hai Bà Trưng, Bến Nghé, Quận 1',
        location: { lat: 10.7785, lng: 106.7021 },
        available247: true,
        specialty: 'Có camera giám sát, nhân viên trực đêm, sơ cứu cơ bản',
      },
      {
        id: 'sh-07',
        name: 'Trạm Trú Ẩn An Toàn - FamilyMart 24/7',
        type: 'CONVENIENCE',
        typeLabel: 'Trạm An Toàn 24/7',
        phone: '02839151515',
        address: '20C Trần Hưng Đạo, P.Phạm Ngũ Lão, Quận 1',
        location: { lat: 10.7652, lng: 106.6934 },
        available247: true,
        specialty: 'Khu vực sáng đèn 24/7, có nút báo động khẩn',
      },
    ];
  }

  async getThankYouNotes() {
    let mongoNotes = [];
    if (mongoose.connection.readyState === 1) {
      try {
        mongoNotes = await ThankYouNote.find().sort({ createdAt: -1 }).lean();
      } catch (err) {
        console.warn('ThankYouNote read warning:', err.message);
      }
    }

    const fallbackNotes = [
      {
        id: 'note-01',
        victimName: 'Nguyễn Thị Bích (Quận 5)',
        heroName: 'Lê Hữu Phước',
        heroId: 'hero-04',
        rating: 5,
        message: 'Cảm ơn anh Phước đã có mặt chỉ sau 3 phút khi mẹ tôi bị ngã trong nhà tắm lúc nửa đêm. Anh xử lý cố định xương và hướng dẫn sơ cứu rất chuyên nghiệp!',
        date: '15/09/2026',
        tags: ['Cứu hộ té ngã', 'Phản ứng siêu nhanh', 'Chuyên nghiệp'],
      },
      {
        id: 'note-02',
        victimName: 'Trần Văn Hoàng (Quận 1)',
        heroName: 'Đoàn Minh Quân',
        heroId: 'hero-01',
        rating: 5,
        message: 'Đồng hồ báo nhịp tim 124 kèm AFib, tôi hoảng loạn nhưng anh Quân và tổng đài viên đã gọi điện trấn an ngay, đồng thời hướng dẫn nằm nghiêng an toàn đợi xe 115.',
        date: '12/09/2026',
        tags: ['Đột quỵ & AFib', 'Tận tâm', 'Cứu sống kịp thời'],
      },
      {
        id: 'note-03',
        victimName: 'Lê Thùy Dương (Bình Thạnh)',
        heroName: 'Bảo An Hero',
        heroId: 'hero-03',
        rating: 5,
        message: 'Tôi bị hỏng xe giữa đường vắng lúc 1h sáng và kích hoạt mã an toàn. Anh Bảo An xuất hiện hỗ trợ câu bình và hộ tống về tận nhà. Quá tuyệt vời!',
        date: '08/09/2026',
        tags: ['Hộ tống ban đêm', 'An toàn phụ nữ', 'Nhiệt tình'],
      },
      {
        id: 'note-04',
        victimName: 'Phạm Minh Trí (Quận 10)',
        heroName: 'Minh Anh Hero',
        heroId: 'hero-02',
        rating: 5,
        message: 'Cảm ơn đội ngũ SafeSolo và anh Minh Anh. Ứng dụng hoạt động chính xác từng giây, người thân nhận được định vị GPS ngay lập tức.',
        date: '02/09/2026',
        tags: ['DeadMan Switch', 'Định vị chính xác'],
      },
    ];

    if (!mongoNotes.length) {
      return fallbackNotes;
    }

    return mongoNotes.map((note, index) => ({
      id: note._id,
      victimName: note.senderName || `Nạn nhân được cứu #${index + 1}`,
      heroName: note.volunteerName || 'Hiệp sĩ SafeSolo',
      heroId: note.volunteerId,
      rating: Number(note.rating || 5),
      message: note.content || 'Cảm ơn hiệp sĩ đã hỗ trợ khẩn cấp!',
      date: toIso(note.createdAt)?.slice(0, 10) || '2026-09-17',
      tags: ['Cứu trợ khẩn cấp', 'Cộng đồng SafeSolo'],
    }));
  }

  async getIncidentDossier(incidentId) {
    const overview = await this.getOverview();
    const incident = overview.incidents.find((item) => String(item.id) === String(incidentId)) || overview.incidents[0];

    const timestamp = new Date().toISOString();
    const hashData = `${incident.id}:${incident.type}:${incident.name}:${timestamp}:SAFE_SOLO_LEGAL_EVIDENCE`;
    const legalHash = `0x${crypto.createHash('sha256').update(hashData).digest('hex')}`;

    return {
      dossierId: `DOS-${incident.id}`,
      incidentId: incident.id,
      generatedAt: timestamp,
      legalVerificationHash: legalHash,
      jurisdiction: 'TP. Hồ Chí Minh, Việt Nam',
      incidentType: incident.type,
      severity: incident.severity,
      victim: {
        name: incident.name,
        phone: incident.phoneNumber,
        bloodType: incident.blood || 'O+',
        allergies: incident.allergies || 'Không có',
        approxLocation: incident.address,
        exactGps: incident.location,
        emergencyContact: {
          name: incident.emergencyContactName,
          phone: incident.emergencyContactPhone,
        },
      },
      vitalsTelemetry: {
        device: incident.vitals?.device || 'Samsung Galaxy Watch 5 (WearOS)',
        heartRate: incident.vitals?.heartRate || 124,
        spo2: incident.vitals?.spo2 || 91,
        hrvRmssd: incident.vitals?.hrvRmssd || 18,
        battery: incident.vitals?.battery || 78,
        strokeRisk: incident.vitals?.strokeRisk || 'NGUY CƠ CAO (Rung nhĩ AFib)',
        fallDetected: true,
      },
      timeline: [
        { time: 'T-00:00:00', event: 'Nạn nhân kích hoạt SOS / Galaxy Watch 5 phát hiện té ngã chấn thương & AFib nhịp tim 124 bpm.' },
        { time: 'T+00:00:02', event: 'Hệ thống AI SafeSolo tự động phân loại P1_CRITICAL (Độ tin cậy 96%), khởi động đếm ngược HITL 30 giây.' },
        { time: 'T+00:00:05', event: 'Đồng bộ vị trí GPS mờ hóa & gửi thông báo khẩn cấp đa kênh (Telegram Bot, Zalo ZNS) tới Người thân.' },
        { time: 'T+00:00:12', event: 'Điều phối viên Đoàn Minh Quân (SUP-0137) xác thực tín hiệu sinh tồn, duyệt điều phối tức thì (Bypass countdown).' },
        { time: 'T+00:00:18', event: 'Giao nhiệm vụ khẩn cấp cho Hiệp sĩ Lê Hữu Phước (cách 320m) và Hiệp sĩ Phan Thị Mai (cách 480m).' },
        { time: 'T+00:00:25', event: 'Xác nhận chữ ký số Tier 3 Gate: Kích hoạt điều động Xe Cấp Cứu 115 Bệnh viện Chợ Rẫy.' },
      ],
      assignedHeroes: incident.nearbyHeroes || [],
      supervisorSignature: {
        supervisorName: 'Đoàn Minh Quân (Trưởng ca trực)',
        supervisorId: 'SUP-0137',
        digitalSeal: legalHash.slice(0, 18),
        auditStandard: 'ISO 27001 & HITL SafeSolo Security Standard',
      },
    };
  }

  async listHazards() {
    let hazards = await HazardReport.find().sort({ createdAt: -1 });

    // If no hazards in DB yet, auto-seed realistic demo data around TP.HCM
    if (!hazards || hazards.length === 0) {
      const demoHazards = [
        {
          userId: 'demo-user-1',
          authorName: 'Lê Văn Hoàng (Hiệp sĩ Q.5)',
          title: 'Đoạn đường tối thiếu đèn chiếu sáng',
          description: 'Hệ thống đèn đường ngã tư bị chập, đoạn dài 300m rất tối sau 21h, đề phòng cướp giật.',
          category: 'DARK_ROAD',
          lat: 10.7570,
          lng: 106.6630,
          address: 'Giao lộ Nguyễn Tri Phương - An Dương Vương, Phường 8, Quận 5',
          status: 'ACTIVE',
          confirmCount: 7,
          resolvedCount: 0,
        },
        {
          userId: 'demo-user-2',
          authorName: 'Trần Minh Tâm (Cư dân Q.7)',
          title: 'Ngập nước sâu do triều cường 40cm',
          description: 'Đoạn đường ngập nửa bánh xe, nhiều xe máy chết máy, đã có 2 hiệp sĩ cắm chốt hỗ trợ đẩy xe.',
          category: 'FLOODING',
          lat: 10.7420,
          lng: 106.6840,
          address: 'Đường Trần Xuân Soạn (đoạn chân Cầu Tân Thuận), Quận 7',
          status: 'ACTIVE',
          confirmCount: 14,
          resolvedCount: 0,
        },
        {
          userId: 'demo-user-3',
          authorName: 'Đoàn Minh Quân (Trực ban)',
          title: 'Va chạm xe máy tại giao lộ - đang chờ cứu hộ',
          description: 'Va quẹt 2 xe máy, nạn nhân xây xát nhẹ đã được sơ cứu, cảnh sát giao thông đang xử lý.',
          category: 'ACCIDENT',
          lat: 10.7680,
          lng: 106.6710,
          address: 'Ngã tư Lý Thường Kiệt - Đường 3 Tháng 2, Phường 7, Quận 10',
          status: 'ACTIVE',
          confirmCount: 9,
          resolvedCount: 0,
        },
        {
          userId: 'demo-user-4',
          authorName: 'Nguyễn Thị Bích (Người đi bộ)',
          title: 'Đối tượng khả nghi áp sát người đi bộ ban đêm',
          description: 'Hai đối tượng chạy xe Exciter không biển số lượn quanh khu vực công viên, đã báo bảo vệ.',
          category: 'SUSPICIOUS_PERSON',
          lat: 10.7710,
          lng: 106.6950,
          address: 'Công viên 23 Tháng 9 (gần ga xe buýt ngầm), Phạm Ngũ Lão, Quận 1',
          status: 'ACTIVE',
          confirmCount: 12,
          resolvedCount: 0,
        },
        {
          userId: 'demo-user-5',
          authorName: 'Phan Hữu Thắng (Hiệp sĩ Q.3)',
          title: 'Mặt đường sụt lún rào chắn công trình tạm',
          description: 'Hố ga thi công đào đường không đậy nắp cẩn thận, biển báo lỏng lẻo dễ gây té ngã xe máy.',
          category: 'ROAD_HAZARD',
          lat: 10.7810,
          lng: 106.6870,
          address: 'Đường Nam Kỳ Khởi Nghĩa (gần ngã tư Điện Biên Phủ), Phường 7, Quận 3',
          status: 'ACTIVE',
          confirmCount: 5,
          resolvedCount: 0,
        },
        {
          userId: 'demo-user-6',
          authorName: 'Võ Minh Trí (Tài xế công nghệ)',
          title: 'Bẫy đinh rải dốc cầu kênh tẻ',
          description: 'Nghi vấn rải đinh hình thoi dốc cầu hướng Q4 sang Q7, đội tình nguyện đã thu gom được 15 đinh.',
          category: 'ROAD_HAZARD',
          lat: 10.7510,
          lng: 106.6980,
          address: 'Dốc Cầu Kênh Tẻ (hướng Quận 4 sang Quận 7)',
          status: 'RESOLVED',
          confirmCount: 18,
          resolvedCount: 18,
        },
      ];

      try {
        hazards = await HazardReport.insertMany(demoHazards);
      } catch (err) {
        hazards = demoHazards.map((h, i) => ({ ...h, _id: `hz-demo-${i + 1}`, createdAt: new Date().toISOString() }));
      }
    }

    const mapped = (hazards || []).map((h) => {
      const row = h.toObject ? h.toObject() : h;
      const isAccident = row.category === 'ACCIDENT';
      const timemarkPhotoUrl = row.timemarkPhotoUrl || (isAccident ? 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80' : '');
      const timemarkMeta = row.timemarkMeta || (isAccident ? {
        timestamp: '17/09/2026 15:15:20 GMT+7',
        lat: Number(row.lat || 10.7680),
        lng: Number(row.lng || 106.6710),
        address: row.address || 'Ngã tư Lý Thường Kiệt - Đường 3 Tháng 2, Quận 10',
        hash: 'SHA256: 9F2D8A41-7BC9-4B52-8812-E51A18F9C4A2',
        device: 'SafeSolo Cam v2.4 (TimeMark Real-Time Certified)'
      } : null);

      return {
        id: String(row._id),
        title: row.title,
        description: row.description || '',
        category: row.category,
        lat: Number(row.lat),
        lng: Number(row.lng),
        address: row.address || '',
        status: row.status || 'ACTIVE',
        authorName: row.authorName || 'Cộng đồng SafeSolo',
        confirmCount: Number(row.confirmCount || 1),
        resolvedCount: Number(row.resolvedCount || 0),
        timemarkPhotoUrl,
        timemarkMeta,
        severity: row.severity || (isAccident ? 'P1_CRITICAL' : 'P2_URGENT'),
        victimCount: row.victimCount || (isAccident ? '1 người (Bất tỉnh)' : 'Không có'),
        victimCondition: row.victimCondition || (isAccident ? 'Chấn thương chi dưới, bất tỉnh tạm thời' : ''),
        reportedByPhone: row.reportedByPhone || (isAccident ? '0908.115.999' : ''),
        createdAt: toIso(row.createdAt),
      };
    });

    return {
      hazards: mapped,
      stats: {
        total: mapped.length,
        active: mapped.filter((h) => h.status === 'ACTIVE').length,
        resolved: mapped.filter((h) => h.status === 'RESOLVED').length,
        darkRoads: mapped.filter((h) => h.category === 'DARK_ROAD').length,
        floodings: mapped.filter((h) => h.category === 'FLOODING').length,
        accidents: mapped.filter((h) => h.category === 'ACCIDENT').length,
        suspicious: mapped.filter((h) => h.category === 'SUSPICIOUS_PERSON').length,
      },
    };
  }

  async verifyHazard(id, action = 'VERIFY') {
    const hazard = await HazardReport.findById(id);
    if (!hazard) {
      return { id, action, success: true, message: 'Updated in-memory' };
    }
    if (action === 'RESOLVE') {
      hazard.status = 'RESOLVED';
      hazard.resolvedCount = (hazard.resolvedCount || 0) + 1;
    } else {
      hazard.confirmCount = (hazard.confirmCount || 0) + 1;
    }
    await hazard.save();
    return { id, status: hazard.status, confirmCount: hazard.confirmCount, success: true };
  }

  async createHazard(payload) {
    const doc = await HazardReport.create({
      userId: payload.userId || 'admin-dispatcher',
      authorName: payload.authorName || 'Trung tâm Điều phối SafeSolo',
      title: payload.title || 'Khu vực cảnh báo nguy hiểm',
      description: payload.description || '',
      category: payload.category || 'ROAD_HAZARD',
      lat: Number(payload.lat),
      lng: Number(payload.lng),
      address: payload.address || '',
      status: 'ACTIVE',
      confirmCount: 5,
    });
    return { success: true, hazard: doc.toObject() };
  }

  async getMultiVictimVitals() {
    const overview = await this.getOverview();
    const incidents = overview.incidents || [];

    return incidents.map((inc) => {
      const p = inc.hitl?.priority || 'P2_URGENT';
      const isCritical = p === 'P1_CRITICAL';
      return {
        incidentId: inc.id,
        victimName: inc.name,
        victimPhone: inc.phoneNumber,
        age: inc.age || 28,
        blood: inc.blood || 'O+',
        priority: p,
        severity: inc.severity,
        status: inc.status,
        address: inc.address,
        location: inc.location,
        receivedAt: inc.receivedAt,
        vitals: {
          heartRate: inc.vitals?.heartRate || (isCritical ? 128 : 82),
          spo2: inc.vitals?.spo2 || (isCritical ? 91 : 98),
          hrvRmssd: inc.vitals?.hrvRmssd || (isCritical ? 18 : 42),
          strokeRisk: inc.vitals?.strokeRisk || (isCritical ? 'NGUY CƠ CAO (Rung nhĩ AFib)' : 'Bình thường'),
          fallDetected: Boolean(isCritical),
          battery: inc.vitals?.battery || 82,
          device: inc.vitals?.device || 'Samsung Galaxy Watch 5 (WearOS)',
          status: isCritical ? 'CẢNH BÁO NGUY HIỂM' : 'ĐANG THEO DÕI',
          syncTime: 'Trực tiếp qua 4G eSIM',
        },
      };
    });
  }

  async getB2BOverview() {
    const enterprises = [
      {
        id: 'ent-01',
        name: 'Công ty Cổ phần Dịch vụ Bảo vệ Long Hoàng',
        code: 'LONGHOANG-SEC',
        industry: 'Dịch vụ An ninh & Bảo vệ Mục tiêu',
        activeWorkers: 68,
        totalWorkers: 72,
        checkInInterval: 30,
        complianceRate: 98.5,
        alertsToday: 0,
        contactPerson: 'Nguyễn Văn Minh (Trưởng ban An toàn EHS)',
        contactPhone: '0903841122',
        servicePlan: 'ENTERPRISE_LONE_WORKER_PRO',
        activeShifts: [
          { workerName: 'Trần Văn Kiên', post: 'Trạm điện biến áp Hóc Môn (Đêm)', deadline: '15 phút nữa', status: 'ON_TRACK', battery: 88 },
          { workerName: 'Phạm Đức Duy', post: 'Kho hàng lạnh Khu CNC Quận 9', deadline: '5 phút nữa', status: 'PENDING_CHECKIN', battery: 64 },
          { workerName: 'Lê Hoàng Nam', post: 'Tòa nhà văn phòng Landmark 81', deadline: '22 phút nữa', status: 'ON_TRACK', battery: 92 },
        ],
      },
      {
        id: 'ent-02',
        name: 'Đội Giao Hàng Đêm - GHTK Express TP.HCM',
        code: 'GHTK-NIGHT-LOGISTICS',
        industry: 'Vận chuyển & Giao vận 24/7',
        activeWorkers: 124,
        totalWorkers: 130,
        checkInInterval: 60,
        complianceRate: 96.8,
        alertsToday: 1,
        contactPerson: 'Vũ Quốc Toàn (Phó Giám đốc Vận hành)',
        contactPhone: '0918772233',
        servicePlan: 'ENTERPRISE_FLEET_SAFETY',
        activeShifts: [
          { workerName: 'Nguyễn Tiến Dũng', post: 'Tuyến Q.12 - Củ Chi (Xe tải 2.5T)', deadline: '18 phút nữa', status: 'ON_TRACK', battery: 76 },
          { workerName: 'Hoàng Văn Lộc', post: 'Tuyến Bình Chánh - Q.8 (Xe máy)', deadline: '2 phút nữa', status: 'URGENT_CHECKIN', battery: 38 },
        ],
      },
      {
        id: 'ent-03',
        name: 'Trung tâm Kỹ thuật Viễn thông VNPT Net 2',
        code: 'VNPT-FIELD-ENGINEERS',
        industry: 'Hạ tầng Viễn thông & Trạm BTS Cao độ',
        activeWorkers: 45,
        totalWorkers: 48,
        checkInInterval: 45,
        complianceRate: 99.1,
        alertsToday: 0,
        contactPerson: 'Đặng Thanh Tùng (Chuyên viên EHS Cấp cao)',
        contactPhone: '0944889900',
        servicePlan: 'ENTERPRISE_HAZARDOUS_WORK',
        activeShifts: [
          { workerName: 'Đào Xuân Hùng', post: 'Trạm BTS Núi Bà Đen - Leo trụ', deadline: '35 phút nữa', status: 'ON_TRACK', battery: 95 },
          { workerName: 'Bùi Anh Tuấn', post: 'Hầm cáp ngầm đại lộ Võ Văn Kiệt', deadline: '12 phút nữa', status: 'ON_TRACK', battery: 84 },
        ],
      },
      {
        id: 'ent-04',
        name: 'Mạng lưới Cấp cứu 115 Đối tác SafeSolo',
        code: 'EMERGENCY-115-NETWORK',
        industry: 'Y tế Cấp cứu & Bệnh viện',
        activeWorkers: 38,
        totalWorkers: 38,
        checkInInterval: 15,
        complianceRate: 100.0,
        alertsToday: 0,
        contactPerson: 'Bác sĩ CKII Nguyễn Văn Hùng',
        contactPhone: '02838554137',
        servicePlan: 'NATIONAL_PARAMEDIC_TIER',
        activeShifts: [
          { workerName: 'Kíp Cứu Thương Xe 03', post: 'Trực sẵn sàng - BV Chợ Rẫy', deadline: '10 phút nữa', status: 'STANDBY', battery: 100 },
          { workerName: 'Kíp Cứu Thương Xe 07', post: 'Trực sẵn sàng - BV 115', deadline: '10 phút nữa', status: 'STANDBY', battery: 100 },
        ],
      },
    ];

    const totalMonitored = enterprises.reduce((sum, e) => sum + e.activeWorkers, 0);
    const avgCompliance = (enterprises.reduce((sum, e) => sum + e.complianceRate, 0) / enterprises.length).toFixed(1);

    return {
      stats: {
        totalEnterprises: enterprises.length,
        totalMonitoredWorkers: totalMonitored,
        averageComplianceRate: Number(avgCompliance),
        activeShiftsCount: 275,
        alertsTodayCount: 1,
        systemHealth: '99.98% SLA UP',
      },
      enterprises,
    };
  }

  async getHeroFleet() {
    const radarData = await this.getHeroRadar();
    const realHeroes = radarData || [];

    const fleet = realHeroes.map((hero, idx) => {
      const statuses = ['ON_DUTY', 'AVAILABLE', 'ON_MISSION', 'AVAILABLE'];
      const currentStatus = statuses[idx % statuses.length];
      const zones = ['Khu vực Quận 1 - Bến Nghé', 'Khu vực Quận 5 - Chợ Lớn', 'Khu vực Quận 7 - Phú Mỹ Hưng', 'Khu vực Quận 10 - Bắc Hải', 'Khu vực Quận 3 - Bàn Cờ'];
      return {
        id: hero.id || `hero-${idx + 1}`,
        name: hero.name,
        phone: hero.phone,
        trustScore: hero.trustScore,
        rescuesCount: hero.rescuesCount || (12 + idx * 3),
        status: currentStatus,
        location: hero.location,
        zone: zones[idx % zones.length],
        responseEta: `${idx + 2} phút`,
        battery: 85 - idx * 4,
        equippedGear: [
          'Túi sơ cứu đa năng SafeSolo',
          idx % 2 === 0 ? 'Máy sốc tim AED tự động' : 'Đèn pin tuần tra siêu sáng 2000lm',
          'Camera hành trình (Bodycam)',
          'Bộ đàm khẩn cấp PTT',
        ],
        availableBountyVND: (1500000 + idx * 350000),
        ratingStars: 4.9,
      };
    });

    const safeHavensInventory = [
      { name: 'BV Chợ Rẫy (Trạm số 1)', aedStatus: 'SẴN SÀNG (Pin 100%)', oxygenStatus: '100% (2 bình 10L)', firstAidKit: 'Đầy đủ' },
      { name: 'Công an Phường Bến Nghé (Trạm số 2)', aedStatus: 'SẴN SÀNG (Pin 95%)', oxygenStatus: 'Tiêu chuẩn', firstAidKit: 'Đầy đủ' },
      { name: 'Circle K 24/7 Nguyễn Thị Minh Khai (Trạm số 3)', aedStatus: 'SẴN SÀNG (Pin 90%)', oxygenStatus: 'N/A', firstAidKit: 'Vừa bổ sung gạc & nẹp' },
      { name: 'Cây xăng Petrolimex Hàng Xanh (Trạm số 4)', aedStatus: 'ĐANG KIỂM ĐỊNH', oxygenStatus: 'N/A', firstAidKit: 'Cần bổ sung băng ép' },
    ];

    return {
      fleet,
      stats: {
        totalHeroes: fleet.length,
        onDutyCount: fleet.filter((h) => h.status === 'ON_DUTY' || h.status === 'AVAILABLE').length,
        onMissionCount: fleet.filter((h) => h.status === 'ON_MISSION').length,
        totalRescuesThisMonth: 148,
        averageResponseTimeMinutes: 2.8,
        bountyFundPoolVND: 45000000,
        bountyDisbursedThisMonthVND: 18500000,
      },
      safeHavensInventory,
    };
  }

  async disburseHeroBounty(heroId, amount = 200000, reason = 'Hỗ trợ xăng xe & sơ cứu tại chỗ') {
    return {
      success: true,
      heroId,
      disbursedAmountVND: Number(amount),
      reason,
      transferredAt: new Date().toISOString(),
      transactionRef: `BNT-${Date.now().toString().slice(-6)}`,
      digitalSignature: crypto.randomBytes(8).toString('hex').toUpperCase(),
    };
  }

  async getIncidentPlayback(incidentId) {
    const overview = await this.getOverview();
    const incident = overview.incidents.find((item) => String(item.id) === String(incidentId)) || overview.incidents[0];

    const baseLat = incident?.location?.lat || 10.7725;
    const baseLng = incident?.location?.lng || 106.6980;
    const victimName = incident?.name || 'Nguyễn Thị Thu Trang';
    const incidentType = incident?.type || 'SOS';

    const startSec = -45;
    const endSec = 115;
    const relSecondsList = [
      -45, -40, -35, -30, -25, -20, -15, -12, -8, -5, -2, 0, 2, 3, 5, 8, 12, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 100, 110, 115,
    ];

    const timelinePoints = [];
    for (let i = 0; i < relSecondsList.length; i++) {
      const relSec = relSecondsList[i];
      const isBeforeImpact = relSec < 0;
      const isAtImpact = relSec >= -2 && relSec <= 3;

      const progressToImpact = Math.min(1, Math.max(0, (relSec + 45) / 43));
      const latOffset = isBeforeImpact ? (1 - progressToImpact) * 0.0035 : 0;
      const lngOffset = isBeforeImpact ? (1 - progressToImpact) * -0.0042 : (relSec > 20 ? (Math.sin(relSec) * 0.00005) : 0);

      let speedKmH = 0;
      if (relSec < -10) speedKmH = 34 + Math.round(Math.sin(i) * 3);
      else if (relSec < -2) speedKmH = Math.max(0, 32 - (relSec + 10) * 4);
      else speedKmH = 0;

      let heartRate = 74 + Math.round(Math.sin(i * 0.5) * 4);
      if (relSec >= -2 && relSec <= 15) {
        heartRate = Math.min(152, 78 + Math.round((relSec + 2) * 4.5));
      } else if (relSec > 15) {
        heartRate = 124 + Math.round(Math.sin(i) * 4);
      }

      let spo2 = 98;
      if (relSec > 0 && relSec <= 30) {
        spo2 = Math.max(91, 98 - Math.round(relSec * 0.25));
      } else if (relSec > 30) {
        spo2 = 91 + (i % 2 === 0 ? 1 : 0);
      }

      let gForce = 1.0 + Number((Math.sin(i) * 0.08).toFixed(2));
      if (isAtImpact) {
        gForce = relSec === 0 ? 4.8 : 3.2;
      }

      let decibel = 52 + Math.round(Math.random() * 8);
      if (relSec >= -5 && relSec < -1) decibel = 74;
      if (relSec >= -1 && relSec <= 1) decibel = 89;
      if (relSec >= 3 && relSec <= 7) decibel = 81;
      if (relSec >= 15 && relSec <= 40) decibel = 95;

      let eventLabel = null;
      if (relSec === -45) eventLabel = 'Bắt đầu giám sát ca đêm SafeSolo';
      else if (relSec === -5) eventLabel = 'Phát hiện tiếng phanh gấp đột ngột (74dB)';
      else if (relSec === 0) eventLabel = 'Va chạm mạnh (4.8g) & Té ngã tự do';
      else if (relSec === 3) eventLabel = 'Nạn nhân kêu cứu & Nhịp tim tăng vọt 146 bpm';
      else if (relSec === 15) eventLabel = 'Tự động kích hoạt còi báo động khẩn cấp';
      else if (relSec === 35) eventLabel = 'Hệ thống gửi SMS / Zalo cho Người thân ICE';
      else if (relSec === 60) eventLabel = 'Điều phối viên SafeSolo duyệt phái cử cứu hộ';
      else if (relSec === 90) eventLabel = 'Hiệp sĩ Lê Hữu Phước xác nhận đang tiếp cận';

      const sign = relSec < 0 ? '-' : '+';
      const absSec = Math.abs(relSec);
      const m = String(Math.floor(absSec / 60)).padStart(2, '0');
      const s = String(absSec % 60).padStart(2, '0');
      const timeFormatted = `T${sign}${m}:${s}`;

      timelinePoints.push({
        relSec,
        timeFormatted,
        lat: Number((baseLat + latOffset).toFixed(6)),
        lng: Number((baseLng + lngOffset).toFixed(6)),
        speedKmH,
        heartRate,
        spo2,
        gForce,
        decibel,
        eventLabel,
      });
    }

    const eventMilestones = [
      { time: 'T-00:45', title: 'Khởi hành bình thường', desc: 'Tốc độ 34 km/h, nhịp tim 76 bpm, nhịp sinh tồn ổn định.', category: 'NORMAL' },
      { time: 'T-00:05', title: 'Phanh gấp cơ học', desc: 'Phát hiện âm thanh rít bánh phanh 74dB trên đường vắng.', category: 'WARNING' },
      { time: 'T+00:00', title: 'Va chạm chấn thương & Rơi tự do', desc: 'Cảm biến gia tốc phát hiện lực va đập 4.8g. Galaxy Watch ghi nhận cú ngã nghiêm trọng.', category: 'CRITICAL' },
      { time: 'T+00:03', title: 'Tín hiệu âm thanh SOS', desc: 'Microphone ghi nhận tiếng la hét và từ khóa "Cứu tôi với". Nhịp tim vọt lên 146 bpm.', category: 'CRITICAL' },
      { time: 'T+00:15', title: 'Hú còi khẩn cấp & Khóa bằng chứng', desc: 'Kích hoạt còi hú 95dB trên điện thoại và niêm phong file âm thanh vào Hộp đen.', category: 'SYSTEM' },
      { time: 'T+00:35', title: 'Báo động đa kênh Người thân', desc: 'Gửi SMS & tin nhắn Telegram đính kèm vị trí GPS đến số liên lạc khẩn cấp (Bà Mai).', category: 'DISPATCH' },
      { time: 'T+01:00', title: 'Điều phối viên HITL can thiệp', desc: 'Điều phối viên Đoàn Minh Quân (SUP-0137) xác thực tín hiệu, duyệt phái cử tức thì.', category: 'DISPATCH' },
      { time: 'T+01:30', title: 'Hiệp sĩ SafeSolo xuất phát', desc: 'Hiệp sĩ Lê Hữu Phước (cách 320m) nhận nhiệm vụ và đang di chuyển tới hiện trường.', category: 'RESCUE' },
    ];

    const blackboxHash = `0x${crypto.createHash('sha256').update(`${incident.id}:${baseLat}:${baseLng}:BLACKBOX_RECORDER_EVIDENCE`).digest('hex')}`;

    return {
      incidentId: incident.id,
      incidentType,
      victimName,
      deviceModel: incident?.vitals?.device || 'Samsung Galaxy Watch 5 (WearOS)',
      durationSeconds: endSec - startSec,
      startSec,
      endSec,
      baseLocation: { lat: baseLat, lng: baseLng, address: incident?.address || 'Quận 1, TP. HCM' },
      blackboxHash,
      timelinePoints,
      eventMilestones,
      generatedAt: new Date().toISOString(),
    };
  }

  async listGeofences() {
    const totalActive = dangerGeofences.filter((g) => g.status === 'ACTIVE').length;
    const totalMonitored = dangerGeofences.reduce((acc, curr) => acc + (curr.status === 'ACTIVE' ? curr.activePeopleCount : 0), 0);
    const totalBroadcasts = dangerGeofences.reduce((acc, curr) => acc + curr.broadcastCount, 0);

    return {
      geofences: dangerGeofences,
      stats: {
        total: dangerGeofences.length,
        active: totalActive,
        totalMonitoredUsers: totalMonitored,
        totalBroadcastsDispatched: totalBroadcasts,
      },
    };
  }

  async createGeofence(payload = {}) {
    const newId = `geo-zone-${Date.now()}`;
    const durationHours = Number(payload.durationHours) || 12;
    const radiusMeters = Number(payload.radiusMeters) || 350;

    const geofence = {
      id: newId,
      name: String(payload.name || 'Vùng cảnh báo nguy hiểm').trim(),
      category: payload.category || 'ROAD_HAZARD',
      severity: payload.severity || 'WARNING',
      center: {
        lat: Number(payload.lat) || 10.7765,
        lng: Number(payload.lng) || 106.7009,
      },
      radiusMeters,
      address: String(payload.address || 'TP. Hồ Chí Minh').trim(),
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + durationHours * 3600000).toISOString(),
      activePeopleCount: Math.floor(Math.random() * 12) + 3,
      broadcastCount: 0,
      description: String(payload.description || 'Cảnh báo tự động thiết lập bởi Điều phối viên SafeSolo').trim(),
    };

    dangerGeofences.unshift(geofence);
    return geofence;
  }

  async toggleGeofence(id) {
    const geofence = dangerGeofences.find((g) => g.id === id);
    if (!geofence) {
      throw new Error('Geofence zone not found');
    }
    geofence.status = geofence.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    return geofence;
  }

  async deleteGeofence(id) {
    const idx = dangerGeofences.findIndex((g) => g.id === id);
    if (idx !== -1) {
      const removed = dangerGeofences.splice(idx, 1)[0];
      return { success: true, removedId: removed.id };
    }
    return { success: true, removedId: id };
  }

  async broadcastGeofenceAlert(id, customMessage = '') {
    const geofence = dangerGeofences.find((g) => g.id === id);
    if (!geofence) {
      throw new Error('Geofence zone not found');
    }
    geofence.broadcastCount += geofence.activePeopleCount || 10;

    // Auto-create active DisasterAlert so all mobile users in region receive the notification
    try {
      await this.createDisasterAlert({
        title: `[CẢNH BÁO KHẨN CẤP] ${geofence.name}`,
        description: geofence.description || customMessage,
        category: geofence.category || 'FLOODING',
        severity: geofence.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        lat: geofence.center?.lat || 10.7765,
        lng: geofence.center?.lng || 106.7009,
        radiusMeters: geofence.radiusMeters || 1000,
        address: geofence.address || '',
        safetyAdvice: customMessage || 'Khu vực nguy cơ cao. Vui lòng di chuyển theo lộ trình an toàn tránh né vùng rủi ro.',
        evacuationRouteTip: 'Chọn tuyến đường song song không qua vùng cảnh báo.',
        issuedBy: 'Ban Điều Phối Cứu Hộ SafeSolo',
        broadcastCount: geofence.broadcastCount,
      });
    } catch (_) {}

    return {
      success: true,
      geofenceId: geofence.id,
      geofenceName: geofence.name,
      recipientsCount: geofence.activePeopleCount,
      broadcastTimestamp: new Date().toISOString(),
      message: customMessage || `[CẢNH BÁO AN TOÀN SAFESOLO] Bạn đang ở gần vùng rủi ro: ${geofence.name}. Vui lòng giảm tốc độ hoặc chọn lộ trình thay thế.`,
    };
  }

  async listDisasterAlerts() {
    let alerts = await DisasterAlert.find().sort({ createdAt: -1 });
    if (!alerts || alerts.length === 0) {
      const seedAlerts = [
        {
          title: 'CẢNH BÁO SẠT LỞ ĐẤT ĐÈO BẢO LỘC - NGUY HIỂM',
          description: 'Mưa lớn kéo dài gây sạt trượt taluy dương tại Km 104+200, đất đá tràn mặt đường, nguy cơ sạt lở thứ cấp cao.',
          category: 'LANDSLIDE',
          severity: 'CRITICAL',
          lat: 11.4720,
          lng: 107.7260,
          radiusMeters: 5000,
          address: 'Đèo Bảo Lộc, Quốc lộ 20, Tỉnh Lâm Đồng',
          safetyAdvice: 'Tuyệt đối không lưu thông qua đèo trong lúc mưa lớn. Tìm nơi dừng đỗ an toàn tại chân đèo hoặc đi vòng theo hướng Tỉnh lộ 725.',
          evacuationRouteTip: 'Đường tránh Tỉnh lộ 725 qua Huyện Đạ Tẻh ➔ Bảo Lâm.',
          status: 'ACTIVE',
          issuedBy: 'Ban Chỉ Huy PCTT & TKCN / Trực ban SafeSolo',
          broadcastCount: 142,
        },
        {
          title: 'NGẬP NƯỚC SÂU 0.7M ĐƯỜNG TRẦN XUÂN SOẠN TRIỀU CƯỜNG ĐỈNH ĐIỂM',
          description: 'Triều cường sông Sài Gòn vượt mức báo động 3, nước tràn ngập đường sâu trên 60-70cm, nhiều xe chết máy, nguy cơ rò rỉ điện.',
          category: 'FLOODING',
          severity: 'CRITICAL',
          lat: 10.7420,
          lng: 106.6840,
          radiusMeters: 1500,
          address: 'Đường Trần Xuân Soạn (từ Cầu Rạch Ông đến Cầu Tân Thuận), Quận 7, TP.HCM',
          safetyAdvice: 'Không cố đi xe qua vùng nước ngập quá bánh xe. Tránh xa các trạm biến áp, tủ điện ven đường.',
          evacuationRouteTip: 'Di chuyển theo trục Đường Nguyễn Thị Thập hoặc Cầu Kênh Tẻ.',
          status: 'ACTIVE',
          issuedBy: 'Trung tâm Điều phối Cứu hộ SafeSolo Q7',
          broadcastCount: 385,
        },
      ];
      try {
        alerts = await DisasterAlert.insertMany(seedAlerts);
      } catch (_) {
        alerts = seedAlerts.map((a, i) => ({ ...a, _id: `disaster-demo-${i + 1}`, createdAt: new Date() }));
      }
    }

    return (alerts || []).map((a) => {
      const row = a.toObject ? a.toObject() : a;
      return {
        id: String(row._id),
        title: row.title,
        description: row.description || '',
        category: row.category || 'FLOODING',
        severity: row.severity || 'CRITICAL',
        lat: Number(row.lat),
        lng: Number(row.lng),
        radiusMeters: Number(row.radiusMeters || 2000),
        address: row.address || '',
        safetyAdvice: row.safetyAdvice || '',
        evacuationRouteTip: row.evacuationRouteTip || '',
        status: row.status || 'ACTIVE',
        issuedBy: row.issuedBy || 'Ban Điều Phối SafeSolo',
        broadcastCount: Number(row.broadcastCount || 1),
        resolvedAt: toIso(row.resolvedAt),
        createdAt: toIso(row.createdAt),
      };
    });
  }

  async createDisasterAlert(payload = {}) {
    const alert = await DisasterAlert.create({
      title: payload.title || 'Cảnh báo nguy hiểm khẩn cấp',
      description: payload.description || '',
      category: payload.category || 'FLOODING',
      severity: payload.severity || 'CRITICAL',
      lat: Number(payload.lat || 10.7769),
      lng: Number(payload.lng || 106.7009),
      radiusMeters: Number(payload.radiusMeters || 2000),
      address: payload.address || '',
      safetyAdvice: payload.safetyAdvice || '',
      evacuationRouteTip: payload.evacuationRouteTip || '',
      status: 'ACTIVE',
      issuedBy: payload.issuedBy || 'Ban Điều Phối Cứu Hộ SafeSolo',
      broadcastCount: Number(payload.broadcastCount || 1),
    });

    // Also auto create/sync a hazard report so community feed shows it
    try {
      await HazardReport.create({
        userId: 'admin-dispatcher',
        authorName: 'BAN ĐIỀU PHỐI SAFESOLO (ADMIN)',
        title: alert.title,
        description: `${alert.description}\n\n[Khuyến cáo an toàn]: ${alert.safetyAdvice}`,
        category: alert.category,
        lat: alert.lat,
        lng: alert.lng,
        address: alert.address,
        status: 'ACTIVE',
        confirmCount: 50,
        isAdminBroadcast: true,
        severity: alert.severity === 'CRITICAL' ? 'P1_CRITICAL' : 'P2_URGENT',
      });
    } catch (_) {}

    return alert.toObject ? alert.toObject() : alert;
  }

  async resolveDisasterAlert(id) {
    const alert = await DisasterAlert.findById(id);
    if (!alert) {
      return { success: false, message: 'Disaster alert not found' };
    }
    alert.status = 'RESOLVED';
    alert.resolvedAt = new Date();
    await alert.save();
    return { success: true, alert: alert.toObject ? alert.toObject() : alert };
  }

  async getAiIncidentBriefing(incidentId) {
    const overview = await this.getOverview();
    const incident = overview.incidents.find((item) => String(item.id) === String(incidentId)) || overview.incidents[0];

    const existingState = incidentSopStates.get(String(incident.id));
    const initialSteps = [
      {
        code: 'SOP_VERIFY_GUARDIAN',
        label: 'Xác thực định vị & Ping đa kênh cho người thân (Guardian Circle)',
        status: 'COMPLETED',
        autoExecuted: true,
        completedAt: new Date(Date.now() - 45000).toISOString(),
        actor: 'Hệ thống SafeSolo Auto-Dispatch',
        description: 'Đã gửi tọa độ GPS mờ hóa & thông báo khẩn qua Zalo ZNS và Telegram Bot.',
      },
      {
        code: 'SOP_DISPATCH_HEROES',
        label: 'Phái cử 2 Hiệp sĩ sơ cấp cứu SafeSolo gần nhất (< 600m)',
        status: 'COMPLETED',
        autoExecuted: true,
        completedAt: new Date(Date.now() - 25000).toISOString(),
        actor: 'Đoàn Minh Quân (SUP-0137)',
        description: 'Hiệp sĩ Lê Hữu Phước (cách 320m) và Phan Thị Mai (cách 480m) đã nhận nhiệm vụ.',
      },
      {
        code: 'SOP_REMOTE_SIREN',
        label: 'Kích hoạt còi hú âm lượng tối đa 100dB từ xa trên điện thoại nạn nhân',
        status: 'PENDING',
        autoExecuted: false,
        canExecute: true,
        description: 'Phát còi báo động xua đuổi kẻ gian và hỗ trợ người đi đường nhanh chóng phát hiện nạn nhân.',
      },
      {
        code: 'SOP_DISPATCH_115',
        label: 'Xuất hồ sơ y tế & Chuyển giao xe Cấp cứu 115 Bệnh viện Chợ Rẫy',
        status: incident.hitl?.state === 'AMBULANCE_DISPATCHED' ? 'COMPLETED' : 'PENDING',
        autoExecuted: false,
        canExecute: true,
        description: 'Chuyển gói dữ liệu tiền sử bệnh (Nhóm máu O+, hen suyễn) và sinh tồn cho kíp cấp cứu 115.',
      },
      {
        code: 'SOP_START_3WAY_CALL',
        label: 'Khởi tạo phòng đàm thoại khẩn cấp 3 bên (Điều phối viên - Nạn nhân - Hiệp sĩ)',
        status: 'PENDING',
        autoExecuted: false,
        canExecute: true,
        description: 'Mở kênh PTT Voice VoIP trực tiếp để hướng dẫn nạn nhân giữ bình tĩnh và hỗ trợ hiệp sĩ tìm ngõ.',
      },
    ];

    const sopSteps = existingState ? existingState.sopSteps : initialSteps;

    return {
      incidentId: incident.id,
      victimName: incident.name,
      incidentType: incident.type,
      credibilityScore: 98,
      credibilityVerdict: 'XÁC THỰC CAO (98% Sự cố thực tế / 2% Báo động giả)',
      riskLevel: incident.severity >= 4 ? 'CỰC KỲ NGUY HIỂM (P1_CRITICAL)' : 'NGUY HIỂM (P2_URGENT)',
      multimodalAnalysis: {
        audio: {
          decibelPeak: 88,
          detectedKeywords: ['cứu tôi với', 'đau quá', 'tiếng va chạm xe'],
          transcript: 'Phát hiện tiếng rít phanh gấp (1.8s) -> Va chạm cơ học 88dB -> Nạn nhân la hét "Đau chân quá, cứu tôi với!" ở giây thứ 3.',
          ambientStatus: 'Đường vắng đêm khuya, không có tạp âm phụ huynh/trẻ em đùa nghịch.',
        },
        motion: {
          impactG: 4.8,
          freeFallDurationMs: 650,
          postImpactImmobilitySeconds: 45,
          status: 'Té ngã chấn thương & Bất động (Man-Down Protocol kích hoạt)',
        },
        biometrics: {
          baselineHr: 76,
          peakHr: 146,
          currentHr: incident.vitals?.heartRate || 124,
          spo2: incident.vitals?.spo2 || 91,
          rhythm: incident.vitals?.strokeRisk || 'Rung nhĩ kịch phát (AFib) - Nguy cơ sốc chấn thương',
        },
        medicalContext: {
          bloodType: incident.blood || 'O+',
          allergies: incident.allergies || 'Không có',
          chronicConditions: 'Hen suyễn nhẹ',
          emergencyContact: `${incident.emergencyContactName} - ${incident.emergencyContactPhone}`,
        },
      },
      goldenHourPrognosis: {
        remainingMinutes: 11,
        risk: 'NGUY CƠ TỤT HUYẾT ÁP & THIẾU OXY NÃO',
        advice: 'Cần can thiệp nẹp cố định chi & hỗ trợ hô hấp trong vòng 11 phút để ngăn ngừa thiếu máu cục bộ.',
      },
      sopSteps,
      generatedAt: new Date().toISOString(),
    };
  }

  async executeSopAction(incidentId, actionCode, payload = {}) {
    const briefing = await this.getAiIncidentBriefing(incidentId);
    const steps = briefing.sopSteps;
    const targetStep = steps.find((s) => s.code === actionCode);

    if (!targetStep) {
      throw new Error(`SOP Action code ${actionCode} not found`);
    }

    targetStep.status = 'COMPLETED';
    targetStep.completedAt = new Date().toISOString();
    targetStep.actor = payload.supervisorName || 'Đoàn Minh Quân (Trưởng ca SUP-0137)';
    targetStep.note = payload.note || 'Thực thi 1-chạm thành công';

    incidentSopStates.set(String(incidentId), { sopSteps: steps });

    return {
      success: true,
      incidentId,
      actionCode,
      updatedStep: targetStep,
      sopSteps: steps,
      executedAt: new Date().toISOString(),
    };
  }
}

module.exports = new AdminPortalService();
