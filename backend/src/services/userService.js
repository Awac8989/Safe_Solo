const { readState, withState, createId, nowIso } = require('../data/store');
const { AppError } = require('../lib/errors');
const { sanitizeUser, paginate } = require('../lib/utils');
const { createAlertEvent } = require('./alertEventService');

class UserService {
  async registerLegacy(payload) {
    return withState((state) => {
      const exists = state.users.find((item) => item.phone === payload.phoneNumber);
      if (exists) {
        throw new AppError('phoneNumber already exists', 409);
      }

      const names = String(payload.fullName || '').trim().split(' ');
      const firstName = names.shift() || 'Safe';
      const lastName = names.join(' ') || 'Solo';
      const now = nowIso();
      const user = {
        id: createId('user'),
        email: payload.email || `${payload.phoneNumber.replace(/\D/g, '')}@legacy.local`,
        phone: payload.phoneNumber,
        firstName,
        lastName,
        dateOfBirth: null,
        gender: 'PREFER_NOT_TO_SAY',
        avatar: null,
        isActive: true,
        isVerified: true,
        otpCode: null,
        otpExpiresAt: null,
        lastLoginAt: now,
        createdAt: now,
        updatedAt: now,
        trustScore: 5,
        rescuesCount: 0,
        isKycVerified: false,
        nextCheckinDeadline: new Date(
          Date.now() + Number(payload.timerIntervalMinutes || 720) * 60 * 1000,
        ).toISOString(),
        lastCheckInAt: now,
        graceHours: Math.max(1, Math.round(Number(payload.timerIntervalMinutes || 720) / 60)),
        deadmanStage: 0,
        deadmanEscalationTriggeredAt: null,
        lastLat: payload.location?.lat ?? null,
        lastLng: payload.location?.lng ?? null,
        lastLocationTime: payload.location ? now : null,
        batteryLevel: null,
        approxAddress: payload.location?.approxAddress || null,
        role: payload.role || 'USER',
        security: {
          stealthMode: false,
          highContrast: false,
          realPin: '',
          duressPin: '',
          autoWipeEnabled: false,
          autoWipeDays: 30,
          quietHoursStart: '23:00',
          quietHoursEnd: '06:00',
          falseAlertGraceMinutes: 3,
          pillReminder: false,
          pillTime: '08:00',
        },
      };

      state.users.push(user);
      state.medicalProfiles.push({
        id: createId('med'),
        userId: user.id,
        bloodType: null,
        allergies: [],
        medications: [],
        medicalConditions: [],
        emergencyContact: Array.isArray(payload.emergencyContacts) ? payload.emergencyContacts[0] || null : null,
        insuranceInfo: null,
        doctor: null,
        qrCodeValue: `SAFE-MED-${user.id}`,
        createdAt: now,
        updatedAt: now,
      });

      createAlertEvent({
        userId: user.id,
        level: 'INFO',
        status: 'REGISTERED',
        source: 'USER',
        title: 'Dang ky SafeSolo',
        message: 'Tai khoan moi da duoc tao',
        metadata: {},
      });

      return sanitizeUser(user);
    });
  }

  async listUsers({ page = 1, limit = 100 } = {}) {
    const state = readState();
    const sorted = [...state.users].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const pageData = paginate(sorted, limit, (Math.max(Number(page) || 1, 1) - 1) * (Number(limit) || 100));
    return {
      items: pageData.items.map(sanitizeUser),
      pagination: pageData.pagination,
    };
  }

  async getUserById(userId) {
    const state = readState();
    const user = state.users.find((item) => item.id === userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return sanitizeUser(user);
  }

  async checkIn(userId, { location = null, mood = null } = {}) {
    return withState((state) => {
      const user = state.users.find((item) => item.id === userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      const now = nowIso();
      user.lastCheckInAt = now;
      user.nextCheckinDeadline = new Date(Date.now() + user.graceHours * 60 * 60 * 1000).toISOString();
      user.deadmanStage = 0;
      user.deadmanEscalationTriggeredAt = null;
      if (location) {
        user.lastLat = location.lat;
        user.lastLng = location.lng;
        user.lastLocationTime = now;
        user.approxAddress = location.approxAddress || user.approxAddress;
      }
      user.updatedAt = now;

      const status = {
        id: createId('status'),
        userId,
        moodEmoji: mood || '🙂',
        text: 'Da check-in an toan',
        audioUrl: null,
        visibility: 'FAMILY',
        batteryLevel: user.batteryLevel,
        isCheckIn: true,
        createdAt: now,
      };
      state.dailyStatuses.push(status);

      createAlertEvent({
        userId,
        level: 'INFO',
        status: 'CHECKIN_OK',
        source: 'USER',
        title: 'Check-in thanh cong',
        message: 'Nguoi dung da xac nhan van an toan',
        metadata: { location, mood },
      });

      return {
        user: sanitizeUser(user),
        status,
      };
    });
  }

  async updateTimer(userId, timerIntervalMinutes) {
    return withState((state) => {
      const user = state.users.find((item) => item.id === userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }
      const hours = Math.max(1, Math.round(Number(timerIntervalMinutes) / 60));
      user.graceHours = hours;
      user.nextCheckinDeadline = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      user.updatedAt = nowIso();
      return sanitizeUser(user);
    });
  }

  async updateLocation(userId, location) {
    return withState((state) => {
      const user = state.users.find((item) => item.id === userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }
      user.lastLat = location.lat;
      user.lastLng = location.lng;
      user.lastLocationTime = nowIso();
      user.approxAddress = location.approxAddress || user.approxAddress;
      user.updatedAt = nowIso();
      return sanitizeUser(user);
    });
  }

  async updatePreferences(userId, prefs) {
    return withState((state) => {
      const user = state.users.find((item) => item.id === userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }
      user.security.quietHoursStart = prefs.quietHoursStart;
      user.security.quietHoursEnd = prefs.quietHoursEnd;
      user.security.falseAlertGraceMinutes = Number(prefs.falseAlertGraceMinutes || 0);
      user.updatedAt = nowIso();
      return sanitizeUser(user);
    });
  }

  async setSleepMode(userId, minutes) {
    return withState((state) => {
      const user = state.users.find((item) => item.id === userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }
      user.security.sleepModeUntil =
        Number(minutes) > 0 ? new Date(Date.now() + Number(minutes) * 60 * 1000).toISOString() : null;
      user.updatedAt = nowIso();
      return sanitizeUser(user);
    });
  }
}

module.exports = new UserService();
