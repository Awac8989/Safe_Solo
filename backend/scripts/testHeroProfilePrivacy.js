const fetch = global.fetch;
if (!fetch) {
  throw new Error('Global fetch is not available in this Node runtime. Use Node 18+ or install a polyfill.');
}

async function testHeroProfilePrivacy() {
  // First, login to get JWT token
  console.log('Logging in...');
  const loginRes = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: 'test@example.com' })
  });

  if (!loginRes.ok) {
    console.error('Login failed:', loginRes.status, await loginRes.text());
    return;
  }

  const loginData = await loginRes.json();
  console.log('Login response:', loginData);

  const token = 'your-jwt-token-here'; // Replace with actual token

  // Test get hero profile
  console.log('Getting hero profile...');
  const heroRes = await fetch('http://localhost:4000/api/community/heroes/hero-id-here', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
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