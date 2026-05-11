const GuardianRelationship = require('../models/GuardianRelationship');
const User = require('../models/User');
const { AppError, ensure } = require('../lib/errors');
const { sanitizeUser, normalizeEmail, fullName } = require('../lib/utils');
const { createAlertEvent } = require('./alertEventService');

class GuardianService {
  async sendGuardianRequest(requesterId, guardianId, message = null, escalationLevel = 1) {
    const [requester, guardian] = await Promise.all([
      User.findById(requesterId),
      User.findById(guardianId),
    ]);

    ensure(requester, 'Requester not found', 404);
    ensure(guardian, 'Guardian not found', 404);
    ensure(requesterId !== guardianId, 'Cannot send request to yourself');

    const existing = await GuardianRelationship.findOne({
      requesterId,
      guardianId,
      status: { $ne: 'REJECTED' },
    });

    if (existing) {
      throw new AppError('Guardian request already exists', 409);
    }

    const relationship = await GuardianRelationship.create({
      requesterId,
      guardianId,
      status: 'PENDING',
      escalationLevel,
      guardianConfirmedAt: null,
      lastNotifiedAt: null,
      message: message || '',
    });

    await createAlertEvent({
      userId: guardianId,
      level: 'INFO',
      status: 'GUARDIAN_REQUEST_RECEIVED',
      source: 'USER',
      title: 'Loi moi guardian',
      message: `${fullName(requester)} muon ket noi voi ban`,
      metadata: { relationshipId: relationship._id },
    });

    return {
      ...relationship.toObject(),
      id: relationship._id,
      requester: sanitizeUser(requester),
      guardian: sanitizeUser(guardian),
    };
  }

  async respondToRequest(relationshipId, guardianId, action) {
    const relationship = await GuardianRelationship.findById(relationshipId);
    ensure(relationship, 'Guardian request not found', 404);
    ensure(relationship.guardianId === guardianId, 'Unauthorized', 403);
    ensure(relationship.status === 'PENDING', 'Guardian request already handled', 409);

    relationship.status = action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
    relationship.guardianConfirmedAt = action === 'ACCEPT' ? new Date() : null;
    await relationship.save();

    await createAlertEvent({
      userId: relationship.requesterId,
      level: 'INFO',
      status: relationship.status === 'ACCEPTED' ? 'GUARDIAN_ACCEPTED' : 'GUARDIAN_REJECTED',
      source: 'USER',
      title: 'Cap nhat guardian',
      message: `Guardian request ${relationship.status.toLowerCase()}`,
      metadata: { relationshipId },
    });

    return {
      ...relationship.toObject(),
      id: relationship._id,
    };
  }

  async getUserGuardians(userId) {
    const accepted = await GuardianRelationship.find({
      status: 'ACCEPTED',
      $or: [{ requesterId: userId }, { guardianId: userId }],
    }).lean();

    const userIds = [...new Set(accepted.flatMap((item) => [item.requesterId, item.guardianId]))];
    const users = userIds.length ? await User.find({ _id: { $in: userIds } }).lean() : [];
    const userMap = new Map(users.map((item) => [item._id, sanitizeUser(item)]));

    const guardians = accepted
      .filter((item) => item.requesterId === userId)
      .map((item) => ({
        relationshipId: item._id,
        escalationLevel: item.escalationLevel,
        guardianConfirmedAt: item.guardianConfirmedAt,
        relationship: 'guardian',
        user: userMap.get(item.guardianId) || null,
      }))
      .filter((item) => item.user);

    const proteges = accepted
      .filter((item) => item.guardianId === userId)
      .map((item) => ({
        relationshipId: item._id,
        escalationLevel: item.escalationLevel,
        guardianConfirmedAt: item.guardianConfirmedAt,
        relationship: 'protege',
        user: userMap.get(item.requesterId) || null,
      }))
      .filter((item) => item.user);

    return { guardians, proteges };
  }

  async getPendingRequests(userId) {
    const [sent, received] = await Promise.all([
      GuardianRelationship.find({ requesterId: userId, status: 'PENDING' }).lean(),
      GuardianRelationship.find({ guardianId: userId, status: 'PENDING' }).lean(),
    ]);
    const userIds = [...new Set([
      ...sent.map((item) => item.guardianId),
      ...received.map((item) => item.requesterId),
    ])];
    const users = userIds.length ? await User.find({ _id: { $in: userIds } }).lean() : [];
    const userMap = new Map(users.map((item) => [item._id, sanitizeUser(item)]));

    return {
      sent: sent.map((item) => ({
        ...item,
        id: item._id,
        user: userMap.get(item.guardianId) || null,
      })),
      received: received.map((item) => ({
        ...item,
        id: item._id,
        user: userMap.get(item.requesterId) || null,
      })),
    };
  }

  async removeRelationship(relationshipId, userId) {
    const relationship = await GuardianRelationship.findById(relationshipId);
    ensure(relationship, 'Relationship not found', 404);
    ensure(
      relationship.requesterId === userId || relationship.guardianId === userId,
      'Unauthorized',
      403,
    );
    await GuardianRelationship.deleteOne({ _id: relationshipId });
    return { message: 'Relationship removed successfully' };
  }

  async blockUser(relationshipId, userId) {
    const relationship = await GuardianRelationship.findById(relationshipId);
    ensure(relationship, 'Relationship not found', 404);
    ensure(
      relationship.requesterId === userId || relationship.guardianId === userId,
      'Unauthorized',
      403,
    );
    relationship.status = 'BLOCKED';
    await relationship.save();
    return { message: 'User blocked successfully' };
  }

  async searchUsers(term, currentUserId, limit = 20) {
    const query = String(term || '').trim().toLowerCase();
    return (await User.find({ _id: { $ne: currentUserId }, isActive: { $ne: false } }).lean())
      .filter((item) => {
        const haystack = [
          normalizeEmail(item.email),
          item.phoneNumber || '',
          item.firstName || '',
          item.lastName || '',
          fullName(item),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, limit)
      .map(sanitizeUser);
  }
}

module.exports = new GuardianService();
