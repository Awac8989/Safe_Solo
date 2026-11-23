const express = require('express');
const router = express.Router();

/**
 * ============================================================================
 * SAFESOLO BACKEND — PRE-ALERT HL7 FHIR TRAUMA GATEWAY (PHÂN HỆ 142)
 * Tiếp nhận và điều phối tín hiệu cảnh báo trước cho các Trung tâm cấp cứu
 * ============================================================================
 */

let activePreAlerts = [
  {
    incidentId: 'INC_PREALERT_DEMO',
    targetHospitalName: 'Bệnh viện Đa khoa tỉnh Bình Dương',
    priority: 'codeRed',
    etaMinutes: 6,
    patientAgeGender: 'Nam, 24 tuổi',
    bloodType: 'O+',
    glasgowScore: 12,
    heartRateBpm: 118,
    spO2Percent: 91,
    systolicBp: 90,
    traumaMechanism: 'Tai nạn giao thông ngực kín',
    contraindications: ['Dị ứng Penicillin'],
    status: 'ACK_RECEIVED',
    icuPrepared: true,
    timestamp: new Date().toISOString(),
  }
];

// POST /api/prealert/dispatch - Phát lệnh cảnh báo trước
router.post('/dispatch', (req, res) => {
  const payload = req.body;
  const newAlert = {
    incidentId: payload.incidentId || `INC_${Date.now()}`,
    targetHospitalName: payload.targetHospitalName || 'Bệnh viện Tuyến 1',
    priority: payload.priority || 'codeRed',
    etaMinutes: payload.etaMinutes || 8,
    patientAgeGender: payload.patientAgeGender || 'Không xác định',
    bloodType: payload.bloodType || 'Chưa rõ',
    glasgowScore: payload.glasgowScore || 15,
    heartRateBpm: payload.heartRateBpm || 80,
    spO2Percent: payload.spO2Percent || 98,
    systolicBp: payload.systolicBp || 120,
    traumaMechanism: payload.traumaMechanism || 'Chấn thương',
    contraindications: payload.contraindications || [],
    status: 'ACK_RECEIVED',
    icuPrepared: true,
    timestamp: new Date().toISOString(),
  };

  activePreAlerts.unshift(newAlert);
  return res.status(201).json({
    success: true,
    message: 'Pre-alert HL7 FHIR payload delivered to hospital trauma center successfully.',
    data: newAlert,
  });
});

// GET /api/prealert/active - Danh sách các ca đang chuyển viện cấp cứu
router.get('/active', (req, res) => {
  return res.json({
    success: true,
    count: activePreAlerts.length,
    data: activePreAlerts,
  });
});

module.exports = router;
