const mongoose = require('mongoose');
const KYCDocument = require('../src/models/KYCDocument');
const User = require('../src/models/User');
const { certificationWatchdog } = require('../src/workers/certificationWatchdog');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/Safesolo';

async function testCertWatchdog() {
  console.log('================================================================');
  console.log('🔍 KIỂM THỬ THU HỒI CHỨNG CHỈ HẾT HẠN (KỊCH BẢN 24 SOP v2.1)');
  console.log('================================================================\n');

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(MONGO_URI);
  }

  // 1. Tạo hoặc cập nhật 1 Hiệp sĩ có chứng chỉ đã hết hạn từ 30 ngày trước
  const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  let testHero = await User.findOne({ phoneNumber: '0988776655' });
  if (!testHero) {
    testHero = await User.create({
      fullName: 'Trần Văn Hết Hạn',
      phoneNumber: '0988776655',
      role: 'user',
      isVerified: true,
      isKycVerified: true,
      heroTier: 'TIER_1_BLS',
      nextDeadline: new Date(Date.now() + 86400000),
    });
  } else {
    testHero.isKycVerified = true;
    testHero.heroTier = 'TIER_1_BLS';
    await testHero.save();
  }

  await KYCDocument.findOneAndUpdate(
    { userId: testHero._id },
    {
      userId: testHero._id,
      frontImageUrl: '/uploads/kyc/test-front.png',
      backImageUrl: '/uploads/kyc/test-back.png',
      certificateNumber: 'EXPIRED-CERT-2022',
      specialtyTier: 'TIER_1_BLS',
      status: 'APPROVED',
      expiryDate: pastDate,
    },
    { upsert: true, new: true }
  );

  console.log(`[BƯỚC 1] Khởi tạo Hiệp sĩ: ${testHero.fullName} (${testHero._id})`);
  console.log(`  -> Trạng thái ban đầu: isKycVerified = ${testHero.isKycVerified}, heroTier = ${testHero.heroTier}`);
  console.log(`  -> Ngày hết hạn chứng chỉ: ${pastDate.toISOString()} (ĐÃ QUÁ HẠN 30 NGÀY)\n`);

  // 2. Kích hoạt quét tự động của CertificationWatchdog
  console.log('[BƯỚC 2] Kích hoạt CertificationWatchdog quét hệ thống...');
  const result = await certificationWatchdog.scanAndRevokeExpiredCertificates();
  console.log('  -> Kết quả quét:', result);

  // 3. Kiểm tra kết quả thu hồi
  const updatedHero = await User.findById(testHero._id);
  const updatedDoc = await KYCDocument.findOne({ userId: testHero._id });

  console.log('\n[BƯỚC 3] Đối soát trạng thái sau khi Watchdog can thiệp:');
  console.log(`  -> KYCDocument status: ${updatedDoc.status} (Kỳ vọng: EXPIRED)`);
  console.log(`  -> User heroTier: ${updatedHero.heroTier} (Kỳ vọng: NONE)`);
  console.log(`  -> User isKycVerified: ${updatedHero.isKycVerified} (Kỳ vọng: false)`);

  const isSuccess = updatedDoc.status === 'EXPIRED' && updatedHero.heroTier === 'NONE' && updatedHero.isKycVerified === false;

  console.log('\n================================================================');
  if (isSuccess) {
    console.log('🎉 XÁC MINH THÀNH CÔNG: WATCHDOG ĐÃ TỰ ĐỘNG THU HỒI QUYỀN HIỆP SĨ!');
  } else {
    console.error('❌ THẤT BẠI: Trạng thái chưa được cập nhật chính xác.');
  }
  console.log('================================================================');

  await mongoose.disconnect();
  process.exit(isSuccess ? 0 : 1);
}

testCertWatchdog().catch(err => {
  console.error('LỖI:', err);
  process.exit(1);
});
