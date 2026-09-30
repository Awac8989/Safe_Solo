require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = await User.find({ phone: { $exists: true, $ne: '' } }, 'name phone email password').lean();
  console.log(`Tìm thấy ${users.length} tài khoản có số điện thoại:`);
  users.forEach((u, i) => {
    console.log(`${i + 1}. Tên: ${u.name || '(Chưa đặt)'} | SĐT: ${u.phone} | Email: ${u.email || '(None)'} | Có mật khẩu: ${Boolean(u.password)}`);
  });
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
