const crypto = require('crypto');
const mongoose = require('mongoose');

const SmsDispatchLogSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    emergencyLogId: { type: String, index: true, default: null },
    userId: { type: String, required: true, index: true },
    toPhone: { type: String, required: true },
    provider: { type: String, required: true },
    attempt: { type: Number, required: true },
    success: { type: Boolean, default: false },
    providerMessageId: { type: String, default: null },
    errorMessage: { type: String, default: null },
    responseBody: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    versionKey: false,
  },
);

module.exports = mongoose.models.SmsDispatchLog || mongoose.model('SmsDispatchLog', SmsDispatchLogSchema);
