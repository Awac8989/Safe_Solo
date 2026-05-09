const path = require('path');

const { readState, withState, createId, nowIso } = require('../data/store');
const { AppError } = require('../lib/errors');
const { sanitizeUser } = require('../lib/utils');

class ChatService {
  ensureRoomAccess(state, userId, roomId) {
    const room = state.chatRooms.find((item) => item.id === roomId);
    if (!room) {
      throw new AppError('Chat room not found', 404);
    }
    if (room.status === 'READ_ONLY') {
      throw new AppError('Chat room is closed', 403);
    }

    const incident = state.rescueIncidents.find((item) => item.id === room.incidentId);
    if (!incident) {
      throw new AppError('Incident not found', 404);
    }

    const acceptedVolunteer = state.volunteerResponses.some(
      (item) => item.incidentId === incident.id && item.volunteerId === userId,
    );
    const guardian = state.guardianRelationships.some(
      (item) =>
        item.requesterId === incident.victimId &&
        item.guardianId === userId &&
        item.status === 'ACCEPTED',
    );

    if (incident.victimId !== userId && !acceptedVolunteer && !guardian) {
      throw new AppError('Unauthorized access to chat room', 403);
    }

    return { room, incident };
  }

  async checkUserAccessToRoom(userId, roomId) {
    const state = readState();
    this.ensureRoomAccess(state, userId, roomId);
    return true;
  }

  async createChatRoom(incidentId) {
    return withState((state) => {
      let room = state.chatRooms.find((item) => item.incidentId === incidentId);
      if (!room) {
        room = {
          id: createId('room'),
          incidentId,
          status: 'ACTIVE',
          createdAt: nowIso(),
          closedAt: null,
        };
        state.chatRooms.push(room);
      }
      return room;
    });
  }

  async getChatRoomByIncident(incidentId) {
    const state = readState();
    const room = state.chatRooms.find((item) => item.incidentId === incidentId);
    if (!room) {
      throw new AppError('Chat room not found', 404);
    }

    return {
      ...room,
      messages: state.messages
        .filter((item) => item.roomId === room.id)
        .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1))
        .map((message) => this.enrichMessage(state, message)),
    };
  }

  async createMessage(roomId, senderId, messageType, content, metadata = null) {
    return withState((state) => {
      if (senderId) {
        this.ensureRoomAccess(state, senderId, roomId);
      }

      const message = {
        id: createId('msg'),
        roomId,
        senderId: senderId || null,
        messageType,
        content,
        metadata: metadata || null,
        createdAt: nowIso(),
      };
      state.messages.push(message);
      return this.enrichMessage(state, message);
    });
  }

  async broadcastSystemMessage(roomId, text, metadata = null) {
    return this.createMessage(roomId, null, 'SYSTEM', text, metadata);
  }

  enrichMessage(state, message) {
    const sender = message.senderId
      ? state.users.find((item) => item.id === message.senderId)
      : null;

    return {
      ...message,
      sender: sender ? sanitizeUser(sender) : null,
    };
  }

  async getMessagesByRoomId(roomId) {
    const state = readState();
    return state.messages
      .filter((item) => item.roomId === roomId)
      .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1))
      .map((message) => this.enrichMessage(state, message));
  }

  async closeChatRoom(incidentId) {
    return withState((state) => {
      const room = state.chatRooms.find((item) => item.incidentId === incidentId);
      if (!room) {
        throw new AppError('Chat room not found for this incident', 404);
      }
      room.status = 'READ_ONLY';
      room.closedAt = nowIso();
      state.messages.push({
        id: createId('msg'),
        roomId: room.id,
        senderId: null,
        messageType: 'SYSTEM',
        content: 'Chat khan cap da duoc dong vi su co da ket thuc.',
        metadata: { incidentId },
        createdAt: nowIso(),
      });
      return room;
    });
  }

  async getInbox(userId) {
    const state = readState();

    const incidentRooms = state.chatRooms
      .map((room) => {
        const incident = state.rescueIncidents.find((item) => item.id === room.incidentId);
        if (!incident) return null;

        const canAccess =
          incident.victimId === userId ||
          state.guardianRelationships.some(
            (item) =>
              item.requesterId === incident.victimId &&
              item.guardianId === userId &&
              item.status === 'ACCEPTED',
          ) ||
          state.volunteerResponses.some(
            (item) => item.incidentId === incident.id && item.volunteerId === userId,
          );

        if (!canAccess) return null;
        const messages = state.messages
          .filter((item) => item.roomId === room.id)
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        const lastMessage = messages[0] || null;
        const victim = state.users.find((item) => item.id === incident.victimId);

        return {
          roomId: room.id,
          type: 'INCIDENT',
          incidentId: incident.id,
          title: victim ? `${victim.firstName} ${victim.lastName}`.trim() : 'Emergency Room',
          preview: lastMessage ? lastMessage.content : 'Chua co tin nhan',
          timestamp: lastMessage ? lastMessage.createdAt : room.createdAt,
          batteryLevel: victim?.batteryLevel ?? null,
          status: room.status,
        };
      })
      .filter(Boolean);

    const familyRooms = state.guardianRelationships
      .filter((item) => item.status === 'ACCEPTED' && (item.requesterId === userId || item.guardianId === userId))
      .map((item) => {
        const otherId = item.requesterId === userId ? item.guardianId : item.requesterId;
        const otherUser = state.users.find((user) => user.id === otherId);
        if (!otherUser) return null;
        return {
          roomId: `direct_${[userId, otherId].sort().join('_')}`,
          type: 'DIRECT',
          title: `${otherUser.firstName} ${otherUser.lastName}`.trim(),
          preview: otherUser.approxAddress ? `Vi tri gan nhat: ${otherUser.approxAddress}` : 'Guardian da ket noi',
          timestamp: item.updatedAt,
          batteryLevel: otherUser.batteryLevel ?? null,
          status: 'ACTIVE',
        };
      })
      .filter(Boolean);

    return [...incidentRooms, ...familyRooms].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  }

  buildVoiceUrl(filename) {
    return `/uploads/voices/${path.basename(filename)}`;
  }
}

module.exports = new ChatService();
