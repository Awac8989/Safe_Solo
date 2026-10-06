require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const database = require('../src/config/database');
const userController = require('../src/controllers/userController');
const adminPortalController = require('../src/controllers/adminPortalController');
const analyticsService = require('../src/services/analyticsService');
const { createAlertEvent, listAlertEvents } = require('../src/services/alertEventService');
const User = require('../src/models/User');
const AlertEvent = require('../src/models/AlertEvent');
const CheckInHistory = require('../src/models/CheckInHistory');
const DeviceSignal = require('../src/models/DeviceSignal');
const RescueIncident = require('../src/models/RescueIncident');

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

async function runE2ETests() {
  console.log('╔═════════════════════════════════════════════════════════════════════════╗');
  console.log('║       SAFESOLO v3.5.0 — E2E END-TO-END SYSTEM INTEGRATION TEST          ║');
  console.log('╚═════════════════════════════════════════════════════════════════════════╝\n');

  await database.$connect();

  const testUserId = 'test_e2e_solo_user';
  const testPhone = '0988776655';
  const testEmail = 'e2e_victim@safesolo.vn';
  // Cleanup test user
  await User.deleteMany({ $or: [{ _id: testUserId }, { phoneNumber: testPhone }, { email: testEmail }] });
  await AlertEvent.deleteMany({ userId: testUserId });
  await CheckInHistory.deleteMany({ userId: testUserId });
  await DeviceSignal.deleteMany({ userId: testUserId });
  await RescueIncident.deleteMany({ userId: testUserId });

  console.log('--- GIAI ĐOẠN 1: KHỞI TẠO NGƯỜI DÙNG & HỒ SƠ AN TOÀN ---');
  const user = await User.create({
    _id: testUserId,
    email: testEmail,
    phoneNumber: testPhone,
    fullName: 'Trần Minh Tâm',
    name: 'Trần Minh Tâm',
    timerIntervalMinutes: 60,
    currentStatus: 'SAFE',
    nextDeadline: new Date(Date.now() + 60 * 60 * 1000),
    emergencyContacts: [
      { name: 'Nguyễn Văn Bảo (Anh ruột)', phone: '0911223344', relation: 'Người thân' },
    ],
  });
  console.log(`✓ Đã tạo người dùng thử nghiệm: ${user.fullName} (${user._id})`);

  console.log('\n--- GIAI ĐOẠN 2: THIẾT BỊ GALAXY WATCH ĐỒNG BỘ TELEMETRY & NHỊP TIM ---');
  {
    const req = {
      params: { id: testUserId },
      body: {
        signalType: 'WEAR_OS_TELEMETRY',
        batteryLevel: 82,
        heartRate: 76,
        spo2: 98,
        skinTemperature: 36.6,
        isCharging: false,
        source: 'SAMSUNG_GALAXY_WATCH_5',
        metadata: { bleConnected: true, steps: 4210 },
      },
    };
    const res = mockRes();
    await userController.createDeviceSignal(req, res);
    if (res.statusCode !== 201 && res.statusCode !== 200) {
      throw new Error(`Device signal failed: ${JSON.stringify(res.body)}`);
    }
    console.log(`✓ Tín hiệu Galaxy Watch 5 đồng bộ thành công (Pin: 82%, Nhịp tim: 76 bpm)`);
  }

  console.log('\n--- GIAI ĐOẠN 3: ĐIỂM DANH THÔNG MINH (ACTIVE & PASSIVE CHECK-IN) ---');
  {
    const req = {
      params: { id: testUserId },
      body: {
        type: 'HARD_TAP',
        routineType: 'MORNING_GREETING',
        metadata: { battery: 85, mood: 'PEACEFUL' },
      },
    };
    const res = mockRes();
    await userController.checkin(req, res);
    if (res.statusCode !== 200) {
      throw new Error(`Checkin failed: ${JSON.stringify(res.body)}`);
    }
    console.log(`✓ Điểm danh thủ công buổi sáng thành công. Deadline mới: ${res.body.user?.nextDeadline}`);
  }

  console.log('\n--- GIAI ĐOẠN 4: KÍCH HOẠT BÁO ĐỘNG KHẨN CẤP (FALL DETECTION & DEAD-MAN) ---');
  {
    // Báo động phát hiện ngã
    const event = await createAlertEvent({
      userId: testUserId,
      level: 'SOS',
      status: 'FALL_DETECTED',
      source: 'GALAXY_WATCH_ACCELEROMETER',
      title: 'Phát hiện ngã mạnh bất tỉnh',
      message: 'Người dùng bất động hơn 60 giây sau cú va chạm mạnh.',
      metadata: { impactG: 3.8, motionlessDurationSec: 65, location: { lat: 10.762622, lng: 106.660172 } },
    });
    console.log(`✓ Cảnh báo SOS tạo thành công: ID = ${event.id}, Level = ${event.level}`);

    // Incident được mở trên Web Admin
    const incident = await RescueIncident.create({
      victimId: testUserId,
      status: 'ACTIVE',
      incidentType: 'FALL_DETECTED',
      severity: 4,
      source: 'GALAXY_WATCH_ACCELEROMETER',
      exactLat: 10.762622,
      exactLng: 106.660172,
      fuzzedLat: 10.7626,
      fuzzedLng: 106.6601,
      approxAddress: '227 Nguyễn Văn Cừ, P4, Q5, TP.HCM',
    });
    console.log(`✓ Sự cố cứu hộ được điều phối: Incident ID = ${incident._id}, Status = ${incident.status}`);
  }

  console.log('\n--- GIAI ĐOẠN 5: XÁC THỰC NOTIFICATION CENTER API CHO MOBILE APP ---');
  {
    const req = {
      params: { id: testUserId },
      query: { page: 1, limit: 10 },
    };
    const res = mockRes();
    await userController.listUserNotifications(req, res);
    if (res.statusCode !== 200 || !res.body.items || res.body.items.length === 0) {
      throw new Error(`Notification center API failed: ${JSON.stringify(res.body)}`);
    }
    console.log(`✓ Mobile Notification API trả về ${res.body.items.length} thông báo.`);
    console.log(`  - Tiêu đề: "${res.body.items[0].title}"`);
    console.log(`  - Cấp độ: ${res.body.items[0].level}, Nguồn: ${res.body.items[0].source}`);
  }

  console.log('\n--- GIAI ĐOẠN 6: XÁC THỰC WEB ADMIN ANALYTICS DASHBOARD API ---');
  {
    const req = { query: { days: 7 } };
    const res = mockRes();
    await adminPortalController.getAnalyticsDashboard(req, res);
    if (res.statusCode !== 200 || !res.body.data) {
      throw new Error(`Analytics API failed: ${JSON.stringify(res.body)}`);
    }
    const data = res.body.data;
    console.log(`✓ Analytics Dashboard API phản hồi thành công:`);
    console.log(`  - Tổng số người dùng: ${data.kpis?.totalUsers}`);
    console.log(`  - Người dùng đang giám sát: ${data.kpis?.monitoredUsers}`);
    console.log(`  - Người dùng hoạt động hôm nay: ${data.kpis?.activeUsersToday}`);
    console.log(`  - Sự cố cứu hộ đang mở: ${data.kpis?.activeIncidents}`);
    console.log(`  - Cảnh báo hôm nay: ${data.kpis?.alertsToday}`);
    console.log(`  - Phân bố phương thức check-in: ${JSON.stringify(data.checkinMethods)}`);
    console.log(`  - Xu hướng check-in: ${data.checkinTrend?.length} ngày dữ liệu`);
  }

  console.log('\n--- GIAI ĐOẠN 7: GIẢI QUYẾT SỰ CỐ VÀ KHÔI PHỤC TRẠNG THÁI AN TOÀN ---');
  {
    await User.updateOne({ _id: testUserId }, { currentStatus: 'SAFE' });
    const updatedUser = await User.findById(testUserId);
    console.log(`✓ Người dùng trở về trạng thái an toàn: ${updatedUser.currentStatus}`);

    // Dọn dẹp dữ liệu test
    await User.deleteOne({ _id: testUserId });
    await AlertEvent.deleteMany({ userId: testUserId });
    await CheckInHistory.deleteMany({ userId: testUserId });
    await DeviceSignal.deleteMany({ userId: testUserId });
    await RescueIncident.deleteMany({ userId: testUserId });
    console.log('✓ Dọn dẹp dữ liệu kiểm thử E2E hoàn tất.');
  }

  console.log('\n╔═════════════════════════════════════════════════════════════════════════╗');
  console.log('║       🎉 TẤT CẢ 7 BƯỚC E2E INTEGRATION ĐÃ THÀNH CÔNG RỰC RỠ!            ║');
  console.log('╚═════════════════════════════════════════════════════════════════════════╝\n');

  process.exit(0);
}

runE2ETests().catch((err) => {
  console.error('\n❌ E2E INTEGRATION TEST FAILED:', err);
  process.exit(1);
});
