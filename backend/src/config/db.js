const mongoose = require('mongoose');

async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/safesolo';

  await mongoose.connect(mongoUri);
  // eslint-disable-next-line no-console
  console.log('Connected to MongoDB');
}

module.exports = { connectDatabase };