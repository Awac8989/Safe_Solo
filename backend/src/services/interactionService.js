const InteractionEvent = require('../models/InteractionEvent');
const { toIso } = require('../lib/mongoCore');

function mapInteractionEventDoc(doc) {
  if (!doc) {
    return null;
  }

  const row = doc.toObject ? doc.toObject() : doc;
  return {
    _id: row._id,
    userId: row.userId,
    type: row.type,
    source: row.source,
    metadata: row.metadata || {},
    createdAt: toIso(row.createdAt),
  };
}

async function createInteractionEvent({
  userId,
  type,
  source,
  metadata = {},
}) {
  const event = await InteractionEvent.create({
    userId,
    type,
    source,
    metadata,
  });

  return mapInteractionEventDoc(event);
}

async function listInteractionEvents(userId, limit = 20) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const docs = await InteractionEvent.find({ userId })
    .sort({ createdAt: -1 })
    .limit(safeLimit);

  return docs.map(mapInteractionEventDoc);
}

module.exports = {
  createInteractionEvent,
  listInteractionEvents,
};
