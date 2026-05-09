const medicalService = require('../services/medicalService');

class MedicalController {
  // @desc    Create medical profile
  // @route   POST /api/medical
  // @access  Private
  async createMedicalProfile(req, res, next) {
    try {
      const profile = await medicalService.createMedicalProfile(req.user.id, req.body);

      res.status(201).json({
        success: true,
        data: profile
      });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Get medical profile
  // @route   GET /api/medical
  // @access  Private
  async getMedicalProfile(req, res, next) {
    try {
      const profile = await medicalService.getMedicalProfile(req.user.id);

      res.status(200).json({
        success: true,
        data: profile
      });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Update medical profile
  // @route   PUT /api/medical
  // @access  Private
  async updateMedicalProfile(req, res, next) {
    try {
      const profile = await medicalService.updateMedicalProfile(req.user.id, req.body);

      res.status(200).json({
        success: true,
        data: profile
      });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Delete medical profile
  // @route   DELETE /api/medical
  // @access  Private
  async deleteMedicalProfile(req, res, next) {
    try {
      const result = await medicalService.deleteMedicalProfile(req.user.id);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Get emergency medical profile (for guardians)
  // @route   GET /api/medical/emergency/:userId
  // @access  Private (Guardian only)
  async getEmergencyProfile(req, res, next) {
    try {
      const { userId } = req.params;
      const profile = await medicalService.getEmergencyProfile(userId);

      res.status(200).json({
        success: true,
        data: profile
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MedicalController();