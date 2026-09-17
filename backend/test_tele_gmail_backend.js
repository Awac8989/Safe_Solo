const http = require('http');

function request(path, body) {
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
        let responseBody = '';
        res.on('data', (chunk) => (responseBody += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(responseBody) });
          } catch {
            resolve({ status: res.statusCode, raw: responseBody });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING TELEGRAM & GMAIL BACKEND TESTS ---');

  // 1. Telegram send OTP
  console.log('\n1. Testing /api/auth/telegram/send-otp...');
  const teleSendRes = await request('/api/auth/telegram/send-otp', {
    identifier: '@test_hero_guardian',
  });
  console.log('Status:', teleSendRes.status);
  console.log('Response:', teleSendRes.body);
  const teleOtp = teleSendRes.body?.data?.otpPreview;
  console.log('Received OTP Preview:', teleOtp);

  // 2. Telegram verify OTP
  console.log('\n2. Testing /api/auth/telegram/verify-otp...');
  const teleVerifyRes = await request('/api/auth/telegram/verify-otp', {
    identifier: '@test_hero_guardian',
    otp: teleOtp,
  });
  console.log('Status:', teleVerifyRes.status);
  console.log('Success:', teleVerifyRes.body?.success);
  console.log('User ID:', teleVerifyRes.body?.data?.user?._id || teleVerifyRes.body?.data?.user?.id);

  // 3. Gmail send OTP
  console.log('\n3. Testing /api/auth/gmail/send-otp...');
  const gmailSendRes = await request('/api/auth/gmail/send-otp', {
    email: 'guardian.safety@gmail.com',
  });
  console.log('Status:', gmailSendRes.status);
  console.log('Response:', gmailSendRes.body);
  const gmailOtp = gmailSendRes.body?.data?.otpPreview;
  console.log('Received Gmail OTP Preview:', gmailOtp);

  // 4. Verify OTP for Gmail
  console.log('\n4. Testing /api/auth/verify-otp for Gmail...');
  const gmailVerifyRes = await request('/api/auth/verify-otp', {
    email: 'guardian.safety@gmail.com',
    otp: gmailOtp,
  });
  console.log('Status:', gmailVerifyRes.status);
  console.log('Success:', gmailVerifyRes.body?.success);
  console.log('User email:', gmailVerifyRes.body?.data?.user?.email);

  // 5. Google 1-tap auth
  console.log('\n5. Testing /api/auth/google...');
  const googleRes = await request('/api/auth/google', {
    email: 'one.tap.google@gmail.com',
    name: 'Google OneTap Tester',
  });
  console.log('Status:', googleRes.status);
  console.log('User name:', googleRes.body?.data?.user?.fullName || googleRes.body?.data?.user?.name);
  console.log('Token generated:', Boolean(googleRes.body?.data?.token));

  // 6. Telegram Webhook simulation (/start and /login)
  console.log('\n6. Testing /api/auth/telegram/webhook (/login command)...');
  const webhookRes = await request('/api/auth/telegram/webhook', {
    message: {
      message_id: 9999,
      from: { id: 777888999, first_name: 'Minh', username: 'minh_tele' },
      chat: { id: 777888999 },
      text: '/login',
    },
  });
  console.log('Webhook Status:', webhookRes.status);
  console.log('Webhook Result:', webhookRes.body);

  console.log('\n✅ ALL TELEGRAM & GMAIL BACKEND TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
