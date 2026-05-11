const mongoose = require('mongoose');

const MedicalProfileSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    fullName: { type: String, default: '' },
    birthYear: { type: String, default: '' },
    bloodType: { type: String, default: 'O+' },
    allergies: { type: String, default: '' },
    conditions: { type: String, default: '' },
    medications: { type: String, default: '' },
    emergencyPhone: { type: String, default: '' },
    insuranceProvider: { type: String, default: '' },
    insuranceNumber: { type: String, default: '' },
    allergiesList: { type: [String], default: [] },
    medicationsList: { type: [String], default: [] },
    medicalConditions: { type: [String], default: [] },
    emergencyContact: { type: mongoose.Schema.Types.Mixed, default: null },
    insuranceInfo: { type: mongoose.Schema.Types.Mixed, default: null },
    doctor: { type: String, default: null },
    qrCodeValue: { type: String, default: '' },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.models.MedicalProfile || mongoose.model('MedicalProfile', MedicalProfileSchema);
