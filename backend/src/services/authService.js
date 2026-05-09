const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const { readState, withState, createId, nowIso } = require('../data/store');
const { AppError, ensure } = require('../lib/errors');
const { normalizeEmail, sanitizeUser, fullName } = require('../lib/utils');

class AuthService {
  generateToken(user) {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role || 'USER',
      },
      process.env.JWT_SECRET || 'safesolo-dev-secret',
      {
        expiresIn: process.env.JWT_EXPIRE || '7d',
      },
    );
  }

  generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
  }

  async sendOTP(email, otp) {
    return {
      channel: 'mock-email',
      email,
      otp,
      message: `OTP for ${email}: ${otp}`,
    };
  }

  async register(payload) {
    const email = normalizeEmail(payload.email);
    ensure(email, 'Email is required');

    return withState((state) => {
      const existing = state.users.find(
        (item) =>
          normalizeEmail(item.email) === email ||
          (payload.phone && item.phone === payload.phone),
      );

      if (existing) {
        throw new AppError('User already exists with this email or phone', 409);
      }

      const now = nowIso();
      const otp = this.generateOTP();
      const user = {
        id: createId('user'),
        email,
        phone: payload.phone || null,
        firstName: payload.firstName || payload.name || 'Safe',
        lastName: payload.lastName || 'Solo',
        dateOfBirth: payload.dateOfBirth || null,
        gender: payload.gender || 'PREFER_NOT_TO_SAY',
        avatar: null,
        isActive: true,
        isVerified: false,
        otpCode: otp,
        otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
        trustScore: 5,
        rescuesCount: 0,
        isKycVerified: false,
        nextCheckinDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        lastCheckInAt: now,
        graceHours: 24,
        deadmanStage: 0,
        deadmanEscalationTriggeredAt: null,
        lastLat: payload.lat ?? null,
        lastLng: payload.lng ?? null,
        lastLocationTime: payload.lat && payload.lng ? now : null,
        batteryLevel: payload.batteryLevel ?? null,
        approxAddress: payload.approxAddress || null,
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
          falseAlertGraceMinutes: 7,
          pillReminder: false,
          pillTime: '08:00',
        },
      };

      state.users.push(user);
      state.alertEvents.push({
        id: createId('alert'),
        userId: user.id,
        level: 'INFO',
        status: 'REGISTERED',
        source: 'USER',
        title: 'Dang ky tai khoan',
        message: `${fullName(user)} da dang ky SafeSolo`,
        metadata: {},
        createdAt: now,
      });

      return {
        user: sanitizeUser(user),
        otpPreview: otp,
        message: 'Registration successful. Please verify OTP to complete sign in.',
      };
    });
  }

  async login(email) {
    const normalizedEmail = normalizeEmail(email);

    return withState((state) => {
      const user = state.users.find((item) => normalizeEmail(item.email) === normalizedEmail);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      ensure(user.isActive, 'Account is deactivated', 403);

      const otp = this.generateOTP();
      user.otpCode = otp;
      user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      user.updatedAt = nowIso();

      return {
        user: sanitizeUser(user),
        otpPreview: otp,
        message: 'OTP sent successfully.',
      };
    });
  }

  async verifyOTP(email, otp) {
    const normalizedEmail = normalizeEmail(email);

    return withState((state) => {
      const user = state.users.find((item) => normalizeEmail(item.email) === normalizedEmail);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      ensure(user.otpCode, 'No OTP found. Please request a new one.');
      ensure(new Date(user.otpExpiresAt).getTime() >= Date.now(), 'OTP has expired. Please request a new one.');
      ensure(String(user.otpCode) === String(otp), 'Invalid OTP', 401);

      user.otpCode = null;
      user.otpExpiresAt = null;
      user.isVerified = true;
      user.lastLoginAt = nowIso();
      user.updatedAt = user.lastLoginAt;

      return {
        user: sanitizeUser(user),
        token: this.generateToken(user),
      };
    });
  }

  async googleMock(payload) {
    const email = normalizeEmail(payload.email);
    ensure(email, 'Email is required');

    return withState((state) => {
      let user = state.users.find((item) => normalizeEmail(item.email) === email);

      if (!user) {
        const name = String(payload.name || 'Google User').trim().split(' ');
        user = {
          id: createId('user'),
          email,
          phone: null,
          firstName: name.shift() || 'Google',
          lastName: name.join(' ') || 'User',
          dateOfBirth: null,
          gender: 'PREFER_NOT_TO_SAY',
          avatar: payload.avatar || null,
          isActive: true,
          isVerified: true,
          otpCode: null,
          otpExpiresAt: null,
          lastLoginAt: nowIso(),
          createdAt: nowIso(),
          updatedAt: nowIso(),
          trustScore: 5,
          rescuesCount: 0,
          isKycVerified: false,
          nextCheckinDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          lastCheckInAt: nowIso(),
          graceHours: 24,
          deadmanStage: 0,
          deadmanEscalationTriggeredAt: null,
          lastLat: null,
          lastLng: null,
          lastLocationTime: null,
          batteryLevel: null,
          approxAddress: null,
          role: 'USER',
          security: {
            stealthMode: false,
            highContrast: false,
            realPin: '',
            duressPin: '',
            autoWipeEnabled: false,
            autoWipeDays: 30,
            quietHoursStart: '23:00',
            quietHoursEnd: '06:00',
            falseAlertGraceMinutes: 7,
            pillReminder: false,
            pillTime: '08:00',
          },
        };
        state.users.push(user);
      } else {
        user.isVerified = true;
        user.lastLoginAt = nowIso();
        user.updatedAt = nowIso();
      }

      return {
        user: sanitizeUser(user),
        token: this.generateToken(user),
      };
    });
  }

  async getProfile(userId) {
    const state = readState();
    const user = state.users.find((item) => item.id === userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const guardians = state.guardianRelationships.filter(
      (item) =>
        item.status === 'ACCEPTED' &&
        (item.requesterId === userId || item.guardianId === userId),
    );
    const emergencyMemos = state.emergencyMemos
      .filter((item) => item.victimId === userId)
      .slice(-50)
      .reverse();

    return {
      ...sanitizeUser(user),
      guardiansCount: guardians.length,
      emergencyMemos,
    };
  }

  async updateProfile(userId, updateData) {
    return withState((state) => {
      const user = state.users.find((item) => item.id === userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      const fields = ['firstName', 'lastName', 'phone', 'dateOfBirth', 'gender', 'avatar', 'batteryLevel', 'approxAddress'];
      for (const field of fields) {
        if (Object.prototype.hasOwnProperty.call(updateData, field)) {
          user[field] = updateData[field];
        }
      }

      user.updatedAt = nowIso();
      return sanitizeUser(user);
    });
  }

  async updateSettings(userId, payload) {
    return withState((state) => {
      const user = state.users.find((item) => item.id === userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      user.graceHours = payload.graceHours ?? user.graceHours;
      user.security = {
        ...user.security,
        ...(payload.security || {}),
      };

      if (Object.prototype.hasOwnProperty.call(payload, 'stealthMode')) {
        user.security.stealthMode = Boolean(payload.stealthMode);
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'highContrast')) {
        user.security.highContrast = Boolean(payload.highContrast);
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'autoWipeEnabled')) {
        user.security.autoWipeEnabled = Boolean(payload.autoWipeEnabled);
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'autoWipeDays')) {
        user.security.autoWipeDays = Number(payload.autoWipeDays || 0);
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'quietHoursStart')) {
        user.security.quietHoursStart = payload.quietHoursStart;
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'quietHoursEnd')) {
        user.security.quietHoursEnd = payload.quietHoursEnd;
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'falseAlertGraceMinutes')) {
        user.security.falseAlertGraceMinutes = Number(payload.falseAlertGraceMinutes || 0);
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'pillReminder')) {
        user.security.pillReminder = Boolean(payload.pillReminder);
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'pillTime')) {
        user.security.pillTime = payload.pillTime;
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'realPin')) {
        user.security.realPin = payload.realPin || '';
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'duressPin')) {
        user.security.duressPin = payload.duressPin || '';
      }

      user.updatedAt = nowIso();

      return {
        ...sanitizeUser(user),
        settings: {
          graceHours: user.graceHours,
          security: user.security,
        },
      };
    });
  }

  async getBootstrap(userId) {
    const profile = await this.getProfile(userId);
    const state = readState();

    const guardians = state.guardianRelationships
      .filter((item) => item.status === 'ACCEPTED' && item.requesterId === userId)
      .map((item) => {
        const guardian = state.users.find((user) => user.id === item.guardianId);
        return guardian
          ? {
              relationshipId: item.id,
              escalationLevel: item.escalationLevel,
              guardianConfirmedAt: item.guardianConfirmedAt,
              user: sanitizeUser(guardian),
            }
          : null;
      })
      .filter(Boolean);

    return {
      user: profile,
      guardians,
      permissionsGranted: true,
      onboarded: true,
      security: profile.security,
    };
  }

  async deactivateAccount(userId) {
    return withState((state) => {
      const user = state.users.find((item) => item.id === userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      user.isActive = false;
      user.updatedAt = nowIso();
      return { message: 'Account deactivated successfully' };
    });
  }
}

module.exports = new AuthService();
