const { createDeviceSignal } = require('../controllers/userController');

// In-memory store for 6-digit pairing codes
// code -> { deviceId, deviceModel, socketId, createdAt }
const pairingCodes = new Map();

// deviceId -> { userId, room, lastSeen }
const activePairedDevices = new Map();

// Helper to clean up expired codes (10 mins TTL)
setInterval(() => {
  const now = Date.now();
  for (const [code, info] of pairingCodes.entries()) {
    if (now - info.createdAt > 10 * 60 * 1000) {
      pairingCodes.delete(code);
    }
  }
}, 60 * 1000);

function initializeWatchSocket(io) {
  io.on('connection', (socket) => {
    // 1. WATCH REQUESTS A PAIRING CODE (Shows on Watch Screen)
    socket.on('watch:request_code', (data) => {
      try {
        const deviceId = data?.deviceId || `watch_${socket.id.substring(0, 6)}`;
        const deviceModel = data?.deviceModel || 'Samsung Galaxy Watch 5';

        // Generate 6-digit number
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const room = `watch_room_${deviceId}`;

        socket.deviceId = deviceId;
        socket.deviceRole = 'watch';
        socket.join(room);

        pairingCodes.set(code, {
          deviceId,
          deviceModel,
          socketId: socket.id,
          createdAt: Date.now(),
        });

        socket.emit('watch:code_created', {
          code,
          deviceId,
          deviceModel,
          expiresInSeconds: 600,
        });

        console.log(`[WatchSocket] Watch ${deviceId} generated pairing code: ${code}`);
      } catch (err) {
        socket.emit('watch:error', { message: err.message });
      }
    });

    // 2. PHONE VERIFIES PAIRING CODE (Entered by user on phone)
    socket.on('watch:verify_code', (data) => {
      try {
        const { code, userId } = data || {};
        if (!code) {
          return socket.emit('watch:pair_error', { message: 'Mã kết nối không được để trống' });
        }

        const info = pairingCodes.get(String(code).trim());
        if (!info) {
          return socket.emit('watch:pair_error', { message: 'Mã kết nối không hợp lệ hoặc đã hết hạn.' });
        }

        const room = `watch_room_${info.deviceId}`;
        socket.deviceId = info.deviceId;
        socket.deviceRole = 'phone';
        socket.userId = userId;
        socket.join(room);

        activePairedDevices.set(info.deviceId, {
          userId,
          deviceModel: info.deviceModel,
          pairedAt: new Date(),
        });

        // Notify both Watch and Phone in the room
        io.to(room).emit('watch:pair_success', {
          paired: true,
          deviceId: info.deviceId,
          deviceModel: info.deviceModel,
          userId,
          code,
        });

        // Clean up code after successful pair
        pairingCodes.delete(code);
        console.log(`[WatchSocket] Phone paired successfully with Watch ${info.deviceId} for User ${userId}`);
      } catch (err) {
        socket.emit('watch:pair_error', { message: err.message });
      }
    });

    // 3. JOIN EXISTING PAIRED ROOM (Reconnecting Watch or Phone)
    socket.on('watch:join_room', (data) => {
      const { deviceId, role, userId } = data || {};
      if (!deviceId) return;

      const room = `watch_room_${deviceId}`;
      socket.deviceId = deviceId;
      socket.deviceRole = role || 'unknown';
      if (userId) socket.userId = userId;
      socket.join(room);

      socket.emit('watch:room_joined', { room, deviceId });
    });

    // 4. BI-DIRECTIONAL PACKET TRANSFER (SSWP Packets)
    socket.on('watch:packet', async (packet) => {
      try {
        if (!packet || !socket.deviceId) return;
        const room = `watch_room_${socket.deviceId}`;

        // Broadcast packet to peer in room
        socket.to(room).emit('watch:packet', packet);

        // If high-severity emergency packet, broadcast to Admin Dispatcher & record
        const action = packet.action;
        if (
          action === 'FALL_DETECTED' ||
          action === 'HARDWARE_SOS' ||
          action === 'CRITICAL_SPO2'
        ) {
          io.emit('DEVICE_SIGNAL_UPDATE', {
            userId: socket.userId || 'watch_standalone',
            userName: packet.sender === 'watch' ? 'Galaxy Watch 5 (WearOS)' : 'User Phone',
            signalType: action,
            payload: packet.payload || {},
            timestamp: new Date(),
          });
        }
      } catch (err) {
        console.error('[WatchSocket] Error processing watch packet:', err);
      }
    });

    // 5. PING - PONG FOR LATENCY MEASUREMENT
    socket.on('watch:ping', (data) => {
      socket.emit('watch:pong', {
        clientTimestamp: data?.timestamp || Date.now(),
        serverTimestamp: Date.now(),
      });
    });

    // 6. DISCONNECT
    socket.on('disconnect', () => {
      if (socket.deviceId) {
        const room = `watch_room_${socket.deviceId}`;
        socket.to(room).emit('watch:peer_status', {
          deviceId: socket.deviceId,
          role: socket.deviceRole,
          online: false,
        });
      }
    });
  });
}

module.exports = { initializeWatchSocket, pairingCodes, activePairedDevices };
