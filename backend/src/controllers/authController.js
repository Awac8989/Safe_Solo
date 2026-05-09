const authService = require('../services/authService');

class AuthController {
  async register(req, res, next) {
    try {
      const result = await authService.register(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const result = await authService.login(req.body.email);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async googleMock(req, res, next) {
    try {
      const result = await authService.googleMock(req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async verifyOTP(req, res, next) {
    try {
      const result = await authService.verifyOTP(req.body.email, req.body.otp);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req, res, next) {
    try {
      const profile = await authService.getProfile(req.user.id);
      res.status(200).json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const profile = await authService.updateProfile(req.user.id, req.body);
      res.status(200).json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(req, res, next) {
    try {
      const settings = await authService.updateSettings(req.user.id, req.body);
      res.status(200).json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

  async bootstrap(req, res, next) {
    try {
      const data = await authService.getBootstrap(req.user.id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async deactivateAccount(req, res, next) {
    try {
      const result = await authService.deactivateAccount(req.user.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
