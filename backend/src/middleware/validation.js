const Joi = require('joi');

const hhmm = /^([01]\d|2[0-3]):([0-5]\d)$/;

const userSchemas = {
  register: Joi.object({
    email: Joi.string().email().required(),
    phone: Joi.string().allow(null, '').optional(),
    firstName: Joi.string().min(1).max(50).required(),
    lastName: Joi.string().min(1).max(80).required(),
    dateOfBirth: Joi.string().isoDate().allow(null, '').optional(),
    gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY').optional(),
  }),
  login: Joi.object({
    email: Joi.string().email().required(),
  }),
  verifyOtp: Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string().length(6).pattern(/^\d+$/).required(),
  }),
  googleMock: Joi.object({
    email: Joi.string().email().required(),
    name: Joi.string().min(1).max(120).optional(),
    avatar: Joi.string().uri().optional(),
  }),
  updateProfile: Joi.object({
    firstName: Joi.string().min(1).max(50).optional(),
    lastName: Joi.string().min(1).max(80).optional(),
    phone: Joi.string().allow('', null).optional(),
    dateOfBirth: Joi.string().isoDate().allow('', null).optional(),
    gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY').optional(),
    avatar: Joi.string().allow('', null).optional(),
    batteryLevel: Joi.number().min(0).max(100).optional(),
    approxAddress: Joi.string().max(200).allow('', null).optional(),
  }),
  settings: Joi.object({
    graceHours: Joi.number().integer().min(1).max(168).optional(),
    stealthMode: Joi.boolean().optional(),
    highContrast: Joi.boolean().optional(),
    autoWipeEnabled: Joi.boolean().optional(),
    autoWipeDays: Joi.number().integer().min(0).max(365).optional(),
    quietHoursStart: Joi.string().pattern(hhmm).optional(),
    quietHoursEnd: Joi.string().pattern(hhmm).optional(),
    falseAlertGraceMinutes: Joi.number().integer().min(0).max(60).optional(),
    pillReminder: Joi.boolean().optional(),
    pillTime: Joi.string().pattern(hhmm).optional(),
    realPin: Joi.string().allow('').max(20).optional(),
    duressPin: Joi.string().allow('').max(20).optional(),
  }),
};

const medicalSchemas = {
  create: Joi.object({
    bloodType: Joi.string().allow(null, '').optional(),
    allergies: Joi.array().items(Joi.string().max(120)).optional(),
    medications: Joi.array().items(Joi.string().max(120)).optional(),
    medicalConditions: Joi.array().items(Joi.string().max(160)).optional(),
    emergencyContact: Joi.object({
      name: Joi.string().required(),
      phone: Joi.string().required(),
      relationship: Joi.string().required(),
    }).allow(null).optional(),
    insuranceInfo: Joi.object().allow(null).optional(),
    doctor: Joi.string().max(120).allow('', null).optional(),
  }),
  update: Joi.object({
    bloodType: Joi.string().allow(null, '').optional(),
    allergies: Joi.array().items(Joi.string().max(120)).optional(),
    medications: Joi.array().items(Joi.string().max(120)).optional(),
    medicalConditions: Joi.array().items(Joi.string().max(160)).optional(),
    emergencyContact: Joi.object({
      name: Joi.string().required(),
      phone: Joi.string().required(),
      relationship: Joi.string().required(),
    }).allow(null).optional(),
    insuranceInfo: Joi.object().allow(null).optional(),
    doctor: Joi.string().max(120).allow('', null).optional(),
  }),
};

const guardianSchemas = {
  sendRequest: Joi.object({
    guardianId: Joi.string().required(),
    message: Joi.string().max(500).allow('', null).optional(),
    escalationLevel: Joi.number().integer().min(1).max(3).optional(),
  }),
  respondToRequest: Joi.object({
    relationshipId: Joi.string().required(),
    action: Joi.string().valid('ACCEPT', 'REJECT').required(),
  }),
};

const locationSchemas = {
  ping: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
    batteryLevel: Joi.number().min(0).max(100).optional(),
    approxAddress: Joi.string().max(200).allow('', null).optional(),
  }),
};

const radarSchemas = {
  broadcast: Joi.object({
    incidentType: Joi.string().min(1).max(100).required(),
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
    severity: Joi.number().integer().min(1).max(5).optional(),
    batteryLevel: Joi.number().min(0).max(100).optional(),
    approxAddress: Joi.string().max(200).allow('', null).optional(),
  }),
  nearby: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
    radiusKm: Joi.number().min(0.5).max(20).optional(),
  }),
};

const feedSchemas = {
  createStatus: Joi.object({
    mood_emoji: Joi.string().min(1).max(10).required(),
    text: Joi.string().max(500).allow('', null).optional(),
    audio_url: Joi.string().allow('', null).optional(),
    visibility: Joi.string().valid('FAMILY', 'COMMUNITY').optional(),
    batteryLevel: Joi.number().min(0).max(100).optional(),
    isCheckIn: Joi.boolean().optional(),
  }),
  comment: Joi.object({
    content: Joi.string().min(1).max(300).required(),
  }),
};

const communitySchemas = {
  thankYou: Joi.object({
    content: Joi.string().min(1).max(500).required(),
    rating: Joi.number().min(1).max(5).optional(),
  }),
};

const emergencySchemas = {
  memo: Joi.object({
    incidentId: Joi.string().allow('', null).optional(),
    duration: Joi.number().min(1).max(600).required(),
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
    approxAddress: Joi.string().max(200).allow('', null).optional(),
    transcript: Joi.string().max(1000).allow('', null).optional(),
    contentUrl: Joi.string().allow('', null).optional(),
  }),
  communityCall: Joi.object({
    note: Joi.string().max(300).allow('', null).optional(),
  }),
};

const chatSchemas = {
  sendMessage: Joi.object({
    messageType: Joi.string().valid('TEXT', 'AUDIO', 'SYSTEM', 'LOCATION', 'VOICE_NOTE').required(),
    content: Joi.string().allow('', null).required(),
    metadata: Joi.object().allow(null).optional(),
  }),
};

const vaultSchemas = {
  upsert: Joi.object({
    content: Joi.object().required(),
  }),
};

const validate = (schema, source = 'body') => (req, res, next) => {
  const payload = source === 'query' ? req.query : req.body;
  const { error, value } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      })),
    });
  }

  if (source === 'query') {
    req.query = value;
  } else {
    req.body = value;
  }
  next();
};

module.exports = {
  userSchemas,
  medicalSchemas,
  guardianSchemas,
  locationSchemas,
  radarSchemas,
  feedSchemas,
  communitySchemas,
  emergencySchemas,
  chatSchemas,
  vaultSchemas,
  validate,
};
