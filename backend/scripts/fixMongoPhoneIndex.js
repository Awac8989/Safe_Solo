require('dotenv').config();
const mongoose = require('mongoose');

async function fix() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/Safesolo';
  console.log('Connecting to', uri);
  await mongoose.connect(uri);
  const collection = mongoose.connection.collection('users');

  // Update existing users with empty string phone to null
  const updateRes = await collection.updateMany(
    { phoneNumber: '' },
    { $set: { phoneNumber: null } }
  );
  console.log('Updated empty phone numbers to null:', updateRes.modifiedCount);

  // Check indexes
  const indexes = await collection.indexes();
  console.log('Current indexes:', indexes.map(i => i.name));

  // Drop phoneNumber_1 if exists
  const hasPhoneIndex = indexes.some((idx) => idx.name === 'phoneNumber_1');
  if (hasPhoneIndex) {
    try {
      await collection.dropIndex('phoneNumber_1');
      console.log('Dropped old phoneNumber_1 index');
    } catch (e) {
      console.log('Could not drop index:', e.message);
    }
  }

  // Create partial unique index on non-empty phoneNumber
  await collection.createIndex(
    { phoneNumber: 1 },
    {
      unique: true,
      partialFilterExpression: { phoneNumber: { $type: 'string', $gt: '' } },
      name: 'phoneNumber_1',
    }
  );
  console.log('Created partial unique index phoneNumber_1');

  await mongoose.disconnect();
  console.log('Done!');
}

fix().catch((err) => {
  console.error(err);
  process.exit(1);
});
