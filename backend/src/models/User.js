const mongoose = require('mongoose');

const EmergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    relation: { type: String, trim: true },
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
    fullName: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true, unique: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    medicalNotes: { type: String, default: '' },
    emergencyContacts: { type: [EmergencyContactSchema], default: [] },
    timerIntervalMinutes: { type: Number, default: 720, min: 30 },
    lastCheckinTime: { type: Date, default: Date.now },
    nextDeadline: { type: Date, required: true },
    currentStatus: { type: String, enum: ['SAFE', 'REMINDER', 'WARNING', 'SOS'], default: 'SAFE' },
    lastKnownLocation: { type: LocationSchema },
    lastReminderAt: { type: Date },
    lastWarningAt: { type: Date },
    lastSosAt: { type: Date },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.model('User', UserSchema);