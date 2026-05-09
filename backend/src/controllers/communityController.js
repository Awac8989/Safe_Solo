const prisma = require('../config/database');
const trustService = require('../services/trustService');

class CommunityController {
  async getHeroProfile(req, res, next) {
    try {
      const volunteerId = req.params.id;

      const hero = await prisma.user.findUnique({
        where: { id: volunteerId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatar: true,
          trust_score: true,
          rescues_count: true,
          is_kyc_verified: true,
          receivedThankYouNotes: {
            select: {
              id: true,
              content: true,
              createdAt: true,
              author: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatar: true
                }
              }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
          }
        }
      });

      if (!hero) {
        return res.status(404).json({
          success: false,
          error: 'Volunteer not found'
        });
      }

      res.json({
        success: true,
        data: hero
      });
    } catch (error) {
      next(error);
    }
  }

  async postThankYou(req, res, next) {
    try {
      const volunteerId = req.params.id;
      const { content, rating } = req.body;
      const userId = req.user.id;

      if (!content || typeof content !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Content is required and must be a string'
        });
      }

      const eligible = await prisma.rescueIncident.findFirst({
        where: {
          responses: {
            some: {
              volunteerId
            }
          },
          OR: [
            { victimId: userId },
            {
              victim: {
                receivedRequests: {
                  some: {
                    guardianId: userId,
                    status: 'ACCEPTED'
                  }
                }
              }
            }
          ]
        }
      });

      if (!eligible) {
        return res.status(403).json({
          success: false,
          error: 'You are not authorized to post a thank-you note for this hero'
        });
      }

      const note = await prisma.thankYouNote.create({
        data: {
          volunteerId,
          authorId: userId,
          content
        },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true
            }
          }
        }
      });

      if (rating !== undefined) {
        const parsedRating = Number(rating);
        if (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 5) {
          return res.status(400).json({
            success: false,
            error: 'Rating must be a number between 1 and 5'
          });
        }

        await trustService.calculateAndUpdateTrustScore(volunteerId, parsedRating);
      }

      res.status(201).json({
        success: true,
        data: note
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CommunityController();