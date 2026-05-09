const crypto = require('crypto');

const {
  nowIso,
  mapInteractionEventRow,
  interactionEventStatements,
} = require('../config/sqlite');

function createInteractionEvent({
  userId,
  type,
  source,
  metadata = {},
}) {
  interactionEventStatements.create.run({
    id: crypto.randomUUID(),
    user_id: userId,
    type,
    source,
    meta_json: JSON.stringify(metadata),
    created_at: nowIso(),
  });
}

function listInteractionEvents(userId, limit = 20) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  return interactionEventStatements.listByUser
    .all(userId, safeLimit)
    .map(mapInteractionEventRow);
}

module.exports = {
  createInteractionEvent,
  listInteractionEvents,
};
