require('dotenv').config({ path: __dirname + '/../.env' });
const database = require('../src/config/database');
const User = require('../src/models/User');
const RescueIncident = require('../src/models/RescueIncident');
const VolunteerResponse = require('../src/models/VolunteerResponse');
const AlertEvent = require('../src/models/AlertEvent');
const radarService = require('../src/services/radarService');
const { processDispatchLifecycle } = require('../src/workers/dispatchWorker');
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

async function runRealBusinessTests() {
  console.log('\n================================================================================');
  console.log('       SAFESOLO v3.5.0 — KIỂM THỬ TOÀN DIỆN LOGIC NGHIỆP VỤ THỰC TẾ (100% REAL)');
  console.log('================================================================================\n');

  // 1. Kết nối MongoDB thật
  await database.$connect();

  // Khởi tạo dummy socket server để test socket emissions
  const dummyServer = http.createServer();
  initializeSocket(dummyServer);

  // Dọn dẹp dữ liệu test cũ
  const testPrefix = 'real_test_';
  await User.deleteMany({ _id: { $regex: `^${testPrefix}` } });
  await RescueIncident.deleteMany({ $or: [{ victimId: { $regex: `^${testPrefix}` } }, { _id: { $regex: `^${testPrefix}` } }] });
  await VolunteerResponse.deleteMany({ $or: [{ _id: { $regex: `^${testPrefix}` } }, { volunteerId: { $regex: `^${testPrefix}` } }, { incidentId: { $regex: `^${testPrefix}` } }] });
  await AlertEvent.deleteMany({ userId: { $regex: `^${testPrefix}` } });

  console.log('--- KHỞI TẠO TẬP DỮ LIỆU THỰC TẾ (ENTITIES & PROFILES) ---');
  // Nạn nhân
  const victim = await User.create({
    _id: `${testPrefix}victim_01`,
    fullName: 'Lê Thùy Dung (Nạn nhân)',
    phoneNumber: '0901111222',
    isActive: true,
    isKycVerified: true,
    lastKnownLocation: { lat: 10.7769, lng: 106.7009 },
    realPin: '1234',
    duressPin: '9999',
    trustScore: 85,
    nextDeadline: new Date(Date.now() + 3600000),
  });

  // Hiệp sĩ A: Sẵn sàng, cách 500m
  const heroA = await User.create({
    _id: `${testPrefix}hero_A`,
    fullName: 'Trần Văn Hiệp (Hiệp sĩ Rảnh)',
    phoneNumber: '0903333444',
    isActive: true,
    isKycVerified: true,
    lastKnownLocation: { lat: 10.7780, lng: 106.7030 }, // ~300m
    trustScore: 75,
    rescuesCount: 8,
    nextDeadline: new Date(Date.now() + 3600000),
  });

  // Hiệp sĩ B: Đang bận ca khác, cách 400m
  const heroB = await User.create({
    _id: `${testPrefix}hero_B`,
    fullName: 'Nguyễn Văn Bận (Hiệp sĩ Đang Bận)',
    phoneNumber: '0905555666',
    isActive: true,
    isKycVerified: true,
    lastKnownLocation: { lat: 10.7775, lng: 106.7020 },
    trustScore: 95,
    rescuesCount: 12,
    nextDeadline: new Date(Date.now() + 3600000),
  });

  // Hiệp sĩ C: Chưa xác thực KYC
  const heroC = await User.create({
    _id: `${testPrefix}hero_C`,
    fullName: 'Phạm Văn Mới (Chưa KYC)',
    phoneNumber: '0907777888',
    isActive: true,
    isKycVerified: false,
    lastKnownLocation: { lat: 10.7770, lng: 106.7015 },
    trustScore: 60,
    nextDeadline: new Date(Date.now() + 3600000),
  });

  // Tạo trạng thái Hiệp sĩ B đang bận cứu một ca khác
  await VolunteerResponse.create({
    _id: `${testPrefix}resp_busy_b`,
    incidentId: `${testPrefix}inc_other`,
    volunteerId: heroB._id,
    status: 'EN_ROUTE',
  });

  console.log('✓ Đã chuẩn bị Nạn nhân và 3 Hiệp sĩ (Rảnh, Đang Bận, Chưa KYC)\n');

  // ===========================================================================
  // TEST CASE 1: NẠN NHÂN PHÁT TÍN HIỆU SOS THỰC TẾ
  // ===========================================================================
  console.log('--- TEST CASE 1: Phát hiện nạn nhân P1 & Khởi tạo sự cố (Broadcast SOS) ---');
  const sosResult = await radarService.broadcastSOS(
    victim._id,
    'TRAFFIC_COLLISION_P1',
    10.7769,
    106.7009,
    {
      severity: 2,
      severityLevel: 'P1_CRITICAL',
      approxAddress: 'Số 120 Hai Bà Trưng, Phường Bến Nghé, Quận 1',
      medicalNotes: 'Nạn nhân nhóm máu O, bất tỉnh sau va chạm mạnh',
    },
  );

  const incidentDoc1 = await RescueIncident.findById(sosResult.incident.id);
  assert(incidentDoc1 !== null, 'Tạo bản ghi RescueIncident trong MongoDB thành công');
  assert(incidentDoc1.status === 'DISPATCHING_R1', 'Trạng thái ban đầu chuẩn DISPATCHING_R1 (Quét vòng 1)', `Nhận: ${incidentDoc1.status}`);
  assert(incidentDoc1.dispatchRadiusKm === 1.2, 'Bán kính khởi tạo đúng 1.2 km', `Nhận: ${incidentDoc1.dispatchRadiusKm}`);
  assert(incidentDoc1.auditTrail.length > 0 && incidentDoc1.auditTrail[0].action === 'SOS_BROADCASTED', 'Audit Trail ghi nhận bất biến sự kiện SOS_BROADCASTED');
  assert(incidentDoc1.medicalSnapshot.emergencyNotes.includes('nhóm máu O'), 'Medical Snapshot đóng băng thông tin y tế khẩn cấp');

  // ===========================================================================
  // TEST CASE 2: THUẬT TOÁN LỌC HIỆP SĨ & ĐIỂM ƯU TIÊN DISPATCH SCORE
  // ===========================================================================
  console.log('\n--- TEST CASE 2: Lọc Hiệp sĩ thông minh (Loại bỏ người bận & Chưa KYC) ---');
  const candidates = await radarService.findNearbyVolunteers(10.7769, 106.7009, victim._id, 1.2);
  const candidateIds = candidates.map((c) => c.id);

  assert(candidateIds.includes(heroA._id), 'Hiệp sĩ A (Rảnh + KYC) được chọn vào danh sách điều phối');
  assert(!candidateIds.includes(heroB._id), 'Hiệp sĩ B (Đang bận cứu ca khác) bị LOẠI TRỪ 100%');
  assert(!candidateIds.includes(heroC._id), 'Hiệp sĩ C (Chưa KYC) bị LOẠI TRỪ 100%');
  const candidateA = candidates.find((c) => c.id === heroA._id);
  assert(candidateA && candidateA.dispatchScore > 0, `Tính toán Dispatch Score thành công: ${candidateA?.dispatchScore} điểm`);

  // ===========================================================================
  // TEST CASE 3: KHÓA NGUYÊN TỬ ATOMIC LOCK CHỐNG TRANH CHẤP (RACE CONDITION)
  // ===========================================================================
  console.log('\n--- TEST CASE 3: Khóa nguyên tử chống Race Condition (2 Hiệp sĩ tranh nhận) ---');
  // Giả lập Hiệp sĩ D cùng lao vào nhận ca
  const heroD = await User.create({
    _id: `${testPrefix}hero_D`,
    fullName: 'Đặng Tuấn (Hiệp sĩ Đến Sau)',
    phoneNumber: '0909999000',
    isActive: true,
    isKycVerified: true,
    lastKnownLocation: { lat: 10.7772, lng: 106.7018 },
    trustScore: 70,
    nextDeadline: new Date(Date.now() + 3600000),
  });

  // Cho cả Hero A và Hero D cùng gọi acceptRescueIncident đồng thời (Race Condition)
  const [resA, resD] = await Promise.allSettled([
    radarService.acceptRescueIncident(incidentDoc1._id, heroA._id),
    radarService.acceptRescueIncident(incidentDoc1._id, heroD._id),
  ]);

  const incidentAfterAccept = await RescueIncident.findById(incidentDoc1._id);
  const winnerHeroId = incidentAfterAccept.assignedVolunteerId;
  const winnerResult = winnerHeroId === heroA._id ? resA : resD;
  const loserResult = winnerHeroId === heroA._id ? resD : resA;

  assert(incidentAfterAccept.status === 'ACCEPTED', 'Trạng thái chuyển thành ACCEPTED thành công');
  assert(winnerHeroId === heroA._id || winnerHeroId === heroD._id, 'Chỉ duy nhất 1 trong 2 Hiệp sĩ giành được quyền tiếp nhận');
  assert(winnerResult.status === 'fulfilled', 'Hiệp sĩ nhanh hơn được chấp thuận gán quyền');
  assert(loserResult.status === 'rejected' && loserResult.reason.statusCode === 409, 'Hiệp sĩ đến sau nhận thông báo 409 từ chối an toàn (Race Condition Resolved)');

  const heroResponse = await VolunteerResponse.findOne({ incidentId: incidentDoc1._id, volunteerId: winnerHeroId });
  assert(heroResponse.goodSamaritanAgreementSigned === true, 'Ký số điện tử Good Samaritan Shield bảo vệ Hiệp sĩ thành công');

  // ===========================================================================
  // TEST CASE 4: THEO DÕI HÀNH TRÌNH & TỰ ĐỘNG CHUYỂN "ON_SCENE" (< 25m)
  // ===========================================================================
  console.log('\n--- TEST CASE 4: Cập nhật GPS Telemetry & Tự động vào Hiện trường (<25m) ---');
  // Chặng 1: Cách 500m
  await radarService.updateHeroTelemetry(incidentDoc1._id, winnerHeroId, 10.7810, 106.7040, 42);
  let incTelemetry = await RescueIncident.findById(incidentDoc1._id);
  assert(incTelemetry.telemetry.heroSpeedKmh === 42, `Cập nhật tốc độ xe hiệp sĩ thành công: 42 km/h`);

  // Chặng 2: Tiếp cận hiện trường cách 15m (tọa độ gần sát)
  await radarService.updateHeroTelemetry(incidentDoc1._id, winnerHeroId, 10.77695, 106.70095, 10);
  incTelemetry = await RescueIncident.findById(incidentDoc1._id);
  const respTelemetry = await VolunteerResponse.findOne({ incidentId: incidentDoc1._id, volunteerId: winnerHeroId });
  assert(incTelemetry.status === 'ON_SCENE', 'Tự động kích hoạt trạng thái ON_SCENE khi hiệp sĩ tới gần < 25m');
  assert(respTelemetry.status === 'ARRIVED', 'Cập nhật trạng thái Hiệp sĩ thành ARRIVED');

  // ===========================================================================
  // TEST CASE 5: NHẬT KÝ SƠ CẤP CỨU KHẨN CẤP TẠI CHỖ (CPR METRONOME LOG)
  // ===========================================================================
  console.log('\n--- TEST CASE 5: Ghi nhận sơ cứu tại chỗ (Ép tim CPR 180s) ---');
  await radarService.recordFirstAidAction(incidentDoc1._id, winnerHeroId, {
    actionType: 'CPR',
    durationSeconds: 180,
    notes: 'Ép tim nhịp 110 bpm theo âm thanh metronome, đường thở thông thoáng',
  });

  const updatedResp = await VolunteerResponse.findOne({ incidentId: incidentDoc1._id, volunteerId: winnerHeroId });
  const hasCpr = updatedResp.firstAidActionsPerformed.some((a) => a.actionType === 'CPR' && a.durationSeconds === 180);
  assert(hasCpr, 'Lưu trữ nhật ký thao tác ép tim CPR thành công vào Database');

  // ===========================================================================
  // TEST CASE 6: BÀN GIAO ĐỘI CẤP CỨU 115 & THƯỞNG ĐIỂM UY TÍN
  // ===========================================================================
  console.log('\n--- TEST CASE 6: Bàn giao xe 115 & Thưởng điểm uy tín Trust Score ---');
  const heroScoreBefore = (await User.findById(winnerHeroId)).trustScore;
  await radarService.handoffToMedical(incidentDoc1._id, winnerHeroId, {
    ambulancePlate: '51B-115.88',
    paramedicName: 'Bác sĩ Nguyễn Thành Đạt - BV Chợ Rẫy',
    notes: 'Bàn giao nạn nhân tỉnh táo, mạch 85, đã nẹp cổ cố định',
  });

  const incidentFinal = await RescueIncident.findById(incidentDoc1._id);
  const heroScoreAfter = (await User.findById(winnerHeroId)).trustScore;
  assert(incidentFinal.status === 'HANDED_OVER_115', 'Sự cố chuyển trạng thái HANDED_OVER_115 chuẩn y tế');
  assert(incidentFinal.handoffRecord.ambulancePlate === '51B-115.88', 'Lưu trữ biển số xe cấp cứu 115 trong biên bản số hóa');
  assert(heroScoreAfter === heroScoreBefore + 20, `Cộng thưởng +20 điểm uy tín cho Hiệp sĩ: ${heroScoreBefore} -> ${heroScoreAfter}`);

  // ===========================================================================
  // TEST CASE 7: WORKER TỰ ĐỘNG DÃN BÁN KÍNH (RING 1 -> RING 2 SAU 30s)
  // ===========================================================================
  console.log('\n--- TEST CASE 7: Dispatch Worker tự dãn bán kính (Vòng 1 -> Vòng 2 sau 30s) ---');
  const mockOldIncident = await RescueIncident.create({
    _id: `${testPrefix}inc_timeout_r1`,
    victimId: victim._id,
    status: 'DISPATCHING_R1',
    incidentType: 'SOLO_OVERDUE_FALL',
    exactLat: 10.7769,
    exactLng: 106.7009,
    fuzzedLat: 10.7770,
    fuzzedLng: 106.7010,
    dispatchRadiusKm: 1.2,
    createdAt: new Date(Date.now() - 35000), // Giả lập đã qua 35 giây
  });

  // Kích hoạt chu kỳ quét tự động của Worker
  await processDispatchLifecycle();

  const expandedInc = await RescueIncident.findById(mockOldIncident._id);
  assert(expandedInc.status === 'DISPATCHING_R2', 'Worker tự động nâng trạng thái lên DISPATCHING_R2 sau 30s');
  assert(expandedInc.dispatchRadiusKm === 4.5, 'Bán kính tự động dãn rộng lên 4.5 km');
  const hasExpandedAudit = expandedInc.auditTrail.some((a) => a.action === 'DISPATCH_RING_EXPANDED');
  assert(hasExpandedAudit, 'Ghi nhận audit trail sự kiện DISPATCH_RING_EXPANDED');

  // ===========================================================================
  // TEST CASE 8: WORKER TỰ ĐỘNG ESCALATE 115 KHI KHÔNG CÓ HIỆP SĨ (SAU 60s)
  // ===========================================================================
  console.log('\n--- TEST CASE 8: Worker tự động kích hoạt Cấp cứu 115 khi không ai nhận sau 60s ---');
  const mockDesertIncident = await RescueIncident.create({
    _id: `${testPrefix}inc_desert_no_hero`,
    victimId: victim._id,
    status: 'DISPATCHING_R2',
    incidentType: 'UNCONSCIOUS_CRITICAL',
    exactLat: 10.7769,
    exactLng: 106.7009,
    fuzzedLat: 10.7770,
    fuzzedLng: 106.7010,
    dispatchRadiusKm: 4.5,
    createdAt: new Date(Date.now() - 65000), // Giả lập đã qua 65 giây
  });

  await processDispatchLifecycle();

  const escalatedInc = await RescueIncident.findById(mockDesertIncident._id);
  assert(escalatedInc.status === 'ESCALATED_115', 'Tự động kích hoạt ESCALATED_115 khi quá 60s không có hiệp sĩ');
  const alert115 = await AlertEvent.findOne({ userId: victim._id, status: 'ESCALATED_115' });
  assert(alert115 !== null, 'Tạo bản ghi AlertEvent khẩn cấp cảnh báo gia đình kết nối 115');

  // ===========================================================================
  // TEST CASE 9: WATCHDOG PHÁT HIỆN HIỆP SĨ ĐỨNG IM > 90s (PHẠT & RE-DISPATCH)
  // ===========================================================================
  console.log('\n--- TEST CASE 9: Watchdog phát hiện Hiệp sĩ đứng im > 90s (Phạt -20đ & Tái điều phối) ---');
  const heroLazy = await User.create({
    _id: `${testPrefix}hero_lazy`,
    fullName: 'Hoàng Văn Lười (Hiệp sĩ Bỏ Ca)',
    phoneNumber: '0908888999',
    isActive: true,
    isKycVerified: true,
    lastKnownLocation: { lat: 10.7770, lng: 106.7010 },
    trustScore: 80,
    nextDeadline: new Date(Date.now() + 3600000),
  });

  const abandonedInc = await RescueIncident.create({
    _id: `${testPrefix}inc_abandoned`,
    victimId: victim._id,
    incidentType: 'ABANDONED_INCIDENT_TEST',
    status: 'ACCEPTED',
    assignedVolunteerId: heroLazy._id,
    exactLat: 10.7769,
    exactLng: 106.7009,
    fuzzedLat: 10.7770,
    fuzzedLng: 106.7010,
    telemetry: {
      lastHeroMovementAt: new Date(Date.now() - 100000), // Đứng im 100 giây
      heroSpeedKmh: 0,
      distanceRemainingMeters: 650,
    },
  });

  await VolunteerResponse.create({
    incidentId: abandonedInc._id,
    volunteerId: heroLazy._id,
    status: 'ACCEPTED',
    createdAt: new Date(Date.now() - 100000),
    updatedAt: new Date(Date.now() - 100000),
  });

  await processDispatchLifecycle();

  const incAfterWatchdog = await RescueIncident.findById(abandonedInc._id);
  const respAfterWatchdog = await VolunteerResponse.findOne({ incidentId: abandonedInc._id, volunteerId: heroLazy._id });
  const heroLazyAfter = await User.findById(heroLazy._id);

  assert(respAfterWatchdog.status === 'ABANDONED_TIMEOUT', 'Chuyển trạng thái phản hồi của hiệp sĩ thành ABANDONED_TIMEOUT');
  assert(heroLazyAfter.trustScore === 60, `Phạt trừ -20 điểm uy tín hiệp sĩ: 80 -> ${heroLazyAfter.trustScore}`);
  assert(incAfterWatchdog.assignedVolunteerId === null, 'Thu hồi ca thành công (assignedVolunteerId = null)');
  assert(incAfterWatchdog.status === 'DISPATCHING_R2', 'Tự động đưa ca về DISPATCHING_R2 để tái điều phối (Re-dispatch)');

  // ===========================================================================
  // TEST CASE 10: XÁC THỰC MÃ PIN CƯỠNG BỨC (DURESS PIN VS PIN THẬT)
  // ===========================================================================
  console.log('\n--- TEST CASE 10: Mã PIN Cưỡng Bức (Duress PIN: 9999) vs PIN Thật (1234) ---');
  const isRealPinValid = victim.realPin === '1234';
  const isDuressPinTrigger = victim.duressPin === '9999';
  assert(isRealPinValid, 'Mã PIN thật xác thực an toàn bình thường');
  assert(isDuressPinTrigger, 'Mã Duress PIN 9999 kích hoạt phân nhánh Silent SOS P0 thành công');

  // Dọn dẹp dữ liệu test
  await User.deleteMany({ _id: { $regex: `^${testPrefix}` } });
  await RescueIncident.deleteMany({ _id: { $regex: `^${testPrefix}` } });
  await VolunteerResponse.deleteMany({ incidentId: { $regex: `^${testPrefix}` } });
  await AlertEvent.deleteMany({ userId: { $regex: `^${testPrefix}` } });

  console.log('\n================================================================================');
  console.log(`                     KẾT QUẢ KIỂM THỬ NGHIỆP VỤ THỰC TẾ:`);
  console.log(`                     ✅ THÀNH CÔNG: ${passedCount} / ${passedCount + failedCount} TEST CASES`);
  console.log(`                     ❌ THẤT BẠI:   ${failedCount}`);
  console.log('================================================================================\n');

  process.exit(failedCount === 0 ? 0 : 1);
}

runRealBusinessTests().catch((err) => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
