const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Pool } = require('pg');
const crypto = require('crypto');

const fetch = global.fetch;
if (!fetch) {
  throw new Error('Global fetch is not available in this Node runtime. Use Node 18+ or install a polyfill.');
}

const baseUrl = 'http://localhost:4001';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function hashOTP(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

async function ensureTestUser(email, firstName, lastName, otp) {
  const hashed = hashOTP(otp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await pool.query(
    `INSERT INTO users ("email", "firstName", "lastName", "isActive", "isVerified", "otpCode", "otpExpiresAt", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, true, true, $4, $5, now(), now())
     ON CONFLICT ("email") DO UPDATE
     SET "firstName" = EXCLUDED."firstName",
         "lastName" = EXCLUDED."lastName",
         "isActive" = true,
         "isVerified" = true,
         "otpCode" = EXCLUDED."otpCode",
         "otpExpiresAt" = EXCLUDED."otpExpiresAt",
         "updatedAt" = now();`,
    [email, firstName, lastName, hashed, expiresAt]
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
  await ensureTestUser(email, 'Radar', email.startsWith('victim') ? 'Victim' : 'Volunteer', otp);

  const res = await requestJson(`${baseUrl}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp })
  });

  return res.data.token;
}

async function main() {
  console.log('Starting radar endpoint HTTP test...');

  // Create test users and derive tokens
  const victimEmail = 'victim-radar@example.com';
  const volunteerEmail = 'volunteer-radar@example.com';
  const testOTP = '123456';

  const victimToken = await getToken(victimEmail, testOTP);
  const volunteerToken = await getToken(volunteerEmail, testOTP);

  console.log('Tokens obtained for victim and volunteer.');

  // Update locations for both users
  await requestJson(`${baseUrl}/api/location/ping`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${victimToken}`
    },
    body: JSON.stringify({ lat: 21.0285, lng: 105.8542 })
  });

  await requestJson(`${baseUrl}/api/location/ping`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${volunteerToken}`
    },
    body: JSON.stringify({ lat: 21.0350, lng: 105.8600 })
  });

  console.log('Updated user locations.');

  // Broadcast SOS from victim
  const broadcast = await requestJson(`${baseUrl}/api/radar/broadcast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${victimToken}`
    },
    body: JSON.stringify({ incidentType: 'medical_emergency', lat: 21.0285, lng: 105.8542 })
  });

  console.log('Broadcast response:', broadcast.data.message);
  const incidentId = broadcast.data.incident.id;
  console.log('Created incident ID:', incidentId);

  // Give server a short moment to index the location update
  await delay(500);

  // Volunteer checks nearby active incidents
  const nearby = await requestJson(`${baseUrl}/api/radar/nearby?lat=21.0350&lng=105.8600`, {
    headers: {
      Authorization: `Bearer ${volunteerToken}`
    }
  });

  console.log('Nearby incidents returned:', nearby.data.length);
  if (!Array.isArray(nearby.data) || nearby.data.length === 0) {
    throw new Error('Expected at least one nearby active incident');
  }

  // Volunteer accepts the incident
  const accept = await requestJson(`${baseUrl}/api/radar/${incidentId}/accept`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${volunteerToken}`
    }
  });

  console.log('Accept response:', accept.data.message);
  console.log('Accepted incident exact coordinates:', accept.data.incident.exactLat, accept.data.incident.exactLng);

  console.log('Radar endpoint HTTP test completed successfully.');
  await pool.end();
}

main().catch(async err => {
  console.error('Radar HTTP test failed:', err);
  await pool.end();
  process.exit(1);
});
