const { Server } = require('socket.io');
const { initializeChatSocket } = require('./chatSocket');
const { initializeWatchSocket } = require('./watchSocket');

let ioInstance;
// Active WebRTC rooms tracking: roomId -> Map<socketId, { peerId, role, name }>
const activeWebRtcRooms = new Map();

function initializeSocket(server) {
  ioInstance = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PATCH'],
    },
    maxHttpBufferSize: 5e6,
  });

  initializeChatSocket(ioInstance);
  initializeWatchSocket(ioInstance);

  ioInstance.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // 1. Walkie-Talkie Push-To-Talk (PTT) & WebRTC Room Audio
    socket.on('ptt:join_channel', ({ channelId, roomId, userId, userName, role }) => {
      const target = roomId || channelId;
      if (!target) return;
      socket.join(target);
      socket.to(target).emit('ptt:member_joined', {
        userId,
        userName,
        role: role || 'member',
        socketId: socket.id,
      });
    });

    socket.on('ptt:talk_start', ({ channelId, roomId, userId, userName, role }) => {
      const target = roomId || channelId;
      if (!target) return;
      socket.to(target).emit('ptt:talk_start', {
        userId,
        userName,
        role: role || 'member',
        ts: Date.now(),
      });
    });

    socket.on('ptt:audio_chunk', ({ channelId, roomId, userId, userName, role, chunkBase64, mimeType }) => {
      const target = roomId || channelId;
      if (!target || !chunkBase64) return;
      socket.to(target).emit('ptt:audio_chunk', {
        userId,
        userName,
        role: role || 'member',
        chunkBase64,
        mimeType: mimeType || 'audio/wav',
        ts: Date.now(),
      });
    });

    socket.on('ptt:talk_end', ({ channelId, roomId, userId, userName, role, durationSeconds }) => {
      const target = roomId || channelId;
      if (!target) return;
      socket.to(target).emit('ptt:talk_end', {
        userId,
        userName,
        role: role || 'member',
        durationSeconds: durationSeconds || 0,
        ts: Date.now(),
      });
    });

    // 2. WebRTC Signaling (Doctor 115 / Web Admin <-> Field Hero Camera & Audio)
    socket.on('webrtc:join_room', ({ roomId, peerId, role, name }) => {
      if (!roomId) return;
      socket.join(roomId);
      if (!activeWebRtcRooms.has(roomId)) {
        activeWebRtcRooms.set(roomId, new Map());
      }
      const peersMap = activeWebRtcRooms.get(roomId);
      const peerInfo = {
        socketId: socket.id,
        peerId: peerId || socket.id,
        role: role || 'hero',
        name: name || 'SafeSolo Peer',
        joinedAt: Date.now(),
      };
      peersMap.set(socket.id, peerInfo);

      socket.emit('webrtc:room_peers', {
        roomId,
        peers: [...peersMap.values()].filter((p) => p.socketId !== socket.id),
      });
      socket.to(roomId).emit('webrtc:peer_joined', {
        roomId,
        ...peerInfo,
      });
    });

    socket.on('webrtc:leave_room', ({ roomId, peerId }) => {
      if (!roomId) return;
      socket.leave(roomId);
      const peersMap = activeWebRtcRooms.get(roomId);
      if (peersMap) {
        peersMap.delete(socket.id);
        if (peersMap.size === 0) activeWebRtcRooms.delete(roomId);
      }
      socket.to(roomId).emit('webrtc:peer_left', {
        roomId,
        socketId: socket.id,
        peerId: peerId || socket.id,
      });
    });

    socket.on('webrtc:offer', (payload = {}) => {
      const { roomId } = payload;
      if (!roomId) return;
      socket.to(roomId).emit('webrtc:offer', {
        ...payload,
        fromSocketId: socket.id,
        ts: Date.now(),
      });
    });

    socket.on('webrtc:answer', (payload = {}) => {
      const { roomId } = payload;
      if (!roomId) return;
      socket.to(roomId).emit('webrtc:answer', {
        ...payload,
        fromSocketId: socket.id,
        ts: Date.now(),
      });
    });

    socket.on('webrtc:ice-candidate', (payload = {}) => {
      const { roomId } = payload;
      if (!roomId) return;
      socket.to(roomId).emit('webrtc:ice-candidate', {
        ...payload,
        fromSocketId: socket.id,
      });
    });

    // Live 1-way field video frame relay (Android Hero Camera2 -> Web Admin Doctor 115)
    socket.on('webrtc:video_frame', (payload = {}) => {
      const { roomId } = payload;
      if (!roomId || !payload.frameBase64) return;
      socket.to(roomId).emit('webrtc:video_frame', {
        ...payload,
        fromSocketId: socket.id,
        relayedAt: Date.now(),
      });
    });

    // Doctor 115 / TOC real-time CPR & Tourniquet directive -> Hero A71
    socket.on('webrtc:doctor_instruction', (payload = {}) => {
      const { roomId } = payload;
      if (!roomId) return;
      ioInstance.to(roomId).emit('webrtc:doctor_instruction', {
        ...payload,
        fromSocketId: socket.id,
        ts: Date.now(),
      });
    });

    socket.on('disconnect', () => {
      for (const [roomId, peersMap] of activeWebRtcRooms.entries()) {
        if (peersMap.has(socket.id)) {
          const peer = peersMap.get(socket.id);
          peersMap.delete(socket.id);
          socket.to(roomId).emit('webrtc:peer_left', {
            roomId,
            socketId: socket.id,
            peerId: peer?.peerId || socket.id,
          });
          if (peersMap.size === 0) activeWebRtcRooms.delete(roomId);
        }
      }
      console.log('Socket disconnected:', socket.id);
    });
  });

  return ioInstance;
}

function getIo() {
  if (!ioInstance) {
    throw new Error('Socket.io has not been initialized yet');
  }
  return ioInstance;
}

module.exports = { initializeSocket, getIo };
