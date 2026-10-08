const mongoose = require('mongoose');

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/Safesolo');
  const EmergencyLog = require('../src/models/EmergencyLog');
  const RescueIncident = require('../src/models/RescueIncident');
  const User = require('../src/models/User');

  // 1. Resolve all old test logs so they don't clutter the tactical dashboard
  const updatedEmergencies = await EmergencyLog.updateMany(
    { isResolved: false },
    { $set: { isResolved: true, resolvedAt: new Date(), notes: 'Dọn dẹp ca test cũ' } }
  );
  console.log('Resolved old test logs count:', updatedEmergencies.modifiedCount);

  await RescueIncident.updateMany(
    { status: 'ACTIVE' },
    { $set: { status: 'RESOLVED', resolvedAt: new Date() } }
  );

  // 2. Tìm hoặc tạo nạn nhân chuẩn ngay tại Quận 5, TP.HCM
  let victim1 = await User.findOne({ phoneNumber: '0909001001' });
  if (!victim1) {
    victim1 = await User.create({
      fullName: 'Nguyễn Văn An (67 tuổi)',
      phoneNumber: '0909001001',
      role: 'user',
      currentStatus: 'SOS',
      medicalNotes: 'Tiền sử rung nhĩ kịch phát AFib, huyết áp dao động',
      emergencyContacts: [{ name: 'Nguyễn Thị Mai (Con gái)', phone: '0909001007', relation: 'Con gái' }],
      lastKnownLocation: { lat: 10.762622, lng: 106.682276, updatedAt: new Date() },
    });
  } else {
    victim1.fullName = 'Nguyễn Văn An (67 tuổi)';
    victim1.currentStatus = 'SOS';
    victim1.lastKnownLocation = { lat: 10.762622, lng: 106.682276, updatedAt: new Date() };
    await victim1.save();
  }

  // 3. Tạo ca cấp cứu P1 Nguy kịch tại Quận 5 (nằm ngay trung tâm giữa các Hiệp sĩ)
  const activeLog1 = await EmergencyLog.create({
    userId: victim1._id,
    triggeredAt: new Date(Date.now() - 45000),
    isResolved: false,
    smsSentStatus: true,
    locationSnapshot: {
      lat: 10.762622,
      lng: 106.682276,
      approxAddress: '227 Nguyễn Văn Cừ, Phường 4, Quận 5, TP.HCM',
    },
    notes: 'Ngã bất tỉnh, nhịp tim 124 BPM, SpO2 91% (Cảnh báo WearOS PPG Alert)',
  });
  console.log('Created active medical emergency log 1:', activeLog1._id);

  // 4. Tạo ca cấp cứu P2 tại Quận 1
  let victim2 = await User.findOne({ phoneNumber: '0909001017' });
  if (!victim2) {
    victim2 = await User.create({
      fullName: 'Lê Hoàng Yến (24 tuổi)',
      phoneNumber: '0909001017',
      role: 'user',
      currentStatus: 'SOS',
      medicalNotes: 'Không có tiền sử bệnh nền',
      emergencyContacts: [{ name: 'Lê Văn Tuấn (Bố)', phone: '0909001018', relation: 'Bố' }],
      lastKnownLocation: { lat: 10.7788, lng: 106.6998, updatedAt: new Date() },
    });
  } else {
    victim2.fullName = 'Lê Hoàng Yến (24 tuổi)';
    victim2.currentStatus = 'SOS';
    victim2.lastKnownLocation = { lat: 10.7788, lng: 106.6998, updatedAt: new Date() };
    await victim2.save();
  }

  const activeLog2 = await EmergencyLog.create({
    userId: victim2._id,
    triggeredAt: new Date(Date.now() - 110000),
    isResolved: false,
    smsSentStatus: true,
    locationSnapshot: {
      lat: 10.7788,
      lng: 106.6998,
      approxAddress: '135 Hai Bà Trưng, Bến Nghé, Quận 1, TP.HCM',
    },
    notes: 'Kích hoạt Mã nguy hiểm im lặng (Duress Pin)',
  });
  console.log('Created active emergency log 2:', activeLog2._id);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
