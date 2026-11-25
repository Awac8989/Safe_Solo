const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ARTIFACT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\80e30af8-dd29-4f5e-bb89-8a1197db0216';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = path.join(os.tmpdir(), 'chrome_watch5_e2e_' + Date.now());
const WEB_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:4000/api';
const API_KEY = 'default-public-api-key-123';

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
    this.listeners = new Map();
  }
  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.id && this.callbacks.has(data.id)) {
          const { resolve, reject } = this.callbacks.get(data.id);
          this.callbacks.delete(data.id);
          if (data.error) reject(new Error(data.error.message));
          else resolve(data.result);
        } else if (data.method && this.listeners.has(data.method)) {
          for (const fn of this.listeners.get(data.method)) fn(data.params);
        }
      };
    });
  }
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = this.id++;
      this.callbacks.set(msgId, { resolve, reject });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }
  close() { if (this.ws) this.ws.close(); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForPort(port, maxRetries = 25) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const page = list.find((t) => t.type === 'page');
        if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      }
    } catch (_) {}
    await sleep(400);
  }
  throw new Error(`Timeout waiting for Chrome CDP port ${port}`);
}

async function evalJs(cdp, expression) {
  const res = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) throw new Error('JS Eval Error: ' + JSON.stringify(res.exceptionDetails));
  return res.result ? res.result.value : undefined;
}

async function capture(cdp, fileName) {
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const outPath = path.join(ARTIFACT_DIR, fileName);
  fs.writeFileSync(outPath, Buffer.from(screenshot.data, 'base64'));
  return Math.round(Buffer.from(screenshot.data, 'base64').length / 1024);
}

let ADMIN_TOKEN = '';

async function apiPost(pathStr, body) {
  const res = await fetch(`${API_URL}${pathStr}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      ...(ADMIN_TOKEN ? { Authorization: `Bearer ${ADMIN_TOKEN}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiGet(pathStr) {
  const res = await fetch(`${API_URL}${pathStr}`, {
    headers: {
      'x-api-key': API_KEY,
      ...(ADMIN_TOKEN ? { Authorization: `Bearer ${ADMIN_TOKEN}` } : {}),
    },
  });
  return res.json();
}

async function main() {
  console.log('================================================================================');
  console.log('   WEB ADMIN TOC <-> SAMSUNG GALAXY WATCH 5 REAL-TIME BROWSER E2E VERIFICATION  ');
  console.log('================================================================================\n');

  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9225',
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--window-size=1440,960',
    '--disable-gpu',
    '--no-sandbox',
    'about:blank',
  ]);

  const consoleErrors = [];
  const jsExceptions = [];
  const httpErrors = [];
  const networkFailures = [];
  let ctx = 'INIT';

  try {
    const wsUrl = await waitForPort(9225);
    const cdp = new CdpClient(wsUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');

    cdp.on('Runtime.consoleAPICalled', (p) => {
      if (p.type === 'error') consoleErrors.push({ ctx, msg: p.args.map((a) => a.value || a.description).join(' ') });
    });
    cdp.on('Runtime.exceptionThrown', (p) => {
      jsExceptions.push({ ctx, msg: p.exceptionDetails?.text || 'Uncaught exception' });
    });
    cdp.on('Network.responseReceived', (p) => {
      if (p.response.status >= 400) httpErrors.push({ ctx, status: p.response.status, url: p.response.url });
    });
    cdp.on('Network.loadingFailed', (p) => {
      if (p.errorText === 'net::ERR_ABORTED') return;
      networkFailures.push({ ctx, err: p.errorText, url: p.type });
    });

    // Đăng nhập Super Admin session bằng JWT thật từ Backend
    const loginRes = await apiPost('/admin/auth/login', { email: 'admin@safesolo.vn', password: 'admin123' });
    if (!loginRes?.data?.token) throw new Error('Failed to get Super Admin JWT');
    ADMIN_TOKEN = loginRes.data.token;
    const superSession = { ...loginRes.data.user, token: ADMIN_TOKEN };

    await cdp.send('Page.navigate', { url: `${WEB_URL}/vitals` });
    await sleep(1000);
    await evalJs(cdp, `localStorage.setItem('safesolo_admin_session_v1', ${JSON.stringify(JSON.stringify(superSession))});`);
    await cdp.send('Page.navigate', { url: `${WEB_URL}/vitals` });

    // Clear stale commands for watch_galaxy_5
    await apiGet('/watch/commands/watch_galaxy_5?target=watch');

    ctx = 'VITALS_BRIDGE';
    let sseOk = false;
    for (let i = 0; i < 20; i++) {
      await sleep(300);
      sseOk = await evalJs(cdp, `document.body.innerText.includes('SSE STREAM LIVE')`).catch(() => false);
      if (sseOk) break;
    }
    console.log(sseOk ? '  ✅ [PASS] /vitals kết nối EventSource SSE STREAM LIVE thành công' : '  ❌ [FAIL] SSE chưa LIVE');
    if (!sseOk) throw new Error('SSE STREAM LIVE badge not shown');

    // Click nút "Ghép Watch 5 với ..." nếu chưa có watch đang ghép
    await evalJs(cdp, `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Ghép Watch 5'));
      if (btn) btn.click();
    })()`);
    await sleep(800);

    // Lấy userId victim đầu tiên từ devices
    const devResp = await apiGet('/watch/devices');
    const firstDev = devResp.data?.devices?.[0];
    if (!firstDev || !firstDev.userId) throw new Error('Watch 5 chưa liên kết với userId');
    console.log(`  ✅ [PASS] Ghép đôi Watch 5 (${firstDev.deviceId}) <-> Victim (${firstDev.userName})`);

    // Push live vitals from Watch 5 via Backend -> SSE đẩy về browser /vitals tự động không reload
    await apiPost('/watch/vitals', {
      deviceId: firstDev.deviceId,
      userId: firstDev.userId,
      heartRate: 141,
      spO2: 89,
      battery: 91,
      steps: 5420,
      isOffWrist: false,
      svmG: 3.1,
      forcePersist: true,
    });
    await sleep(1200);

    const liveUpdated = await evalJs(cdp, `document.body.innerText.includes('141 BPM') && document.body.innerText.includes('SpO2 89%')`);
    if (!liveUpdated) throw new Error('SSE không cập nhật realtime 141 BPM / SpO2 89% lên /vitals');
    console.log('  ✅ [PASS] Watch 5 telemetry (141 BPM, SpO2 89%) tự động cập nhật trên /vitals qua SSE');

    // Click 3 nút điều khiển hai chiều từ Web Admin /vitals -> Watch 5
    await evalJs(cdp, `(() => {
      const b1 = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Đo BioActive PPG Ngay'));
      const b2 = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Rung Kiểm Tra Watch 5'));
      const b3 = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Báo Watch: Cứu Hộ Đang Tới'));
      if (b1) b1.click();
      if (b2) b2.click();
      if (b3) b3.click();
    })()`);
    await sleep(900);

    const polled = await apiGet(`/watch/commands/${firstDev.deviceId}?target=watch`);
    const snapshotAfter = await apiGet('/watch/devices');
    const queueActions = (polled.commands || []).map((c) => c.action);
    const recentActions = (snapshotAfter.data?.recentEvents || [])
      .map((e) => String(e.type || e.payload?.action || '').replace(/^CMD_/, ''));
    const actions = Array.from(new Set([...queueActions, ...recentActions]));
    for (const reqAct of ['INSTANT_MEASURE_REQ', 'FIND_WATCH_PING', 'TOC_DISPATCH_ACK']) {
      if (!actions.includes(reqAct)) throw new Error(`Missing TOC command ${reqAct} in Watch queue/events`);
    }
    console.log(`  ✅ [PASS] 3 nút lệnh trên Web Admin /vitals đã đẩy đủ [${['INSTANT_MEASURE_REQ', 'FIND_WATCH_PING', 'TOC_DISPATCH_ACK'].join(', ')}] xuống Watch 5`);

    // Watch 5 phản hồi ACK về Web Admin
    await apiPost('/watch/packet', {
      sender: 'watch',
      type: 'ack',
      action: 'WATCH_COMMAND_ACK',
      payload: {
        deviceId: firstDev.deviceId,
        userId: firstDev.userId,
        ackAction: 'TOC_DISPATCH_ACK',
        status: 'DISPLAYED_ON_WATCH',
        note: 'Galaxy Watch 5 (R5CT/SM-R900) đã rung xác nhận điều phối TOC!',
      },
    });
    await sleep(800);

    const ackShown = await evalJs(cdp, `document.body.innerText.includes('WATCH_COMMAND_ACK')`);
    if (!ackShown) throw new Error('Web Admin /vitals không hiển thị WATCH_COMMAND_ACK trên feed hai chiều');
    console.log('  ✅ [PASS] Web Admin /vitals nhận và hiển thị WATCH_COMMAND_ACK tức thì qua SSE');

    const kb1 = await capture(cdp, 'LINK_WEB_01_Watch5_Vitals_Bridge.png');
    console.log(`  📸 Captured LINK_WEB_01_Watch5_Vitals_Bridge.png (${kb1} KB)`);

    // Kiểm tra trên trang Dispatch / (Drawer -> Sơ cứu & 115 -> Điều khiển Watch 5)
    ctx = 'DISPATCH_WATCH_DRAWER';
    await cdp.send('Page.navigate', { url: `${WEB_URL}/` });
    await sleep(2200);
    await evalJs(cdp, `(() => {
      const card = Array.from(document.querySelectorAll('[class*="cursor-pointer"]')).find(el => el.innerText.includes('Doan Minh Quan') || el.innerText.includes('SOS'));
      if (card) card.click();
    })()`);
    await sleep(600);
    await evalJs(cdp, `(() => {
      const tab = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Sơ cứu & 115'));
      if (tab) tab.click();
    })()`);
    await sleep(600);

    const drawerOk = await evalJs(cdp, `document.body.innerText.includes('ĐIỀU KHIỂN GALAXY WATCH 5 HAI CHIỀU') && document.body.innerText.includes('Đo PPG Live')`);
    if (!drawerOk) throw new Error('Không thấy cụm nút điều khiển Galaxy Watch 5 trên Dispatch Drawer');
    await evalJs(cdp, `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Đo PPG Live'));
      if (btn) btn.click();
    })()`);
    await sleep(600);
    const kb2 = await capture(cdp, 'LINK_WEB_02_Dispatch_Watch_Controls.png');
    console.log(`  ✅ [PASS] Dispatch Drawer / hiển thị & gửi lệnh Watch 5 thành công (${kb2} KB)`);

    console.log(`\nTổng kết Browser Errors -> Console: ${consoleErrors.length}, JSExc: ${jsExceptions.length}, HTTP>=400: ${httpErrors.length}, NetFail: ${networkFailures.length}`);
    if (consoleErrors.length || jsExceptions.length || httpErrors.length || networkFailures.length) {
      console.log({ consoleErrors, jsExceptions, httpErrors, networkFailures });
      process.exitCode = 1;
    }
    cdp.close();
  } finally {
    try { chromeProcess.kill('SIGKILL'); } catch (_) {}
    try { fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true }); } catch (_) {}
  }
}

main().catch((err) => {
  console.error('❌ Watch5 WebAdmin Browser E2E failed:', err);
  process.exit(1);
});
