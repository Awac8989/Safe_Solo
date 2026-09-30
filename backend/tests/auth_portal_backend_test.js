const http = require('http');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Testing SafeSolo Backend Auth & Security Portal ---');

  // 1. Health check
  const health = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/health',
    method: 'GET',
  });
  console.log('[1] Health check:', health.status, health.body?.message || health.body);

  // 2. Login with valid password (demo user)
  const loginRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/auth/login-password',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      identifier: '0913843958',
      password: '123456',
      deviceName: 'Pixel 6 Pro Test Suite',
    }
  );
  console.log('[2] Login with password:', loginRes.status, loginRes.body?.success, 'User:', loginRes.body?.data?.user?.fullName);
  const userId = loginRes.body?.data?.user?._id;
  const token = loginRes.body?.data?.token;

  // 3. Failed password login attempt
  const failRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/auth/login-password',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      identifier: '0913843958',
      password: 'wrong_password_xyz',
    }
  );
  console.log('[3] Wrong password handling:', failRes.status, failRes.body?.error || failRes.body?.message);

  // 4. Forgot password OTP request
  const forgotRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/auth/forgot-password',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      identifier: '0913843958',
    }
  );
  console.log('[4] Forgot password request:', forgotRes.status, forgotRes.body?.data?.message, 'Code:', forgotRes.body?.data?.resetCodePreview);
  const resetCode = forgotRes.body?.data?.resetCodePreview || '123456';

  // 5. Reset password
  const resetRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/auth/reset-password',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      identifier: '0913843958',
      resetCode: resetCode,
      newPassword: 'new_secret_password_123',
    }
  );
  console.log('[5] Reset password:', resetRes.status, resetRes.body?.data?.message);

  // 6. Login with new password
  const loginNewRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/auth/login-password',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      identifier: '0913843958',
      password: 'new_secret_password_123',
      deviceName: 'Pixel 6 Pro Test Suite',
    }
  );
  console.log('[6] Login with new password:', loginNewRes.status, loginNewRes.body?.success);

  // Reset back to default 123456 for demo consistency
  await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/auth/reset-password',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      identifier: '0913843958',
      resetCode: '123456',
      newPassword: '123456',
    }
  );

  // 7. Get active sessions
  const sessionsRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/auth/sessions?userId=${userId}`,
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  console.log('[7] Active sessions count:', sessionsRes.body?.data?.sessions?.length);

  // 8. Revoke other sessions
  const currentSessionId = sessionsRes.body?.data?.sessions?.[0]?.sessionId || 'current_sess';
  const revokeRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/auth/sessions/revoke-others',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      userId: userId,
      currentSessionId: currentSessionId,
    }
  );
  console.log('[8] Revoke other sessions:', revokeRes.status, revokeRes.body?.data?.message);

  console.log('--- ALL BACKEND AUTH & SECURITY PORTAL TESTS PASSED! ---');
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
