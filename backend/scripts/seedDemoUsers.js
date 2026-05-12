const { connectDatabase, $disconnect } = require('../src/config/db');
const User = require('../src/models/User');
const CheckInHistory = require('../src/models/CheckInHistory');
const AlertPolicy = require('../src/models/AlertPolicy');
const MedicalProfile = require('../src/models/MedicalProfile');
const AutomationSetting = require('../src/models/AutomationSetting');
const SecuritySetting = require('../src/models/SecuritySetting');
const DailyStatus = require('../src/models/DailyStatus');
const KYCDocument = require('../src/models/KYCDocument');

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
  ['Doan Minh Quan', '0913843958'],
  ['Minh Anh Hero', '0913843951'],
  ['Bao An Hero', '0913843952'],
  ['Le Huu Phuoc', '0913843953'],
  ['Phan Thi Mai', '0913843954'],
];

const verifiedHeroPhones = new Set([
  '0913843958',
  '0913843951',
  '0913843952',
  '0913843953',
  '0913843954',
]);

function svgDataUrl(markup) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markup)}`;
}

function buildPortraitSvg(name) {
  const initial = String(name || 'H').trim().charAt(0).toUpperCase() || 'H';
  return svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#22c55e"/>
          <stop offset="100%" stop-color="#0ea5e9"/>
        </linearGradient>
      </defs>
      <rect width="720" height="960" rx="48" fill="url(#bg)"/>
      <circle cx="360" cy="280" r="118" fill="#ecfeff"/>
      <circle cx="360" cy="246" r="68" fill="#a7f3d0"/>
      <path d="M232 450c24-76 88-118 128-118s104 42 128 118v72H232z" fill="#a7f3d0"/>
      <rect x="92" y="630" width="536" height="176" rx="26" fill="#ffffff" fill-opacity="0.9"/>
      <text x="360" y="704" text-anchor="middle" font-size="44" font-family="Arial, sans-serif" font-weight="700" fill="#0f172a">${name}</text>
      <text x="360" y="758" text-anchor="middle" font-size="28" font-family="Arial, sans-serif" fill="#0f766e">Hiệp sĩ đã xác minh</text>
      <circle cx="128" cy="128" r="56" fill="#ffffff" fill-opacity="0.2"/>
      <text x="128" y="148" text-anchor="middle" font-size="66" font-family="Arial, sans-serif" font-weight="700" fill="#ffffff">${initial}</text>
    </svg>
  `);
}

function buildIdentitySvg(name, idNumber, side, address) {
  return svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600">
      <defs>
        <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ecfccb"/>
          <stop offset="100%" stop-color="#dcfce7"/>
        </linearGradient>
      </defs>
      <rect width="960" height="600" rx="36" fill="url(#card)"/>
      <rect x="38" y="38" width="884" height="524" rx="24" fill="#ffffff" fill-opacity="0.85" stroke="#86efac" stroke-width="3"/>
      <text x="70" y="92" font-size="34" font-family="Arial, sans-serif" font-weight="700" fill="#166534">CĂN CƯỚC CÔNG DÂN</text>
      <text x="70" y="130" font-size="20" font-family="Arial, sans-serif" fill="#166534">${side}</text>
      <rect x="70" y="182" width="220" height="280" rx="24" fill="#dcfce7"/>
      <circle cx="180" cy="268" r="54" fill="#86efac"/>
      <path d="M108 386c18-60 58-90 72-90 15 0 55 30 72 90v34H108z" fill="#86efac"/>
      <text x="340" y="230" font-size="22" font-family="Arial, sans-serif" fill="#64748b">Họ và tên</text>
      <text x="340" y="268" font-size="34" font-family="Arial, sans-serif" font-weight="700" fill="#0f172a">${name}</text>
      <text x="340" y="330" font-size="22" font-family="Arial, sans-serif" fill="#64748b">Số định danh</text>
      <text x="340" y="368" font-size="30" font-family="Courier New, monospace" font-weight="700" fill="#0f172a">${idNumber}</text>
      <text x="340" y="430" font-size="22" font-family="Arial, sans-serif" fill="#64748b">Địa chỉ</text>
      <foreignObject x="340" y="444" width="520" height="88">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,sans-serif;font-size:24px;color:#0f172a;line-height:1.3;">${address}</div>
      </foreignObject>
      <text x="812" y="534" text-anchor="end" font-size="18" font-family="Arial, sans-serif" fill="#64748b">SafeSolo Demo</text>
    </svg>
  `);
}

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
  const isVerifiedHero = verifiedHeroPhones.has(phoneNumber);
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
    existing.isKycVerified = existing.isKycVerified || isVerifiedHero || index % 4 === 0;
    existing.trustScore = Math.max(Number(existing.trustScore || 0), isVerifiedHero ? 4.7 + ((index % 3) * 0.1) : index % 4 === 0 ? 4.4 + ((index % 5) * 0.1) : 0);
    existing.rescuesCount = Math.max(Number(existing.rescuesCount || 0), isVerifiedHero ? 5 + (index % 8) : index % 4 === 0 ? 2 + (index % 5) : 0);
    existing.batteryLevel = existing.batteryLevel ?? (35 + ((index * 7) % 60));
    existing.approxAddress = existing.approxAddress || (isVerifiedHero ? `Thu Dau Mot, Bình Dương` : `Gan khu vuc Q.${(index % 12) + 1}, TP.HCM`);
    if (isVerifiedHero) {
      existing.avatar = existing.avatar || buildPortraitSvg(fullName);
    }
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
      ...(isVerifiedHero
        ? [
            KYCDocument.findOneAndUpdate(
              { userId: existing._id },
              {
                userId: existing._id,
                frontImageUrl: buildIdentitySvg(
                  fullName,
                  `07920${String(index + 1).padStart(6, '0')}`,
                  'Mặt trước',
                  existing.approxAddress || 'Thu Dau Mot, Bình Dương',
                ),
                backImageUrl: buildIdentitySvg(
                  fullName,
                  `07920${String(index + 1).padStart(6, '0')}`,
                  'Mặt sau',
                  existing.approxAddress || 'Thu Dau Mot, Bình Dương',
                ),
                status: 'APPROVED',
                submittedAt: hoursAgo((index % 5) + 20),
                reviewedAt: hoursAgo((index % 4) + 4),
              },
              { upsert: true, new: true, setDefaultsOnInsert: true },
            ),
          ]
        : []),
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
    isKycVerified: isVerifiedHero || index % 4 === 0,
    trustScore: isVerifiedHero ? 4.7 + ((index % 3) * 0.1) : index % 4 === 0 ? 4.4 + ((index % 5) * 0.1) : 0,
    rescuesCount: isVerifiedHero ? 5 + (index % 8) : index % 4 === 0 ? 2 + (index % 5) : 0,
    batteryLevel: 35 + ((index * 7) % 60),
    approxAddress: isVerifiedHero ? 'Thu Dau Mot, Bình Dương' : `Gan khu vuc Q.${(index % 12) + 1}, TP.HCM`,
    medicalNotes: index % 4 === 0 ? 'Hen suyen nhe' : '',
    avatar: isVerifiedHero ? buildPortraitSvg(fullName) : null,
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
    ...(isVerifiedHero
      ? [
          KYCDocument.create({
            userId: user._id,
            frontImageUrl: buildIdentitySvg(
              fullName,
              `07920${String(index + 1).padStart(6, '0')}`,
              'Mặt trước',
              user.approxAddress || 'Thu Dau Mot, Bình Dương',
            ),
            backImageUrl: buildIdentitySvg(
              fullName,
              `07920${String(index + 1).padStart(6, '0')}`,
              'Mặt sau',
              user.approxAddress || 'Thu Dau Mot, Bình Dương',
            ),
            status: 'APPROVED',
            submittedAt: hoursAgo((index % 5) + 20),
            reviewedAt: hoursAgo((index % 4) + 4),
            createdAt,
            updatedAt,
          }),
        ]
      : []),
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
