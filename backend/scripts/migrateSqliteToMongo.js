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

function safeJson(value, fallback = null) {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toDate(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function bulkReplace(model, operations) {
  if (!operations.length) {
    return { upserted: 0 };
  }
  const result = await model.bulkWrite(operations, { ordered: false });
  return {
    upserted: result.upsertedCount || 0,
    modified: result.modifiedCount || 0,
    matched: result.matchedCount || 0,
  };
}

async function run() {
  const sqlite = new Database(sqlitePath, { readonly: true });
  await db.$connect();

  const users = sqlite.prepare('SELECT * FROM users').all();
  const checkins = sqlite.prepare('SELECT * FROM checkin_history').all();
  const emergencies = sqlite.prepare('SELECT * FROM emergency_logs').all();
  const alerts = sqlite.prepare('SELECT * FROM alert_events').all();
  const interactions = sqlite.prepare('SELECT * FROM interaction_events').all();
  const policies = sqlite.prepare('SELECT * FROM alert_policies').all();
  const medicalProfiles = sqlite.prepare('SELECT * FROM medical_profiles').all();
  const automationSettings = sqlite.prepare('SELECT * FROM automation_settings').all();
  const securitySettings = sqlite.prepare('SELECT * FROM security_settings').all();
  const deviceSignals = sqlite.prepare('SELECT * FROM device_signals').all();
  const smsLogs = sqlite.prepare('SELECT * FROM sms_dispatch_logs').all();

  const summary = {};

  summary.users = await bulkReplace(
    User,
    users.map((row) => ({
      replaceOne: {
        filter: { _id: row.id },
        replacement: {
          _id: row.id,
          fullName: row.full_name,
          phoneNumber: row.phone_number,
          role: row.role || 'user',
          medicalNotes: row.medical_notes || '',
          emergencyContacts: safeJson(row.emergency_contacts, []),
          timerIntervalMinutes: row.timer_interval_minutes || 720,
          lastCheckinTime: toDate(row.last_checkin_time) || new Date(),
          nextDeadline: toDate(row.next_deadline) || new Date(),
          currentStatus: row.current_status || 'SAFE',
          lastKnownLocation: safeJson(row.last_known_location, null),
          lastReminderAt: toDate(row.last_reminder_at),
          lastWarningAt: toDate(row.last_warning_at),
          lastSosAt: toDate(row.last_sos_at),
          quietHoursStart: row.quiet_hours_start || '23:00',
          quietHoursEnd: row.quiet_hours_end || '06:00',
          sleepModeUntil: toDate(row.sleep_mode_until),
          falseAlertGraceMinutes: row.false_alert_grace_minutes ?? 3,
          createdAt: toDate(row.created_at) || new Date(),
          updatedAt: toDate(row.updated_at) || new Date(),
        },
        upsert: true,
      },
    })),
  );

  summary.checkins = await bulkReplace(
    CheckInHistory,
    checkins.map((row) => ({
      replaceOne: {
        filter: { _id: row.id },
        replacement: {
          _id: row.id,
          userId: row.user_id,
          checkinTime: toDate(row.checkin_time) || new Date(),
          locationAtCheckin: safeJson(row.location_at_checkin, null),
          isSystemAutoTriggered: Boolean(row.is_system_auto_triggered),
          createdAt: toDate(row.created_at) || new Date(),
        },
        upsert: true,
      },
    })),
  );

  summary.emergencies = await bulkReplace(
    EmergencyLog,
    emergencies.map((row) => ({
      replaceOne: {
        filter: { _id: row.id },
        replacement: {
          _id: row.id,
          userId: row.user_id,
          triggeredAt: toDate(row.triggered_at) || new Date(),
          resolvedAt: toDate(row.resolved_at),
          isResolved: Boolean(row.is_resolved),
          smsSentStatus: Boolean(row.sms_sent_status),
          locationSnapshot: safeJson(row.location_snapshot, null),
          notes: row.notes || '',
          createdAt: toDate(row.created_at) || new Date(),
          updatedAt: toDate(row.updated_at) || new Date(),
        },
        upsert: true,
      },
    })),
  );

  summary.alerts = await bulkReplace(
    AlertEvent,
    alerts.map((row) => ({
      replaceOne: {
        filter: { _id: row.id },
        replacement: {
          _id: row.id,
          userId: row.user_id,
          level: row.level,
          status: row.status,
          source: row.source,
          title: row.title,
          message: row.message,
          metadata: safeJson(row.metadata_json, {}),
          createdAt: toDate(row.created_at) || new Date(),
        },
        upsert: true,
      },
    })),
  );

  summary.interactions = await bulkReplace(
    InteractionEvent,
    interactions.map((row) => ({
      replaceOne: {
        filter: { _id: row.id },
        replacement: {
          _id: row.id,
          userId: row.user_id,
          type: row.type,
          source: row.source,
          metadata: safeJson(row.meta_json, {}),
          createdAt: toDate(row.created_at) || new Date(),
        },
        upsert: true,
      },
    })),
  );

  summary.policies = await bulkReplace(
    AlertPolicy,
    policies.map((row) => ({
      replaceOne: {
        filter: { userId: row.user_id },
        replacement: {
          _id: row.id,
          userId: row.user_id,
          level1Minutes: row.level1_minutes,
          level2Minutes: row.level2_minutes,
          level3Minutes: row.level3_minutes,
          level4Enabled: Boolean(row.level4_enabled),
          createdAt: toDate(row.created_at) || new Date(),
          updatedAt: toDate(row.updated_at) || new Date(),
        },
        upsert: true,
      },
    })),
  );

  summary.medicalProfiles = await bulkReplace(
    MedicalProfile,
    medicalProfiles.map((row) => ({
      replaceOne: {
        filter: { userId: row.user_id },
        replacement: {
          userId: row.user_id,
          fullName: row.full_name || '',
          birthYear: row.birth_year || '',
          bloodType: row.blood_type || 'O+',
          allergies: row.allergies || '',
          conditions: row.conditions || '',
          medications: row.medications || '',
          emergencyPhone: row.emergency_phone || '',
          insuranceProvider: row.insurance_provider || '',
          insuranceNumber: row.insurance_number || '',
          createdAt: toDate(row.created_at) || new Date(),
          updatedAt: toDate(row.updated_at) || new Date(),
        },
        upsert: true,
      },
    })),
  );

  summary.automationSettings = await bulkReplace(
    AutomationSetting,
    automationSettings.map((row) => ({
      replaceOne: {
        filter: { userId: row.user_id },
        replacement: {
          userId: row.user_id,
          dailyReminderTime: row.daily_reminder_time || '08:00',
          shakeSos: Boolean(row.shake_sos),
          shakeSensitivity: row.shake_sensitivity ?? 3,
          fallDetection: Boolean(row.fall_detection),
          geofenceAutoCheckin: Boolean(row.geofence_auto_checkin),
          pillReminder: Boolean(row.pill_reminder),
          pillTime: row.pill_time || '08:00',
          homeLocation: safeJson(row.home_location, null),
          lastGeofenceEventAt: toDate(row.last_geofence_event_at),
          createdAt: toDate(row.created_at) || new Date(),
          updatedAt: toDate(row.updated_at) || new Date(),
        },
        upsert: true,
      },
    })),
  );

  summary.securitySettings = await bulkReplace(
    SecuritySetting,
    securitySettings.map((row) => ({
      replaceOne: {
        filter: { userId: row.user_id },
        replacement: {
          userId: row.user_id,
          stealthMode: Boolean(row.stealth_mode),
          autoWipeDays: row.auto_wipe_days ?? 0,
          encryptionEnabled: Boolean(row.encryption_enabled),
          lastAutoWipeDueAt: toDate(row.last_auto_wipe_due_at),
          createdAt: toDate(row.created_at) || new Date(),
          updatedAt: toDate(row.updated_at) || new Date(),
        },
        upsert: true,
      },
    })),
  );

  summary.deviceSignals = await bulkReplace(
    DeviceSignal,
    deviceSignals.map((row) => ({
      replaceOne: {
        filter: { _id: row.id },
        replacement: {
          _id: row.id,
          userId: row.user_id,
          signalType: row.signal_type,
          payload: safeJson(row.payload_json, {}),
          createdAt: toDate(row.created_at) || new Date(),
        },
        upsert: true,
      },
    })),
  );

  summary.smsDispatchLogs = await bulkReplace(
    SmsDispatchLog,
    smsLogs.map((row) => ({
      replaceOne: {
        filter: { _id: row.id },
        replacement: {
          _id: row.id,
          emergencyLogId: row.emergency_log_id || null,
          userId: row.user_id,
          toPhone: row.to_phone,
          provider: row.provider,
          attempt: row.attempt,
          success: Boolean(row.success),
          providerMessageId: row.provider_message_id || null,
          errorMessage: row.error_message || null,
          responseBody: safeJson(row.response_body, null),
          createdAt: toDate(row.created_at) || new Date(),
        },
        upsert: true,
      },
    })),
  );

  console.log(JSON.stringify(summary, null, 2));

  sqlite.close();
  await db.$disconnect();
}

run().catch(async (error) => {
  console.error('SQLite -> Mongo migration failed:', error);
  try {
    await db.$disconnect();
  } catch (_) {
    // ignore
  }
  process.exit(1);
});
