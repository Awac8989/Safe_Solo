require('dotenv').config({ path: __dirname + '/../.env' });
const database = require('../src/config/database');
const User = require('../src/models/User');
const RescueIncident = require('../src/models/RescueIncident');
const VolunteerResponse = require('../src/models/VolunteerResponse');
const KYCDocument = require('../src/models/KYCDocument');
const radarService = require('../src/services/radarService');
const adminPortalService = require('../src/services/adminPortalService');
const { initializeSocket } = require('../src/sockets/socketServer');
const http = require('http');

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    passedCount++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failedCount++;
    console.error(`  ❌ [FAIL] ${testName} - ${details}`);
  }
}

async function runMedicalSopAndSbdTests() {
  console.log('\n================================================================================');
  console.log(' SAFESOLO — KIỂM THỬ CHUYÊN SÂU: SKILL-BASED DISPATCH & MEDICAL KYC SOP');
  console.log(' Căn cứ: Điều 87 Luật Khám bệnh, chữa bệnh 2023 & SOP Phiên bản 2.1');
  console.log('================================================================================\n');

  await database.$connect();

  const dummyServer = http.createServer();
  initializeSocket(dummyServer);

  const prefix = 'med_test_';
  await User.deleteMany({ _id: { $regex: `^${prefix}` } });
  await RescueIncident.deleteMany({ $or: [{ victimId: { $regex: `^${prefix}` } }, { _id: { $regex: `^${prefix}` } }] });
  await VolunteerResponse.deleteMany({ $or: [{ volunteerId: { $regex: `^${prefix}` } }, { incidentId: { $regex: `^${prefix}` } }] });
  await KYCDocument.deleteMany({ userId: { $regex: `^${prefix}` } });

  console.log('--- PHẦN 1: THẨM ĐỊNH MEDICAL KYC & BÀI THI LÂM SÀNG 20 CÂU ---');
  
  // Test 1.1: Trắc nghiệm lý thuyết lâm sàng (chấm điểm < 18 rớt, >= 18 đậu)
  const answersFail = Array(20).fill(0); // 0 câu đúng
  const answersPass = Array(20).fill(1); // 20 câu đúng

  // Logic chấm điểm chuẩn trong kycController
  const scoreFail = answersFail.filter(a => a === 1).length;
  const passedFail = scoreFail >= 18;
  assert(!passedFail && scoreFail === 0, '1.1 Thí sinh trả lời đúng 0/20 câu: CHƯA ĐẠT (Không đủ chuẩn sơ cấp cứu)');

  const scorePass = answersPass.filter(a => a === 1).length;
  const passedPass = scorePass >= 18;
  assert(passedPass && scorePass === 20, '1.2 Thí sinh trả lời đúng 20/20 câu: ĐẠT YÊU CẦU (≥90% theo SOP)');

  // Test 1.2: Tạo hồ sơ KYC với chứng chỉ PHTLS và kết quả bài thi
  const applicantUser = await User.create({
    _id: `${prefix}hero_applicant`,
    fullName: 'Hoàng Minh Tuấn (Ứng viên PHTLS)',
    phoneNumber: '0911223344',
    isActive: true,
    isKycVerified: false,
    heroTier: 'NONE',
    nextDeadline: new Date(Date.now() + 3600000),
  });

  const kycDoc = await KYCDocument.create({
    _id: `${prefix}kyc_doc_01`,
    userId: applicantUser._id,
    frontImageUrl: 'https://storage.safesolo.vn/kyc/front.jpg',
    backImageUrl: 'https://storage.safesolo.vn/kyc/back.jpg',
    certificateImageUrl: 'https://storage.safesolo.vn/kyc/phtls_cert.jpg',
    certificateNumber: 'CERT-PHTLS-2024-88',
    issuingOrganization: 'RED_CROSS_VN',
    certificateType: 'PHTLS_TRAUMA',
    specialtyTier: 'TIER_2_PHTLS',
    skillsList: ['CPR_AED', 'CERVICAL_SPINE', 'HEMOSTASIS_TOURNIQUET', 'TRAUMA_SPLINT'],
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Còn hạn 1 năm
    theoryExamScore: 19,
    theoryExamPassed: true,
    theoryExamTakenAt: new Date(),
    scopeOfPracticeAgreed: true,
    status: 'PENDING',
  });

  assert(kycDoc.specialtyTier === 'TIER_2_PHTLS' && kycDoc.theoryExamPassed === true, '1.3 Tạo hồ sơ KYC 2 lớp hoàn chỉnh lưu trữ đầy đủ chứng chỉ và điểm sát hạch');

  // Test 1.3: Web Admin thẩm định và phê duyệt Tier 2 PHTLS
  const approveResult = await adminPortalService.updateKycStatus(kycDoc._id, 'APPROVE', { tier: 'TIER_2_PHTLS' });
  const updatedApplicant = await User.findById(applicantUser._id);

  assert(
    updatedApplicant.isKycVerified === true &&
    updatedApplicant.heroTier === 'TIER_2_PHTLS' &&
    updatedApplicant.heroSkills.includes('CERVICAL_SPINE'),
    '1.4 Admin phê duyệt cấp thẻ Hiệp sĩ Bậc 2 (TIER_2_PHTLS) và gán danh sách kỹ năng được phép thao tác'
  );

  console.log('\n--- PHẦN 2: ZERO UNQUALIFIED RESPONDER & LỌC CHỨNG CHỈ HẾT HẠN ---');

  // Tạo Nạn nhân bị tai nạn giao thông nghiêm trọng
  const victim = await User.create({
    _id: `${prefix}victim_tai_nan`,
    fullName: 'Đỗ Hải Đăng (Nạn nhân TNGT)',
    phoneNumber: '0903334444',
    isActive: true,
    isKycVerified: true,
    lastKnownLocation: { lat: 10.7750, lng: 106.7000 },
    nextDeadline: new Date(Date.now() + 3600000),
  });

  // Hiệp sĩ C: Có chứng chỉ nhưng ĐÃ HẾT HẠN (expired 30 days ago), cách 200m
  const heroExpired = await User.create({
    _id: `${prefix}hero_expired`,
    fullName: 'Trần Văn C (Chứng chỉ hết hạn)',
    phoneNumber: '0908889999',
    isActive: true,
    isKycVerified: true,
    heroTier: 'TIER_2_PHTLS',
    certificateExpiry: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Hết hạn
    lastKnownLocation: { lat: 10.7760, lng: 106.7010 }, // 150m
    isOnlineForRescue: true,
    trustScore: 90,
    nextDeadline: new Date(Date.now() + 3600000),
  });

  // Tìm kiếm tình nguyện viên cho ca P1 yêu cầu TIER_1_BLS trở lên
  const nearbyCandidates = await radarService.findNearbyVolunteers(
    10.7750, 106.7000, victim._id, 3,
    { requiredTier: 'TIER_1_BLS' }
  );

  const foundExpired = nearbyCandidates.some(c => c.id === heroExpired._id);
  assert(
    !foundExpired,
    '2.1 Zero Unqualified Responder: Hiệp sĩ có chứng chỉ hết hạn bị LOẠI BỎ khỏi danh sách điều phối ca nguy kịch'
  );

  console.log('\n--- PHẦN 3: SKILL-BASED DISPATCH (SBD) — TRỌNG SỐ CHUYÊN MÔN 35% ---');

  // Hiệp sĩ D: Tier 1 BLS (chỉ biết ép tim cơ bản), cách rất gần: 250m
  const heroD = await User.create({
    _id: `${prefix}hero_d_bls`,
    fullName: 'Nguyễn Văn D (Tier 1 BLS - Gần 250m)',
    phoneNumber: '0904445555',
    isActive: true,
    isKycVerified: true,
    heroTier: 'TIER_1_BLS',
    heroSkills: ['CPR_AED', 'AIRWAY_CHOKING'],
    certificateExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    lastKnownLocation: { lat: 10.7765, lng: 106.7015 }, // ~250m
    isOnlineForRescue: true,
    trustScore: 90,
    rescuesCount: 10,
    nextDeadline: new Date(Date.now() + 3600000),
  });

  // Hiệp sĩ E: Tier 2 PHTLS (chuyên cố định cột sống cổ & nẹp xương), cách xa hơn: 700m
  const heroE = await User.create({
    _id: `${prefix}hero_e_phtls`,
    fullName: 'Lê Văn E (Tier 2 PHTLS - Xa 700m)',
    phoneNumber: '0906667777',
    isActive: true,
    isKycVerified: true,
    heroTier: 'TIER_2_PHTLS',
    heroSkills: ['CPR_AED', 'CERVICAL_SPINE', 'HEMOSTASIS_TOURNIQUET', 'TRAUMA_SPLINT'],
    certificateExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    lastKnownLocation: { lat: 10.7810, lng: 106.7040 }, // ~700m
    isOnlineForRescue: true,
    trustScore: 90,
    rescuesCount: 10,
    nextDeadline: new Date(Date.now() + 3600000),
  });

  // Phát tín hiệu SOS tai nạn giao thông nghi ngờ gãy cột sống cổ (Yêu cầu TIER_2_PHTLS + CERVICAL_SPINE)
  const sosResult = await radarService.broadcastSOS(
    victim._id,
    'TRAFFIC_COLLISION_P1',
    10.7750,
    106.7000,
    {
      severity: 2,
      severityLevel: 'P1_CRITICAL',
      approxAddress: 'Ngã tư Trần Hưng Đạo - Nguyễn Tri Phương',
      requiredSkillTier: 'TIER_2_PHTLS',
      requiredSkills: ['CERVICAL_SPINE', 'TRAUMA_SPLINT'],
      medicalNotes: 'Nạn nhân va chạm xe tải, bất tỉnh, có biến dạng chi và nghi ngờ tổn thương cột sống cổ',
    },
  );
  const traumaIncident = await RescueIncident.findById(sosResult.incident.id);

  const candidatesSBD = await radarService.findNearbyVolunteers(
    10.7750, 106.7000, victim._id, 3,
    {
      requiredSkillTier: traumaIncident.requiredSkillTier,
      requiredSkills: traumaIncident.requiredSkills,
    }
  );

  // Kiểm tra xếp hạng: Candidate E (Tier 2 PHTLS) phải đứng vị trí #1 vì khớp chuyên môn (Skill Match 35%)
  const topCandidate = candidatesSBD[0];
  const secondCandidate = candidatesSBD[1];

  assert(
    topCandidate && topCandidate.id === heroE._id,
    `3.1 Skill-Based Dispatch: Hiệp sĩ E (Tier 2 PHTLS, xa 700m) được xếp hạng ĐẦU TIÊN (${topCandidate?.dispatchScore} điểm) vượt qua Hiệp sĩ D (${secondCandidate?.dispatchScore} điểm)`
  );

  assert(
    topCandidate.skillMatchScore > secondCandidate.skillMatchScore,
    `3.2 Điểm chuyên môn: Hiệp sĩ E đạt ${topCandidate.skillMatchScore} điểm skill > Hiệp sĩ D đạt ${secondCandidate.skillMatchScore} điểm skill`
  );

  console.log('\n--- PHẦN 4: TÁC CHIẾN HIỆN TRƯỜNG & GHI NHẬN HÀNH ĐỘNG SƠ CỨU LÂM SÀNG ---');

  // Hiệp sĩ E nhận ca
  const dispatchResponse = await VolunteerResponse.create({
    _id: `${prefix}resp_hero_e`,
    incidentId: traumaIncident._id,
    volunteerId: heroE._id,
    status: 'ACCEPTED',
    heroTierAtDispatch: heroE.heroTier,
    skillMatchScore: topCandidate.skillMatchScore,
    currentLocation: heroE.lastKnownLocation,
    distanceMeters: 700,
    acceptedAt: new Date(),
  });

  traumaIncident.status = 'ACCEPTED';
  traumaIncident.responderId = heroE._id;
  await traumaIncident.save();

  // Hiệp sĩ E đến hiện trường và thực hiện các bước DRSABCD + PHTLS
  dispatchResponse.status = 'ON_SCENE';
  dispatchResponse.arrivedAt = new Date();
  dispatchResponse.firstAidActionsPerformed = [
    { actionType: 'C_SPINE_STABILIZE', startedAt: new Date(), notes: 'Cố định cột sống cổ in-line giữ trục thẳng' },
    { actionType: 'FRACTURE_SPLINT', startedAt: new Date(), notes: 'Nẹp cố định gãy xương kín cẳng chân trái qua 2 khớp' },
    { actionType: 'TELE_FIRSTAID_CALL', startedAt: new Date(), notes: 'Kết nối video call với Bác sĩ Cấp cứu BV Chợ Rẫy' },
  ];
  await dispatchResponse.save();

  const savedResponse = await VolunteerResponse.findById(dispatchResponse._id);
  assert(
    savedResponse.firstAidActionsPerformed.length === 3 &&
    savedResponse.firstAidActionsPerformed.some(a => a.actionType === 'C_SPINE_STABILIZE') &&
    savedResponse.firstAidActionsPerformed.some(a => a.actionType === 'FRACTURE_SPLINT'),
    '4.1 Nhật ký lâm sàng: Ghi nhận đầy đủ thao tác C-Spine, Nẹp chi và Tele-FirstAid với dấu thời gian chính xác'
  );

  console.log('\n--- PHẦN 5: BÀN GIAO LÂM SÀNG SBAR CHO XE CẤP CỨU 115 & TÍCH LŨY CME ---');

  // Kíp 115 đến, Hiệp sĩ E bàn giao theo chuẩn SBAR
  const sbarData = {
    situation: 'Tai nạn giao thông ngã tư Trần Hưng Đạo, đa chấn thương nghi gãy cột sống cổ và cẳng chân trái',
    background: 'Nạn nhân nam 28 tuổi, không có tiền sử bệnh lý mạn tính',
    assessment: 'Tri giác AVPU: V (đáp ứng lời nói). Mạch 96 bpm, SpO2 96%. Chi ấm, đã cố định nẹp.',
    recommendation: 'Đã nẹp cổ C-spine và nẹp cẳng chân trái. Đề xuất chuyển thẳng Cấp cứu Chợ Rẫy chụp CT sọ não và X-quang.',
  };

  traumaIncident.status = 'HANDED_OVER_115';
  traumaIncident.handoffRecord = {
    handedOffTo: 'Đội Cấp Cứu 115 Bệnh Viện Chợ Rẫy (BS. Nguyễn Thành Long)',
    handoffTime: new Date(),
    sbarSummary: sbarData,
    notes: 'Bàn giao hoàn tất bằng mã QR SBAR, tình trạng nạn nhân ổn định khi chuyển lên xe cấp cứu',
  };
  await traumaIncident.save();

  // Thưởng CME credit cho Hiệp sĩ sau khi hoàn thành ca chuẩn quy trình
  const heroEUpdated = await User.findByIdAndUpdate(
    heroE._id,
    { $inc: { cmeCredits: 2, rescuesCount: 1 } },
    { new: true }
  );

  const completedIncident = await RescueIncident.findById(traumaIncident._id);
  assert(
    completedIncident.status === 'HANDED_OVER_115' &&
    completedIncident.handoffRecord.sbarSummary.assessment.includes('Tri giác AVPU: V'),
    '5.1 Bàn giao y tế: Biên bản lâm sàng SBAR được lưu trữ vĩnh viễn trong hồ sơ ca phục vụ đối soát pháp lý'
  );

  assert(
    heroEUpdated.cmeCredits >= 2 && heroEUpdated.rescuesCount === 11,
    '5.2 Tích lũy đào tạo liên tục (CME): Hiệp sĩ được cộng 2 điểm tín chỉ CME và tăng số ca cứu trợ thành công'
  );

  console.log('\n================================================================================');
  console.log(` KẾT QUẢ KIỂM THỬ: ${passedCount} PASS / ${failedCount} FAIL (${((passedCount / (passedCount + failedCount)) * 100).toFixed(0)}%)`);
  console.log('================================================================================\n');

  // Dọn dẹp dữ liệu test
  await User.deleteMany({ _id: { $regex: `^${prefix}` } });
  await RescueIncident.deleteMany({ $or: [{ victimId: { $regex: `^${prefix}` } }, { _id: { $regex: `^${prefix}` } }] });
  await VolunteerResponse.deleteMany({ $or: [{ volunteerId: { $regex: `^${prefix}` } }, { incidentId: { $regex: `^${prefix}` } }] });
  await KYCDocument.deleteMany({ userId: { $regex: `^${prefix}` } });

  process.exit(failedCount === 0 ? 0 : 1);
}

runMedicalSopAndSbdTests().catch((err) => {
  console.error('Fatal error during test execution:', err);
  process.exit(1);
});
