const prisma = require('../config/database');

class FeedController {
  async createStatus(req, res, next) {
    try {
      const { mood_emoji, audio_url } = req.body;
      const userId = req.user.id;

      const status = await prisma.dailyStatus.create({
        data: {
          userId,
          mood_emoji,
          audio_url: audio_url || null
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              avatar: true,
              is_kyc_verified: true
            }
          }
        }
      });

      res.status(201).json({
        success: true,
        data: status
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

      const statuses = await prisma.dailyStatus.findMany({
        where: {
          user: {
            receivedRequests: {
              some: {
                guardianId: userId,
                status: 'ACCEPTED'
              }
            }
          }
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              is_kyc_verified: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      });

      res.json({
        success: true,
        data: {
          statuses,
          pagination: {
            limit,
            offset,
            count: statuses.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new FeedController();