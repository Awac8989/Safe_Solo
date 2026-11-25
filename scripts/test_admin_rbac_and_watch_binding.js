/**
 * SAFESOLO — DEDICATED VERIFICATION FOR:
 * 1) Real Backend Admin JWT Auth & RBAC Enforcement (+ DevTools localStorage tamper check)
 * 2) 1-to-1 Watch Device Binding & Anti-Hijack Ownership Guards
 */
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const API_URL = 'http://127.0.0.1:4000/api';
const WEB_URL = 'http://localhost:5173';
const API_KEY = 'default-public-api-key-123';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function api(pathStr, { method = 'GET', token = null, body = null } = {}) {
  const res = await fetch(`${API_URL}${pathStr}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
  }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
      this.ws.onmessage = (evt) => {
        const data = JSON.parse(evt.data);
        if (data.id && this.callbacks.has(data.id)) {
          const { resolve, reject } = this.callbacks.get(data.id);
          this.callbacks.delete(data.id);
          if (data.error) reject(new Error(data.error.message));
          else resolve(data.result);
        }
      };
    });
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() {
    if (this.ws) this.ws.close();
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForPort(port) {
  for (let i = 0; i < 25; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (r.ok) {
        const list = await r.json();
        const p = list.find((t) => t.type === 'page');
        if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
      }
    } catch (_) {}
    await sleep(300);
  }
  throw new Error(`Timeout waiting for CDP port ${port}`);
}

async function main() {
  console.log('================================================================================');
  console.log('   TEST TÍNH NĂNG #1 (ADMIN JWT + RBAC) & #2 (WATCH 1-1 EXCLUSIVE BINDING)     ');
  console.log('================================================================================\n');

  // --- PART 1: BACKEND ADMIN AUTH & RBAC ---
  const badLogin1 = await api('/admin/auth/login', {
    method: 'POST',
    body: { email: 'admin@safesolo.vn', password: 'wrong_password' },
  });
  assert(badLogin1.status === 401, `Expected 401 on wrong admin password, got ${badLogin1.status}`);

  const badLogin2 = await api('/admin/auth/login', {
    method: 'POST',
    body: { email: 'random@attacker.vn', password: 'password123' },
  });
  assert(badLogin2.status === 401, `Expected 401 on unauthorized email, got ${badLogin2.status}`);
  console.log('[PASS 1] Login sai mật khẩu / email lạ bị chặn 401');

  const noTokenOverview = await api('/admin/overview');
  const noTokenCmd = await api('/watch/command', {
    method: 'POST',
    body: { deviceId: 'watch_galaxy_5', action: 'FIND_WATCH_PING' },
  });
  const noTokenLegacy = await api('/admin/emergencies');
  assert(noTokenOverview.status === 401 && noTokenCmd.status === 401 && noTokenLegacy.status === 401,
    `Expected 401 without JWT: overview=${noTokenOverview.status}, cmd=${noTokenCmd.status}, legacy=${noTokenLegacy.status}`);
  console.log('[PASS 2] Request thiếu JWT tới /admin/overview, /watch/command, /admin/emergencies bị chặn 401');

  const forgedOverview = await api('/admin/overview', { token: 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic3VwZXJhZG1pbiJ9.forged' });
  assert(forgedOverview.status === 401, `Expected 401 on forged JWT, got ${forgedOverview.status}`);
  console.log('[PASS 3] JWT giả mạo chữ ký bị chặn 401');

  const modLogin = await api('/admin/auth/login', { method: 'POST', body: { email: 'moderator@safesolo.vn', password: 'mod123' } });
  const dispLogin = await api('/admin/auth/login', { method: 'POST', body: { email: 'dispatch@safesolo.vn', password: 'dispatch123' } });
  const superLogin = await api('/admin/auth/login', { method: 'POST', body: { email: 'admin@safesolo.vn', password: 'admin123' } });
  assert(modLogin.status === 200 && dispLogin.status === 200 && superLogin.status === 200, 'Valid TOC logins failed');
  const modToken = modLogin.data.data.token;
  const dispToken = dispLogin.data.data.token;
  const superToken = superLogin.data.data.token;

  // Moderator RBAC assertions
  assert((await api('/admin/kyc', { token: modToken })).status === 200, 'Moderator should access /kyc');
  assert((await api('/admin/revenue', { token: modToken })).status === 403, 'Moderator must get 403 on /revenue');
  assert((await api('/admin/analytics', { token: modToken })).status === 403, 'Moderator must get 403 on /analytics');
  assert((await api('/admin/vitals/active', { token: modToken })).status === 403, 'Moderator must get 403 on /vitals/active');
  assert((await api('/watch/command', { method: 'POST', token: modToken, body: { action: 'FIND_WATCH_PING' } })).status === 403,
    'Moderator must get 403 on /watch/command');
  console.log('[PASS 4] Moderator bị chặn 403 ở /revenue, /analytics, /vitals/active, /watch/command');

  // Dispatcher RBAC assertions
  assert((await api('/admin/vitals/active', { token: dispToken })).status === 200, 'Dispatcher should access /vitals/active');
  assert((await api('/admin/revenue', { token: dispToken })).status === 403, 'Dispatcher must get 403 on /revenue');
  assert((await api('/admin/kyc', { token: dispToken })).status === 403, 'Dispatcher must get 403 on /kyc');
  assert((await api('/admin/b2b/overview', { token: dispToken })).status === 403, 'Dispatcher must get 403 on /b2b/overview');
  console.log('[PASS 5] Dispatcher bị chặn 403 ở /revenue, /kyc, /b2b/overview');

  // Super Admin assertions
  for (const ep of ['/admin/overview', '/admin/revenue', '/admin/analytics', '/admin/kyc', '/admin/vitals/active', '/admin/b2b/overview']) {
    const r = await api(ep, { token: superToken });
    assert(r.status === 200, `Super Admin failed on ${ep}: ${r.status}`);
  }
  console.log('[PASS 6] Super Admin truy cập 200 OK toàn bộ phân hệ');

  // --- PART 2: BROWSER REAL UI LOGIN + DEVTOOLS TAMPER DEFENSE ---
  const userDataDir = path.join(os.tmpdir(), 'chrome_rbac_tamper_' + Date.now());
  const chrome = spawn(CHROME_PATH, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=9229',
    `--user-data-dir=${userDataDir}`, '--window-size=1440,900', `${WEB_URL}/`,
  ]);
  try {
    const wsUrl = await waitForPort(9229);
    const cdp = new CdpClient(wsUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await sleep(1500);

    // Thực hiện click chọn Moderator trên UI AdminLogin và submit form thật
    const evalJs = async (expr) => {
      const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
      return r.result?.value;
    };

    for (let i = 0; i < 25; i++) {
      const hasBtn = await evalJs(cdp, `Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Lê Thị Mai'))`).catch(() => false);
      if (hasBtn) break;
      await sleep(350);
    }

    await evalJs(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Lê Thị Mai'));
      if (btn) btn.click();
    })()`);
    await sleep(350);
    await evalJs(`(() => {
      const sub = Array.from(document.querySelectorAll('button[type="submit"]'))[0];
      if (sub) sub.click();
    })()`);

    let loggedInAsMod = false;
    for (let i = 0; i < 20; i++) {
      await sleep(350);
      loggedInAsMod = await evalJs(`(() => {
        const s = JSON.parse(localStorage.getItem('safesolo_admin_session_v1') || 'null');
        return Boolean(s && s.token && s.role === 'moderator');
      })()`).catch(() => false);
      if (loggedInAsMod) break;
    }
    assert(loggedInAsMod, 'Real UI form login for Moderator failed to obtain JWT token');

    // Giả lập kẻ gian mở DevTools sửa localStorage thành role="superadmin" nhưng giữ JWT của Moderator!
    await evalJs(`(() => {
      const s = JSON.parse(localStorage.getItem('safesolo_admin_session_v1'));
      s.role = 'superadmin';
      localStorage.setItem('safesolo_admin_session_v1', JSON.stringify(s));
    })()`);
    await cdp.send('Page.navigate', { url: `${WEB_URL}/revenue` });
    await sleep(2000);

    const tamperDefeated = await evalJs(`(() => {
      const s = JSON.parse(localStorage.getItem('safesolo_admin_session_v1') || 'null');
      return s?.role === 'moderator' && document.body.innerText.includes('PHÂN QUYỀN RBAC');
    })()`);
    assert(tamperDefeated, 'DevTools localStorage role tamper was NOT reverted by /admin/auth/me!');
    console.log('[PASS 7] Trình duyệt đăng nhập JWT thật & tự lật tẩy nếu sửa role trong localStorage qua DevTools');
    cdp.close();
  } finally {
    chrome.kill();
  }

  // --- PART 3: 1-TO-1 WATCH HARDWARE BINDING & ANTI-HIJACK ---
  const usersRes = await api('/admin/users', { token: superToken });
  const users = usersRes.data?.data || [];
  assert(users.length >= 2, 'Need >= 2 users for 1-to-1 Watch binding test');
  const victimId = users[0].id;
  const heroId = users[1].id;
  const watchDeviceId = 'watch_r900_audit99';

  await api('/watch/pair/unpair', { method: 'POST', body: { deviceId: watchDeviceId, force: true } });

  const reqCode = await api('/watch/pair/request-code', {
    method: 'POST',
    body: { deviceId: watchDeviceId, deviceModel: 'Samsung Galaxy Watch 5 (SM-R900)' },
  });
  assert(reqCode.status === 200 && reqCode.data?.code, 'Request pairing code failed');

  const discover = await api('/watch/pair/discover');
  assert(
    discover.status === 200 && (discover.data?.devices || []).some((d) => d.deviceId === watchDeviceId),
    'Watch discover did not include newly requested Watch deviceId'
  );

  const pairVictim = await api('/watch/pair/verify-code', {
    method: 'POST',
    body: { code: reqCode.data.code, userId: victimId },
  });
  assert(pairVictim.status === 200 && pairVictim.data?.deviceId === watchDeviceId, 'Victim 1-1 OTP pairing failed');

  // Hero attempts hijack via auto-pair & vitals & packet & unpair -> ALL MUST FAIL (409 / 403)!
  const hijackPair = await api('/watch/pair/auto-pair', {
    method: 'POST',
    body: { deviceId: watchDeviceId, userId: heroId },
  });
  assert(hijackPair.status === 409 && hijackPair.data?.code === 'WATCH_ALREADY_PAIRED', `Expected 409 on hijack pair, got ${hijackPair.status}`);

  const hijackVitals = await api('/watch/vitals', {
    method: 'POST',
    body: { deviceId: watchDeviceId, userId: heroId, heartRate: 150, spO2: 85 },
  });
  assert(hijackVitals.status === 403 && hijackVitals.data?.code === 'WATCH_OWNERSHIP_MISMATCH',
    `Expected 403 on Hero vitals hijack, got ${hijackVitals.status}`);

  const hijackPacket = await api('/watch/packet', {
    method: 'POST',
    body: { sender: 'phone', action: 'VITALS_UPDATE', payload: { deviceId: watchDeviceId, userId: heroId, heartRate: 140 } },
  });
  assert(hijackPacket.status === 403, `Expected 403 on non-owner packet, got ${hijackPacket.status}`);

  const hijackUnpair = await api('/watch/pair/unpair', {
    method: 'POST',
    body: { deviceId: watchDeviceId, userId: heroId },
  });
  assert(hijackUnpair.status === 403, `Expected 403 on Hero unpair attempt, got ${hijackUnpair.status}`);

  // Standalone Watch sending telemetry (sandbox_user) preserves Victim A ownership!
  const watchTelemetry = await api('/watch/vitals', {
    method: 'POST',
    body: { deviceId: watchDeviceId, userId: 'sandbox_user', heartRate: 78, spO2: 99 },
  });
  assert(watchTelemetry.status === 200 && String(watchTelemetry.data?.vitals?.userId) === String(victimId),
    `Expected telemetry owner preserved as ${victimId}, got ${watchTelemetry.data?.vitals?.userId}`);

  // Watch status check resolves owner identity
  const statusWatch = await api(`/watch/pair/status/${watchDeviceId}`);
  assert(statusWatch.status === 200 && String(statusWatch.data?.userId) === String(victimId), 'Pair status mismatch');

  // Cleanup by true owner Victim A
  const cleanUnpair = await api('/watch/pair/unpair', {
    method: 'POST',
    body: { deviceId: watchDeviceId, userId: victimId },
  });
  assert(cleanUnpair.status === 200 && cleanUnpair.data?.paired === false, 'Owner unpair failed');
  console.log('[PASS 8] Watch 1-1 Binding chặn ghép đè (409), chặn telemetry/unpair sai chủ (403), giữ nguyên chủ khi Watch chạy standalone');

  console.log('\n================================================================================');
  console.log('   ✅ TẤT CẢ 8 BÀI KIỂM TRA BẢO MẬT ADMIN RBAC & WATCH 1-1 BINDING PASS 100%!   ');
  console.log('================================================================================');
}

main().catch((err) => {
  console.error('❌ FAILED:', err);
  process.exit(1);
});
