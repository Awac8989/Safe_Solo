const prisma = require('../config/database');
const chatService = require('./chatService');
const trustService = require('./trustService');

class RadarService {
  // Generate fuzzed coordinates (50m offset for privacy)
  generateFuzzedCoordinates(lat, lng) {
    // Approximate conversion: 1 degree latitude ≈ 111 km
    // 1 degree longitude ≈ 111 km * cos(latitude)
    // For 50m offset, we need approximately 0.00045 degrees

    const offsetMeters = 50;
    const latOffset = offsetMeters / 111000; // meters to degrees latitude
    const lngOffset = offsetMeters / (111000 * Math.cos(lat * Math.PI / 180)); // meters to degrees longitude

    // Generate random offset within ±50m
    const randomLatOffset = (Math.random() - 0.5) * 2 * latOffset;
    const randomLngOffset = (Math.random() - 0.5) * 2 * lngOffset;

    return {
      fuzzedLat: lat + randomLatOffset,
      fuzzedLng: lng + randomLngOffset
    };
  }

  // Create rescue incident and broadcast SOS
  async broadcastSOS(victimId, incidentType, exactLat, exactLng) {
    // Generate fuzzed coordinates for privacy
    const { fuzzedLat, fuzzedLng } = this.generateFuzzedCoordinates(exactLat, exactLng);

    // Create rescue incident
    const incident = await prisma.rescueIncident.create({
      data: {
        victimId,
        incidentType,
        exactLat,
        exactLng,
        fuzzedLat,
        fuzzedLng,
        status: 'ACTIVE'
      },
      include: {
        victim: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true
          }
        }
      }
    });

    // Create chat room for the incident
    await chatService.createChatRoom(incident.id);

    // Find nearby volunteers using PostGIS spatial query
    const nearbyVolunteers = await this.findNearbyVolunteers(exactLat, exactLng, victimId);

    return {
      incident,
      nearbyVolunteers: nearbyVolunteers.map(v => v.id) // Return only IDs for push notifications
    };
  }

  // Find nearby volunteers within 3km radius using PostGIS
  async findNearbyVolunteers(lat, lng, excludeUserId) {
    // Use PostGIS ST_DWithin function to find users within 3000 meters
    // Create geometry points on-the-fly from lat/lng columns
    // ST_DWithin uses geography for accurate distance calculations on Earth's surface
    const nearbyUsers = await prisma.$queryRaw`
      SELECT
        u.id,
        u."firstName",
        u."lastName",
        u."lastLat",
        u."lastLng",
        u."lastLocationTime"
      FROM users u
      WHERE u.id != ${excludeUserId}
        AND u."isActive" = true
        AND u."lastLat" IS NOT NULL
        AND u."lastLng" IS NOT NULL
        AND u."lastLocationTime" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM guardian_relationships gr
          WHERE gr."requesterId" = ${excludeUserId}
            AND gr."guardianId" = u.id
            AND gr.status = 'ACCEPTED'
        )
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(u."lastLng", u."lastLat"), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          3000
        )
      ORDER BY ST_Distance(
        ST_SetSRID(ST_MakePoint(u."lastLng", u."lastLat"), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      )
      LIMIT 50
    `;

    return nearbyUsers;
  }

  // Get nearby active incidents for volunteers (with fuzzed coordinates)
  async getNearbyIncidents(volunteerLat, volunteerLng, volunteerId) {
    // Find active incidents within 3km of volunteer
    const nearbyIncidents = await prisma.$queryRaw`
      SELECT
        ri.id,
        ri."incidentType",
        ri."fuzzedLat",
        ri."fuzzedLng",
        ri."createdAt",
        u."firstName" as "victimFirstName",
        u."lastName" as "victimLastName"
      FROM rescue_incidents ri
      JOIN users u ON ri."victimId" = u.id
      WHERE ri.status = 'ACTIVE'
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(ri."fuzzedLng", ri."fuzzedLat"), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${volunteerLng}, ${volunteerLat}), 4326)::geography,
          3000
        )
        AND ri."victimId" != ${volunteerId}
        AND NOT EXISTS (
          SELECT 1 FROM volunteer_responses vr
          WHERE vr."incidentId" = ri.id
            AND vr."volunteerId" = ${volunteerId}
        )
      ORDER BY ri."createdAt" DESC
      LIMIT 20
    `;

    return nearbyIncidents;
  }

  // Accept rescue incident with concurrency control
  async acceptRescueIncident(incidentId, volunteerId) {
    // Use transaction to ensure atomicity and prevent race conditions
    return await prisma.$transaction(async (tx) => {
      // Check current volunteer count for this incident
      const volunteerCount = await tx.volunteerResponse.count({
        where: { incidentId }
      });

      if (volunteerCount >= 3) {
        throw new Error('Đã đủ người hỗ trợ. Không thể nhận thêm tình nguyện viên.');
      }

      // Check if volunteer already responded to this incident
      const existingResponse = await tx.volunteerResponse.findUnique({
        where: {
          incidentId_volunteerId: {
            incidentId,
            volunteerId
          }
        }
      });

      if (existingResponse) {
        throw new Error('Bạn đã nhận ca cứu hộ này rồi.');
      }

      // Create volunteer response
      const response = await tx.volunteerResponse.create({
        data: {
          incidentId,
          volunteerId,
          status: 'EN_ROUTE'
        }
      });

      // Get incident details with exact coordinates and victim info
      const incident = await tx.rescueIncident.findUnique({
        where: { id: incidentId },
        include: {
          victim: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true
            }
          }
        }
      });

      if (!incident) {
        throw new Error('Không tìm thấy ca cứu hộ.');
      }

      if (incident.status !== 'ACTIVE') {
        throw new Error('Ca cứu hộ này không còn hoạt động.');
      }

      return {
        response,
        incident: {
          id: incident.id,
          incidentType: incident.incidentType,
          exactLat: incident.exactLat,
          exactLng: incident.exactLng,
          victim: incident.victim,
          createdAt: incident.createdAt
        }
      };
    });
  }

  // Resolve incident and close chat room
  async resolveIncident(incidentId) {
    const incident = await prisma.rescueIncident.findUnique({
      where: { id: incidentId },
      include: { chatRoom: true }
    });

    if (!incident) {
      throw new Error('Incident not found');
    }

    if (incident.status === 'RESOLVED') {
      throw new Error('Incident is already resolved');
    }

    // Update incident status
    await prisma.rescueIncident.update({
      where: { id: incidentId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date()
      }
    });

    // Close chat room if it exists
    if (incident.chatRoom) {
      await chatService.closeChatRoom(incidentId);
    }

    return incident;
  }

  // Get incident details (for volunteers who accepted)
  async getIncidentDetails(incidentId, volunteerId) {
    // Check if volunteer has accepted this incident
    const response = await prisma.volunteerResponse.findUnique({
      where: {
        incidentId_volunteerId: {
          incidentId,
          volunteerId
        }
      }
    });

    if (!response) {
      throw new Error('Bạn chưa nhận ca cứu hộ này.');
    }

    const incident = await prisma.rescueIncident.findUnique({
      where: { id: incidentId },
      include: {
        victim: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true
          }
        },
        responses: {
          include: {
            volunteer: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    return incident;
  }

  // Resolve incident
  async resolveIncident(incidentId, victimId) {
    const incident = await prisma.rescueIncident.update({
      where: { id: incidentId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date()
      },
      include: {
        responses: {
          include: {
            volunteer: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    // Update trust scores for all volunteers who responded
    for (const response of incident.responses) {
      if (response.status === 'ARRIVED') {
        await trustService.calculateAndUpdateTrustScore(response.volunteerId, 5.0); // Default 5-star rating for successful rescue
      }
    }

    // Close chat room if it exists
    if (incident.chatRoom) {
      await chatService.closeChatRoom(incidentId);
    }

    return incident;
  }
}

module.exports = new RadarService();