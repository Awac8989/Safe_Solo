const KYCDocument = require('../models/KYCDocument');
const User = require('../models/User');

class CertificationWatchdog {
  constructor() {
    this.timer = null;
    this.intervalMs = 60 * 60 * 1000; // Quét mỗi 1 giờ
  }

  async scanAndRevokeExpiredCertificates() {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    try {
      // 1. Quét các chứng chỉ đã hết hạn (< now) nhưng trạng thái vẫn APPROVED
      const expiredDocs = await KYCDocument.find({
        expiryDate: { $ne: null, $lt: now },
        status: { $in: ['APPROVED', 'PENDING'] },
      });

      for (const doc of expiredDocs) {
        doc.status = 'EXPIRED';
        await doc.save();

        await User.findByIdAndUpdate(doc.userId, {
          heroTier: 'NONE',
          isKycVerified: false,
        });

        console.log(
          `[CertWatchdog] ⚠️ Thu hồi quyền Hiệp sĩ: User [${doc.userId}] do chứng chỉ hết hạn ngày ${doc.expiryDate?.toISOString()}`
        );
      }

      // 2. Quét các chứng chỉ sắp hết hạn trong 30 ngày để ghi log cảnh báo
      const warningDocs = await KYCDocument.find({
        expiryDate: { $gte: now, $lte: in30Days },
        status: 'APPROVED',
      });

      if (warningDocs.length > 0) {
        console.log(
          `[CertWatchdog] ℹ️ Có ${warningDocs.length} Hiệp sĩ có chứng chỉ sắp hết hạn trong 30 ngày cần tái đào tạo (Recertification).`
        );
      }

      return {
        scannedAt: now.toISOString(),
        revokedCount: expiredDocs.length,
        warningCount: warningDocs.length,
      };
    } catch (err) {
      console.error('[CertWatchdog] Lỗi khi quét hạn dùng chứng chỉ:', err.message);
      return { error: err.message };
    }
  }

  start() {
    if (this.timer) clearInterval(this.timer);
    console.log('[CertWatchdog] Certification watchdog worker started (Interval: 1h)');
    // Chạy ngay 1 lần khi khởi động
    this.scanAndRevokeExpiredCertificates();
    this.timer = setInterval(() => {
      this.scanAndRevokeExpiredCertificates();
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

const certificationWatchdog = new CertificationWatchdog();

module.exports = {
  certificationWatchdog,
  startCertificationWatchdog: () => certificationWatchdog.start(),
};
