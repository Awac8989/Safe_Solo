const mongoose = require('mongoose');

const defaultUri = 'mongodb://127.0.0.1:27017/Safesolo';

async function $connect() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const mongoUri = process.env.MONGODB_URI || defaultUri;
  await mongoose.connect(mongoUri, {
    dbName: process.env.MONGODB_DB_NAME || 'Safesolo',
  });
  return mongoose.connection;
}

async function $disconnect() {
  if (mongoose.connection.readyState === 0) {
    return;
  }
  await mongoose.disconnect();
}

module.exports = {
  $connect,
  $disconnect,
  mongoose,
};
