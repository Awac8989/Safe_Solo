const { readState, withState, nowIso } = require('../data/store');
const { fullName, sanitizeUser } = require('../lib/utils');
const { listAlertEvents } = require('./alertEventService');
const { resolveEmergency } = require('./sosService');
const {
  initDatabase,
  mapEmergencyRow,
  mapSmsDispatchRow,
  mapUserRow,
  emergencyStatements,
  smsDispatchStatements,
  userStatements,
} = require('../config/sqlite');

initDatabase();

function parseJson(value, fallback = null) {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function getSqliteUsers() {
  return userStatements.list.all().map(mapUserRow);
}

function getStoreUsers() {
  const state = readState();
  return state.users.map(sanitizeUser);
}

function unifyUser(sqliteUser) {
  return {
    id: sqliteUser._id,
    fullName: sqliteUser.fullName,
    email: '',
    phone: sqliteUser.phoneNumber,
    source: 'sqlite',
    role: sqliteUser.role || 'user',
    currentStatus: sqliteUser.currentStatus,
    timerIntervalMinutes: sqliteUser.timerIntervalMinutes,
    nextCheckinDeadline: sqliteUser.nextDeadline,
    lastCheckInAt: sqliteUser.lastCheckinTime,
    emergencyContacts: sqliteUser.emergencyContacts || [],
    location: sqliteUser.lastKnownLocation || null,
    quietHoursStart: sqliteUser.quietHoursStart,
    quietHoursEnd: sqliteUser.quietHoursEnd,
    falseAlertGraceMinutes: sqliteUser.falseAlertGraceMinutes,
    createdAt: sqliteUser.createdAt,
    updatedAt: sqliteUser.updatedAt,
  };
}

function unifyStoreUser(user, medicalProfiles, kycDocuments) {
  const medical = medicalProfiles.find((item) => item.userId === user.id) || null;
  const kyc = kycDocuments.find((item) => item.userId === user.id) || null;

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email || '',
    phone: user.phone || '',
    source: 'store',
    role: user.role || 'USER',
    currentStatus: 'SAFE',
    timerIntervalMinutes: Number(user.graceHours || 24) * 60,
    nextCheckinDeadline: user.nextCheckinDeadline,
    lastCheckInAt: user.lastCheckInAt,
    emergencyContacts: medical?.emergencyContact ? [medical.emergencyContact] : [],
    location:
      user.lastLat != null && user.lastLng != null
        ? {
            lat: user.lastLat,
            lng: user.lastLng,
            updatedAt: user.lastLocationTime || null,
          }
        : null,
    quietHoursStart: user.security?.quietHoursStart || '23:00',
    quietHoursEnd: user.security?.quietHoursEnd || '06:00',
    falseAlertGraceMinutes: Number(user.security?.falseAlertGraceMinutes || 0),
    batteryLevel: user.batteryLevel ?? null,
    trustScore: user.trustScore ?? 0,
    rescuesCount: user.rescuesCount ?? 0,
    isKycVerified: Boolean(user.isKycVerified),
    kycStatus: kyc?.status || null,
    approxAddress: user.approxAddress || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
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
    source: 'sqlite',
  };
}

function buildDispatchIncidentFromStore(incident, state) {
  const victim = state.users.find((item) => item.id === incident.victimId);
  const medical = state.medicalProfiles.find((item) => item.userId === incident.victimId);
  const relationship = state.guardianRelationships.find(
    (item) => item.requesterId === incident.victimId && item.status === 'ACCEPTED',
  );
  const guardian = relationship
    ? state.users.find((item) => item.id === relationship.guardianId)
    : null;

  return {
    id: incident.id,
    type: incident.source === 'DURESS' ? 'DURESS' : incident.severity >= 3 ? 'MEDICAL' : 'SOS',
    severity: incident.severity,
    status: incident.status,
    name: victim ? fullName(victim) : 'Unknown User',
    firstName: victim?.firstName || '',
    lastName: victim?.lastName || '',
    age: victim?.dateOfBirth
      ? new Date().getFullYear() - new Date(victim.dateOfBirth).getFullYear()
      : null,
    blood: medical?.bloodType || 'N/A',
    allergies: Array.isArray(medical?.allergies) && medical.allergies.length > 0
      ? medical.allergies.join(', ')
      : 'None',
    address: incident.approxAddress || victim?.approxAddress || 'Unknown',
    district: victim?.approxAddress || 'Unknown',
    city: 'Vietnam',
    x: 20 + Math.abs((incident.exactLng * 19) % 60),
    y: 20 + Math.abs((incident.exactLat * 29) % 60),
    receivedAt: incident.createdAt,
    channel: incident.source === 'DURESS' ? 'Telegram' : 'App',
    phoneNumber: victim?.phone || '',
    medicalNotes: Array.isArray(medical?.medicalConditions)
      ? medical.medicalConditions.join(', ')
      : '',
    emergencyContactName: guardian ? fullName(guardian) : medical?.emergencyContact?.name || '',
    emergencyContactPhone: guardian?.phone || medical?.emergencyContact?.phone || '',
    location: {
      lat: incident.exactLat,
      lng: incident.exactLng,
      updatedAt: incident.createdAt,
    },
    source: 'store',
  };
}

class AdminPortalService {
  async getOverview() {
    const state = readState();
    const sqliteUsers = getSqliteUsers();
    const openEmergencies = emergencyStatements.listOpen.all().map(mapEmergencyRow);
    const incidents = [
      ...openEmergencies.map((item) => buildDispatchIncidentFromEmergency(this.attachEmergencyUser(item))),
      ...state.rescueIncidents
        .filter((item) => item.status === 'ACTIVE')
        .map((item) => buildDispatchIncidentFromStore(item, state)),
    ]
      .sort((a, b) => String(b.receivedAt).localeCompare(String(a.receivedAt)))
      .slice(0, 12);

    const stats = {
      totalUsers: sqliteUsers.length + state.users.length,
      monitoredUsers: sqliteUsers.length,
      activeIncidents: incidents.length,
      kycPending: state.kycDocuments.filter((item) => item.status === 'PENDING').length,
      heroesVerified: state.users.filter((item) => item.isKycVerified).length,
      alertsToday: listAlertEvents({ page: 1, limit: 200 }).items.filter((item) =>
        String(item.createdAt).startsWith(new Date().toISOString().slice(0, 10)),
      ).length,
    };

    return {
      stats,
      incidents,
    };
  }

  async listUsers() {
    const state = readState();
    const sqliteUsers = getSqliteUsers().map(unifyUser);
    const storeUsers = state.users.map((item) =>
      unifyStoreUser(item, state.medicalProfiles, state.kycDocuments),
    );

    return [...sqliteUsers, ...storeUsers].sort((a, b) =>
      String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')),
    );
  }

  attachEmergencyUser(log) {
    const userRow = userStatements.getById.get(log.userId);
    const user = userRow ? mapUserRow(userRow) : null;
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
    const state = readState();
    const sqliteRows =
      status === 'resolved'
        ? emergencyStatements.listResolved.all()
        : status === 'all'
        ? emergencyStatements.listAll.all()
        : emergencyStatements.listOpen.all();

    const sqliteIncidents = sqliteRows
      .map(mapEmergencyRow)
      .map((item) => buildDispatchIncidentFromEmergency(this.attachEmergencyUser(item)));

    const storeIncidents = state.rescueIncidents
      .filter((item) => (status === 'all' ? true : status === 'resolved' ? item.status === 'RESOLVED' : item.status === 'ACTIVE'))
      .map((item) => buildDispatchIncidentFromStore(item, state));

    return [...sqliteIncidents, ...storeIncidents].sort((a, b) =>
      String(b.receivedAt).localeCompare(String(a.receivedAt)),
    );
  }

  async resolveIncident(id, notes = '') {
    const emergencyRow = emergencyStatements.getById.get(id);
    if (emergencyRow) {
      return resolveEmergency(id, notes);
    }

    return withState((state) => {
      const incident = state.rescueIncidents.find((item) => item.id === id);
      if (!incident) {
        const error = new Error('Incident not found');
        error.statusCode = 404;
        throw error;
      }
      incident.status = 'RESOLVED';
      incident.resolvedAt = nowIso();
      state.systemLogs.push({
        id: `audit_${id}_${Date.now()}`,
        incidentId: id,
        actionType: 'RESOLVE_INCIDENT',
        description: notes || 'Incident resolved from web admin',
        metadata: { source: 'admin-portal' },
        createdAt: nowIso(),
      });
      return incident;
    });
  }

  async listSmsLogs(logId) {
    return smsDispatchStatements.listByEmergency.all(logId).map(mapSmsDispatchRow);
  }

  async listAuditLogs({ q = '', category = 'All' } = {}) {
    const state = readState();
    const query = String(q || '').trim().toLowerCase();
    const normalizedCategory = String(category || 'All').toLowerCase();

    const sqliteAlerts = listAlertEvents({ page: 1, limit: 500 }).items.map((item) => ({
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

    const storeLogs = state.systemLogs.map((item) => ({
      id: item.id,
      ts: item.createdAt,
      actor: 'admin_portal',
      action: item.actionType,
      target: item.incidentId || item.description,
      tone: /reject|block|fail/i.test(item.actionType) ? 'sos' : 'info',
      hash: `0x${Buffer.from(item.id).toString('hex').slice(0, 16)}`,
      category: /kyc/i.test(item.actionType)
        ? 'KYC'
        : /dispatch|incident|alert/i.test(item.actionType)
        ? 'Dispatch'
        : /payout|revenue|finance/i.test(item.actionType)
        ? 'Finance'
        : 'System',
      metadata: item.metadata || {},
    }));

    return [...sqliteAlerts, ...storeLogs]
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
    const state = readState();
    return state.kycDocuments.map((document) => {
      const user = state.users.find((item) => item.id === document.userId);
      const heroNotes = state.thankYouNotes.filter((item) => item.volunteerId === document.userId);
      const scoreBase = Number(user?.trustScore || 4.5);
      const match = Math.min(99, Math.max(60, Math.round(scoreBase * 20)));

      return {
        id: document.id,
        userId: document.userId,
        name: user ? fullName(user) : 'Unknown user',
        applied: document.submittedAt,
        status:
          document.status === 'PENDING'
            ? 'pending'
            : document.status === 'REJECTED'
            ? 'flagged'
            : 'review',
        region: user?.approxAddress || 'Unknown',
        match,
        phone: user?.phone || '',
        frontImageUrl: document.frontImageUrl,
        backImageUrl: document.backImageUrl,
        isKycVerified: Boolean(user?.isKycVerified),
        liveness: 'OK',
        trustScore: scoreBase,
        rescuesCount: Number(user?.rescuesCount || 0),
        thankYouCount: heroNotes.length,
      };
    });
  }

  async updateKycStatus(documentId, action) {
    const normalized = String(action || '').toUpperCase();
    const nextStatus = normalized === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    return withState((state) => {
      const document = state.kycDocuments.find((item) => item.id === documentId);
      if (!document) {
        const error = new Error('KYC document not found');
        error.statusCode = 404;
        throw error;
      }

      document.status = nextStatus;
      document.reviewedAt = nowIso();

      const user = state.users.find((item) => item.id === document.userId);
      if (user) {
        user.isKycVerified = nextStatus === 'APPROVED';
        user.updatedAt = nowIso();
      }

      state.systemLogs.push({
        id: `kyc_${document.id}_${Date.now()}`,
        incidentId: null,
        actionType: `${normalized}_KYC`,
        description: `${normalized} KYC for ${document.userId}`,
        metadata: { documentId: document.id, userId: document.userId },
        createdAt: nowIso(),
      });

      return {
        document,
        user: user ? sanitizeUser(user) : null,
      };
    });
  }

  async getChannelHealth() {
    const smsLogs = smsDispatchStatements.listByEmergency
      .all
      ? emergencyStatements.listAll.all().flatMap((item) =>
          smsDispatchStatements.listByEmergency.all(item.id).map(mapSmsDispatchRow),
        )
      : [];

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
    const state = readState();
    const partners = [
      { name: 'Vinmec Central Park', rate: 15, region: 'TP.HCM' },
      { name: 'FV Hospital', rate: 12, region: 'TP.HCM' },
      { name: '115 Ambulance Co.', rate: 10, region: 'TP.HCM' },
      { name: 'Hoan My Saigon', rate: 15, region: 'TP.HCM' },
    ];

    const dispatchCount = state.volunteerResponses.length || 1;
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
