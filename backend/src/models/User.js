const crypto = require('crypto');
const mongoose = require('mongoose');

const EmergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    relation: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const LocationSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const UserSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    fullName: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true, unique: true, index: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    email: { type: String, default: '', index: true },
    avatar: { type: String, default: null },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    dateOfBirth: { type: Date, default: null },
    gender: { type: String, default: 'PREFER_NOT_TO_SAY' },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: true },
    isKycVerified: { type: Boolean, default: false },
    otpCode: { type: String, default: null },
    otpExpiresAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    highContrast: { type: Boolean, default: false },
    pillReminder: { type: Boolean, default: false },
    pillTime: { type: String, default: '08:00' },
    realPin: { type: String, default: '' },
    duressPin: { type: String, default: '' },
    trustScore: { type: Number, default: 0 },
    rescuesCount: { type: Number, default: 0 },
    batteryLevel: { type: Number, default: null },
    approxAddress: { type: String, default: null },
    medicalNotes: { type: String, default: '' },
    emergencyContacts: { type: [EmergencyContactSchema], default: [] },
    timerIntervalMinutes: { type: Number, default: 720, min: 1 },
    lastCheckinTime: { type: Date, default: Date.now },
    nextDeadline: { type: Date, required: true },
    currentStatus: {
      type: String,
      enum: ['SAFE', 'REMINDER', 'WARNING', 'SOS'],
      default: 'SAFE',
    },
    lastKnownLocation: { type: LocationSchema, default: null },
    lastReminderAt: { type: Date, default: null },
    lastWarningAt: { type: Date, default: null },
    lastSosAt: { type: Date, default: null },
    quietHoursStart: { type: String, default: '23:00' },
    quietHoursEnd: { type: String, default: '06:00' },
    sleepModeUntil: { type: Date, default: null },
    falseAlertGraceMinutes: { type: Number, default: 3, min: 0, max: 30 },
    deadmanStage: { type: Number, default: 0 },
    deadmanEscalationTriggeredAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
