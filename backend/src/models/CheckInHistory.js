const mongoose = require('mongoose');

const CheckInHistorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    checkinTime: { type: Date, required: true, default: Date.now },
    locationAtCheckin: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    isSystemAutoTriggered: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.model('CheckInHistory', CheckInHistorySchema);