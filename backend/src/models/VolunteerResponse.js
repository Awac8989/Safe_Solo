const crypto = require('crypto');
const mongoose = require('mongoose');

const VolunteerResponseSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    incidentId: { type: String, required: true, index: true },
    volunteerId: { type: String, required: true, index: true },
    status: { type: String, enum: ['EN_ROUTE', 'ARRIVED'], default: 'EN_ROUTE' },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.models.VolunteerResponse || mongoose.model('VolunteerResponse', VolunteerResponseSchema);
