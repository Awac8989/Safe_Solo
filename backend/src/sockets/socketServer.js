const { Server } = require('socket.io');
const { initializeChatSocket } = require('./chatSocket');

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

  ioInstance.on('connection', (socket) => {
    // eslint-disable-next-line no-console
    console.log('Socket connected:', socket.id);

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