const chatService = require('../services/chatService');
const multer = require('multer');
const path = require('path');

// Configure multer for voice uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/voices'));
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter for audio formats
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/x-m4a'];
  const allowedExtensions = ['.mp3', '.wav', '.m4a'];

  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only MP3, WAV, and M4A files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

class ChatController {
  // @desc    Upload voice message to chat room
  // @route   POST /api/chat/:roomId/upload-voice
  // @access  Private
  async uploadVoice(req, res, next) {
    try {
      const { roomId } = req.params;
      const userId = req.user.id;

      // Check user access to room
      await chatService.checkUserAccessToRoom(userId, roomId);

      // Multer handles the file upload
      upload.single('voice')(req, res, async (err) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              return res.status(400).json({
                success: false,
                error: 'File too large. Maximum size is 5MB.'
              });
            }
          }
          return res.status(400).json({
            success: false,
            error: err.message
          });
        }

        if (!req.file) {
          return res.status(400).json({
            success: false,
            error: 'No voice file provided'
          });
        }

        // Create file URL (in production, this would be S3 URL)
        const fileUrl = `/uploads/voices/${req.file.filename}`;

        // Create message record
        const message = await chatService.createMessage(roomId, userId, 'AUDIO', fileUrl);

        res.status(201).json({
          success: true,
          data: {
            message,
            fileUrl
          }
        });
      });
    } catch (error) {
      next(error);
    }
  }

  // @desc    Get chat room messages
  // @route   GET /api/chat/:roomId/messages
  // @access  Private
  async getMessages(req, res, next) {
    try {
      const { roomId } = req.params;
      const userId = req.user.id;

      // Check user access to room
      await chatService.checkUserAccessToRoom(userId, roomId);

      const messages = await chatService.getMessagesByRoomId(roomId);

      res.json({
        success: true,
        data: { messages }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ChatController();