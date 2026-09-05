const path = require('path');
require('dotenv').config({ path: 'C:/Users/Admin/SafeSolo/backend/.env' });

const database = require('C:/Users/Admin/SafeSolo/backend/src/config/database');
const User = require('C:/Users/Admin/SafeSolo/backend/src/models/User');
const { triggerSosForUser } = require('C:/Users/Admin/SafeSolo/backend/src/services/sosService');
const { getIo } = require('C:/Users/Admin/SafeSolo/backend/src/sockets/socketServer');

async function test() {
  console.log('--- Testing Omnichannel SOS Dispatch Integration ---');
  await database.$connect();

  const user = await User.findOne({ role: 'user' });
  if (!user) {
    throw new Error('No test user');
  }

  // Ensure status is SAFE and has an emergency contact
  user.currentStatus = 'SAFE';
  if (!user.emergencyContacts || user.emergencyContacts.length === 0) {
    user.emergencyContacts = [
      { name: 'Nguyen Van A (Bo)', phone: '0912345678', relation: 'Bố', priority: 1 },
      { name: 'Le Thi B (Me)', phone: '0987654321', relation: 'Mẹ', priority: 2 },
    ];
  }
  await user.save();

  console.log(`Triggering Omnichannel SOS for ${user.fullName} (${user.id})...`);
  const mockIo = { emit: (ev, data) => console.log(`[Socket.io Event Emitted] -> ${ev}`) };
  const res = await triggerSosForUser(mockIo, user);

  console.log('\n--- Omnichannel SOS Result ---');
  console.log('Type:', res.type);
  console.log('EmergencyLog ID:', res.emergencyLogId);
  console.log('Omnichannel Channels Dispatched:', res.omnichannel);

  console.log('\n✅ Omnichannel SOS Dispatch test PASSED successfully!');
  await database.$disconnect();
}

test().catch(async (e) => {
  console.error(e);
  await database.$disconnect();
  process.exit(1);
});
