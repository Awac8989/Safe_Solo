require('dotenv').config();
const mongoose = require('mongoose');
const KYCDocument = require('../src/models/KYCDocument');
const User = require('../src/models/User');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB. Seeding Professional Hero KYC Candidates...');

  const candidates = [
    {
      phone: '0988115001',
      fullName: 'Đỗ Thu Trang',
      role: 'user',
      professionCategory: 'MEDICAL_NURSE',
      credentialName: 'Bằng Cử nhân Điều dưỡng & Chứng chỉ Hồi sức Ngoại viện ACLS/BLS',
      credentialNumber: 'BYT-DD-089123',
      issuingAuthority: 'Bộ Y tế & Trung tâm Cấp cứu 115 TP.HCM',
      workingUnit: 'Khoa Cấp Cứu Hồi Sức - Bệnh viện Chợ Rẫy TP.HCM',
      yearsOfExperience: 6,
      faceMatchPercentage: 97,
      livenessVerified: true,
      specialtyTier: 'TIER_PARAMEDIC_MEDIC',
      skillsList: ['CPR_AED', 'AIRWAY_INTUBATION_BLS', 'HEMOSTASIS_CAT', 'ANAPHYLAXIS_EPIPEN', 'IV_ACCESS'],
      theoryExamScore: 20,
      theoryExamPassed: true,
      documentLabel: 'CCCD gắn chip & Bằng Cử nhân Điều dưỡng (Bộ Y tế)',
      address: '201B Nguyễn Chí Thanh, Phường 12, Quận 5, TP.HCM',
    },
    {
      phone: '0988115002',
      fullName: 'Nguyễn Quốc Bảo',
      role: 'user',
      professionCategory: 'POLICE_SECURITY',
      credentialName: 'Thẻ Sĩ quan Công an Nhân dân & Chứng chỉ Nghiệp vụ Trật tự Xã hội',
      credentialNumber: 'BCA-CSHS-994102',
      issuingAuthority: 'Bộ Công an - Công an TP. Hồ Chí Minh',
      workingUnit: 'Đội Cảnh sát Hình sự - Công an TP.HCM',
      yearsOfExperience: 8,
      faceMatchPercentage: 98,
      livenessVerified: true,
      specialtyTier: 'TIER_POLICE_SECURITY',
      skillsList: ['DURESS_CODE_TAKEDOWN', 'TACTICAL_CONTAINMENT', 'CRIME_SCENE_CONTROL', 'FIRST_AID_TRAUMA'],
      theoryExamScore: 19,
      theoryExamPassed: true,
      documentLabel: 'CCCD gắn chip & Thẻ Sĩ quan CAND (Bộ Công an)',
      address: '268 Trần Hưng Đạo, Phường Nguyễn Cư Trinh, Quận 1, TP.HCM',
    },
    {
      phone: '0988115003',
      fullName: 'Lê Văn Tùng',
      role: 'user',
      professionCategory: 'FIRE_RESCUE',
      credentialName: 'Thẻ Cán bộ Cảnh sát PCCC & Giấy chứng nhận Cứu nạn Cứu hộ Chuyên nghiệp',
      credentialNumber: 'PCCC-CNCH-22108',
      issuingAuthority: 'Cục Cảnh sát PCCC & CNCH - Bộ Công an',
      workingUnit: 'Phòng Cảnh sát PCCC & CNCH (PC07) TP.HCM',
      yearsOfExperience: 5,
      faceMatchPercentage: 94,
      livenessVerified: true,
      specialtyTier: 'TIER_FIRE_RESCUE',
      skillsList: ['HIGH_ANGLE_ROPE_RESCUE', 'SMOKE_EVACUATION', 'COLLAPSED_STRUCTURE_SEARCH', 'HYDRAULIC_EXTRICATION'],
      theoryExamScore: 19,
      theoryExamPassed: true,
      documentLabel: 'CCCD gắn chip & Thẻ Cảnh sát PCCC & CNCH (Bộ Công an)',
      address: '258 Ba Tháng Hai, Phường 12, Quận 10, TP.HCM',
    },
    {
      phone: '0988115004',
      fullName: 'Trần Hoàng Nam',
      role: 'user',
      professionCategory: 'WILDERNESS_EXPLORER',
      credentialName: 'Chứng chỉ Cứu Hộ Địa Hình Dã Ngoại Quốc Tế (Wilderness First Responder - WFR)',
      credentialNumber: 'WMAI-WFR-2026-881',
      issuingAuthority: 'Wilderness Medical Associates International (WMAI)',
      workingUnit: 'Đội Thám hiểm Hang động & Cứu nạn Dã ngoại Phong Nha / Fansipan',
      yearsOfExperience: 7,
      faceMatchPercentage: 95,
      livenessVerified: true,
      specialtyTier: 'TIER_WILDERNESS_EXPLORER',
      skillsList: ['WILDERNESS_SPLINTING', 'OFFLINE_GPS_TOPOMAP', 'HYPOTHERMIA_MANAGEMENT', 'EXTREME_TERRAIN_EVAC'],
      theoryExamScore: 19,
      theoryExamPassed: true,
      documentLabel: 'CCCD gắn chip & Chứng chỉ WFR Quốc tế (WMAI)',
      address: 'Thị trấn Phong Nha, Huyện Bố Trạch, Quảng Bình',
    },
    {
      phone: '0988115005',
      fullName: 'Nguyễn Văn Minh (Hồ sơ dân sự - Chưa đủ chuẩn)',
      role: 'user',
      professionCategory: 'UNQUALIFIED_CIVILIAN',
      credentialName: 'Giấy khám sức khỏe lái xe (Chưa có bằng cấp chuyên môn y tế/cứu nạn)',
      credentialNumber: 'GKSK-2026-1102',
      issuingAuthority: 'Phòng khám Đa khoa Tư nhân',
      workingUnit: 'Lao động tự do',
      yearsOfExperience: 0,
      faceMatchPercentage: 74, // Thấp (< 90%)
      livenessVerified: false,
      specialtyTier: 'UNVERIFIED',
      skillsList: [],
      theoryExamScore: 11, // Không đạt (< 18/20)
      theoryExamPassed: false,
      documentLabel: 'CCCD (Thiếu bằng cấp chuyên môn cứu hộ)',
      address: '123 Đường Số 5, Phường Linh Xuân, TP. Thủ Đức',
    },
  ];

  for (const c of candidates) {
    let user = await User.findOne({ phoneNumber: c.phone });
    if (!user) {
      user = await User.create({
        phoneNumber: c.phone,
        fullName: c.fullName,
        role: c.role,
        isKycVerified: false,
        trustScore: c.faceMatchPercentage > 90 ? 4.9 : 3.8,
        rescuesCount: c.yearsOfExperience * 3,
        nextDeadline: new Date(Date.now() + 3600000 * 24),
        lastCheckinTime: new Date(),
      });
    }

    await KYCDocument.findOneAndUpdate(
      { userId: String(user._id) },
      {
        $set: {
          userId: String(user._id),
          frontImageUrl: `https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80`,
          backImageUrl: `https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80`,
          selfieImageUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80`,
          faceMatchPercentage: c.faceMatchPercentage,
          livenessVerified: c.livenessVerified,
          professionCategory: c.professionCategory,
          credentialName: c.credentialName,
          credentialNumber: c.credentialNumber,
          issuingAuthority: c.issuingAuthority,
          workingUnit: c.workingUnit,
          yearsOfExperience: c.yearsOfExperience,
          specialtyTier: c.specialtyTier,
          skillsList: c.skillsList,
          theoryExamScore: c.theoryExamScore,
          theoryExamPassed: c.theoryExamPassed,
          status: 'PENDING',
          submittedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );
  }

  console.log('Seeded 5 candidates successfully!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
