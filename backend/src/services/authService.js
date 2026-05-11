const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const GuardianRelationship = require('../models/GuardianRelationship');
const EmergencyMemo = require('../models/EmergencyMemo');
const SecuritySetting = require('../models/SecuritySetting');
const MedicalProfile = require('../models/MedicalProfile');
const Vault = require('../models/Vault');
const { AppError, ensure } = require('../lib/errors');
const { normalizeEmail, sanitizeUser, fullName, splitFullName } = require('../lib/utils');
const { createAlertEvent } = require('./alertEventService');

class AuthService {
  generateToken(user) {
    return jwt.sign(
      {
        id: user.id || user._id,
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

  async ensureSecurity(userId) {
    let settings = await SecuritySetting.findOne({ userId });
    if (!settings) {
      settings = await SecuritySetting.create({ userId });
    }
    return settings;
  }

  mergeSecurity(user, settings) {
    return {
      stealthMode: Boolean(settings?.stealthMode),
      highContrast: Boolean(user?.highContrast),
      realPin: user?.realPin || '',
      duressPin: user?.duressPin || '',
      autoWipeEnabled: Number(settings?.autoWipeDays || 0) > 0,
      autoWipeDays: Number(settings?.autoWipeDays || 0),
      quietHoursStart: user?.quietHoursStart || '23:00',
      quietHoursEnd: user?.quietHoursEnd || '06:00',
      falseAlertGraceMinutes: Number(user?.falseAlertGraceMinutes || 3),
      pillReminder: Boolean(user?.pillReminder),
      pillTime: user?.pillTime || '08:00',
    };
  }

  async register(payload) {
    const email = normalizeEmail(payload.email);
    ensure(email, 'Email is required');

    const existing = await User.findOne({
      $or: [
        { email },
        ...(payload.phone ? [{ phoneNumber: payload.phone }] : []),
      ],
    });

    if (existing) {
      throw new AppError('User already exists with this email or phone', 409);
    }

    const otp = this.generateOTP();
    const firstName = String(payload.firstName || payload.name || 'Safe').trim();
    const lastName = String(payload.lastName || 'Solo').trim();
    const fullNameValue = [firstName, lastName].filter(Boolean).join(' ').trim();
    const user = await User.create({
      fullName: fullNameValue,
      firstName,
      lastName,
      email,
      phoneNumber: payload.phone || '',
      dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : null,
      gender: payload.gender || 'PREFER_NOT_TO_SAY',
      avatar: null,
      isActive: true,
      isVerified: false,
      otpCode: otp,
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      lastLoginAt: null,
      trustScore: 5,
      rescuesCount: 0,
      isKycVerified: false,
      timerIntervalMinutes: 24 * 60,
      lastCheckinTime: new Date(),
      nextDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      currentStatus: 'SAFE',
      lastKnownLocation:
        payload.lat != null && payload.lng != null
          ? { lat: payload.lat, lng: payload.lng, updatedAt: new Date() }
          : null,
      batteryLevel: payload.batteryLevel ?? null,
      approxAddress: payload.approxAddress || null,
      role: String(payload.role || 'USER').toLowerCase() === 'admin' ? 'admin' : 'user',
      quietHoursStart: '23:00',
      quietHoursEnd: '06:00',
      falseAlertGraceMinutes: 7,
      highContrast: false,
      pillReminder: false,
      pillTime: '08:00',
      realPin: '',
      duressPin: '',
    });

    await this.ensureSecurity(user._id);
    await createAlertEvent({
      userId: user._id,
      level: 'INFO',
      status: 'REGISTERED',
      source: 'USER',
      title: 'Dang ky tai khoan',
      message: `${fullName(user)} da dang ky SafeSolo`,
      metadata: {},
    });

    return {
      user: {
        ...sanitizeUser(user),
        security: this.mergeSecurity(user, null),
      },
      otpPreview: otp,
      message: 'Registration successful. Please verify OTP to complete sign in.',
    };
  }

  async login(email) {
    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    ensure(user.isActive !== false, 'Account is deactivated', 403);

    const otp = this.generateOTP();
    user.otpCode = otp;
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    return {
      user: {
        ...sanitizeUser(user),
        security: this.mergeSecurity(user, await this.ensureSecurity(user._id)),
      },
      otpPreview: otp,
      message: 'OTP sent successfully.',
    };
  }

  async verifyOTP(email, otp) {
    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    ensure(user.otpCode, 'No OTP found. Please request a new one.');
    ensure(new Date(user.otpExpiresAt).getTime() >= Date.now(), 'OTP has expired. Please request a new one.');
    ensure(String(user.otpCode) === String(otp), 'Invalid OTP', 401);

    user.otpCode = null;
    user.otpExpiresAt = null;
    user.isVerified = true;
    user.lastLoginAt = new Date();
    await user.save();

    return {
      user: {
        ...sanitizeUser(user),
        security: this.mergeSecurity(user, await this.ensureSecurity(user._id)),
      },
      token: this.generateToken(user),
    };
  }

  async googleMock(payload) {
    const email = normalizeEmail(payload.email);
    ensure(email, 'Email is required');

    let user = await User.findOne({ email });
    if (!user) {
      const { firstName, lastName } = splitFullName(payload.name || 'Google User');
      user = await User.create({
        fullName: [firstName, lastName].filter(Boolean).join(' ').trim() || 'Google User',
        firstName: firstName || 'Google',
        lastName: lastName || 'User',
        email,
        phoneNumber: '',
        avatar: payload.avatar || null,
        isActive: true,
        isVerified: true,
        trustScore: 5,
        rescuesCount: 0,
        isKycVerified: false,
        timerIntervalMinutes: 24 * 60,
        lastCheckinTime: new Date(),
        nextDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        currentStatus: 'SAFE',
        role: 'user',
        quietHoursStart: '23:00',
        quietHoursEnd: '06:00',
        falseAlertGraceMinutes: 7,
      });
      await this.ensureSecurity(user._id);
    } else {
      user.isVerified = true;
      user.lastLoginAt = new Date();
      if (payload.avatar) {
        user.avatar = payload.avatar;
      }
      await user.save();
    }

    return {
      user: {
        ...sanitizeUser(user),
        security: this.mergeSecurity(user, await this.ensureSecurity(user._id)),
      },
      token: this.generateToken(user),
    };
  }

  async getProfile(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const [guardiansCount, emergencyMemos, security] = await Promise.all([
      GuardianRelationship.countDocuments({
        status: 'ACCEPTED',
        $or: [{ requesterId: userId }, { guardianId: userId }],
      }),
      EmergencyMemo.find({ victimId: userId }).sort({ createdAt: -1 }).limit(50).lean(),
      this.ensureSecurity(userId),
    ]);

    return {
      ...sanitizeUser(user),
      guardiansCount,
      emergencyMemos,
      security: this.mergeSecurity(user, security),
    };
  }

  async updateProfile(userId, updateData) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const fields = ['firstName', 'lastName', 'dateOfBirth', 'gender', 'avatar', 'batteryLevel', 'approxAddress'];
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(updateData, field)) {
        user[field] = updateData[field];
      }
    }
    if (Object.prototype.hasOwnProperty.call(updateData, 'phone')) {
      user.phoneNumber = updateData.phone || '';
    }
    if (user.firstName || user.lastName) {
      user.fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.fullName;
    }
    await user.save();
    return {
      ...sanitizeUser(user),
      security: this.mergeSecurity(user, await this.ensureSecurity(userId)),
    };
  }

  async updateSettings(userId, payload) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    const security = await this.ensureSecurity(userId);

    if (Object.prototype.hasOwnProperty.call(payload, 'graceHours')) {
      const graceHours = Number(payload.graceHours || 24);
      user.timerIntervalMinutes = graceHours * 60;
      user.nextDeadline = new Date(Date.now() + graceHours * 60 * 60 * 1000);
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'stealthMode')) {
      security.stealthMode = Boolean(payload.stealthMode);
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'highContrast')) {
      user.highContrast = Boolean(payload.highContrast);
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'autoWipeEnabled')) {
      if (!payload.autoWipeEnabled) {
        security.autoWipeDays = 0;
      }
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'autoWipeDays')) {
      security.autoWipeDays = Number(payload.autoWipeDays || 0);
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'quietHoursStart')) {
      user.quietHoursStart = payload.quietHoursStart;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'quietHoursEnd')) {
      user.quietHoursEnd = payload.quietHoursEnd;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'falseAlertGraceMinutes')) {
      user.falseAlertGraceMinutes = Number(payload.falseAlertGraceMinutes || 0);
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'pillReminder')) {
      user.pillReminder = Boolean(payload.pillReminder);
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'pillTime')) {
      user.pillTime = payload.pillTime;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'realPin')) {
      user.realPin = payload.realPin || '';
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'duressPin')) {
      user.duressPin = payload.duressPin || '';
    }

    await Promise.all([user.save(), security.save()]);
    return {
      ...sanitizeUser(user),
      settings: {
        graceHours: Math.max(1, Math.round(Number(user.timerIntervalMinutes || 1440) / 60)),
        security: this.mergeSecurity(user, security),
      },
    };
  }

  async getBootstrap(userId) {
    const [profile, relationships] = await Promise.all([
      this.getProfile(userId),
      GuardianRelationship.find({ status: 'ACCEPTED', requesterId: userId }).lean(),
    ]);

    const guardianIds = relationships.map((item) => item.guardianId);
    const guardians = guardianIds.length ? await User.find({ _id: { $in: guardianIds } }).lean() : [];
    const guardianMap = new Map(guardians.map((item) => [item._id, sanitizeUser(item)]));

    return {
      user: profile,
      guardians: relationships
        .map((item) => ({
          relationshipId: item._id,
          escalationLevel: item.escalationLevel,
          guardianConfirmedAt: item.guardianConfirmedAt,
          user: guardianMap.get(item.guardianId) || null,
        }))
        .filter((item) => item.user),
      permissionsGranted: true,
      onboarded: true,
      security: profile.security,
    };
  }

  async deactivateAccount(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    user.isActive = false;
    await user.save();
    return { message: 'Account deactivated successfully' };
  }
}

module.exports = new AuthService();
