const { readState, withState, createId, nowIso } = require('../data/store');
const { AppError, ensure } = require('../lib/errors');
const { fuzzCoordinates, haversineKm, sanitizeUser } = require('../lib/utils');
const chatService = require('./chatService');
const trustService = require('./trustService');
const { createAlertEvent } = require('./alertEventService');
const systemLogService = require('./systemLogService');
const { getIo } = require('../sockets/socketServer');

class RadarService {
  async broadcastSOS(victimId, incidentType, exactLat, exactLng, options = {}) {
    const result = withState((state) => {
      const victim = state.users.find((item) => item.id === victimId);
      ensure(victim, 'Victim not found', 404);

      const { fuzzedLat, fuzzedLng } = fuzzCoordinates(exactLat, exactLng);
      const incident = {
        id: createId('incident'),
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
        createdAt: nowIso(),
        resolvedAt: null,
      };

      state.rescueIncidents.push(incident);
      victim.lastLat = exactLat;
      victim.lastLng = exactLng;
      victim.lastLocationTime = nowIso();
      victim.approxAddress = incident.approxAddress;
      victim.batteryLevel = incident.batteryLevel;
      victim.updatedAt = nowIso();

      return {
        incident,
        victim: sanitizeUser(victim),
      };
    });

    await chatService.createChatRoom(result.incident.id);
    await systemLogService.createLog({
      incidentId: result.incident.id,
      actionType: 'SOS_BROADCASTED',
      description: `SOS incident ${result.incident.id} created for victim ${victimId}`,
      metadata: {
        incidentType,
        lat: exactLat,
        lng: exactLng,
      },
    });

    const nearbyVolunteers = await this.findNearbyVolunteers(exactLat, exactLng, victimId);
    createAlertEvent({
      userId: victimId,
      level: 'SOS',
      status: 'SOS_BROADCASTED',
      source: 'USER',
      title: 'Da phat SOS',
      message: 'He thong dang thong bao cho guardians va tinh nguyen vien gan ban',
      metadata: {
        incidentId: result.incident.id,
        nearbyVolunteersCount: nearbyVolunteers.length,
      },
    });

    try {
      getIo().emit('RADAR_INCIDENT_CREATED', {
        incident: await this.getIncidentDetailsForBroadcast(result.incident.id),
      });
    } catch (_error) {
      // socket optional
    }

    return {
      incident: await this.getIncidentDetailsForBroadcast(result.incident.id),
      nearbyVolunteers,
    };
  }

  async getIncidentDetailsForBroadcast(incidentId) {
    const state = readState();
    const incident = state.rescueIncidents.find((item) => item.id === incidentId);
    if (!incident) {
      throw new AppError('Incident not found', 404);
    }
    const victim = state.users.find((item) => item.id === incident.victimId);
    return {
      ...incident,
      victim: victim ? sanitizeUser(victim) : null,
      roomId: state.chatRooms.find((item) => item.incidentId === incident.id)?.id || null,
    };
  }

  async findNearbyVolunteers(lat, lng, excludeUserId, radiusKm = 3) {
    const state = readState();
    return state.users
      .filter((item) => item.id !== excludeUserId && item.isActive)
      .filter((item) => item.role === 'VOLUNTEER' || item.role === 'HERO')
      .filter((item) => item.isKycVerified)
      .filter((item) => item.lastLat != null && item.lastLng != null)
      .map((item) => ({
        ...sanitizeUser(item),
        distanceKm: Number(haversineKm(lat, lng, item.lastLat, item.lastLng).toFixed(2)),
      }))
      .filter((item) => item.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  async getNearbyIncidents(volunteerLat, volunteerLng, volunteerId, radiusKm = 3) {
    const state = readState();
    return state.rescueIncidents
      .filter((item) => item.status === 'ACTIVE' && item.victimId !== volunteerId)
      .map((incident) => {
        const victim = state.users.find((user) => user.id === incident.victimId);
        const distanceKm = haversineKm(volunteerLat, volunteerLng, incident.fuzzedLat, incident.fuzzedLng);
        return {
          ...incident,
          victim: victim ? sanitizeUser(victim) : null,
          distanceKm: Number(distanceKm.toFixed(2)),
          hasAccepted: state.volunteerResponses.some(
            (response) => response.incidentId === incident.id && response.volunteerId === volunteerId,
          ),
        };
      })
      .filter((item) => item.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  async acceptRescueIncident(incidentId, volunteerId) {
    return withState((state) => {
      const volunteer = state.users.find((item) => item.id === volunteerId);
      ensure(volunteer, 'Volunteer not found', 404);
      ensure(volunteer.isKycVerified, 'KYC verification required before accepting rescue missions', 403);

      const incident = state.rescueIncidents.find((item) => item.id === incidentId);
      ensure(incident, 'Incident not found', 404);
      ensure(incident.status === 'ACTIVE', 'Incident is no longer active', 409);

      const existing = state.volunteerResponses.find(
        (item) => item.incidentId === incidentId && item.volunteerId === volunteerId,
      );
      if (existing) {
        throw new AppError('You have already accepted this rescue mission', 409);
      }

      const response = {
        id: createId('resp'),
        incidentId,
        volunteerId,
        status: 'EN_ROUTE',
        createdAt: nowIso(),
      };
      state.volunteerResponses.push(response);

      createAlertEvent({
        userId: incident.victimId,
        level: 'INFO',
        status: 'VOLUNTEER_ACCEPTED',
        source: 'COMMUNITY',
        title: 'Tinh nguyen vien dang den',
        message: `${volunteer.firstName} ${volunteer.lastName}`.trim() + ' da nhan ho tro',
        metadata: { incidentId, volunteerId },
      });

      return {
        response,
        incident: {
          ...incident,
          victim: sanitizeUser(state.users.find((item) => item.id === incident.victimId)),
        },
      };
    });
  }

  async markVolunteerArrived(incidentId, volunteerId) {
    return withState((state) => {
      const response = state.volunteerResponses.find(
        (item) => item.incidentId === incidentId && item.volunteerId === volunteerId,
      );
      ensure(response, 'Volunteer response not found', 404);
      response.status = 'ARRIVED';
      return response;
    });
  }

  async getIncidentDetails(incidentId, requesterId) {
    const state = readState();
    const incident = state.rescueIncidents.find((item) => item.id === incidentId);
    ensure(incident, 'Incident not found', 404);

    const canAccess =
      incident.victimId === requesterId ||
      state.volunteerResponses.some(
        (item) => item.incidentId === incidentId && item.volunteerId === requesterId,
      ) ||
      state.guardianRelationships.some(
        (item) =>
          item.requesterId === incident.victimId &&
          item.guardianId === requesterId &&
          item.status === 'ACCEPTED',
      );

    ensure(canAccess, 'Unauthorized to access this incident', 403);

    return {
      ...incident,
      victim: sanitizeUser(state.users.find((item) => item.id === incident.victimId)),
      responses: state.volunteerResponses
        .filter((item) => item.incidentId === incidentId)
        .map((response) => ({
          ...response,
          volunteer: sanitizeUser(state.users.find((item) => item.id === response.volunteerId)),
        })),
      chatRoom: state.chatRooms.find((item) => item.incidentId === incidentId) || null,
      emergencyMemos: state.emergencyMemos.filter((item) => item.incidentId === incidentId),
    };
  }

  async resolveIncident(incidentId, requesterId) {
    const result = withState((state) => {
      const incident = state.rescueIncidents.find((item) => item.id === incidentId);
      ensure(incident, 'Incident not found', 404);
      ensure(incident.victimId === requesterId, 'Only the victim can resolve this incident', 403);
      ensure(incident.status === 'ACTIVE', 'Incident is already resolved', 409);

      incident.status = 'RESOLVED';
      incident.resolvedAt = nowIso();

      return {
        incident,
        arrivedVolunteerIds: state.volunteerResponses
          .filter((item) => item.incidentId === incidentId && item.status === 'ARRIVED')
          .map((item) => item.volunteerId),
      };
    });

    for (const volunteerId of result.arrivedVolunteerIds) {
      await trustService.calculateAndUpdateTrustScore(volunteerId, 5);
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
