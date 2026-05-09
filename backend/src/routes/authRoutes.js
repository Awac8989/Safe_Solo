const express = require('express');
const authController = require('../controllers/authController');
const { validate, userSchemas } = require('../middleware/validation');
const auth = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/register', validate(userSchemas.register), authController.register);
router.post('/login', validate(userSchemas.login), authController.login);
router.post('/verify-otp', validate(userSchemas.verifyOtp), authController.verifyOTP);

// Protected routes
router.use(auth); // All routes below require authentication
router.get('/profile', authController.getProfile);
router.put('/profile', validate(userSchemas.updateProfile), authController.updateProfile);
router.delete('/profile', authController.deactivateAccount);

module.exports = router;