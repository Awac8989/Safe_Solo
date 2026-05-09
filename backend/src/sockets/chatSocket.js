const jwt = require('jsonwebtoken');
const chatService = require('../services/chatService');

function initializeChatSocket(io) {
  // JWT authentication middleware for sockets
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userEmail = decoded.email;

      next();
    } catch (error) {
      next(new Error('Invalid authentication token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User ${socket.userId} connected with socket ${socket.id}`);

    // Join rescue room
    socket.on('join_rescue_room', async (roomId) => {
      try {
        // Check user access to room
        await chatService.checkUserAccessToRoom(socket.userId, roomId);

        // Join the room
        socket.join(roomId);
        console.log(`User ${socket.userId} joined room ${roomId}`);

        socket.emit('joined_room', { roomId, message: 'Successfully joined the chat room' });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // Send message
    socket.on('send_message', async (data) => {
      try {
        const { roomId, messageType, content } = data;

        if (!roomId || !messageType || !content) {
          return socket.emit('error', { message: 'Missing required fields: roomId, messageType, content' });
        }

        // Check user access to room
        await chatService.checkUserAccessToRoom(socket.userId, roomId);

        // Create message
        const message = await chatService.createMessage(roomId, socket.userId, messageType, content);

        // Broadcast to all users in the room (except sender)
        socket.to(roomId).emit('new_message', message);

        // Also send back to sender for confirmation
        socket.emit('message_sent', message);

      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // Leave room
    socket.on('leave_rescue_room', (roomId) => {
      socket.leave(roomId);
      console.log(`User ${socket.userId} left room ${roomId}`);
    });

    socket.on('disconnect', () => {
      console.log(`User ${socket.userId} disconnected`);
    });
  });
}

module.exports = { initializeChatSocket };