const prisma = require('../config/database');

class ChatService {
  // Check if user has access to chat room
  async checkUserAccessToRoom(userId, roomId) {
    const chatRoom = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        incident: {
          include: {
            victim: true,
            responses: {
              where: { status: 'ARRIVED' },
              include: { volunteer: true }
            }
          }
        }
      }
    });

    if (!chatRoom) {
      throw new Error('Chat room not found');
    }

    if (chatRoom.status === 'READ_ONLY') {
      throw new Error('Chat room is closed');
    }

    const incident = chatRoom.incident;

    // Check if user is the victim
    if (incident.victimId === userId) {
      return true;
    }

    // Check if user is an accepted volunteer
    const isAcceptedVolunteer = incident.responses.some(response =>
      response.volunteerId === userId && response.status === 'ARRIVED'
    );
    if (isAcceptedVolunteer) {
      return true;
    }

    // Check if user is a guardian of the victim
    const guardianRelation = await prisma.guardianRelationship.findFirst({
      where: {
        requesterId: incident.victimId,
        guardianId: userId,
        status: 'ACCEPTED'
      }
    });

    if (guardianRelation) {
      return true;
    }

    throw new Error('Unauthorized access to chat room');
  }

  // Create a new message
  async createMessage(roomId, senderId, messageType, content) {
    const message = await prisma.message.create({
      data: {
        roomId,
        senderId: senderId || null, // Null for system messages
        messageType,
        content
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        }
      }
    });

    return message;
  }

  // Broadcast system message to room
  async broadcastSystemMessage(roomId, text) {
    return await this.createMessage(roomId, null, 'SYSTEM', text);
  }

  // Close chat room (set to READ_ONLY)
  async closeChatRoom(incidentId) {
    const chatRoom = await prisma.chatRoom.findUnique({
      where: { incidentId }
    });

    if (!chatRoom) {
      throw new Error('Chat room not found for this incident');
    }

    await prisma.chatRoom.update({
      where: { id: chatRoom.id },
      data: {
        status: 'READ_ONLY',
        closedAt: new Date()
      }
    });

    // Broadcast system message about room closure
    await this.broadcastSystemMessage(chatRoom.id, 'This chat room has been closed as the incident has been resolved.');

    return chatRoom.id;
  }

  // Get chat room by incident ID
  async getChatRoomByIncident(incidentId) {
    return await prisma.chatRoom.findUnique({
      where: { incidentId },
      include: {
        messages: {
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });
  }

  // Get messages by room ID
  async getMessagesByRoomId(roomId) {
    const messages = await prisma.message.findMany({
      where: { roomId },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    return messages;
  }
}

module.exports = new ChatService();