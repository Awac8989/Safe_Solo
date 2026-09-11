const express = require('express');
const { pairingCodes, activePairedDevices } = require('../sockets/watchSocket');
const { getIo } = require('../sockets/socketServer');

const router = express.Router();

// 1. Đồng hồ yêu cầu tạo mã ghép nối 6 chữ số
router.post('/pair/request-code', (req, res) => {
  const { deviceId, deviceModel } = req.body || {};
  const actualDeviceId = deviceId || `watch_${Date.now().toString().slice(-6)}`;
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
    return res.status(404).json({ success: false, message: 'Mã kết nối không hợp lệ hoặc đã hết hạn.' });
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

// 4. Truyền gói tin SafeSolo Watch Protocol (SSWP) qua HTTP Fallback
router.post('/packet', (req, res) => {
  const packet = req.body;
  if (!packet || !packet.action) {
    return res.status(400).json({ success: false, message: 'Gói tin WatchPacket không hợp lệ' });
  }

  try {
    const io = getIo();
    const deviceId = packet.payload?.deviceId;
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
