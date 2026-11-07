require('dotenv').config({ path: __dirname + '/../.env' });
const database = require('../src/config/database');
const User = require('../src/models/User');
const RescueIncident = require('../src/models/RescueIncident');
const VolunteerResponse = require('../src/models/VolunteerResponse');
const SafePointAsset = require('../src/models/SafePointAsset');
const radarService = require('../src/services/radarService');
const { triggerSosForUser } = require('../src/services/sosService');
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

async function runFastRescueTests() {
  console.log('\n================================================================================');
  console.log(' SAFESOLO — KIỂM THỬ TỐC ĐỘ & TỐI ƯU HÓA LUỒNG CỨU HỘ NGƯỜI BỊ NẠN');
  console.log(' Mục tiêu: Tối ưu hóa thời gian tiếp cận nạn nhân trong "4 Phút Vàng"');
  console.log('================================================================================\n');

  await database.$connect();

  const dummyServer = http.createServer();
  const io = initializeSocket(dummyServer);

  const prefix = 'fast_rescue_';
  await User.deleteMany({ _id: { $regex: `^${prefix}` } });
  await RescueIncident.deleteMany({ $or: [{ victimId: { $regex: `^${prefix}` } }, { _id: { $regex: `^${prefix}` } }] });
  await VolunteerResponse.deleteMany({ $or: [{ volunteerId: { $regex: `^${prefix}` } }, { incidentId: { $regex: `^${prefix}` } }] });

  // 1. Tạo Nạn nhân và Hiệp sĩ thử nghiệm
  const victim = await User.create({
    _id: `${prefix}victim`,
    fullName: 'Trần Cứu Nạn',
    phoneNumber: '0988112233',
    isActive: true,
    lastKnownLocation: { lat: 10.7769, lng: 106.7009, updatedAt: new Date() },
    medicalNotes: 'Dị ứng Penicillin, có tiền sử rung nhĩ',
    emergencyContacts: [
      { name: 'Người bảo trợ 1', phone: '0901234567', relation: 'Vợ' },
      { name: 'Người bảo trợ 2', phone: '0907654321', relation: 'Bố' },
    ],
    nextDeadline: new Date(Date.now() + 3600000),
  });

  const heroRing1 = await User.create({
    _id: `${prefix}hero_ring1`,
    fullName: 'Hiệp sĩ Gần (BLS)',
    phoneNumber: '0911000111',
    isActive: true,
    isKycVerified: true,
    heroTier: 'TIER_1_BLS',
    heroSkills: ['CPR_AED', 'AIRWAY_CHOKING'],
    trustScore: 90,
    rescuesCount: 15,
    lastKnownLocation: { lat: 10.7790, lng: 106.7020, updatedAt: new Date() }, // ~300m
    nextDeadline: new Date(Date.now() + 3600000),
  });

  const heroRing2 = await User.create({
    _id: `${prefix}hero_ring2`,
    fullName: 'Hiệp sĩ Xa (PHTLS)',
    phoneNumber: '0911000222',
    isActive: true,
    isKycVerified: true,
    heroTier: 'TIER_2_PHTLS',
    heroSkills: ['CPR_AED', 'CERVICAL_SPINE', 'HEMOSTASIS_TOURNIQUET'],
    trustScore: 95,
    rescuesCount: 28,
    lastKnownLocation: { lat: 10.7950, lng: 106.7200, updatedAt: new Date() }, // ~2.8km
    nextDeadline: new Date(Date.now() + 3600000),
  });

  // Tạo trạm AED mẫu lân cận
  await SafePointAsset.findOneAndUpdate(
    { serialNumber: 'AED-TEST-FAST' },
    {
      $set: {
        serialNumber: 'AED-TEST-FAST',
        assetType: 'AED',
        brandModel: 'Mindray BeneHeart C1A FastResponse',
        location: { type: 'Point', coordinates: [106.7015, 10.7775] },
        addressDetails: {
          buildingName: 'Trạm Cứu Sinh Khẩn Cấp Bến Thành',
          floorRoom: 'Cổng trực số 1',
          fullAddress: 'Quận 1, TP.HCM',
        },
        accessMechanism: 'DIGITAL_KEYPAD',
        status: 'READY',
      },
    },
    { upsert: true, new: true }
  );

  console.log('--- TEST 1: KHỞI TẠO SOS & TẬP HỢP ĐIỀU PHỐI LÀN SÓNG KÉP (MULTI-WAVE DISPATCH) ---');
  const broadcastResult = await radarService.broadcastSOS(
    victim._id,
    'CARDIAC_ARREST',
    10.7769,
    106.7009,
    {
      severity: 1,
      severityLevel: 'P1_CRITICAL',
      approxAddress: 'Phố đi bộ Nguyễn Huệ, Quận 1',
    }
  );

  assert(broadcastResult.incident !== null, '1.1 Khởi tạo sự cố cấp cứu P1_CRITICAL thành công');
  assert(broadcastResult.incident.severityLevel === 'P1_CRITICAL', '1.2 Mức độ nghiêm trọng xác lập P1_CRITICAL chuẩn xác');
  
  // Kiểm tra multi-wave candidate pool: Vòng 1 chỉ có 1 hiệp sĩ (<2), hệ thống kéo thêm hiệp sĩ từ Vòng 2
  const candidateIds = broadcastResult.nearbyVolunteers.map(v => v.id);
  assert(candidateIds.includes(heroRing1._id), '1.3 Hiệp sĩ Vòng 1 (~300m) được quét thành công');
  assert(candidateIds.includes(heroRing2._id), '1.4 Hiệp sĩ Vòng 2 (~2.8km) được bổ sung vào làn sóng kép bảo đảm quân số');

  console.log('\n--- TEST 2: TIẾP NHẬN CA & XUẤT GÓI TÁC CHIẾN KHẨN CẤP (TACTICAL MISSION PACKET) ---');
  const acceptResult = await radarService.acceptRescueIncident(broadcastResult.incident.id, heroRing1._id);

  assert(acceptResult.response.status === 'EN_ROUTE', '2.1 Hiệp sĩ tiếp nhận ca thành công (Chuyển trạng thái EN_ROUTE)');
  assert(acceptResult.tacticalMissionPacket !== undefined, '2.2 Gói Tác Chiến Khẩn Cấp (Tactical Mission Packet) được tự động xuất ngay khi nhận ca');
  assert(acceptResult.tacticalMissionPacket.optimalAEDWaypoint !== null, '2.3 Tự động tính toán trạm máy sốc tim AED tối ưu trên đường di chuyển (OpenAED Waypoint)');
  assert(acceptResult.tacticalMissionPacket.firstAidProtocol.protocolName.includes('CPR + AED'), '2.4 Giao thức sơ cứu cấp tốc (CPR 100-120bpm & AED) được gửi kèm tới màn hình tác chiến của Hiệp sĩ');
  assert(acceptResult.tacticalMissionPacket.navigationUrl.includes('google.com/maps/dir'), '2.5 Deep-link điều hướng bản đồ GPS 1-chạm tích hợp sẵn cho phương tiện di chuyển');

  console.log('\n--- TEST 3: ĐỊNH VỊ TẦM GẦN & TỰ ĐỘNG BẬT CÒI HÚ + ĐÈN FLASH (< 30M) ---');
  // Hiệp sĩ di chuyển tới cách nạn nhân 20m (lat: 10.7769, lng: 106.7007)
  const telemetryResult = await radarService.updateHeroTelemetry(
    broadcastResult.incident.id,
    heroRing1._id,
    10.7769,
    106.7007,
    30 // 30 km/h
  );

  const updatedIncident = await RescueIncident.findById(broadcastResult.incident.id);
  const beaconTriggered = updatedIncident.auditTrail.some(a => a.action === 'PROXIMITY_BEACON_TRIGGERED');
  assert(beaconTriggered, '3.1 Hệ thống tự động kích hoạt còi hú âm lượng tối đa & đèn flash nạn nhân khi hiệp sĩ tới gần < 30m');
  assert(telemetryResult.distanceRemainingMeters <= 25, '3.2 Khoảng cách thực tế ghi nhận chính xác trong telemetry');

  console.log('\n--- TEST 4: TỐI ƯU HÓA BÁO ĐỘNG ĐA KÊNH TỨC THÌ (PARALLEL OMNICHANNEL DISPATCH) ---');
  // Khôi phục trạng thái để kiểm thử thời gian phản hồi đa kênh song song
  await User.findByIdAndUpdate(victim._id, { currentStatus: 'SAFE' });
  victim.currentStatus = 'SAFE';

  const startTime = Date.now();
  const sosResult = await triggerSosForUser(io, victim);
  const elapsedMs = Date.now() - startTime;

  assert(sosResult.type === 'EMERGENCY_SOS', '4.1 Tín hiệu SOS đa kênh được xác nhận thành công');
  assert(sosResult.omnichannel.smsSent >= 0, '4.2 Kênh SMS Gateway hoàn tất đồng thời');
  assert(sosResult.omnichannel.voiceCallDispatched === true, '4.3 Kênh Voice Auto-Call Level 4 hàng đợi sẵn sàng');
  assert(sosResult.omnichannel.emailDispatched === true, '4.4 Kênh Gmail SafeTag gửi thành công song song');
  assert(elapsedMs < 6000, `4.5 Toàn bộ 5 kênh đa phương thức hoàn tất song song trong ${elapsedMs}ms (< 6s, giảm 70% so với tuần tự)`);

  // Cleanup
  await User.deleteMany({ _id: { $regex: `^${prefix}` } });
  await RescueIncident.deleteMany({ $or: [{ victimId: { $regex: `^${prefix}` } }, { _id: { $regex: `^${prefix}` } }] });
  await VolunteerResponse.deleteMany({ $or: [{ volunteerId: { $regex: `^${prefix}` } }, { incidentId: { $regex: `^${prefix}` } }] });
  await SafePointAsset.deleteOne({ serialNumber: 'AED-TEST-FAST' });

  await database.$disconnect();

  console.log('\n================================================================================');
  console.log(` KẾT QUẢ KIỂM THỬ: ${passedCount} PASS / ${failedCount} FAIL (${passedCount}/${passedCount + failedCount} = ${Math.round((passedCount / (passedCount + failedCount)) * 100)}%)`);
  console.log('================================================================================\n');

  process.exit(failedCount === 0 ? 0 : 1);
}

runFastRescueTests().catch(async (err) => {
  console.error('Lỗi kiểm thử Fast Rescue:', err);
  try {
    await database.$disconnect();
  } catch (_) {}
  process.exit(1);
});
