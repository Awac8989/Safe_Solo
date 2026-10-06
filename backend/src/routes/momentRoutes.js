const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const momentController = require('../controllers/momentController');
const { apiKeyAuth } = require('../middleware/apiKeyAuth');

const fs = require('fs');
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'moment-' + uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

router.use(apiKeyAuth);
router.post('/', upload.single('photo'), momentController.createMoment);
router.get('/', momentController.getMoments);

module.exports = router;
