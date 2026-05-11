const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const database = require('../src/config/database');
const User = require('../src/models/User');

const fetch = global.fetch;
if (!fetch) {
  throw new Error(
    'Global fetch is not available in this Node runtime. Use Node 18+ or install a polyfill.',
  );
}

const baseUrl = 'http://localhost:4001';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ensureTestUser(email, fullName, phoneNumber, otp) {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await User.findOneAndUpdate(
    { email },
    {
      $set: {
        fullName,
        phoneNumber,
        isActive: true,
        isVerified: true,
        otpCode: otp,
        otpExpiresAt: expiresAt,
        nextDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      $setOnInsert: {
        firstName: fullName.split(' ').slice(0, -1).join(' ') || fullName,
        lastName: fullName.split(' ').slice(-1).join(' '),
        role: 'user',
        timerIntervalMinutes: 24 * 60,
        lastCheckinTime: new Date(),
      },
    },
    {
      upsert: true,
      setDefaultsOnInsert: true,
      new: true,
    },
  );
}

async function requestJson(url, options = {}) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`${url} failed ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function getToken(email, otp) {
  const profile =
    email.startsWith('victim')
      ? { fullName: 'Radar Victim', phoneNumber: '0902000001' }
      : { fullName: 'Radar Volunteer', phoneNumber: '0902000002' };
  await ensureTestUser(email, profile.fullName, profile.phoneNumber, otp);

  const res = await requestJson(`${baseUrl}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  });

  return res.data.token;
}

async function waitForServer() {
  for (let i = 0; i < 20; i += 1) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) {
        return;
      }
    } catch (_error) {
      // Wait for server startup.
    }
    await delay(500);
  }
  throw new Error('Server did not become healthy in time');
}

async function main() {
  console.log('Starting radar endpoint HTTP test...');
  await database.$connect();
  await waitForServer();

  const victimEmail = 'victim-radar@example.com';
  const volunteerEmail = 'volunteer-radar@example.com';
  const testOtp = '123456';

  const victimToken = await getToken(victimEmail, testOtp);
  const volunteerToken = await getToken(volunteerEmail, testOtp);

  console.log('Tokens obtained for victim and volunteer.');

  await requestJson(`${baseUrl}/api/location/ping`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${victimToken}`,
    },
    body: JSON.stringify({ lat: 21.0285, lng: 105.8542 }),
  });

  await requestJson(`${baseUrl}/api/location/ping`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${volunteerToken}`,
    },
    body: JSON.stringify({ lat: 21.0350, lng: 105.8600 }),
  });

  console.log('Updated user locations.');

  const broadcast = await requestJson(`${baseUrl}/api/radar/broadcast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${victimToken}`,
    },
    body: JSON.stringify({
      incidentType: 'medical_emergency',
      lat: 21.0285,
      lng: 105.8542,
    }),
  });

  console.log('Broadcast response:', broadcast.data.message);
  const incidentId = broadcast.data.incident.id;
  console.log('Created incident ID:', incidentId);

  await delay(500);

  const nearby = await requestJson(
    `${baseUrl}/api/radar/nearby?lat=21.0350&lng=105.8600`,
    {
      headers: {
        Authorization: `Bearer ${volunteerToken}`,
      },
    },
  );

  console.log('Nearby incidents returned:', nearby.data.length);
  if (!Array.isArray(nearby.data) || nearby.data.length === 0) {
    throw new Error('Expected at least one nearby active incident');
  }

  const accept = await requestJson(`${baseUrl}/api/radar/${incidentId}/accept`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${volunteerToken}`,
    },
  });

  console.log('Accept response:', accept.data.message);
  console.log(
    'Accepted incident exact coordinates:',
    accept.data.incident.exactLat,
    accept.data.incident.exactLng,
  );

  console.log('Radar endpoint HTTP test completed successfully.');
  await database.$disconnect();
}

main().catch(async (error) => {
  console.error('Radar HTTP test failed:', error);
  await database.$disconnect();
  process.exit(1);
});
