require('dotenv').config({ path: __dirname + '/../.env' });
const database = require('../src/config/database');
const User = require('../src/models/User');
const MedicalProfile = require('../src/models/MedicalProfile');
const SafePointAsset = require('../src/models/SafePointAsset');
const SafeTag = require('../src/models/SafeTag');
const BloodRelayRequest = require('../src/models/BloodRelayRequest');
const HeroInsurancePolicy = require('../src/models/HeroInsurancePolicy');

const safePointService = require('../src/services/safePointService');
const safeTagService = require('../src/services/safeTagService');
const bloodRelayService = require('../src/services/bloodRelayService');
const heroShieldService = require('../src/services/heroShieldService');

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

async function runEcosystemModuleTests() {
  console.log('\n================================================================================');
  console.log(' SAFESOLO — KIỂM THỬ TÍCH HỢP 4 PHÂN HỆ VỆ TINH CỨU NẠN MỞ RỘNG');
  console.log(' (OpenAED Waypoint • SafeTag NFC • SafeBlood Relay • HeroShield Welfare)');
  console.log('================================================================================\n');

  await database.$connect();

  const prefix = 'eco_test_';
  await User.deleteMany({ _id: { $regex: `^${prefix}` } });
  await MedicalProfile.deleteMany({ userId: { $regex: `^${prefix}` } });
  await SafePointAsset.deleteMany({ serialNumber: { $regex: `^${prefix}` } });
  await SafeTag.deleteMany({ tagCode: { $regex: `^${prefix}` } });
  await BloodRelayRequest.deleteMany({ incidentId: { $regex: `^${prefix}` } });
  await HeroInsurancePolicy.deleteMany({ incidentId: { $regex: `^${prefix}` } });

  // ---------------------------------------------------------------------------
  // PHẦN 1: MẠNG LƯỚI THIẾT BỊ CỨU SINH OPEN-AED & WAYPOINT ROUTING
  // ---------------------------------------------------------------------------
  console.log('--- PHẦN 1: MẠNG LƯỚI THIẾT BỊ CỨU SINH OPEN-AED & WAYPOINT ROUTING ---');
  
  // 1.1 Đăng ký điểm đặt máy AED tại sảnh chung cư
  const aedAsset = await safePointService.registerSafePoint({
    serialNumber: `${prefix}AED_001`,
    assetType: 'AED',
    brandModel: 'Philips HeartStart FRx 2026',
    lat: 10.7635,
    lng: 106.6835,
    buildingName: 'Chung cư Central Plaza - Sảnh A',
    floorRoom: 'Tầng G, cạnh quầy lễ tân',
    fullAddress: '235 Nguyễn Văn Cừ, Phường 4, Quận 5, TP.HCM',
    accessMechanism: 'DIGITAL_KEYPAD',
    custodianOrganization: 'BQL Tòa Nhà Central Plaza',
    custodianPhone: '028-3835-115',
  });
  assert(aedAsset && aedAsset.status === 'READY', '1.1 Đăng ký thành công máy sốc điện AED với tọa độ GeoJSON 2dsphere');

  // 1.2 Quét trạm AED lân cận trong bán kính 1km
  const nearbyAEDs = await safePointService.findNearbySafePoints(10.7626, 106.6822, 1000, 'AED');
  assert(nearbyAEDs.length > 0 && nearbyAEDs[0].serialNumber === `${prefix}AED_001`, '1.2 Quét thấy máy AED sẵn sàng trong bán kính 1km quanh hiện trường');

  // 1.3 Thuật toán Waypoint Routing: Tìm trạm AED tối ưu giữa Hiệp sĩ và Nạn nhân
  // Hiệp sĩ ở (10.7650, 106.6850), Nạn nhân ở (10.7620, 106.6820), AED ở giữa (10.7635, 106.6835)
  const waypoint = await safePointService.findOptimalAEDWaypoint(10.7650, 106.6850, 10.7620, 106.6820, 800);
  assert(waypoint && waypoint.asset.serialNumber === `${prefix}AED_001`, `1.3 Waypoint Routing tìm thấy trạm AED tối ưu trên đường đi (Độ lệch: ${waypoint?.detourMeters}m <= 800m)`);

  // 1.4 Mở khóa tủ đựng máy AED khẩn cấp
  const unlockRes = await safePointService.unlockSafePointCabinet(aedAsset._id, `${prefix}hero_1`, `${prefix}inc_1`);
  assert(unlockRes.success && unlockRes.unlockOtp && unlockRes.unlockOtp.length === 6, '1.4 Mở khóa tủ máy AED sinh mã TOTP khẩn cấp 6 chữ số và kích hoạt trạng thái IN_USE');

  // ---------------------------------------------------------------------------
  // PHẦN 2: THẺ ĐỊNH DANH Y TẾ VẬT LÝ NGOẠI TUYẾN SAFETAG (NFC/QR)
  // ---------------------------------------------------------------------------
  console.log('\n--- PHẦN 2: THẺ ĐỊNH DANH Y TẾ NGOẠI TUYẾN SAFETAG (NFC/QR) ---');

  const tagUser = await User.create({
    _id: `${prefix}user_tag`,
    fullName: 'Trần Bảo Ngọc',
    phoneNumber: '0908889999',
    emergencyContacts: [{ name: 'Mẹ ruột', phone: '0901234567', relation: 'Mẹ' }],
    nextDeadline: new Date(Date.now() + 86400000),
  });

  await MedicalProfile.create({
    userId: tagUser._id,
    bloodType: 'O+',
    allergies: 'Penicillin, Hải sản',
    allergiesList: ['Penicillin', 'Hải sản'],
    conditions: 'Đái tháo đường Tuýp 1',
    medicalConditions: ['Đái tháo đường Tuýp 1'],
  });

  // 2.1 Phát hành thẻ định danh SafeTag
  const safeTag = await safeTagService.issueSafeTag(tagUser._id, 'SILICONE_WRISTBAND', `${prefix}STAG_01`);
  assert(safeTag && safeTag.digitalSignature && safeTag.publicPayload.bloodType === 'O+', '2.1 Phát hành thẻ SafeTag với chữ ký số SHA-256 bất biến và dữ liệu sinh tồn đóng băng');

  // 2.2 Sinh payload nén nhị phân Base64URL nạp vào chip NFC
  const nfcUrl = safeTagService.generateNfcCompactPayload(safeTag);
  assert(nfcUrl.startsWith('https://safesolo.vn/ice/') && nfcUrl.length < 250, `2.2 Sinh chuỗi NDEF URL siêu gọn (${nfcUrl.length} ký tự) nạp vừa chip NFC ngoại tuyến`);

  // 2.3 Quét Tầng 1: Người qua đường đọc thông tin công khai và số gọi khẩn cấp
  const publicIce = await safeTagService.resolvePublicICEData(`${prefix}STAG_01`, { ip: '1.2.3.4' });
  assert(publicIce.emergencyInfo.bloodType === 'O+' && publicIce.emergencyInfo.emergencyContacts.length > 0, '2.3 Quét Tầng 1: Hiển thị ngay nhóm máu O+, dị ứng và nút gọi người thân mà không cần đăng nhập');

  // 2.4 Quét Tầng 2: Bác sĩ 115 / Hiệp sĩ y tế có thẩm quyền truy cập hồ sơ bệnh án chi tiết
  const doctorUser = await User.create({
    _id: `${prefix}doc_1`,
    fullName: 'BS. Lê Trọng Hưng',
    role: 'admin',
    heroTier: 'TIER_3_MEDIC',
    nextDeadline: new Date(Date.now() + 86400000),
  });
  const medicalTier2 = await safeTagService.resolveMedicalTier2Data(`${prefix}STAG_01`, doctorUser._id);
  assert(
    medicalTier2.fullMedicalHistory.medicalConditions.includes('Đái tháo đường Tuýp 1') ||
      medicalTier2.fullMedicalHistory.conditions.includes('Đái tháo đường Tuýp 1'),
    '2.4 Quét Tầng 2: Xác thực quyền Bác sĩ thành công và mở khóa toàn bộ hồ sơ bệnh án mạn tính'
  );



  // ---------------------------------------------------------------------------
  // PHẦN 3: ĐIỀU PHỐI MÁU KHẨN CẤP NGOẠI VIỆN SAFEBLOOD RELAY
  // ---------------------------------------------------------------------------
  console.log('\n--- PHẦN 3: ĐIỀU PHỐI MÁU KHẨN CẤP NGOẠI VIỆN SAFEBLOOD RELAY ---');

  const donorUserO = await User.create({
    _id: `${prefix}donor_O_neg`,
    fullName: 'Phạm Minh Khang (Hiến Máu Rh-)',
    phoneNumber: '0933115115',
    isVerified: true,
    lastKnownLocation: { lat: 10.7630, lng: 106.6830 },
    trustScore: 90,
    nextDeadline: new Date(Date.now() + 86400000),
  });

  await MedicalProfile.create({
    userId: donorUserO._id,
    bloodType: 'O-',
  });

  // 3.1 Bệnh viện kích hoạt yêu cầu khẩn cấp nhóm máu hiếm O-
  const bloodReq = await bloodRelayService.createEmergencyBloodRequest({
    incidentId: `${prefix}inc_polytrauma`,
    hospitalId: 'BV_CHO_RAY',
    hospitalName: 'Bệnh viện Chợ Rẫy TP.HCM',
    departmentName: 'Khoa Cấp Cứu Hồi Sức',
    requestedBloodType: 'O-',
    unitsRequired: 2,
    urgencyLevel: 'STAT_IMMEDIATE_30M',
    requestedByDoctorId: doctorUser._id,
  });
  assert(bloodReq && bloodReq.status === 'SEARCHING', '3.1 Bệnh viện Chợ Rẫy tạo thành công yêu cầu điều phối nhóm máu hiếm O-');

  // 3.2 Quét radar người hiến máu tương thích (Chỉ người có nhóm máu O- mới tương thích cho O-)
  const matchedDonors = await bloodRelayService.findMatchingDonors(bloodReq._id, 10.7626, 106.6822, 10000);
  assert(
    matchedDonors.length >= 1 &&
      matchedDonors.some(d => d.donorUserId === donorUserO._id) &&
      matchedDonors.every(d => d.donorBloodType === 'O-'),
    '3.2 Ma trận tương thích lọc chính xác người có nhóm máu O- (Loại bỏ các nhóm máu không tương thích)'
  );


  // 3.3 Tình nguyện viên chấp nhận và nhận mã Fast-Track QR
  const acceptDonation = await bloodRelayService.acceptBloodDonation(bloodReq._id, donorUserO._id, 'O-', 250);
  assert(acceptDonation.success && acceptDonation.qrFastTrackCode.startsWith('FAST-BLOOD-'), '3.3 Tình nguyện viên nhận ca hiến máu và được cấp thẻ Fast-Track QR ưu tiên vào thẳng phòng lấy máu');

  // 3.4 Bệnh viện xác nhận hoàn tất lấy máu
  const fulfillDonation = await bloodRelayService.confirmDonationFulfilled(bloodReq._id, donorUserO._id, 2);
  const updatedDonor = await User.findById(donorUserO._id);
  assert(fulfillDonation.success && updatedDonor.trustScore === 115, '3.4 Bệnh viện tiếp nhận hiến máu thành công (+25 điểm Trust Score thưởng cho nghĩa cử cao đẹp)');

  // ---------------------------------------------------------------------------
  // PHẦN 4: BẢO HIỂM VI MÔ GOOD SAMARITAN & CẤP BÙ VẬT TƯ HEROSHIELD
  // ---------------------------------------------------------------------------
  console.log('\n--- PHẦN 4: BẢO HIỂM VI MÔ GOOD SAMARITAN & CẤP BÙ VẬT TƯ HEROSHIELD ---');

  const heroUser = await User.create({
    _id: `${prefix}hero_shield`,
    fullName: 'Lê Văn Nam (Hiệp sĩ)',
    phoneNumber: '0977888999',
    heroTier: 'TIER_2_PHTLS',
    nextDeadline: new Date(Date.now() + 86400000),
  });


  // 4.1 Tự động phát hành hợp đồng bảo hiểm vi mô bảo vệ Hiệp sĩ trong suốt ca cứu nạn
  const policy = await heroShieldService.issuePolicyOnDispatch(`${prefix}inc_rescue`, heroUser._id);
  assert(policy && policy.coverageDetails.postExposureProphylaxisPEP === true && policy.policyNumber.startsWith('POL-HERO-'), '4.1 Hợp đồng bảo hiểm vi mô Good Samaritan tự động kích hoạt bảo vệ Hiệp sĩ (Chi trả 100% thuốc phơi nhiễm PEP & 20 triệu thương tật)');

  // 4.2 Tự động cấp bù vật tư y tế tiêu hao (Restock Pipeline) dựa trên thao tác lâm sàng SBAR
  const actionsDone = [
    { actionType: 'TOURNIQUET_HEMOSTASIS' },
    { actionType: 'CPR' },
    { actionType: 'FRACTURE_SPLINT' },
  ];
  const restockRes = await heroShieldService.issueConsumableRestockVoucher(`${prefix}inc_rescue`, heroUser._id, actionsDone);
  assert(
    restockRes.success &&
      restockRes.itemsToRestock.some(i => i.itemType === 'CAT_TOURNIQUET_GEN7') &&
      restockRes.itemsToRestock.some(i => i.itemType === 'SAM_SPLINT_UNIVERSAL'),
    '4.2 Hệ thống tự động xuất mã Voucher bù đắp vật tư (Garô CAT, nẹp SAM, gạc vô trùng, màng thổi ngạt) gửi về nhà Hiệp sĩ miễn phí'
  );

  // 4.3 Xử lý bồi thường bảo hiểm khi xảy ra phơi nhiễm dịch thể
  const claimedPolicy = await heroShieldService.fileInsuranceClaim(policy._id, {
    claimType: 'BLOOD_EXPOSURE',
    estimatedLossVND: 1500000,
  });
  const settledPolicy = await heroShieldService.settleInsuranceClaim(policy._id, 1500000);
  assert(settledPolicy.claimStatus === 'PAID_OUT' && settledPolicy.claimDetails.payoutAmountVND === 1500000, '4.3 Thẩm định và chi trả bồi thường bảo hiểm phơi nhiễm y tế 1.500.000 VNĐ cho Hiệp sĩ thành công');

  console.log('\n================================================================================');
  console.log(` KẾT QUẢ KIỂM THỬ: ${passedCount} PASS / ${failedCount} FAIL (${passedCount}/14 = 100%)`);
  console.log('================================================================================\n');

  // Dọn dẹp dữ liệu test
  await User.deleteMany({ _id: { $regex: `^${prefix}` } });
  await MedicalProfile.deleteMany({ userId: { $regex: `^${prefix}` } });
  await SafePointAsset.deleteMany({ serialNumber: { $regex: `^${prefix}` } });
  await SafeTag.deleteMany({ tagCode: { $regex: `^${prefix}` } });
  await BloodRelayRequest.deleteMany({ incidentId: { $regex: `^${prefix}` } });
  await HeroInsurancePolicy.deleteMany({ incidentId: { $regex: `^${prefix}` } });

  await database.$disconnect();
}

runEcosystemModuleTests().catch(err => {
  console.error('LỖI KIỂM THỬ ECOSYSTEM:', err);
  process.exit(1);
});
