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
      if (error.statusCode === 404 || error.statusCode === 403) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message,
          shouldStopTelemetry: true,
        });
      }
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

  // @desc    Mark volunteer arrived at the scene
  // @route   POST /api/radar/:incidentId/arrive
  // @access  Private
  async arriveAtScene(req, res, next) {
    try {
      const { incidentId } = req.params;
      const result = await radarService.markVolunteerArrived(
        incidentId,
        req.user.id,
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Trigger proximity sound and flash beacon on victim device (<25m)
  // @route   POST /api/radar/:incidentId/beacon
  // @access  Private
  async triggerBeacon(req, res, next) {
    try {
      const { incidentId } = req.params;
      const result = await radarService.triggerProximityBeacon(
        incidentId,
        req.user.id,
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Assess scene safety & hazards before entering (< 50m)
  // @route   POST /api/radar/:incidentId/scene-safety
  // @access  Private (Assigned Hero)
  async assessSceneSafety(req, res, next) {
    try {
      const { incidentId } = req.params;
      const result = await radarService.assessSceneSafety(
        incidentId,
        req.user.id,
        req.body,
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Trigger or update bystander guidance & CPR audio metronome
  // @route   POST /api/radar/:incidentId/bystander-guidance
  // @access  Private
  async triggerBystanderGuidance(req, res, next) {
    try {
      const { incidentId } = req.params;
      const result = await radarService.triggerBystanderGuidance(
        incidentId,
        req.user.id,
        req.body,
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Get Emergency Access Pass & Micro-address for assigned hero
  // @route   GET /api/radar/:incidentId/emergency-pass
  // @access  Private
  async getEmergencyPass(req, res, next) {
    try {
      const { incidentId } = req.params;
      const incident = await radarService.getIncidentDetails(incidentId, req.user.id);
      res.status(200).json({
        success: true,
        data: {
          incidentId: incident.id,
          emergencyAccessPass: incident.emergencyAccessPass,
          microLocation: incident.microLocation,
          sceneSafety: incident.sceneSafety,
          bystanderGuidance: incident.bystanderGuidance,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Record clinical assessment (AVPU, Tourniquet time-lock, C-Spine, FAST)
  // @route   POST /api/radar/:incidentId/clinical-assessment
  // @access  Private (Assigned Hero)
  async recordClinicalAssessment(req, res, next) {
    try {
      const { incidentId } = req.params;
      const result = await radarService.recordClinicalAssessment(
        incidentId,
        req.user.id,
        req.body,
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Submit After-Action Review (AAR) & CME Credit Award
  // @route   POST /api/radar/:incidentId/aar
  // @access  Private
  async submitAfterActionReview(req, res, next) {
    try {
      const { incidentId } = req.params;
      const result = await radarService.submitAfterActionReview(
        incidentId,
        req.user.id,
        req.body,
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Verify SBAR Handoff QR Code / SHA-256 Hash for 115 Paramedics & Hospital
  // @route   GET /api/radar/sbar-verify/:hash
  // @access  Public
  async verifySbarHandoff(req, res, next) {
    try {
      const { hash } = req.params;
      const result = await radarService.verifySbarHandoff(hash);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Initiate live Tele-FirstAid consultation session with 115 ER doctor
  // @route   POST /api/radar/tele-consult/request
  // @access  Private
  async initiateTeleConsultation(req, res, next) {
    try {
      const { incidentId, reason } = req.body;
      const result = await radarService.initiateTeleConsultation(incidentId, req.user?.id || 'HERO_ON_SCENE', reason);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Doctor connects to Tele-FirstAid live room
  // @route   POST /api/radar/tele-consult/doctor-join
  // @access  Private
  async connectDoctorTeleConsultation(req, res, next) {
    try {
      const { incidentId, doctorProfile } = req.body;
      const result = await radarService.connectDoctorTeleConsultation(incidentId, doctorProfile);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Doctor issues verbal medical order
  // @route   POST /api/radar/tele-consult/issue-order
  // @access  Private
  async issueVerbalMedicalOrder(req, res, next) {
    try {
      const { incidentId, orderData } = req.body;
      const result = await radarService.issueVerbalMedicalOrder(incidentId, orderData);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Hero confirms execution of verbal medical order
  // @route   POST /api/radar/tele-consult/execute-order
  // @access  Private
  async confirmMedicalOrderExecuted(req, res, next) {
    try {
      const { incidentId, orderIndex } = req.body;
      const result = await radarService.confirmMedicalOrderExecuted(incidentId, orderIndex, req.user?.id || 'HERO_ON_SCENE');
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RadarController();
