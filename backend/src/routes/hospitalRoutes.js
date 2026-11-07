const express = require('express');
const hospitalDispatchController = require('../controllers/hospitalDispatchController');

const router = express.Router();

router.get('/', (req, res, next) => hospitalDispatchController.listHospitals(req, res, next));
router.get('/recommend/:id', (req, res, next) => hospitalDispatchController.recommendHospital(req, res, next));
router.post('/pre-arrival/:id', (req, res, next) => hospitalDispatchController.sendPreArrival(req, res, next));
router.post('/acknowledge/:code', (req, res, next) => hospitalDispatchController.acknowledgePreArrival(req, res, next));
router.post('/antivenom/locate', (req, res, next) => hospitalDispatchController.locateAntivenom(req, res, next));
router.post('/burn-center/locate', (req, res, next) => hospitalDispatchController.locateBurnCenter(req, res, next));
router.post('/thoracic-center/locate', (req, res, next) => hospitalDispatchController.locateThoracicCenter(req, res, next));
router.post('/eye-center/locate', (req, res, next) => hospitalDispatchController.locateEyeCenter(req, res, next));
router.post('/microvascular-center/locate', (req, res, next) => hospitalDispatchController.locateMicrovascularCenter(req, res, next));
router.post('/hyperbaric-center/locate', (req, res, next) => hospitalDispatchController.locateHyperbaricCenter(req, res, next));
router.post('/toxicology-center/locate', (req, res, next) => hospitalDispatchController.locateToxicologyCenter(req, res, next));
router.post('/vascular-center/locate', (req, res, next) => hospitalDispatchController.locateVascularCenter(req, res, next));
router.post('/pelvic-center/locate', (req, res, next) => hospitalDispatchController.locatePelvicCenter(req, res, next));
router.post('/neurosurgery-center/locate', (req, res, next) => hospitalDispatchController.locateNeurosurgeryCenter(req, res, next));
router.post('/obstetric-center/locate', (req, res, next) => hospitalDispatchController.locateObstetricCenter(req, res, next));
router.post('/recompression-center/locate', (req, res, next) => hospitalDispatchController.locateRecompressionCenter(req, res, next));
router.post('/transfusion-center/locate', (req, res, next) => hospitalDispatchController.locateTransfusionCenter(req, res, next));
router.post('/hypothermia-center/locate', (req, res, next) => hospitalDispatchController.locateHypothermiaCenter(req, res, next));
router.post('/endocrine-center/locate', (req, res, next) => hospitalDispatchController.locateEndocrineCenter(req, res, next));
router.post('/industrial-toxicology-center/locate', (req, res, next) => hospitalDispatchController.locateIndustrialToxicologyCenter(req, res, next));
router.post('/cardiogenic-center/locate', (req, res, next) => hospitalDispatchController.locateCardiogenicCenter(req, res, next));
router.post('/sepsis-center/locate', (req, res, next) => hospitalDispatchController.locateSepsisCenter(req, res, next));
router.post('/vascular-intervention-center/locate', (req, res, next) => hospitalDispatchController.locateVascularInterventionCenter(req, res, next));
router.post('/dantrolene-center/locate', (req, res, next) => hospitalDispatchController.locateDantroleneCenter(req, res, next));
router.post('/ecpr-center/locate', (req, res, next) => hospitalDispatchController.locateEcprCenter(req, res, next));
router.post('/spine-center/locate', (req, res, next) => hospitalDispatchController.locateSpineSurgeryCenter(req, res, next));
router.post('/altitude-center/locate', (req, res, next) => hospitalDispatchController.locateAltitudeCenter(req, res, next));
router.post('/cryogenic-center/locate', (req, res, next) => hospitalDispatchController.locateCryogenicCenter(req, res, next));
router.post('/necrotizing-center/locate', (req, res, next) => hospitalDispatchController.locateNecrotizingCenter(req, res, next));
router.post('/orbital-center/locate', (req, res, next) => hospitalDispatchController.locateOrbitalCenter(req, res, next));
router.post('/lipid-rescue-center/locate', (req, res, next) => hospitalDispatchController.locateLipidRescueCenter(req, res, next));
router.post('/pulmonary-embolism-center/locate', (req, res, next) => hospitalDispatchController.locatePulmonaryEmbolismCenter(req, res, next));
router.post('/esophageal-center/locate', (req, res, next) => hospitalDispatchController.locateEsophagealCenter(req, res, next));
router.post('/urology-center/locate', (req, res, next) => hospitalDispatchController.locateUrologyCenter(req, res, next));

module.exports = router;

