require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/safesolo');
  const collections = await mongoose.connection.db.listCollections().toArray();
  const summary = {};
  for (const c of collections) {
    summary[c.name] = await mongoose.connection.collection(c.name).countDocuments();
  }
  console.log('MongoDB Collections Summary:', JSON.stringify(summary, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
