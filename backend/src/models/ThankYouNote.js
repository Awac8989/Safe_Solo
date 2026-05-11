const crypto = require('crypto');
const mongoose = require('mongoose');

const ThankYouNoteSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    volunteerId: { type: String, required: true, index: true },
    authorId: { type: String, required: true, index: true },
    content: { type: String, required: true, trim: true },
    rating: { type: Number, default: null, min: 1, max: 5 },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.models.ThankYouNote || mongoose.model('ThankYouNote', ThankYouNoteSchema);
