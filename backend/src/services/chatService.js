const path = require('path');

const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');
const EmergencyLog = require('../models/EmergencyLog');
const RescueIncident = require('../models/RescueIncident');
const User = require('../models/User');
const { AppError } = require('../lib/errors');
const { sanitizeUser } = require('../lib/utils');

class ChatService {
  async getAccessibleIncidentUserIds(victimId) {
    const victim = await User.findById(victimId).lean();
    if (!victim) {
      throw new AppError('Victim not found', 404);
    }

    const phones = new Set(
      (victim.emergencyContacts || [])
        .map((item) => String(item?.phone || '').trim())
        .filter(Boolean),
    );

    const guardians = phones.size
      ? await User.find({ phoneNumber: { $in: [...phones] } }).lean()
      : [];

    return {
      victim,
      accessibleIds: [victimId, ...guardians.map((item) => item._id)],
    };
  }

  async ensureRoomAccess(userId, roomId) {
    const room = await ChatRoom.findById(roomId);
    if (!room) {
      throw new AppError('Chat room not found', 404);
    }
    if (room.status === 'READ_ONLY') {
      throw new AppError('Chat room is closed', 403);
    }

    if (room.roomType === 'DIRECT' || room.roomType === 'GROUP') {
      if (!room.participantIds.includes(userId)) {
        throw new AppError('Unauthorized access to chat room', 403);
      }
      return { room, incident: null };
    }

    if (!room.incidentId) {
      if (!room.participantIds.includes(userId)) {
        throw new AppError('Unauthorized access to chat room', 403);
      }
      return { room, incident: null };
    }

    const incident =
      (await RescueIncident.findById(room.incidentId)) ||
      (await EmergencyLog.findById(room.incidentId));
    if (!incident) {
      throw new AppError('Incident not found', 404);
    }

    const incidentUserId = incident.victimId || incident.userId;
    const { accessibleIds } = await this.getAccessibleIncidentUserIds(incidentUserId);
    const canAccess =
      accessibleIds.includes(userId) ||
      room.participantIds.includes(userId) ||
      room.responderIds.includes(userId);

    if (!canAccess) {
      throw new AppError('Unauthorized access to chat room', 403);
    }

    return { room, incident };
  }

  async checkUserAccessToRoom(userId, roomId) {
    await this.ensureRoomAccess(userId, roomId);
    return true;
  }

  async createChatRoom(incidentId, options = {}) {
    let room = await ChatRoom.findOne({ incidentId });
    if (room) {
      return room;
    }

    const incident =
      (await RescueIncident.findById(incidentId).lean()) ||
      (await EmergencyLog.findById(incidentId).lean());
    const participantIds = Array.isArray(options.participantIds) ? [...new Set(options.participantIds)] : [];
    const incidentUserId = incident?.victimId || incident?.userId;
    if (incidentUserId && !participantIds.includes(incidentUserId)) {
      participantIds.push(incidentUserId);
    }

    room = await ChatRoom.create({
      roomType: options.roomType || 'INCIDENT',
      title: options.title || '',
      incidentId,
      participantIds,
      responderIds: Array.isArray(options.responderIds) ? [...new Set(options.responderIds)] : [],
      status: 'ACTIVE',
      metadata: options.metadata || null,
    });
    return room;
  }

  async syncIncidentRoomParticipants(incidentId, participantIds = [], responderIds = []) {
    const room = await this.createChatRoom(incidentId, { participantIds, responderIds });
    const nextParticipants = [...new Set([...(room.participantIds || []), ...participantIds, ...responderIds])];
    const nextResponders = [...new Set([...(room.responderIds || []), ...responderIds])];
    room.participantIds = nextParticipants;
    room.responderIds = nextResponders;
    await room.save();
    return room;
  }

  async addResponderToIncidentRoom(incidentId, responderId) {
    return this.syncIncidentRoomParticipants(incidentId, [], [responderId]);
  }

  async getChatRoomByIncident(incidentId) {
    const room = await ChatRoom.findOne({ incidentId });
    if (!room) {
      throw new AppError('Chat room not found', 404);
    }

    return {
      ...(room.toObject ? room.toObject() : room),
      messages: await this.getMessagesByRoomId(room._id),
    };
  }

  async enrichMessage(message) {
    const sender = message.senderId ? await User.findById(message.senderId).lean() : null;
    const payload = message.toObject ? message.toObject() : message;
    return {
      ...payload,
      id: payload._id,
      sender: sender ? sanitizeUser(sender) : null,
    };
  }

  async createMessage(roomId, senderId, messageType, content, metadata = null) {
    if (senderId) {
      await this.ensureRoomAccess(senderId, roomId);
    }

    const message = await Message.create({
      roomId,
      senderId: senderId || null,
      messageType,
      content,
      metadata: metadata || null,
      createdAt: new Date(),
    });

    return this.enrichMessage(message);
  }

  async broadcastSystemMessage(roomId, text, metadata = null) {
    return this.createMessage(roomId, null, 'SYSTEM', text, metadata);
  }

  async getMessagesByRoomId(roomId) {
    const messages = await Message.find({ roomId }).sort({ createdAt: 1 }).lean();
    const senderIds = [...new Set(messages.map((item) => item.senderId).filter(Boolean))];
    const senders = senderIds.length
      ? await User.find({ _id: { $in: senderIds } }).lean()
      : [];
    const senderMap = new Map(senders.map((item) => [item._id, sanitizeUser(item)]));

    return messages.map((message) => ({
      ...message,
      id: message._id,
      sender: message.senderId ? senderMap.get(message.senderId) || null : null,
    }));
  }

  async closeChatRoom(incidentId) {
    const room = await ChatRoom.findOne({ incidentId });
    if (!room) {
      throw new AppError('Chat room not found for this incident', 404);
    }
    room.status = 'READ_ONLY';
    room.closedAt = new Date();
    await room.save();

    await Message.create({
      roomId: room._id,
      senderId: null,
      messageType: 'SYSTEM',
      content: 'Chat khan cap da duoc dong vi su co da ket thuc.',
      metadata: { incidentId },
      createdAt: new Date(),
    });

    return room;
  }

  async getInbox(userId) {
    const directRooms = await ChatRoom.find({
      roomType: { $in: ['DIRECT', 'GROUP'] },
      participantIds: userId,
    }).sort({ updatedAt: -1 }).lean();

    const incidentInfo = await this.getAccessibleIncidentUserIds(userId).catch(() => null);
    const incidentRooms = incidentInfo
      ? await ChatRoom.find({
          roomType: 'INCIDENT',
          participantIds: { $in: [userId] },
        }).sort({ updatedAt: -1 }).lean()
      : [];

    return [...incidentRooms, ...directRooms];
  }

  buildVoiceUrl(filename) {
    return `/uploads/voices/${path.basename(filename)}`;
  }
}

module.exports = new ChatService();
