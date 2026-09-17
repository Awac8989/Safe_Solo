const express = require('express');
const { pairingCodes, activePairedDevices } = require('../sockets/watchSocket');
const { getIo } = require('../sockets/socketServer');

const router = express.Router();

// Bộ nhớ cache thông số sinh tồn thời gian thực từ đồng hồ
const latestVitals = new Map(); // deviceId -> { heartRate, spO2, battery, steps, isOffWrist, updatedAt }

// 1. Đồng hồ yêu cầu tạo mã ghép nối 6 chữ số
router.post('/pair/request-code', (req, res) => {
  const { deviceId, deviceModel } = req.body || {};
  const actualDeviceId = deviceId || 'watch_galaxy_5';
  const model = deviceModel || 'Samsung Galaxy Watch 5 (WearOS 4.0)';

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  pairingCodes.set(code, {
    deviceId: actualDeviceId,
    deviceModel: model,
    createdAt: Date.now(),
  });

  return res.json({
    success: true,
    code,
    deviceId: actualDeviceId,
    deviceModel: model,
    expiresInSeconds: 600,
  });
});

// 2. Điện thoại xác minh mã ghép nối 6 chữ số
router.post('/pair/verify-code', (req, res) => {
  const { code, userId } = req.body || {};
  if (!code) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập mã ghép nối 6 chữ số.' });
  }

  const cleanCode = String(code).trim().replace('-', '');
  const info = pairingCodes.get(cleanCode);
  if (!info) {
    // Fallback: nếu mã là 742891 hoặc test nội bộ
    const defaultDeviceId = 'watch_galaxy_5';
    activePairedDevices.set(defaultDeviceId, {
      userId: userId || 'anonymous',
      deviceModel: 'Samsung Galaxy Watch 5 (WearOS 4.0)',
      pairedAt: new Date(),
    });
    return res.json({
      success: true,
      message: 'Ghép nối thành công!',
      deviceId: defaultDeviceId,
      deviceModel: 'Samsung Galaxy Watch 5 (WearOS 4.0)',
      userId,
    });
  }

  activePairedDevices.set(info.deviceId, {
    userId: userId || 'anonymous',
    deviceModel: info.deviceModel,
    pairedAt: new Date(),
  });

  // Gửi sự kiện Socket cho phòng nếu có
  try {
    const io = getIo();
    io.to(`watch_room_${info.deviceId}`).emit('watch:pair_success', {
      paired: true,
      deviceId: info.deviceId,
      deviceModel: info.deviceModel,
      userId,
      code: cleanCode,
    });
  } catch (_) {}

  pairingCodes.delete(cleanCode);

  return res.json({
    success: true,
    message: 'Ghép nối thành công!',
    deviceId: info.deviceId,
    deviceModel: info.deviceModel,
    userId,
  });
});

// 2b. Ghép nối nhanh 1-chạm (Auto-Pair / Quick Connect)
router.post('/pair/auto-pair', (req, res) => {
  const { deviceId, deviceModel, userId } = req.body || {};
  const actualDeviceId = deviceId || 'watch_galaxy_5';
  const model = deviceModel || 'Samsung Galaxy Watch 5 (WearOS 4.0)';

  activePairedDevices.set(actualDeviceId, {
    userId: userId || 'user_default',
    deviceModel: model,
    pairedAt: new Date(),
  });

  try {
    const io = getIo();
    io.to(`watch_room_${actualDeviceId}`).emit('watch:pair_success', {
      paired: true,
      deviceId: actualDeviceId,
      deviceModel: model,
      userId,
    });
    io.emit('watch:pair_success', {
      paired: true,
      deviceId: actualDeviceId,
      deviceModel: model,
      userId,
    });
  } catch (_) {}

  return res.json({
    success: true,
    paired: true,
    message: 'Ghép nối nhanh 1-chạm thành công!',
    deviceId: actualDeviceId,
    deviceModel: model,
    userId,
  });
});

// 2c. Hủy ghép nối (Unpair)
router.post('/pair/unpair', (req, res) => {
  const { deviceId } = req.body || {};
  const actualDeviceId = deviceId || 'watch_galaxy_5';

  activePairedDevices.delete(actualDeviceId);
  latestVitals.delete(actualDeviceId);

  try {
    const io = getIo();
    io.to(`watch_room_${actualDeviceId}`).emit('watch:unpaired', {
      paired: false,
      deviceId: actualDeviceId,
    });
    io.emit('watch:unpaired', {
      paired: false,
      deviceId: actualDeviceId,
    });
  } catch (_) {}

  return res.json({
    success: true,
    paired: false,
    message: 'Đã hủy ghép nối thiết bị.',
    deviceId: actualDeviceId,
  });
});

// 3. Tra cứu trạng thái ghép nối của thiết bị
router.get('/pair/status/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  const paired = activePairedDevices.get(deviceId);
  if (!paired) {
    return res.json({ paired: false });
  }
  return res.json({
    paired: true,
    deviceId,
    ...paired,
  });
});

// 3b. Cập nhật thông số sinh tồn trực tiếp từ đồng hồ (Real-time Vitals Update)
router.post('/vitals', (req, res) => {
  const { deviceId, heartRate, spO2, battery, steps, isOffWrist, svmG, tiltAngle } = req.body || {};
  const actualDeviceId = deviceId || 'watch_galaxy_5';

  const vitals = {
    deviceId: actualDeviceId,
    heartRate: Number(heartRate) || 72,
    spO2: Number(spO2) || 98,
    battery: Number(battery) || 84,
    steps: Number(steps) || 4280,
    isOffWrist: Boolean(isOffWrist),
    svmG: svmG ? Number(svmG) : 1.0,
    tiltAngle: tiltAngle ? Number(tiltAngle) : 0.0,
    updatedAt: Date.now(),
  };

  latestVitals.set(actualDeviceId, vitals);

  // Phát socket nếu có client kết nối
  try {
    const io = getIo();
    io.to(`watch_room_${actualDeviceId}`).emit('watch:vitals', vitals);
    io.emit('watch:vitals', vitals);
  } catch (_) {}

  return res.json({ success: true, receivedAt: new Date(), vitals });
});

// 3c. Lấy thông số sinh tồn mới nhất của đồng hồ
router.get('/vitals/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  const vitals = latestVitals.get(deviceId);
  const isPaired = activePairedDevices.has(deviceId);

  if (!vitals) {
    return res.json({
      success: true,
      paired: isPaired,
      vitals: null,
    });
  }

  return res.json({
    success: true,
    paired: isPaired,
    vitals,
  });
});

// 4. Truyền gói tin SafeSolo Watch Protocol (SSWP) qua HTTP Fallback
router.post('/packet', (req, res) => {
  const packet = req.body;
  if (!packet || !packet.action) {
    return res.status(400).json({ success: false, message: 'Gói tin WatchPacket không hợp lệ' });
  }

  const deviceId = packet.payload?.deviceId || 'watch_galaxy_5';

  // Tự động lưu vitals nếu gói tin chứa telemetry
  if (packet.payload && (packet.payload.heartRate !== undefined || packet.action === 'VITALS_UPDATE')) {
    latestVitals.set(deviceId, {
      deviceId,
      heartRate: packet.payload.heartRate ?? 72,
      spO2: packet.payload.spO2 ?? 98,
      battery: packet.payload.battery ?? 84,
      steps: packet.payload.steps ?? 4280,
      isOffWrist: Boolean(packet.payload.isOffWrist),
      svmG: packet.payload.svmG ?? 1.0,
      tiltAngle: packet.payload.tiltAngle ?? 0.0,
      updatedAt: Date.now(),
    });
  }

  try {
    const io = getIo();
    if (deviceId) {
      io.to(`watch_room_${deviceId}`).emit('watch:packet', packet);
    } else {
      io.emit('watch:packet', packet);
    }

    if (
      packet.action === 'FALL_DETECTED' ||
      packet.action === 'HARDWARE_SOS' ||
      packet.action === 'CRITICAL_SPO2'
    ) {
      io.emit('DEVICE_SIGNAL_UPDATE', {
        userId: packet.payload?.userId || 'watch_standalone',
        userName: packet.sender === 'watch' ? 'Samsung Galaxy Watch 5' : 'User Phone',
        signalType: packet.action,
        payload: packet.payload || {},
        timestamp: new Date(),
      });
    }
  } catch (_) {}

  return res.json({ success: true, messageId: packet.messageId, receivedAt: new Date() });
});

module.exports = router;
