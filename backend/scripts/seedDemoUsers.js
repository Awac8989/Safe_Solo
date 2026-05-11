const { connectDatabase, $disconnect } = require('../src/config/db');
const User = require('../src/models/User');
const CheckInHistory = require('../src/models/CheckInHistory');
const AlertPolicy = require('../src/models/AlertPolicy');
const MedicalProfile = require('../src/models/MedicalProfile');
const AutomationSetting = require('../src/models/AutomationSetting');
const SecuritySetting = require('../src/models/SecuritySetting');
const DailyStatus = require('../src/models/DailyStatus');

const demoUsers = [
  ['Nguyen Minh Anh', '0909001001'],
  ['Tran Quoc Bao', '0909001002'],
  ['Le Thanh Dat', '0909001003'],
  ['Pham Gia Han', '0909001004'],
  ['Vo Nhat Huy', '0909001005'],
  ['Bui Khanh Linh', '0909001006'],
  ['Dang Thu Mai', '0909001007'],
  ['Hoang Phuc Nam', '0909001008'],
  ['Doan Bao Ngan', '0909001009'],
  ['Phan Hoai Phuong', '0909001010'],
  ['Truong Tuan Kiet', '0909001011'],
  ['Ngo Yen Nhi', '0909001012'],
  ['Duong Gia Phuc', '0909001013'],
  ['Ly Minh Quan', '0909001014'],
  ['Cao Ngoc Tram', '0909001015'],
  ['Huynh Duc Viet', '0909001016'],
  ['Mai Bao Vy', '0909001017'],
  ['Lam Tien Dung', '0909001018'],
  ['Ta Quynh Nhu', '0909001019'],
  ['Kieu Anh Thu', '0909001020'],
];

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function buildContacts(index) {
  return [
    {
      name: `Guardian ${index + 1}A`,
      phone: `09110020${String(index + 1).padStart(2, '0')}`,
      relation: index % 2 === 0 ? 'Nguoi than' : 'Ban than',
    },
    {
      name: `Guardian ${index + 1}B`,
      phone: `09120030${String(index + 1).padStart(2, '0')}`,
      relation: 'Dong nghiep',
    },
  ];
}

function buildEmail(fullName, index) {
  const slug = fullName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/(^\.|\.$)/g, '');
  return `${slug || `demo.user.${index + 1}`}@safesolo.local`;
}

async function seedOne([fullName, phoneNumber], index) {
  const timerIntervalMinutes = [180, 240, 360, 480, 720, 1440][index % 6];
  const quietHoursStart = index % 2 === 0 ? '22:00' : '23:00';
  const quietHoursEnd = index % 3 === 0 ? '06:00' : '07:00';
  const falseAlertGraceMinutes = [2, 3, 5][index % 3];
  const lastCheckinTime = hoursAgo((index % 10) + 1);
  const nextDeadline = hoursFromNow(Math.max(1, timerIntervalMinutes / 60 - (index % 4)));
  const createdAt = hoursAgo(24 * ((index % 7) + 1));
  const updatedAt = hoursAgo(index % 12);
  const location = {
    lat: 10.75 + index * 0.0021,
    lng: 106.64 + index * 0.0027,
    updatedAt,
  };
  const contacts = buildContacts(index);
  const existing = await User.findOne({ phoneNumber });
  if (existing) {
    existing.fullName = existing.fullName || fullName;
    existing.email = existing.email || buildEmail(fullName, index);
    existing.isActive = existing.isActive !== false;
    existing.isVerified = existing.isVerified !== false;
    existing.isKycVerified = existing.isKycVerified || index % 4 === 0;
    existing.trustScore = Math.max(Number(existing.trustScore || 0), index % 4 === 0 ? 4.4 + ((index % 5) * 0.1) : 0);
    existing.rescuesCount = Math.max(Number(existing.rescuesCount || 0), index % 4 === 0 ? 2 + (index % 5) : 0);
    existing.batteryLevel = existing.batteryLevel ?? (35 + ((index * 7) % 60));
    existing.approxAddress = existing.approxAddress || `Gan khu vuc Q.${(index % 12) + 1}, TP.HCM`;
    existing.emergencyContacts = Array.isArray(existing.emergencyContacts) && existing.emergencyContacts.length
      ? existing.emergencyContacts
      : contacts;
    existing.timerIntervalMinutes = existing.timerIntervalMinutes || timerIntervalMinutes;
    existing.lastKnownLocation = existing.lastKnownLocation || location;
    existing.quietHoursStart = existing.quietHoursStart || quietHoursStart;
    existing.quietHoursEnd = existing.quietHoursEnd || quietHoursEnd;
    existing.falseAlertGraceMinutes = existing.falseAlertGraceMinutes ?? falseAlertGraceMinutes;
    await existing.save();

    await Promise.all([
      AlertPolicy.findOneAndUpdate(
        { userId: existing._id },
        {
          userId: existing._id,
          level1Minutes: 30,
          level2Minutes: 5 + (index % 3) * 5,
          level3Minutes: 15 + (index % 2) * 5,
          level4Enabled: index % 5 === 0,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ),
      MedicalProfile.findOneAndUpdate(
        { userId: existing._id },
        {
          userId: existing._id,
          fullName: existing.fullName,
          birthYear: String(1988 + (index % 12)),
          bloodType: ['A+', 'B+', 'AB+', 'O+', 'O-'][index % 5],
          allergies: index % 4 === 0 ? 'Penicillin' : '',
          conditions: index % 3 === 0 ? 'Tang huyet ap' : '',
          medications: index % 2 === 0 ? 'Vitamin C' : '',
          emergencyPhone: contacts[0].phone,
          insuranceProvider: index % 2 === 0 ? 'Bao Viet' : 'PVI',
          insuranceNumber: `BH-${1000 + index}`,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ),
      AutomationSetting.findOneAndUpdate(
        { userId: existing._id },
        {
          userId: existing._id,
          dailyReminderTime: index % 2 === 0 ? '07:30' : '08:00',
          shakeSos: true,
          shakeSensitivity: 3,
          fallDetection: index % 4 === 0,
          geofenceAutoCheckin: index % 3 !== 0,
          pillReminder: index % 2 === 0,
          pillTime: index % 2 === 0 ? '08:15' : '20:00',
          homeLocation: { lat: location.lat + 0.001, lng: location.lng + 0.001 },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ),
      SecuritySetting.findOneAndUpdate(
        { userId: existing._id },
        {
          userId: existing._id,
          stealthMode: index % 6 === 0,
          autoWipeDays: [0, 7, 30, 60][index % 4],
          encryptionEnabled: true,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ),
      DailyStatus.findOneAndUpdate(
        { userId: existing._id },
        {
          userId: existing._id,
          moodEmoji: ['😊', '😐', '🤒'][index % 3],
          text: index % 2 === 0 ? 'Da check-in va van on.' : 'Hom nay toi van an toan.',
          visibility: index % 3 === 0 ? 'COMMUNITY' : 'FAMILY',
          batteryLevel: 35 + ((index * 7) % 60),
          isCheckIn: true,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ),
    ]);

    return { created: false, id: existing._id, fullName, phoneNumber };
  }

  const user = await User.create({
    fullName,
    phoneNumber,
    role: 'user',
    email: buildEmail(fullName, index),
    avatar: null,
    isActive: true,
    isVerified: true,
    isKycVerified: index % 4 === 0,
    trustScore: index % 4 === 0 ? 4.4 + ((index % 5) * 0.1) : 0,
    rescuesCount: index % 4 === 0 ? 2 + (index % 5) : 0,
    batteryLevel: 35 + ((index * 7) % 60),
    approxAddress: `Gan khu vuc Q.${(index % 12) + 1}, TP.HCM`,
    medicalNotes: index % 4 === 0 ? 'Hen suyen nhe' : '',
    emergencyContacts: contacts,
    timerIntervalMinutes,
    lastCheckinTime,
    nextDeadline,
    currentStatus: 'SAFE',
    lastKnownLocation: location,
    quietHoursStart,
    quietHoursEnd,
    falseAlertGraceMinutes,
    createdAt,
    updatedAt,
  });

  await Promise.all([
    CheckInHistory.create({
      userId: user._id,
      checkinTime: lastCheckinTime,
      locationAtCheckin: { lat: location.lat, lng: location.lng },
      isSystemAutoTriggered: false,
      createdAt: lastCheckinTime,
    }),
    AlertPolicy.create({
      userId: user._id,
      level1Minutes: 30,
      level2Minutes: 5 + (index % 3) * 5,
      level3Minutes: 15 + (index % 2) * 5,
      level4Enabled: index % 5 === 0,
      createdAt,
      updatedAt,
    }),
    MedicalProfile.create({
      userId: user._id,
      fullName,
      birthYear: String(1988 + (index % 12)),
      bloodType: ['A+', 'B+', 'AB+', 'O+', 'O-'][index % 5],
      allergies: index % 4 === 0 ? 'Penicillin' : '',
      conditions: index % 3 === 0 ? 'Tang huyet ap' : '',
      medications: index % 2 === 0 ? 'Vitamin C' : '',
      emergencyPhone: contacts[0].phone,
      insuranceProvider: index % 2 === 0 ? 'Bao Viet' : 'PVI',
      insuranceNumber: `BH-${1000 + index}`,
      createdAt,
      updatedAt,
    }),
    AutomationSetting.create({
      userId: user._id,
      dailyReminderTime: index % 2 === 0 ? '07:30' : '08:00',
      shakeSos: true,
      shakeSensitivity: 3,
      fallDetection: index % 4 === 0,
      geofenceAutoCheckin: index % 3 !== 0,
      pillReminder: index % 2 === 0,
      pillTime: index % 2 === 0 ? '08:15' : '20:00',
      homeLocation: { lat: location.lat + 0.001, lng: location.lng + 0.001 },
      lastGeofenceEventAt: null,
      createdAt,
      updatedAt,
    }),
    SecuritySetting.create({
      userId: user._id,
      stealthMode: index % 6 === 0,
      autoWipeDays: [0, 7, 30, 60][index % 4],
      encryptionEnabled: true,
      lastAutoWipeDueAt: null,
      createdAt,
      updatedAt,
    }),
    DailyStatus.create({
      userId: user._id,
      moodEmoji: ['😊', '😐', '🤒'][index % 3],
      text: index % 2 === 0 ? 'Da check-in va van on.' : 'Hom nay toi van an toan.',
      visibility: index % 3 === 0 ? 'COMMUNITY' : 'FAMILY',
      batteryLevel: 35 + ((index * 7) % 60),
      isCheckIn: true,
      createdAt,
      updatedAt,
    }),
  ]);

  return { created: true, id: user._id, fullName, phoneNumber };
}

async function main() {
  await connectDatabase();
  const results = [];
  for (let index = 0; index < demoUsers.length; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await seedOne(demoUsers[index], index));
  }

  const created = results.filter((item) => item.created);
  const skipped = results.filter((item) => !item.created);

  console.log(
    JSON.stringify(
      {
        ok: true,
        created: created.length,
        skipped: skipped.length,
        users: results,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await $disconnect();
  });
