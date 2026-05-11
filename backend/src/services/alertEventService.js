const AlertEvent = require('../models/AlertEvent');
const User = require('../models/User');
const { toIso } = require('../lib/mongoCore');

function mapAlertEventDoc(doc, user = null) {
  if (!doc) {
    return null;
  }

  const row = doc.toObject ? doc.toObject() : doc;
  return {
    id: row._id,
    _id: row._id,
    userId: row.userId,
    level: row.level,
    status: row.status,
    source: row.source,
    title: row.title,
    message: row.message,
    metadata: row.metadata || {},
    createdAt: toIso(row.createdAt),
    user,
  };
}

function mapUserSummary(user) {
  if (!user) {
    return null;
  }

  const row = user.toObject ? user.toObject() : user;
  return {
    id: row._id,
    fullName: row.fullName,
    phoneNumber: row.phoneNumber,
    role: row.role,
    currentStatus: row.currentStatus,
  };
}

async function createAlertEvent({ userId, level, status, source, title, message, metadata = {} }) {
  const event = await AlertEvent.create({
    userId,
    level,
    status,
    source,
    title,
    message,
    metadata,
  });

  return mapAlertEventDoc(event);
}

async function listAlertEvents({ userId, page = 1, limit = 50 }) {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const query = userId ? { userId } : {};

  const [events, total] = await Promise.all([
    AlertEvent.find(query)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit),
    AlertEvent.countDocuments(query),
  ]);

  const userIds = [...new Set(events.map((event) => event.userId).filter(Boolean))];
  const users = await User.find({ _id: { $in: userIds } });
  const userMap = new Map(users.map((user) => [user._id, mapUserSummary(user)]));
  const mapped = events.map((event) => mapAlertEventDoc(event, userMap.get(event.userId) || null));

  return {
    items: mapped,
    page: safePage,
    limit: safeLimit,
    total,
  };
}

module.exports = {
  createAlertEvent,
  listAlertEvents,
};
