const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: 'C:/Users/Admin/SafeSolo/backend/.env' });

const database = require('C:/Users/Admin/SafeSolo/backend/src/config/database');
const User = require('C:/Users/Admin/SafeSolo/backend/src/models/User');
const DeviceSignal = require('C:/Users/Admin/SafeSolo/backend/src/models/DeviceSignal');
const AlertEvent = require('C:/Users/Admin/SafeSolo/backend/src/models/AlertEvent');

const baseUrl = `http://localhost:${process.env.PORT || '4000'}`;

async function main() {
  console.log('--- Testing Samsung Galaxy Watch 5 Device Signals Integration ---');
  await database.$connect();

  // Find or create test user
  const user = await User.findOne({ role: 'user' });
  if (!user) {
    throw new Error('No user found in database to test watch signals');
  }

  const userId = user.id || user._id;
  console.log(`Using test user: ${user.fullName || user.email} (${userId})`);

  // 1. Test Regular Vitals Update
  console.log('\n[1] Testing WATCH_METRICS_UPDATE...');
  const vitalsPayload = {
    spO2: 98,
    heartRate: 76,
    steps: 5400,
    calories: 216,
    distanceKm: 4.05,
    battery: 92,
    isOffWrist: false,
    watchModel: 'Samsung Galaxy Watch 5 (WearOS 4.0)',
    sensorType: 'BioActive Sensor (PPG + BIA + ECG)',
  };

  const res1 = await fetch(`${baseUrl}/api/users/${userId}/device-signals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signalType: 'WATCH_METRICS_UPDATE',
      payload: vitalsPayload,
    }),
  });

  const body1 = await res1.json();
  console.log('Status:', res1.status, 'Body:', body1);
  if (!res1.ok || body1.action !== 'RECORDED') {
    throw new Error(`WATCH_METRICS_UPDATE failed: ${JSON.stringify(body1)}`);
  }

  // 2. Test Critical SpO2 Alert
  console.log('\n[2] Testing WATCH_CRITICAL_SPO2 (<90%)...');
  const criticalSpo2Payload = {
    spO2: 84,
    heartRate: 130,
    steps: 5420,
    warningLevel: 'HYPOXIA_CRITICAL',
    watchModel: 'Samsung Galaxy Watch 5 (BioActive Sensor)',
  };

  const res2 = await fetch(`${baseUrl}/api/users/${userId}/device-signals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signalType: 'WATCH_CRITICAL_SPO2',
      payload: criticalSpo2Payload,
    }),
  });

  const body2 = await res2.json();
  console.log('Status:', res2.status, 'Body:', body2);
  if (!res2.ok || body2.action !== 'SOS_TRIGGERED') {
    throw new Error(`WATCH_CRITICAL_SPO2 failed: ${JSON.stringify(body2)}`);
  }

  // 3. Test Hard Fall Detection
  console.log('\n[3] Testing WATCH_FALL_DETECTED (4.8g)...');
  const fallPayload = {
    spO2: 95,
    heartRate: 118,
    steps: 5425,
    gForce: 4.8,
    accVector: { x: 0.8, y: 3.9, z: 2.7 },
    impactConfidence: 0.94,
    watchModel: 'Samsung Galaxy Watch 5',
  };

  const res3 = await fetch(`${baseUrl}/api/users/${userId}/device-signals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signalType: 'WATCH_FALL_DETECTED',
      payload: fallPayload,
    }),
  });

  const body3 = await res3.json();
  console.log('Status:', res3.status, 'Body:', body3);
  if (!res3.ok || body3.action !== 'SOS_TRIGGERED') {
    throw new Error(`WATCH_FALL_DETECTED failed: ${JSON.stringify(body3)}`);
  }

  // 4. Verify MongoDB documents
  console.log('\n[4] Verifying database records...');
  const recentSignal = await DeviceSignal.findOne({ userId, signalType: 'WATCH_FALL_DETECTED' }).sort({ createdAt: -1 });
  if (!recentSignal) {
    throw new Error('DeviceSignal not found in MongoDB');
  }
  console.log('Found DeviceSignal in MongoDB:', recentSignal.signalType, 'gForce:', recentSignal.payload?.gForce);

  const recentAlert = await AlertEvent.findOne({ userId, status: 'WATCH_FALL_DETECTED' }).sort({ triggeredAt: -1 });
  if (!recentAlert) {
    throw new Error('AlertEvent not found in MongoDB');
  }
  console.log('Found AlertEvent in MongoDB:', recentAlert.title, 'Level:', recentAlert.level, 'Source:', recentAlert.source);

  console.log('\n✅ ALL SAMSUNG GALAXY WATCH 5 SIGNALS TESTED AND PASSED SUCCESSFULLY!');
  await database.$disconnect();
}

main().catch(async (err) => {
  console.error('Test failed:', err);
  await database.$disconnect();
  process.exit(1);
});
