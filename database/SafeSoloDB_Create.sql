-- =============================================
-- SafeSolo Database Schema for Microsoft SQL Server
-- Server: MINHQUANDOAN\MSSQLSERVER112
-- Database: SafeSoloDB
-- =============================================

-- Tạo database (chạy lần đầu, nếu chưa có)
-- USE master;
-- GO
-- CREATE DATABASE SafeSoloDB;
-- GO

USE SafeSoloDB;
GO

-- =============================================
-- DROP TABLES (nếu muốn tạo lại từ đầu)
-- =============================================
IF OBJECT_ID('dbo.system_logs', 'U') IS NOT NULL DROP TABLE dbo.system_logs;
IF OBJECT_ID('dbo.kyc_documents', 'U') IS NOT NULL DROP TABLE dbo.kyc_documents;
IF OBJECT_ID('dbo.vaults', 'U') IS NOT NULL DROP TABLE dbo.vaults;
IF OBJECT_ID('dbo.thank_you_notes', 'U') IS NOT NULL DROP TABLE dbo.thank_you_notes;
IF OBJECT_ID('dbo.daily_statuses', 'U') IS NOT NULL DROP TABLE dbo.daily_statuses;
IF OBJECT_ID('dbo.messages', 'U') IS NOT NULL DROP TABLE dbo.messages;
IF OBJECT_ID('dbo.chat_rooms', 'U') IS NOT NULL DROP TABLE dbo.chat_rooms;
IF OBJECT_ID('dbo.volunteer_responses', 'U') IS NOT NULL DROP TABLE dbo.volunteer_responses;
IF OBJECT_ID('dbo.rescue_incidents', 'U') IS NOT NULL DROP TABLE dbo.rescue_incidents;
IF OBJECT_ID('dbo.guardian_relationships', 'U') IS NOT NULL DROP TABLE dbo.guardian_relationships;
IF OBJECT_ID('dbo.medical_profiles', 'U') IS NOT NULL DROP TABLE dbo.medical_profiles;
IF OBJECT_ID('dbo.checkin_history', 'U') IS NOT NULL DROP TABLE dbo.checkin_history;
IF OBJECT_ID('dbo.emergency_logs', 'U') IS NOT NULL DROP TABLE dbo.emergency_logs;
IF OBJECT_ID('dbo.users', 'U') IS NOT NULL DROP TABLE dbo.users;
GO

-- =============================================
-- TABLES
-- =============================================

-- 1. Users
CREATE TABLE dbo.users (
    id                  NVARCHAR(50)   NOT NULL PRIMARY KEY DEFAULT NEWID(),
    email               NVARCHAR(255)  NOT NULL UNIQUE,
    phone               NVARCHAR(20)   NULL UNIQUE,
    password_hash       NVARCHAR(255)  NULL,
    first_name          NVARCHAR(100)  NOT NULL,
    last_name           NVARCHAR(100)  NOT NULL,
    date_of_birth       DATE           NULL,
    gender              NVARCHAR(20)   NULL CHECK (gender IN ('MALE','FEMALE','OTHER','PREFER_NOT_TO_SAY')),
    avatar              NVARCHAR(500)  NULL,
    role                NVARCHAR(10)   NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
    is_active           BIT            NOT NULL DEFAULT 1,
    is_verified         BIT            NOT NULL DEFAULT 0,
    otp_code            NVARCHAR(10)   NULL,
    otp_expires_at      DATETIME2      NULL,
    last_login_at       DATETIME2      NULL,
    trust_score         FLOAT          NOT NULL DEFAULT 5.0,
    rescues_count       INT            NOT NULL DEFAULT 0,
    is_kyc_verified     BIT            NOT NULL DEFAULT 0,

    -- Check-in / Dead Man Switch
    timer_interval_minutes INT         NOT NULL DEFAULT 720,
    last_checkin_time   DATETIME2      NULL DEFAULT GETUTCDATE(),
    next_checkin_deadline DATETIME2    NULL,
    current_status      NVARCHAR(10)   NOT NULL DEFAULT 'SAFE' CHECK (current_status IN ('SAFE','REMINDER','WARNING','SOS')),
    deadman_stage       INT            NOT NULL DEFAULT 0,
    deadman_escalation_triggered_at DATETIME2 NULL,

    -- Auto-wipe
    is_auto_wipe_enabled BIT           NOT NULL DEFAULT 0,
    auto_wipe_days      INT            NULL,

    -- Location (Community Radar)
    last_lat            FLOAT          NULL,
    last_lng            FLOAT          NULL,
    last_location_time  DATETIME2      NULL,

    -- Timestamps
    created_at          DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    updated_at          DATETIME2      NOT NULL DEFAULT GETUTCDATE()
);
GO

-- 2. Medical Profiles
CREATE TABLE dbo.medical_profiles (
    id                  NVARCHAR(50)   NOT NULL PRIMARY KEY DEFAULT NEWID(),
    user_id             NVARCHAR(50)   NOT NULL UNIQUE,
    blood_type          NVARCHAR(20)   NULL CHECK (blood_type IN (
        'A_POSITIVE','A_NEGATIVE','B_POSITIVE','B_NEGATIVE',
        'AB_POSITIVE','AB_NEGATIVE','O_POSITIVE','O_NEGATIVE'
    )),
    allergies           NVARCHAR(MAX)  NULL,  -- JSON array: ["peanuts","penicillin"]
    medications         NVARCHAR(MAX)  NULL,  -- JSON array: ["aspirin","insulin"]
    medical_conditions  NVARCHAR(MAX)  NULL,  -- JSON array: ["diabetes","asthma"]
    emergency_contact   NVARCHAR(MAX)  NULL,  -- JSON: {name, phone, relationship}
    insurance_info      NVARCHAR(MAX)  NULL,  -- JSON: {provider, policyNumber, groupNumber}
    created_at          DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    updated_at          DATETIME2      NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_medical_user FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
);
GO

-- 3. Guardian Relationships
CREATE TABLE dbo.guardian_relationships (
    id                  NVARCHAR(50)   NOT NULL PRIMARY KEY DEFAULT NEWID(),
    requester_id        NVARCHAR(50)   NOT NULL,
    guardian_id         NVARCHAR(50)   NOT NULL,
    status              NVARCHAR(10)   NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACCEPTED','REJECTED','BLOCKED')),
    escalation_level    INT            NOT NULL DEFAULT 1,
    guardian_confirmed_at DATETIME2    NULL,
    last_notified_at    DATETIME2      NULL,
    message             NVARCHAR(500)  NULL,
    created_at          DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    updated_at          DATETIME2      NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_guardian_requester FOREIGN KEY (requester_id) REFERENCES dbo.users(id) ON DELETE NO ACTION,
    CONSTRAINT FK_guardian_guardian  FOREIGN KEY (guardian_id)  REFERENCES dbo.users(id) ON DELETE NO ACTION,
    CONSTRAINT UQ_guardian_pair UNIQUE (requester_id, guardian_id)
);
GO

-- 4. Rescue Incidents (Community Radar)
CREATE TABLE dbo.rescue_incidents (
    id                  NVARCHAR(50)   NOT NULL PRIMARY KEY DEFAULT NEWID(),
    victim_id           NVARCHAR(50)   NOT NULL,
    status              NVARCHAR(15)   NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','RESOLVED','CANCELLED')),
    incident_type       NVARCHAR(100)  NOT NULL,
    severity            INT            NOT NULL DEFAULT 1,
    exact_lat           FLOAT          NOT NULL,
    exact_lng           FLOAT          NOT NULL,
    fuzzed_lat          FLOAT          NOT NULL,
    fuzzed_lng          FLOAT          NOT NULL,
    created_at          DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    resolved_at         DATETIME2      NULL,

    CONSTRAINT FK_incident_victim FOREIGN KEY (victim_id) REFERENCES dbo.users(id) ON DELETE CASCADE
);
GO

-- 5. Volunteer Responses
CREATE TABLE dbo.volunteer_responses (
    id                  NVARCHAR(50)   NOT NULL PRIMARY KEY DEFAULT NEWID(),
    incident_id         NVARCHAR(50)   NOT NULL,
    volunteer_id        NVARCHAR(50)   NOT NULL,
    status              NVARCHAR(15)   NOT NULL DEFAULT 'EN_ROUTE' CHECK (status IN ('EN_ROUTE','ARRIVED','CANCELLED')),
    created_at          DATETIME2      NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_response_incident  FOREIGN KEY (incident_id)  REFERENCES dbo.rescue_incidents(id) ON DELETE CASCADE,
    CONSTRAINT FK_response_volunteer FOREIGN KEY (volunteer_id) REFERENCES dbo.users(id) ON DELETE NO ACTION,
    CONSTRAINT UQ_volunteer_incident UNIQUE (incident_id, volunteer_id)
);
GO

-- 6. Chat Rooms
CREATE TABLE dbo.chat_rooms (
    id                  NVARCHAR(50)   NOT NULL PRIMARY KEY DEFAULT NEWID(),
    incident_id         NVARCHAR(50)   NOT NULL UNIQUE,
    status              NVARCHAR(15)   NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','READ_ONLY')),
    created_at          DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    closed_at           DATETIME2      NULL,

    CONSTRAINT FK_chatroom_incident FOREIGN KEY (incident_id) REFERENCES dbo.rescue_incidents(id) ON DELETE CASCADE
);
GO

-- 7. Messages
CREATE TABLE dbo.messages (
    id                  NVARCHAR(50)   NOT NULL PRIMARY KEY DEFAULT NEWID(),
    room_id             NVARCHAR(50)   NOT NULL,
    sender_id           NVARCHAR(50)   NULL,
    message_type        NVARCHAR(15)   NOT NULL CHECK (message_type IN ('TEXT','AUDIO','SYSTEM','LOCATION')),
    content             NVARCHAR(MAX)  NOT NULL,
    created_at          DATETIME2      NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_message_room   FOREIGN KEY (room_id)   REFERENCES dbo.chat_rooms(id) ON DELETE CASCADE,
    CONSTRAINT FK_message_sender FOREIGN KEY (sender_id) REFERENCES dbo.users(id)      ON DELETE SET NULL
);
GO

-- 8. Daily Statuses (Alive Circle)
CREATE TABLE dbo.daily_statuses (
    id                  NVARCHAR(50)   NOT NULL PRIMARY KEY DEFAULT NEWID(),
    user_id             NVARCHAR(50)   NOT NULL,
    mood_emoji          NVARCHAR(10)   NOT NULL,
    audio_url           NVARCHAR(500)  NULL,
    created_at          DATETIME2      NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_dailystatus_user FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
);
GO

-- 9. Thank You Notes
CREATE TABLE dbo.thank_you_notes (
    id                  NVARCHAR(50)   NOT NULL PRIMARY KEY DEFAULT NEWID(),
    volunteer_id        NVARCHAR(50)   NOT NULL,
    author_id           NVARCHAR(50)   NOT NULL,
    content             NVARCHAR(MAX)  NOT NULL,
    created_at          DATETIME2      NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_thankyou_volunteer FOREIGN KEY (volunteer_id) REFERENCES dbo.users(id) ON DELETE NO ACTION,
    CONSTRAINT FK_thankyou_author    FOREIGN KEY (author_id)    REFERENCES dbo.users(id) ON DELETE NO ACTION
);
GO

-- 10. KYC Documents
CREATE TABLE dbo.kyc_documents (
    id                  NVARCHAR(50)   NOT NULL PRIMARY KEY DEFAULT NEWID(),
    user_id             NVARCHAR(50)   NOT NULL UNIQUE,
    front_image_url     NVARCHAR(500)  NOT NULL,
    back_image_url      NVARCHAR(500)  NOT NULL,
    status              NVARCHAR(10)   NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
    submitted_at        DATETIME2      NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_kyc_user FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
);
GO

-- 11. Vaults (Auto-wipe sensitive data)
CREATE TABLE dbo.vaults (
    id                  NVARCHAR(50)   NOT NULL PRIMARY KEY DEFAULT NEWID(),
    user_id             NVARCHAR(50)   NOT NULL UNIQUE,
    content             NVARCHAR(MAX)  NULL,  -- JSON encrypted content
    shredded_at         DATETIME2      NULL,
    created_at          DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    updated_at          DATETIME2      NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_vault_user FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
);
GO

-- 12. Check-in History
CREATE TABLE dbo.checkin_history (
    id                  NVARCHAR(50)   NOT NULL PRIMARY KEY DEFAULT NEWID(),
    user_id             NVARCHAR(50)   NOT NULL,
    checkin_time        DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    location_lat        FLOAT          NOT NULL,
    location_lng        FLOAT          NOT NULL,
    is_system_auto      BIT            NOT NULL DEFAULT 0,
    created_at          DATETIME2      NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_checkin_user FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
);
GO

-- 13. Emergency Logs
CREATE TABLE dbo.emergency_logs (
    id                  NVARCHAR(50)   NOT NULL PRIMARY KEY DEFAULT NEWID(),
    user_id             NVARCHAR(50)   NOT NULL,
    triggered_at        DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    resolved_at         DATETIME2      NULL,
    is_resolved         BIT            NOT NULL DEFAULT 0,
    sms_sent_status     BIT            NOT NULL DEFAULT 0,
    location_lat        FLOAT          NULL,
    location_lng        FLOAT          NULL,
    location_updated_at DATETIME2      NULL,
    notes               NVARCHAR(MAX)  NULL DEFAULT '',
    created_at          DATETIME2      NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_emergency_user FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
);
GO

-- 14. System Logs (Audit trail)
CREATE TABLE dbo.system_logs (
    id                  NVARCHAR(50)   NOT NULL PRIMARY KEY DEFAULT NEWID(),
    incident_id         NVARCHAR(50)   NULL,
    action_type         NVARCHAR(100)  NOT NULL,
    description         NVARCHAR(MAX)  NOT NULL,
    created_at          DATETIME2      NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_syslog_incident FOREIGN KEY (incident_id) REFERENCES dbo.rescue_incidents(id) ON DELETE SET NULL
);
GO

-- =============================================
-- INDEXES cho performance
-- =============================================
CREATE INDEX IX_users_email ON dbo.users(email);
CREATE INDEX IX_users_phone ON dbo.users(phone);
CREATE INDEX IX_users_status ON dbo.users(current_status);
CREATE INDEX IX_users_location ON dbo.users(last_lat, last_lng);

CREATE INDEX IX_medical_user ON dbo.medical_profiles(user_id);

CREATE INDEX IX_guardian_requester ON dbo.guardian_relationships(requester_id);
CREATE INDEX IX_guardian_guardian ON dbo.guardian_relationships(guardian_id);
CREATE INDEX IX_guardian_status ON dbo.guardian_relationships(status);

CREATE INDEX IX_incident_victim ON dbo.rescue_incidents(victim_id);
CREATE INDEX IX_incident_status ON dbo.rescue_incidents(status);
CREATE INDEX IX_incident_location ON dbo.rescue_incidents(exact_lat, exact_lng);

CREATE INDEX IX_response_incident ON dbo.volunteer_responses(incident_id);
CREATE INDEX IX_response_volunteer ON dbo.volunteer_responses(volunteer_id);

CREATE INDEX IX_message_room ON dbo.messages(room_id);
CREATE INDEX IX_message_sender ON dbo.messages(sender_id);

CREATE INDEX IX_dailystatus_user ON dbo.daily_statuses(user_id);
CREATE INDEX IX_dailystatus_date ON dbo.daily_statuses(created_at);

CREATE INDEX IX_checkin_user ON dbo.checkin_history(user_id);
CREATE INDEX IX_checkin_time ON dbo.checkin_history(checkin_time);

CREATE INDEX IX_emergency_user ON dbo.emergency_logs(user_id);

CREATE INDEX IX_syslog_incident ON dbo.system_logs(incident_id);
CREATE INDEX IX_syslog_action ON dbo.system_logs(action_type);
GO

-- =============================================
-- TRIGGER: Auto-update updated_at
-- =============================================
CREATE TRIGGER trg_users_updated_at ON dbo.users
AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.users SET updated_at = GETUTCDATE()
    FROM dbo.users u INNER JOIN inserted i ON u.id = i.id;
END;
GO

CREATE TRIGGER trg_medical_updated_at ON dbo.medical_profiles
AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.medical_profiles SET updated_at = GETUTCDATE()
    FROM dbo.medical_profiles m INNER JOIN inserted i ON m.id = i.id;
END;
GO

CREATE TRIGGER trg_guardian_updated_at ON dbo.guardian_relationships
AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.guardian_relationships SET updated_at = GETUTCDATE()
    FROM dbo.guardian_relationships g INNER JOIN inserted i ON g.id = i.id;
END;
GO

CREATE TRIGGER trg_vault_updated_at ON dbo.vaults
AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.vaults SET updated_at = GETUTCDATE()
    FROM dbo.vaults v INNER JOIN inserted i ON v.id = i.id;
END;
GO

PRINT '✅ SafeSoloDB schema created successfully!';
PRINT 'Tables: 14';
PRINT 'Indexes: 18';
PRINT 'Triggers: 4';
GO
