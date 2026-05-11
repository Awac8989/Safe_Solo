const jwt = require('jsonwebtoken');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const database = require('../src/config/database');
const User = require('../src/models/User');

const fetch = global.fetch;

if (!fetch) {
  throw new Error(
    'Global fetch is not available in this Node runtime. Use Node 18+ or install a fetch polyfill.',
  );
}

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.PORT = process.env.PORT || '4000';
process.env.TEST_PORT = process.env.TEST_PORT || '4001';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const baseUrl = `http://localhost:${process.env.TEST_PORT}`;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

async function upsertTestUser(email, fullName, phoneNumber, lat, lng) {
  const user = await User.findOneAndUpdate(
    { email },
    {
      $set: {
        fullName,
        phoneNumber,
        isActive: true,
        isVerified: true,
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
      new: true,
      setDefaultsOnInsert: true,
    },
  );

  if (typeof lat === 'number' && typeof lng === 'number') {
    const token = generateToken(user.id || user._id);
    const res = await fetch(`${baseUrl}/api/location/ping`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ lat, lng }),
    });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(
        `Location ping failed for ${email}: ${JSON.stringify(body)}`,
      );
    }
    console.log(`Updated location for ${email}:`, body.data.location);
  }

  return user;
}

async function requestJson(url, options) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Request failed ${url}: ${res.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function main() {
  await waitForServer();

  console.log('Server is healthy');
  await database.$connect();
  console.log('MongoDB connected from test script');

  const victim = await upsertTestUser(
    'victim-radar@example.com',
    'Radar Victim',
    '0901000001',
    21.0285,
    105.8542,
  );
  const volunteer = await upsertTestUser(
    'volunteer-radar@example.com',
    'Radar Volunteer',
    '0901000002',
    21.0350,
    105.86,
  );

  const victimToken = generateToken(victim.id || victim._id);
  const volunteerToken = generateToken(volunteer.id || volunteer._id);

  console.log('Broadcasting SOS as victim...');
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
  console.log('Incident id created:', incidentId);

  console.log('Getting nearby incidents for volunteer...');
  const nearby = await requestJson(
    `${baseUrl}/api/radar/nearby?lat=21.0350&lng=105.8600`,
    {
      headers: {
        Authorization: `Bearer ${volunteerToken}`,
      },
    },
  );

  console.log('Nearby incidents count:', nearby.data.length);
  if (nearby.data.length === 0) {
    throw new Error('Expected at least one nearby incident');
  }

  console.log('Accepting incident as volunteer...');
  const accept = await requestJson(`${baseUrl}/api/radar/${incidentId}/accept`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${volunteerToken}`,
    },
  });

  console.log('Accept response:', accept.data.message);
  console.log(
    'Incident exact coordinates returned:',
    accept.data.incident.exactLat,
    accept.data.incident.exactLng,
  );
  console.log('Volunteer accepted successfully.');
}

main()
  .then(async () => {
    console.log('Radar endpoint tests completed successfully.');
    await database.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Radar endpoint test failed:', error);
    await database.$disconnect();
    process.exit(1);
  });
