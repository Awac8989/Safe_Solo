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
  return {
    id: mongoUser._id,
    fullName: mongoUser.fullName,
    email: '',
    phone: mongoUser.phoneNumber,
    source: 'mongo',
    role: mongoUser.role || 'user',
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

function buildDispatchIncidentFromEmergency(log) {
  const user = log.userId;
  const contacts = user?.emergencyContacts || [];
  const firstContact = contacts[0] || null;
  const location = log.locationSnapshot || null;
  const [firstName, ...rest] = String(user?.fullName || 'Unknown User').split(' ');

  return {
    id: log._id,
    type: 'SOS',
    severity: 3,
    status: log.isResolved ? 'RESOLVED' : 'ACTIVE',
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
    source: 'mongo',
  };
}

function buildDispatchIncidentFromRescue(incident, user) {
  const contacts = user?.emergencyContacts || [];
  const firstContact = contacts[0] || null;
  const [firstName, ...rest] = String(user?.fullName || 'Unknown User').split(' ');

  return {
    id: incident._id,
    type: String(incident.incidentType || 'SOS').toUpperCase(),
    severity: Number(incident.severity || 3),
    status: incident.status === 'RESOLVED' ? 'RESOLVED' : 'ACTIVE',
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
    source: 'mongo-rescue',
  };
}

class AdminPortalService {
  async getOverview() {
    const mongoUsers = await getMongoUsers();
    const openEmergencies = (await EmergencyLog.find({ isResolved: false }).sort({ createdAt: -1 }))
      .map(mapEmergencyDoc);
    const rescueIncidents = await RescueIncident.find({ status: 'ACTIVE' }).sort({ createdAt: -1 }).lean();
    const incidents = openEmergencies
      .map((item) => buildDispatchIncidentFromEmergency(this.attachEmergencyUser(item, mongoUsers)))
      .concat(
        rescueIncidents.map((item) => {
          const user = mongoUsers.find((entry) => entry._id === item.victimId) || null;
          return buildDispatchIncidentFromRescue(item, user);
        }),
      )
      .sort((a, b) => String(b.receivedAt).localeCompare(String(a.receivedAt)))
      .slice(0, 12);

    const stats = {
      totalUsers: mongoUsers.length,
      monitoredUsers: mongoUsers.length,
      activeIncidents: incidents.length,
      kycPending: 0,
      heroesVerified: 0,
      alertsToday: (await listAlertEvents({ page: 1, limit: 200 })).items.filter((item) =>
        String(item.createdAt).startsWith(new Date().toISOString().slice(0, 10)),
      ).length,
    };

    return {
      stats,
      incidents,
    };
  }

  async listUsers() {
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

    return mongoIncidents.concat(rescueIncidents).sort((a, b) =>
      String(b.receivedAt).localeCompare(String(a.receivedAt)),
    );
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

    const dispatchAlerts = (await listAlertEvents({ page: 1, limit: 500 })).items.map((item) => ({
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

    const systemLogs = (await SystemLog.find().sort({ createdAt: -1 }).limit(500)).map((item) => ({
      id: item._id,
      ts: toIso(item.createdAt),
      actor: 'system',
      action: item.actionType,
      target: item.incidentId || 'runtime',
      tone: item.actionType.includes('RESOLVED') ? 'warning' : 'info',
      hash: `0x${Buffer.from(String(item._id)).toString('hex').slice(0, 16)}`,
      category: 'Dispatch',
      metadata: item.metadata || {},
    }));

    return dispatchAlerts
      .concat(systemLogs)
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
      return {
        id: document._id,
        userId: document.userId,
        name: user ? fullName(user) : 'Unknown user',
        applied: toIso(document.submittedAt),
        status:
          document.status === 'PENDING'
            ? 'pending'
            : document.status === 'REJECTED'
            ? 'flagged'
            : 'review',
        region: user?.approxAddress || 'Unknown',
        match,
        phone: user?.phoneNumber || '',
        frontImageUrl: document.frontImageUrl,
        backImageUrl: document.backImageUrl,
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
