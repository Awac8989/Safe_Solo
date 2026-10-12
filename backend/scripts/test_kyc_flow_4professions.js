require('dotenv').config({ path: __dirname + '/../.env' });
const database = require('../src/config/database');
const User = require('../src/models/User');
const KYCDocument = require('../src/models/KYCDocument');

async function testKycProfessions() {
  await database.$connect();
  console.log('\n================================================================================');
  console.log(' SAFESOLO — KIỂM THỬ KHỐI NGÀNH KYC HIỆP SĨ (Y TẾ • CAND • PCCC • DÃ NGOẠI)');
  console.log('================================================================================\n');

  const testCases = [
    {
      userId: 'test_hero_police_01',
      fullName: 'Trung úy Nguyễn Quốc Bảo',
      professionCategory: 'POLICE_SECURITY',
      credentialName: 'Thẻ ngành Sĩ quan CAND',
      credentialNumber: 'CAND-HCM-88219',
      issuingAuthority: 'Bộ Công an Việt Nam',
      workingUnit: 'Công an Phường Bến Nghé, Quận 1, TP.HCM',
      yearsOfExperience: 5,
      specialtyTier: 'TIER_POLICE_SECURITY',
    },
    {
      userId: 'test_hero_fire_02',
      fullName: 'Thượng úy Đặng Minh Tuấn',
      professionCategory: 'FIRE_RESCUE',
      credentialName: 'Chứng nhận Huấn luyện Chữa cháy & CNCH Đặc nhiệm',
      credentialNumber: 'CNCH-PCCC-4412',
      issuingAuthority: 'Cục Cảnh sát PCCC & CNCH',
      workingUnit: 'Đội Chữa cháy & CNCH Khu vực 1',
      yearsOfExperience: 7,
      specialtyTier: 'TIER_FIRE_RESCUE',
    },
    {
      userId: 'test_hero_wfr_03',
      fullName: 'Trần Đăng Khoa (Thám hiểm)',
      professionCategory: 'WILDERNESS_EXPLORER',
      credentialName: 'Chứng chỉ Wilderness First Responder (WFR Quốc tế)',
      credentialNumber: 'WFR-WMA-2024-99',
      issuingAuthority: 'Wilderness Medical Associates (WMA)',
      workingUnit: 'Đội Tìm kiếm Cứu nạn Dã ngoại Hoàng Liên Sơn',
      yearsOfExperience: 4,
      specialtyTier: 'TIER_WILDERNESS_EXPLORER',
    },
    {
      userId: 'test_hero_nurse_04',
      fullName: 'ĐD. Hoàng Kim Ngân',
      professionCategory: 'MEDICAL_NURSE',
      credentialName: 'Chứng chỉ Hành nghề Khám bệnh, chữa bệnh (CCHN)',
      credentialNumber: 'CCHN-SYT-01992',
      issuingAuthority: 'Sở Y tế TP. Hồ Chí Minh',
      workingUnit: 'Khoa Cấp cứu A9 - Bệnh viện 115',
      yearsOfExperience: 6,
      specialtyTier: 'TIER_PARAMEDIC_MEDIC',
    },
  ];

  for (const tc of testCases) {
    await User.findOneAndUpdate(
      { _id: tc.userId },
      {
        $set: {
          fullName: tc.fullName,
          phoneNumber: '090' + Math.floor(1000000 + Math.random() * 9000000),
          role: 'hero',
          isHero: true,
          isKycVerified: false,
          heroTier: tc.specialtyTier,
          nextDeadline: new Date(Date.now() + 86400000),
        },
      },
      { upsert: true, new: true }
    );

    const doc = await KYCDocument.findOneAndUpdate(
      { userId: tc.userId },
      {
        $set: {
          userId: tc.userId,
          frontImageUrl: '/uploads/kyc/sample_cccd_front.jpg',
          backImageUrl: '/uploads/kyc/sample_cccd_back.jpg',
          credentialImageUrl: '/uploads/kyc/sample_cert.jpg',
          professionCategory: tc.professionCategory,
          credentialName: tc.credentialName,
          credentialNumber: tc.credentialNumber,
          issuingAuthority: tc.issuingAuthority,
          workingUnit: tc.workingUnit,
          yearsOfExperience: tc.yearsOfExperience,
          specialtyTier: tc.specialtyTier,
          status: 'PENDING',
          theoryExamScore: 20,
          theoryExamPassed: true,
          scopeOfPracticeAgreed: true,
          submittedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    console.log(`  ✅ [CREATED] ${tc.professionCategory} -> ${tc.fullName} (${tc.credentialName} | ${tc.credentialNumber})`);
  }

  console.log('\n--- TỔNG HỢP KIỂM THỬ THÀNH CÔNG: 4 HỒ SƠ 4 KHỐI NGÀNH ĐÃ ĐƯỢC NẠP VÀO DATABASE ---');
  await database.$disconnect();
}

testKycProfessions().catch(console.error);
