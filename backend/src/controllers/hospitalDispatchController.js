const hospitalDispatchService = require('../services/hospitalDispatchService');
const HospitalTraumaCenter = require('../models/HospitalTraumaCenter');

class HospitalDispatchController {
  async listHospitals(req, res, next) {
    try {
      await hospitalDispatchService.seedTraumaHospitals();
      const list = await HospitalTraumaCenter.find().sort({ 'emergencyDepartmentStatus.availableIcuBeds': -1 });
      res.json({ success: true, count: list.length, data: list });
    } catch (err) {
      next(err);
    }
  }

  async recommendHospital(req, res, next) {
    try {
      const condition = req.query.condition || req.body?.condition || 'POLYTRAUMA';
      const result = await hospitalDispatchService.recommendDestinationHospital(req.params.id, condition);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async sendPreArrival(req, res, next) {
    try {
      const { hospitalCode, etaMinutes = 10, chiefComplaint } = req.body;
      const result = await hospitalDispatchService.dispatchPreArrivalNotification(
        req.params.id,
        hospitalCode,
        etaMinutes,
        chiefComplaint,
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async acknowledgePreArrival(req, res, next) {
    try {
      const { incidentId, doctorName, bayNumber } = req.body;
      const result = await hospitalDispatchService.acknowledgePreArrival(
        req.params.code,
        incidentId,
        doctorName,
        bayNumber,
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locateAntivenom(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009, antivenomType = 'POLYVALENT' } = req.body;
      const result = await hospitalDispatchService.findNearestAntivenomHospital(lat, lng, antivenomType);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locateBurnCenter(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009 } = req.body;
      const result = await hospitalDispatchService.findNearestBurnCenter(lat, lng);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locateThoracicCenter(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009 } = req.body;
      const result = await hospitalDispatchService.findNearestThoracicHospital(lat, lng);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locateEyeCenter(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009 } = req.body;
      const result = await hospitalDispatchService.findNearestEyeHospital(lat, lng);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locateMicrovascularCenter(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009 } = req.body;
      const result = await hospitalDispatchService.findNearestMicrovascularHospital(lat, lng);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locateHyperbaricCenter(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009 } = req.body;
      const result = await hospitalDispatchService.findNearestHyperbaricCenter(lat, lng);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locateToxicologyCenter(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009 } = req.body;
      const result = await hospitalDispatchService.findNearestToxicologyCenter(lat, lng);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locateVascularCenter(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009 } = req.body;
      const result = await hospitalDispatchService.findNearestVascularSurgeryCenter(lat, lng);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locatePelvicCenter(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009 } = req.body;
      const result = await hospitalDispatchService.findNearestPelvicTraumaCenter(lat, lng);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locateNeurosurgeryCenter(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009 } = req.body;
      const result = await hospitalDispatchService.findNearestNeurosurgeryCenter(lat, lng);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locateObstetricCenter(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009 } = req.body;
      const result = await hospitalDispatchService.findNearestObstetricTraumaCenter(lat, lng);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locateRecompressionCenter(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009 } = req.body;
      const result = await hospitalDispatchService.findNearestDecompressionRecompressionCenter(lat, lng);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locateTransfusionCenter(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009 } = req.body;
      const result = await hospitalDispatchService.findNearestMassiveTransfusionCenter(lat, lng);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locateHypothermiaCenter(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009 } = req.body;
      const result = await hospitalDispatchService.findNearestHypothermiaEcmoCenter(lat, lng);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locateEndocrineCenter(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009 } = req.body;
      const result = await hospitalDispatchService.findNearestEndocrinologyIcuCenter(lat, lng);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locateIndustrialToxicologyCenter(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009 } = req.body;
      const result = await hospitalDispatchService.findNearestIndustrialToxicologyCenter(lat, lng);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locateCardiogenicCenter(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009 } = req.body;
      const result = await hospitalDispatchService.findNearestCardiogenicShockCenter(lat, lng);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locateSepsisCenter(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009 } = req.body;
      const result = await hospitalDispatchService.findNearestSepsisIcuCenter(lat, lng);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locateVascularInterventionCenter(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009 } = req.body;
      const result = await hospitalDispatchService.findNearestVascularInterventionCenter(lat, lng);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locateDantroleneCenter(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009 } = req.body;
      const result = await hospitalDispatchService.findNearestDantroleneStockCenter(lat, lng);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locateEcprCenter(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009 } = req.body;
      const result = await hospitalDispatchService.findNearestEcprCenter(lat, lng);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locateSpineSurgeryCenter(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009 } = req.body;
      const result = await hospitalDispatchService.findNearestSpineSurgeryCenter(lat, lng);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locateAltitudeCenter(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009 } = req.body;
      const result = await hospitalDispatchService.findNearestAltitudeHyperbaricCenter(lat, lng);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locateCryogenicCenter(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009 } = req.body;
      const result = await hospitalDispatchService.findNearestCryogenicBurnCenter(lat, lng);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locateNecrotizingCenter(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009 } = req.body;
      const result = await hospitalDispatchService.findNearestNecrotizingFasciitisCenter(lat, lng);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locateOrbitalCenter(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009 } = req.body;
      const result = await hospitalDispatchService.findNearestOrbitalSurgeryCenter(lat, lng);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locateLipidRescueCenter(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009 } = req.body;
      const result = await hospitalDispatchService.findNearestLipidRescueCenter(lat, lng);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locatePulmonaryEmbolismCenter(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009 } = req.body;
      const result = await hospitalDispatchService.findNearestPulmonaryEmbolismCenter(lat, lng);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locateEsophagealCenter(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009 } = req.body;
      const result = await hospitalDispatchService.findNearestEsophagealSurgeryCenter(lat, lng);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async locateUrologyCenter(req, res, next) {
    try {
      const { lat = 10.7769, lng = 106.7009 } = req.body;
      const result = await hospitalDispatchService.findNearestUrologyTraumaCenter(lat, lng);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new HospitalDispatchController();

