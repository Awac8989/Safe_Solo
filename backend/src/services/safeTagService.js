const crypto = require('crypto');
const SafeTag = require('../models/SafeTag');
const MedicalProfile = require('../models/MedicalProfile');
const User = require('../models/User');

class SafeTagService {
  /**
   * Phát hành thẻ/vòng tay định danh y tế SafeTag mới cho người dùng
   */
  async issueSafeTag(userId, tagType = 'SILICONE_WRISTBAND', customCode = null) {
    const user = await User.findById(userId);
    if (!user) throw new Error('Không tìm thấy người dùng');

    const medicalProfile = await MedicalProfile.findOne({ userId });

    const tagCode = customCode || `STAG-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // Sinh chữ ký số bảo mật SHA-256
    const digitalSignature = crypto
      .createHash('sha256')
      .update(`${userId}:${tagCode}:${Date.now()}:SAFESOLO_ICE_SECRET`)
      .digest('hex');

    const criticalAllergies = Array.isArray(medicalProfile?.allergiesList) && medicalProfile.allergiesList.length > 0
      ? medicalProfile.allergiesList
      : (typeof medicalProfile?.allergies === 'string' && medicalProfile.allergies
          ? medicalProfile.allergies.split(',').map(s => s.trim())
          : []);

    const criticalConditions = Array.isArray(medicalProfile?.medicalConditions) && medicalProfile.medicalConditions.length > 0
      ? medicalProfile.medicalConditions
      : (typeof medicalProfile?.conditions === 'string' && medicalProfile.conditions
          ? medicalProfile.conditions.split(',').map(s => s.trim())
          : []);

    const emergencyContacts = (user.emergencyContacts || []).slice(0, 2).map(g => ({
      relationship: g.relation || g.name || g.relationship || 'Người thân',
      phoneNumber: g.phone || g.phoneNumber,
    }));

    const publicPayload = {
      displayName: user.fullName || 'Người dùng SafeSolo',
      bloodType: medicalProfile?.bloodType || 'UNKNOWN',
      criticalAllergies,
      criticalConditions,
      emergencyContacts,
    };

    const safeTag = await SafeTag.create({
      tagCode,
      tagType,
      userId,
      publicPayload,
      digitalSignature,
    });

    return safeTag;
  }

  /**
   * Quét thẻ ngoại tuyến Tầng 1 (Công khai cho người qua đường / bất kỳ ai quét NFC/QR)
   */
  async resolvePublicICEData(tagCode, scanMetadata = {}) {
    const safeTag = await SafeTag.findOne({ tagCode, status: 'ACTIVE' });
    if (!safeTag) {
      throw new Error('Thẻ SafeTag không tồn tại hoặc đã bị khóa');
    }

    // Ghi nhận vết quét vào lịch sử bảo mật
    safeTag.scanHistory.push({
      scannedAt: new Date(),
      scannerIp: scanMetadata.ip || '0.0.0.0',
      scannerUserAgent: scanMetadata.userAgent || 'NFC Scanner Device',
      scannedLocation: scanMetadata.location || { lat: 0, lng: 0 },
      accessTier: 'TIER_1_PUBLIC',
    });
    await safeTag.save();

    return {
      tagCode: safeTag.tagCode,
      tagType: safeTag.tagType,
      status: safeTag.status,
      emergencyInfo: safeTag.publicPayload,
      guidanceNote: 'Nếu nạn nhân bất tỉnh hoặc ngưng thở, vui lòng gọi ngay 115 và bấm nút bên dưới để gọi người thân.',
    };
  }

  /**
   * Quét thẻ ngoại tuyến Tầng 2 (Dành riêng cho Bác sĩ 115 / Hiệp sĩ cứu hộ đã xác thực)
   */
  async resolveMedicalTier2Data(tagCode, doctorOrHeroUserId, incidentId = null) {
    const safeTag = await SafeTag.findOne({ tagCode, status: 'ACTIVE' });
    if (!safeTag) throw new Error('Thẻ SafeTag không hợp lệ');

    const requester = await User.findById(doctorOrHeroUserId);
    if (!requester || (requester.heroTier === 'NONE' && requester.role !== 'admin' && requester.role !== 'doctor')) {
      throw new Error('Bạn không có thẩm quyền chuyên môn y tế để truy cập hồ sơ chi tiết');
    }

    const fullMedicalProfile = await MedicalProfile.findOne({ userId: safeTag.userId });
    const victimUser = await User.findById(safeTag.userId).select('fullName phoneNumber approxAddress lastKnownLocation');

    // Ghi nhận vết truy cập hồ sơ y tế chuyên sâu
    safeTag.scanHistory.push({
      scannedAt: new Date(),
      accessTier: 'TIER_2_MEDICAL_AUTHENTICATED',
      authorizedDoctorOrHeroId: doctorOrHeroUserId,
    });
    await safeTag.save();

    return {
      tagCode: safeTag.tagCode,
      victim: victimUser,
      fullMedicalHistory: fullMedicalProfile,
      digitalSignature: safeTag.digitalSignature,
      accessTimestamp: new Date(),
    };
  }

  /**
   * Tạo payload nén nhị phân siêu gọn nạp vào chip NFC NTAG213 / NTAG215 (dưới 144 bytes)
   */
  generateNfcCompactPayload(safeTag) {
    const compactObj = {
      v: 1,
      c: safeTag.tagCode,
      n: safeTag.publicPayload.displayName,
      b: safeTag.publicPayload.bloodType,
      al: (safeTag.publicPayload.criticalAllergies || []).slice(0, 2),
      c1: safeTag.publicPayload.emergencyContacts[0]?.phoneNumber || '',
    };
    const jsonStr = JSON.stringify(compactObj);
    const base64Url = Buffer.from(jsonStr).toString('base64url');
    return `https://safesolo.vn/ice/${base64Url}`;
  }
}

module.exports = new SafeTagService();
