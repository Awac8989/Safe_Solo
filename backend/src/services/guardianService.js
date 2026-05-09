const { readState, withState, createId, nowIso } = require('../data/store');
const { AppError, ensure } = require('../lib/errors');
const { sanitizeUser, normalizeEmail, fullName } = require('../lib/utils');
const { createAlertEvent } = require('./alertEventService');

class GuardianService {
  async sendGuardianRequest(requesterId, guardianId, message = null, escalationLevel = 1) {
    return withState((state) => {
      const requester = state.users.find((item) => item.id === requesterId);
      const guardian = state.users.find((item) => item.id === guardianId);

      ensure(requester, 'Requester not found', 404);
      ensure(guardian, 'Guardian not found', 404);
      ensure(requesterId !== guardianId, 'Cannot send request to yourself');

      const existing = state.guardianRelationships.find(
        (item) =>
          item.requesterId === requesterId &&
          item.guardianId === guardianId &&
          item.status !== 'REJECTED',
      );

      if (existing) {
        throw new AppError('Guardian request already exists', 409);
      }

      const relationship = {
        id: createId('guard'),
        requesterId,
        guardianId,
        status: 'PENDING',
        escalationLevel,
        guardianConfirmedAt: null,
        lastNotifiedAt: null,
        message: message || '',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };

      state.guardianRelationships.push(relationship);
      createAlertEvent({
        userId: guardianId,
        level: 'INFO',
        status: 'GUARDIAN_REQUEST_RECEIVED',
        source: 'USER',
        title: 'Loi moi guardian',
        message: `${fullName(requester)} muon ket noi voi ban`,
        metadata: { relationshipId: relationship.id },
      });

      return {
        ...relationship,
        requester: sanitizeUser(requester),
        guardian: sanitizeUser(guardian),
      };
    });
  }

  async respondToRequest(relationshipId, guardianId, action) {
    return withState((state) => {
      const relationship = state.guardianRelationships.find((item) => item.id === relationshipId);
      ensure(relationship, 'Guardian request not found', 404);
      ensure(relationship.guardianId === guardianId, 'Unauthorized', 403);
      ensure(relationship.status === 'PENDING', 'Guardian request already handled', 409);

      relationship.status = action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
      relationship.guardianConfirmedAt = action === 'ACCEPT' ? nowIso() : null;
      relationship.updatedAt = nowIso();

      createAlertEvent({
        userId: relationship.requesterId,
        level: 'INFO',
        status: relationship.status === 'ACCEPTED' ? 'GUARDIAN_ACCEPTED' : 'GUARDIAN_REJECTED',
        source: 'USER',
        title: 'Cap nhat guardian',
        message: `Guardian request ${relationship.status.toLowerCase()}`,
        metadata: { relationshipId },
      });

      return relationship;
    });
  }

  async getUserGuardians(userId) {
    const state = readState();
    const accepted = state.guardianRelationships.filter(
      (item) =>
        item.status === 'ACCEPTED' &&
        (item.requesterId === userId || item.guardianId === userId),
    );

    const guardians = accepted
      .filter((item) => item.requesterId === userId)
      .map((item) => {
        const user = state.users.find((entry) => entry.id === item.guardianId);
        return {
          relationshipId: item.id,
          escalationLevel: item.escalationLevel,
          guardianConfirmedAt: item.guardianConfirmedAt,
          relationship: 'guardian',
          user: user ? sanitizeUser(user) : null,
        };
      })
      .filter((item) => item.user);

    const proteges = accepted
      .filter((item) => item.guardianId === userId)
      .map((item) => {
        const user = state.users.find((entry) => entry.id === item.requesterId);
        return {
          relationshipId: item.id,
          escalationLevel: item.escalationLevel,
          guardianConfirmedAt: item.guardianConfirmedAt,
          relationship: 'protege',
          user: user ? sanitizeUser(user) : null,
        };
      })
      .filter((item) => item.user);

    return { guardians, proteges };
  }

  async getPendingRequests(userId) {
    const state = readState();
    return {
      sent: state.guardianRelationships
        .filter((item) => item.requesterId === userId && item.status === 'PENDING')
        .map((item) => ({
          ...item,
          user: sanitizeUser(state.users.find((entry) => entry.id === item.guardianId)),
        })),
      received: state.guardianRelationships
        .filter((item) => item.guardianId === userId && item.status === 'PENDING')
        .map((item) => ({
          ...item,
          user: sanitizeUser(state.users.find((entry) => entry.id === item.requesterId)),
        })),
    };
  }

  async removeRelationship(relationshipId, userId) {
    return withState((state) => {
      const index = state.guardianRelationships.findIndex((item) => item.id === relationshipId);
      ensure(index >= 0, 'Relationship not found', 404);

      const relationship = state.guardianRelationships[index];
      ensure(
        relationship.requesterId === userId || relationship.guardianId === userId,
        'Unauthorized',
        403,
      );

      state.guardianRelationships.splice(index, 1);
      return { message: 'Relationship removed successfully' };
    });
  }

  async blockUser(relationshipId, userId) {
    return withState((state) => {
      const relationship = state.guardianRelationships.find((item) => item.id === relationshipId);
      ensure(relationship, 'Relationship not found', 404);
      ensure(
        relationship.requesterId === userId || relationship.guardianId === userId,
        'Unauthorized',
        403,
      );

      relationship.status = 'BLOCKED';
      relationship.updatedAt = nowIso();
      return { message: 'User blocked successfully' };
    });
  }

  async searchUsers(term, currentUserId, limit = 20) {
    const state = readState();
    const query = String(term || '').trim().toLowerCase();

    return state.users
      .filter((item) => item.id !== currentUserId && item.isActive)
      .filter((item) => {
        const haystack = [
          normalizeEmail(item.email),
          item.phone || '',
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
