const authService = require('../services/authService');

class AuthController {
  // @desc    Register user
  // @route   POST /api/auth/register
  // @access  Public
  async register(req, res, next) {
    try {
      const result = await authService.register(req.body);

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Login user
  // @route   POST /api/auth/login
  // @access  Public
  async login(req, res, next) {
    try {
      const { email } = req.body;
      const result = await authService.login(email);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Verify OTP
  // @route   POST /api/auth/verify-otp
  // @access  Public
  async verifyOTP(req, res, next) {
    try {
      const { email, otp } = req.body;
      const result = await authService.verifyOTP(email, otp);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Get current user profile
  // @route   GET /api/auth/profile
  // @access  Private
  async getProfile(req, res, next) {
    try {
      const user = await authService.getProfile(req.user.id);

      res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Update user profile
  // @route   PUT /api/auth/profile
  // @access  Private
  async updateProfile(req, res, next) {
    try {
      const user = await authService.updateProfile(req.user.id, req.body);

      res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Deactivate account
  // @route   DELETE /api/auth/profile
  // @access  Private
  async deactivateAccount(req, res, next) {
    try {
      const result = await authService.deactivateAccount(req.user.id);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();