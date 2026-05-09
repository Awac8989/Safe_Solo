const crypto = require('crypto');

const {
  nowIso,
  mapAlertPolicyRow,
  alertPolicyStatements,
} = require('../config/sqlite');

function ensureAlertPolicy(userId) {
  let row = alertPolicyStatements.getByUserId.get(userId);
  if (!row) {
    const now = nowIso();
    alertPolicyStatements.create.run({
      id: crypto.randomUUID(),
      user_id: userId,
      level1_minutes: 30,
      level2_minutes: 5,
      level3_minutes: 15,
      level4_enabled: 0,
      created_at: now,
      updated_at: now,
    });
    row = alertPolicyStatements.getByUserId.get(userId);
  }

  return mapAlertPolicyRow(row);
}

function updateAlertPolicy(userId, payload) {
  const current = ensureAlertPolicy(userId);
  const next = {
    user_id: userId,
    level1_minutes: Number(payload.level1Minutes ?? current.level1Minutes),
    level2_minutes: Number(payload.level2Minutes ?? current.level2Minutes),
    level3_minutes: Number(payload.level3Minutes ?? current.level3Minutes),
    level4_enabled: (payload.level4Enabled ?? current.level4Enabled) ? 1 : 0,
    updated_at: nowIso(),
  };

  alertPolicyStatements.updateByUserId.run(next);
  return ensureAlertPolicy(userId);
}

module.exports = {
  ensureAlertPolicy,
  updateAlertPolicy,
};
