const crypto = require('crypto');
const mongoose = require('mongoose');

const EmergencyEvidenceSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, index: true },
    incidentId: { type: String, default: null, index: true },
    triggerSource: {
      type: String,
      enum: ['SOS_BUTTON', 'DURESS_PIN', 'FALL_DETECTED', 'SHAKE_SOS', 'VOICE_KEYWORD', 'MANUAL'],
      default: 'SOS_BUTTON',
    },
    photoBase64: { type: String, default: null },
    audioBase64: { type: String, default: null },
    photoUrl: { type: String, default: null },
    audioUrl: { type: String, default: null },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports =
  mongoose.models.EmergencyEvidence || mongoose.model('EmergencyEvidence', EmergencyEvidenceSchema);
