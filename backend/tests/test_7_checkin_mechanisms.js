require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const database = require('../src/config/database');
const userController = require('../src/controllers/userController');
const User = require('../src/models/User');

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

async function runTests() {
  console.log('=== TEST 7 CHECK-IN MECHANISMS BACKEND LOGIC ===\n');
  await database.$connect();

  const testUserId = 'test_checkin_7_user';
  await User.deleteOne({ _id: testUserId });
  const user = await User.create({
    _id: testUserId,
    email: 'checkin7@safesolo.vn',
    phoneNumber: '0901234567',
    fullName: 'Đoàn Minh Quân',
    name: 'Đoàn Minh Quân',
    timerIntervalMinutes: 720, // 12h
    currentStatus: 'SAFE',
    nextDeadline: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes left
  });

  // 1. Sleep Wake-up Pulse Check-in
  console.log('1. Testing WAKE_UP_PULSE Check-in...');
  {
    const req = {
      params: { id: testUserId },
      body: {
        type: 'SMART_PASSIVE',
        passiveSource: 'WAKE_UP_PULSE',
        metadata: { restingBpm: 55, wakeBpm: 78, movementDetected: true },
      },
    };
    const res = mockRes();
    await userController.checkin(req, res);
    console.log(`Status: ${res.statusCode}, Message: ${res.body?.message}`);
    if (res.statusCode !== 200 || !res.body?.smartRenewed) {
      throw new Error('Failed WAKE_UP_PULSE');
    }
  }

  // 2. Home Wi-Fi & Docking Anchor Check-in
  console.log('\n2. Testing HOME_WIFI & Docking Anchor Check-in...');
  {
    const req = {
      params: { id: testUserId },
      body: {
        type: 'SMART_PASSIVE',
        passiveSource: 'HOME_WIFI',
        metadata: { isHomeWifi: true, isCharging: true, homeDocking: true },
      },
    };
    const res = mockRes();
    await userController.checkin(req, res);
    console.log(`Status: ${res.statusCode}, Message: ${res.body?.message}`);
    if (res.statusCode !== 200 || !res.body?.smartRenewed) {
      throw new Error('Failed HOME_WIFI');
    }
  }

  // 3. Wear OS Double Wrist-Twist Gesture Check-in
  console.log('\n3. Testing GESTURE_WRIST_TWIST Check-in...');
  {
    const req = {
      params: { id: testUserId },
      body: {
        type: 'GESTURE_WRIST_TWIST',
        metadata: { gesture: 'DOUBLE_WRIST_TWIST', sensor: 'GYROSCOPE' },
      },
    };
    const res = mockRes();
    await userController.checkin(req, res);
    console.log(`Status: ${res.statusCode}, Message: ${res.body?.message}, Type: ${res.body?.type}`);
    if (res.statusCode !== 200 || res.body?.type !== 'GESTURE_WRIST_TWIST') {
      throw new Error('Failed GESTURE_WRIST_TWIST');
    }
  }

  // 4. Hardware Key Combo Check-in
  console.log('\n4. Testing HARDWARE_KEY_COMBO Check-in...');
  {
    const req = {
      params: { id: testUserId },
      body: {
        type: 'HARDWARE_KEY_COMBO',
        metadata: { combo: 'VOL_UP_UP_DOWN', screenOff: true },
      },
    };
    const res = mockRes();
    await userController.checkin(req, res);
    console.log(`Status: ${res.statusCode}, Message: ${res.body?.message}, Type: ${res.body?.type}`);
    if (res.statusCode !== 200 || res.body?.type !== 'HARDWARE_KEY_COMBO') {
      throw new Error('Failed HARDWARE_KEY_COMBO');
    }
  }

  // 5. Voice Safe-Phrase & Stealth Duress Trigger
  console.log('\n5a. Testing VOICE_KEYWORD Safe Phrase...');
  {
    const req = {
      params: { id: testUserId },
      body: {
        type: 'VOICE_KEYWORD',
        metadata: { spokenPhrase: 'SafeSolo, toi an toan' },
      },
    };
    const res = mockRes();
    await userController.checkin(req, res);
    console.log(`Status: ${res.statusCode}, Message: ${res.body?.message}, Type: ${res.body?.type}`);
    if (res.statusCode !== 200 || res.body?.type !== 'VOICE_KEYWORD') {
      throw new Error('Failed VOICE_KEYWORD');
    }
  }

  console.log('5b. Testing VOICE Stealth Duress Coercion Trigger...');
  {
    const req = {
      params: { id: testUserId },
      body: {
        type: 'DURESS_FAKE',
        isDuress: true,
        metadata: { triggerPhrase: 'Toi dang rat ban' },
      },
    };
    const res = mockRes();
    await userController.checkin(req, res);
    console.log(`Status: ${res.statusCode}, Duress Activated: ${res.body?.duressActivated}`);
    if (res.statusCode !== 200 || !res.body?.duressActivated) {
      throw new Error('Failed DURESS_FAKE');
    }
  }

  // 6. Buddy / Couple Cross Check-in
  console.log('\n6. Testing BUDDY_CROSS_CHECKIN Check-in...');
  {
    const req = {
      params: { id: testUserId },
      body: {
        type: 'BUDDY_CROSS_CHECKIN',
        metadata: { buddyId: 'user_mom_002', buddyName: 'Mẹ Lan (ICE)' },
      },
    };
    const res = mockRes();
    await userController.checkin(req, res);
    console.log(`Status: ${res.statusCode}, Message: ${res.body?.message}, Type: ${res.body?.type}`);
    if (res.statusCode !== 200 || res.body?.type !== 'BUDDY_CROSS_CHECKIN') {
      throw new Error('Failed BUDDY_CROSS_CHECKIN');
    }
  }

  // 7. Medication Vision Check-in
  console.log('\n7. Testing MEDICATION_VISION Check-in...');
  {
    const req = {
      params: { id: testUserId },
      body: {
        type: 'MEDICATION_VISION',
        routineType: 'MEDICATION',
        metadata: { pillName: 'Amlodipine 5mg', visionVerified: true },
      },
    };
    const res = mockRes();
    await userController.checkin(req, res);
    console.log(`Status: ${res.statusCode}, Message: ${res.body?.message}, Type: ${res.body?.type}`);
    if (res.statusCode !== 200 || res.body?.type !== 'MEDICATION_VISION') {
      throw new Error('Failed MEDICATION_VISION');
    }
  }

  // Cleanup
  await User.deleteOne({ _id: testUserId });
  await database.$disconnect();

  console.log('\n🎉 ALL 7 CHECK-IN MECHANISMS VERIFIED SUCCESSFULLY IN BACKEND LOGIC!');
}

runTests().catch(async (err) => {
  console.error('Test error:', err);
  try {
    await database.$disconnect();
  } catch (_) {}
  process.exit(1);
});
