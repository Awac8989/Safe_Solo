const db = require('../src/config/database');
const User = require('../src/models/User');

async function main() {
  await db.$connect();
  const users = await User.find({}, '_id name email timerIntervalMinutes nextDeadline currentStatus');
  console.log(JSON.stringify(users, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
