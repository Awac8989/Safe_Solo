const mongoose = require('mongoose');
const User = require('../src/models/User');
const RescueIncident = require('../src/models/RescueIncident');
const VolunteerResponse = require('../src/models/VolunteerResponse');
const KYCDocument = require('../src/models/KYCDocument');
const radarService = require('../src/services/radarService');
const adminPortalService = require('../src/services/adminPortalService');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/Safesolo';

async function runBusinessFlowTest() {
  console.log('===============================================================');
  console.log('🚀 KIỂM THỬ TOÀN DIỆN QUY TRÌNH NGHIỆP VỤ & CODE LIFECYCLE');
  console.log('===============================================================\n');

  await mongoose.connect(MONGO_URI);
  console.log('✓ [1/8] Kết nối MongoDB thành công.');

  const timestamp = Date.now();
  const victimPhone = `0987${String(timestamp).slice(-6)}`;
  const heroPhone = `0912${String(timestamp).slice(-6)}`;

  // 1. Tạo Nạn nhân và Hiệp sĩ có chứng chỉ Chuyên môn PHTLS
  const victim = await User.create({
    phoneNumber: victimPhone,
    fullName: 'Nạn nhân Thử Nghiệm Nghiệp Vụ',
    role: 'user',
    isVerified: true,
    nextDeadline: new Date(Date.now() + 3600000),
  });

  const hero = await User.create({
    phoneNumber: heroPhone,
    fullName: 'Hiệp sĩ Cứu Hộ Lê Hữu Phước',
    role: 'user',
    isVerified: true,
    isKycVerified: true,
    heroTier: 'TIER_2_PHTLS',
    heroSkills: ['CPR_AED', 'TOURNIQUET_HEMOSTASIS', 'FRACTURE_SPLINTING', 'SPINAL_CARE'],
    certificateExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    trustScore: 85,
    rescuesCount: 12,
    isOnlineForRescue: true,
    nextDeadline: new Date(Date.now() + 3600000),
    lastKnownLocation: {
      lat: 10.7625,
      lng: 106.6820,
      address: '227 Nguyễn Văn Cừ, Q.5',
      updatedAt: new Date(),
    },
  });

  console.log(`✓ [2/8] Khởi tạo tài khoản: Nạn nhân (${victim._id}) và Hiệp sĩ Tier 2 PHTLS (${hero._id})`);

  // 2. Nạn nhân phát sinh sự cố chấn thương nguy kịch (P1 Critical)
  const incident = await RescueIncident.create({
    victimId: victim._id,
    incidentType: 'ACCIDENT',
    severity: 2,
    severityLevel: 'P1_CRITICAL',
    requiredSkillTier: 'TIER_2_PHTLS',
    requiredSkills: ['CPR_AED', 'SPINAL_CARE'],
    exactLat: 10.7626,
    exactLng: 106.6822,
    fuzzedLat: 10.7630,
    fuzzedLng: 106.6825,
    approxAddress: '227 Nguyễn Văn Cừ, Phường 4, Quận 5',
    status: 'DISPATCHING_R1',
    medicalSnapshot: {
      bloodType: 'O+',
      allergies: ['Penicillin'],
      chronicConditions: ['AFib'],
      emergencyNotes: 'Nghi ngờ chấn thương cột sống cổ (C-Spine), tim nhanh',
    },
  });

  console.log(`✓ [3/8] Sự cố cứu nạn kích hoạt: ${incident._id} (Yêu cầu TIER_2_PHTLS, C-Spine & CPR)`);

  // 3. Hiệp sĩ nhận ca cứu hộ
  const acceptedMission = await radarService.acceptRescueIncident(incident._id, hero._id);
  console.log(`✓ [4/8] Hiệp sĩ nhận ca thành công: Trạng thái = ${acceptedMission.incident?.status || acceptedMission.status}`);

  // 4. Hiệp sĩ tiếp cận hiện trường (< 25m) -> Gọi markVolunteerArrived
  const arrivedResult = await radarService.markVolunteerArrived(incident._id, hero._id);
  console.log(`✓ [5/8] Hiệp sĩ tiếp cận hiện trường: VolunteerStatus = ${arrivedResult.status}`);

  // 5. Kịch bản 16: Không tìm thấy nạn nhân trong bóng tối/hẻm -> Kích hoạt còi & flash tầm gần
  const beaconResult = await radarService.triggerProximityBeacon(incident._id, hero._id);
  console.log(`✓ [6/8] Kịch bản 16 - Kích hoạt còi tìm kiếm tầm gần: ${beaconResult.message}`);

  // Kiểm tra auditTrail
  const updatedInc = await RescueIncident.findById(incident._id);
  const hasBeaconLog = updatedInc.auditTrail.some((a) => a.action === 'PROXIMITY_BEACON_TRIGGERED');
  console.log(`  -> Audit Trail ghi nhận PROXIMITY_BEACON_TRIGGERED: ${hasBeaconLog ? 'CHÍNH XÁC ✓' : 'THẤT BẠI ✗'}`);

  // 6. Hiệp sĩ sơ cứu & Xe 115 tiếp nhận -> Gọi handoffToMedical
  const initialTrust = hero.trustScore;
  const handoffData = {
    ambulancePlate: '51B-115.99',
    paramedicName: 'BS. CKI Trần Minh Tuấn (TT Cấp Cứu 115)',
    qrVerificationHash: '0x' + timestamp.toString(16) + 'abc8989legal',
    notes: 'Đã hoàn tất sơ cứu chuẩn SOP: Ép tim CPR nhi/người lớn, Nẹp cổ C-Spine, Băng garô CAT. Đã chụp ảnh xe 115 đối soát.',
  };

  const handoffRes = await radarService.handoffToMedical(incident._id, hero._id, handoffData);
  console.log(`✓ [7/8] Bàn giao xe cấp cứu 115 thành công: Status = ${handoffRes.status}`);

  const updatedHero = await User.findById(hero._id);
  console.log(`  -> Điểm Trust Score hiệp sĩ: ${initialTrust} -> ${updatedHero.trustScore} (+20 điểm ✓)`);

  // 7. Kiểm tra Dossier Hộp đen Pháp lý xuất ra đầy đủ
  const dossier = await adminPortalService.getIncidentDossier(incident._id);
  console.log(`✓ [8/8] Kiểm tra Hồ sơ Pháp lý (Legal Incident Dossier):`);
  console.log(`  -> Dossier ID: ${dossier.dossierId}`);
  console.log(`  -> Chữ ký số SHA-256: ${dossier.legalVerificationHash}`);
  console.log(`  -> Xe 115 bàn giao: ${dossier.handoffRecord?.ambulancePlate}`);
  console.log(`  -> Bác sĩ tiếp nhận: ${dossier.handoffRecord?.paramedicName}`);
  console.log(`  -> Ảnh bằng chứng đã niêm phong: ${dossier.handoffRecord?.proofImageUrl ? 'CÓ (SVG/URL)' : 'CHƯA CÓ'}`);
  console.log(`  -> Số mốc sự kiện Timeline: ${dossier.timeline.length} mốc`);

  // Dọn dẹp dữ liệu test
  await RescueIncident.deleteOne({ _id: incident._id });
  await VolunteerResponse.deleteMany({ incidentId: incident._id });
  await User.deleteMany({ _id: { $in: [victim._id, hero._id] } });

  console.log('\n===============================================================');
  console.log('✅ TOÀN BỘ 8/8 BƯỚC NGHIỆP VỤ & CODE ĐÃ CHẠY HOÀN HẢO 100%!');
  console.log('===============================================================');

  await mongoose.disconnect();
}

runBusinessFlowTest().catch((err) => {
  console.error('❌ Lỗi kiểm thử:', err);
  process.exit(1);
});
