const db = require('../src/config/database');
const User = require('../src/models/User');

async function main() {
  await db.$connect();
  const user = await User.findById('google_502873273');
  console.log('User found:', user);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
