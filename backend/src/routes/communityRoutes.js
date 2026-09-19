const express = require('express');
const communityController = require('../controllers/communityController');
const { validate, communitySchemas } = require('../middleware/validation');
const auth = require('../middleware/auth');

const hazardService = require('../services/hazardService');

const router = express.Router();
router.use((req, res, next) => {
  // Allow public emergency and hazard endpoints to be accessible without auth
  if (req.path.startsWith('/disaster-alerts') || req.path.startsWith('/hazards')) {
    return next();
  }
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return auth(req, res, next);
  }
  const userId = req.headers['x-user-id'] || req.query.userId;
  if (userId) {
    req.user = { id: userId };
    return next();
  }
  return auth(req, res, next);
});

router.get('/heroes', communityController.listHeroes);
router.get('/heroes/:id', communityController.getHeroProfile);
router.post('/heroes/:id/thank-you', validate(communitySchemas.thankYou), communityController.postThankYou);

// Disaster Alerts (Admin Broadcasts: Flooding, Landslides, Emergencies)
router.get('/disaster-alerts/active', async (req, res, next) => {
  try {
    const list = await hazardService.listActiveDisasterAlerts(req.query);
    res.json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
});

// Hazard Bulletin
router.get('/hazards', async (req, res, next) => {
  try {
    const list = await hazardService.listHazards(req.query);
    res.json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
});

router.post('/hazards', async (req, res, next) => {
  try {
    const report = await hazardService.createHazard(req.user.id, req.body);
    res.status(201).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const accidentUploadDir = path.join(__dirname, '../../uploads/accidents');
if (!fs.existsSync(accidentUploadDir)) {
  fs.mkdirSync(accidentUploadDir, { recursive: true });
}

const accidentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, accidentUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'accident-timemark-' + Date.now() + '-' + Math.round(Math.random() * 1e6) + ext);
  },
});
const accidentUpload = multer({
  storage: accidentStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post('/hazards/accident-report', accidentUpload.single('timemark_photo'), async (req, res, next) => {
  try {
    const file = req.file;
    const body = req.body || {};
    let timemarkMeta = null;
    if (body.timemarkMeta) {
      try {
        timemarkMeta = typeof body.timemarkMeta === 'string' ? JSON.parse(body.timemarkMeta) : body.timemarkMeta;
      } catch (_) {}
    }

    const latVal = body.lat !== undefined && body.lat !== '' && !isNaN(Number(body.lat)) ? Number(body.lat) : 0;
    const lngVal = body.lng !== undefined && body.lng !== '' && !isNaN(Number(body.lng)) ? Number(body.lng) : 0;

    const payload = {
      title: body.title || 'Báo cáo tai nạn / cấp cứu hiện trường',
      description: body.description || body.notes || 'Có ca tai nạn / người cần cấp cứu khẩn cấp.',
      category: body.category || 'ACCIDENT',
      lat: latVal,
      lng: lngVal,
      address: body.address || 'Hiện trường tai nạn',
      isAnonymous: body.isAnonymous === 'true' || body.isAnonymous === true,
      severity: body.severity || 'P1_CRITICAL',
      victimCount: body.victimCount || '1 người',
      victimCondition: body.victimCondition || 'Cần hỗ trợ khẩn cấp',
      reportedByPhone: body.reportedByPhone || '',
      timemarkPhotoUrl: file ? `/uploads/accidents/${file.filename}` : (body.imageUrl || ''),
      timemarkMeta: timemarkMeta || {
        timestamp: new Date().toISOString(),
        lat: latVal,
        lng: lngVal,
        address: body.address || 'Hiện trường tai nạn',
      },
    };

    const report = await hazardService.createHazard(req.user?.id || 'anonymous-reporter', payload);

    // Bắn socket realtime đến WebAdmin
    const { getIo } = require('../sockets/socketServer');
    const io = getIo();
    if (io) {
      io.emit('admin:accident_reported', {
        accident: report.toObject ? report.toObject() : report,
      });
      io.emit('community:hazard_created', {
        hazard: report.toObject ? report.toObject() : report,
      });
    }

    res.status(201).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

router.post('/hazards/:id/verify', async (req, res, next) => {
  try {
    const report = await hazardService.verifyHazard(req.params.id, req.user.id, req.body.action);
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

// Safe Moments Story
router.get('/moments', async (req, res, next) => {
  try {
    const moments = await hazardService.listSafeMoments(req.user.id);
    res.json({ success: true, data: moments });
  } catch (err) {
    next(err);
  }
});

router.post('/moments', async (req, res, next) => {
  try {
    const moment = await hazardService.createSafeMoment(req.user.id, req.body);
    res.status(201).json({ success: true, data: moment });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
