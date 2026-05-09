const express = require('express');
const medicalController = require('../controllers/medicalController');
const { validate, medicalSchemas } = require('../middleware/validation');
const auth = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(auth);

router.route('/')
  .post(validate(medicalSchemas.create), medicalController.createMedicalProfile)
  .get(medicalController.getMedicalProfile)
  .put(validate(medicalSchemas.update), medicalController.updateMedicalProfile)
  .delete(medicalController.deleteMedicalProfile);

// Emergency access route (for guardians)
router.get('/emergency/:userId', medicalController.getEmergencyProfile);

module.exports = router;