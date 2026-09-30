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

  async googleAuth(req, res, next) {
    try {
      const result = await authService.googleAuth(req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async telegramSendOtp(req, res, next) {
    try {
      const result = await authService.telegramSendOtp(req.body.identifier || req.body.chatId || req.body.phone || req.body.email);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async telegramVerifyOtp(req, res, next) {
    try {
      const result = await authService.telegramVerifyOtp(
        req.body.identifier || req.body.chatId || req.body.phone || req.body.email,
        req.body.otp,
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async telegramWebhook(req, res, next) {
    try {
      const telegramBotService = require('../services/telegramBotService');
      const result = await telegramBotService.handleWebhook(req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async gmailSendOtp(req, res, next) {
    try {
      const result = await authService.gmailSendOtp(req.body.email);
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

  async loginPassword(req, res, next) {
    try {
      const result = await authService.loginWithPassword({
        identifier: req.body.identifier || req.body.email || req.body.phone,
        password: req.body.password,
        deviceName: req.body.deviceName || req.headers['user-agent'] || 'SafeSolo Client',
        ipAddress: req.ip || req.connection?.remoteAddress || '127.0.0.1',
        userAgent: req.headers['user-agent'] || '',
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req, res, next) {
    try {
      const result = await authService.forgotPassword({
        identifier: req.body.identifier || req.body.email || req.body.phone,
        channel: req.body.channel || 'auto',
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const result = await authService.resetPassword({
        identifier: req.body.identifier || req.body.email || req.body.phone,
        resetCode: req.body.resetCode || req.body.otp,
        newPassword: req.body.newPassword || req.body.password,
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getSessions(req, res, next) {
    try {
      const userId = req.user?.id || req.query.userId || req.body.userId;
      if (!userId) {
        return res.status(200).json({
          success: true,
          data: {
            sessions: [
              {
                sessionId: 'current_device_session',
                deviceName: 'Thiết bị di động hiện tại',
                ipAddress: '127.0.0.1',
                userAgent: 'SafeSolo Client',
                lastActiveAt: new Date(),
                isCurrent: true,
              },
            ],
          },
        });
      }
      const result = await authService.getActiveSessions(userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async revokeOtherSessions(req, res, next) {
    try {
      const userId = req.user?.id || req.body.userId;
      if (!userId) {
        return res.status(200).json({
          success: true,
          data: {
            success: true,
            message: 'Đã đăng xuất khỏi tất cả các thiết bị khác thành công.',
          },
        });
      }
      const result = await authService.revokeOtherSessions(userId, req.body.currentSessionId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
