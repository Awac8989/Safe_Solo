const crypto = require('crypto');

const {
  nowIso,
  mapAlertEventRow,
  mapUserRow,
  alertEventStatements,
  userStatements,
} = require('../config/sqlite');

function createAlertEvent({
  userId,
  level,
  status,
  source,
  title,
  message,
  metadata,
}) {
  const createdAt = nowIso();
  const id = crypto.randomUUID();

  alertEventStatements.create.run({
    id,
    user_id: userId,
    level,
    status,
    source,
    title,
    message,
    metadata_json: metadata ? JSON.stringify(metadata) : null,
    created_at: createdAt,
  });

  return {
    _id: id,
    userId,
    level,
    status,
    source,
    title,
    message,
    metadata: metadata || {},
    createdAt,
  };
}

function listAlertEvents({ userId, page = 1, limit = 50 }) {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const offset = (safePage - 1) * safeLimit;

  const rows = userId
    ? alertEventStatements.listByUser.all({ user_id: userId, limit: safeLimit, offset })
    : alertEventStatements.listAll.all({ limit: safeLimit, offset });

  const total = userId
    ? alertEventStatements.countByUser.get(userId).total
    : alertEventStatements.countAll.get().total;

  const items = rows.map((row) => {
    const event = mapAlertEventRow(row);
    const user = userStatements.getById.get(event.userId);

    return {
      ...event,
      user: user
        ? {
            _id: user.id,
            fullName: mapUserRow(user).fullName,
            phoneNumber: mapUserRow(user).phoneNumber,
            currentStatus: mapUserRow(user).currentStatus,
          }
        : null,
    };
  });

  return {
    items,
    page: safePage,
    limit: safeLimit,
    total,
  };
}

module.exports = {
  createAlertEvent,
  listAlertEvents,
};