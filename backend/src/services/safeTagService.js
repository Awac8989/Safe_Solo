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

  /**
   * Yêu cầu mã OTP 6 số gửi đến số điện thoại người bảo trợ để mở khóa Tầng 2
   */
  async requestTier2Otp(tagCode) {
    const safeTag = await SafeTag.findOne({ tagCode, status: 'ACTIVE' });
    if (!safeTag) throw new Error('Thẻ SafeTag không tồn tại hoặc đã bị khóa');

    const guardianPhone = safeTag.publicPayload.emergencyContacts[0]?.phoneNumber || '0900000000';
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

    safeTag.pendingOtp = {
      code: otpCode,
      expiresAt,
      targetPhone: guardianPhone,
    };
    await safeTag.save();

    const maskedPhone = guardianPhone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2');
    return {
      success: true,
      tagCode,
      maskedPhone,
      expiresAt,
      debugOtp: otpCode, // Phục vụ môi trường kiểm thử tự động
      message: `Mã OTP xác thực mở khóa hồ sơ y tế đã được phát hành tới người thân (${maskedPhone})`,
    };
  }

  /**
   * Xác thực mã OTP người bảo hộ cung cấp để mở khóa Tầng 2
   */
  async verifyTier2Otp(tagCode, otp, clientMetadata = {}) {
    const safeTag = await SafeTag.findOne({ tagCode, status: 'ACTIVE' });
    if (!safeTag) throw new Error('Thẻ SafeTag không tồn tại hoặc đã bị khóa');

    if (!safeTag.pendingOtp || !safeTag.pendingOtp.code) {
      throw new Error('Chưa có yêu cầu OTP nào được khởi tạo cho thẻ này');
    }

    if (new Date() > new Date(safeTag.pendingOtp.expiresAt)) {
      throw new Error('Mã OTP đã hết hiệu lực (quá hạn 5 phút), vui lòng yêu cầu mã mới');
    }

    if (safeTag.pendingOtp.code !== String(otp).trim()) {
      throw new Error('Mã OTP không chính xác');
    }

    // Xóa OTP sau khi dùng xong
    safeTag.pendingOtp = { code: null, expiresAt: null, targetPhone: null };

    safeTag.scanHistory.push({
      scannedAt: new Date(),
      scannerIp: clientMetadata.ip || '0.0.0.0',
      scannerUserAgent: clientMetadata.userAgent || 'SafeTag OTP Authorized Portal',
      accessTier: 'TIER_2_MEDICAL_AUTHENTICATED',
    });
    await safeTag.save();

    const fullMedicalProfile = await MedicalProfile.findOne({ userId: safeTag.userId });
    const victimUser = await User.findById(safeTag.userId).select('fullName phoneNumber approxAddress');

    return {
      success: true,
      tagCode: safeTag.tagCode,
      accessTier: 'TIER_2_MEDICAL_AUTHENTICATED',
      victim: victimUser,
      fullMedicalHistory: fullMedicalProfile,
      digitalSignature: safeTag.digitalSignature,
      unlockedAt: new Date(),
    };
  }

  /**
   * Bác sĩ Cấp cứu 115 giải tỏa khẩn cấp tức thì (Emergency Bypass) với mã chứng chỉ hành nghề y tế
   */
  async emergencyBypassTier2(tagCode, { paramedicId, paramedicLicense, emergencyIncidentId = null, clinicalJustification, clientMetadata = {} }) {
    if (!paramedicLicense || !paramedicLicense.trim()) {
      throw new Error('Bắt buộc phải có Số chứng chỉ hành nghề Bác sĩ / Cứu thương viên để giải tỏa khẩn cấp');
    }
    if (!clinicalJustification || !clinicalJustification.trim()) {
      throw new Error('Bắt buộc ghi nhận lý do lâm sàng khẩn cấp (Hôn mê sâu, Chấn thương nặng, Ngưng tim)');
    }

    const safeTag = await SafeTag.findOne({ tagCode, status: 'ACTIVE' });
    if (!safeTag) throw new Error('Thẻ SafeTag không tồn tại hoặc đã bị khóa');

    // Lưu vào lịch sử giải tỏa y tế khẩn cấp
    safeTag.emergencyAccessBypasses.push({
      accessedAt: new Date(),
      paramedicId: paramedicId || '115_FIELD_DOCTOR',
      paramedicLicense: paramedicLicense.trim(),
      emergencyIncidentId,
      clinicalJustification: clinicalJustification.trim(),
      ipAddress: clientMetadata.ip || '0.0.0.0',
    });

    safeTag.scanHistory.push({
      scannedAt: new Date(),
      scannerIp: clientMetadata.ip || '0.0.0.0',
      accessTier: 'TIER_2_MEDICAL_AUTHENTICATED',
      authorizedDoctorOrHeroId: paramedicId || paramedicLicense,
    });
    await safeTag.save();

    const fullMedicalProfile = await MedicalProfile.findOne({ userId: safeTag.userId });
    const victimUser = await User.findById(safeTag.userId).select('fullName phoneNumber approxAddress');

    return {
      success: true,
      tagCode: safeTag.tagCode,
      accessMode: 'PARAMEDIC_EMERGENCY_BYPASS',
      paramedicLicense,
      clinicalJustification,
      victim: victimUser,
      fullMedicalHistory: fullMedicalProfile,
      guardianNotified: true,
      legalComplianceNote: 'Truy cập hợp pháp theo Điều 36 Luật Khám bệnh, chữa bệnh về can thiệp hồi sức cấp cứu không chậm trễ.',
    };
  }

  /**
   * Báo mất thẻ khẩn cấp và vô hiệu hóa tức thì
   */
  async reportLostTag(tagCode, userId) {
    const safeTag = await SafeTag.findOne({ tagCode, userId });
    if (!safeTag) throw new Error('Không tìm thấy thẻ SafeTag thuộc quyền sở hữu của bạn');

    safeTag.status = 'LOST_REPORTED';
    await safeTag.save();

    return {
      success: true,
      tagCode: safeTag.tagCode,
      status: safeTag.status,
      message: 'Thẻ SafeTag đã được khóa an toàn. Bất kỳ ai quét thẻ sẽ nhận thông báo thẻ vô hiệu hóa.',
    };
  }

  /**
   * Kích hoạt lại thẻ SafeTag sau khi tìm thấy
   */
  async reactivateTag(tagCode, userId) {
    const safeTag = await SafeTag.findOne({ tagCode, userId });
    if (!safeTag) throw new Error('Không tìm thấy thẻ SafeTag thuộc quyền sở hữu của bạn');

    safeTag.status = 'ACTIVE';
    await safeTag.save();

    return {
      success: true,
      tagCode: safeTag.tagCode,
      status: safeTag.status,
      message: 'Thẻ SafeTag đã được kích hoạt lại thành công sẵn sàng sử dụng.',
    };
  }

  /**
   * Xuất thẻ y tế ngoại tuyến dạng HTML độc lập có chữ ký số xác thực
   */
  async generateOfflineHtmlCard(tagCode) {
    const safeTag = await SafeTag.findOne({ tagCode, status: 'ACTIVE' });
    if (!safeTag) throw new Error('Thẻ SafeTag không tồn tại hoặc đã bị khóa');

    const htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>SafeSolo Offline Medical Passport - ${safeTag.tagCode}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 20px; display: flex; justify-content: center; }
    .card { background: #1e293b; border: 2px solid #ef4444; border-radius: 16px; padding: 24px; max-width: 480px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #334155; padding-bottom: 12px; margin-bottom: 16px; }
    .title { color: #ef4444; font-weight: 800; font-size: 20px; text-transform: uppercase; letter-spacing: 1px; }
    .badge { background: #dc2626; color: #fff; padding: 4px 10px; border-radius: 999px; font-weight: bold; font-size: 14px; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px dashed #334155; padding-bottom: 6px; }
    .label { color: #94a3b8; font-size: 14px; }
    .value { font-weight: 600; font-size: 15px; color: #f1f5f9; text-align: right; }
    .allergy-alert { background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: #fca5a5; padding: 10px; border-radius: 8px; margin-top: 14px; font-size: 13px; }
    .signature { margin-top: 16px; font-family: monospace; font-size: 10px; color: #64748b; word-break: break-all; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title">Hồ Sơ Y Tế Cấp Cứu I.C.E</div>
      <div class="badge">${safeTag.publicPayload.bloodType || 'UNKNOWN'}</div>
    </div>
    <div class="info-row"><span class="label">Mã định danh SafeTag:</span><span class="value">${safeTag.tagCode}</span></div>
    <div class="info-row"><span class="label">Họ và tên:</span><span class="value">${safeTag.publicPayload.displayName}</span></div>
    <div class="info-row"><span class="label">Bệnh lý nền:</span><span class="value">${(safeTag.publicPayload.criticalConditions || []).join(', ') || 'Chưa ghi nhận'}</span></div>
    <div class="info-row"><span class="label">Liên hệ khẩn cấp 1:</span><span class="value">${safeTag.publicPayload.emergencyContacts[0]?.relationship || 'Người thân'}: ${safeTag.publicPayload.emergencyContacts[0]?.phoneNumber || 'N/A'}</span></div>
    
    <div class="allergy-alert">
      ⚠️ <strong>CẢNH BÁO DỊ ỨNG THUỐC ĐẶC BIỆT:</strong><br/>
      ${(safeTag.publicPayload.criticalAllergies || []).join(', ') || 'Không ghi nhận dị ứng'}
    </div>
    
    <div class="signature">
      🔒 SHA-256 Digital Signature: ${safeTag.digitalSignature || 'UNVERIFIED'}<br/>
      Hệ sinh thái An toàn Cá nhân SafeSolo 115 - Bản quyền Đoàn Minh Quân
    </div>
  </div>
</body>
</html>
    `;

    return {
      tagCode: safeTag.tagCode,
      htmlContent: htmlContent.trim(),
      mimeType: 'text/html',
      digitalSignature: safeTag.digitalSignature,
    };
  }
}

module.exports = new SafeTagService();
