const Joi = require('joi');

// User validation schemas
const userSchemas = {
  register: Joi.object({
    email: Joi.string().email().required(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    dateOfBirth: Joi.date().iso().optional(),
    gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY').optional()
  }),

  login: Joi.object({
    email: Joi.string().email().required()
  }),

  verifyOtp: Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string().length(6).pattern(/^\d+$/).required()
  }),

  updateProfile: Joi.object({
    firstName: Joi.string().min(2).max(50).optional(),
    lastName: Joi.string().min(2).max(50).optional(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
    dateOfBirth: Joi.date().iso().optional(),
    gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY').optional(),
    avatar: Joi.string().uri().optional()
  })
};

// Medical profile validation schemas
const medicalSchemas = {
  create: Joi.object({
    bloodType: Joi.string().valid(
      'A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE',
      'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'
    ).optional(),
    allergies: Joi.array().items(Joi.string().min(1).max(100)).optional(),
    medications: Joi.array().items(Joi.string().min(1).max(100)).optional(),
    medicalConditions: Joi.array().items(Joi.string().min(1).max(200)).optional(),
    emergencyContact: Joi.object({
      name: Joi.string().min(2).max(100).required(),
      phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
      relationship: Joi.string().min(1).max(50).required()
    }).optional(),
    insuranceInfo: Joi.object({
      provider: Joi.string().min(2).max(100).required(),
      policyNumber: Joi.string().min(1).max(50).required(),
      groupNumber: Joi.string().min(1).max(50).optional()
    }).optional()
  }),

  update: Joi.object({
    bloodType: Joi.string().valid(
      'A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE',
      'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'
    ).optional(),
    allergies: Joi.array().items(Joi.string().min(1).max(100)).optional(),
    medications: Joi.array().items(Joi.string().min(1).max(100)).optional(),
    medicalConditions: Joi.array().items(Joi.string().min(1).max(200)).optional(),
    emergencyContact: Joi.object({
      name: Joi.string().min(2).max(100).required(),
      phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
      relationship: Joi.string().min(1).max(50).required()
    }).optional(),
    insuranceInfo: Joi.object({
      provider: Joi.string().min(2).max(100).required(),
      policyNumber: Joi.string().min(1).max(50).required(),
      groupNumber: Joi.string().min(1).max(50).optional()
    }).optional()
  })
};

// Guardian relationship validation schemas
const guardianSchemas = {
  sendRequest: Joi.object({
    guardianId: Joi.string().required(),
    message: Joi.string().max(500).optional()
  }),

  respondToRequest: Joi.object({
    relationshipId: Joi.string().required(),
    action: Joi.string().valid('ACCEPT', 'REJECT').required()
  }),

  updateRelationship: Joi.object({
    relationshipId: Joi.string().required(),
    status: Joi.string().valid('ACCEPTED', 'REJECTED', 'BLOCKED').required()
  })
};

// Location validation schemas
const locationSchemas = {
  ping: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required()
  })
};

// Radar validation schemas
const radarSchemas = {
  broadcast: Joi.object({
    incidentType: Joi.string().min(1).max(100).required(),
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required()
  }),

  nearby: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required()
  })
};

// Feed validation schemas
const feedSchemas = {
  createStatus: Joi.object({
    mood_emoji: Joi.string().min(1).max(10).required(),
    audio_url: Joi.string().uri().optional()
  })
};

// Community validation schemas
const communitySchemas = {
  thankYou: Joi.object({
    content: Joi.string().min(1).max(500).required(),
    rating: Joi.number().min(1).max(5).optional()
  })
};

// Validation middleware
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }

    next();
  };
};

module.exports = {
  userSchemas,
  medicalSchemas,
  guardianSchemas,
  locationSchemas,
  radarSchemas,
  feedSchemas,
  communitySchemas,
  validate
};