const fetch = global.fetch;
if (!fetch) {
  throw new Error('Global fetch is not available in this Node runtime. Use Node 18+ or install a polyfill.');
}

async function testChatVoiceUpload() {
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

  // For testing, we'll assume we have a JWT token
  // In real scenario, you'd get the token from login response or have a test user
  const token = 'your-jwt-token-here'; // Replace with actual token

  // Create a dummy audio file (in real test, you'd use a real file)
  const dummyAudioBuffer = Buffer.from('dummy audio data'); // This is just for testing

  // Test voice upload
  console.log('Testing voice upload...');
  const formData = new FormData();
  formData.append('voice', new Blob([dummyAudioBuffer], { type: 'audio/mpeg' }), 'test.mp3');

  const uploadRes = await fetch('http://localhost:4000/api/chat/room123/upload-voice', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  console.log('Upload status:', uploadRes.status);
  const uploadBody = await uploadRes.text();
  console.log('Upload response:', uploadBody);
}

testChatVoiceUpload().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});