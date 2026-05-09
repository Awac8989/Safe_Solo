const { readState, withState, createId, nowIso } = require('../data/store');
const { paginate, sanitizeUser } = require('../lib/utils');

function createAlertEvent({ userId, level, status, source, title, message, metadata = {} }) {
  return withState((state) => {
    const event = {
      id: createId('alert'),
      userId,
      level,
      status,
      source,
      title,
      message,
      metadata,
      createdAt: nowIso(),
    };
    state.alertEvents.push(event);
    return event;
  });
}

function listAlertEvents({ userId, page = 1, limit = 50 }) {
  const state = readState();
  const items = state.alertEvents
    .filter((item) => (userId ? item.userId === userId : true))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((event) => {
      const user = state.users.find((item) => item.id === event.userId);
      return {
        ...event,
        user: user ? sanitizeUser(user) : null,
      };
    });

  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const offset = (safePage - 1) * safeLimit;
  const paged = paginate(items, safeLimit, offset);

  return {
    items: paged.items,
    page: safePage,
    limit: safeLimit,
    total: items.length,
  };
}

module.exports = {
  createAlertEvent,
  listAlertEvents,
};
