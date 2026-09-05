require('dotenv').config();
const jwt = require('jsonwebtoken');
const database = require('../src/config/database');
const ChatRoom = require('../src/models/ChatRoom');
const User = require('../src/models/User');

const fetch = global.fetch;
if (!fetch) {
  throw new Error('Global fetch is not available in this Node runtime. Use Node 18+ or install a polyfill.');
}

async function testChatVoiceUpload() {
  await database.$connect();

  const user = await User.findOne({ isActive: true });
  if (!user) {
    throw new Error('No active user found in database');
  }

  const userId = user._id;
  const roomId = 'test-voice-chat-room';

  await ChatRoom.findOneAndUpdate(
    { _id: roomId },
    {
      $set: {
        roomType: 'GROUP',
        title: 'Voice Test Room',
        participantIds: [userId],
        status: 'ACTIVE',
      },
    },
    { upsert: true, new: true }
  );

  const secret = process.env.JWT_SECRET || 'safesolo-dev-secret';
  const token = jwt.sign({ id: userId, role: 'user' }, secret, { expiresIn: '1h' });

  console.log('Testing voice upload for user:', userId, 'in room:', roomId);
  const dummyAudioBuffer = Buffer.from('RIFF....WAVEfmt ....data....');

  const formData = new FormData();
  formData.append('voice', new Blob([dummyAudioBuffer], { type: 'audio/wav' }), 'test.wav');

  const uploadRes = await fetch(`http://localhost:4000/api/chat/${roomId}/upload-voice`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  console.log('Upload status:', uploadRes.status);
  const uploadBody = await uploadRes.text();
  console.log('Upload response:', uploadBody);

  await database.$disconnect();

  if (uploadRes.status === 200 || uploadRes.status === 201) {
    console.log('✅ Voice upload test passed successfully!');
  } else {
    throw new Error(`Upload failed with status ${uploadRes.status}: ${uploadBody}`);
  }
}

testChatVoiceUpload().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});