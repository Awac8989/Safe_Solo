const crypto = require('crypto');

const {
  initDatabase,
  nowIso,
  userStatements,
  checkinStatements,
  alertPolicyStatements,
  medicalProfileStatements,
  automationSettingsStatements,
  securitySettingsStatements,
} = require('../src/config/sqlite');

initDatabase();

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
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
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

function seedOne([fullName, phoneNumber], index) {
  const existed = userStatements.getByPhone.get(phoneNumber);
  if (existed) {
    return { created: false, id: existed.id, fullName, phoneNumber };
  }

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
  const id = crypto.randomUUID();

  userStatements.create.run({
    id,
    full_name: fullName,
    phone_number: phoneNumber,
    role: 'user',
    medical_notes: index % 4 === 0 ? 'Hen suyễn nhẹ' : '',
    emergency_contacts: JSON.stringify(buildContacts(index)),
    timer_interval_minutes: timerIntervalMinutes,
    last_checkin_time: lastCheckinTime,
    next_deadline: nextDeadline,
    current_status: 'SAFE',
    last_known_location: JSON.stringify(location),
    quiet_hours_start: quietHoursStart,
    quiet_hours_end: quietHoursEnd,
    sleep_mode_until: null,
    false_alert_grace_minutes: falseAlertGraceMinutes,
    created_at: createdAt,
    updated_at: updatedAt,
  });

  checkinStatements.create.run({
    id: crypto.randomUUID(),
    user_id: id,
    checkin_time: lastCheckinTime,
    location_at_checkin: JSON.stringify({ lat: location.lat, lng: location.lng }),
    is_system_auto_triggered: 0,
    created_at: lastCheckinTime,
  });

  if (!alertPolicyStatements.getByUserId.get(id)) {
    alertPolicyStatements.create.run({
      id: crypto.randomUUID(),
      user_id: id,
      level1_minutes: 30,
      level2_minutes: 5 + (index % 3) * 5,
      level3_minutes: 15 + (index % 2) * 5,
      level4_enabled: index % 5 === 0 ? 1 : 0,
      created_at: createdAt,
      updated_at: updatedAt,
    });
  }

  medicalProfileStatements.upsert.run({
    user_id: id,
    full_name: fullName,
    birth_year: String(1988 + (index % 12)),
    blood_type: ['A+', 'B+', 'AB+', 'O+', 'O-'][index % 5],
    allergies: index % 4 === 0 ? 'Penicillin' : '',
    conditions: index % 3 === 0 ? 'Tang huyet ap' : '',
    medications: index % 2 === 0 ? 'Vitamin C' : '',
    emergency_phone: buildContacts(index)[0].phone,
    insurance_provider: index % 2 === 0 ? 'Bao Viet' : 'PVI',
    insurance_number: `BH-${1000 + index}`,
    created_at: createdAt,
    updated_at: updatedAt,
  });

  automationSettingsStatements.upsert.run({
    user_id: id,
    daily_reminder_time: index % 2 === 0 ? '07:30' : '08:00',
    shake_sos: 1,
    shake_sensitivity: 3,
    fall_detection: index % 4 === 0 ? 1 : 0,
    geofence_auto_checkin: index % 3 !== 0 ? 1 : 0,
    pill_reminder: index % 2 === 0 ? 1 : 0,
    pill_time: index % 2 === 0 ? '08:15' : '20:00',
    home_location: JSON.stringify({ lat: location.lat + 0.001, lng: location.lng + 0.001 }),
    last_geofence_event_at: null,
    created_at: createdAt,
    updated_at: updatedAt,
  });

  securitySettingsStatements.upsert.run({
    user_id: id,
    stealth_mode: index % 6 === 0 ? 1 : 0,
    auto_wipe_days: [0, 7, 30, 60][index % 4],
    encryption_enabled: 1,
    last_auto_wipe_due_at: null,
    created_at: createdAt,
    updated_at: updatedAt,
  });

  return { created: true, id, fullName, phoneNumber };
}

const results = demoUsers.map(seedOne);
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
