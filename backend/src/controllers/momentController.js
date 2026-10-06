const SafeMoment = require('../models/SafeMoment');
const User = require('../models/User');
const fcmService = require('../services/fcmService');

exports.createMoment = async (req, res) => {
  try {
    const { userId, caption, mood } = req.body;
    
    let photoUrl = null;
    if (req.file) {
      photoUrl = `/uploads/${req.file.filename}`;
    }

    const mongoose = require('mongoose');
    let authorName = 'Người thân';
    if (userId && mongoose.isValidObjectId(userId)) {
      const user = await User.findById(userId);
      if (user && user.fullName) {
        authorName = user.fullName;
      }
    }

    const moment = new SafeMoment({
      userId: userId || 'anonymous',
      authorName,
      caption: caption || 'Bình an cùng SafeSolo',
      mood: mood || 'calm',
      photoUrl,
    });

    await moment.save();

    // Broadcast via socketio if available
    const io = req.app.get('io');
    if (io) {
      io.emit('new_moment', moment);
    }

    // Gửi FCM notification (Locket style)
    try {
      if (fcmService.isConfigured()) {
        const title = `📷 Khoảnh khắc mới từ ${authorName}`;
        const body = caption || 'Vừa chia sẻ một bức ảnh mới!';
        await fcmService.sendAlertFanout(userId, {
          title,
          body,
          data: { type: 'NEW_MOMENT', momentId: moment._id.toString() },
        });
      }
    } catch (pushErr) {
      console.error('[momentController] Lỗi gửi push:', pushErr);
    }

    res.status(201).json(moment);
  } catch (err) {
    console.error('[momentController.createMoment] Error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

exports.getMoments = async (req, res) => {
  try {
    const moments = await SafeMoment.find()
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(moments);
  } catch (err) {
    console.error('[momentController.getMoments] Error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
};
