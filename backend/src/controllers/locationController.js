const locationService = require('../services/locationService');

class LocationController {
  // @desc    Update user location
  // @route   POST /api/location/ping
  // @access  Private
  async pingLocation(req, res, next) {
    try {
      const { lat, lng } = req.body;

      // Validate coordinates
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return res.status(400).json({
          success: false,
          error: 'Invalid coordinates. lat and lng must be numbers.'
        });
      }

      // Basic coordinate validation
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({
          success: false,
          error: 'Invalid coordinates. lat must be between -90 and 90, lng between -180 and 180.'
        });
      }

      const updatedUser = await locationService.updateUserLocation(req.user.id, lat, lng);

      res.status(200).json({
        success: true,
        data: {
          message: 'Location updated successfully',
          location: {
            lat: updatedUser.lastLat,
            lng: updatedUser.lastLng,
            timestamp: updatedUser.lastLocationTime
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Get current user location
  // @route   GET /api/location
  // @access  Private
  async getLocation(req, res, next) {
    try {
      const location = await locationService.getUserLocation(req.user.id);

      res.status(200).json({
        success: true,
        data: location
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new LocationController();