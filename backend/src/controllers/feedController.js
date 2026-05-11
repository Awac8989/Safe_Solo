const DailyStatus = require('../models/DailyStatus');
const User = require('../models/User');
const { sanitizeUser } = require('../lib/utils');

async function resolveCircleUserIds(user) {
  const myPhone = String(user.phone || '').trim();
  const contactPhones = new Set(
    (user.emergencyContacts || [])
      .map((item) => String(item?.phone || '').trim())
      .filter(Boolean),
  );

  const directContacts = contactPhones.size
    ? await User.find({ phoneNumber: { $in: [...contactPhones] } }).lean()
    : [];

  const reciprocalContacts = myPhone
    ? await User.find({ 'emergencyContacts.phone': myPhone }).lean()
    : [];

  return [...new Set([user.id, ...directContacts.map((item) => item._id), ...reciprocalContacts.map((item) => item._id)])];
}

class FeedController {
  async createStatus(req, res, next) {
    try {
      const { mood_emoji, audio_url, text, visibility, batteryLevel, isCheckIn } = req.body;
      const userId = req.user.id;

      const user = await User.findById(userId).lean();
      if (!user || user.isActive === false) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      const status = await DailyStatus.create({
        userId,
        moodEmoji: mood_emoji,
        text: text || '',
        audioUrl: audio_url || null,
        visibility: visibility || 'FAMILY',
        batteryLevel: batteryLevel ?? user.batteryLevel ?? null,
        isCheckIn: Boolean(isCheckIn),
      });

      res.status(201).json({
        success: true,
        data: {
          ...(status.toObject ? status.toObject() : status),
          id: status._id,
          user: sanitizeUser(user),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getCircleFeed(req, res, next) {
    try {
      const userId = req.user.id;
      const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
      const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

      const user = await User.findById(userId).lean();
      if (!user || user.isActive === false) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      const visibleUserIds = await resolveCircleUserIds({
        id: user._id,
        phone: user.phoneNumber,
        emergencyContacts: user.emergencyContacts,
      });

      const statuses = await DailyStatus.find({
        userId: { $in: visibleUserIds },
        visibility: { $in: ['FAMILY', 'COMMUNITY'] },
      })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean();

      const authors = await User.find({
        _id: { $in: [...new Set(statuses.map((item) => item.userId))] },
      }).lean();
      const authorMap = new Map(authors.map((item) => [item._id, sanitizeUser(item)]));

      res.json({
        success: true,
        data: {
          statuses: statuses.map((status) => ({
            ...status,
            id: status._id,
            mood_emoji: status.moodEmoji,
            audio_url: status.audioUrl,
            user: authorMap.get(status.userId) || null,
          })),
          pagination: {
            limit,
            offset,
            count: statuses.length,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new FeedController();
