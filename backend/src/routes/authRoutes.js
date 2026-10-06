const express = require('express');
const authController = require('../controllers/authController');
const { validate, userSchemas } = require('../middleware/validation');
const auth = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/register', validate(userSchemas.register), authController.register);
router.post('/login', validate(userSchemas.login), authController.login);
router.post('/login-password', validate(userSchemas.loginPassword), authController.loginPassword);
router.post('/forgot-password', validate(userSchemas.forgotPassword), authController.forgotPassword);
router.post('/reset-password', validate(userSchemas.resetPassword), authController.resetPassword);
router.post('/verify-otp', validate(userSchemas.verifyOtp), authController.verifyOTP);
router.post('/google-mock', validate(userSchemas.googleMock), authController.googleMock);
router.post('/google', authController.googleAuth);
router.post('/gmail/send-otp', validate(userSchemas.gmailSendOtp), authController.gmailSendOtp);
router.post('/telegram/send-otp', validate(userSchemas.telegramSendOtp), authController.telegramSendOtp);
router.post('/telegram/verify-otp', validate(userSchemas.telegramVerifyOtp), authController.telegramVerifyOtp);
router.post('/telegram/webhook', authController.telegramWebhook);
router.get('/sessions', authController.getSessions);
router.post('/sessions/revoke-others', authController.revokeOtherSessions);

// Protected routes
router.use(auth); // All routes below require authentication
router.get('/profile', authController.getProfile);
router.put('/profile', validate(userSchemas.updateProfile), authController.updateProfile);
router.patch('/settings', validate(userSchemas.settings), authController.updateSettings);
router.get('/bootstrap', authController.bootstrap);
router.delete('/profile', authController.deactivateAccount);

module.exports = router;
