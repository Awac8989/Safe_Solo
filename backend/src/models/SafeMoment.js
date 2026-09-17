const crypto = require('crypto');
const mongoose = require('mongoose');

const SafeMomentSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, index: true },
    authorName: { type: String, default: 'Người thân' },
    avatarUrl: { type: String, default: null },
    mood: { type: String, default: 'calm' },
    voiceNoteUrl: { type: String, default: null },
    photoUrl: { type: String, default: null },
    caption: { type: String, default: '', trim: true },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 giờ
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports =
  mongoose.models.SafeMoment || mongoose.model('SafeMoment', SafeMomentSchema);
