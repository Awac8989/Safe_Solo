const radarService = require('../services/radarService');

class RadarController {
  // @desc    Broadcast SOS and create rescue incident
  // @route   POST /api/radar/broadcast
  // @access  Private
  async broadcastSOS(req, res, next) {
    try {
      const { incidentType, lat, lng } = req.body;

      // Validate required fields
      if (!incidentType || typeof lat !== 'number' || typeof lng !== 'number') {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: incidentType, lat, lng'
        });
      }

      // Validate coordinates
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({
          success: false,
          error: 'Invalid coordinates'
        });
      }

      const result = await radarService.broadcastSOS(req.user.id, incidentType, lat, lng);

      res.status(201).json({
        success: true,
        data: {
          incident: result.incident,
          nearbyVolunteersCount: result.nearbyVolunteers.length,
          message: 'SOS broadcasted successfully. Notifications sent to nearby volunteers.'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Get nearby active incidents (fuzzed coordinates)
  // @route   GET /api/radar/nearby
  // @access  Private
  async getNearbyIncidents(req, res, next) {
    try {
      const { lat, lng } = req.query;

      // Validate coordinates
      if (!lat || !lng) {
        return res.status(400).json({
          success: false,
          error: 'Missing coordinates: lat, lng required in query params'
        });
      }

      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);

      if (isNaN(latNum) || isNaN(lngNum)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid coordinates format'
        });
      }

      const incidents = await radarService.getNearbyIncidents(latNum, lngNum, req.user.id);

      res.status(200).json({
        success: true,
        data: incidents
      });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Accept rescue incident
  // @route   POST /api/radar/:incidentId/accept
  // @access  Private
  async acceptIncident(req, res, next) {
    try {
      const { incidentId } = req.params;

      const result = await radarService.acceptRescueIncident(incidentId, req.user.id);

      res.status(200).json({
        success: true,
        data: {
          message: 'Successfully accepted rescue mission',
          incident: result.incident,
          response: result.response
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Get incident details (for accepted volunteers)
  // @route   GET /api/radar/:incidentId
  // @access  Private
  async getIncidentDetails(req, res, next) {
    try {
      const { incidentId } = req.params;

      const incident = await radarService.getIncidentDetails(incidentId, req.user.id);

      res.status(200).json({
        success: true,
        data: incident
      });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Resolve incident (victim only)
  // @route   PUT /api/radar/:incidentId/resolve
  // @access  Private
  async resolveIncident(req, res, next) {
    try {
      const { incidentId } = req.params;

      // Check if user is the victim of this incident
      const incident = await radarService.getIncidentDetails(incidentId, req.user.id);

      if (incident.victimId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Only the victim can resolve this incident'
        });
      }

      const resolvedIncident = await radarService.resolveIncident(incidentId);

      res.status(200).json({
        success: true,
        data: {
          message: 'Incident resolved successfully',
          incident: resolvedIncident
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RadarController();