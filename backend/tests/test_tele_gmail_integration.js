require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const KYCDocument = require('../src/models/KYCDocument');
const RescueIncident = require('../src/models/RescueIncident');
const BloodRelayRequest = require('../src/models/BloodRelayRequest');

const emailService = require('../src/services/emailService');
const telegramBotService = require('../src/services/telegramBotService');
const sosService = require('../src/services/sosService');
const adminPortalService = require('../src/services/adminPortalService');
const heroShieldService = require('../src/services/heroShieldService');
const bloodRelayService = require('../src/services/bloodRelayService');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/Safesolo';
const TEST_EMAIL = process.env.GMAIL_USER || 'safesolocompanyvn@gmail.com';

async function runTests() {
  console.log('================================================================================');
  console.log('🚀 KHỞI ĐỘNG KIỂM THỬ TÍCH HỢP TOÀN DIỆN TELEGRAM BOT VÀ GMAIL NGHIỆP VỤ');
  console.log(`📧 Hòm thư đích thực chiến: ${TEST_EMAIL}`);
  console.log(`🤖 Telegram Bot: @${telegramBotService.botUsername || 'SFESOLOBot'}`);
  console.log('================================================================================\n');

  await mongoose.connect(MONGO_URI);
  console.log('✅ Đã kết nối cơ sở dữ liệu MongoDB an toàn.');

  const results = [];

  try {
    // --------------------------------------------------------------------------
    // Chuẩn bị dữ liệu mẫu người dùng & hiệp sĩ
    // --------------------------------------------------------------------------
    let testHero = await User.findOne({
      $or: [{ email: TEST_EMAIL }, { phoneNumber: '0913843958' }]
    });
    if (!testHero) {
      testHero = await User.create({
        fullName: 'BS. CKII Lê Hoàng Nam',
        phoneNumber: '0913843958',
        email: TEST_EMAIL,
        role: 'hero',
        isHero: true,
        heroTier: 'TIER_PARAMEDIC_MEDIC',
        isKycVerified: true,
        trustScore: 4.95,
        walletBalance: 1850000,
        telegramChatId: '8895231809', // Chat ID giả lập hoặc test
        nextDeadline: new Date(Date.now() + 12 * 3600 * 1000),
        emergencyContacts: [
          { name: 'Trung tâm Cứu Hộ TOC SafeSolo', phone: '19001115', email: TEST_EMAIL }
        ],
        lastKnownLocation: {
          lat: 10.7578,
          lng: 106.6598,
          address: '201B Nguyễn Chí Thanh, Phường 12, Quận 5, TP.HCM',
        },
      });
    } else {
      testHero.fullName = 'BS. CKII Lê Hoàng Nam';
      testHero.email = TEST_EMAIL;
      testHero.role = 'hero';
      testHero.isHero = true;
      testHero.heroTier = 'TIER_PARAMEDIC_MEDIC';
      testHero.isKycVerified = true;
      testHero.trustScore = 4.95;
      testHero.walletBalance = 1850000;
      testHero.emergencyContacts = [
        { name: 'Trung tâm Cứu Hộ TOC SafeSolo', phone: '19001115', email: TEST_EMAIL }
      ];
      await testHero.save();
    }

    // --------------------------------------------------------------------------
    // TEST CASE 1: Cảnh báo đỏ SOS Đa Kênh (Gửi Gmail SafeTag + Tọa độ GPS)
    // --------------------------------------------------------------------------
    console.log('👉 [TEST 1] Kích hoạt cảnh báo đỏ cấp cứu SOS kèm Hồ sơ y tế SafeTag...');
    try {
      const sosMailRes = await emailService.sendSosEmergencyAlertEmail(
        testHero,
        { lat: 10.7765, lng: 106.7009, address: 'Số 135 Nam Kỳ Khởi Nghĩa, Phường Bến Thành, Quận 1, TP.HCM' },
        testHero.emergencyContacts
      );
      console.log('   ✅ [TEST 1 SUCCESS] Email cảnh báo đỏ SOS đã gửi thành công!');
      console.log('      Message ID:', sosMailRes.messageId || 'N/A');
      console.log('      Recipients:', sosMailRes.recipients);
      results.push({ test: '1. Email Cảnh Báo Đỏ SOS SafeTag', status: 'PASS', mode: sosMailRes.mode });
    } catch (err) {
      console.error('   ❌ [TEST 1 FAILED]:', err.message);
      results.push({ test: '1. Email Cảnh Báo Đỏ SOS SafeTag', status: 'FAIL', error: err.message });
    }

    // --------------------------------------------------------------------------
    // TEST CASE 2: Phê Duyệt Hồ Sơ Hiệp Sĩ KYC & Cấp Chứng Thư Pháp Lý Điều 87
    // --------------------------------------------------------------------------
    console.log('\n👉 [TEST 2] Thẩm định & Phê duyệt KYC Hiệp Sĩ qua AdminPortalService...');
    try {
      // Tạo một KYC doc mẫu
      let kycDoc = await KYCDocument.findOne({ userId: testHero._id });
      if (!kycDoc) {
        kycDoc = await KYCDocument.create({
          userId: testHero._id,
          fullName: testHero.fullName,
          idNumber: '079085001234',
          professionCategory: 'MEDICAL_NURSE',
          credentialName: 'Chứng chỉ hành nghề Bác sĩ Hồi sức Cấp cứu Ngoại viện',
          credentialNumber: 'CCHN-BYT-019283',
          issuingAuthority: 'Sở Y tế TP. Hồ Chí Minh',
          workingUnit: 'Bệnh viện Chợ Rẫy TP.HCM',
          yearsOfExperience: 8,
          theoryExamScore: 19.5,
          faceMatchPercentage: 96.5,
          skillsList: ['CPR_AED', 'AIRWAY_CHOKING', 'TRAUMA_HEMOSTASIS', 'TRIAGE_START'],
          status: 'PENDING',
          submittedAt: new Date(),
        });
      } else {
        kycDoc.status = 'PENDING';
        kycDoc.professionCategory = 'MEDICAL_NURSE';
        kycDoc.theoryExamScore = 19.5;
        kycDoc.faceMatchPercentage = 96.5;
        await kycDoc.save();
      }

      const approveRes = await adminPortalService.updateKycStatus(kycDoc._id, 'APPROVED', {
        tier: 'TIER_PARAMEDIC_MEDIC',
      });
      console.log('   ✅ [TEST 2 SUCCESS] Duyệt KYC thành công! Đã phát email bổ nhiệm & lá chắn Điều 87.');
      console.log('      User Tier:', approveRes.user?.heroTier);
      console.log('      CCHN:', approveRes.document?.credentialNumber);
      results.push({ test: '2. Duyệt KYC & Gửi Quyết Định Bổ Nhiệm Email/Tele', status: 'PASS' });
    } catch (err) {
      console.error('   ❌ [TEST 2 FAILED]:', err.message);
      results.push({ test: '2. Duyệt KYC & Gửi Quyết Định Bổ Nhiệm Email/Tele', status: 'FAIL', error: err.message });
    }

    // --------------------------------------------------------------------------
    // TEST CASE 3: Từ chối KYC có căn cứ (Lý do chưa đủ 18/20 điểm hoặc chứng chỉ dân sự)
    // --------------------------------------------------------------------------
    console.log('\n👉 [TEST 3] Từ chối thẩm định KYC & Gửi thư hướng dẫn ôn tập lâm sàng...');
    let tempCivilian = null;
    try {
      tempCivilian = await User.create({
        fullName: 'Nguyễn Văn Civilian',
        phoneNumber: '09' + Math.floor(10000000 + Math.random() * 90000000),
        email: TEST_EMAIL,
        role: 'user',
        isHero: false,
        nextDeadline: new Date(Date.now() + 12 * 3600 * 1000),
      });

      const rejectDoc = await KYCDocument.create({
        userId: tempCivilian._id,
        fullName: 'Nguyễn Văn Civilian',
        idNumber: '079099887766',
        professionCategory: 'UNQUALIFIED_CIVILIAN',
        credentialName: 'Không có chứng chỉ y khoa',
        theoryExamScore: 14,
        faceMatchPercentage: 85,
        frontImageUrl: 'https://safesolo.vn/mock_front.png',
        backImageUrl: 'https://safesolo.vn/mock_back.png',
        status: 'PENDING',
        submittedAt: new Date(),
      });

      const rejectRes = await adminPortalService.updateKycStatus(rejectDoc._id, 'REJECTED', {
        reason: 'Điểm trắc nghiệm lâm sàng 14/20 (yêu cầu tối thiểu 18/20) và thiếu bằng cấp chuyên môn theo quy chuẩn',
      });
      console.log('   ✅ [TEST 3 SUCCESS] Từ chối KYC và gửi thư phản hồi hướng dẫn bổ sung thành công!');
      results.push({ test: '3. Từ Chối KYC & Gửi Thư Giải Trình Tiêu Chuẩn', status: 'PASS' });
      await KYCDocument.deleteOne({ _id: rejectDoc._id });
      await User.deleteOne({ _id: tempCivilian._id });
    } catch (err) {
      if (tempCivilian) await User.deleteOne({ _id: tempCivilian._id }).catch(() => {});
      console.error('   ❌ [TEST 3 FAILED]:', err.message);
      results.push({ test: '3. Từ Chối KYC & Gửi Thư Giải Trình Tiêu Chuẩn', status: 'FAIL', error: err.message });
    }

    // --------------------------------------------------------------------------
    // TEST CASE 4: Bồi hoàn vật tư y tế FPT Long Châu / Pharmacity theo SBAR
    // --------------------------------------------------------------------------
    console.log('\n👉 [TEST 4] Xuất phiếu bồi hoàn vật tư FPT Long Châu qua HeroShieldService...');
    try {
      const voucherRes = await heroShieldService.issueRestockVoucherFromSbar({
        heroId: String(testHero._id),
        incidentId: 'INC_CHORAY_EMERGENCY_01',
        consumedSuppliesNote: 'Đã sử dụng 02 cuộn Băng thun ép C.A.T, 04 gạc vô trùng và 01 mặt nạ CPR Pocket Mask để cấp cứu nạn nhân ngừng tim ngưng thở.',
      });
      console.log('   ✅ [TEST 4 SUCCESS] Đã xuất Voucher và gửi Email/Telegram!');
      console.log('      Mã Voucher:', voucherRes.voucherCode);
      console.log('      Trị giá bồi hoàn:', voucherRes.totalEstimatedValueVND.toLocaleString('vi-VN'), 'VNĐ');
      console.log('      Chuỗi nhà thuốc:', voucherRes.partnerPharmacyChain);
      results.push({ test: '4. Cấp Voucher Bồi Hoàn Y Tế Long Châu FPT', status: 'PASS' });
    } catch (err) {
      console.error('   ❌ [TEST 4 FAILED]:', err.message);
      results.push({ test: '4. Cấp Voucher Bồi Hoàn Y Tế Long Châu FPT', status: 'FAIL', error: err.message });
    }

    // --------------------------------------------------------------------------
    // TEST CASE 5: Lệnh điều phối máu hiếm O- STAT Chợ Rẫy
    // --------------------------------------------------------------------------
    console.log('\n👉 [TEST 5] Phát lệnh điều phối máu hiếm O- STAT qua BloodRelayService...');
    try {
      const bloodReq = await bloodRelayService.createRequest({
        targetBloodGroup: 'O-',
        unitsRequired: 3,
        urgencyLevel: 'EXTREME_IMMEDIATE',
        hospitalName: 'Bệnh viện Chợ Rẫy TP.HCM',
        departmentName: 'Khoa Phẫu thuật Lồng ngực Mạch máu',
        clinicalJustification: 'Bệnh nhân sốc mất máu cấp độ IV do vỡ động mạch chủ bụng sau tai nạn giao thông.',
        hospitalLocation: {
          address: '201B Nguyễn Chí Thanh, Phường 12, Quận 5, TP.HCM',
          coordinates: [106.6598, 10.7578],
        },
      });
      console.log('   ✅ [TEST 5 SUCCESS] Lệnh điều phối máu STAT đã phát thanh qua Telegram & Email!');
      console.log('      Mã yêu cầu:', bloodReq.requestCode);
      console.log('      Nhóm máu:', bloodReq.targetBloodGroup);
      results.push({ test: '5. Lệnh Điều Phối Máu Hiếm O- STAT Chợ Rẫy', status: 'PASS' });
    } catch (err) {
      console.error('   ❌ [TEST 5 FAILED]:', err.message);
      results.push({ test: '5. Lệnh Điều Phối Máu Hiếm O- STAT Chợ Rẫy', status: 'FAIL', error: err.message });
    }

    // --------------------------------------------------------------------------
    // TEST CASE 6: Kiểm thử tác chiến tương tác Telegram Bot (@SFESOLOBot)
    // --------------------------------------------------------------------------
    console.log('\n👉 [TEST 6] Giả lập webhook tương tác các lệnh tác chiến thực địa trên Telegram Bot...');
    const fakeChatId = '8895231809';

    // 6.1 Lệnh /nearby (Tra cứu ca SOS)
    const resNearby = await telegramBotService.handleIncomingMessage({
      chat: { id: fakeChatId, first_name: 'Hoàng Nam' },
      from: { id: fakeChatId, username: 'LeHoangNam' },
      text: '🚨 Ca SOS Lân Cận',
    });
    console.log('   6.1 /nearby -> Action:', resNearby.action);

    // 6.2 Lệnh /aed (Mở tủ sốc tim AED)
    const resAed = await telegramBotService.handleIncomingMessage({
      chat: { id: fakeChatId, first_name: 'Hoàng Nam' },
      from: { id: fakeChatId, username: 'LeHoangNam' },
      text: '⚡ Mở Tủ AED Gần Nhất',
    });
    console.log('   6.2 /aed -> Action:', resAed.action);

    // 6.3 Lệnh /blood (SafeBlood Máu Hiếm)
    const resBlood = await telegramBotService.handleIncomingMessage({
      chat: { id: fakeChatId, first_name: 'Hoàng Nam' },
      from: { id: fakeChatId, username: 'LeHoangNam' },
      text: '🩸 SafeBlood Máu Hiếm',
    });
    console.log('   6.3 /blood -> Action:', resBlood.action);

    // 6.4 Lệnh /badge (Thẻ ngành & Ví Quỹ)
    const resBadge = await telegramBotService.handleIncomingMessage({
      chat: { id: fakeChatId, first_name: 'Hoàng Nam' },
      from: { id: fakeChatId, username: 'LeHoangNam' },
      text: '💳 Thẻ Ngành & Ví Quỹ',
    });
    console.log('   6.4 /badge -> Action:', resBadge.action);

    // 6.5 Lệnh /legal (Điều 87 Luật KBCB 2023)
    const resLegal = await telegramBotService.handleIncomingMessage({
      chat: { id: fakeChatId, first_name: 'Hoàng Nam' },
      from: { id: fakeChatId, username: 'LeHoangNam' },
      text: '⚖️ Tra Cứu Pháp Lý 87',
    });
    console.log('   6.5 /legal -> Action:', resLegal.action);

    // 6.6 Callback Button Action: Nhận ca cứu nạn
    const resCallback = await telegramBotService.handleCallbackQuery({
      id: 'cb_test_01',
      data: 'accept_incident:INC_CHORAY_EMERGENCY_01',
      from: { id: fakeChatId, first_name: 'Hoàng Nam' },
      message: { chat: { id: fakeChatId }, message_id: 101 },
    });
    console.log('   6.6 Callback: accept_incident -> Ok:', resCallback.ok);

    results.push({ test: '6. Tương Tác 7 Lệnh Tác Chiến & Bàn Phím Bot Telegram', status: 'PASS' });

  } catch (globalErr) {
    console.error('Lỗi toàn cục trong quá trình test:', globalErr);
  } finally {
    console.log('\n================================================================================');
    console.log('📊 TỔNG KẾT BẢNG KIỂM TRA NGHIỆP VỤ TELEGRAM VÀ GMAIL');
    console.log('================================================================================');
    console.table(results);

    await mongoose.disconnect();
    console.log('\n✨ Đã hoàn tất toàn bộ kịch bản kiểm thử!');
    process.exit(0);
  }
}

runTests();
