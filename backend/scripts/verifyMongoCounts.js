const path = require('path');
const Database = require('better-sqlite3');

const db = require('../src/config/database');
const User = require('../src/models/User');
const CheckInHistory = require('../src/models/CheckInHistory');
const EmergencyLog = require('../src/models/EmergencyLog');
const AlertEvent = require('../src/models/AlertEvent');
const InteractionEvent = require('../src/models/InteractionEvent');
const AlertPolicy = require('../src/models/AlertPolicy');
const MedicalProfile = require('../src/models/MedicalProfile');
const AutomationSetting = require('../src/models/AutomationSetting');
const SecuritySetting = require('../src/models/SecuritySetting');
const DeviceSignal = require('../src/models/DeviceSignal');
const SmsDispatchLog = require('../src/models/SmsDispatchLog');

const sqlitePath = path.resolve(__dirname, '../data/safesolo.db');

async function run() {
  const sqlite = new Database(sqlitePath, { readonly: true });
  await db.$connect();

  const checks = [
    { name: 'users', sqliteTable: 'users', sqliteKey: 'id', mongoModel: User, mongoField: '_id' },
    { name: 'checkin_history', sqliteTable: 'checkin_history', sqliteKey: 'id', mongoModel: CheckInHistory, mongoField: '_id' },
    { name: 'emergency_logs', sqliteTable: 'emergency_logs', sqliteKey: 'id', mongoModel: EmergencyLog, mongoField: '_id' },
    { name: 'alert_events', sqliteTable: 'alert_events', sqliteKey: 'id', mongoModel: AlertEvent, mongoField: '_id' },
    { name: 'interaction_events', sqliteTable: 'interaction_events', sqliteKey: 'id', mongoModel: InteractionEvent, mongoField: '_id' },
    { name: 'alert_policies', sqliteTable: 'alert_policies', sqliteKey: 'user_id', mongoModel: AlertPolicy, mongoField: 'userId' },
    { name: 'medical_profiles', sqliteTable: 'medical_profiles', sqliteKey: 'user_id', mongoModel: MedicalProfile, mongoField: 'userId' },
    { name: 'automation_settings', sqliteTable: 'automation_settings', sqliteKey: 'user_id', mongoModel: AutomationSetting, mongoField: 'userId' },
    { name: 'security_settings', sqliteTable: 'security_settings', sqliteKey: 'user_id', mongoModel: SecuritySetting, mongoField: 'userId' },
    { name: 'device_signals', sqliteTable: 'device_signals', sqliteKey: 'id', mongoModel: DeviceSignal, mongoField: '_id' },
    { name: 'sms_dispatch_logs', sqliteTable: 'sms_dispatch_logs', sqliteKey: 'id', mongoModel: SmsDispatchLog, mongoField: '_id' },
  ];

  const summary = [];
  let hasMismatch = false;

  for (const check of checks) {
    const rows = sqlite.prepare(`SELECT ${check.sqliteKey} AS keyValue FROM ${check.sqliteTable}`).all();
    const ids = rows.map((row) => row.keyValue).filter(Boolean);
    const sqliteCount = ids.length;
    // eslint-disable-next-line no-await-in-loop
    const mongoMatched = ids.length
      ? await check.mongoModel.countDocuments({ [check.mongoField]: { $in: ids } })
      : 0;
    // eslint-disable-next-line no-await-in-loop
    const mongoTotal = await check.mongoModel.countDocuments();
    const matches = sqliteCount === mongoMatched;
    if (!matches) {
      hasMismatch = true;
    }

    summary.push({
      table: check.name,
      sqliteCount,
      mongoMatched,
      mongoTotal,
      coverageOk: matches,
    });
  }

  console.table(summary);
  sqlite.close();
  await db.$disconnect();

  if (hasMismatch) {
    process.exit(1);
  }
}

run().catch(async (error) => {
  console.error('Verify SQLite/Mongo coverage failed:', error);
  try {
    await db.$disconnect();
  } catch (_) {
    // ignore
  }
  process.exit(1);
});
