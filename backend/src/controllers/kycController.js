const multer = require('multer');
const path = require('path');
const fs = require('fs');
const KYCDocument = require('../models/KYCDocument');
const User = require('../models/User');

const uploadDir = path.join(__dirname, '../../uploads/kyc');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, JPEG, PNG, and WEBP are allowed.'), false);
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
      { name: 'back_image', maxCount: 1 },
      { name: 'certificate_image', maxCount: 1 },
    ])(req, res, async (err) => {
      try {
        if (err) {
          if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              success: false,
              error: 'File too large. Maximum size is 5MB per image.',
            });
          }
          return res.status(400).json({
            success: false,
            error: err.message,
          });
        }

        if (!req.files || !req.files.front_image || !req.files.back_image) {
          return res.status(400).json({
            success: false,
            error: 'Both front_image and back_image are required.',
          });
        }

        const frontFile = req.files.front_image[0];
        const backFile = req.files.back_image[0];
        const certFile = req.files.certificate_image?.[0] || null;

        const userId = req.user?.id || req.user?._id;
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: 'User ID is required for KYC document upload.',
          });
        }

        const frontUrl = `/uploads/kyc/${frontFile.filename}`;
        const backUrl = `/uploads/kyc/${backFile.filename}`;
        const certUrl = certFile ? `/uploads/kyc/${certFile.filename}` : null;

        // Parse optional medical certification fields
        const b = req.body || {};
        let skillsList = ['CPR_AED', 'AIRWAY_CHOKING'];
        if (b.skillsList) {
          try {
            skillsList = typeof b.skillsList === 'string' ? JSON.parse(b.skillsList) : b.skillsList;
          } catch (_e) {
            skillsList = String(b.skillsList).split(',').map((s) => s.trim()).filter(Boolean);
          }
        }

        const defaultExpiry = new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000); // 24 tháng
        const expiryDate = b.expiryDate ? new Date(b.expiryDate) : defaultExpiry;

        const updateData = {
          userId,
          frontImageUrl: frontUrl,
          backImageUrl: backUrl,
          status: 'PENDING',
          submittedAt: new Date(),
          reviewedAt: null,
          specialtyTier: b.specialtyTier || 'TIER_1_BLS',
          certificateType: b.certificateType || (certUrl ? 'BLS_CPR_AED' : 'FIRST_AID_STANDARD'),
          skillsList,
          scopeOfPracticeAgreed: true,
          scopeOfPracticeAgreedAt: new Date(),
        };

        if (certUrl) updateData.certificateImageUrl = certUrl;
        if (b.certificateNumber) updateData.certificateNumber = b.certificateNumber;
        if (b.issuingOrganization) updateData.issuingOrganization = b.issuingOrganization;
        if (b.issueDate) updateData.issueDate = new Date(b.issueDate);
        if (expiryDate) updateData.expiryDate = expiryDate;

        const document = await KYCDocument.findOneAndUpdate(
          { userId },
          updateData,
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          },
        );

        await User.findByIdAndUpdate(userId, {
          isKycVerified: false,
        });

        res.status(201).json({
          success: true,
          message: 'Hồ sơ KYC & Chứng chỉ Chuyên môn đã được tải lên thành công và đang chờ xét duyệt.',
          data: {
            ...(document.toObject ? document.toObject() : document),
            id: document._id,
          },
        });
      } catch (error) {
        next(error);
      }
    });
  }

  // Sát hạch Trắc nghiệm & Tình huống Lâm sàng Trực tuyến (Clinical Exam)
  async submitClinicalExam(req, res, next) {
    try {
      const userId = req.user?.id || req.user?._id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const { score = 0, answers = [] } = req.body;
      const finalScore = Number(score) || Math.min(20, (Array.isArray(answers) ? answers.filter(a => a.isCorrect).length : 18));
      const isPassed = finalScore >= 18; // Chuẩn >= 90% (18/20 câu)

      const document = await KYCDocument.findOneAndUpdate(
        { userId },
        {
          theoryExamScore: finalScore,
          theoryExamPassed: isPassed,
          theoryExamTakenAt: new Date(),
        },
        { new: true, upsert: true },
      );

      return res.status(200).json({
        success: true,
        message: isPassed
          ? `Chúc mừng bạn đã vượt qua bài sát hạch lâm sàng (${finalScore}/20 điểm - Đạt yêu cầu)!`
          : `Rất tiếc bạn chưa đạt điểm tối thiểu (${finalScore}/20 điểm - Yêu cầu >= 18/20). Vui lòng ôn luyện và thi lại!`,
        data: {
          score: finalScore,
          isPassed,
          documentId: document._id,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Tra cứu trạng thái KYC & Chứng chỉ Hiệp sĩ hiện tại
  async getKycStatus(req, res, next) {
    try {
      const userId = req.user?.id || req.user?._id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const [document, user] = await Promise.all([
        KYCDocument.findOne({ userId }).lean(),
        User.findById(userId).lean(),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          hasSubmitted: Boolean(document),
          status: document?.status || 'NOT_SUBMITTED',
          isKycVerified: Boolean(user?.isKycVerified),
          heroTier: user?.heroTier || document?.specialtyTier || 'NONE',
          heroSkills: user?.heroSkills || document?.skillsList || [],
          certificateExpiry: user?.certificateExpiry || document?.expiryDate || null,
          theoryExamPassed: Boolean(document?.theoryExamPassed),
          theoryExamScore: document?.theoryExamScore || 0,
          document: document ? { ...document, id: document._id } : null,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new KYCController();
