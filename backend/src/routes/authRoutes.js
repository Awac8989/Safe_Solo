const express = require('express');
const authController = require('../controllers/authController');
const { validate, userSchemas } = require('../middleware/validation');
const auth = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/register', validate(userSchemas.register), authController.register);
router.post('/login', validate(userSchemas.login), authController.login);
router.post('/verify-otp', validate(userSchemas.verifyOtp), authController.verifyOTP);
router.post('/google-mock', validate(userSchemas.googleMock), authController.googleMock);

// Protected routes
router.use(auth); // All routes below require authentication
router.get('/profile', authController.getProfile);
router.put('/profile', validate(userSchemas.updateProfile), authController.updateProfile);
router.patch('/settings', validate(userSchemas.settings), authController.updateSettings);
router.get('/bootstrap', authController.bootstrap);
router.delete('/profile', authController.deactivateAccount);

module.exports = router;
