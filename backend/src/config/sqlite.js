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
const smsDispatchStatements = {};

module.exports = {
  db,
  nowIso,
  initDatabase,
  mapUserRow,
  mapEmergencyRow,
  mapAlertEventRow,
  mapSmsDispatchRow,
  userStatements,
  checkinStatements,
  emergencyStatements,
  alertEventStatements,
  smsDispatchStatements,
};