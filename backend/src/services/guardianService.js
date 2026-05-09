const prisma = require('../config/database');

class GuardianService {
  // Send guardian request
  async sendGuardianRequest(requesterId, guardianId, message = null) {
    // Check if users exist
    const [requester, guardian] = await Promise.all([
      prisma.user.findUnique({ where: { id: requesterId } }),
      prisma.user.findUnique({ where: { id: guardianId } })
    ]);

    if (!requester || !guardian) {
      throw new Error('User not found');
    }

    if (requesterId === guardianId) {
      throw new Error('Cannot send request to yourself');
    }

    // Check if relationship already exists
    const existingRelationship = await prisma.guardianRelationship.findUnique({
      where: {
        requesterId_guardianId: {
          requesterId,
          guardianId
        }
      }
    });

    if (existingRelationship) {
      if (existingRelationship.status === 'PENDING') {
        throw new Error('Request already sent');
      }
      if (existingRelationship.status === 'ACCEPTED') {
        throw new Error('Already connected');
      }
      if (existingRelationship.status === 'BLOCKED') {
        throw new Error('Cannot send request to blocked user');
      }
    }

    // Create relationship request
    const relationship = await prisma.guardianRelationship.create({
      data: {
        requesterId,
        guardianId,
        message,
        status: 'PENDING'
      },
      include: {
        requester: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        guardian: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });

    return relationship;
  }

  // Respond to guardian request
  async respondToRequest(relationshipId, guardianId, action) {
    const relationship = await prisma.guardianRelationship.findUnique({
      where: { id: relationshipId }
    });

    if (!relationship) {
      throw new Error('Relationship request not found');
    }

    if (relationship.guardianId !== guardianId) {
      throw new Error('Unauthorized to respond to this request');
    }

    if (relationship.status !== 'PENDING') {
      throw new Error('Request has already been responded to');
    }

    const newStatus = action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';

    const updatedRelationship = await prisma.guardianRelationship.update({
      where: { id: relationshipId },
      data: { status: newStatus },
      include: {
        requester: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        guardian: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });

    return updatedRelationship;
  }

  // Get user's guardians
  async getUserGuardians(userId) {
    const relationships = await prisma.guardianRelationship.findMany({
      where: {
        OR: [
          { requesterId: userId, status: 'ACCEPTED' },
          { guardianId: userId, status: 'ACCEPTED' }
        ]
      },
      include: {
        requester: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatar: true }
        },
        guardian: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatar: true }
        }
      }
    });

    // Separate into guardians and proteges
    const guardians = relationships
      .filter(rel => rel.guardianId === userId)
      .map(rel => ({
        id: rel.id,
        user: rel.requester,
        relationship: 'protege',
        connectedAt: rel.updatedAt
      }));

    const proteges = relationships
      .filter(rel => rel.requesterId === userId)
      .map(rel => ({
        id: rel.id,
        user: rel.guardian,
        relationship: 'guardian',
        connectedAt: rel.updatedAt
      }));

    return { guardians, proteges };
  }

  // Get pending requests (sent and received)
  async getPendingRequests(userId) {
    const [sentRequests, receivedRequests] = await Promise.all([
      prisma.guardianRelationship.findMany({
        where: {
          requesterId: userId,
          status: 'PENDING'
        },
        include: {
          guardian: {
            select: { id: true, firstName: true, lastName: true, email: true, avatar: true }
          }
        }
      }),
      prisma.guardianRelationship.findMany({
        where: {
          guardianId: userId,
          status: 'PENDING'
        },
        include: {
          requester: {
            select: { id: true, firstName: true, lastName: true, email: true, avatar: true }
          }
        }
      })
    ]);

    return {
      sent: sentRequests.map(req => ({
        id: req.id,
        user: req.guardian,
        message: req.message,
        sentAt: req.createdAt
      })),
      received: receivedRequests.map(req => ({
        id: req.id,
        user: req.requester,
        message: req.message,
        receivedAt: req.createdAt
      }))
    };
  }

  // Remove guardian relationship
  async removeRelationship(relationshipId, userId) {
    const relationship = await prisma.guardianRelationship.findUnique({
      where: { id: relationshipId }
    });

    if (!relationship) {
      throw new Error('Relationship not found');
    }

    if (relationship.requesterId !== userId && relationship.guardianId !== userId) {
      throw new Error('Unauthorized to remove this relationship');
    }

    await prisma.guardianRelationship.delete({
      where: { id: relationshipId }
    });

    return { message: 'Relationship removed successfully' };
  }

  // Block user
  async blockUser(relationshipId, userId) {
    const relationship = await prisma.guardianRelationship.findUnique({
      where: { id: relationshipId }
    });

    if (!relationship) {
      throw new Error('Relationship not found');
    }

    if (relationship.guardianId !== userId) {
      throw new Error('Unauthorized to block this user');
    }

    await prisma.guardianRelationship.update({
      where: { id: relationshipId },
      data: { status: 'BLOCKED' }
    });

    return { message: 'User blocked successfully' };
  }

  // Search users for guardian requests
  async searchUsers(query, currentUserId, limit = 20) {
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: currentUserId } },
          { isActive: true },
          {
            OR: [
              { email: { contains: query, mode: 'insensitive' } },
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } }
            ]
          }
        ]
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true
      },
      take: limit
    });

    return users;
  }
}

module.exports = new GuardianService();