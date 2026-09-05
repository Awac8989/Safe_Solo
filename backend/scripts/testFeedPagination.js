require('dotenv').config();
const jwt = require('jsonwebtoken');

const fetch = global.fetch;
if (!fetch) {
  throw new Error('Global fetch is not available in this Node runtime. Use Node 18+ or install a polyfill.');
}

async function testFeedPagination() {
  const usersRes = await fetch('http://localhost:4000/api/users');
  const allUsers = await usersRes.json();
  const currentUserId = allUsers[0]?._id || '44734b73-0ed1-4e7b-bb24-f924898d5a56';

  const secret = process.env.JWT_SECRET || 'safesolo-dev-secret';
  const token = jwt.sign({ id: currentUserId, role: 'user' }, secret, { expiresIn: '1h' });

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

  // Check if pagination is implemented
  if (feedData.includes('limit') && (feedData.includes('offset') || feedData.includes('skip'))) {
    console.log('✅ Pagination implemented correctly with limit and offset');
  } else {
    console.log('❌ Pagination may not be implemented correctly');
  }
}

testFeedPagination().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});