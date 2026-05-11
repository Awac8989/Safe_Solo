const User = require('../models/User');
const RescueIncident = require('../models/RescueIncident');
const VolunteerResponse = require('../models/VolunteerResponse');
const EmergencyMemo = require('../models/EmergencyMemo');
const chatService = require('./chatService');
const trustService = require('./trustService');
const { createAlertEvent } = require('./alertEventService');
const systemLogService = require('./systemLogService');
const { getIo } = require('../sockets/socketServer');
const { AppError, ensure } = require('../lib/errors');
const { fuzzCoordinates, haversineKm, sanitizeUser } = require('../lib/utils');
const { toIso } = require('../lib/mongoCore');

function mapIncident(doc) {
  if (!doc) {
    return null;
  }
  const row = doc.toObject ? doc.toObject() : doc;
  return {
    id: row._id,
    victimId: row.victimId,
    status: row.status,
    incidentType: row.incidentType,
    severity: row.severity,
    source: row.source,
    exactLat: row.exactLat,
    exactLng: row.exactLng,
    fuzzedLat: row.fuzzedLat,
    fuzzedLng: row.fuzzedLng,
    approxAddress: row.approxAddress || null,
    batteryLevel: row.batteryLevel ?? null,
    communityRequestedAt: toIso(row.communityRequestedAt),
    createdAt: toIso(row.createdAt),
    resolvedAt: toIso(row.resolvedAt),
  };
}

function mapResponse(doc) {
  if (!doc) {
    return null;
  }
  const row = doc.toObject ? doc.toObject() : doc;
  return {
    id: row._id,
    incidentId: row.incidentId,
    volunteerId: row.volunteerId,
    status: row.status,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

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
    approxAddress: row.approxAddress,
    contentUrl: row.contentUrl,
    transcript: row.transcript,
    isAnonymous: Boolean(row.isAnonymous),
  };
}

class RadarService {
  async getGuardiansForVictim(victimDoc) {
    const phones = [...new Set((victimDoc.emergencyContacts || []).map((item) => String(item?.phone || '').trim()).filter(Boolean))];
    if (!phones.length) {
      return [];
    }
    return User.find({ phoneNumber: { $in: phones }, isActive: { $ne: false } }).lean();
  }

  async getIncidentDetailsForBroadcast(incidentId) {
    const incidentDoc = await RescueIncident.findById(incidentId);
    if (!incidentDoc) {
      throw new AppError('Incident not found', 404);
    }
    const victim = await User.findById(incidentDoc.victimId).lean();
    const room = await chatService.getChatRoomByIncident(incidentDoc._id).catch(() => null);
    return {
      ...mapIncident(incidentDoc),
      victim: victim ? sanitizeUser(victim) : null,
      roomId: room?._id || room?.id || null,
    };
  }

  async broadcastSOS(victimId, incidentType, exactLat, exactLng, options = {}) {
    const victim = await User.findById(victimId);
    ensure(victim, 'Victim not found', 404);

    const { fuzzedLat, fuzzedLng } = fuzzCoordinates(exactLat, exactLng);
    const incident = await RescueIncident.create({
      victimId,
      status: 'ACTIVE',
      incidentType,
      severity: Number(options.severity || 3),
      source: options.source || 'SOS',
      exactLat,
      exactLng,
      fuzzedLat,
      fuzzedLng,
      approxAddress: options.approxAddress || victim.approxAddress || null,
      batteryLevel: options.batteryLevel ?? victim.batteryLevel ?? null,
      communityRequestedAt: null,
      resolvedAt: null,
    });

    victim.lastKnownLocation = { lat: exactLat, lng: exactLng, updatedAt: new Date() };
    victim.approxAddress = incident.approxAddress;
    victim.batteryLevel = incident.batteryLevel;
    await victim.save();

    const guardians = await this.getGuardiansForVictim(victim);
    await chatService.syncIncidentRoomParticipants(
      incident._id,
      [victimId, ...guardians.map((item) => item._id)],
      [],
    );

    await systemLogService.createLog({
      incidentId: incident._id,
      actionType: 'SOS_BROADCASTED',
      description: `SOS incident ${incident._id} created for victim ${victimId}`,
      metadata: { incidentType, lat: exactLat, lng: exactLng },
    });

    const nearbyVolunteers = await this.findNearbyVolunteers(exactLat, exactLng, victimId);
    await createAlertEvent({
      userId: victimId,
      level: 'SOS',
      status: 'SOS_BROADCASTED',
      source: 'USER',
      title: 'Da phat SOS',
      message: 'He thong dang thong bao cho guardians va tinh nguyen vien gan ban',
      metadata: {
        incidentId: incident._id,
        nearbyVolunteersCount: nearbyVolunteers.length,
      },
    });

    try {
      getIo().emit('RADAR_INCIDENT_CREATED', {
        incident: await this.getIncidentDetailsForBroadcast(incident._id),
      });
    } catch (_error) {
      // socket optional
    }

    return {
      incident: await this.getIncidentDetailsForBroadcast(incident._id),
      nearbyVolunteers,
    };
  }

  async findNearbyVolunteers(lat, lng, excludeUserId, radiusKm = 3) {
    const users = await User.find({
      _id: { $ne: excludeUserId },
      isActive: { $ne: false },
      isKycVerified: true,
      lastKnownLocation: { $ne: null },
    }).lean();

    return users
      .map((item) => ({
        ...sanitizeUser(item),
        distanceKm: Number(
          haversineKm(
            lat,
            lng,
            Number(item.lastKnownLocation?.lat),
            Number(item.lastKnownLocation?.lng),
          ).toFixed(2),
        ),
      }))
      .filter((item) => item.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  async getNearbyIncidents(volunteerLat, volunteerLng, volunteerId, radiusKm = 3) {
    const incidents = await RescueIncident.find({
      status: 'ACTIVE',
      victimId: { $ne: volunteerId },
    })
      .sort({ createdAt: -1 })
      .lean();

    const victimIds = [...new Set(incidents.map((item) => item.victimId))];
    const victims = victimIds.length ? await User.find({ _id: { $in: victimIds } }).lean() : [];
    const victimMap = new Map(victims.map((item) => [item._id, sanitizeUser(item)]));

    const accepted = await VolunteerResponse.find({
      volunteerId,
      incidentId: { $in: incidents.map((item) => item._id) },
    }).lean();
    const acceptedSet = new Set(accepted.map((item) => item.incidentId));

    return incidents
      .map((incident) => {
        const distanceKm = haversineKm(
          volunteerLat,
          volunteerLng,
          incident.fuzzedLat,
          incident.fuzzedLng,
        );
        return {
          ...mapIncident(incident),
          victim: victimMap.get(incident.victimId) || null,
          distanceKm: Number(distanceKm.toFixed(2)),
          hasAccepted: acceptedSet.has(incident._id),
        };
      })
      .filter((item) => item.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  async acceptRescueIncident(incidentId, volunteerId) {
    const volunteer = await User.findById(volunteerId);
    ensure(volunteer, 'Volunteer not found', 404);
    ensure(volunteer.isKycVerified, 'KYC verification required before accepting rescue missions', 403);

    const incident = await RescueIncident.findById(incidentId);
    ensure(incident, 'Incident not found', 404);
    ensure(incident.status === 'ACTIVE', 'Incident is no longer active', 409);

    let response = await VolunteerResponse.findOne({ incidentId, volunteerId });
    if (!response) {
      response = await VolunteerResponse.create({
        incidentId,
        volunteerId,
        status: 'EN_ROUTE',
      });
    } else {
      throw new AppError('You have already accepted this rescue mission', 409);
    }

    await chatService.addResponderToIncidentRoom(incidentId, volunteerId);
    await createAlertEvent({
      userId: incident.victimId,
      level: 'INFO',
      status: 'VOLUNTEER_ACCEPTED',
      source: 'COMMUNITY',
      title: 'Tinh nguyen vien dang den',
      message: `${sanitizeUser(volunteer).fullName} da nhan ho tro`,
      metadata: { incidentId, volunteerId },
    });

    return {
      response: mapResponse(response),
      incident: await this.getIncidentDetails(incidentId, volunteerId),
    };
  }

  async markVolunteerArrived(incidentId, volunteerId) {
    const response = await VolunteerResponse.findOne({ incidentId, volunteerId });
    ensure(response, 'Volunteer response not found', 404);
    response.status = 'ARRIVED';
    await response.save();
    return mapResponse(response);
  }

  async getIncidentDetails(incidentId, requesterId) {
    const incident = await RescueIncident.findById(incidentId);
    ensure(incident, 'Incident not found', 404);

    const victim = await User.findById(incident.victimId).lean();
    ensure(victim, 'Victim not found', 404);
    const guardians = await this.getGuardiansForVictim(victim);
    const guardianIds = new Set(guardians.map((item) => item._id));
    const responses = await VolunteerResponse.find({ incidentId }).sort({ createdAt: 1 });
    const responderIds = new Set(responses.map((item) => item.volunteerId));
    const canAccess =
      incident.victimId === requesterId ||
      guardianIds.has(requesterId) ||
      responderIds.has(requesterId);
    ensure(canAccess, 'Unauthorized to access this incident', 403);

    const responderDocs = responderIds.size
      ? await User.find({ _id: { $in: [...responderIds] } }).lean()
      : [];
    const responderMap = new Map(responderDocs.map((item) => [item._id, sanitizeUser(item)]));
    const room = await chatService.getChatRoomByIncident(incidentId).catch(() => null);
    const memos = await EmergencyMemo.find({ incidentId }).sort({ createdAt: -1 }).limit(50).lean();

    return {
      ...mapIncident(incident),
      victim: sanitizeUser(victim),
      responses: responses.map((response) => ({
        ...mapResponse(response),
        volunteer: responderMap.get(response.volunteerId) || null,
      })),
      chatRoom: room
        ? {
            id: room._id || room.id,
            incidentId: room.incidentId,
            roomType: room.roomType,
            participantIds: room.participantIds || [],
            responderIds: room.responderIds || [],
            status: room.status,
            createdAt: room.createdAt,
            closedAt: room.closedAt,
          }
        : null,
      emergencyMemos: memos.map(mapMemo),
    };
  }

  async resolveIncident(incidentId, requesterId) {
    const incident = await RescueIncident.findById(incidentId);
    ensure(incident, 'Incident not found', 404);
    ensure(incident.victimId === requesterId, 'Only the victim can resolve this incident', 403);
    ensure(incident.status === 'ACTIVE', 'Incident is already resolved', 409);

    incident.status = 'RESOLVED';
    incident.resolvedAt = new Date();
    await incident.save();

    const arrivedResponses = await VolunteerResponse.find({
      incidentId,
      status: 'ARRIVED',
    }).lean();
    for (const response of arrivedResponses) {
      // eslint-disable-next-line no-await-in-loop
      await trustService.calculateAndUpdateTrustScore(response.volunteerId, 5);
    }

    await chatService.closeChatRoom(incidentId);
    await systemLogService.createLog({
      incidentId,
      actionType: 'INCIDENT_RESOLVED',
      description: `Incident ${incidentId} resolved by victim`,
    });

    try {
      getIo().emit('RADAR_INCIDENT_RESOLVED', { incidentId });
    } catch (_error) {
      // socket optional
    }

    return this.getIncidentDetailsForBroadcast(incidentId);
  }
}

module.exports = new RadarService();
