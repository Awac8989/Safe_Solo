const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbDir = path.resolve(__dirname, '../../data');
const dbPath = path.join(dbDir, 'safesolo.db');

fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);
let prepared = false;

function ensureColumn(tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const existed = columns.some((column) => column.name === columnName);
  if (!existed) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function nowIso() {
  return new Date().toISOString();
}

function safeParse(value, fallback) {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapUserRow(row) {
  if (!row) {
    return null;
  }

  return {
    _id: row.id,
    fullName: row.full_name,
    phoneNumber: row.phone_number,
    role: row.role,
    medicalNotes: row.medical_notes,
    emergencyContacts: safeParse(row.emergency_contacts, []),
    timerIntervalMinutes: row.timer_interval_minutes,
    lastCheckinTime: row.last_checkin_time,
    nextDeadline: row.next_deadline,
    currentStatus: row.current_status,
    lastKnownLocation: safeParse(row.last_known_location, null),
    lastReminderAt: row.last_reminder_at,
    lastWarningAt: row.last_warning_at,
    lastSosAt: row.last_sos_at,
    quietHoursStart: row.quiet_hours_start,
    quietHoursEnd: row.quiet_hours_end,
    sleepModeUntil: row.sleep_mode_until,
    falseAlertGraceMinutes: row.false_alert_grace_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEmergencyRow(row) {
  if (!row) {
    return null;
  }

  return {
    _id: row.id,
    userId: row.user_id,
    triggeredAt: row.triggered_at,
    resolvedAt: row.resolved_at,
    isResolved: Boolean(row.is_resolved),
    smsSentStatus: Boolean(row.sms_sent_status),
    locationSnapshot: safeParse(row.location_snapshot, null),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSmsDispatchRow(row) {
  if (!row) {
    return null;
  }

  return {
    _id: row.id,
    emergencyLogId: row.emergency_log_id,
    userId: row.user_id,
    toPhone: row.to_phone,
    provider: row.provider,
    attempt: row.attempt,
    success: Boolean(row.success),
    providerMessageId: row.provider_message_id,
    errorMessage: row.error_message,
    responseBody: safeParse(row.response_body, null),
    createdAt: row.created_at,
  };
}

function mapAlertEventRow(row) {
  if (!row) {
    return null;
  }

  return {
    _id: row.id,
    userId: row.user_id,
    level: row.level,
    status: row.status,
    source: row.source,
    title: row.title,
    message: row.message,
    metadata: safeParse(row.metadata_json, {}),
    createdAt: row.created_at,
  };
}

function mapInteractionEventRow(row) {
  if (!row) {
    return null;
  }

  return {
    _id: row.id,
    userId: row.user_id,
    type: row.type,
    source: row.source,
    metadata: safeParse(row.meta_json, {}),
    createdAt: row.created_at,
  };
}

function mapAlertPolicyRow(row) {
  if (!row) {
    return null;
  }

  return {
    _id: row.id,
    userId: row.user_id,
    level1Minutes: row.level1_minutes,
    level2Minutes: row.level2_minutes,
    level3Minutes: row.level3_minutes,
    level4Enabled: Boolean(row.level4_enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMedicalProfileRow(row) {
  if (!row) {
    return null;
  }

  return {
    userId: row.user_id,
    fullName: row.full_name,
    birthYear: row.birth_year,
    bloodType: row.blood_type,
    allergies: row.allergies,
    conditions: row.conditions,
    medications: row.medications,
    emergencyPhone: row.emergency_phone,
    insuranceProvider: row.insurance_provider,
    insuranceNumber: row.insurance_number,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAutomationSettingsRow(row) {
  if (!row) {
    return null;
  }

  return {
    userId: row.user_id,
    dailyReminderTime: row.daily_reminder_time,
    shakeSos: Boolean(row.shake_sos),
    shakeSensitivity: row.shake_sensitivity,
    fallDetection: Boolean(row.fall_detection),
    geofenceAutoCheckin: Boolean(row.geofence_auto_checkin),
    pillReminder: Boolean(row.pill_reminder),
    pillTime: row.pill_time,
    homeLocation: safeParse(row.home_location, null),
    lastGeofenceEventAt: row.last_geofence_event_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSecuritySettingsRow(row) {
  if (!row) {
    return null;
  }

  return {
    userId: row.user_id,
    stealthMode: Boolean(row.stealth_mode),
    autoWipeDays: row.auto_wipe_days,
    encryptionEnabled: Boolean(row.encryption_enabled),
    lastAutoWipeDueAt: row.last_auto_wipe_due_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDeviceSignalRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    signalType: row.signal_type,
    payload: safeParse(row.payload_json, {}),
    createdAt: row.created_at,
  };
}

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      phone_number TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'user',
      medical_notes TEXT NOT NULL DEFAULT '',
      emergency_contacts TEXT NOT NULL DEFAULT '[]',
      timer_interval_minutes INTEGER NOT NULL DEFAULT 720,
      last_checkin_time TEXT NOT NULL,
      next_deadline TEXT NOT NULL,
      current_status TEXT NOT NULL DEFAULT 'SAFE',
      last_known_location TEXT,
      last_reminder_at TEXT,
      last_warning_at TEXT,
      last_sos_at TEXT,
      quiet_hours_start TEXT NOT NULL DEFAULT '23:00',
      quiet_hours_end TEXT NOT NULL DEFAULT '06:00',
      sleep_mode_until TEXT,
      false_alert_grace_minutes INTEGER NOT NULL DEFAULT 3,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS checkin_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      checkin_time TEXT NOT NULL,
      location_at_checkin TEXT NOT NULL,
      is_system_auto_triggered INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS emergency_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      triggered_at TEXT NOT NULL,
      resolved_at TEXT,
      is_resolved INTEGER NOT NULL DEFAULT 0,
      sms_sent_status INTEGER NOT NULL DEFAULT 0,
      location_snapshot TEXT,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS alert_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      level TEXT NOT NULL,
      status TEXT NOT NULL,
      source TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS interaction_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      source TEXT NOT NULL,
      meta_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS alert_policies (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      level1_minutes INTEGER NOT NULL DEFAULT 30,
      level2_minutes INTEGER NOT NULL DEFAULT 5,
      level3_minutes INTEGER NOT NULL DEFAULT 15,
      level4_enabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS medical_profiles (
      user_id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL DEFAULT '',
      birth_year TEXT NOT NULL DEFAULT '',
      blood_type TEXT NOT NULL DEFAULT 'O+',
      allergies TEXT NOT NULL DEFAULT '',
      conditions TEXT NOT NULL DEFAULT '',
      medications TEXT NOT NULL DEFAULT '',
      emergency_phone TEXT NOT NULL DEFAULT '',
      insurance_provider TEXT NOT NULL DEFAULT '',
      insurance_number TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS automation_settings (
      user_id TEXT PRIMARY KEY,
      daily_reminder_time TEXT NOT NULL DEFAULT '08:00',
      shake_sos INTEGER NOT NULL DEFAULT 1,
      shake_sensitivity INTEGER NOT NULL DEFAULT 3,
      fall_detection INTEGER NOT NULL DEFAULT 0,
      geofence_auto_checkin INTEGER NOT NULL DEFAULT 1,
      pill_reminder INTEGER NOT NULL DEFAULT 0,
      pill_time TEXT NOT NULL DEFAULT '08:00',
      home_location TEXT,
      last_geofence_event_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS security_settings (
      user_id TEXT PRIMARY KEY,
      stealth_mode INTEGER NOT NULL DEFAULT 0,
      auto_wipe_days INTEGER NOT NULL DEFAULT 0,
      encryption_enabled INTEGER NOT NULL DEFAULT 1,
      last_auto_wipe_due_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS device_signals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      signal_type TEXT NOT NULL,
      payload_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sms_dispatch_logs (
      id TEXT PRIMARY KEY,
      emergency_log_id TEXT,
      user_id TEXT NOT NULL,
      to_phone TEXT NOT NULL,
      provider TEXT NOT NULL,
      attempt INTEGER NOT NULL,
      success INTEGER NOT NULL DEFAULT 0,
      provider_message_id TEXT,
      error_message TEXT,
      response_body TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (emergency_log_id) REFERENCES emergency_logs(id)
    );

    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_next_deadline ON users(next_deadline);
    CREATE INDEX IF NOT EXISTS idx_checkin_user_id ON checkin_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_emergency_user_id ON emergency_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_emergency_resolved ON emergency_logs(is_resolved);
    CREATE INDEX IF NOT EXISTS idx_alert_user_id ON alert_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_alert_created_at ON alert_events(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_interaction_user_id ON interaction_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_interaction_created_at ON interaction_events(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_policy_user_id ON alert_policies(user_id);
    CREATE INDEX IF NOT EXISTS idx_medical_user_id ON medical_profiles(user_id);
    CREATE INDEX IF NOT EXISTS idx_automation_user_id ON automation_settings(user_id);
    CREATE INDEX IF NOT EXISTS idx_security_user_id ON security_settings(user_id);
    CREATE INDEX IF NOT EXISTS idx_signal_user_id ON device_signals(user_id);
    CREATE INDEX IF NOT EXISTS idx_signal_type ON device_signals(signal_type);
    CREATE INDEX IF NOT EXISTS idx_signal_created_at ON device_signals(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sms_emergency ON sms_dispatch_logs(emergency_log_id);
    CREATE INDEX IF NOT EXISTS idx_sms_user ON sms_dispatch_logs(user_id);
  `);

  ensureColumn('users', 'quiet_hours_start', "TEXT NOT NULL DEFAULT '23:00'");
  ensureColumn('users', 'quiet_hours_end', "TEXT NOT NULL DEFAULT '06:00'");
  ensureColumn('users', 'sleep_mode_until', 'TEXT');
  ensureColumn('users', 'false_alert_grace_minutes', 'INTEGER NOT NULL DEFAULT 3');

  // eslint-disable-next-line no-console
  console.log(`Connected to SQLite at ${dbPath}`);
  if (prepared) {
    return;
  }

  userStatements.create = db.prepare(`
    INSERT INTO users (
      id, full_name, phone_number, role, medical_notes, emergency_contacts,
      timer_interval_minutes, last_checkin_time, next_deadline, current_status,
      last_known_location, quiet_hours_start, quiet_hours_end, sleep_mode_until,
      false_alert_grace_minutes, created_at, updated_at
    ) VALUES (
      @id, @full_name, @phone_number, @role, @medical_notes, @emergency_contacts,
      @timer_interval_minutes, @last_checkin_time, @next_deadline, @current_status,
      @last_known_location, @quiet_hours_start, @quiet_hours_end, @sleep_mode_until,
      @false_alert_grace_minutes, @created_at, @updated_at
    )
  `);
  userStatements.getById = db.prepare('SELECT * FROM users WHERE id = ?');
  userStatements.getByPhone = db.prepare('SELECT * FROM users WHERE phone_number = ?');
  userStatements.list = db.prepare('SELECT * FROM users ORDER BY created_at DESC');
  userStatements.listByRole = db.prepare('SELECT * FROM users WHERE role = ?');
  userStatements.updateCheckin = db.prepare(`
    UPDATE users
    SET last_checkin_time = @last_checkin_time,
        next_deadline = @next_deadline,
        current_status = 'SAFE',
        last_known_location = @last_known_location,
        updated_at = @updated_at
    WHERE id = @id
  `);
  userStatements.updateTimer = db.prepare(`
    UPDATE users
    SET timer_interval_minutes = @timer_interval_minutes,
        next_deadline = @next_deadline,
        current_status = 'SAFE',
        updated_at = @updated_at
    WHERE id = @id
  `);
  userStatements.updateLocation = db.prepare(`
    UPDATE users
    SET last_known_location = @last_known_location,
        updated_at = @updated_at
    WHERE id = @id
  `);
  userStatements.updateContacts = db.prepare(`
    UPDATE users
    SET emergency_contacts = @emergency_contacts,
        updated_at = @updated_at
    WHERE id = @id
  `);
  userStatements.updateStatusFields = db.prepare(`
    UPDATE users
    SET current_status = @current_status,
        last_reminder_at = @last_reminder_at,
        last_warning_at = @last_warning_at,
        last_sos_at = @last_sos_at,
        updated_at = @updated_at
    WHERE id = @id
  `);
  userStatements.clearToSafe = db.prepare(`
    UPDATE users
    SET current_status = 'SAFE',
        updated_at = @updated_at
    WHERE id = @id
  `);
  userStatements.updatePreferences = db.prepare(`
    UPDATE users
    SET quiet_hours_start = @quiet_hours_start,
        quiet_hours_end = @quiet_hours_end,
        false_alert_grace_minutes = @false_alert_grace_minutes,
        updated_at = @updated_at
    WHERE id = @id
  `);
  userStatements.updateSleepMode = db.prepare(`
    UPDATE users
    SET sleep_mode_until = @sleep_mode_until,
        updated_at = @updated_at
    WHERE id = @id
  `);

  checkinStatements.create = db.prepare(`
    INSERT INTO checkin_history (
      id, user_id, checkin_time, location_at_checkin, is_system_auto_triggered, created_at
    ) VALUES (
      @id, @user_id, @checkin_time, @location_at_checkin, @is_system_auto_triggered, @created_at
    )
  `);

  emergencyStatements.create = db.prepare(`
    INSERT INTO emergency_logs (
      id, user_id, triggered_at, is_resolved, sms_sent_status, location_snapshot, notes, created_at, updated_at
    ) VALUES (
      @id, @user_id, @triggered_at, @is_resolved, @sms_sent_status, @location_snapshot, @notes, @created_at, @updated_at
    )
  `);
  emergencyStatements.getById = db.prepare('SELECT * FROM emergency_logs WHERE id = ?');
  emergencyStatements.listOpen = db.prepare('SELECT * FROM emergency_logs WHERE is_resolved = 0 ORDER BY created_at DESC');
  emergencyStatements.listResolved = db.prepare('SELECT * FROM emergency_logs WHERE is_resolved = 1 ORDER BY created_at DESC');
  emergencyStatements.listAll = db.prepare('SELECT * FROM emergency_logs ORDER BY created_at DESC');
  emergencyStatements.resolve = db.prepare(`
    UPDATE emergency_logs
    SET is_resolved = 1,
        resolved_at = @resolved_at,
        notes = @notes,
        updated_at = @updated_at
    WHERE id = @id
  `);
  emergencyStatements.updateSmsStatus = db.prepare(`
    UPDATE emergency_logs
    SET sms_sent_status = @sms_sent_status,
        updated_at = @updated_at
    WHERE id = @id
  `);

  alertEventStatements.create = db.prepare(`
    INSERT INTO alert_events (
      id, user_id, level, status, source, title, message, metadata_json, created_at
    ) VALUES (
      @id, @user_id, @level, @status, @source, @title, @message, @metadata_json, @created_at
    )
  `);
  alertEventStatements.listAll = db.prepare(`
    SELECT * FROM alert_events
    ORDER BY created_at DESC
    LIMIT @limit OFFSET @offset
  `);
  alertEventStatements.listByUser = db.prepare(`
    SELECT * FROM alert_events
    WHERE user_id = @user_id
    ORDER BY created_at DESC
    LIMIT @limit OFFSET @offset
  `);
  alertEventStatements.countAll = db.prepare('SELECT COUNT(*) AS total FROM alert_events');
  alertEventStatements.countByUser = db.prepare('SELECT COUNT(*) AS total FROM alert_events WHERE user_id = ?');

  interactionEventStatements.create = db.prepare(`
    INSERT INTO interaction_events (
      id, user_id, type, source, meta_json, created_at
    ) VALUES (
      @id, @user_id, @type, @source, @meta_json, @created_at
    )
  `);
  interactionEventStatements.listByUser = db.prepare(`
    SELECT * FROM interaction_events
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

  alertPolicyStatements.create = db.prepare(`
    INSERT INTO alert_policies (
      id, user_id, level1_minutes, level2_minutes, level3_minutes,
      level4_enabled, created_at, updated_at
    ) VALUES (
      @id, @user_id, @level1_minutes, @level2_minutes, @level3_minutes,
      @level4_enabled, @created_at, @updated_at
    )
  `);
  alertPolicyStatements.getByUserId = db.prepare(`
    SELECT * FROM alert_policies WHERE user_id = ?
  `);
  alertPolicyStatements.updateByUserId = db.prepare(`
    UPDATE alert_policies
    SET level1_minutes = @level1_minutes,
        level2_minutes = @level2_minutes,
        level3_minutes = @level3_minutes,
        level4_enabled = @level4_enabled,
        updated_at = @updated_at
    WHERE user_id = @user_id
  `);

  medicalProfileStatements.getByUserId = db.prepare(`
    SELECT * FROM medical_profiles WHERE user_id = ?
  `);
  medicalProfileStatements.upsert = db.prepare(`
    INSERT INTO medical_profiles (
      user_id, full_name, birth_year, blood_type, allergies, conditions,
      medications, emergency_phone, insurance_provider, insurance_number,
      created_at, updated_at
    ) VALUES (
      @user_id, @full_name, @birth_year, @blood_type, @allergies, @conditions,
      @medications, @emergency_phone, @insurance_provider, @insurance_number,
      @created_at, @updated_at
    )
    ON CONFLICT(user_id) DO UPDATE SET
      full_name = excluded.full_name,
      birth_year = excluded.birth_year,
      blood_type = excluded.blood_type,
      allergies = excluded.allergies,
      conditions = excluded.conditions,
      medications = excluded.medications,
      emergency_phone = excluded.emergency_phone,
      insurance_provider = excluded.insurance_provider,
      insurance_number = excluded.insurance_number,
      updated_at = excluded.updated_at
  `);

  automationSettingsStatements.getByUserId = db.prepare(`
    SELECT * FROM automation_settings WHERE user_id = ?
  `);
  automationSettingsStatements.upsert = db.prepare(`
    INSERT INTO automation_settings (
      user_id, daily_reminder_time, shake_sos, shake_sensitivity, fall_detection,
      geofence_auto_checkin, pill_reminder, pill_time, home_location,
      last_geofence_event_at, created_at, updated_at
    ) VALUES (
      @user_id, @daily_reminder_time, @shake_sos, @shake_sensitivity, @fall_detection,
      @geofence_auto_checkin, @pill_reminder, @pill_time, @home_location,
      @last_geofence_event_at, @created_at, @updated_at
    )
    ON CONFLICT(user_id) DO UPDATE SET
      daily_reminder_time = excluded.daily_reminder_time,
      shake_sos = excluded.shake_sos,
      shake_sensitivity = excluded.shake_sensitivity,
      fall_detection = excluded.fall_detection,
      geofence_auto_checkin = excluded.geofence_auto_checkin,
      pill_reminder = excluded.pill_reminder,
      pill_time = excluded.pill_time,
      home_location = excluded.home_location,
      last_geofence_event_at = excluded.last_geofence_event_at,
      updated_at = excluded.updated_at
  `);
  automationSettingsStatements.touchGeofenceEvent = db.prepare(`
    UPDATE automation_settings
    SET last_geofence_event_at = @last_geofence_event_at,
        updated_at = @updated_at
    WHERE user_id = @user_id
  `);

  securitySettingsStatements.getByUserId = db.prepare(`
    SELECT * FROM security_settings WHERE user_id = ?
  `);
  securitySettingsStatements.upsert = db.prepare(`
    INSERT INTO security_settings (
      user_id, stealth_mode, auto_wipe_days, encryption_enabled,
      last_auto_wipe_due_at, created_at, updated_at
    ) VALUES (
      @user_id, @stealth_mode, @auto_wipe_days, @encryption_enabled,
      @last_auto_wipe_due_at, @created_at, @updated_at
    )
    ON CONFLICT(user_id) DO UPDATE SET
      stealth_mode = excluded.stealth_mode,
      auto_wipe_days = excluded.auto_wipe_days,
      encryption_enabled = excluded.encryption_enabled,
      last_auto_wipe_due_at = excluded.last_auto_wipe_due_at,
      updated_at = excluded.updated_at
  `);
  securitySettingsStatements.markAutoWipeDue = db.prepare(`
    UPDATE security_settings
    SET last_auto_wipe_due_at = @last_auto_wipe_due_at,
        updated_at = @updated_at
    WHERE user_id = @user_id
  `);

  deviceSignalStatements.create = db.prepare(`
    INSERT INTO device_signals (
      id, user_id, signal_type, payload_json, created_at
    ) VALUES (
      @id, @user_id, @signal_type, @payload_json, @created_at
    )
  `);
  deviceSignalStatements.listByUser = db.prepare(`
    SELECT * FROM device_signals
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

  smsDispatchStatements.create = db.prepare(`
    INSERT INTO sms_dispatch_logs (
      id, emergency_log_id, user_id, to_phone, provider, attempt, success,
      provider_message_id, error_message, response_body, created_at
    ) VALUES (
      @id, @emergency_log_id, @user_id, @to_phone, @provider, @attempt, @success,
      @provider_message_id, @error_message, @response_body, @created_at
    )
  `);
  smsDispatchStatements.listByEmergency = db.prepare(`
    SELECT * FROM sms_dispatch_logs
    WHERE emergency_log_id = ?
    ORDER BY created_at DESC
  `);

  prepared = true;
}

const userStatements = {};
const checkinStatements = {};
const emergencyStatements = {};
const alertEventStatements = {};
const interactionEventStatements = {};
const alertPolicyStatements = {};
const medicalProfileStatements = {};
const automationSettingsStatements = {};
const securitySettingsStatements = {};
const deviceSignalStatements = {};
const smsDispatchStatements = {};

module.exports = {
  db,
  nowIso,
  initDatabase,
  mapUserRow,
  mapEmergencyRow,
  mapAlertEventRow,
  mapInteractionEventRow,
  mapAlertPolicyRow,
  mapMedicalProfileRow,
  mapAutomationSettingsRow,
  mapSecuritySettingsRow,
  mapDeviceSignalRow,
  mapSmsDispatchRow,
  userStatements,
  checkinStatements,
  emergencyStatements,
  alertEventStatements,
  interactionEventStatements,
  alertPolicyStatements,
  medicalProfileStatements,
  automationSettingsStatements,
  securitySettingsStatements,
  deviceSignalStatements,
  smsDispatchStatements,
};
