const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const GuardianRelationship = require('../models/GuardianRelationship');
const EmergencyMemo = require('../models/EmergencyMemo');
const SecuritySetting = require('../models/SecuritySetting');
const MedicalProfile = require('../models/MedicalProfile');
const Vault = require('../models/Vault');
const { AppError, ensure } = require('../lib/errors');
const { normalizeEmail, sanitizeUser, fullName, splitFullName } = require('../lib/utils');
const { createAlertEvent } = require('./alertEventService');
const { hashPin, isHashedPin } = require('../lib/securityCrypto');
const { buildEncryptedUserSensitiveUpdate, decryptUserSensitivePayload } = require('../lib/userSensitiveCodec');
const telegramBotService = require('./telegramBotService');
const emailService = require('./emailService');

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

  includeOtpPreview(otp) {
    const isAllowed = process.env.ALLOW_OTP_PREVIEW === 'true';
    return isAllowed ? { otpPreview: otp } : {};
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
      realPin:
        user?.realPin && !isHashedPin(user.realPin) ? user.realPin : '',
      duressPin:
        user?.duressPin && !isHashedPin(user.duressPin) ? user.duressPin : '',
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
    const rawEmail = payload.email ? normalizeEmail(payload.email) : '';
    const phone = (payload.phone || payload.phoneNumber || '').trim();
    const effectiveEmail = rawEmail || (phone ? `${phone}@safesolo.vn` : '');

    ensure(effectiveEmail || phone, 'Vui lòng cung cấp Email hoặc Số điện thoại để đăng ký');

    const existing = await User.findOne({
      $or: [
        ...(effectiveEmail ? [{ email: effectiveEmail }] : []),
        ...(phone ? [{ phoneNumber: phone }] : []),
      ],
    });

    if (existing) {
      throw new AppError('Số điện thoại hoặc Email này đã được đăng ký trong hệ sinh thái SafeSolo', 409);
    }

    let firstName = payload.firstName ? String(payload.firstName).trim() : '';
    let lastName = payload.lastName ? String(payload.lastName).trim() : '';
    if (!firstName && !lastName && payload.fullName) {
      const parts = splitFullName(payload.fullName);
      firstName = parts.firstName;
      lastName = parts.lastName;
    }
    firstName = firstName || 'Safe';
    lastName = lastName || 'Solo';
    const fullNameValue = [firstName, lastName].filter(Boolean).join(' ').trim();

    let hashedPassword = null;
    if (payload.password) {
      hashedPassword = await bcrypt.hash(String(payload.password), 10);
    }

    const emergencyContacts = [];
    if (payload.emergencyName && payload.emergencyPhone) {
      emergencyContacts.push({
        name: String(payload.emergencyName).trim(),
        phone: String(payload.emergencyPhone).trim(),
        relation: 'Người thân',
        priority: 1,
      });
    } else if (Array.isArray(payload.emergencyContacts)) {
      emergencyContacts.push(...payload.emergencyContacts);
    }

    const interval = Number(payload.timerIntervalMinutes) || 720;
    const now = new Date();

    const user = await User.create({
      fullName: fullNameValue,
      firstName,
      lastName,
      email: effectiveEmail,
      phoneNumber: phone || null,
      password: hashedPassword,
      dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : null,
      gender: payload.gender || 'PREFER_NOT_TO_SAY',
      avatar: null,
      isActive: true,
      isVerified: true,
      lastLoginAt: now,
      trustScore: 5,
      rescuesCount: 0,
      isKycVerified: false,
      timerIntervalMinutes: interval,
      lastCheckinTime: now,
      nextDeadline: new Date(now.getTime() + interval * 60 * 1000),
      currentStatus: 'SAFE',
      lastKnownLocation:
        payload.lat != null && payload.lng != null
          ? { lat: payload.lat, lng: payload.lng, updatedAt: now }
          : null,
      batteryLevel: payload.batteryLevel ?? null,
      role: String(payload.role || 'USER').toLowerCase() === 'admin' ? 'admin' : 'user',
      quietHoursStart: '23:00',
      quietHoursEnd: '06:00',
      falseAlertGraceMinutes: 3,
      highContrast: false,
      pillReminder: false,
      pillTime: '08:00',
      realPin: '',
      duressPin: '',
      ...buildEncryptedUserSensitiveUpdate(effectiveEmail || phone || crypto.randomUUID(), {
        approxAddress: payload.approxAddress || null,
        medicalNotes: '',
        emergencyContacts,
      }),
    });

    user.encryptedSensitive = buildEncryptedUserSensitiveUpdate(user._id, {
      approxAddress: payload.approxAddress || null,
      medicalNotes: '',
      emergencyContacts,
    }).encryptedSensitive;
    user.encryptionVersion = 1;
    user.encryptedAt = now;
    await user.save();

    await this.ensureSecurity(user._id);

    try {
      await MedicalProfile.findOneAndUpdate(
        { userId: user._id },
        {
          userId: user._id,
          fullName: fullNameValue,
          emergencyPhone: emergencyContacts[0]?.phone || '',
          emergencyContact: emergencyContacts[0] || null,
          bloodType: 'O+',
        },
        { upsert: true, new: true },
      );
    } catch (_) {}

    await createAlertEvent({
      userId: user._id,
      level: 'INFO',
      status: 'REGISTERED',
      source: 'USER',
      title: 'Đăng ký tài khoản',
      message: `${fullName(user)} đã hoàn tất đăng ký tài khoản SafeSolo`,
      metadata: { timerIntervalMinutes: interval },
    });

    const token = this.generateToken(user);
    return {
      user: {
        ...sanitizeUser(user),
        security: this.mergeSecurity(user, await this.ensureSecurity(user._id)),
      },
      token,
      message: 'Đăng ký tài khoản thành công! Chào mừng bạn gia nhập mạng lưới SafeSolo.',
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
      ...this.includeOtpPreview(otp),
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
        phoneNumber: null,
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

  async googleAuth(payload) {
    return this.googleMock(payload);
  }

  async telegramSendOtp(identifier) {
    ensure(identifier, 'Telegram Chat ID, Phone or Email is required');
    const cleanId = String(identifier).trim();

    let user = await User.findOne({
      $or: [
        { telegramChatId: cleanId },
        { phoneNumber: cleanId },
        { email: cleanId.toLowerCase() },
        { telegramUsername: cleanId.replace(/^@/, '') },
      ],
    });

    const otp = this.generateOTP();

    if (!user) {
      user = await User.create({
        fullName: `Telegram User (${cleanId})`,
        phoneNumber: cleanId.startsWith('+') || /^\d+$/.test(cleanId) ? cleanId : null,
        telegramChatId: cleanId,
        authProvider: 'telegram',
        isActive: true,
        isVerified: false,
        otpCode: otp,
        otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        trustScore: 5,
        rescuesCount: 0,
        role: 'user',
        nextDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      await this.ensureSecurity(user._id);
    } else {
      user.otpCode = otp;
      user.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
      if (!user.telegramChatId) {
        user.telegramChatId = cleanId;
      }
      await user.save();
    }

    const teleResult = await telegramBotService.sendOtp(
      user.telegramChatId || cleanId,
      otp,
      user.fullName || 'Bạn',
    );

    return {
      success: true,
      identifier: cleanId,
      ...this.includeOtpPreview(otp),
      message: 'Mã xác thực OTP đã được gửi đến Telegram của bạn.',
      telegram: teleResult,
    };
  }

  async telegramVerifyOtp(identifier, otp) {
    ensure(identifier, 'Identifier is required');
    ensure(otp, 'OTP code is required');
    const cleanId = String(identifier).trim();

    const user = await User.findOne({
      $or: [
        { telegramChatId: cleanId },
        { phoneNumber: cleanId },
        { email: cleanId.toLowerCase() },
        { telegramUsername: cleanId.replace(/^@/, '') },
      ],
    });

    if (!user) {
      throw new AppError('Không tìm thấy tài khoản Telegram tương ứng', 404);
    }

    ensure(user.otpCode, 'Chưa yêu cầu mã OTP. Vui lòng gửi lại yêu cầu.');
    ensure(new Date(user.otpExpiresAt).getTime() >= Date.now(), 'Mã OTP đã hết hạn (5 phút). Vui lòng lấy mã mới.');
    ensure(String(user.otpCode).trim() === String(otp).trim(), 'Mã OTP không chính xác', 401);

    user.otpCode = null;
    user.otpExpiresAt = null;
    user.isVerified = true;
    user.lastLoginAt = new Date();
    await user.save();

    return {
      success: true,
      user: {
        ...sanitizeUser(user),
        security: this.mergeSecurity(user, await this.ensureSecurity(user._id)),
      },
      token: this.generateToken(user),
      message: 'Đăng nhập qua Telegram thành công!',
    };
  }

  async gmailSendOtp(email) {
    const normalizedEmail = normalizeEmail(email);
    ensure(normalizedEmail, 'Gmail address is required');

    let user = await User.findOne({ email: normalizedEmail });
    const otp = this.generateOTP();

    if (!user) {
      const { firstName, lastName } = splitFullName(email.split('@')[0]);
      user = await User.create({
        fullName: email.split('@')[0],
        firstName: firstName || 'Gmail',
        lastName: lastName || 'User',
        email: normalizedEmail,
        phoneNumber: null,
        authProvider: 'email',
        isActive: true,
        isVerified: false,
        otpCode: otp,
        otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        trustScore: 5,
        role: 'user',
        nextDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      await this.ensureSecurity(user._id);
    } else {
      user.otpCode = otp;
      user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();
    }

    const emailDelivery = await emailService.sendLoginOtpEmail(normalizedEmail, otp, fullName(user));

    return {
      success: true,
      email: normalizedEmail,
      ...this.includeOtpPreview(otp),
      message: `Đã gửi mã xác minh OTP đến địa chỉ Gmail: ${normalizedEmail}`,
      emailDelivery,
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

    const fields = ['firstName', 'lastName', 'dateOfBirth', 'gender', 'avatar', 'batteryLevel'];
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(updateData, field)) {
        user[field] = updateData[field];
      }
    }
    if (Object.prototype.hasOwnProperty.call(updateData, 'approxAddress')) {
      const currentSensitive = decryptUserSensitivePayload(user);
      Object.assign(
        user,
        buildEncryptedUserSensitiveUpdate(userId, {
          ...currentSensitive,
          approxAddress: updateData.approxAddress || null,
        }),
      );
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
      user.realPin = await hashPin(payload.realPin || '');
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'duressPin')) {
      user.duressPin = await hashPin(payload.duressPin || '');
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

  async loginWithPassword({ identifier, password, deviceName, ipAddress, userAgent }) {
    ensure(identifier && String(identifier).trim(), 'Vui lòng nhập Email, Số điện thoại hoặc Tên tài khoản');
    ensure(password, 'Vui lòng nhập mật khẩu');

    const cleanId = String(identifier).trim();
    const normalized = normalizeEmail(cleanId);

    const user = await User.findOne({
      $or: [
        { email: normalized },
        { phoneNumber: cleanId },
        { fullName: cleanId },
      ],
    });

    if (!user) {
      throw new AppError('Tài khoản không tồn tại trong hệ sinh thái SafeSolo', 404);
    }

    ensure(user.isActive !== false, 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.', 403);

    // Kiểm tra tự động tạm khóa do Brute-force
    if (user.lockUntil && new Date(user.lockUntil).getTime() > Date.now()) {
      const remainingMinutes = Math.max(1, Math.ceil((new Date(user.lockUntil).getTime() - Date.now()) / 60000));
      throw new AppError(
        `Tài khoản đang bị tạm khóa an ninh do nhập sai mật khẩu quá 5 lần liên tiếp. Vui lòng thử lại sau ${remainingMinutes} phút hoặc dùng tính năng 'Quên mật khẩu'.`,
        423,
      );
    }

    let isValid = false;
    if (user.password) {
      isValid = await bcrypt.compare(password, user.password);
    } else {
      // Đối với tài khoản chưa thiết lập mật khẩu lần đầu (hoặc tài khoản demo)
      // Cho phép mật khẩu khởi tạo mặc định 123456 hoặc safesolo123
      if (password === '123456' || password === 'safesolo123' || (user.phoneNumber && password === user.phoneNumber)) {
        user.password = await bcrypt.hash(password, 10);
        isValid = true;
      }
    }

    if (!isValid) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();
        await createAlertEvent({
          userId: user._id,
          level: 'WARNING',
          status: 'LOCKED',
          source: 'SYSTEM',
          title: 'Khóa tài khoản tạm thời',
          message: `Tài khoản ${fullName(user)} bị tạm khóa 15 phút do nhập sai mật khẩu 5 lần`,
          metadata: { ipAddress, deviceName },
        });
        throw new AppError(
          'Tài khoản đã bị tạm khóa 15 phút do nhập sai mật khẩu 5 lần liên tiếp để ngăn chặn dò quét tự động.',
          423,
        );
      }
      await user.save();
      const remaining = 5 - user.failedLoginAttempts;
      throw new AppError(
        `Mật khẩu không chính xác. Bạn còn ${remaining} lần thử trước khi tài khoản bị tạm khóa.`,
        401,
      );
    }

    // Đăng nhập thành công -> Reset brute-force counter
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLoginAt = new Date();

    // Ghi nhận phiên làm việc đa thiết bị
    const currentSessionId = crypto.randomUUID();
    const devName = deviceName || 'Thiết bị di động';
    const existingSessions = Array.isArray(user.activeSessions) ? user.activeSessions : [];
    const isNewDevice = !existingSessions.some((s) => s.deviceName === devName);

    user.activeSessions = [
      {
        sessionId: currentSessionId,
        deviceName: devName,
        ipAddress: ipAddress || '127.0.0.1',
        userAgent: userAgent || 'SafeSolo Mobile App',
        lastActiveAt: new Date(),
        isCurrent: true,
      },
      ...existingSessions.slice(0, 9).map((s) => ({
        sessionId: s.sessionId || crypto.randomUUID(),
        deviceName: s.deviceName,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        lastActiveAt: s.lastActiveAt,
        isCurrent: false,
      })),
    ];
    await user.save();

    // Cảnh báo nếu đăng nhập từ thiết bị mới
    if (isNewDevice && existingSessions.length > 0) {
      await createAlertEvent({
        userId: user._id,
        level: 'INFO',
        status: 'NEW_DEVICE_LOGIN',
        source: 'SYSTEM',
        title: 'Cảnh báo đăng nhập thiết bị mới',
        message: `Phát hiện lượt đăng nhập mới từ ${devName} (IP: ${ipAddress || '127.0.0.1'})`,
        metadata: { deviceName: devName, ipAddress: ipAddress || '127.0.0.1' },
      });
    }

    const token = this.generateToken(user);
    return {
      user: {
        ...sanitizeUser(user),
        security: this.mergeSecurity(user, await this.ensureSecurity(user._id)),
      },
      token,
      sessionId: currentSessionId,
      message: 'Đăng nhập thành công.',
    };
  }

  async forgotPassword({ identifier, channel = 'auto' }) {
    ensure(identifier && String(identifier).trim(), 'Vui lòng nhập Email, Số điện thoại hoặc tài khoản Telegram để khôi phục');
    const cleanId = String(identifier).trim();
    const normalized = normalizeEmail(cleanId);

    const user = await User.findOne({
      $or: [
        { email: normalized },
        { phoneNumber: cleanId },
        { fullName: cleanId },
        { telegramChatId: cleanId },
        { telegramUsername: cleanId.replace(/^@/, '') },
      ],
    });

    if (!user) {
      throw new AppError('Không tìm thấy tài khoản tương ứng với thông tin đã nhập', 404);
    }

    const resetOtp = this.generateOTP();
    user.resetPasswordToken = resetOtp;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 phút
    await user.save();

    await createAlertEvent({
      userId: user._id,
      level: 'INFO',
      status: 'FORGOT_PASSWORD_REQUESTED',
      source: 'USER',
      title: 'Yêu cầu khôi phục mật khẩu',
      message: `Người dùng yêu cầu mã đặt lại mật khẩu cho tài khoản ${fullName(user)}`,
      metadata: { identifier: cleanId, channel },
    });

    const dispatchedChannels = [];
    let emailResult = null;
    let teleResult = null;

    // 1. Gửi qua Gmail nếu kênh là 'email' hoặc 'auto' (hoặc người dùng nhập email)
    const targetEmail = user.email || (cleanId.includes('@') ? cleanId : null);
    if ((channel === 'email' || channel === 'auto' || cleanId.includes('@')) && targetEmail) {
      emailResult = await emailService.sendPasswordResetEmail(targetEmail, resetOtp, fullName(user));
      dispatchedChannels.push(`Gmail (${targetEmail})`);
    }

    // 2. Gửi qua Telegram nếu kênh là 'telegram' hoặc 'auto' (hoặc người dùng nhập @username hoặc có telegramChatId)
    const targetTele = user.telegramChatId || user.telegramUsername || (cleanId.startsWith('@') || /^-?\d+$/.test(cleanId) ? cleanId : null);
    if ((channel === 'telegram' || channel === 'auto' || cleanId.startsWith('@') || /^-?\d+$/.test(cleanId)) && targetTele) {
      teleResult = await telegramBotService.sendPasswordResetCode(targetTele, resetOtp, fullName(user));
      dispatchedChannels.push(`Telegram (@${telegramBotService.botUsername})`);
    }

    let channelMsg = '';
    if (dispatchedChannels.length > 0) {
      channelMsg = `Mã xác nhận khôi phục 6 số đã được gửi qua ${dispatchedChannels.join(' và ')}.`;
    } else {
      channelMsg = `Mã khôi phục đã được tạo (hiệu lực 15 phút). Vui lòng nhập mã để đặt lại mật khẩu.`;
    }

    return {
      success: true,
      message: channelMsg,
      channels: dispatchedChannels,
      emailResult,
      telegramResult: teleResult,
      resetCodePreview: resetOtp,
    };
  }

  async resetPassword({ identifier, resetCode, newPassword }) {
    ensure(identifier && String(identifier).trim(), 'Vui lòng nhập Email hoặc Số điện thoại');
    ensure(resetCode && String(resetCode).trim(), 'Vui lòng nhập mã khôi phục 6 số');
    ensure(newPassword && String(newPassword).length >= 6, 'Mật khẩu mới phải có ít nhất 6 ký tự');

    const cleanId = String(identifier).trim();
    const normalized = normalizeEmail(cleanId);

    const user = await User.findOne({
      $or: [
        { email: normalized },
        { phoneNumber: cleanId },
        { fullName: cleanId },
      ],
    });

    if (!user) {
      throw new AppError('Tài khoản không tồn tại', 404);
    }

    ensure(user.resetPasswordToken, 'Không có yêu cầu khôi phục mật khẩu nào đang chờ xác nhận');
    ensure(
      new Date(user.resetPasswordExpires).getTime() >= Date.now(),
      'Mã khôi phục đã hết hạn (quá 15 phút). Vui lòng gửi lại yêu cầu.',
    );
    ensure(
      String(user.resetPasswordToken).trim() === String(resetCode).trim(),
      'Mã xác nhận khôi phục không chính xác',
      400,
    );

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    await createAlertEvent({
      userId: user._id,
      level: 'INFO',
      status: 'PASSWORD_RESET_SUCCESS',
      source: 'USER',
      title: 'Đặt lại mật khẩu thành công',
      message: `Mật khẩu tài khoản ${fullName(user)} đã được thay đổi an toàn`,
      metadata: {},
    });

    return {
      success: true,
      message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập ngay với mật khẩu mới.',
    };
  }

  async getActiveSessions(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    let sessions = Array.isArray(user.activeSessions) ? user.activeSessions : [];
    if (sessions.length === 0) {
      sessions = [
        {
          sessionId: crypto.randomUUID(),
          deviceName: 'Pixel 6 Pro (Thiết bị hiện tại)',
          ipAddress: '127.0.0.1',
          userAgent: 'SafeSolo Mobile App (Android 14)',
          lastActiveAt: user.lastLoginAt || new Date(),
          isCurrent: true,
        },
      ];
      user.activeSessions = sessions;
      await user.save();
    }
    return {
      sessions,
    };
  }

  async revokeOtherSessions(userId, currentSessionId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    if (Array.isArray(user.activeSessions)) {
      user.activeSessions = user.activeSessions.filter(
        (s) => s.sessionId === currentSessionId || s.isCurrent === true,
      );
      await user.save();
    }
    return {
      success: true,
      message: 'Đã đăng xuất khỏi tất cả các thiết bị khác thành công.',
    };
  }
}

module.exports = new AuthService();
