require('dotenv').config();
const jwt = require('jsonwebtoken');

const fetch = global.fetch;
if (!fetch) {
  throw new Error('Global fetch is not available in this Node runtime. Use Node 18+ or install a polyfill.');
}

async function testHeroProfilePrivacy() {
  const usersRes = await fetch('http://localhost:4000/api/users');
  const allUsers = await usersRes.json();
  const currentUserId = allUsers[0]?._id || '44734b73-0ed1-4e7b-bb24-f924898d5a56';

  const secret = process.env.JWT_SECRET || 'safesolo-dev-secret';
  const token = jwt.sign({ id: currentUserId, role: 'user' }, secret, { expiresIn: '1h' });

  console.log('Fetching hero list...');
  const listRes = await fetch('http://localhost:4000/api/community/heroes', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!listRes.ok) {
    console.error('Failed to list heroes:', listRes.status, await listRes.text());
    return;
  }

  const listData = await listRes.json();
  const heroes = listData.data || [];
  if (heroes.length === 0) {
    console.log('No heroes found to test privacy.');
    return;
  }

  const testHero = heroes[0];
  console.log(`Testing privacy for hero: ${testHero.fullName || testHero.firstName} (ID: ${testHero.id || testHero._id})`);

  const heroRes = await fetch(`http://localhost:4000/api/community/heroes/${testHero.id || testHero._id}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  console.log('Hero profile status:', heroRes.status);
  const heroData = await heroRes.text();
  console.log('Hero profile response:', heroData);

  // Check for sensitive data exposure
  const sensitiveFields = ['phone', 'email'];
  let exposedFields = [];

  for (const field of sensitiveFields) {
    if (heroData.includes(`"${field}"`)) {
      exposedFields.push(field);
    }
  }

  if (exposedFields.length > 0) {
    console.log('❌ Privacy breach: Sensitive fields exposed:', exposedFields);
    console.log('Hero profile should NOT contain phone or email fields');
  } else {
    console.log('✅ Privacy protected: No sensitive fields exposed in hero profile');
  }

  // Check for required safe fields
  const safeFields = ['firstName', 'lastName', 'trust_score', 'rescues_count', 'is_kyc_verified'];
  let missingFields = [];

  for (const field of safeFields) {
    if (!heroData.includes(`"${field}"`)) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    console.log('❌ Missing required safe fields:', missingFields);
  } else {
    console.log('✅ All required safe fields present');
  }
}

testHeroProfilePrivacy().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});