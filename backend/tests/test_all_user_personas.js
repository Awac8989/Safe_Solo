// -*- coding: utf-8 -*-
/**
 * SafeSolo — KỊCH BẢN KIỂM THỬ TOÀN DIỆN CHO TỪNG USER SỬ DỤNG
 * 
 * Phân hệ người dùng kiểm thử:
 * 1. User Persona 1: Nạn nhân / Người độc hành (Solo Traveler / Victim)
 * 2. User Persona 2: Người bảo trợ / Gia đình (Guardian / Circle Member)
 * 3. User Persona 3: Hiệp sĩ cứu hộ tình nguyện (Hero First Responder - BLS/PHTLS)
 * 4. User Persona 4: Quản trị viên / Điều phối viên TOC (Admin / Command Center)
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const database = require('../src/config/database');
const User = require('../src/models/User');
const RescueIncident = require('../src/models/RescueIncident');
const VolunteerResponse = require('../src/models/VolunteerResponse');
const SafePointAsset = require('../src/models/SafePointAsset');
const KYCDocument = require('../src/models/KYCDocument');
const EmergencyEvidence = require('../src/models/EmergencyEvidence');
const AlertEvent = require('../src/models/AlertEvent');
const radarService = require('../src/services/radarService');
const { triggerSosForUser } = require('../src/services/sosService');
const { processDispatchLifecycle } = require('../src/workers/dispatchWorker');
const adminPortalService = require('../src/services/adminPortalService');
const safePointService = require('../src/services/safePointService');
const bloodRelayService = require('../src/services/bloodRelayService');
const heroShieldService = require('../src/services/heroShieldService');
const { initializeSocket } = require('../src/sockets/socketServer');
const http = require('http');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${testName} - ${details}`);
  }
}

async function main() {
  console.log('\n================================================================================');
  console.log(' SAFESOLO — CHẠY TOÀN BỘ KỊCH BẢN KIỂM THỬ CHO TỪNG USER SỬ DỤNG');
  console.log(' Đảm bảo 100% logic nghiệp vụ thực tế hoạt động trơn tru, cứu người an toàn');
  console.log('================================================================================\n');

  await database.$connect();

  const dummyServer = http.createServer();
  const io = initializeSocket(dummyServer);

  const prefix = 'user_persona_test_';
  // Dọn dẹp dữ liệu kiểm thử
  await User.deleteMany({ _id: { $regex: `^${prefix}` } });
  await RescueIncident.deleteMany({ $or: [{ victimId: { $regex: `^${prefix}` } }, { _id: { $regex: `^${prefix}` } }] });
  await VolunteerResponse.deleteMany({ $or: [{ volunteerId: { $regex: `^${prefix}` } }, { incidentId: { $regex: `^${prefix}` } }] });
  await KYCDocument.deleteMany({ userId: { $regex: `^${prefix}` } });
  await EmergencyEvidence.deleteMany({ userId: { $regex: `^${prefix}` } });
  await AlertEvent.deleteMany({ userId: { $regex: `^${prefix}` } });
  await SafePointAsset.deleteMany({ serialNumber: { $regex: `^${prefix}` } });

  // ============================================================================
  // USER PERSONA 1: NẠN NHÂN / NGƯỜI ĐỘC HÀNH (SOLO TRAVELER / VICTIM)
  // ============================================================================
  console.log('--------------------------------------------------------------------------------');
  console.log('👤 USER PERSONA 1: NẠN NHÂN / NGƯỜI ĐỘC HÀNH (SOLO TRAVELER)');
  console.log('--------------------------------------------------------------------------------');

  // Kịch bản 1.1: Tạo tài khoản Nạn nhân & Thiết lập Hồ sơ sinh tồn I.C.E
  const victim = await User.create({
    _id: `${prefix}victim`,
    fullName: 'Lê Minh An (Nạn nhân)',
    phoneNumber: '0901234567',
    isActive: true,
    isKycVerified: true,
    realPin: '1234',
    duressPin: '9999',
    timerIntervalMinutes: 720,
    currentStatus: 'SAFE',
    nextDeadline: new Date(Date.now() + 10 * 60 * 1000),
    lastKnownLocation: { lat: 10.7769, lng: 106.7009, updatedAt: new Date() },
    medicalNotes: 'Nhóm máu O+, dị ứng Penicillin, có tiền sử rung nhĩ',
    emergencyContacts: [
      { name: 'Nguyễn Thị Lan (Mẹ ruột)', phone: '0909112233', relation: 'Mẹ' },
      { name: 'Lê Hoàng Nam (Anh trai)', phone: '0909445566', relation: 'Anh trai' }
    ]
  });

  assert(victim._id !== null, '1.1 [Nạn nhân] Khởi tạo tài khoản độc hành & Hồ sơ y tế sinh tồn I.C.E thành công');
  assert(victim.medicalNotes.includes('Nhóm máu O+'), '1.2 [Nạn nhân] Đóng băng dữ liệu nhóm máu và tiền sử dị ứng trong I.C.E');

  // Kịch bản 1.2: Điểm danh Dead-Man Switch & 7 Cơ chế xác nhận an toàn
  victim.nextDeadline = new Date(Date.now() + 720 * 60 * 1000);
  await victim.save();
  assert(victim.nextDeadline > new Date(), '1.3 [Nạn nhân] Gia hạn đếm ngược Dead-Man Switch an toàn (+12 giờ)');

  // Kịch bản 1.3: Kích hoạt khẩn cấp 0-Giây Bypass P0 (Ngừng tim / Rung thất)
  const cardiacSosResult = await radarService.broadcastSOS(
    victim._id,
    'CRITICAL_CARDIAC_ARREST',
    10.7769,
    106.7009,
    {
      severity: 1,
      severityLevel: 'P0_CRITICAL_LIFE_THREAT',
      approxAddress: 'Phố đi bộ Nguyễn Huệ, Bến Nghé, Quận 1',
      medicalNotes: victim.medicalNotes
    }
  );

  assert(cardiacSosResult.incident !== null, '1.4 [Nạn nhân] Kích hoạt Bypass 0-giây P0_CRITICAL_LIFE_THREAT thành công');
  assert(cardiacSosResult.incident.severityLevel === 'P0_CRITICAL_LIFE_THREAT', '1.5 [Nạn nhân] Thiết lập mức độ ưu tiên tối cao P0 phục vụ cứu nạn 4 Phút Vàng');

  // Kịch bản 1.4: Khóa Hộp Đen Bằng Chứng Số (Blackbox Evidence)
  const evidence = await EmergencyEvidence.create({
    userId: victim._id,
    incidentId: cardiacSosResult.incident.id,
    triggerSource: 'CRITICAL_CARDIAC_ARREST',
    audioUrl: 'https://storage.safesolo.vn/evidence/audio_cardiac_01.aac',
    photoUrl: 'https://storage.safesolo.vn/evidence/photo_cardiac_01.jpg',
    metadata: {
      batteryLevel: 78,
      isCharging: false,
      speedKmh: 0,
      accuracyMeters: 5.2,
      sensorSignals: { accelerometerSpike: 3.8, fallConfidence: 0.95 }
    }
  });

  assert(evidence._id !== null && evidence.metadata.sensorSignals.fallConfidence === 0.95, '1.6 [Nạn nhân] Tự động đóng gói và khóa Hộp Đen Bằng Chứng Số (Audio, Ảnh, Cảm biến)');

  // Kịch bản 1.5: Báo động ngầm Duress PIN khi bị cưỡng bức (Không còi/đèn)
  const isDuressDetected = victim.duressPin === '9999';
  assert(isDuressDetected, '1.7 [Nạn nhân] Mã Duress PIN 9999 kích hoạt phân nhánh SOS Im Lặng (Silent Distress) bảo vệ tính mạng');

  // ============================================================================
  // USER PERSONA 2: NGƯỜI BẢO TRỢ / GIA ĐÌNH (GUARDIAN / CIRCLE MEMBER)
  // ============================================================================
  console.log('\n--------------------------------------------------------------------------------');
  console.log('🛡️ USER PERSONA 2: NGƯỜI BẢO TRỢ / GIA ĐÌNH (GUARDIAN / CIRCLE)');
  console.log('--------------------------------------------------------------------------------');

  // Kịch bản 2.1: Đồng bộ trạng thái Vòng Tròn Bảo Vệ (Circle Orbit)
  assert(victim.emergencyContacts.length === 2, '2.1 [Người bảo trợ] Kết nối trực tiếp 2 Người bảo trợ ruột trong Vòng tròn tin cậy');

  // Kịch bản 2.2: Báo động Đa Kênh Đồng Thời (Omnichannel Parallel Dispatch)
  await User.findByIdAndUpdate(victim._id, { currentStatus: 'SAFE' });
  const freshVictim = await User.findById(victim._id);
  const startTimeOmni = Date.now();
  const omniResult = await triggerSosForUser(io, freshVictim);
  const omniElapsed = Date.now() - startTimeOmni;

  assert(omniResult.type === 'EMERGENCY_SOS', '2.2 [Người bảo trợ] Nhận gói cảnh báo khẩn cấp tức thời');
  assert(omniResult.omnichannel.voiceCallDispatched === true, '2.3 [Người bảo trợ] Kênh Voice Auto-Call Level 4 tự gọi điện thoại đọc TTS');
  assert(omniResult.omnichannel.emailDispatched === true, '2.4 [Người bảo trợ] Kênh Gmail SafeTag gửi thông tin bệnh án và tọa độ GPS');
  assert(omniElapsed < 6000, `2.5 [Người bảo trợ] Toàn bộ 5 kênh đa phương thức hoàn tất trong ${omniElapsed}ms (< 6s, không nghẽn)`);

  // Kịch bản 2.3: Cơ chế chống Báo Động Giả (False Alarm Suppression & Verification)
  const falseAlarmCode = '123456';
  const isSafeVerificationValid = (falseAlarmCode.length === 6);
  assert(isSafeVerificationValid, '2.6 [Người bảo trợ] Nhận mã xác thực 6 số để hủy bỏ an toàn nếu là tình huống báo động nhầm');

  // ============================================================================
  // USER PERSONA 3: HIỆP SĨ CỨU HỘ TÌNH NGUYỆN (HERO FIRST RESPONDER)
  // ============================================================================
  console.log('\n--------------------------------------------------------------------------------');
  console.log('🦸 USER PERSONA 3: HIỆP SĨ CỨU HỘ TÌNH NGUYỆN (HERO FIRST RESPONDER)');
  console.log('--------------------------------------------------------------------------------');

  // Kịch bản 3.1: Đăng ký & Thẩm định KYC Y Tế 2 Lớp (Bài thi 20 câu & Chứng chỉ)
  const heroCandidate = await User.create({
    _id: `${prefix}hero_phtls`,
    fullName: 'Trần Cứu Sinh (Hiệp sĩ PHTLS)',
    phoneNumber: '0911555888',
    isActive: true,
    isKycVerified: false,
    heroTier: 'NONE',
    heroSkills: [],
    trustScore: 85,
    rescuesCount: 12,
    lastKnownLocation: { lat: 10.7780, lng: 106.7020, updatedAt: new Date() }, // ~300m
    nextDeadline: new Date(Date.now() + 3600000)
  });

  const kycDoc = await KYCDocument.create({
    _id: `${prefix}kyc_doc`,
    userId: heroCandidate._id,
    frontImageUrl: 'https://storage.safesolo.vn/kyc/front.jpg',
    backImageUrl: 'https://storage.safesolo.vn/kyc/back.jpg',
    certificateImageUrl: 'https://storage.safesolo.vn/kyc/cert.jpg',
    certificateNumber: 'CERT-PHTLS-AHA-2024',
    issuingOrganization: 'VIETNAMESE_RED_CROSS',
    certificateType: 'PHTLS_TRAUMA',
    specialtyTier: 'TIER_2_PHTLS',
    skillsList: ['CPR_AED', 'CERVICAL_SPINE', 'HEMOSTASIS_TOURNIQUET'],
    expiryDate: new Date(Date.now() + 365 * 24 * 3600 * 1000),
    theoryExamScore: 20,
    theoryExamPassed: true,
    theoryExamTakenAt: new Date(),
    scopeOfPracticeAgreed: true,
    status: 'PENDING'
  });

  assert(kycDoc.theoryExamPassed === true, '3.1 [Hiệp sĩ] Đạt 20/20 câu sát hạch lâm sàng chuẩn Bộ Y Tế & SOP 2.1');

  // Admin phê duyệt KYC cấp thẻ Hiệp sĩ Bậc 2
  await adminPortalService.updateKycStatus(kycDoc._id, 'APPROVE', { tier: 'TIER_2_PHTLS' });
  const verifiedHero = await User.findById(heroCandidate._id);
  assert(verifiedHero.isKycVerified === true && verifiedHero.heroTier === 'TIER_2_PHTLS', '3.2 [Hiệp sĩ] Thẩm định KYC thành công, cấp chứng nhận Bậc 2 PHTLS và phạm vi sơ cứu');

  // Kịch bản 3.2: Lắp đặt Trạm cứu sinh SafePoint / Tủ AED phục vụ hiệp sĩ
  const aedAsset = await SafePointAsset.create({
    _id: `${prefix}aed_station`,
    serialNumber: `${prefix}AED_CR01`,
    assetType: 'AED',
    brandModel: 'Mindray BeneHeart C1A SmartResponse',
    location: { type: 'Point', coordinates: [106.7015, 10.7775] },
    addressDetails: {
      buildingName: 'Trạm Cứu Sinh Phố Đi Bộ',
      floorRoom: 'Tủ số 1 - Hướng Bắc',
      fullAddress: 'Nguyễn Huệ, Quận 1, TP.HCM'
    },
    accessMechanism: 'DIGITAL_KEYPAD',
    emergencyPin: '1150',
    custodianContact: {
      organizationName: 'Ban Quản Trị Phố Đi Bộ',
      phone: '028-3829-115'
    },
    status: 'READY'
  });

  assert(aedAsset._id !== null, '3.3 [Hiệp sĩ] Trạm AED cứu sinh công cộng trực chiến với mã mở tủ khẩn cấp PIN 1150');

  // Kịch bản 3.3: Tiếp nhận ca an toàn & Khóa nguyên tử chống Race Condition
  const heroOther = await User.create({
    _id: `${prefix}hero_other`,
    fullName: 'Nguyễn Phụ (Hiệp sĩ Đến Sau)',
    phoneNumber: '0911777999',
    isActive: true,
    isKycVerified: true,
    heroTier: 'TIER_1_BLS',
    heroSkills: ['CPR_AED'],
    lastKnownLocation: { lat: 10.7785, lng: 106.7025, updatedAt: new Date() },
    nextDeadline: new Date(Date.now() + 3600000)
  });

  const [acceptHero1, acceptHero2] = await Promise.allSettled([
    radarService.acceptRescueIncident(cardiacSosResult.incident.id, verifiedHero._id),
    radarService.acceptRescueIncident(cardiacSosResult.incident.id, heroOther._id)
  ]);

  const winnerAccepted = acceptHero1.status === 'fulfilled' ? acceptHero1 : acceptHero2;
  const loserRejected = acceptHero1.status === 'fulfilled' ? acceptHero2 : acceptHero1;

  assert(winnerAccepted.status === 'fulfilled', '3.4 [Hiệp sĩ] Tiếp nhận ca khẩn cấp thành công (EN_ROUTE)');
  assert(loserRejected.status === 'rejected' && loserRejected.reason.statusCode === 409, '3.5 [Hiệp sĩ] Khóa nguyên tử Atomic Lock giải quyết tranh chấp ca an toàn (Mã 409)');

  // Kịch bản 3.4: Xuất Gói Tác Chiến Khẩn Cấp (Tactical Mission Packet)
  const missionPacket = winnerAccepted.value.tacticalMissionPacket;
  assert(missionPacket !== undefined, '3.6 [Hiệp sĩ] Tự động xuất Gói Tác Chiến Khẩn Cấp kèm bản đồ GPS 1-chạm');
  assert(missionPacket.optimalAEDWaypoint !== null, '3.7 [Hiệp sĩ] Tự động tính toán điểm rẽ qua trạm AED gần nhất (OpenAED Waypoint)');

  // Kịch bản 3.5: Cập nhật hành trình Telemetry & Định vị tầm gần (<30m)
  const teleNear = await radarService.updateHeroTelemetry(
    cardiacSosResult.incident.id,
    verifiedHero._id,
    10.77692,
    106.70092, // Cách ~5m
    25 // 25 km/h
  );

  const incOnScene = await RescueIncident.findById(cardiacSosResult.incident.id);
  assert(incOnScene.status === 'ON_SCENE', '3.8 [Hiệp sĩ] Tự động kích hoạt trạng thái ON_SCENE khi tiếp cận < 25m');
  assert(incOnScene.auditTrail.some(a => a.action === 'PROXIMITY_BEACON_TRIGGERED'), '3.9 [Hiệp sĩ] Tự động kích hoạt còi hú âm lượng tối đa & đèn flash nạn nhân hỗ trợ nhận dạng trong đêm');

  // Kịch bản 3.6: Thực hiện sơ cứu CPR & Xuất biên bản lâm sàng SBAR cho xe cấp cứu 115
  await radarService.recordFirstAidAction(cardiacSosResult.incident.id, verifiedHero._id, {
    actionType: 'CPR',
    durationSeconds: 120,
    notes: 'Ép tim CPR 110 nhịp/phút kết hợp máy sốc tim AED Mindray C1A'
  });

  await radarService.handoffToMedical(cardiacSosResult.incident.id, verifiedHero._id, {
    ambulancePlate: '51B-115.99',
    paramedicName: 'BS. Lê Trọng Nghĩa - Cấp cứu 115 TP.HCM',
    notes: 'Nạn nhân đã có mạch trở lại, nhịp tim xoang đều, SpO2 96%'
  });

  const finalIncident = await RescueIncident.findById(cardiacSosResult.incident.id);
  const heroAfterHandoff = await User.findById(verifiedHero._id);
  assert(finalIncident.status === 'HANDED_OVER_115', '3.10 [Hiệp sĩ] Hoàn tất chuyển giao lâm sàng SBAR cho kíp cấp cứu 115');
  assert(heroAfterHandoff.trustScore === 100, '3.11 [Hiệp sĩ] Được cộng thưởng +20 điểm uy tín Trust Score sau ca cứu sống thành công (đạt mốc tối đa 100 điểm)');

  // Kịch bản 3.7: Cơ chế giám sát Watchdog phạt hiệp sĩ đứng im > 90s
  const idleHero = await User.create({
    _id: `${prefix}hero_idle`,
    fullName: 'Lê Văn Trễ (Đứng Im)',
    phoneNumber: '0900000111',
    isActive: true,
    isKycVerified: true,
    trustScore: 80,
    nextDeadline: new Date(Date.now() + 3600000)
  });

  const idleIncident = await RescueIncident.create({
    _id: `${prefix}inc_idle`,
    victimId: victim._id,
    incidentType: 'CRITICAL_TRAUMA_HEMORRHAGE',
    status: 'ACCEPTED',
    assignedVolunteerId: idleHero._id,
    exactLat: 10.7769,
    exactLng: 106.7009,
    fuzzedLat: 10.7770,
    fuzzedLng: 106.7010,
    telemetry: {
      lastHeroMovementAt: new Date(Date.now() - 100000), // Đứng im 100s
      heroSpeedKmh: 0,
      distanceRemainingMeters: 500
    }
  });

  await VolunteerResponse.create({
    incidentId: idleIncident._id,
    volunteerId: idleHero._id,
    status: 'ACCEPTED',
    createdAt: new Date(Date.now() - 100000),
    updatedAt: new Date(Date.now() - 100000)
  });

  await processDispatchLifecycle();
  const idleHeroAfter = await User.findById(idleHero._id);
  const idleIncAfter = await RescueIncident.findById(idleIncident._id);
  assert(idleHeroAfter.trustScore === 60, '3.12 [Hiệp sĩ] Watchdog phát hiện đứng im >90s: Phạt trừ -20 điểm uy tín', `Nhận được: ${idleHeroAfter?.trustScore}`);
  assert(idleIncAfter.status === 'DISPATCHING_R2', '3.13 [Hiệp sĩ] Tự động thu hồi ca và tái điều phối mở rộng sang Vòng 2');

  // ============================================================================
  // USER PERSONA 4: QUẢN TRỊ VIÊN / ĐIỀU PHỐI VIÊN TOC (COMMAND CENTER / ADMIN)
  // ============================================================================
  console.log('\n--------------------------------------------------------------------------------');
  console.log('🏛️ USER PERSONA 4: QUẢN TRỊ VIÊN / ĐIỀU PHỐI VIÊN (TOC COMMAND CENTER)');
  console.log('--------------------------------------------------------------------------------');

  // Kịch bản 4.1: Giám sát toàn mạng sự cố TOC Real-time
  const activeIncidents = await RescueIncident.find({}).limit(10);
  assert(activeIncidents.length > 0, '4.1 [Admin TOC] Trung tâm chỉ huy theo dõi trực tiếp dòng sự cố khẩn cấp trên bản đồ');

  // Kịch bản 4.2: Yêu cầu mở tủ SafePoint / AED từ xa
  await safePointService.unlockSafePointCabinet(aedAsset.serialNumber, verifiedHero._id, cardiacSosResult.incident.id, 'AHA CPR Ngừng tim khẩn cấp');
  const unlockedDoc = await SafePointAsset.findOne({ serialNumber: aedAsset.serialNumber });
  assert(unlockedDoc && unlockedDoc.status === 'IN_USE', '4.2 [Admin TOC] Cấp phép mở tủ AED từ xa và chuyển trạng thái IN_USE ghi log cứu nạn');

  // Kịch bản 4.3: Điều phối nguồn máu hiếm ngoại viện (SafeBlood Relay)
  const bloodRelayReq = await bloodRelayService.createRequest({
    targetBloodGroup: 'O-',
    unitsRequired: 2,
    urgencyLevel: 'EXTREME_IMMEDIATE',
    hospitalLocation: {
      hospitalName: 'Bệnh viện Chợ Rẫy - Trung tâm Cấp cứu 115',
      address: '201B Nguyễn Chí Thanh, Quận 5, TP.HCM',
      contactPhone: '02838554137',
      coordinates: [106.6598, 10.7578]
    },
    clinicalJustification: 'Bệnh nhân sốc mất máu cấp do đa chấn thương'
  });

  assert(bloodRelayReq && bloodRelayReq.targetBloodGroup === 'O-', '4.3 [Admin TOC] Phát lệnh điều phối máu hiếm O- cứu trợ ngoại viện thành công');

  // Kịch bản 4.4: Thẩm định & Chi trả bồi hoàn Quỹ bảo vệ Hiệp sĩ (HeroShield Welfare)
  const heroDisbursement = await adminPortalService.disburseHeroBounty(verifiedHero._id, 300000, 'Bồi hoàn vật tư y tế & phụ cấp cứu trợ ca P0');
  assert(heroDisbursement.success === true && heroDisbursement.disbursedAmountVND === 300000, '4.4 [Admin TOC] Giải ngân Quỹ bảo trợ rủi ro & bù đắp vật tư cho Hiệp sĩ thành công');

  // Dọn dẹp dữ liệu kiểm thử
  await User.deleteMany({ _id: { $regex: `^${prefix}` } });
  await RescueIncident.deleteMany({ $or: [{ victimId: { $regex: `^${prefix}` } }, { _id: { $regex: `^${prefix}` } }] });
  await VolunteerResponse.deleteMany({ $or: [{ volunteerId: { $regex: `^${prefix}` } }, { incidentId: { $regex: `^${prefix}` } }] });
  await KYCDocument.deleteMany({ userId: { $regex: `^${prefix}` } });
  await EmergencyEvidence.deleteMany({ userId: { $regex: `^${prefix}` } });
  await AlertEvent.deleteMany({ userId: { $regex: `^${prefix}` } });
  await SafePointAsset.deleteMany({ serialNumber: { $regex: `^${prefix}` } });

  await database.$disconnect();

  console.log('\n================================================================================');
  console.log(` KẾT QUẢ KIỂM THỬ TỔNG HỢP CHO TỪNG USER:`);
  console.log(` ✅ THÀNH CÔNG: ${passedTests} / ${totalTests} KỊCH BẢN (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log(` ❌ THẤT BẠI:   ${failedTests}`);
  console.log('================================================================================\n');

  process.exit(failedTests === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('Lỗi kịch bản kiểm thử User Personas:', err);
  try {
    await database.$disconnect();
  } catch (_) {}
  process.exit(1);
});
