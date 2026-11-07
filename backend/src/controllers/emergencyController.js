const emergencyService = require('../services/emergencyService');

class EmergencyController {
  async silentSos(req, res, next) {
    try {
      res.status(200).json({ success: true, message: 'Alarm disabled' });

      setImmediate(async () => {
        try {
          await emergencyService.createSilentSosIncident(req.user.id);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Silent SOS background failure:', error.message);
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async uploadEvidence(req, res, next) {
    try {
      const result = await emergencyService.saveEmergencyEvidence(req.user.id, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async smsInboundRelay(req, res, next) {
    try {
      const { senderPhone, smsBody } = req.body;
      const result = await emergencyService.processSmsInboundRelay(senderPhone, smsBody);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async applyNews2Triage(req, res, next) {
    try {
      const { id } = req.params;
      const result = await emergencyService.applyNews2ClinicalTriage(id, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async declareMci(req, res, next) {
    try {
      const { id } = req.params;
      const result = await emergencyService.declareMassCasualtyIncident(id, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async applyStartTriage(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.applyStartTriageTag(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordHypothermiaShock(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.recordHypothermiaShockCare(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordOxygenCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.recordRespiratoryOxygenCare(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordAnaphylaxisCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.recordAnaphylaxisEpiPenCare(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordDrowningCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.recordDrowningRescueCare(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async initiateSecondaryDrowning(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.initiateSecondaryDrowningWatchdog(id, heroId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordSecondaryDrowning(req, res, next) {
    try {
      const { id } = req.params;
      const result = await emergencyService.recordSecondaryDrowningCheckpoint(id, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async treatHeatstroke(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.triageAndTreatHeatstroke(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async evaluateStroke(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.evaluateFastEdStroke(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordSnakebite(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.recordSnakebiteAssessmentAndTriage(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordBurnCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.triageAndManageBurnInjury(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordCrushCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageCrushSyndromeExtrication(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordChestTrauma(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageTensionPneumothoraxAndChestTrauma(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordSpinalTrauma(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageSpinalMotionRestrictionAndNeurogenicShock(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordDiabeticEmergency(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.triageAndManageDiabeticEmergency(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordPediatricChoking(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.managePediatricChokingAndFbao(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordSeizureCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageSeizureAndStatusEpilepticus(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordElectricalCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageElectricalInjuryAndSceneSafety(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordCoSmokeCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageCoAndSmokeInhalation(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordOcularTraumaCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageOcularTraumaAndChemicalBurns(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordAmputationCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageAmputationAndPartPreservation(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordAbdominalTraumaCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageAbdominalTraumaAndEvisceration(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordToxicologyCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageOrganophosphatePoisoning(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordPelvicTraumaCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.managePelvicFractureAndBinderHemostasis(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordTbiCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageTraumaticBrainInjuryAndHerniation(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordMaternalCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageMaternalResuscitationAndTrauma(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordDecompressionCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageDecompressionSicknessAndCaisson(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordHemorrhagicShockCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageHemorrhagicShockAndTxaProtocol(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordSevereHypothermiaCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageSevereHypothermiaAndRewarming(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordEndocrineCrisisCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageEndocrineCrisesThyroidStorm(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordIndustrialGasCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageIndustrialGasPoisoning(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordCardiogenicShockCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageCardiogenicShockAndPulmonaryEdema(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordSepticShockCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageSepticShockAndSepsisHour1Bundle(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordJunctionalVascularCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageJunctionalVascularTrauma(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordHyperthermiaSerotoninCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageHyperthermiaAndSerotoninSyndrome(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordEcprCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageEcprRefractoryCardiacArrest(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordThoracolumbarCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageThoracolumbarSpineTrauma(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordHighAltitudeCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageHighAltitudeCerebralAndPulmonaryEdema(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordCryogenicFrostbiteCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageCryogenicFrostbiteInjury(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordNecrotizingFasciitisCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageNecrotizingFasciitisAndTss(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordRetrobulbarHematomaCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageRetrobulbarHematomaAndCanthotomy(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordLastToxicityLipidCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageLastToxicityAndLipidRescue(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordMassivePulmonaryEmbolismCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageMassivePulmonaryEmbolismAndAfe(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordEsophagealRuptureCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageEsophagealRuptureAndMediastinitis(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordBladderUrethralTraumaCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageBladderAndUrethralTrauma(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordSubarachnoidHemorrhageCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageSubarachnoidHemorrhage(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordPenetratingCardiacTraumaCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.managePenetratingCardiacTrauma(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordCaudaEquinaSyndromeCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageCaudaEquinaSyndrome(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordFatAndAirEmbolismCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageFatAndAirEmbolism(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordHypertensiveEmergencyCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageHypertensiveEmergency(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordPheochromocytomaCrisisCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.managePheochromocytomaCrisis(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordIntracerebralHemorrhageCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageIntracerebralHemorrhage(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordAcuteAorticDissectionCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageAcuteAorticDissection(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordHyperosmolarHyperglycemicStateCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageHyperosmolarHyperglycemicState(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordAcuteSevereAsthmaCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageAcuteSevereAsthma(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordAcuteLimbIschemiaCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageAcuteLimbIschemia(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordAcuteCholangitisCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageAcuteCholangitis(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordTensionPneumopericardiumCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageTensionPneumopericardium(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordAcuteMethanolToxicityCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageAcuteMethanolToxicity(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordAbdominalCompartmentSyndromeCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageAbdominalCompartmentSyndrome(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordOpenGlobeInjuryCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageOpenGlobeInjury(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordDoacBleedingCrisisCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageDoacBleedingCrisis(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordBluntCardiacRuptureCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageBluntCardiacRupture(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordVenousAirEmbolismCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageVenousAirEmbolism(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordEsophagealVaricealBleedingCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageEsophagealVaricealBleeding(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordSmokeInhalationCyanideCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageSmokeInhalationCyanide(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordBiphasicAnaphylaxisCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageBiphasicAnaphylaxis(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordTorsadesDePointesCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageTorsadesDePointes(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordMassiveHemothoraxCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageMassiveHemothorax(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordPostpartumHemorrhageCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.managePostpartumHemorrhage(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordMassivePulmonaryEmbolismCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageMassivePulmonaryEmbolism(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordPediatricEpiglottitisCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.managePediatricEpiglottitis(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordNeurogenicShockCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageNeurogenicShock(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordPenetratingNeckTraumaCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.managePenetratingNeckTrauma(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordDeliriumTremensCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageDeliriumTremens(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordImpaledThoracicTraumaCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageImpaledThoracicTrauma(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordSevereCerebralMalariaCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageSevereCerebralMalaria(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordGradeVRenalAvulsionCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageGradeVRenalAvulsion(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordExertionalHeatStrokeCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageExertionalHeatStroke(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordSevereChemicalBurnsCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageSevereChemicalBurns(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordGradeVHepaticTraumaCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageGradeVHepaticTrauma(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordGradeVSplenicRuptureCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageGradeVSplenicRupture(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordAluminiumPhosphidePoisoningCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageAluminiumPhosphidePoisoning(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordOpenSuckingChestWoundCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageOpenSuckingChestWound(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordMyasthenicCrisisCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageMyasthenicCrisis(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordGastricVaricealBleedingCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageGastricVaricealBleeding(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordTracheobronchialRuptureCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageTracheobronchialRupture(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordTcaToxicityCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageTcaToxicity(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordAmnioticFluidEmbolismCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageAmnioticFluidEmbolism(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordMeconiumAspirationCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageMeconiumAspiration(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordMethemoglobinemiaCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageMethemoglobinemia(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordVisceralAneurysmCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageVisceralAneurysm(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordAcuteHypocalcemiaCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageAcuteHypocalcemia(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordContrastAnaphylaxisCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageContrastAnaphylaxis(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordPelvicFractureCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.managePelvicFracture(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordCholinesteraseInhibitorToxicityCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageCholinesteraseInhibitorToxicity(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordHypothermicCardiacArrestCare(req, res, next) {
    try {
      const { id } = req.params;
      const heroId = req.user?.id || req.body.heroId || 'HERO_ON_SCENE';
      const result = await emergencyService.manageHypothermicCardiacArrest(id, heroId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new EmergencyController();
