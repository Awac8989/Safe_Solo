const guardianService = require('../services/guardianService');

class GuardianController {
  // @desc    Send guardian request
  // @route   POST /api/guardians/request
  // @access  Private
  async sendGuardianRequest(req, res, next) {
    try {
      const { guardianId, message } = req.body;
      const relationship = await guardianService.sendGuardianRequest(
        req.user.id,
        guardianId,
        message
      );

      res.status(201).json({
        success: true,
        data: relationship
      });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Respond to guardian request
  // @route   PUT /api/guardians/respond
  // @access  Private
  async respondToRequest(req, res, next) {
    try {
      const { relationshipId, action } = req.body;
      const relationship = await guardianService.respondToRequest(
        relationshipId,
        req.user.id,
        action
      );

      res.status(200).json({
        success: true,
        data: relationship
      });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Get user's guardians and proteges
  // @route   GET /api/guardians
  // @access  Private
  async getUserGuardians(req, res, next) {
    try {
      const relationships = await guardianService.getUserGuardians(req.user.id);

      res.status(200).json({
        success: true,
        data: relationships
      });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Get pending requests
  // @route   GET /api/guardians/requests
  // @access  Private
  async getPendingRequests(req, res, next) {
    try {
      const requests = await guardianService.getPendingRequests(req.user.id);

      res.status(200).json({
        success: true,
        data: requests
      });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Remove guardian relationship
  // @route   DELETE /api/guardians/:relationshipId
  // @access  Private
  async removeRelationship(req, res, next) {
    try {
      const { relationshipId } = req.params;
      const result = await guardianService.removeRelationship(relationshipId, req.user.id);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Block user
  // @route   PUT /api/guardians/:relationshipId/block
  // @access  Private
  async blockUser(req, res, next) {
    try {
      const { relationshipId } = req.params;
      const result = await guardianService.blockUser(relationshipId, req.user.id);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Search users
  // @route   GET /api/guardians/search
  // @access  Private
  async searchUsers(req, res, next) {
    try {
      const { q: query, limit } = req.query;

      if (!query || query.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Search query must be at least 2 characters long'
        });
      }

      const users = await guardianService.searchUsers(
        query.trim(),
        req.user.id,
        parseInt(limit) || 20
      );

      res.status(200).json({
        success: true,
        data: users
      });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Get Omnichannel alert status and configured channels
  // @route   GET /api/guardians/omnichannel/status
  // @access  Private
  async getOmnichannelStatus(req, res, next) {
    try {
      const data = await guardianService.getOmnichannelStatus(req.user.id);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Broadcast emergency alert across Telegram, Zalo ZNS, SMS, and Voice Call
  // @route   POST /api/guardians/alert/broadcast
  // @access  Private
  async broadcastOmnichannelAlert(req, res, next) {
    try {
      const result = await guardianService.broadcastOmnichannelAlert(req.user.id, req.body);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new GuardianController();