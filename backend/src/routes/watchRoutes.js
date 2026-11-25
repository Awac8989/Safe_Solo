const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { pairingCodes, activePairedDevices } = require('../sockets/watchSocket');
const { getIo } = require('../sockets/socketServer');
const DeviceSignal = require('../models/DeviceSignal');
const User = require('../models/User');
const SystemLog = require('../models/SystemLog');
const { requireAdminAuth, requireAdminRole } = require('../middleware/adminAuth');

const router = express.Router();

// Bộ nhớ cache thông số sinh tồn thời gian thực từ đồng hồ
const latestVitals = new Map(); // deviceId -> { deviceId, userId, heartRate, spO2, battery, steps, isOffWrist, svmG, tiltAngle, updatedAt }
const telemetryPersistTimestamps = new Map(); // deviceId -> last Mongo persist ms
const recentWatchEvents = []; // Ring buffer of latest 40 telemetry/command/ACK events
const sseClients = new Set(); // Connected Web Admin SSE responses

function pushWatchEventLog(entry) {
  recentWatchEvents.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : `wev_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  });
  if (recentWatchEvents.length > 40) {
    recentWatchEvents.length = 40;
  }
}

function broadcastWatchEvent(eventType, data) {
  const payload = JSON.stringify({ eventType, data, timestamp: new Date().toISOString() });
  for (const res of sseClients) {
    try {
      res.write(`event: watch\ndata: ${payload}\n\n`);
    } catch (_) {
      sseClients.delete(res);
    }
  }
}

function isPlaceholderUserId(rawUserId) {
  const clean = rawUserId ? String(rawUserId).trim() : '';
  return (
    !clean ||
    clean === 'anonymous' ||
    clean === 'user_default' ||
    clean === 'sandbox_user'
  );
}

function resolveUserIdForDevice(deviceId, explicitUserId) {
  const cleanExplicit = explicitUserId ? String(explicitUserId).trim() : '';
  const paired = activePairedDevices.get(deviceId);
  if (!isPlaceholderUserId(cleanExplicit)) {
    return cleanExplicit;
  }
  if (paired?.userId && !isPlaceholderUserId(paired.userId)) {
    return String(paired.userId);
  }
  const existing = latestVitals.get(deviceId);
  if (existing?.userId && !isPlaceholderUserId(existing.userId)) return String(existing.userId);
  return cleanExplicit || (paired?.userId ? String(paired.userId) : null);
}

/**
 * Kiểm tra ràng buộc ghép nối 1-1 độc quyền Watch <-> User:
 * Một Watch đang gắn cho User A thì User B không thể âm thầm ghi đè hay gửi telemetry giả danh.
 */
function checkWatchOwnershipConflict(deviceId, incomingUserId) {
  const paired = activePairedDevices.get(deviceId);
  if (!paired || isPlaceholderUserId(paired.userId) || isPlaceholderUserId(incomingUserId)) {
    return null;
  }
  if (String(paired.userId) !== String(incomingUserId)) {
    return String(paired.userId);
  }
  return null;
}

function unbindUserOtherWatches(userId, keepDeviceId) {
  if (isPlaceholderUserId(userId)) return;
  for (const [dId, meta] of activePairedDevices.entries()) {
    if (dId !== keepDeviceId && String(meta?.userId) === String(userId)) {
      activePairedDevices.delete(dId);
    }
  }
}

async function persistWatchSignalToMongo({
  deviceId,
  userId,
  signalType = 'WATCH_VITALS',
  vitals = {},
  action = 'VITALS_UPDATE',
  force = false,
}) {
  if (!userId || mongoose.connection.readyState !== 1) return;
  const now = Date.now();
  const isAbnormal =
    Number(vitals.spO2 || 98) < 92 ||
    Number(vitals.heartRate || 75) > 125 ||
    Number(vitals.heartRate || 75) < 50 ||
    Boolean(vitals.isOffWrist) ||
    Number(vitals.svmG || 1.0) >= 2.2 ||
    ['FALL_DETECTED', 'ACCIDENT_CRASH', 'FREE_FALL_IMPACT', 'HARDWARE_SOS', 'DURESS_SOS', 'CRITICAL_SPO2', 'PRECISION_MEASURE_RESULT'].includes(action);

  const lastSaved = telemetryPersistTimestamps.get(`${deviceId}:${userId}`) || 0;
  if (!force && !isAbnormal && now - lastSaved < 5000) {
    return;
  }
  telemetryPersistTimestamps.set(`${deviceId}:${userId}`, now);

  try {
    await DeviceSignal.create({
      userId: String(userId),
      signalType,
      payload: {
        device: activePairedDevices.get(deviceId)?.deviceModel || 'Samsung Galaxy Watch 5 (SM-R900)',
        deviceId,
        heartRate: vitals.heartRate,
        spO2: vitals.spO2,
        spo2: vitals.spO2,
        battery: vitals.battery,
        steps: vitals.steps,
        isOffWrist: Boolean(vitals.isOffWrist),
        svmG: vitals.svmG ?? 1.0,
        tiltAngle: vitals.tiltAngle ?? 0.0,
        ...(Array.isArray(vitals.gForceWaveform) ? { gForceWaveform: vitals.gForceWaveform.slice(-32) } : {}),
        ...(Array.isArray(vitals.ppgWaveform) ? { ppgWaveform: vitals.ppgWaveform.slice(-32) } : {}),
        ...(vitals.fusion && typeof vitals.fusion === 'object' ? { fusion: vitals.fusion } : {}),
        action,
        syncTime: 'Watch 5 Real-time Relay',
      },
    });
  } catch (err) {
    console.warn('[WatchRoutes] DeviceSignal persist skipped:', err.message);
  }
}

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

// 2. Điện thoại xác minh mã ghép nối 6 chữ số (Ràng buộc 1-1 Watch <-> User)
router.post('/pair/verify-code', (req, res) => {
  const { code, userId, forceReassign } = req.body || {};
  if (!code) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập mã ghép nối 6 chữ số.' });
  }

  const cleanCode = String(code).trim().replace('-', '');
  const info = pairingCodes.get(cleanCode);
  const targetDeviceId = info ? info.deviceId : 'watch_galaxy_5';
  const targetModel = info ? info.deviceModel : 'Samsung Galaxy Watch 5 (WearOS 4.0)';
  const conflictOwner = checkWatchOwnershipConflict(targetDeviceId, userId);

  if (conflictOwner && !forceReassign) {
    return res.status(409).json({
      success: false,
      code: 'WATCH_ALREADY_PAIRED',
      ownerUserId: conflictOwner,
      message: 'Đồng hồ này đã được ghép nối 1-1 với tài khoản khác. Vui lòng hủy ghép nối cũ trước.',
    });
  }

  const resolvedVerifyUserId = isPlaceholderUserId(userId)
    ? resolveUserIdForDevice(targetDeviceId, userId)
    : String(userId).trim();

  if (!isPlaceholderUserId(resolvedVerifyUserId)) {
    unbindUserOtherWatches(resolvedVerifyUserId, targetDeviceId);
  }

  activePairedDevices.set(targetDeviceId, {
    userId: resolvedVerifyUserId || 'anonymous',
    deviceModel: targetModel,
    pairedAt: new Date(),
    lockMode: 'EXCLUSIVE_1_TO_1',
  });

  if (info) {
    pairingCodes.delete(cleanCode);
  }

  try {
    const io = getIo();
    io.to(`watch_room_${targetDeviceId}`).emit('watch:pair_success', {
      paired: true,
      deviceId: targetDeviceId,
      deviceModel: targetModel,
      userId: resolvedVerifyUserId || userId,
      code: cleanCode,
    });
  } catch (_) {}

  broadcastWatchEvent('WATCH_PAIRED', {
    deviceId: targetDeviceId,
    deviceModel: targetModel,
    userId: resolvedVerifyUserId || userId,
  });
  pushWatchEventLog({
    type: 'PAIR_CONFIRMED',
    sender: 'phone',
    deviceId: targetDeviceId,
    userId: resolvedVerifyUserId || userId,
    note: `Ghép nối 1-1 qua mã OTP ${cleanCode}`,
  });

  return res.json({
    success: true,
    paired: true,
    lockMode: 'EXCLUSIVE_1_TO_1',
    message: 'Ghép nối thành công!',
    deviceId: targetDeviceId,
    deviceModel: targetModel,
    userId: resolvedVerifyUserId || userId,
  });
});

// 2b. Ghép nối nhanh 1-chạm (Auto-Pair / Quick Connect 1-1)
router.post('/pair/auto-pair', (req, res) => {
  const { deviceId, deviceModel, userId, forceReassign } = req.body || {};
  const actualDeviceId = deviceId || 'watch_galaxy_5';
  const model = deviceModel || 'Samsung Galaxy Watch 5 (WearOS 4.0)';

  const conflictOwner = checkWatchOwnershipConflict(actualDeviceId, userId);
  if (conflictOwner && !forceReassign) {
    return res.status(409).json({
      success: false,
      code: 'WATCH_ALREADY_PAIRED',
      ownerUserId: conflictOwner,
      message: 'Đồng hồ đã được ghép nối 1-1 với tài khoản khác. Truyền forceReassign hoặc hủy ghép nối cũ để chuyển quyền.',
    });
  }

  const resolvedUserId = !isPlaceholderUserId(userId)
    ? String(userId).trim()
    : (resolveUserIdForDevice(actualDeviceId, userId) || 'user_default');

  if (!isPlaceholderUserId(resolvedUserId)) {
    unbindUserOtherWatches(resolvedUserId, actualDeviceId);
  }

  activePairedDevices.set(actualDeviceId, {
    userId: resolvedUserId,
    deviceModel: model,
    pairedAt: new Date(),
    lockMode: 'EXCLUSIVE_1_TO_1',
  });

  try {
    const io = getIo();
    io.to(`watch_room_${actualDeviceId}`).emit('watch:pair_success', {
      paired: true,
      deviceId: actualDeviceId,
      deviceModel: model,
      userId: resolvedUserId,
    });
    io.emit('watch:pair_success', {
      paired: true,
      deviceId: actualDeviceId,
      deviceModel: model,
      userId: resolvedUserId,
    });
  } catch (_) {}

  broadcastWatchEvent('WATCH_PAIRED', {
    deviceId: actualDeviceId,
    deviceModel: model,
    userId: resolvedUserId,
  });
  pushWatchEventLog({
    type: 'PAIR_CONFIRMED',
    sender: 'phone',
    deviceId: actualDeviceId,
    userId: resolvedUserId,
    note: `Ghép nối 1-1 nhanh với ${model}`,
  });

  return res.json({
    success: true,
    paired: true,
    lockMode: 'EXCLUSIVE_1_TO_1',
    message: 'Ghép nối nhanh 1-chạm thành công!',
    deviceId: actualDeviceId,
    deviceModel: model,
    userId: resolvedUserId,
  });
});

// 2c. Hủy ghép nối (Unpair - kiểm tra đúng chủ sở hữu)
router.post('/pair/unpair', (req, res) => {
  const { deviceId, userId, force } = req.body || {};
  const actualDeviceId = deviceId || 'watch_galaxy_5';

  const conflictOwner = checkWatchOwnershipConflict(actualDeviceId, userId);
  if (conflictOwner && !force) {
    return res.status(403).json({
      success: false,
      code: 'WATCH_UNPAIR_FORBIDDEN',
      ownerUserId: conflictOwner,
      message: 'Chỉ tài khoản đang sở hữu đồng hồ mới được phép hủy ghép nối.',
    });
  }

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

  broadcastWatchEvent('WATCH_UNPAIRED', { deviceId: actualDeviceId });
  pushWatchEventLog({
    type: 'UNPAIRED',
    sender: 'phone',
    deviceId: actualDeviceId,
    note: 'Đã ngắt ghép nối đồng hồ 1-1',
  });

  return res.json({
    success: true,
    paired: false,
    message: 'Đã hủy ghép nối thiết bị.',
    deviceId: actualDeviceId,
  });
});

// 3. Tra cứu trạng thái ghép nối của thiết bị (kèm tên chủ sở hữu thực tế)
router.get('/pair/status/:deviceId', async (req, res) => {
  const { deviceId } = req.params;
  const paired = activePairedDevices.get(deviceId);
  if (!paired) {
    return res.json({ paired: false });
  }
  let userName = null;
  let userPhone = null;
  if (!isPlaceholderUserId(paired.userId) && mongoose.connection.readyState === 1) {
    try {
      const ownerDoc = await User.findById(paired.userId).select('fullName name phoneNumber').lean();
      if (ownerDoc) {
        userName = ownerDoc.fullName || ownerDoc.name || null;
        userPhone = ownerDoc.phoneNumber || null;
      }
    } catch (_) {}
  }
  return res.json({
    paired: true,
    deviceId,
    userName,
    userPhone,
    ...paired,
  });
});

// 3a. Khám phá thiết bị đồng hồ đang chờ ghép nối OTP
router.get('/pair/discover', (_req, res) => {
  const now = Date.now();
  const candidates = [];
  for (const [code, info] of pairingCodes.entries()) {
    if (now - info.createdAt <= 600000) {
      candidates.push({
        deviceId: info.deviceId,
        deviceModel: info.deviceModel,
        codeHint: `${code.slice(0, 3)}-***`,
        alreadyPaired: activePairedDevices.has(info.deviceId),
      });
    }
  }
  return res.json({ success: true, devices: candidates });
});

function sanitizeWaveformArray(arr, fallbackPrev = [], nextScalar = null, maxLen = 32) {
  if (Array.isArray(arr) && arr.length > 0) {
    return arr.slice(-maxLen).map((n) => Number(n) || 0);
  }
  const base = Array.isArray(fallbackPrev) ? fallbackPrev.slice(-(maxLen - 1)) : [];
  if (nextScalar !== null && nextScalar !== undefined && !Number.isNaN(Number(nextScalar))) {
    base.push(Number(Number(nextScalar).toFixed(3)));
  }
  return base;
}

// 3b. Cập nhật thông số sinh tồn trực tiếp từ đồng hồ (Chống ghi đè sai chủ sở hữu)
router.post('/vitals', async (req, res) => {
  const {
    deviceId,
    userId,
    heartRate,
    spO2,
    battery,
    steps,
    isOffWrist,
    svmG,
    tiltAngle,
    gForceWaveform,
    ppgWaveform,
    fusion,
    forcePersist,
  } = req.body || {};
  const actualDeviceId = deviceId || 'watch_galaxy_5';

  const conflictOwner = checkWatchOwnershipConflict(actualDeviceId, userId);
  if (conflictOwner) {
    return res.status(403).json({
      success: false,
      code: 'WATCH_OWNERSHIP_MISMATCH',
      ownerUserId: conflictOwner,
      message: 'Thiết bị đồng hồ đã gắn độc quyền cho người dùng khác; từ chối ghi đè telemetry.',
    });
  }

  const resolvedUserId = resolveUserIdForDevice(actualDeviceId, userId);
  const prev = latestVitals.get(actualDeviceId) || {};
  const numericHr = Number(heartRate) || 72;
  const numericSvm = svmG !== undefined ? Number(svmG) : 1.0;

  const vitals = {
    deviceId: actualDeviceId,
    userId: resolvedUserId,
    heartRate: numericHr,
    spO2: Number(spO2) || 98,
    battery: Number(battery) || 84,
    steps: Number(steps) || 4280,
    isOffWrist: Boolean(isOffWrist),
    svmG: numericSvm,
    tiltAngle: tiltAngle !== undefined ? Number(tiltAngle) : 0.0,
    gForceWaveform: sanitizeWaveformArray(gForceWaveform, prev.gForceWaveform, numericSvm),
    ppgWaveform: sanitizeWaveformArray(ppgWaveform, prev.ppgWaveform, Number(((numericHr / 100) * 0.65).toFixed(3))),
    fusion: fusion && typeof fusion === 'object' ? fusion : (prev.fusion || null),
    updatedAt: Date.now(),
  };

  latestVitals.set(actualDeviceId, vitals);

  await persistWatchSignalToMongo({
    deviceId: actualDeviceId,
    userId: resolvedUserId,
    signalType: vitals.isOffWrist ? 'WATCH_OFF_WRIST' : 'WATCH_VITALS',
    vitals,
    action: vitals.isOffWrist ? 'OFF_WRIST_ALERT' : 'VITALS_UPDATE',
    force: Boolean(forcePersist),
  });

  // Phát socket nếu có client kết nối
  try {
    const io = getIo();
    io.to(`watch_room_${actualDeviceId}`).emit('watch:vitals', vitals);
    io.emit('watch:vitals', vitals);

    if (vitals.spO2 < 92 || vitals.heartRate > 130 || vitals.isOffWrist || vitals.svmG >= 2.5) {
      io.emit('DEVICE_SIGNAL_UPDATE', {
        userId: resolvedUserId || 'watch_standalone',
        userName: 'Samsung Galaxy Watch 5',
        signalType: vitals.isOffWrist ? 'WATCH_OFF_WRIST' : vitals.svmG >= 2.5 ? 'FALL_DETECTED' : 'CRITICAL_VITALS',
        payload: vitals,
        timestamp: new Date(),
      });
    }
  } catch (_) {}

  broadcastWatchEvent('WATCH_VITALS', vitals);

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

// Hàng đợi gói tin hai chiều (Command Queue) giữa Đồng hồ và Điện thoại
const pendingPacketsForWatch = new Map(); // deviceId -> [packets]
const pendingPacketsForPhone = new Map(); // deviceId -> [packets]
const deviceTimers = new Map(); // deviceId -> { remainingSeconds, deadline, updatedAt }

// 4. Truyền gói tin SafeSolo Watch Protocol (SSWP) qua HTTP Fallback
router.post('/packet', async (req, res) => {
  const packet = req.body;
  if (!packet || !packet.action) {
    return res.status(400).json({ success: false, message: 'Gói tin WatchPacket không hợp lệ' });
  }

  const deviceId = packet.payload?.deviceId || 'watch_galaxy_5';
  const conflictOwner = checkWatchOwnershipConflict(deviceId, packet.payload?.userId);
  if (conflictOwner && packet.sender !== 'toc') {
    return res.status(403).json({
      success: false,
      code: 'WATCH_OWNERSHIP_MISMATCH',
      ownerUserId: conflictOwner,
      message: 'Từ chối gói tin WatchPacket do khác chủ sở hữu đã ghép nối 1-1.',
    });
  }
  const resolvedUserId = resolveUserIdForDevice(deviceId, packet.payload?.userId);
  console.log(`[WatchRoutes] /packet: ${packet.action} (sender=${packet.sender}, deviceId=${deviceId}, userId=${resolvedUserId || 'n/a'})`);

  // Tự động lưu vitals nếu gói tin chứa telemetry hoặc kết quả đo PPG / ACK / Fusion Fall
  const hasVitals =
    packet.payload &&
    (packet.payload.heartRate !== undefined ||
      packet.payload.svmG !== undefined ||
      Array.isArray(packet.payload.gForceWaveform) ||
      packet.payload.fusion !== undefined ||
      packet.action === 'VITALS_UPDATE' ||
      packet.action === 'FALL_DETECTED' ||
      packet.action === 'PRECISION_MEASURE_RESULT');
  if (hasVitals) {
    const prev = latestVitals.get(deviceId) || {};
    const mergedHr = packet.payload.heartRate ?? prev.heartRate ?? 72;
    const mergedSvm = packet.payload.svmG ?? prev.svmG ?? 1.0;
    const mergedVitals = {
      deviceId,
      userId: resolvedUserId || prev.userId || null,
      heartRate: mergedHr,
      spO2: packet.payload.spO2 ?? prev.spO2 ?? 98,
      battery: packet.payload.battery ?? prev.battery ?? 84,
      steps: packet.payload.steps ?? prev.steps ?? 4280,
      isOffWrist: packet.payload.isOffWrist !== undefined ? Boolean(packet.payload.isOffWrist) : Boolean(prev.isOffWrist),
      svmG: mergedSvm,
      tiltAngle: packet.payload.tiltAngle ?? prev.tiltAngle ?? 0.0,
      gForceWaveform: sanitizeWaveformArray(packet.payload.gForceWaveform, prev.gForceWaveform, mergedSvm),
      ppgWaveform: sanitizeWaveformArray(packet.payload.ppgWaveform, prev.ppgWaveform, Number(((Number(mergedHr) / 100) * 0.65).toFixed(3))),
      fusion: packet.payload.fusion && typeof packet.payload.fusion === 'object' ? packet.payload.fusion : (prev.fusion || null),
      updatedAt: Date.now(),
    };
    latestVitals.set(deviceId, mergedVitals);
    await persistWatchSignalToMongo({
      deviceId,
      userId: resolvedUserId,
      signalType: packet.action === 'PRECISION_MEASURE_RESULT' ? 'HEART_RATE' : 'WATCH_VITALS',
      vitals: mergedVitals,
      action: packet.action,
      force: packet.action === 'PRECISION_MEASURE_RESULT' || packet.action === 'FALL_DETECTED',
    });
  }

  // Tự động cập nhật timer nếu là gói tin TIMER_SYNC
  if (packet.action === 'TIMER_SYNC' && packet.payload) {
    deviceTimers.set(deviceId, {
      remainingSeconds: packet.payload.remainingSeconds,
      deadline: packet.payload.deadline,
      updatedAt: Date.now(),
    });
  }

  // Phân luồng hàng đợi: Gói tin từ Phone gửi cho Watch, từ Watch gửi cho Phone, hoặc từ TOC cho cả 2
  if (packet.sender === 'phone') {
    if (!pendingPacketsForWatch.has(deviceId)) {
      pendingPacketsForWatch.set(deviceId, []);
    }
    const q = pendingPacketsForWatch.get(deviceId);
    q.push(packet);
    if (q.length > 20) q.shift();
  } else if (packet.sender === 'watch') {
    if (!pendingPacketsForPhone.has(deviceId)) {
      pendingPacketsForPhone.set(deviceId, []);
    }
    const q = pendingPacketsForPhone.get(deviceId);
    q.push(packet);
    if (q.length > 20) q.shift();
  } else if (packet.sender === 'toc') {
    for (const map of [pendingPacketsForWatch, pendingPacketsForPhone]) {
      if (!map.has(deviceId)) map.set(deviceId, []);
      const q = map.get(deviceId);
      q.push(packet);
      if (q.length > 20) q.shift();
    }
  }

  pushWatchEventLog({
    type: packet.action,
    sender: packet.sender || 'watch',
    deviceId,
    userId: resolvedUserId,
    note: packet.payload?.note || packet.payload?.alert || `${packet.action} (${packet.sender})`,
    payload: packet.payload || {},
  });

  try {
    const io = getIo();
    if (deviceId) {
      io.to(`watch_room_${deviceId}`).emit('watch:packet', packet);
    } else {
      io.emit('watch:packet', packet);
    }

    if (
      packet.action === 'FALL_DETECTED' ||
      packet.action === 'ACCIDENT_CRASH' ||
      packet.action === 'FREE_FALL_IMPACT' ||
      packet.action === 'HARDWARE_SOS' ||
      packet.action === 'DURESS_SOS' ||
      packet.action === 'CRITICAL_SPO2' ||
      packet.action === 'PRECISION_MEASURE_RESULT' ||
      packet.action === 'WATCH_COMMAND_ACK'
    ) {
      io.emit('DEVICE_SIGNAL_UPDATE', {
        userId: resolvedUserId || 'watch_standalone',
        userName: packet.sender === 'watch' ? 'Samsung Galaxy Watch 5' : 'User Phone',
        signalType: packet.action,
        payload: packet.payload || {},
        timestamp: new Date(),
      });
    }
  } catch (_) {}

  broadcastWatchEvent(
    packet.action === 'WATCH_COMMAND_ACK' ? 'WATCH_COMMAND_ACK' : 'WATCH_PACKET',
    {
      ...packet,
      deviceId,
      userId: resolvedUserId,
    },
  );

  return res.json({ success: true, messageId: packet.messageId, receivedAt: new Date() });
});

// 5. Thiết bị lấy các lệnh chờ (Commands Polling: target = 'watch' | 'phone')
router.get('/commands/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  const target = req.query.target || 'watch';

  const map = target === 'phone' ? pendingPacketsForPhone : pendingPacketsForWatch;
  const packets = map.get(deviceId) || [];
  map.set(deviceId, []); // Lấy xong làm trống hàng đợi (drain queue)
  if (packets.length > 0) {
    console.log(`[WatchRoutes] /commands: target=${target}, deviceId=${deviceId}, returning ${packets.length} commands: ${packets.map(p => p.action).join(', ')}`);
  }

  const timerInfo = deviceTimers.get(deviceId) || null;

  return res.json({
    success: true,
    target,
    deviceId,
    commands: packets,
    timer: timerInfo,
    timestamp: Date.now(),
  });
});

// Bộ nhớ lưu trữ hồ sơ y tế theo từng thiết bị đồng hồ
const deviceMedicalProfiles = new Map();

// 6. Lấy hồ sơ y tế người dùng cho đồng hồ
router.get('/medical-profile/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  const profile = deviceMedicalProfiles.get(deviceId) || {
    fullName: 'Đoàn Minh Quân',
    birthYear: '2003',
    citizenId: '079203001234',
    bloodType: 'O+',
    allergies: 'Penicillin',
    conditions: 'Tăng HA nhẹ',
    medications: 'Amlodipine 5mg',
    emergencyContactName: 'Mẹ Lan',
    emergencyContactPhone: '0901112222',
    insuranceProvider: 'BHYT Quân Đội',
    insuranceNumber: 'DN4791234567890',
  };
  return res.json({
    success: true,
    medical: profile,
  });
});

// 7. Cập nhật hồ sơ y tế từ điện thoại sang đồng hồ
router.post('/medical-profile/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  const { medical } = req.body;
  if (medical && typeof medical === 'object') {
    deviceMedicalProfiles.set(deviceId, medical);
    console.log(`[WatchRoutes] Updated medical profile for device ${deviceId}: ${medical.fullName || 'Unknown'}`);
  }
  return res.json({
    success: true,
    medical: deviceMedicalProfiles.get(deviceId) || medical,
  });
});

// Helper: Lấy danh sách toàn bộ đồng hồ đang ghép nối / phát telemetry
async function getAllWatchDevicesSnapshot() {
  const ids = new Set([...activePairedDevices.keys(), ...latestVitals.keys()]);
  const userIds = new Set();
  for (const dId of ids) {
    const p = activePairedDevices.get(dId);
    const v = latestVitals.get(dId);
    const uId = resolveUserIdForDevice(dId, v?.userId || p?.userId);
    if (uId && uId !== 'anonymous' && uId !== 'user_default') {
      userIds.add(uId);
    }
  }

  const userMap = new Map();
  if (userIds.size > 0 && mongoose.connection.readyState === 1) {
    try {
      const users = await User.find({ _id: { $in: [...userIds] } })
        .select('_id fullName name phoneNumber currentStatus')
        .lean();
      for (const u of users) {
        userMap.set(String(u._id), u);
      }
    } catch (_) {}
  }

  const devices = [];
  for (const dId of ids) {
    const p = activePairedDevices.get(dId) || null;
    const v = latestVitals.get(dId) || null;
    const uId = resolveUserIdForDevice(dId, v?.userId || p?.userId);
    const userDoc = uId ? userMap.get(String(uId)) : null;
    const watchQueue = pendingPacketsForWatch.get(dId) || [];
    devices.push({
      deviceId: dId,
      deviceModel: p?.deviceModel || 'Samsung Galaxy Watch 5 (SM-R900)',
      paired: Boolean(p),
      pairedAt: p?.pairedAt || null,
      userId: uId || null,
      userName: userDoc?.fullName || userDoc?.name || (uId ? `User ${String(uId).slice(-6)}` : 'Chưa gắn nạn nhân'),
      userPhone: userDoc?.phoneNumber || null,
      userStatus: userDoc?.currentStatus || null,
      vitals: v
        ? {
            heartRate: v.heartRate,
            spO2: v.spO2,
            battery: v.battery,
            steps: v.steps,
            isOffWrist: Boolean(v.isOffWrist),
            svmG: v.svmG ?? 1.0,
            tiltAngle: v.tiltAngle ?? 0.0,
            updatedAt: v.updatedAt,
          }
        : null,
      pendingWatchCommands: watchQueue.length,
    });
  }

  return {
    devices,
    recentEvents: recentWatchEvents.slice(0, 20),
    sseClientCount: sseClients.size,
  };
}

// Helper: Lấy telemetry Watch 5 live mới nhất theo userId để inject vào Web Admin TOC
function getLatestWatchVitalsByUserId(userId) {
  if (!userId) return null;
  const uidStr = String(userId);
  let matched = null;
  for (const [dId, v] of latestVitals.entries()) {
    const p = activePairedDevices.get(dId);
    const resolved = resolveUserIdForDevice(dId, v?.userId || p?.userId);
    if (resolved && String(resolved) === uidStr) {
      if (!matched || (v.updatedAt || 0) > (matched.updatedAt || 0)) {
        matched = {
          ...v,
          deviceId: dId,
          device: p?.deviceModel || 'Samsung Galaxy Watch 5 (SM-R900)',
          paired: Boolean(p),
        };
      }
    }
  }
  return matched;
}

// Helper: Xếp lệnh từ Web Admin TOC hoặc Phone vào hàng đợi cho Galaxy Watch 5
async function enqueueWatchCommand({
  deviceId,
  userId,
  action,
  payload = {},
  issuedBy = 'Web Admin TOC',
  sender = 'toc',
}) {
  const allowedActions = new Set([
    'FIND_WATCH_PING',
    'INSTANT_MEASURE_REQ',
    'TOC_DISPATCH_ACK',
    'TIMER_SYNC',
    'ALERT_CANCELLED',
    'ROUTE_DEVIATION_CHECK',
    'JOURNEY_CHECK_SAFE',
  ]);
  if (!allowedActions.has(action)) {
    throw new Error(`Unsupported watch command action: ${action}`);
  }

  let targetDeviceId = deviceId ? String(deviceId).trim() : '';
  if (!targetDeviceId && userId) {
    const live = getLatestWatchVitalsByUserId(userId);
    if (live?.deviceId) {
      targetDeviceId = live.deviceId;
    } else {
      for (const [dId, p] of activePairedDevices.entries()) {
        if (String(p.userId) === String(userId)) {
          targetDeviceId = dId;
          break;
        }
      }
    }
  }
  if (!targetDeviceId) {
    // Fallback to primary watch if any exists, else watch_galaxy_5
    const firstKey = activePairedDevices.keys().next().value || latestVitals.keys().next().value;
    targetDeviceId = firstKey || 'watch_galaxy_5';
  }

  const resolvedUserId = resolveUserIdForDevice(targetDeviceId, userId);
  const packet = {
    protocol: 'SAFESOLO_WATCH_V1',
    messageId: `toc_${Date.now()}_${Math.floor(Math.random() * 900 + 100)}`,
    timestamp: new Date().toISOString(),
    sender,
    type: 'command',
    action,
    payload: {
      ...payload,
      deviceId: targetDeviceId,
      userId: resolvedUserId || userId || undefined,
      source: 'WEB_ADMIN_TOC',
      issuedBy,
      issuedAt: new Date().toISOString(),
    },
  };

  for (const map of [pendingPacketsForWatch, pendingPacketsForPhone]) {
    if (!map.has(targetDeviceId)) map.set(targetDeviceId, []);
    const q = map.get(targetDeviceId);
    q.push(packet);
    if (q.length > 20) q.shift();
  }

  pushWatchEventLog({
    type: `CMD_${action}`,
    sender,
    deviceId: targetDeviceId,
    userId: resolvedUserId || userId || null,
    note: `${issuedBy} đã gửi lệnh ${action} tới ${targetDeviceId}`,
    payload: packet.payload,
  });

  if (mongoose.connection.readyState === 1) {
    try {
      await SystemLog.create({
        actionType: 'WATCH_REMOTE_COMMAND',
        incidentId: payload?.incidentId ? String(payload.incidentId) : undefined,
        metadata: {
          deviceId: targetDeviceId,
          userId: resolvedUserId || userId || null,
          action,
          issuedBy,
          messageId: packet.messageId,
        },
      });
    } catch (_) {}
  }

  try {
    const io = getIo();
    io.to(`watch_room_${targetDeviceId}`).emit('watch:packet', packet);
    io.emit('watch:packet', packet);
  } catch (_) {}

  broadcastWatchEvent('WATCH_COMMAND_ENQUEUED', packet);

  return {
    packet,
    deviceId: targetDeviceId,
    userId: resolvedUserId || userId || null,
    pendingWatchQueueSize: (pendingPacketsForWatch.get(targetDeviceId) || []).length,
  };
}

// 8. Lấy danh sách đồng hồ Galaxy Watch 5 đang kết nối + lịch sử gói tin (Web Admin TOC)
router.get('/devices', async (_req, res) => {
  const snapshot = await getAllWatchDevicesSnapshot();
  return res.json({ success: true, data: snapshot });
});

// 9. Luồng Server-Sent Events (SSE) đẩy telemetry & lệnh Watch 5 tức thời về Web Admin TOC
router.get('/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  sseClients.add(res);
  try {
    const snapshot = await getAllWatchDevicesSnapshot();
    res.write(`event: watch\ndata: ${JSON.stringify({ eventType: 'WATCH_SNAPSHOT', data: snapshot, timestamp: new Date().toISOString() })}\n\n`);
  } catch (_) {}

  const heartbeat = setInterval(() => {
    try {
      res.write(`: keepalive ${Date.now()}\n\n`);
    } catch (_) {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// 10. Gửi lệnh điều khiển hai chiều từ Web Admin TOC tới Galaxy Watch 5 (Yêu cầu JWT Super Admin hoặc Dispatcher)
router.post('/command', requireAdminAuth, requireAdminRole('superadmin', 'dispatcher'), async (req, res) => {
  try {
    const { deviceId, userId, action, payload, issuedBy } = req.body || {};
    if (!action) {
      return res.status(400).json({ success: false, message: 'Thiếu trường action.' });
    }
    const actorLabel = issuedBy || `${req.adminUser.name} (${req.adminUser.badgeNumber})`;
    const result = await enqueueWatchCommand({
      deviceId,
      userId,
      action,
      payload: payload || {},
      issuedBy: actorLabel,
      sender: 'toc',
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.getLatestWatchVitalsByUserId = getLatestWatchVitalsByUserId;
router.getAllWatchDevicesSnapshot = getAllWatchDevicesSnapshot;
router.enqueueWatchCommand = enqueueWatchCommand;
router.enqueueCommandForUser = (userId, action, payload = {}) =>
  enqueueWatchCommand({ userId, action, payload, issuedBy: 'LiveJourney Watchdog', sender: 'toc' }).catch((err) => {
    console.warn('[WatchRoutes] enqueueCommandForUser warning:', err.message);
    return null;
  });
router.broadcastWatchEvent = broadcastWatchEvent;

module.exports = router;
