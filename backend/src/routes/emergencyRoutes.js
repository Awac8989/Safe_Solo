const express = require('express');
const emergencyController = require('../controllers/emergencyController');
const radarController = require('../controllers/radarController');
const auth = require('../middleware/auth');

const router = express.Router();

// Public inbound SMS gateway webhook
router.post('/sms-inbound-relay', emergencyController.smsInboundRelay);
router.post('/:id/news2-triage', emergencyController.applyNews2Triage);
router.post('/:id/mci-declare', emergencyController.declareMci);
router.post('/:id/start-triage', emergencyController.applyStartTriage);
router.post('/:id/hypothermia-care', emergencyController.recordHypothermiaShock);

router.use((req, _res, next) => {
  if (!req.headers['x-user-id']) {
    const uid = (req.body && req.body.userId) || (req.query && req.query.userId);
    if (uid) {
      req.headers['x-user-id'] = String(uid);
    }
  }
  next();
});
router.use(auth);

router.post('/silent-sos', emergencyController.silentSos);
router.post('/evidence/upload', emergencyController.uploadEvidence);


router.post('/:id/oxygen-care', (req, res, next) => emergencyController.recordOxygenCare(req, res, next));
router.post('/:id/anaphylaxis-care', (req, res, next) => emergencyController.recordAnaphylaxisCare(req, res, next));


router.post('/:id/drowning-care', (req, res, next) => emergencyController.recordDrowningCare(req, res, next));
router.post('/:id/secondary-drowning/initiate', (req, res, next) => emergencyController.initiateSecondaryDrowning(req, res, next));
router.post('/:id/secondary-drowning/checkpoint', (req, res, next) => emergencyController.recordSecondaryDrowning(req, res, next));
router.post('/:id/heatstroke-care', (req, res, next) => emergencyController.treatHeatstroke(req, res, next));
router.post('/:id/stroke-fasted', (req, res, next) => emergencyController.evaluateStroke(req, res, next));
router.post('/:id/snakebite-care', (req, res, next) => emergencyController.recordSnakebite(req, res, next));
router.post('/:id/burn-care', (req, res, next) => emergencyController.recordBurnCare(req, res, next));
router.post('/:id/crush-care', (req, res, next) => emergencyController.recordCrushCare(req, res, next));
router.post('/:id/chest-trauma', (req, res, next) => emergencyController.recordChestTrauma(req, res, next));
router.post('/:id/spinal-trauma', (req, res, next) => emergencyController.recordSpinalTrauma(req, res, next));
router.post('/:id/diabetic-emergency', (req, res, next) => emergencyController.recordDiabeticEmergency(req, res, next));
router.post('/:id/choking-fbao', (req, res, next) => emergencyController.recordPediatricChoking(req, res, next));
router.post('/:id/seizure-care', (req, res, next) => emergencyController.recordSeizureCare(req, res, next));
router.post('/:id/electrical-care', (req, res, next) => emergencyController.recordElectricalCare(req, res, next));
router.post('/:id/co-smoke-care', (req, res, next) => emergencyController.recordCoSmokeCare(req, res, next));
router.post('/:id/ocular-trauma', (req, res, next) => emergencyController.recordOcularTraumaCare(req, res, next));
router.post('/:id/amputation-care', (req, res, next) => emergencyController.recordAmputationCare(req, res, next));
router.post('/:id/abdominal-trauma', (req, res, next) => emergencyController.recordAbdominalTraumaCare(req, res, next));
router.post('/:id/toxicology-care', (req, res, next) => emergencyController.recordToxicologyCare(req, res, next));
router.post('/:id/pelvic-trauma', (req, res, next) => emergencyController.recordPelvicTraumaCare(req, res, next));
router.post('/:id/tbi-care', (req, res, next) => emergencyController.recordTbiCare(req, res, next));
router.post('/:id/maternal-care', (req, res, next) => emergencyController.recordMaternalCare(req, res, next));
router.post('/:id/decompression-care', (req, res, next) => emergencyController.recordDecompressionCare(req, res, next));
router.post('/:id/hemorrhagic-shock', (req, res, next) => emergencyController.recordHemorrhagicShockCare(req, res, next));
router.post('/:id/hypothermia-rewarming', (req, res, next) => emergencyController.recordSevereHypothermiaCare(req, res, next));
router.post('/:id/endocrine-crisis', (req, res, next) => emergencyController.recordEndocrineCrisisCare(req, res, next));
router.post('/:id/industrial-gas', (req, res, next) => emergencyController.recordIndustrialGasCare(req, res, next));
router.post('/:id/cardiogenic-shock', (req, res, next) => emergencyController.recordCardiogenicShockCare(req, res, next));
router.post('/:id/septic-shock', (req, res, next) => emergencyController.recordSepticShockCare(req, res, next));
router.post('/:id/junctional-vascular', (req, res, next) => emergencyController.recordJunctionalVascularCare(req, res, next));
router.post('/:id/hyperthermia-serotonin', (req, res, next) => emergencyController.recordHyperthermiaSerotoninCare(req, res, next));
router.post('/:id/ecpr-arrest', (req, res, next) => emergencyController.recordEcprCare(req, res, next));
router.post('/:id/thoracolumbar-trauma', (req, res, next) => emergencyController.recordThoracolumbarCare(req, res, next));
router.post('/:id/high-altitude', (req, res, next) => emergencyController.recordHighAltitudeCare(req, res, next));
router.post('/:id/cryogenic-frostbite', (req, res, next) => emergencyController.recordCryogenicFrostbiteCare(req, res, next));
router.post('/:id/necrotizing-fasciitis', (req, res, next) => emergencyController.recordNecrotizingFasciitisCare(req, res, next));
router.post('/:id/retrobulbar-hematoma', (req, res, next) => emergencyController.recordRetrobulbarHematomaCare(req, res, next));
router.post('/:id/last-lipid-rescue', (req, res, next) => emergencyController.recordLastToxicityLipidCare(req, res, next));
router.post('/:id/massive-pulmonary-embolism', (req, res, next) => emergencyController.recordMassivePulmonaryEmbolismCare(req, res, next));
router.post('/:id/esophageal-rupture', (req, res, next) => emergencyController.recordEsophagealRuptureCare(req, res, next));
router.post('/:id/bladder-urethral-trauma', (req, res, next) => emergencyController.recordBladderUrethralTraumaCare(req, res, next));
router.post('/:id/subarachnoid-hemorrhage', (req, res, next) => emergencyController.recordSubarachnoidHemorrhageCare(req, res, next));
router.post('/:id/penetrating-cardiac-trauma', (req, res, next) => emergencyController.recordPenetratingCardiacTraumaCare(req, res, next));
router.post('/:id/cauda-equina-syndrome', (req, res, next) => emergencyController.recordCaudaEquinaSyndromeCare(req, res, next));
router.post('/:id/fat-air-embolism', (req, res, next) => emergencyController.recordFatAndAirEmbolismCare(req, res, next));
router.post('/:id/hypertensive-emergency', (req, res, next) => emergencyController.recordHypertensiveEmergencyCare(req, res, next));
router.post('/:id/pheochromocytoma-crisis', (req, res, next) => emergencyController.recordPheochromocytomaCrisisCare(req, res, next));
router.post('/:id/intracerebral-hemorrhage', (req, res, next) => emergencyController.recordIntracerebralHemorrhageCare(req, res, next));
router.post('/:id/acute-aortic-dissection', (req, res, next) => emergencyController.recordAcuteAorticDissectionCare(req, res, next));
router.post('/:id/hyperosmolar-hyperglycemic-state', (req, res, next) => emergencyController.recordHyperosmolarHyperglycemicStateCare(req, res, next));
router.post('/:id/acute-severe-asthma', (req, res, next) => emergencyController.recordAcuteSevereAsthmaCare(req, res, next));
router.post('/:id/acute-limb-ischemia', (req, res, next) => emergencyController.recordAcuteLimbIschemiaCare(req, res, next));
router.post('/:id/acute-cholangitis', (req, res, next) => emergencyController.recordAcuteCholangitisCare(req, res, next));
router.post('/:id/tension-pneumopericardium', (req, res, next) => emergencyController.recordTensionPneumopericardiumCare(req, res, next));
router.post('/:id/methanol-toxicity', (req, res, next) => emergencyController.recordAcuteMethanolToxicityCare(req, res, next));
router.post('/:id/abdominal-compartment', (req, res, next) => emergencyController.recordAbdominalCompartmentSyndromeCare(req, res, next));
router.post('/:id/open-globe-injury', (req, res, next) => emergencyController.recordOpenGlobeInjuryCare(req, res, next));
router.post('/:id/doac-bleeding-crisis', (req, res, next) => emergencyController.recordDoacBleedingCrisisCare(req, res, next));
router.post('/:id/blunt-cardiac-rupture', (req, res, next) => emergencyController.recordBluntCardiacRuptureCare(req, res, next));
router.post('/:id/venous-air-embolism', (req, res, next) => emergencyController.recordVenousAirEmbolismCare(req, res, next));
router.post('/:id/esophageal-variceal-bleeding', (req, res, next) => emergencyController.recordEsophagealVaricealBleedingCare(req, res, next));
router.post('/:id/smoke-inhalation-cyanide', (req, res, next) => emergencyController.recordSmokeInhalationCyanideCare(req, res, next));
router.post('/:id/biphasic-anaphylaxis', (req, res, next) => emergencyController.recordBiphasicAnaphylaxisCare(req, res, next));
router.post('/:id/torsades-de-pointes', (req, res, next) => emergencyController.recordTorsadesDePointesCare(req, res, next));
router.post('/:id/massive-hemothorax', (req, res, next) => emergencyController.recordMassiveHemothoraxCare(req, res, next));
router.post('/:id/postpartum-hemorrhage', (req, res, next) => emergencyController.recordPostpartumHemorrhageCare(req, res, next));
router.post('/:id/pediatric-epiglottitis', (req, res, next) => emergencyController.recordPediatricEpiglottitisCare(req, res, next));
router.post('/:id/neurogenic-shock', (req, res, next) => emergencyController.recordNeurogenicShockCare(req, res, next));
router.post('/:id/penetrating-neck-trauma', (req, res, next) => emergencyController.recordPenetratingNeckTraumaCare(req, res, next));
router.post('/:id/delirium-tremens', (req, res, next) => emergencyController.recordDeliriumTremensCare(req, res, next));
router.post('/:id/impaled-thoracic-trauma', (req, res, next) => emergencyController.recordImpaledThoracicTraumaCare(req, res, next));
router.post('/:id/cerebral-malaria', (req, res, next) => emergencyController.recordSevereCerebralMalariaCare(req, res, next));
router.post('/:id/grade-v-renal-trauma', (req, res, next) => emergencyController.recordGradeVRenalAvulsionCare(req, res, next));
router.post('/:id/exertional-heat-stroke', (req, res, next) => emergencyController.recordExertionalHeatStrokeCare(req, res, next));
router.post('/:id/severe-chemical-burns', (req, res, next) => emergencyController.recordSevereChemicalBurnsCare(req, res, next));
router.post('/:id/grade-v-hepatic-trauma', (req, res, next) => emergencyController.recordGradeVHepaticTraumaCare(req, res, next));
router.post('/:id/grade-v-splenic-rupture', (req, res, next) => emergencyController.recordGradeVSplenicRuptureCare(req, res, next));
router.post('/:id/aluminium-phosphide-poisoning', (req, res, next) => emergencyController.recordAluminiumPhosphidePoisoningCare(req, res, next));
router.post('/:id/open-sucking-chest-wound', (req, res, next) => emergencyController.recordOpenSuckingChestWoundCare(req, res, next));
router.post('/:id/myasthenic-crisis', (req, res, next) => emergencyController.recordMyasthenicCrisisCare(req, res, next));
router.post('/:id/gastric-variceal-bleeding', (req, res, next) => emergencyController.recordGastricVaricealBleedingCare(req, res, next));
router.post('/:id/tracheobronchial-rupture', (req, res, next) => emergencyController.recordTracheobronchialRuptureCare(req, res, next));
router.post('/:id/tca-toxicity', (req, res, next) => emergencyController.recordTcaToxicityCare(req, res, next));
router.post('/:id/amniotic-fluid-embolism', (req, res, next) => emergencyController.recordAmnioticFluidEmbolismCare(req, res, next));
router.post('/:id/meconium-aspiration', (req, res, next) => emergencyController.recordMeconiumAspirationCare(req, res, next));
router.post('/:id/methemoglobinemia', (req, res, next) => emergencyController.recordMethemoglobinemiaCare(req, res, next));
router.post('/:id/visceral-aneurysm', (req, res, next) => emergencyController.recordVisceralAneurysmCare(req, res, next));
router.post('/:id/acute-hypocalcemia', (req, res, next) => emergencyController.recordAcuteHypocalcemiaCare(req, res, next));
router.post('/:id/contrast-anaphylaxis', (req, res, next) => emergencyController.recordContrastAnaphylaxisCare(req, res, next));
router.post('/:id/pelvic-fracture', (req, res, next) => emergencyController.recordPelvicFractureCare(req, res, next));
router.post('/:id/cholinesterase-inhibitor', (req, res, next) => emergencyController.recordCholinesteraseInhibitorToxicityCare(req, res, next));
router.post('/:id/hypothermic-cardiac-arrest', (req, res, next) => emergencyController.recordHypothermicCardiacArrestCare(req, res, next));

// Incident detail & resolve compatibility endpoints for Mobile client (/api/emergencies/:id)
router.get('/:incidentId', radarController.getIncidentDetails);
router.post('/:incidentId/resolve', radarController.resolveIncident);

module.exports = router;
