const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: 'localhost',
        port: 4000,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let resData = '';
        res.on('data', (c) => (resData += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(resData) });
          } catch {
            resolve({ status: res.statusCode, raw: resData });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function testEmailAndTeleOtp() {
  console.log('=== TEST 1: GỬI MÃ OTP ĐĂNG NHẬP QUA GMAIL ===');
  const gmailRes = await post('/api/auth/gmail/send-otp', {
    email: 'quan.safesolo@gmail.com',
  });
  console.log('Gmail Send OTP Status:', gmailRes.status);
  console.log('Message:', gmailRes.body?.data?.message);
  console.log('Delivery Info:', gmailRes.body?.data?.emailDelivery);
  console.log('OTP Preview:', gmailRes.body?.data?.otpPreview);

  console.log('\n=== TEST 2: QUÊN MẬT KHẨU - GỬI MÃ QUA TELEGRAM ===');
  // Đoàn Minh Quân có chatId: 8153057951 hoặc @DoMiQuan / @safesolo_hero
  const teleForgotRes = await post('/api/auth/forgot-password', {
    identifier: '8153057951',
    channel: 'telegram',
  });
  console.log('Telegram Forgot Status:', teleForgotRes.status);
  console.log('Message:', teleForgotRes.body?.data?.message);
  console.log('Channels:', teleForgotRes.body?.data?.channels);
  console.log('Telegram Delivery:', teleForgotRes.body?.data?.telegramResult?.channel || teleForgotRes.body?.data?.telegramResult);
  console.log('Reset Code:', teleForgotRes.body?.data?.resetCodePreview);

  console.log('\n=== TEST 3: QUÊN MẬT KHẨU - GỬI MÃ QUA GMAIL ===');
  const emailForgotRes = await post('/api/auth/forgot-password', {
    identifier: 'quan.safesolo@gmail.com',
    channel: 'email',
  });
  console.log('Email Forgot Status:', emailForgotRes.status);
  console.log('Message:', emailForgotRes.body?.data?.message);
  console.log('Channels:', emailForgotRes.body?.data?.channels);
  console.log('Email Result:', emailForgotRes.body?.data?.emailResult?.mode);
  console.log('Reset Code:', emailForgotRes.body?.data?.resetCodePreview);

  console.log('\n=== TEST 4: ĐẶT LẠI MẬT KHẨU BẰNG MÃ VỪA NHẬN ===');
  const code = emailForgotRes.body?.data?.resetCodePreview || '123456';
  const resetRes = await post('/api/auth/reset-password', {
    identifier: 'quan.safesolo@gmail.com',
    resetCode: code,
    newPassword: 'new_pass_123456',
  });
  console.log('Reset Password Status:', resetRes.status);
  console.log('Result:', resetRes.body?.data?.message);

  // Restore password back to 123456
  const f = await post('/api/auth/forgot-password', { identifier: 'quan.safesolo@gmail.com' });
  await post('/api/auth/reset-password', {
    identifier: 'quan.safesolo@gmail.com',
    resetCode: f.body?.data?.resetCodePreview || '123456',
    newPassword: '123456',
  });
  console.log('\n=== HOÀN TẤT KIỂM THỬ GỬI THƯ GMAIL & TELEGRAM! ===');
}

testEmailAndTeleOtp().catch(console.error);
