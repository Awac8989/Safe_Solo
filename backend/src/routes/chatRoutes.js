const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const auth = require('../middleware/auth');

// All chat routes require authentication
router.use(auth);

// @route   POST /api/chat/:roomId/upload-voice
// @desc    Upload voice message to chat room
// @access  Private
router.post('/:roomId/upload-voice', chatController.uploadVoice);

// @route   GET /api/chat/:roomId/messages
// @desc    Get messages from chat room
// @access  Private
router.get('/:roomId/messages', chatController.getMessages);

module.exports = router;