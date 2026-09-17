const { Server } = require('socket.io');
const { initializeChatSocket } = require('./chatSocket');
const { initializeWatchSocket } = require('./watchSocket');

let ioInstance;

function initializeSocket(server) {
  ioInstance = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PATCH'],
    },
  });

  // Initialize chat socket functionality
  initializeChatSocket(ioInstance);

  // Initialize smartwatch real-time synchronization
  initializeWatchSocket(ioInstance);

  ioInstance.on('connection', (socket) => {
    // eslint-disable-next-line no-console
    console.log('Socket connected:', socket.id);

    // Walkie-Talkie Push-To-Talk (PTT) events
    socket.on('ptt:join_channel', ({ channelId, userId, userName }) => {
      socket.join(channelId);
      socket.to(channelId).emit('ptt:member_joined', { userId, userName, socketId: socket.id });
    });

    socket.on('ptt:talk_start', ({ channelId, userId, userName }) => {
      socket.to(channelId).emit('ptt:talk_start', { userId, userName });
    });

    socket.on('ptt:audio_chunk', ({ channelId, userId, chunkBase64 }) => {
      socket.to(channelId).emit('ptt:audio_chunk', { userId, chunkBase64 });
    });

    socket.on('ptt:talk_end', ({ channelId, userId, durationSeconds }) => {
      socket.to(channelId).emit('ptt:talk_end', { userId, durationSeconds });
    });

    socket.on('disconnect', () => {
      // eslint-disable-next-line no-console
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