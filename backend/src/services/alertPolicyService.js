const AlertPolicy = require('../models/AlertPolicy');
const { mapAlertPolicyDoc } = require('../lib/mongoCore');

async function ensureAlertPolicy(userId) {
  let policy = await AlertPolicy.findOne({ userId });
  if (!policy) {
    policy = await AlertPolicy.create({ userId });
  }

  return mapAlertPolicyDoc(policy);
}

async function updateAlertPolicy(userId, payload) {
  const current = await ensureAlertPolicy(userId);
  const policy = await AlertPolicy.findOneAndUpdate(
    { userId },
    {
      userId,
      level1Minutes: Number(payload.level1Minutes ?? current.level1Minutes),
      level2Minutes: Number(payload.level2Minutes ?? current.level2Minutes),
      level3Minutes: Number(payload.level3Minutes ?? current.level3Minutes),
      level4Enabled: Boolean(payload.level4Enabled ?? current.level4Enabled),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return mapAlertPolicyDoc(policy);
}

module.exports = {
  ensureAlertPolicy,
  updateAlertPolicy,
};
