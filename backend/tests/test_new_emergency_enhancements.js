require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const database = require('../src/config/database');
const User = require('../src/models/User');
const RescueIncident = require('../src/models/RescueIncident');
const VolunteerResponse = require('../src/models/VolunteerResponse');
const radarService = require('../src/services/radarService');

const http = require('http');
const { initializeSocket } = require('../src/sockets/socketServer');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
    failedTests++;
  }
}

async function run() {
  console.log('='.repeat(80));
  console.log(' SAFESOLO — KIỂM THỬ TÍNH NĂNG NGHIỆP VỤ MỚI NÂNG CAO CHO CỨU HỘ KHẨN CẤP');
  console.log(' Mục tiêu: Vi địa chỉ phòng trọ, Lệnh can thiệp Điều 23 BLHS, An toàn hiện trường 3S, Bystander Co-Pilot');
  console.log('='.repeat(80));

  await database.$connect();
  const dummyServer = http.createServer();
  initializeSocket(dummyServer);

  const testSuffix = Math.random().toString(36).substring(2, 7);
  const victimId = `test_victim_${testSuffix}`;
  const heroId = `test_hero_${testSuffix}`;

  try {
    // 1. Tạo User Nạn nhân có Vi địa chỉ phòng trọ
    const victim = await User.create({
      _id: victimId,
      fullName: 'Bà Nguyễn Thị Lan',
      phoneNumber: `0987${Math.floor(100000 + Math.random() * 900000)}`,
      role: 'user',
      batteryLevel: 65,
      nextDeadline: new Date(Date.now() + 12 * 3600 * 1000),
      microLocation: {
        buildingName: 'Khu nhà trọ 48/12 Hẻm 3 sẹc',
        roomNumber: 'Phòng 204',
        floorNumber: 'Lầu 2',
        doorCode: 'Khóa từ cổng chung: 4321#',
        landlordPhone: '0912.345.678 (Bác Ba chủ trọ)',
        securityPhone: '0901.999.888',
        accessNotes: 'Hẻm xe máy, vào hẻm rẽ trái ở gốc cây khế, cầu thang bộ phía sau.',
      },
    });

    // 2. Tạo User Hiệp sĩ có chứng chỉ KYC Tier 2 PHTLS
    const hero = await User.create({
      _id: heroId,
      fullName: 'Trần Cứu Sinh',
      phoneNumber: `0977${Math.floor(100000 + Math.random() * 900000)}`,
      role: 'hero',
      isHero: true,
      isKycVerified: true,
      heroTier: 'TIER_2_PHTLS',
      heroSkills: ['CPR_AED', 'CERVICAL_SPINE', 'HEMOSTASIS_TOURNIQUET'],
      trustScore: 95,
      rescuesCount: 12,
      isOnlineForRescue: true,
      nextDeadline: new Date(Date.now() + 12 * 3600 * 1000),
      lastKnownLocation: { lat: 10.7780, lng: 106.7020, updatedAt: new Date() },
    });

    console.log('\n--- PHÂN HỆ 1: VI ĐỊA CHỈ & PHÂN LOẠI LÂM SÀNG SIÊU TỐC T+0S ---');
    const broadcastResult = await radarService.broadcastSOS(
      victimId,
      'CRITICAL_CARDIAC_ARREST',
      10.7769,
      106.7009,
      {
        severity: 2,
        severityLevel: 'P1_CRITICAL',
        triageCategory: 'CARDIAC_RESPIRATORY',
        reportedByVoice: true,
        mobilityRecommendation: 'MOTORBIKE',
      },
    );

    const incidentId = broadcastResult.incident.id;
    const incidentDoc = await RescueIncident.findById(incidentId);

    assert(incidentDoc !== null, '1.1 Khởi tạo sự cố cứu nạn có Vi địa chỉ thành công');
    assert(
      incidentDoc.microLocation?.roomNumber === 'Phòng 204' &&
        incidentDoc.microLocation?.doorCode === 'Khóa từ cổng chung: 4321#',
      '1.2 Vi địa chỉ phòng trọ và mã mở khóa cổng được trích xuất tự động từ profile',
    );
    assert(
      incidentDoc.triageCategory?.category === 'CARDIAC_RESPIRATORY' &&
        incidentDoc.triageCategory?.reportedByVoice === true,
      '1.3 Phân loại lâm sàng siêu tốc xác nhận ca CARDIAC_RESPIRATORY qua giọng nói',
    );
    assert(
      incidentDoc.emergencyAccessPass?.passCode?.startsWith('PASS-') &&
        incidentDoc.emergencyAccessPass?.isUnlockedForHero === false,
      '1.4 Lệnh can thiệp cứu sinh cấp bách được tự động khởi tạo và khóa an toàn trước khi có Hiệp sĩ nhận',
    );

    console.log('\n--- PHÂN HỆ 2: TIẾP NHẬN CA & MỞ KHÓA LỆNH CAN THIỆP SINH MẠNG (ĐIỀU 23 BLHS) ---');
    const acceptResult = await radarService.acceptRescueIncident(incidentId, heroId);

    assert(
      acceptResult.tacticalMissionPacket !== undefined,
      '2.1 Gói tác chiến khẩn cấp Tactical Mission Packet được xuất cho Hiệp sĩ',
    );
    assert(
      acceptResult.tacticalMissionPacket.emergencyAccessPass?.isUnlockedForHero === true,
      '2.2 Lệnh can thiệp sinh mạng (Điều 23 BLHS) được mở khóa giải mã cấp quyền cho Hiệp sĩ',
    );
    assert(
      acceptResult.tacticalMissionPacket.microLocation?.buildingName === 'Khu nhà trọ 48/12 Hẻm 3 sẹc',
      '2.3 Chỉ dẫn tiếp cận phòng trọ và số điện thoại chủ nhà được gửi đầy đủ trong gói tác chiến',
    );

    console.log('\n--- PHÂN HỆ 3: ĐÁNH GIÁ AN TOÀN HIỆN TRƯỜNG (3S SCENE SAFETY SOP) ---');
    // Test 3.1: Hiện trường an toàn
    const safeSceneResult = await radarService.assessSceneSafety(incidentId, heroId, {
      hazardFlags: ['SAFE_TO_ENTER'],
      isSafeToEnter: true,
      safetyNotes: 'Hiện trường sạch, không có nguồn điện rò rỉ hay khí độc.',
    });
    assert(
      safeSceneResult.success && safeSceneResult.sceneSafety.isSafeToEnter === true,
      '3.1 Hiệp sĩ xác nhận hiện trường an toàn (Scene Safe) theo quy chuẩn 3S SOP',
    );

    // Test 3.2: Phát hiện mối nguy hiểm -> Cảnh báo và leo thang sang 114
    const hazardResult = await radarService.assessSceneSafety(incidentId, heroId, {
      hazardFlags: ['ELECTRICAL_HAZARD', 'GAS_LEAK'],
      isSafeToEnter: false,
      escalatedToService: '114_FIRE_RESCUE',
      safetyNotes: 'Phát hiện mùi gas nồng nặc và nước ngập chạm ổ điện sàn nhà!',
    });
    assert(
      hazardResult.sceneSafety.isSafeToEnter === false &&
        hazardResult.sceneSafety.escalatedToService === '114_FIRE_RESCUE',
      '3.2 Hệ thống ngăn chặn Hiệp sĩ vào hiện trường nguy hiểm và tự động leo thang sang Cứu hỏa 114',
    );

    console.log('\n--- PHÂN HỆ 4: LOA NGOÀI CHỈ DẪN SƠ CỨU 0-GIÂY TẠI CHỖ (BYSTANDER CO-PILOT) ---');
    const bystanderResult = await radarService.triggerBystanderGuidance(incidentId, heroId, {
      guidanceType: 'CPR_AIRWAY',
      metronomeBpm: 110,
    });
    assert(
      bystanderResult.success && bystanderResult.bystanderGuidance.metronomeBpm === 110,
      '4.1 Kích hoạt thành công loa ngoài chỉ dẫn sơ cứu 0-Giây với nhịp Metronome 110 BPM',
    );
    assert(
      bystanderResult.audioScript?.voicePrompt?.includes('đặt gót bàn tay vào chính giữa ngực'),
      '4.2 Bản thoại hướng dẫn ép tim CPR tiếng Việt chuẩn xác cho người nhà/người đi đường',
    );

    console.log('\n--- PHÂN HỆ 5: ĐÁNH GIÁ LÂM SÀNG NGOẠI VIỆN (AVPU, KHÓA GIỜ GA-RÔ C-A-T, C-SPINE) ---');
    const tourniquetLockTime = new Date();
    const clinResult = await radarService.recordClinicalAssessment(incidentId, heroId, {
      avpuLevel: 'V',
      cSpineStabilized: true,
      tourniquet: {
        isApplied: true,
        appliedAt: tourniquetLockTime,
        limbLocation: 'Cánh tay Trái',
        maxSafeMinutes: 120,
      },
      fastStroke: {
        faceDroop: false,
        armWeakness: false,
        speechDifficulty: false,
      },
      cprDetails: {
        cyclesCount: 3,
        compressionsCount: 90,
        aedShocksCount: 1,
      },
    });

    assert(
      clinResult.success && clinResult.clinicalAssessment.avpuLevel === 'V',
      '5.1 Đánh giá thang điểm tri giác AVPU ngoại viện thành công (Mức V - Đáp ứng lời nói)',
    );
    assert(
      clinResult.clinicalAssessment.cSpineStabilized === true &&
        clinResult.clinicalAssessment.cSpineStabilizedAt !== null,
      '5.2 Xác nhận cố định cột sống cổ C-Spine thành công theo khuyến cáo PHTLS',
    );
    assert(
      clinResult.clinicalAssessment.tourniquet.isApplied === true &&
        clinResult.clinicalAssessment.tourniquet.limbLocation === 'Cánh tay Trái' &&
        clinResult.clinicalAssessment.tourniquet.maxSafeMinutes === 120,
      '5.3 Khóa giờ Ga-rô C-A-T tại Cánh tay Trái với giới hạn an toàn tối đa 120 phút',
    );
    assert(
      clinResult.clinicalAssessment.cprDetails.cyclesCount === 3 &&
        clinResult.clinicalAssessment.cprDetails.compressionsCount === 90,
      '5.4 Ghi nhận số chu kỳ CPR (3 chu kỳ, 90 nhịp ép tim, 1 lần sốc điện AED)',
    );

    console.log('\n--- PHÂN HỆ 6: BIÊN BẢN BÀN GIAO Y TẾ SBAR TỰ ĐỘNG CHO XE CẤP CỨU 115 ---');
    // Hiệp sĩ báo đã đến hiện trường
    await radarService.markVolunteerArrived(incidentId, heroId);

    const handoffResult = await radarService.handoffToMedical(incidentId, heroId, {
      ambulancePlate: '51B-115.89',
      paramedicName: 'BS. Nguyễn Văn Hùng (Cấp cứu 115 TP.HCM)',
      notes: 'Bệnh nhân có đáp ứng yếu sau 3 chu kỳ CPR. Đã bàn giao cáng thương lên xe cứu thương.',
    });

    const handoffDoc = await RescueIncident.findById(incidentId);
    assert(
      handoffDoc.status === 'HANDED_OVER_115',
      '6.1 Trạng thái sự cố chuyển sang HANDED_OVER_115 khi bàn giao thành công',
    );
    assert(
      handoffDoc.handoffRecord?.ambulancePlate === '51B-115.89' &&
        handoffDoc.handoffRecord?.paramedicName?.includes('BS. Nguyễn Văn Hùng'),
      '6.2 Lưu vết định danh kíp xe cấp cứu 115 và biển số xe vận chuyển',
    );
    assert(
      handoffDoc.handoffRecord?.sbarSummary?.assessment?.includes('Tri giác AVPU: V') &&
        handoffDoc.handoffRecord?.sbarSummary?.assessment?.includes('Đã đặt Garo tại Cánh tay Trái'),
      '6.3 Biên bản SBAR Assessment tự động tổng hợp đầy đủ dữ liệu AVPU và Ga-rô đã khóa giờ',
    );

    console.log('\n--- PHÂN HỆ 7: ĐÁNH GIÁ HẬU SỰ CỐ (AAR) & TÍCH LŨY TÍN CHỈ Y KHOA CME ---');
    const heroBeforeAar = await User.findById(heroId);
    const initialCme = heroBeforeAar.cmeCredits || 0;

    const aarResult = await radarService.submitAfterActionReview(incidentId, 'DR_CHIEF_REVIEWER_01', {
      overallScore: 96,
      responseTimeSeconds: 165,
      cprQualityScore: 98,
      sbarQualityScore: 97,
      cmeCreditsAwarded: 2,
      notes: 'Hiệp sĩ phản ứng trong 2 phút 45 giây. Quy trình CPR chuẩn AHA và đặt ga-rô chuẩn thời gian.',
    });

    assert(
      aarResult.success && aarResult.afterActionReview.overallScore === 96,
      '7.1 Biên bản After-Action Review (AAR) đạt điểm xuất sắc 96/100',
    );

    const heroAfterAar = await User.findById(heroId);
    assert(
      heroAfterAar.cmeCredits === initialCme + 2,
      '7.2 Hệ thống tự động tích lũy +2 tín chỉ CME vào tài khoản đào tạo liên tục của Hiệp sĩ',
    );

    console.log('\n' + '='.repeat(80));
    console.log(` KẾT QUẢ KIỂM THỬ TOÀN DIỆN: ${passedTests} PASS / ${failedTests} FAIL (${passedTests}/${passedTests + failedTests})`);
    console.log('='.repeat(80) + '\n');
  } catch (err) {
    console.error('Fatal test error:', err);
    failedTests++;
  } finally {
    // Cleanup test data
    await RescueIncident.deleteMany({ victimId });
    await VolunteerResponse.deleteMany({ volunteerId: heroId });
    await User.deleteMany({ _id: { $in: [victimId, heroId] } });
    await mongoose.connection.close();
  }

  process.exit(failedTests > 0 ? 1 : 0);
}

run();
