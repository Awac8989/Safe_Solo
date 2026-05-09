const { getIo } = require('../sockets/socketServer');
const prisma = require('../config/database');
const { sendEmergencySms } = require('./smsService');
const systemLogService = require('./systemLogService');

function getFullName(user) {
  return `${user.firstName || ''} ${user.lastName || ''}`.trim();
}

function fuzzCoordinate(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  return value + (Math.random() - 0.5) * 0.001;
}

class EmergencyService {
  async createSilentSosIncident(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const exactLat = user.lastLat ?? 0;
    const exactLng = user.lastLng ?? 0;
    const fuzzedLat = fuzzCoordinate(exactLat);
    const fuzzedLng = fuzzCoordinate(exactLng);

    const incident = await prisma.rescueIncident.create({
      data: {
        victimId: userId,
        status: 'ACTIVE',
        incidentType: 'silent_sos',
        exactLat,
        exactLng,
        fuzzedLat,
        fuzzedLng,
        severity: 3,
      },
    });

    await systemLogService.createLog({
      incidentId: incident.id,
      actionType: 'SILENT_SOS_TRIGGERED',
      description: 'Silent SOS activated and hidden rescue incident created.',
    });

    const payload = {
      type: 'ADMIN_SILENT_SOS',
      userId: user.id,
      userName: getFullName(user),
      incidentId: incident.id,
      severity: 3,
      incidentType: 'silent_sos',
      location: {
        exactLat,
        exactLng,
        fuzzedLat,
        fuzzedLng,
      },
      createdAt: new Date().toISOString(),
    };

    try {
      getIo().emit('ADMIN_SILENT_SOS', payload);
    } catch (error) {
      // ignore emit failure when Socket.io is not ready
    }

    return incident;
  }

  async notifyGuardians(user, escalationLevel) {
    const guardianRelationships = await prisma.guardianRelationship.findMany({
      where: {
        requesterId: user.id,
        status: 'ACCEPTED',
        escalationLevel,
      },
      include: {
        guardian: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    const contacts = guardianRelationships
      .filter((rel) => rel.guardian?.phone)
      .map((rel) => ({
        phone: rel.guardian.phone,
        name: `${rel.guardian.firstName || ''} ${rel.guardian.lastName || ''}`.trim(),
      }));

    if (contacts.length === 0) {
      await systemLogService.createLog({
        actionType: 'DEADMAN_ESCALATION_SKIPPED',
        description: `No guardians found at level ${escalationLevel} for user ${user.id}`,
      });
      return [];
    }

    const smsResults = await sendEmergencySms({
      emergencyLogId: null,
      user: {
        _id: user.id,
        id: user.id,
        fullName: getFullName(user),
        phoneNumber: user.phone,
        email: user.email,
      },
      contacts,
      location: {
        lat: user.lastLat ?? null,
        lng: user.lastLng ?? null,
      },
    });

    await systemLogService.createLog({
      actionType: 'DEADMAN_ESCALATION_SENT',
      description: `Sent level ${escalationLevel} dead man alert to ${contacts.length} guardians for user ${user.id}`,
    });

    return smsResults;
  }
}

module.exports = new EmergencyService();
