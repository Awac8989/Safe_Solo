const User = require('../models/User');
const RescueIncident = require('../models/RescueIncident');
const EmergencyMemo = require('../models/EmergencyMemo');
const radarService = require('./radarService');
const chatService = require('./chatService');
const systemLogService = require('./systemLogService');
const { createAlertEvent } = require('./alertEventService');
const { getIo } = require('../sockets/socketServer');
const { AppError, ensure } = require('../lib/errors');
const { fullName, sanitizeUser, haversineKm } = require('../lib/utils');
const { sendEmergencySms } = require('./smsService');
const { toIso } = require('../lib/mongoCore');

function mapMemo(doc) {
  if (!doc) {
    return null;
  }
  const row = doc.toObject ? doc.toObject() : doc;
  return {
    id: row._id,
    incidentId: row.incidentId,
    victimId: row.victimId,
    createdAt: toIso(row.createdAt),
    duration: row.duration,
    victimName: row.victimName,
    lat: row.lat,
    lng: row.lng,
    approxAddress: row.approxAddress || null,
    contentUrl: row.contentUrl || null,
    transcript: row.transcript || '',
    isAnonymous: Boolean(row.isAnonymous),
  };
}

class EmergencyService {
  async createSilentSosIncident(userId) {
    const user = await User.findById(userId);
    ensure(user, 'User not found', 404);

    return radarService.broadcastSOS(
      userId,
      'silent_sos',
      user.lastKnownLocation?.lat ?? 10.7769,
      user.lastKnownLocation?.lng ?? 106.7009,
      {
        severity: 3,
        source: 'SILENT_SOS',
        batteryLevel: user.batteryLevel,
        approxAddress: user.approxAddress,
      },
    );
  }

  async notifyGuardians(userLike, escalationLevel) {
    const userDoc = await User.findById(userLike._id || userLike.id);
    ensure(userDoc, 'User not found', 404);

    const contacts = Array.isArray(userDoc.emergencyContacts) ? userDoc.emergencyContacts : [];
    const user = sanitizeUser(userDoc);
    const results = await sendEmergencySms({
      emergencyLogId: null,
      user: {
        _id: user.id,
        fullName: user.fullName,
        phoneNumber: user.phone,
      },
      contacts,
      location: userDoc.lastKnownLocation || null,
    });

    await createAlertEvent({
      userId: user.id,
      level: escalationLevel === 1 ? 'WARNING' : 'SOS',
      status: `DEADMAN_LEVEL_${escalationLevel}`,
      source: 'SYSTEM',
      title: `Deadman escalation L${escalationLevel}`,
      message: `Da thong bao ${contacts.length} guardians`,
      metadata: {
        escalationLevel,
        contacts: contacts.map((item) => item.phone),
        smsResults: results,
      },
    });

    return contacts.map((contact) => ({
      phone: contact.phone,
      name: contact.name,
      guardianId: null,
      level: escalationLevel,
    }));
  }

  async createEmergencyMemo(userId, payload) {
    const user = await User.findById(userId);
    ensure(user, 'User not found', 404);

    let incidentId = payload.incidentId;
    if (incidentId) {
      const incident = await RescueIncident.findById(incidentId);
      ensure(incident, 'Incident not found', 404);
    } else {
      const latestIncident = await RescueIncident.findOne({
        victimId: userId,
        status: 'ACTIVE',
      }).sort({ createdAt: -1 });

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
        incidentId = latestIncident._id;
      }
    }

    const memo = await EmergencyMemo.create({
      incidentId,
      victimId: userId,
      duration: payload.duration,
      victimName: fullName(user),
      lat: payload.lat,
      lng: payload.lng,
      approxAddress: payload.approxAddress || user.approxAddress || null,
      contentUrl: payload.contentUrl || null,
      transcript: payload.transcript || '',
      isAnonymous: true,
    });

    const room = await chatService.getChatRoomByIncident(incidentId);
    await chatService.createMessage(
      room._id || room.id,
      userId,
      'VOICE_NOTE',
      memo.contentUrl || memo.transcript || 'Emergency memo',
      {
        memoId: memo._id,
        duration: memo.duration,
        lat: memo.lat,
        lng: memo.lng,
        approxAddress: memo.approxAddress,
        transcript: memo.transcript,
      },
    );

    await systemLogService.createLog({
      incidentId,
      actionType: 'EMERGENCY_MEMO_CREATED',
      description: `Emergency memo created by ${userId}`,
      metadata: mapMemo(memo),
    });

    try {
      getIo().emit('EMERGENCY_MEMO_CREATED', mapMemo(memo));
    } catch (_error) {
      // socket optional
    }

    const count = await EmergencyMemo.countDocuments({ incidentId });
    if (count > 50) {
      const oldItems = await EmergencyMemo.find({ incidentId }).sort({ createdAt: -1 }).skip(50).select('_id');
      if (oldItems.length) {
        await EmergencyMemo.deleteMany({ _id: { $in: oldItems.map((item) => item._id) } });
      }
    }

    return mapMemo(memo);
  }

  async listEmergencyMemos({ lat = null, lng = null, radiusKm = 3 } = {}) {
    const memos = await EmergencyMemo.find().sort({ createdAt: -1 }).limit(200).lean();
    let items = memos.map(mapMemo);
    if (lat != null && lng != null) {
      items = items.filter((item) => haversineKm(lat, lng, item.lat, item.lng) <= radiusKm);
    }
    return items;
  }

  async requestCommunityHelp(incidentId, requesterId, note = '') {
    const incident = await radarService.getIncidentDetails(incidentId, requesterId);
    const target = await RescueIncident.findById(incidentId);
    ensure(target, 'Incident not found', 404);
    target.communityRequestedAt = new Date();
    await target.save();

    const event = await createAlertEvent({
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
        incident: { ...incident, communityRequestedAt: toIso(target.communityRequestedAt) },
        event,
      });
    } catch (_error) {
      // socket optional
    }

    return {
      incident: { ...incident, communityRequestedAt: toIso(target.communityRequestedAt) },
      event,
    };
  }

  async listActiveIncidents() {
    const incidents = await RescueIncident.find({ status: 'ACTIVE' }).sort({ createdAt: -1 }).lean();
    const victimIds = [...new Set(incidents.map((item) => item.victimId))];
    const victims = victimIds.length ? await User.find({ _id: { $in: victimIds } }).lean() : [];
    const victimMap = new Map(victims.map((item) => [item._id, sanitizeUser(item)]));
    return incidents.map((incident) => ({
      ...incident,
      id: incident._id,
      victim: victimMap.get(incident.victimId) || null,
    }));
  }

  async resolveIncidentFromAdmin(incidentId, notes = '') {
    const incident = await RescueIncident.findById(incidentId);
    ensure(incident, 'Incident not found', 404);
    incident.status = 'RESOLVED';
    incident.resolvedAt = new Date();
    await incident.save();

    await systemLogService.createLog({
      incidentId,
      actionType: 'ADMIN_RESOLVED_INCIDENT',
      description: notes || 'Incident resolved by admin',
      metadata: { notes },
    });

    await chatService.closeChatRoom(incidentId).catch(() => null);
    return {
      ...incident.toObject(),
      id: incident._id,
    };
  }
}

module.exports = new EmergencyService();
