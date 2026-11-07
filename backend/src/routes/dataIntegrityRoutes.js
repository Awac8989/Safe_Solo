const express = require('express');
const router = express.Router();
const dataIntegrityController = require('../controllers/dataIntegrityController');

// GET /api/system/integrity/diagnostics - Quét và phát hiện các bất thường CSDL
router.get('/diagnostics', (req, res, next) => dataIntegrityController.getDiagnosticReport(req, res, next));

// POST /api/system/integrity/query - Truy vấn dữ liệu chẩn đoán theo collection hoặc loại bất thường
router.post('/query', (req, res, next) => dataIntegrityController.queryCollectionData(req, res, next));

// POST /api/system/integrity/auto-repair - Tự động sửa chữa, chuẩn hóa và vá lỗi dữ liệu (Self-Healing)
router.post('/auto-repair', (req, res, next) => dataIntegrityController.runAutoRepair(req, res, next));

// GET /api/system/integrity/health-score - Lấy điểm số sức khỏe toàn vẹn CSDL và phân loại
router.get('/health-score', (req, res, next) => dataIntegrityController.getHealthScore(req, res, next));

module.exports = router;

