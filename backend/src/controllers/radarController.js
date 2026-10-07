const radarService = require('../services/radarService');

class RadarController {
  // @desc    Broadcast SOS and create rescue incident
  // @route   POST /api/radar/broadcast
  // @access  Private
  async broadcastSOS(req, res, next) {
    try {
      const { incidentType, lat, lng, severity, severityLevel, approxAddress, medicalNotes } = req.body;

      // Validate required fields
      if (!incidentType || typeof lat !== 'number' || typeof lng !== 'number') {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: incidentType, lat, lng',
        });
      }

      // Validate coordinates
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({
          success: false,
          error: 'Invalid coordinates',
        });
      }

      const result = await radarService.broadcastSOS(req.user.id, incidentType, lat, lng, {
        severity,
        severityLevel,
        approxAddress,
        medicalNotes,
      });

      res.status(201).json({
        success: true,
        data: {
          incident: result.incident,
          nearbyVolunteersCount: result.nearbyVolunteers.length,
          message: 'SOS broadcasted successfully. Notifications sent to nearby volunteers.',
        },
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
      const { lat, lng, radiusKm } = req.query;

      // Validate coordinates
      if (!lat || !lng) {
        return res.status(400).json({
          success: false,
          error: 'Missing coordinates: lat, lng required in query params',
        });
      }

      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);
      const radiusNum = radiusKm ? parseFloat(radiusKm) : 4.5;

      if (isNaN(latNum) || isNaN(lngNum)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid coordinates format',
        });
      }

      const incidents = await radarService.getNearbyIncidents(
        latNum,
        lngNum,
        req.user.id,
        radiusNum,
      );

      res.status(200).json({
        success: true,
        data: incidents,
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
          response: result.response,
        },
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
        data: incident,
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

      const incident = await radarService.getIncidentDetails(incidentId, req.user.id);

      if (incident.victimId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Only the victim can resolve this incident',
        });
      }

      const resolvedIncident = await radarService.resolveIncident(incidentId, req.user.id);

      res.status(200).json({
        success: true,
        data: {
          message: 'Incident resolved successfully',
          incident: resolvedIncident,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Update hero telemetry during en-route
  // @route   POST /api/radar/:incidentId/telemetry
  // @access  Private
  async updateTelemetry(req, res, next) {
    try {
      const { incidentId } = req.params;
      const { lat, lng, speedKmh } = req.body;
      const result = await radarService.updateHeroTelemetry(
        incidentId,
        req.user.id,
        Number(lat),
        Number(lng),
        Number(speedKmh || 0),
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Record first aid actions performed on scene
  // @route   POST /api/radar/:incidentId/first-aid
  // @access  Private
  async recordFirstAid(req, res, next) {
    try {
      const { incidentId } = req.params;
      const result = await radarService.recordFirstAidAction(
        incidentId,
        req.user.id,
        req.body,
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Hand off incident to 115 emergency services
  // @route   POST /api/radar/:incidentId/handoff
  // @access  Private
  async handoffToMedical(req, res, next) {
    try {
      const { incidentId } = req.params;
      const result = await radarService.handoffToMedical(
        incidentId,
        req.user.id,
        req.body,
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RadarController();
