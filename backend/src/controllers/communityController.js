const User = require('../models/User');
const ThankYouNote = require('../models/ThankYouNote');
const trustService = require('../services/trustService');
const { sanitizeUser } = require('../lib/utils');

class CommunityController {
  async listHeroes(_req, res, next) {
    try {
      const heroes = await User.find({
        isActive: true,
        $or: [
          { isKycVerified: true },
          { rescuesCount: { $gt: 0 } },
          { trustScore: { $gt: 0 } },
        ],
      })
        .sort({ rescuesCount: -1, trustScore: -1, updatedAt: -1 })
        .limit(50)
        .lean();

      res.json({
        success: true,
        data: heroes.map((hero) => sanitizeUser(hero)),
      });
    } catch (error) {
      next(error);
    }
  }

  async getHeroProfile(req, res, next) {
    try {
      const volunteerId = req.params.id;

      const hero = await User.findById(volunteerId).lean();
      if (!hero) {
        return res.status(404).json({
          success: false,
          error: 'Volunteer not found',
        });
      }

      const notes = await ThankYouNote.find({ volunteerId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      const authorIds = [...new Set(notes.map((item) => item.authorId).filter(Boolean))];
      const authors = authorIds.length ? await User.find({ _id: { $in: authorIds } }).lean() : [];
      const authorMap = new Map(authors.map((item) => [item._id, sanitizeUser(item)]));

      res.json({
        success: true,
        data: {
          ...sanitizeUser(hero),
          receivedThankYouNotes: notes.map((note) => ({
            ...note,
            id: note._id,
            author: authorMap.get(note.authorId) || null,
          })),
        },
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
          error: 'Content is required and must be a string',
        });
      }

      if (volunteerId === userId) {
        return res.status(403).json({
          success: false,
          error: 'You cannot post a thank-you note for yourself',
        });
      }

      const volunteer = await User.findById(volunteerId);
      if (!volunteer) {
        return res.status(404).json({
          success: false,
          error: 'Volunteer not found',
        });
      }

      let parsedRating = null;
      if (rating !== undefined) {
        parsedRating = Number(rating);
        if (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 5) {
          return res.status(400).json({
            success: false,
            error: 'Rating must be a number between 1 and 5',
          });
        }
      }

      const note = await ThankYouNote.create({
        volunteerId,
        authorId: userId,
        content: content.trim(),
        rating: parsedRating,
      });

      if (parsedRating !== null) {
        await trustService.calculateAndUpdateTrustScore(volunteerId, parsedRating);
      }

      const author = await User.findById(userId).lean();
      res.status(201).json({
        success: true,
        data: {
          ...(note.toObject ? note.toObject() : note),
          id: note._id,
          author: author ? sanitizeUser(author) : null,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CommunityController();
