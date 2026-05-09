const { readState, withState, createId, nowIso } = require('../data/store');
const { AppError, ensure } = require('../lib/errors');
const { fullName, sanitizeUser } = require('../lib/utils');
const radarService = require('./radarService');
const chatService = require('./chatService');
const systemLogService = require('./systemLogService');
const { createAlertEvent } = require('./alertEventService');
const { getIo } = require('../sockets/socketServer');

class EmergencyService {
  async createSilentSosIncident(userId) {
    const state = readState();
    const user = state.users.find((item) => item.id === userId);
    ensure(user, 'User not found', 404);

    return radarService.broadcastSOS(
      userId,
      'silent_sos',
      user.lastLat ?? 10.7769,
      user.lastLng ?? 106.7009,
      {
        severity: 3,
        source: 'SILENT_SOS',
        batteryLevel: user.batteryLevel,
        approxAddress: user.approxAddress,
      },
    );
  }

  async notifyGuardians(user, escalationLevel) {
    return withState((state) => {
      const guardians = state.guardianRelationships
        .filter(
          (item) =>
            item.requesterId === user.id &&
            item.status === 'ACCEPTED' &&
            item.escalationLevel === escalationLevel,
        )
        .map((item) => {
          const guardian = state.users.find((entry) => entry.id === item.guardianId);
          if (!guardian) {
            return null;
          }
          item.lastNotifiedAt = nowIso();
          return {
            relationshipId: item.id,
            phone: guardian.phone,
            name: fullName(guardian),
            guardianId: guardian.id,
            level: escalationLevel,
          };
        })
        .filter(Boolean);

      for (const guardian of guardians) {
        state.smsDispatchLogs.push({
          id: createId('sms'),
          emergencyLogId: null,
          phone: guardian.phone,
          provider: 'mock',
          success: true,
          attempt: 1,
          responseMessage: `Sent deadman level ${escalationLevel} alert`,
          createdAt: nowIso(),
        });
      }

      createAlertEvent({
        userId: user.id,
        level: escalationLevel === 1 ? 'WARNING' : 'SOS',
        status: `DEADMAN_LEVEL_${escalationLevel}`,
        source: 'SYSTEM',
        title: `Deadman escalation L${escalationLevel}`,
        message: `Da thong bao ${guardians.length} guardians`,
        metadata: { escalationLevel, guardians: guardians.map((item) => item.guardianId) },
      });

      return guardians;
    });
  }

  async createEmergencyMemo(userId, payload) {
    const state = readState();
    const user = state.users.find((item) => item.id === userId);
    ensure(user, 'User not found', 404);

    let incidentId = payload.incidentId;
    if (incidentId) {
      const incident = state.rescueIncidents.find((item) => item.id === incidentId);
      ensure(incident, 'Incident not found', 404);
    } else {
      const latestIncident = state.rescueIncidents
        .filter((item) => item.victimId === userId && item.status === 'ACTIVE')
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];

      if (!latestIncident) {
        const created = await radarService.broadcastSOS(
          userId,
          'voice_emergency',
          payload.lat,
          payload.lng,
          {
            severity: 3,
            source: 'VOICE_MEMO',
            approxAddress: payload.approxAddress,
            batteryLevel: user.batteryLevel,
          },
        );
        incidentId = created.incident.id;
      } else {
        incidentId = latestIncident.id;
      }
    }

    const memo = withState((draft) => {
      const record = {
        id: createId('memo'),
        incidentId,
        victimId: userId,
        createdAt: nowIso(),
        duration: payload.duration,
        victimName: fullName(user),
        lat: payload.lat,
        lng: payload.lng,
        approxAddress: payload.approxAddress || user.approxAddress || null,
        contentUrl: payload.contentUrl || null,
        transcript: payload.transcript || '',
        isAnonymous: true,
      };
      draft.emergencyMemos.unshift(record);
      draft.emergencyMemos = draft.emergencyMemos.slice(0, 50);
      return record;
    });

    const room = await chatService.getChatRoomByIncident(incidentId);
    await chatService.createMessage(room.id, userId, 'VOICE_NOTE', memo.contentUrl || memo.transcript || 'Emergency memo', {
      memoId: memo.id,
      duration: memo.duration,
      lat: memo.lat,
      lng: memo.lng,
      approxAddress: memo.approxAddress,
      transcript: memo.transcript,
    });

    await systemLogService.createLog({
      incidentId,
      actionType: 'EMERGENCY_MEMO_CREATED',
      description: `Emergency memo created by ${userId}`,
      metadata: memo,
    });

    try {
      getIo().emit('EMERGENCY_MEMO_CREATED', memo);
    } catch (_error) {
      // socket optional
    }

    return memo;
  }

  async listEmergencyMemos({ lat = null, lng = null, radiusKm = 3 } = {}) {
    const state = readState();
    let items = [...state.emergencyMemos].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    if (lat != null && lng != null) {
      const { haversineKm } = require('../lib/utils');
      items = items.filter((item) => haversineKm(lat, lng, item.lat, item.lng) <= radiusKm);
    }
    return items;
  }

  async requestCommunityHelp(incidentId, requesterId, note = '') {
    const incident = await radarService.getIncidentDetails(incidentId, requesterId);

    return withState((state) => {
      const target = state.rescueIncidents.find((item) => item.id === incidentId);
      ensure(target, 'Incident not found', 404);
      target.communityRequestedAt = nowIso();

      const event = createAlertEvent({
        userId: target.victimId,
        level: 'WARNING',
        status: 'COMMUNITY_HELP_REQUESTED',
        source: 'USER',
        title: 'Kich hoat ho tro cong dong',
        message: note || 'Nan nhan da keu goi cong dong trong ban kinh 3km',
        metadata: { incidentId },
      });

      try {
        getIo().emit('COMMUNITY_HELP_REQUESTED', {
          incident: target,
          event,
        });
      } catch (_error) {
        // socket optional
      }

      return {
        incident: target,
        event,
      };
    });
  }

  async listActiveIncidents() {
    const state = readState();
    return state.rescueIncidents
      .filter((item) => item.status === 'ACTIVE')
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((incident) => ({
        ...incident,
        victim: sanitizeUser(state.users.find((item) => item.id === incident.victimId)),
      }));
  }

  async resolveIncidentFromAdmin(incidentId, notes = '') {
    return withState((state) => {
      const incident = state.rescueIncidents.find((item) => item.id === incidentId);
      ensure(incident, 'Incident not found', 404);
      incident.status = 'RESOLVED';
      incident.resolvedAt = nowIso();
      state.systemLogs.push({
        id: createId('log'),
        incidentId,
        actionType: 'ADMIN_RESOLVED_INCIDENT',
        description: notes || 'Incident resolved by admin',
        metadata: { notes },
        createdAt: nowIso(),
      });
      return incident;
    });
  }
}

module.exports = new EmergencyService();
