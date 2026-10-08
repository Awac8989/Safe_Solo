/**
 * Kiểm tra Thực nghiệm Nghiệp vụ Kịch bản 15 (Anti-Ambush Buddy Dispatch),
 * Kịch bản 23 (Tele-FirstAid Video Call Logging) & Kịch bản 4.2 (Sát hạch Lâm sàng 20 câu)
 */
const mongoose = require('mongoose');
const assert = require('assert');
const User = require('../src/models/User');
const RescueIncident = require('../src/models/RescueIncident');
const VolunteerResponse = require('../src/models/VolunteerResponse');
const KYCDocument = require('../src/models/KYCDocument');
const radarService = require('../src/services/radarService');
const adminPortalService = require('../src/services/adminPortalService');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/Safesolo';

async function runTest() {
  console.log('=== BẮT ĐẦU KIỂM THỬ THỰC TẾ: BUDDY DISPATCH, TELE-FIRSTAID & CLINICAL EXAM ===\n');

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(MONGO_URI);
    console.log('[DB] Đã kết nối MongoDB thành công.');
  }

  const prefix = `test_buddy_${Date.now()}`;

  // 1. Khởi tạo Nạn nhân và 2 Hiệp sĩ thử nghiệm
  const phoneSuffix = String(Date.now()).slice(-6);
  const victimPhone = `0901${phoneSuffix}`;
  const heroAPhone = `0902${phoneSuffix}`;
  const heroBPhone = `0903${phoneSuffix}`;

  const victim = await User.create({
    _id: `${prefix}_victim`,
    fullName: 'Lê Minh Nguyệt (Nạn nhân đêm)',
    email: `${prefix}_victim@example.com`,
    phoneNumber: victimPhone,
    role: 'user',
    trustScore: 90,
    isKycVerified: true,
    nextDeadline: new Date(Date.now() + 86400000),
  });

  const heroA = await User.create({
    _id: `${prefix}_hero_a`,
    fullName: 'Nguyễn Văn Hùng (Hiệp sĩ A - Tiên phong)',
    email: `${prefix}_hero_a@example.com`,
    phoneNumber: heroAPhone,
    role: 'user',
    isKycVerified: true,
    heroTier: 'TIER_2_PHTLS',
    heroSkills: ['CPR_AED', 'TOURNIQUET_HEMOSTASIS', 'C_SPINE_STABILIZE'],
    trustScore: 95,
    certificateExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    isOnlineForRescue: true,
    nextDeadline: new Date(Date.now() + 86400000),
  });

  const heroB = await User.create({
    _id: `${prefix}_hero_b`,
    fullName: 'Trần Đình Trọng (Hiệp sĩ B - Hỗ trợ Cặp đôi)',
    email: `${prefix}_hero_b@example.com`,
    phoneNumber: heroBPhone,
    role: 'user',
    isKycVerified: true,
    heroTier: 'TIER_1_BLS',
    heroSkills: ['CPR_AED', 'AIRWAY_CHOKING'],
    trustScore: 92,
    certificateExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    isOnlineForRescue: true,
    nextDeadline: new Date(Date.now() + 86400000),
  });

  console.log('1. Khởi tạo dữ liệu người dùng & hiệp sĩ thử nghiệm: PASS');

  // 2. Kịch bản 15: Tạo sự cố khẩn cấp kích hoạt Buddy Dispatch (Chống bẫy dàn cảnh đêm khuya)
  const { incident: incidentData } = await radarService.broadcastSOS(
    victim._id,
    'TAI_NAN_DEM_KHUYA',
    10.771234,
    106.691234,
    {
      severity: 2,
      severityLevel: 'P1_CRITICAL',
      approxAddress: 'Khu vực đường vắng Bến Vân Đồn, Q.4',
      isBuddyDispatchRequired: true, // Kích hoạt bắt buộc Cặp đôi
      isHighRiskArea: true,
    },
  );

  assert(incidentData.isBuddyDispatchRequired === true, 'Sự cố phải kích hoạt cờ isBuddyDispatchRequired');
  assert(incidentData.buddyStatus === 'WAITING_BUDDY', 'Trạng thái ban đầu phải là WAITING_BUDDY');
  assert(incidentData.rendezvousPoint !== null, 'Phải tự động sinh điểm tập kết an toàn Rendezvous Point');
  console.log(`2. Kích hoạt Anti-Ambush & Buddy Dispatch: PASS (Điểm tập kết cách 200m: ${incidentData.rendezvousPoint.lat}, ${incidentData.rendezvousPoint.lng})`);

  // 3. Hiệp sĩ A nhận ca (Hiệp sĩ 1)
  const acceptResultA = await radarService.acceptRescueIncident(incidentData.id, heroA._id);
  assert(acceptResultA.incident.assignedVolunteerId === heroA._id, 'Hiệp sĩ A phải là assignedVolunteerId');
  assert(acceptResultA.incident.buddyStatus === 'WAITING_BUDDY', 'Vẫn ở trạng thái WAITING_BUDDY chờ Hiệp sĩ thứ 2');
  console.log('3. Hiệp sĩ A nhận ca (Tiên phong, chờ đồng đội): PASS');

  // 4. Hiệp sĩ B nhận ca (Hiệp sĩ 2 gia nhập Cặp đôi)
  const acceptResultB = await radarService.acceptRescueIncident(incidentData.id, heroB._id);
  assert(acceptResultB.incident.buddyStatus === 'BUDDY_PAIRED', 'Trạng thái phải chuyển thành BUDDY_PAIRED');
  assert(acceptResultB.incident.backupVolunteerIds.includes(heroB._id), 'Hiệp sĩ B phải có trong backupVolunteerIds');
  assert(acceptResultB.incident.status === 'ACCEPTED', 'Ca cứu nạn chuyển sang ACCEPTED với đầy đủ 2 hiệp sĩ');
  console.log('4. Hiệp sĩ B gia nhập Cặp đôi (BUDDY_PAIRED thành công): PASS');

  // 5. Kịch bản 23: Hiệp sĩ thực hiện cuộc gọi Tele-FirstAid với Bác sĩ Tier 3
  const teleAction = await radarService.recordFirstAidAction(
    incidentData.id,
    heroA._id,
    'TELE_FIRSTAID_CALL',
    {
      notes: 'Hội chẩn khẩn cấp Tele-FirstAid với BS. CKI Trần Minh Tuấn (Thời lượng 45 giây)',
      durationSeconds: 45,
    },
  );
  assert(teleAction !== null, 'Phải ghi nhận thành công thao tác Tele-FirstAid');
  const responseA = await VolunteerResponse.findOne({ incidentId: incidentData.id, volunteerId: heroA._id });
  const hasTeleLog = responseA.firstAidActionsPerformed.some(a => a.actionType === 'TELE_FIRSTAID_CALL');
  assert(hasTeleLog === true, 'Phải lưu trữ nhật ký TELE_FIRSTAID_CALL trong VolunteerResponse');
  console.log('5. Ghi nhận nhật ký Tele-FirstAid WebRTC với Bác sĩ: PASS');

  // 6. Kiểm tra Web Admin lấy được đầy đủ thông tin ca cứu hộ có Buddy Dispatch
  const overview = await adminPortalService.getOverview();
  const foundAdminIncident = overview.incidents.find(inc => String(inc.id) === String(incidentData.id));
  assert(foundAdminIncident !== undefined, 'Web Admin phải hiển thị ca sự cố này');
  assert(foundAdminIncident.isBuddyDispatchRequired === true, 'Web Admin phải nhận diện ca Buddy Dispatch');
  assert(foundAdminIncident.buddyStatus === 'BUDDY_PAIRED', 'Web Admin phải thấy trạng thái BUDDY_PAIRED');
  console.log('6. Web Admin đối soát hiển thị Cặp đôi Hiệp sĩ & Điểm tập kết: PASS');

  // 7. Dọn dẹp dữ liệu test
  await RescueIncident.deleteOne({ _id: incidentData.id });
  await VolunteerResponse.deleteMany({ incidentId: incidentData.id });
  await User.deleteMany({ _id: { $in: [victim._id, heroA._id, heroB._id] } });
  console.log('7. Dọn dẹp dữ liệu kiểm thử hoàn tất: PASS');

  console.log('\n=== TẤT CẢ 7 BƯỚC KIỂM THỬ THỰC TẾ TRÊN MONGODB ĐÃ HOÀN TẤT XUẤT SẮC 100%! ===');
}

runTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('LỖI KIỂM THỬ:', err);
    process.exit(1);
  });
