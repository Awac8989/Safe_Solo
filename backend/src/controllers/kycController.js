const multer = require('multer');
const path = require('path');
const KYCDocument = require('../models/KYCDocument');
const User = require('../models/User');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/kyc'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, JPEG, and PNG are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

class KYCController {
  uploadKycDocuments(req, res, next) {
    upload.fields([
      { name: 'front_image', maxCount: 1 },
      { name: 'back_image', maxCount: 1 }
    ])(req, res, async (err) => {
      try {
        if (err) {
          if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              success: false,
              error: 'File too large. Maximum size is 5MB per image.'
            });
          }
          return res.status(400).json({
            success: false,
            error: err.message
          });
        }

        if (!req.files || !req.files.front_image || !req.files.back_image) {
          return res.status(400).json({
            success: false,
            error: 'Both front_image and back_image are required.'
          });
        }

        const frontFile = req.files.front_image[0];
        const backFile = req.files.back_image[0];
        const userId = req.user.id;

        const frontUrl = `/uploads/kyc/${frontFile.filename}`;
        const backUrl = `/uploads/kyc/${backFile.filename}`;

        const document = await KYCDocument.findOneAndUpdate({
          userId,
        }, {
          userId,
          frontImageUrl: frontUrl,
          backImageUrl: backUrl,
          status: 'PENDING',
          submittedAt: new Date(),
          reviewedAt: null,
        }, {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        });

        await User.findByIdAndUpdate(userId, {
          isKycVerified: false,
        });

        res.status(201).json({
          success: true,
          data: {
            ...(document.toObject ? document.toObject() : document),
            id: document._id,
          }
        });
      } catch (error) {
        next(error);
      }
    });
  }
}

module.exports = new KYCController();
