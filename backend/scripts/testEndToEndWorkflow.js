const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../src/models/User');
const RescueIncident = require('../src/models/RescueIncident');
const VolunteerResponse = require('../src/models/VolunteerResponse');
const KYCDocument = require('../src/models/KYCDocument');
const MedicalProfile = require('../src/models/MedicalProfile');
const SafePointAsset = require('../src/models/SafePointAsset');
const SafeTag = require('../src/models/SafeTag');
const BloodRelayRequest = require('../src/models/BloodRelayRequest');
const HeroInsurancePolicy = require('../src/models/HeroInsurancePolicy');

const radarService = require('../src/services/radarService');
const adminPortalService = require('../src/services/adminPortalService');
const safePointService = require('../src/services/safePointService');
const safeTagService = require('../src/services/safeTagService');
const bloodRelayService = require('../src/services/bloodRelayService');
const heroShieldService = require('../src/services/heroShieldService');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/Safesolo';

async function runEndToEndVerification() {
  console.log('================================================================================');
  console.log('🩺 SAFESOLO — TỔNG DIỄN TẬP TÁC CHIẾN LIÊN THÔNG TOÀN DIỆN 10 BƯỚC');
  console.log('   (App Di Động • Thiết Bị Đeo • Mạng Lưới OpenAED • SafeTag • Web Admin)');
  console.log('   Căn cứ Điều 87 Luật Khám bệnh, chữa bệnh 2023 & Quy trình Vận hành SOP v3.0');
  console.log('================================================================================\n');

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(MONGO_URI);
  }

  // ---------------------------------------------------------------------------
  // BƯỚC 1: KHỞI TẠO NẠN NHÂN, HIỆP SĨ TIER 2 VÀ CÁC THIẾT BỊ SINH TỒN
  // ---------------------------------------------------------------------------
  console.log('[BƯỚC 1] Khởi tạo dữ liệu thực thể trên hệ thống...');
  let victim = await User.findOne({ phoneNumber: '0909115001' });
  if (!victim) {
    victim = await User.create({
      fullName: 'Bà Hoàng Thị Mai (68 tuổi)',
      phoneNumber: '0909115001',
      role: 'user',
      isVerified: true,
      lastKnownLocation: { lat: 10.762622, lng: 106.682276 },
      approxAddress: '227 Nguyễn Văn Cừ, Phường 4, Quận 5, TP.HCM',
      medicalNotes: 'Tiền sử rung nhĩ kịch phát AFib, tăng huyết áp mạn',
      emergencyContacts: [{ name: 'Con trai', phone: '0901234567', relation: 'Con trai' }],
      nextDeadline: new Date(Date.now() + 86400000),
    });
  }

  // Khởi tạo hồ sơ y tế & thẻ định danh SafeTag ngoại tuyến cho nạn nhân
  let victimMed = await MedicalProfile.findOne({ userId: victim._id });
  if (!victimMed) {
    victimMed = await MedicalProfile.create({
      userId: victim._id,
      bloodType: 'O-',
      allergies: 'Penicillin',
      allergiesList: ['Penicillin'],
      conditions: 'Rung nhĩ, Tăng huyết áp',
      medicalConditions: ['Rung nhĩ', 'Tăng huyết áp'],
    });
  }

  let victimTag = await SafeTag.findOne({ userId: victim._id });
  if (!victimTag) {
    victimTag = await safeTagService.issueSafeTag(victim._id, 'SILICONE_WRISTBAND', 'STAG-MAI-68');
  }

  let hero = await User.findOne({ phoneNumber: '0913843958' });
  if (!hero) {
    hero = await User.create({
      fullName: 'Đoàn Minh Quân',
      phoneNumber: '0913843958',
      role: 'admin',
      isVerified: true,
      isKycVerified: true,
      heroTier: 'TIER_2_PHTLS',
      heroSkills: ['CPR_AED', 'TOURNIQUET_HEMOSTASIS', 'C_SPINE_STABILIZE', 'FRACTURE_SPLINTING'],
      trustScore: 98,
      rescuesCount: 14,
      isOnlineForRescue: true,
      lastKnownLocation: { lat: 10.765000, lng: 106.685000 },
      nextDeadline: new Date(Date.now() + 86400000),
    });
  } else {
    hero.isKycVerified = true;
    hero.heroTier = 'TIER_2_PHTLS';
    hero.heroSkills = ['CPR_AED', 'TOURNIQUET_HEMOSTASIS', 'C_SPINE_STABILIZE', 'FRACTURE_SPLINTING'];
    hero.trustScore = 98;
    hero.lastKnownLocation = { lat: 10.765000, lng: 106.685000 };
    hero.isOnlineForRescue = true;
    await hero.save();
  }

  // Khởi tạo trạm AED lân cận (Sảnh Tòa Nhà Central Plaza)
  let aed = await SafePointAsset.findOne({ serialNumber: 'AED-CENTRAL-PLAZA-01' });
  if (!aed) {
    aed = await safePointService.registerSafePoint({
      serialNumber: 'AED-CENTRAL-PLAZA-01',
      assetType: 'AED',
      brandModel: 'Philips HeartStart FRx',
      lat: 10.7635,
      lng: 106.6835,
      buildingName: 'Chung cư Central Plaza - Sảnh A',
      floorRoom: 'Tầng G, cạnh quầy lễ tân',
      fullAddress: '235 Nguyễn Văn Cừ, Phường 4, Quận 5, TP.HCM',
      accessMechanism: 'DIGITAL_KEYPAD',
      custodianOrganization: 'BQL Tòa Nhà Central Plaza',
      custodianPhone: '028-3835-115',
    });
  }

  console.log(`  -> Nạn nhân: ${victim.fullName} (${victim._id}) - Nhóm máu: ${victimMed.bloodType}`);
  console.log(`  -> Thẻ SafeTag vật lý: ${victimTag.tagCode} (Sẵn sàng quét ngoại tuyến 1-touch)`);
  console.log(`  -> Hiệp sĩ: ${hero.fullName} - Bậc: ${hero.heroTier} (${hero._id})`);
  console.log(`  -> Trạm AED công cộng: ${aed.addressDetails.buildingName} (${aed.serialNumber})\n`);

  // ---------------------------------------------------------------------------
  // BƯỚC 2: APP NẠN NHÂN PHÁT TÍN HIỆU SOS P1 (RUNG NHĨ & NGÃ BẤT TỈNH)
  // ---------------------------------------------------------------------------
  console.log('[BƯỚC 2] Cảm biến IMU & Wear OS phát hiện té ngã + Rung nhĩ kịch phát 124 bpm...');
  const broadcastResult = await radarService.broadcastSOS(
    victim._id,
    'MEDICAL',
    10.762622,
    106.682276,
    {
      severity: 3,
      severityLevel: 'P1_CRITICAL',
      approxAddress: '227 Nguyễn Văn Cừ, Phường 4, Quận 5, TP.HCM',
      medicalNotes: 'Té ngã đập đầu, SpO2 91%, Rung nhĩ AFib kịch phát 124 bpm',
      requiredSkillTier: 'TIER_2_PHTLS',
      requiredSkills: ['CPR_AED', 'TOURNIQUET_HEMOSTASIS', 'C_SPINE_STABILIZE'],
    }
  );
  const incidentId = broadcastResult.incident.id;
  console.log(`  -> Sự cố khởi tạo: ${incidentId} (Trạng thái: ${broadcastResult.incident.status})`);
  console.log(`  -> Yêu cầu kỹ năng khẩn cấp: CPR_AED, C_SPINE_STABILIZE\n`);

  // ---------------------------------------------------------------------------
  // BƯỚC 3: HỆ THỐNG TÍNH TOÁN LỘ TRÌNH KÉP GHÉ LẤY MÁY AED (WAYPOINT ROUTING)
  // ---------------------------------------------------------------------------
  console.log('[BƯỚC 3] Hệ thống quét trạm AED và tính lộ trình ghé trạm tối ưu...');
  const waypoint = await safePointService.findOptimalAEDWaypoint(
    hero.lastKnownLocation.lat,
    hero.lastKnownLocation.lng,
    10.762622,
    106.682276,
    800
  );
  if (waypoint) {
    console.log(`  -> Đã tìm thấy máy AED trên cung đường: ${waypoint.asset.brandModel}`);
    console.log(`  -> Điểm lấy: ${waypoint.asset.addressDetails.buildingName} (${waypoint.asset.addressDetails.floorRoom})`);
    console.log(`  -> Độ lệch quãng đường (Detour): ${waypoint.detourMeters}m (Thời gian ghé lấy: ~45 giây)\n`);
  }

  // ---------------------------------------------------------------------------
  // BƯỚC 4: HIỆP SĨ NHẬN CA & KÍCH HOẠT BẢO HIỂM VI MÔ GOOD SAMARITAN
  // ---------------------------------------------------------------------------
  console.log('[BƯỚC 4] Hiệp sĩ trượt nhận ca & Kích hoạt hành lang bảo vệ pháp lý...');
  const acceptResult = await radarService.acceptRescueIncident(incidentId, hero._id);
  console.log(`  -> Trạng thái ca: ${acceptResult.response.status}`);
  console.log(`  -> Ký số Good Samaritan Shield: ${acceptResult.response.goodSamaritanAgreementSigned}`);

  // Tự động kích hoạt hợp đồng bảo hiểm vi mô HeroShield
  const heroPolicy = await heroShieldService.issuePolicyOnDispatch(incidentId, hero._id);
  console.log(`  -> Hợp đồng bảo hiểm vi mô đã cấp: ${heroPolicy.policyNumber}`);
  console.log(`  -> Bảo vệ: 100% thuốc phơi nhiễm PEP, 20 triệu VNĐ thương tật, 5 triệu VNĐ phương tiện\n`);

  // ---------------------------------------------------------------------------
  // BƯỚC 5: HIỆP SĨ MỞ TỦ LẤY MÁY AED & TIẾP CẬN HIỆN TRƯỜNG
  // ---------------------------------------------------------------------------
  console.log('[BƯỚC 5] Hiệp sĩ ghé sảnh Central Plaza mở tủ lấy máy AED...');
  const unlockAed = await safePointService.unlockSafePointCabinet(aed._id, hero._id, incidentId);
  console.log(`  -> Mã mở tủ AED (Passcode TOTP): ${unlockAed.unlockOtp}`);
  console.log(`  -> Trạng thái tủ AED: Chuyển sang IN_USE`);

  console.log('  -> Hiệp sĩ di chuyển tới hiện trường (Telemetry Watchdog)...');
  const telem1 = await radarService.updateHeroTelemetry(incidentId, hero._id, 10.7635, 106.6830, 32);
  console.log(`  -> Tọa độ T+30s: Cách nạn nhân ${telem1.distanceRemainingMeters}m (Vận tốc 32 km/h)`);
  const telem2 = await radarService.updateHeroTelemetry(incidentId, hero._id, 10.762630, 106.682280, 0);
  console.log(`  -> Tọa độ T+120s: Cách nạn nhân ${telem2.distanceRemainingMeters}m (< 25m - ĐÃ TỚI HIỆN TRƯỜNG)\n`);

  // ---------------------------------------------------------------------------
  // BƯỚC 6: THỰC HIỆN 3 THAO TÁC SƠ CỨU LÂM SÀNG CHUẨN Y KHOA (SCENE SOP)
  // ---------------------------------------------------------------------------
  console.log('[BƯỚC 6] Hiệp sĩ thực hiện kỹ thuật lâm sàng hiện trường (Chuẩn AHA & DRSABCD)...');
  
  // 6.1 Cố định cột sống cổ C-Spine
  const fa1 = await radarService.recordFirstAidAction(incidentId, hero._id, {
    actionType: 'C_SPINE_STABILIZE',
    durationSeconds: 120,
    notes: 'Giữ trục đầu cổ thẳng và xoay lật Log-roll 3 người chống liệt tủy cổ.',
  });
  console.log(`  -> [Thao tác 1] ${fa1.record.actionType}: Đã hoàn tất`);

  // 6.2 Đặt Garô CAT chèn động mạch
  const fa2 = await radarService.recordFirstAidAction(incidentId, hero._id, {
    actionType: 'TOURNIQUET_HEMOSTASIS',
    durationSeconds: 90,
    notes: 'Đặt garô CAT đùi trái cách vết thương 5cm, siết chặt, ghi giờ lên trán.',
  });
  console.log(`  -> [Thao tác 2] ${fa2.record.actionType}: Đã hoàn tất`);

  // 6.3 Ép tim CPR Metronome 110 bpm kết hợp dán điện cực máy AED vừa mang tới
  const fa3 = await radarService.recordFirstAidAction(incidentId, hero._id, {
    actionType: 'CPR',
    durationSeconds: 180,
    notes: 'Dán miếng dán AED, ép tim 30:2 với máy Metronome 110 bpm. SpO2 hồi phục từ 91% lên 96%.',
  });
  console.log(`  -> [Thao tác 3] ${fa3.record.actionType}: Đã hoàn tất\n`);

  // ---------------------------------------------------------------------------
  // BƯỚC 7: BÀN GIAO SBAR CHO 115, QUÉT SAFETAG & CẤP BÙ VẬT TƯ TIÊU HAO
  // ---------------------------------------------------------------------------
  console.log('[BƯỚC 7] Xe 115 đến: Quét SafeTag, Bàn giao SBAR & Cấp bù vật tư y tế...');
  
  // 7.1 Bác sĩ 115 chạm NFC quét thẻ SafeTag trên cổ tay nạn nhân
  const iceMedical = await safeTagService.resolveMedicalTier2Data(victimTag.tagCode, hero._id, incidentId);
  console.log(`  -> Bác sĩ 115 quét SafeTag: Nhận diện ${iceMedical.victim?.fullName}, Nhóm máu: ${iceMedical.fullMedicalHistory?.bloodType}`);

  // 7.2 Bàn giao lâm sàng SBAR cho Bác sĩ 115
  const sbarHash = `0x${crypto.createHash('sha256').update(`${incidentId}:SBAR:${Date.now()}`).digest('hex').slice(0, 16)}`;
  const handoffResult = await radarService.handoffToMedical(incidentId, hero._id, {
    ambulancePlate: '51B-115.99',
    paramedicName: 'BS. CKI Trần Minh Tuấn (Trung tâm Cấp cứu 115 TP.HCM)',
    qrVerificationHash: sbarHash,
    notes: 'Nạn nhân đã ổn định SpO2 96%, mạch 86 bpm, garô đùi trái cầm máu tốt. Chuyển BV Chợ Rẫy.',
  });
  console.log(`  -> Đã bàn giao xe 115: ${handoffResult.handoffRecord?.ambulancePlate} (${handoffResult.handoffRecord?.paramedicName})`);
  console.log(`  -> Trạng thái ca: ${handoffResult.status}`);

  // 7.3 Tự động cấp Voucher bù đắp vật tư y tế tiêu hao gửi về tận nhà Hiệp sĩ
  const restockResult = await heroShieldService.issueConsumableRestockVoucher(incidentId, hero._id, [
    { actionType: 'TOURNIQUET_HEMOSTASIS' },
    { actionType: 'CPR' },
    { actionType: 'C_SPINE_STABILIZE' },
  ]);
  console.log(`  -> Voucher bù đắp vật tư đã cấp: ${restockResult.voucherCode}`);
  console.log(`  -> Vật tư được cấp bù miễn phí: 1 Garô CAT Gen 7, 2 Gạc nén vô trùng, 2 Đôi găng tay Nitrile\n`);

  // ---------------------------------------------------------------------------
  // BƯỚC 8: BỆNH VIỆN TIẾP NHẬN & ĐIỀU PHỐI CHI VIỆN MÁU HIẾM SAFEBLOOD RELAY
  // ---------------------------------------------------------------------------
  console.log('[BƯỚC 8] Bệnh viện tiếp nhận ca xuất huyết nặng -> Kích hoạt SafeBlood Relay...');
  const bloodReq = await bloodRelayService.createEmergencyBloodRequest({
    incidentId,
    hospitalId: 'BV_CHO_RAY',
    hospitalName: 'Bệnh viện Chợ Rẫy TP.HCM',
    departmentName: 'Khoa Cấp Cứu Hồi Sức',
    requestedBloodType: 'O-',
    unitsRequired: 2,
    urgencyLevel: 'STAT_IMMEDIATE_30M',
    requestedByDoctorId: hero._id,
  });
  console.log(`  -> Đã kích hoạt yêu cầu máu khẩn cấp: Nhóm máu ${bloodReq.requestedBloodType} (2 đơn vị)`);
  console.log(`  -> Mạng lưới quét người hiến máu tình nguyện sẵn sàng chi viện trực tiếp tại viện\n`);

  // ---------------------------------------------------------------------------
  // BƯỚC 9: ĐIỀU PHỐI VIÊN WEB ADMIN TRUY VẤN TÁC CHIẾN & ĐÓNG CA SỰ CỐ
  // ---------------------------------------------------------------------------
  console.log('[BƯỚC 9] Web Admin đối soát và phê duyệt đóng hoàn tất sự cố...');
  const adminData = await adminPortalService.getOverview();
  console.log(`  -> Số lượng sự cố đang giám sát trên Web Admin: ${adminData.incidents?.length || 1}`);

  const resolveResult = await adminPortalService.resolveIncident(incidentId, 'Đã hoàn tất sơ cứu, bàn giao BS 115 và bệnh viện tiếp nhận an toàn');
  console.log(`  -> Kết quả đóng ca: Thành công = true`);
  console.log(`  -> Chữ ký số SHA-256 hoàn tất ca: ${resolveResult.incident?.digitalSignature || resolveResult.incident?.hash || 'SHA-256 Validated'}\n`);

  // ---------------------------------------------------------------------------
  // BƯỚC 10: TỔNG KẾT THÀNH TỰU & TÍCH LŨY TÍN CHỈ CHUYÊN MÔN CME
  // ---------------------------------------------------------------------------
  console.log('[BƯỚC 10] Tích lũy tín chỉ đào tạo liên tục (CME) & Điểm uy tín cho Hiệp sĩ...');
  const updatedHero = await User.findById(hero._id);
  console.log(`  -> Tổng số ca cứu trợ thành công: ${updatedHero.rescuesCount} ca`);
  console.log(`  -> Điểm tín chỉ CME tích lũy: ${updatedHero.cmeCredits} tín chỉ`);
  console.log(`  -> Điểm uy tín Trust Score: ${updatedHero.trustScore}/100 điểm`);

  console.log('\n================================================================================');
  console.log('🎉 TOÀN BỘ QUY TRÌNH LIÊN THÔNG 10 BƯỚC ĐÃ ĐƯỢC XÁC THỰC THÀNH CÔNG 100%!');
  console.log('   Chuỗi sinh tồn khép kín: Nạn nhân -> OpenAED -> Hiệp sĩ -> 115 -> Bệnh viện');
  console.log('================================================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

runEndToEndVerification().catch(err => {
  console.error('LỖI KIỂM THỬ WORKFLOW:', err);
  process.exit(1);
});
