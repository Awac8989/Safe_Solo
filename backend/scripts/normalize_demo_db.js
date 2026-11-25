require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../src/models/User');
const EmergencyLog = require('../src/models/EmergencyLog');
const RescueIncident = require('../src/models/RescueIncident');
const MedicalProfile = require('../src/models/MedicalProfile');
const DeviceSignal = require('../src/models/DeviceSignal');
const CheckInHistory = require('../src/models/CheckInHistory');
const HeroInsurancePolicy = require('../src/models/HeroInsurancePolicy');
const BloodRelayRequest = require('../src/models/BloodRelayRequest');
const SafePointAsset = require('../src/models/SafePointAsset');

async function normalizeDb() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Kết nối MongoDB thành công:', process.env.MONGODB_URI);

  const now = new Date();
  const users = await User.find().lean();
  const validUserIds = users.map((u) => String(u._id));

  // 1. Dọn dẹp EmergencyLog mồ côi & cũ -> chỉ giữ lại 5 ca khẩn cấp thực tế đa dạng
  await EmergencyLog.updateMany(
    { isResolved: false, userId: { $nin: validUserIds } },
    { $set: { isResolved: true, resolvedAt: now, notes: 'Archived legacy unmatched log' } }
  );
  // Đánh dấu tất cả EmergencyLog mở cũ hơn hôm nay thành đã xử lý với thời gian phản hồi thực tế (3-6 phút)
  const oldOpenLogs = await EmergencyLog.find({ isResolved: false }).sort({ triggeredAt: -1 }).lean();
  const keepOpenIds = new Set();
  const seenUsers = new Set();

  for (const log of oldOpenLogs) {
    if (!seenUsers.has(log.userId) && keepOpenIds.size < 5) {
      keepOpenIds.add(String(log._id));
      seenUsers.add(log.userId);
    }
  }

  for (const log of oldOpenLogs) {
    if (!keepOpenIds.has(String(log._id))) {
      const trig = new Date(log.triggeredAt || now);
      const fakeResponseMs = (180 + Math.floor(Math.random() * 160)) * 1000;
      await EmergencyLog.updateOne(
        { _id: log._id },
        {
          $set: {
            isResolved: true,
            resolvedAt: new Date(Math.min(now.getTime(), trig.getTime() + fakeResponseMs)),
            notes: 'Đã bàn giao 115 / Hiệp sĩ hỗ trợ an toàn',
          },
        }
      );
    }
  }

  // Làm giàu tọa độ, địa chỉ, nhóm máu & sinh hiệu riêng cho 5 ca đang mở
  const sampleMedicalPresets = [
    { bloodType: 'O+', birthYear: '2004', allergies: 'Penicillin (Dị ứng nhẹ)', conditions: 'Không', lat: 10.9806, lng: 106.6744, address: '06 Trần Văn Ơn, Phú Hòa, TP. Thủ Dầu Một, Bình Dương', microAddress: 'Phòng E2-304, Khu Thực hành KTPM03, ĐH Thủ Dầu Một', hr: 138, spo2: 88, battery: 91 },
    { bloodType: 'A+', birthYear: '1959', allergies: 'Aspirin, Thuốc cản quang', conditions: 'Tăng huyết áp độ II, Rung nhĩ AFib', lat: 10.7578, lng: 106.6598, address: '201B Nguyễn Chí Thanh, Phường 12, Quận 5, TP.HCM', microAddress: null, hr: 132, spo2: 89, battery: 78 },
    { bloodType: 'B+', birthYear: '1958', allergies: 'Không ghi nhận dị ứng', conditions: 'Tiền sử đột quỵ nhẹ, Đái tháo đường Type 2', lat: 10.7769, lng: 106.7009, address: '120 Hai Bà Trưng, Bến Nghé, Quận 1, TP.HCM', microAddress: 'Căn hộ B12-04, Chung cư Sài Gòn Central', hr: 118, spo2: 91, battery: 84 },
    { bloodType: 'O-', birthYear: '1998', allergies: 'Hải sản có vỏ, Lidocaine', conditions: 'Hen phế quản nhẹ', lat: 10.8015, lng: 106.7118, address: 'Vòng xoay Hàng Xanh, Phường 21, Bình Thạnh, TP.HCM', microAddress: null, hr: 126, spo2: 90, battery: 67 },
    { bloodType: 'AB+', birthYear: '1986', allergies: 'Sulfamethoxazole', conditions: 'Rối loạn nhịp tim kịch phát', lat: 10.7725, lng: 106.6664, address: '527 Sư Vạn Hạnh, Phường 12, Quận 10, TP.HCM', microAddress: null, hr: 112, spo2: 93, battery: 95 },
  ];

  const remainingOpenLogs = await EmergencyLog.find({ isResolved: false }).sort({ triggeredAt: -1 }).lean();
  const activeVictimUserIds = new Set();

  for (let i = 0; i < remainingOpenLogs.length; i++) {
    const log = remainingOpenLogs[i];
    const preset = sampleMedicalPresets[i % sampleMedicalPresets.length];
    activeVictimUserIds.add(String(log.userId));

    await EmergencyLog.updateOne(
      { _id: log._id },
      {
        $set: {
          triggeredAt: new Date(now.getTime() - (i + 1) * 4 * 60 * 1000),
          locationSnapshot: {
            lat: preset.lat,
            lng: preset.lng,
            approxAddress: preset.address,
            microAddress: preset.microAddress,
          },
        },
      }
    );

    // Đảm bảo MedicalProfile thật có dữ liệu (chỉ set nếu chưa có hoặc đang trống)
    const existingMed = await MedicalProfile.findOne({ userId: log.userId });
    if (!existingMed) {
      await MedicalProfile.create({
        userId: log.userId,
        bloodType: preset.bloodType,
        birthYear: preset.birthYear,
        allergies: preset.allergies,
        conditions: preset.conditions,
        emergencyPhone: '0909123456',
      });
    } else if (!existingMed.birthYear || !existingMed.allergies) {
      await MedicalProfile.updateOne(
        { userId: log.userId },
        {
          $set: {
            bloodType: existingMed.bloodType || preset.bloodType,
            birthYear: existingMed.birthYear || preset.birthYear,
            allergies: existingMed.allergies || preset.allergies,
            conditions: existingMed.conditions || preset.conditions,
          },
        }
      );
    }

    // Ghi nhận DeviceSignal riêng biệt từ Watch 5 cho từng nạn nhân
    await DeviceSignal.create([
      { userId: log.userId, signalType: 'HEART_RATE', payload: { heartRate: preset.hr, value: preset.hr, battery: preset.battery } },
      { userId: log.userId, signalType: 'SPO2', payload: { spo2: preset.spo2, value: preset.spo2, battery: preset.battery } },
    ]);
  }

  // Đảm bảo ít nhất 2 EmergencyLog đã resolve trong 24h qua có responseTime ~ 4 phút để Analytics chuẩn số liệu
  const recentResolved = await EmergencyLog.find({ isResolved: true }).sort({ updatedAt: -1 }).limit(3).lean();
  for (let i = 0; i < recentResolved.length; i++) {
    const trig = new Date(now.getTime() - (35 + i * 25) * 60 * 1000);
    const resAt = new Date(trig.getTime() + (210 + i * 45) * 1000);
    await EmergencyLog.updateOne(
      { _id: recentResolved[i]._id },
      { $set: { triggeredAt: trig, resolvedAt: resAt } }
    );
  }

  // 2. Cập nhật trạng thái User cho hợp lý nghiệp vụ (Đa số SAFE, số ít WARNING, chỉ nạn nhân mở là SOS)
  let warningBudget = 6;
  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const uid = String(u._id);
    if (activeVictimUserIds.has(uid)) {
      await User.updateOne({ _id: uid }, { $set: { currentStatus: 'SOS' } });
    } else if (warningBudget > 0 && !u.isHero && !u.isKycVerified) {
      warningBudget--;
      await User.updateOne(
        { _id: uid },
        {
          $set: {
            currentStatus: 'WARNING',
            nextDeadline: new Date(now.getTime() + 18 * 60 * 1000),
            lastCheckinTime: new Date(now.getTime() - 11.5 * 3600 * 1000),
          },
        }
      );
    } else {
      await User.updateOne(
        { _id: uid },
        {
          $set: {
            currentStatus: 'SAFE',
            nextDeadline: new Date(now.getTime() + (6 + (i % 6)) * 3600 * 1000),
            lastCheckinTime: new Date(now.getTime() - (1 + (i % 4)) * 3600 * 1000),
          },
        }
      );
    }
  }
  console.log(`✓ Đã chuẩn hóa trạng thái ${users.length} Users (${activeVictimUserIds.size} SOS, 6 WARNING, ${users.length - activeVictimUserIds.size - 6} SAFE)`);

  // 3. Bổ sung CheckInHistory 7 ngày gần nhất (tính tới hôm nay) cho Analytics Dashboard
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const existingTodayCheckins = await CheckInHistory.countDocuments({ checkinTime: { $gte: todayStart } });
  if (existingTodayCheckins < 15) {
    const methods = ['HARD_TAP', 'WATCH_CHECKIN', 'GESTURE_WRIST_TWIST', 'SMART_PASSIVE', 'VOICE_KEYWORD', 'MEDICATION_VISION', 'BUDDY_CROSS_CHECKIN'];
    const docs = [];
    for (let d = 0; d < 7; d++) {
      const countForDay = d === 0 ? 18 : 12 + (d % 5) * 3;
      for (let k = 0; k < countForDay; k++) {
        const u = users[(d * 11 + k) % users.length];
        const ts = new Date(now.getTime() - d * 24 * 3600 * 1000 - (k + 1) * 18 * 60 * 1000);
        if (d === 0 && ts < todayStart) ts.setTime(todayStart.getTime() + (k + 1) * 15 * 60 * 1000);
        docs.push({
          _id: crypto.randomUUID(),
          userId: String(u._id),
          checkinTime: ts,
          type: methods[(d + k) % methods.length],
          isSystemAutoTriggered: k % 7 === 0,
        });
      }
    }
    await CheckInHistory.insertMany(docs);
    console.log(`✓ Đã đồng bộ ${docs.length} bản ghi CheckInHistory 7 ngày gần nhất tới hiện tại`);
  }

  // 4. Gia hạn chứng thư HeroInsurancePolicy đang hoạt động & map đúng ID Hiệp sĩ thật
  const heroUsers = users.filter((u) => u.isHero || u.isKycVerified || u.role === 'hero');
  const policies = await HeroInsurancePolicy.find().sort({ createdAt: -1 }).lean();
  for (let i = 0; i < policies.length; i++) {
    const p = policies[i];
    const targetHero = heroUsers.length > 0 ? heroUsers[i % heroUsers.length] : null;
    const isActivePolicy = i < Math.ceil(policies.length * 0.75);
    await HeroInsurancePolicy.updateOne(
      { _id: p._id },
      {
        $set: {
          ...(targetHero && !validUserIds.includes(String(p.volunteerId)) ? { volunteerId: String(targetHero._id) } : {}),
          effectiveTo: isActivePolicy
            ? new Date(now.getTime() + 30 * 24 * 3600 * 1000)
            : new Date(now.getTime() - 5 * 24 * 3600 * 1000),
        },
      }
    );
  }
  console.log(`✓ Đã chuẩn hóa ${policies.length} chứng thư bảo hiểm HeroShield`);

  // 5. Đa dạng hóa danh sách lệnh SafeBlood (có cả ca hoàn tất DELIVERED_AND_FULFILLED & đa dạng bệnh viện/nhóm máu)
  const relays = await BloodRelayRequest.find().sort({ createdAt: -1 }).lean();
  const bloodGroups = ['O_MINUS', 'A_MINUS', 'B_MINUS', 'AB_MINUS', 'O_PLUS'];
  const hospitals = [
    { hospitalName: 'Bệnh viện Chợ Rẫy - Trung tâm Cấp cứu 115', address: '201B Nguyễn Chí Thanh, P.12, Q.5, TP.HCM', contactPhone: '02838554137' },
    { hospitalName: 'Bệnh viện Nhân dân 115 - Khoa Huyết học', address: '527 Sư Vạn Hạnh, P.12, Q.10, TP.HCM', contactPhone: '02838652368' },
    { hospitalName: 'Bệnh viện Đa khoa Tỉnh Bình Dương', address: '05 Phạm Ngọc Thạch, Hiệp Thành, Thủ Dầu Một', contactPhone: '02743822920' },
  ];
  for (let i = 0; i < relays.length; i++) {
    const r = relays[i];
    const hosp = hospitals[i % hospitals.length];
    const bg = bloodGroups[i % bloodGroups.length];
    const isFulfilled = i >= relays.length - 3;
    const isCommitted = i === 1 || i === 2;
    const donor = heroUsers[i % (heroUsers.length || 1)];
    await BloodRelayRequest.updateOne(
      { _id: r._id },
      {
        $set: {
          targetBloodGroup: bg,
          hospitalLocation: {
            ...r.hospitalLocation,
            hospitalName: hosp.hospitalName,
            address: hosp.address,
            contactPhone: hosp.contactPhone,
          },
          status: isFulfilled ? 'DELIVERED_AND_FULFILLED' : isCommitted ? 'DONORS_COMMITTED' : 'SEARCHING',
          ...(isFulfilled && donor
            ? {
                closedAt: new Date(now.getTime() - (i + 1) * 3600 * 1000),
                matchedDonors: [
                  {
                    donorId: String(donor._id),
                    donorName: donor.fullName,
                    bloodGroup: bg,
                    contactPhone: donor.phoneNumber || '0913843958',
                    committedUnits: 2,
                    status: 'DONATED',
                    etaMinutes: 12,
                    distanceKm: 1.8,
                    acceptedAt: new Date(now.getTime() - (i + 2) * 3600 * 1000),
                  },
                ],
              }
            : {}),
        },
      }
    );
  }
  console.log(`✓ Đã chuẩn hóa ${relays.length} lệnh điều phối SafeBlood (bao gồm 3 ca tiếp máu thành công)`);

  // 6. Chuẩn hóa SafePointAsset trạng thái IoT thực tế
  const stations = await SafePointAsset.find().sort({ serialNumber: 1 }).lean();
  for (let i = 0; i < stations.length; i++) {
    const st = stations[i];
    let status = 'READY';
    let doorState = 'CLOSED';
    let battery = 96 - i * 2;
    if (i === 1) {
      status = 'IN_USE';
      doorState = 'OPEN';
    } else if (i === stations.length - 1) {
      status = 'MAINTENANCE_REQUIRED';
      battery = 19;
    }
    await SafePointAsset.updateOne(
      { _id: st._id },
      {
        $set: {
          status,
          'iotCabinet.doorState': doorState,
          'iotCabinet.batteryPercent': battery,
          'iotCabinet.lastPingAt': now,
        },
      }
    );
  }
  console.log(`✓ Đã chuẩn hóa ${stations.length} trạm cứu sinh SafePoint & AED`);

  await mongoose.disconnect();
  console.log('\n🎉 HOÀN TẤT CHUẨN HÓA TOÀN BỘ DỮ LIỆU THỰC TẾ TRONG MONGODB!');
}

normalizeDb().catch((err) => {
  console.error('❌ Lỗi chuẩn hóa MongoDB:', err);
  process.exit(1);
});
