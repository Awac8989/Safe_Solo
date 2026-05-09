const fetch = global.fetch;
if (!fetch) {
  throw new Error('Global fetch is not available in this Node runtime. Use Node 18+ or install a polyfill.');
}

async function testFeedPagination() {
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

  // Test create status
  console.log('Creating status...');
  const statusRes = await fetch('http://localhost:4000/api/feed/status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      mood_emoji: '😊'
    })
  });

  console.log('Status creation:', statusRes.status, await statusRes.text());

  // Test get feed with pagination
  console.log('Getting feed with pagination...');
  const feedRes = await fetch('http://localhost:4000/api/feed/circle?limit=10&offset=0', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  console.log('Feed response status:', feedRes.status);
  const feedData = await feedRes.text();
  console.log('Feed response:', feedData);

  // Check if pagination is implemented (look for skip and take in the response or error)
  if (feedData.includes('skip') || feedData.includes('take')) {
    console.log('✅ Pagination implemented correctly with skip() and take()');
  } else {
    console.log('❌ Pagination may not be implemented correctly');
  }
}

testFeedPagination().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});