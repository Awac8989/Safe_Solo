const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataDir = path.join(__dirname, '../../data');
const dataFile = path.join(dataDir, 'app-db.json');

function nowIso() {
  return new Date().toISOString();
}

function plusHours(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function createSeed() {
  const now = nowIso();
  const demoUserId = 'user-demo';
  const fatherId = 'user-father';
  const motherId = 'user-mother';
  const volunteerId = 'user-volunteer';
  const heroId = 'user-hero';
  const incidentId = 'incident-demo';
  const roomId = 'room-demo';
  const feedId1 = 'status-demo-1';
  const feedId2 = 'status-demo-2';
  const memoId = 'memo-demo-1';

  return {
    users: [
      {
        id: demoUserId,
        email: 'demo@safesolo.app',
        phone: '+84901111222',
        firstName: 'Demo',
        lastName: 'User',
        dateOfBirth: '1998-01-01',
        gender: 'PREFER_NOT_TO_SAY',
        avatar: null,
        isActive: true,
        isVerified: true,
        otpCode: null,
        otpExpiresAt: null,
        lastLoginAt: now,
        createdAt: now,
        updatedAt: now,
        trustScore: 4.8,
        rescuesCount: 1,
        isKycVerified: true,
        nextCheckinDeadline: plusHours(24),
        lastCheckInAt: now,
        graceHours: 24,
        deadmanStage: 0,
        deadmanEscalationTriggeredAt: null,
        lastLat: 10.7769,
        lastLng: 106.7009,
        lastLocationTime: now,
        batteryLevel: 82,
        approxAddress: 'Quan 1, TP.HCM',
        role: 'USER',
        security: {
          stealthMode: false,
          highContrast: false,
          realPin: '',
          duressPin: '',
          autoWipeEnabled: false,
          autoWipeDays: 30,
          quietHoursStart: '23:00',
          quietHoursEnd: '06:00',
          falseAlertGraceMinutes: 7,
          pillReminder: false,
          pillTime: '08:00',
        },
      },
      {
        id: fatherId,
        email: 'botai@safesolo.app',
        phone: '+84901111001',
        firstName: 'Bo',
        lastName: 'Tai',
        dateOfBirth: '1962-04-10',
        gender: 'MALE',
        avatar: null,
        isActive: true,
        isVerified: true,
        otpCode: null,
        otpExpiresAt: null,
        lastLoginAt: now,
        createdAt: now,
        updatedAt: now,
        trustScore: 4.7,
        rescuesCount: 0,
        isKycVerified: false,
        nextCheckinDeadline: plusHours(12),
        lastCheckInAt: now,
        graceHours: 24,
        deadmanStage: 0,
        deadmanEscalationTriggeredAt: null,
        lastLat: 10.7752,
        lastLng: 106.6981,
        lastLocationTime: now,
        batteryLevel: 12,
        approxAddress: 'Quan 1, TP.HCM',
        role: 'USER',
        security: {
          stealthMode: false,
          highContrast: false,
          realPin: '',
          duressPin: '',
          autoWipeEnabled: false,
          autoWipeDays: 30,
          quietHoursStart: '22:30',
          quietHoursEnd: '06:00',
          falseAlertGraceMinutes: 5,
          pillReminder: true,
          pillTime: '07:30',
        },
      },
      {
        id: motherId,
        email: 'melan@safesolo.app',
        phone: '+84901111002',
        firstName: 'Me',
        lastName: 'Lan',
        dateOfBirth: '1965-05-12',
        gender: 'FEMALE',
        avatar: null,
        isActive: true,
        isVerified: true,
        otpCode: null,
        otpExpiresAt: null,
        lastLoginAt: now,
        createdAt: now,
        updatedAt: now,
        trustScore: 4.6,
        rescuesCount: 0,
        isKycVerified: false,
        nextCheckinDeadline: plusHours(12),
        lastCheckInAt: now,
        graceHours: 24,
        deadmanStage: 0,
        deadmanEscalationTriggeredAt: null,
        lastLat: 10.7721,
        lastLng: 106.7042,
        lastLocationTime: now,
        batteryLevel: 85,
        approxAddress: 'Quan 3, TP.HCM',
        role: 'USER',
        security: {
          stealthMode: false,
          highContrast: false,
          realPin: '',
          duressPin: '',
          autoWipeEnabled: false,
          autoWipeDays: 30,
          quietHoursStart: '22:00',
          quietHoursEnd: '06:30',
          falseAlertGraceMinutes: 5,
          pillReminder: true,
          pillTime: '08:30',
        },
      },
      {
        id: volunteerId,
        email: 'minhanh@safesolo.app',
        phone: '+84901111003',
        firstName: 'Minh',
        lastName: 'Anh',
        dateOfBirth: '1993-09-21',
        gender: 'FEMALE',
        avatar: null,
        isActive: true,
        isVerified: true,
        otpCode: null,
        otpExpiresAt: null,
        lastLoginAt: now,
        createdAt: now,
        updatedAt: now,
        trustScore: 4.9,
        rescuesCount: 12,
        isKycVerified: true,
        nextCheckinDeadline: plusHours(24),
        lastCheckInAt: now,
        graceHours: 24,
        deadmanStage: 0,
        deadmanEscalationTriggeredAt: null,
        lastLat: 10.7788,
        lastLng: 106.7012,
        lastLocationTime: now,
        batteryLevel: 64,
        approxAddress: 'Quan 1, TP.HCM',
        role: 'VOLUNTEER',
        security: {
          stealthMode: false,
          highContrast: false,
          realPin: '',
          duressPin: '',
          autoWipeEnabled: false,
          autoWipeDays: 30,
          quietHoursStart: '23:00',
          quietHoursEnd: '06:00',
          falseAlertGraceMinutes: 5,
          pillReminder: false,
          pillTime: '08:00',
        },
      },
      {
        id: heroId,
        email: 'quanhero@safesolo.app',
        phone: '+84901111004',
        firstName: 'Doan',
        lastName: 'Minh Quan',
        dateOfBirth: '1997-07-07',
        gender: 'MALE',
        avatar: null,
        isActive: true,
        isVerified: true,
        otpCode: null,
        otpExpiresAt: null,
        lastLoginAt: now,
        createdAt: now,
        updatedAt: now,
        trustScore: 4.9,
        rescuesCount: 15,
        isKycVerified: true,
        nextCheckinDeadline: plusHours(24),
        lastCheckInAt: now,
        graceHours: 24,
        deadmanStage: 0,
        deadmanEscalationTriggeredAt: null,
        lastLat: 11.0089,
        lastLng: 106.6557,
        lastLocationTime: now,
        batteryLevel: 91,
        approxAddress: 'Thu Dau Mot, Binh Duong',
        role: 'HERO',
        security: {
          stealthMode: false,
          highContrast: false,
          realPin: '',
          duressPin: '',
          autoWipeEnabled: false,
          autoWipeDays: 30,
          quietHoursStart: '23:00',
          quietHoursEnd: '06:00',
          falseAlertGraceMinutes: 5,
          pillReminder: false,
          pillTime: '08:00',
        },
      },
    ],
    medicalProfiles: [
      {
        id: 'med-demo',
        userId: demoUserId,
        bloodType: 'O_POSITIVE',
        allergies: ['Penicillin'],
        medications: ['Vitamin C'],
        medicalConditions: [],
        emergencyContact: {
          name: 'Bo Tai',
          phone: '+84901111001',
          relationship: 'Father',
        },
        insuranceInfo: null,
        doctor: 'BS. Nguyen Thi Hoa',
        qrCodeValue: `SAFE-MED-${demoUserId}`,
        createdAt: now,
        updatedAt: now,
      },
    ],
    guardianRelationships: [
      {
        id: 'rel-demo-father',
        requesterId: demoUserId,
        guardianId: fatherId,
        status: 'ACCEPTED',
        escalationLevel: 1,
        guardianConfirmedAt: now,
        lastNotifiedAt: null,
        message: 'Bo oi, lam guardian cho con nhe.',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'rel-demo-mother',
        requesterId: demoUserId,
        guardianId: motherId,
        status: 'ACCEPTED',
        escalationLevel: 2,
        guardianConfirmedAt: now,
        lastNotifiedAt: null,
        message: 'Me oi, giup con theo doi check-in nhe.',
        createdAt: now,
        updatedAt: now,
      },
    ],
    rescueIncidents: [
      {
        id: incidentId,
        victimId: demoUserId,
        status: 'ACTIVE',
        incidentType: 'medical_emergency',
        severity: 3,
        source: 'SOS',
        exactLat: 10.7769,
        exactLng: 106.7009,
        fuzzedLat: 10.7771,
        fuzzedLng: 106.7011,
        approxAddress: 'Quan 1, TP.HCM',
        batteryLevel: 64,
        communityRequestedAt: null,
        createdAt: now,
        resolvedAt: null,
      },
    ],
    volunteerResponses: [
      {
        id: 'response-demo',
        incidentId,
        volunteerId,
        status: 'ARRIVED',
        createdAt: now,
      },
    ],
    chatRooms: [
      {
        id: roomId,
        incidentId,
        status: 'ACTIVE',
        createdAt: now,
        closedAt: null,
      },
    ],
    messages: [
      {
        id: 'msg-demo-1',
        roomId,
        senderId: null,
        messageType: 'SYSTEM',
        content: 'Tin nhan khan cap da duoc mo.',
        metadata: {
          incidentId,
        },
        createdAt: now,
      },
      {
        id: 'msg-demo-2',
        roomId,
        senderId: demoUserId,
        messageType: 'TEXT',
        content: 'Toi dang can giup do o Quan 1.',
        metadata: null,
        createdAt: now,
      },
    ],
    dailyStatuses: [
      {
        id: feedId1,
        userId: fatherId,
        moodEmoji: '😊',
        text: 'Sang nay bo di bo quanh ho 30 phut, thay khoe hon nhieu.',
        audioUrl: null,
        visibility: 'FAMILY',
        batteryLevel: 12,
        isCheckIn: true,
        createdAt: now,
      },
      {
        id: feedId2,
        userId: motherId,
        moodEmoji: '🙂',
        text: 'Me vua uong thuoc xong va dang nghi ngoi mot chut.',
        audioUrl: '/uploads/voices/demo-me-lan.m4a',
        visibility: 'FAMILY',
        batteryLevel: 85,
        isCheckIn: true,
        createdAt: now,
      },
    ],
    statusReactions: [
      { id: 'react-1', statusId: feedId1, userId: demoUserId, type: 'HUG', createdAt: now },
      { id: 'react-2', statusId: feedId1, userId: motherId, type: 'HUG', createdAt: now },
      { id: 'react-3', statusId: feedId2, userId: demoUserId, type: 'HUG', createdAt: now },
    ],
    statusComments: [
      {
        id: 'comment-1',
        statusId: feedId1,
        userId: demoUserId,
        content: 'Con thay bo on la vui roi.',
        createdAt: now,
      },
    ],
    thankYouNotes: [
      {
        id: 'thanks-1',
        volunteerId,
        authorId: demoUserId,
        content: 'Cam on chi da den rat nhanh khi gia dinh can.',
        rating: 5,
        createdAt: now,
      },
      {
        id: 'thanks-2',
        volunteerId: heroId,
        authorId: motherId,
        content: 'Cam on vi su binh tinh va tan tam cua ban.',
        rating: 5,
        createdAt: now,
      },
    ],
    kycDocuments: [
      {
        id: 'kyc-demo',
        userId: volunteerId,
        frontImageUrl: '/uploads/kyc/front-demo.png',
        backImageUrl: '/uploads/kyc/back-demo.png',
        status: 'APPROVED',
        submittedAt: now,
        reviewedAt: now,
      },
    ],
    vaults: [
      {
        id: 'vault-demo',
        userId: demoUserId,
        content: {
          documents: ['cccd-front.png', 'di-chuc.pdf'],
          lastEncryptedAt: now,
          encrypted: true,
        },
        shreddedAt: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    systemLogs: [],
    alertEvents: [],
    emergencyMemos: [
      {
        id: memoId,
        incidentId,
        victimId: demoUserId,
        createdAt: now,
        duration: 15,
        victimName: 'Demo User',
        lat: 10.7769,
        lng: 106.7009,
        approxAddress: 'Quan 1, TP.HCM',
        contentUrl: '/uploads/voices/demo-memo.m4a',
        transcript: 'Toi dang o gan cho Ben Thanh va can giup do y te.',
        isAnonymous: true,
      },
    ],
    smsDispatchLogs: [],
  };
}

function ensureFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify(createSeed(), null, 2));
  }
}

function readState() {
  ensureFile();
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}

function writeState(state) {
  ensureFile();
  fs.writeFileSync(dataFile, JSON.stringify(state, null, 2));
}

function withState(mutator) {
  const state = readState();
  const result = mutator(state);
  writeState(state);
  return result;
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  readState,
  writeState,
  withState,
  createId,
  nowIso,
  clone,
};
