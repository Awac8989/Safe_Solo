const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ARTIFACT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\80e30af8-dd29-4f5e-bb89-8a1197db0216';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = path.join(os.tmpdir(), 'chrome_nhom2_fusion_' + Date.now());
const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://127.0.0.1:4000/api';
const API_KEY = 'android-app-key-abc';

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
  }
  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = reject;
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.id && this.callbacks.has(data.id)) {
          const { resolve: res, reject: rej } = this.callbacks.get(data.id);
          this.callbacks.delete(data.id);
          if (data.error) rej(new Error(data.error.message));
          else res(data.result);
        }
      };
    });
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = this.id++;
      this.callbacks.set(msgId, { resolve, reject });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }
  close() {
    if (this.ws) this.ws.close();
  }
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
    await sleep(300);
  }
  throw new Error(`Timeout waiting for CDP port ${port}`);
}

async function evalJs(cdp, expression) {
  const res = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) throw new Error('JS Eval Error: ' + JSON.stringify(res.exceptionDetails));
  return res.result ? res.result.value : undefined;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log('================================================================================');
  console.log('   TEST NHÓM 2 — 3-PHASE SENSOR FUSION WAVEFORMS & WEB ADMIN TOC DRAWER        ');
  console.log('================================================================================\n');

  // 1. Login Super Admin JWT
  const loginRes = await fetch(`${API_URL}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({ email: 'admin@safesolo.vn', password: process.env.TOC_SUPERADMIN_PASSWORD || 'admin123' }),
  });
  const loginJson = await loginRes.json();
  assert(loginRes.ok && loginJson?.data?.token, `Admin login failed: ${JSON.stringify(loginJson)}`);
  const adminToken = loginJson.data.token;
  const adminSession = { ...loginJson.data.user, token: adminToken };

  // 2. Lấy nạn nhân mục tiêu từ /api/admin/overview
  const ovBefore = await fetch(`${API_URL}/admin/overview`, {
    headers: { 'x-api-key': API_KEY, Authorization: `Bearer ${adminToken}` },
  }).then((r) => r.json());
  const victimInc = (ovBefore?.data?.incidents || []).find((i) => i.userId) || ovBefore?.data?.incidents?.[0];
  assert(victimInc && victimInc.userId, 'No active incident with userId in /admin/overview');
  const victimUserId = victimInc.userId;

  // 3. Auto-pair Watch 5 & stream real 32-pt G-Force + PPG waveforms & 3-Phase Fusion metadata
  const pairRes = await fetch(`${API_URL}/watch/pair/auto-pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({
      deviceId: 'watch_galaxy_5',
      deviceModel: 'Samsung Galaxy Watch 5 (SM-R900)',
      userId: victimUserId,
      forceReassign: true,
    }),
  });
  assert(pairRes.ok, 'Pair failed');

  const gWave = [1.0, 1.02, 0.98, 1.05, 1.12, 3.75, 2.1, 1.15, 1.01, 0.99, 1.0, 1.0, 1.01, 0.99, 1.0, 1.0];
  const pWave = [0.16, 0.94, 0.24, 0.42, 0.18, 0.15, 0.98, 0.26, 0.45, 0.19, 0.14, 0.95, 0.23, 0.41, 0.17, 0.16];
  const vitalsRes = await fetch(`${API_URL}/watch/vitals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({
      deviceId: 'watch_galaxy_5',
      userId: victimUserId,
      heartRate: 142,
      spO2: 89,
      battery: 84,
      steps: 1520,
      isOffWrist: false,
      svmG: 3.75,
      tiltAngle: 76.5,
      gForceWaveform: gWave,
      ppgWaveform: pWave,
      fusion: {
        phase: 'PPG_AND_COUNTDOWN',
        peakSvmG: 3.75,
        stillnessRatio: 0.94,
        isOffWrist: false,
        ppgAnomalyReason: 'Nhịp tim tăng vọt 142 BPM · SpO2 hạ 89%',
        confidence: 0.94,
        falseAlarmsBlockedCount: 2,
      },
    }),
  });
  assert(vitalsRes.ok, 'POST /watch/vitals with fusion failed');

  // 4. Verify /admin/overview returns gForceWaveform + ppgWaveform + fusion
  const ovAfter = await fetch(`${API_URL}/admin/overview`, {
    headers: { 'x-api-key': API_KEY, Authorization: `Bearer ${adminToken}` },
  }).then((r) => r.json());
  const matched = (ovAfter?.data?.incidents || []).find((i) => String(i.userId) === String(victimUserId));
  assert(matched?.vitals?.gForceWaveform?.includes(3.75), `Overview missing streamed gForceWaveform peak: ${JSON.stringify(matched?.vitals)}`);
  assert(matched?.vitals?.fusion?.falseAlarmsBlockedCount === 2, 'Overview missing fusion.falseAlarmsBlockedCount=2');
  console.log(`[PASS 1] Backend /watch/vitals -> /admin/overview lưu & trả đủ gForceWaveform (peak 3.75G) + ppgWaveform + fusion (chặn báo giả=2)`);

  // 5. Open Web Admin / Drawer in real headless Chrome & verify both waveform canvases render live
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9228',
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--window-size=1600,1000',
    `${BASE_URL}/`,
  ]);

  const consoleErrors = [];
  const httpErrors = [];

  try {
    const wsUrl = await waitForPort(9228);
    const cdp = new CdpClient(wsUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');

    cdp.ws.addEventListener('message', (ev) => {
      const d = JSON.parse(ev.data);
      if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') {
        consoleErrors.push(d.params.args.map((a) => a.value || a.description || '').join(' '));
      } else if (d.method === 'Network.responseReceived' && d.params.response.status >= 400) {
        httpErrors.push({ status: d.params.response.status, url: d.params.response.url });
      }
    });

    await cdp.send('Page.navigate', { url: `${BASE_URL}/` });
    for (let i = 0; i < 20; i++) {
      const ready = await evalJs(cdp, `window.location.origin.startsWith('http') && document.readyState === 'complete'`).catch(() => false);
      if (ready) break;
      await sleep(300);
    }
    await evalJs(cdp, `localStorage.setItem('safesolo_admin_session_v1', ${JSON.stringify(JSON.stringify(adminSession))});`);
    await cdp.send('Page.navigate', { url: `${BASE_URL}/` });

    // Đợi danh sách sự cố và click vào nạn nhân có watch fusion data
    let clicked = false;
    for (let i = 0; i < 15; i++) {
      await sleep(500);
      clicked = await evalJs(cdp, `(() => {
        const targetName = ${JSON.stringify(matched.name)};
        const card = Array.from(document.querySelectorAll('[class*="cursor-pointer"]')).find(el => el.innerText.includes(targetName) || el.innerText.includes('SOS'));
        if (card) { card.click(); return true; }
        return false;
      })()`);
      if (clicked) break;
    }
    assert(clicked, 'Could not find incident card on / to open Dispatch Drawer');
    await sleep(900);

    // Chuyển sang Tab "Sơ cứu & 115" (clinical) chứa LiveVitalsTelemetry
    await evalJs(cdp, `(() => {
      const tabBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Sơ cứu') || b.innerText.includes('115') || b.innerText.includes('Sinh tồn'));
      if (tabBtn) tabBtn.click();
    })()`);
    await sleep(1000);

    const drawerCheck = await evalJs(cdp, `(() => {
      const t = document.body.innerText;
      const canvases = document.querySelectorAll('canvas').length;
      return {
        hasPpg: t.includes('SÓNG XUNG PPG'),
        hasLiveStream: t.includes('LIVE STREAM'),
        hasGForceTitle: t.includes('G-FORCE IMU SVM'),
        hasPeakG: t.includes('3.75G'),
        hasFusionPhase: t.includes('PPG_AND_COUNTDOWN'),
        hasBlockedCount: t.includes('Chặn báo giả: 2'),
        canvases,
      };
    })()`);

    assert(drawerCheck.hasPpg && drawerCheck.hasLiveStream, `Drawer missing LIVE PPG section: ${JSON.stringify(drawerCheck)}`);
    assert(drawerCheck.hasGForceTitle && drawerCheck.hasPeakG, `Drawer missing G-Force peak 3.75G chart: ${JSON.stringify(drawerCheck)}`);
    assert(drawerCheck.hasFusionPhase && drawerCheck.hasBlockedCount, `Drawer missing 3-phase Fusion badge: ${JSON.stringify(drawerCheck)}`);
    assert(drawerCheck.canvases >= 2, `Expected >=2 waveform canvases, found ${drawerCheck.canvases}`);

    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'NHOM2_DRAWER_FUSION_CHARTS.png'), Buffer.from(shot.data, 'base64'));

    assert(consoleErrors.length === 0, `Console errors: ${JSON.stringify(consoleErrors)}`);
    assert(httpErrors.length === 0, `HTTP errors >= 400: ${JSON.stringify(httpErrors)}`);

    console.log('[PASS 2] Web Admin Dispatch Drawer (/) render cả 2 biểu đồ Canvas PPG + IMU G-Force (3.75G) & Fusion 3 pha (0 lỗi trình duyệt)');
    console.log('\n✅ TẤT CẢ KIỂM TRA NHÓM 2 TRÊN BACKEND & WEB ADMIN PASS 100%!');
    cdp.close();
  } finally {
    try {
      chromeProcess.kill();
    } catch (_) {}
    try {
      fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true });
    } catch (_) {}
  }
}

main().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
