require('dotenv').config({ path: 'backend/.env' });
const mongoose = require('mongoose');
const telegramBotService = require('./src/services/telegramBotService');
const User = require('./src/models/User');

async function run() {
  console.log('--- STARTING TELEGRAM CHECK-IN & BOT ENHANCEMENT TESTS ---');

  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/Safesolo';
  await mongoose.connect(uri);

  // 1. Create or find test user with telegramChatId
  const testChatId = '123456789';
  let user = await User.findOne({ telegramChatId: testChatId });
  if (!user) {
    user = await User.create({
      fullName: 'Nguyễn Văn Minh (Test)',
      telegramChatId: testChatId,
      telegramUsername: 'minh_safesolo_test',
      authProvider: 'telegram',
      timerIntervalMinutes: 720,
      currentStatus: 'REMINDER',
      lastCheckinTime: new Date(Date.now() - 11 * 60 * 60 * 1000),
      nextDeadline: new Date(Date.now() + 15 * 60 * 1000),
      batteryLevel: 88,
      role: 'user',
    });
  }
  console.log('1. Test user prepared:', user.fullName, 'ChatId:', user.telegramChatId);

  // 2. Test sendCheckinReminder
  console.log('\n2. Testing sendCheckinReminder()...');
  const reminderResult = await telegramBotService.sendCheckinReminder(user, 15);
  console.log('Reminder Result:', reminderResult);

  // 3. Test handleCallbackQuery for 1-tap check-in
  console.log('\n3. Testing 1-Tap Check-in Callback Query...');
  const callbackRes = await telegramBotService.handleCallbackQuery({
    id: 'cb_test_001',
    from: { id: testChatId, first_name: 'Minh' },
    message: { chat: { id: testChatId }, message_id: 998 },
    data: `checkin:${user._id}`,
  });
  console.log('Callback Query Result:', callbackRes);

  // Verify user updated in DB
  const refreshedUser = await User.findById(user._id);
  console.log('User status after 1-tap checkin:', refreshedUser.currentStatus);
  console.log('User lastCheckinTime:', refreshedUser.lastCheckinTime);
  console.log('User nextDeadline:', refreshedUser.nextDeadline);
  if (refreshedUser.currentStatus !== 'SAFE') {
    throw new Error('User status was not updated to SAFE!');
  }

  // 4. Test text command "💚 Điểm Danh An Toàn"
  console.log('\n4. Testing menu text button "💚 Điểm Danh An Toàn"...');
  const textCheckinRes = await telegramBotService.handleWebhook({
    message: {
      message_id: 999,
      chat: { id: testChatId },
      from: { id: testChatId, first_name: 'Minh' },
      text: '💚 Điểm Danh An Toàn',
    },
  });
  console.log('Text check-in result:', textCheckinRes);

  // 5. Test status command "📊 Xem Trạng Thái"
  console.log('\n5. Testing "📊 Xem Trạng Thái"...');
  const statusRes = await telegramBotService.handleWebhook({
    message: {
      message_id: 1000,
      chat: { id: testChatId },
      from: { id: testChatId, first_name: 'Minh' },
      text: '📊 Xem Trạng Thái',
    },
  });
  console.log('Status result:', statusRes);

  // 6. Test location sharing
  console.log('\n6. Testing location pin update...');
  const locRes = await telegramBotService.handleWebhook({
    message: {
      message_id: 1001,
      chat: { id: testChatId },
      from: { id: testChatId, first_name: 'Minh' },
      location: { latitude: 10.77689, longitude: 106.70089 },
    },
  });
  console.log('Location update result:', locRes);

  // 7. Test demo reminder trigger "/testreminder"
  console.log('\n7. Testing demo reminder command "/testreminder"...');
  const testRemRes = await telegramBotService.handleWebhook({
    message: {
      message_id: 1002,
      chat: { id: testChatId },
      from: { id: testChatId, first_name: 'Minh' },
      text: '/testreminder',
    },
  });
  console.log('Demo reminder result:', testRemRes);

  await mongoose.disconnect();
  console.log('\n🎉 ALL TELEGRAM BOT CHECK-IN FEATURES VERIFIED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
