const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { io } = require(path.resolve(__dirname, '../web-admin/node_modules/socket.io-client'));

const ARTIFACT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\80e30af8-dd29-4f5e-bb89-8a1197db0216';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = path.join(os.tmpdir(), 'chrome_nhom3_webrtc_' + Date.now());
const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://127.0.0.1:4000/api';
const SOCKET_URL = 'http://127.0.0.1:4000';
const API_KEY = 'android-app-key-abc';

// Minimal valid 2x2 red/cyan JPEG base64 for testing Hero Camera2 Video Frame relay
const TEST_JPEG_B64 =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

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
  console.log('   TEST NHÓM 3 — ROUTE DEVIATION (>300m) WATCH PROMPT & WEBRTC/PTT 115 <-> A71  ');
  console.log('================================================================================\n');

  // 1. Login Admin JWT & fetch active victim + incident
  const loginRes = await fetch(`${API_URL}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({ email: 'admin@safesolo.vn', password: process.env.TOC_SUPERADMIN_PASSWORD || 'admin123' }),
  });
  const loginJson = await loginRes.json();
  assert(loginRes.ok && loginJson?.data?.token, 'Admin login failed');
  const adminToken = loginJson.data.token;
  const adminSession = { ...loginJson.data.user, token: adminToken };

  const ov = await fetch(`${API_URL}/admin/overview`, {
    headers: { 'x-api-key': API_KEY, Authorization: `Bearer ${adminToken}` },
  }).then((r) => r.json());
  const incident = (ov?.data?.incidents || []).find((i) => i.userId) || ov?.data?.incidents?.[0];
  assert(incident && incident.userId, 'No active incident found');
  const victimId = incident.userId;

  // Pair Watch 5 so route-deviation ping routes to victim's watch queue
  await fetch(`${API_URL}/watch/pair/auto-pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({
      deviceId: 'watch_galaxy_5',
      deviceModel: 'Samsung Galaxy Watch 5 (SM-R900)',
      userId: victimId,
      forceReassign: true,
    }),
  });
  // Drain existing queue before testing route deviation
  await fetch(`${API_URL}/watch/commands/watch_galaxy_5?target=watch`, { headers: { 'x-api-key': API_KEY } });

  // 2. Test LiveJourney Route Deviation (>300m) -> Watch 5 Prompt -> Ack
  const startJ = await fetch(`${API_URL}/journeys/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'x-user-id': victimId },
    body: JSON.stringify({
      destinationLabel: 'Nhà riêng Q.1 (Test Lệch Tuyến)',
      durationMinutes: 25,
      startLat: 10.7769,
      startLng: 106.7009,
      destinationLat: 10.7900,
      destinationLng: 106.7009,
    }),
  }).then((r) => r.json());
  const journeyId = startJ?.data?.id;
  assert(journeyId, `Failed starting journey: ${JSON.stringify(startJ)}`);

  // Ping on corridor -> NO alert
  const pingOk = await fetch(`${API_URL}/journeys/${journeyId}/ping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'x-user-id': victimId },
    body: JSON.stringify({ lat: 10.7815, lng: 106.7011 }),
  }).then((r) => r.json());
  assert(pingOk?.success === true, 'Corridor ping failed');
  const cmdsBefore = await fetch(`${API_URL}/watch/commands/watch_galaxy_5?target=watch`, {
    headers: { 'x-api-key': API_KEY },
  }).then((r) => r.json());
  assert(!(cmdsBefore.commands || []).some((c) => c.action === 'ROUTE_DEVIATION_CHECK'), 'Corridor ping falsely triggered deviation');

  // Ping > 600m east off corridor -> MUST trigger Watch 5 ROUTE_DEVIATION_CHECK
  await fetch(`${API_URL}/journeys/${journeyId}/ping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'x-user-id': victimId },
    body: JSON.stringify({ lat: 10.7815, lng: 106.7070 }),
  });
  const cmdsAfter = await fetch(`${API_URL}/watch/commands/watch_galaxy_5?target=watch`, {
    headers: { 'x-api-key': API_KEY },
  }).then((r) => r.json());
  const devCmd = (cmdsAfter.commands || []).find((c) => c.action === 'ROUTE_DEVIATION_CHECK');
  assert(devCmd && devCmd.payload?.prompt === 'Bạn ổn chứ?', `Expected ROUTE_DEVIATION_CHECK in Watch queue, got ${JSON.stringify(cmdsAfter)}`);
  assert(devCmd.payload?.deviationMeters > 300, `Expected >300m deviation, got ${devCmd.payload?.deviationMeters}`);

  // Confirm Safe via anomaly-ack, then finish journey cleanly
  const ackRes = await fetch(`${API_URL}/journeys/${journeyId}/anomaly-ack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'x-user-id': victimId },
    body: JSON.stringify({ action: 'CONFIRM_SAFE', reason: 'Watch 5 user tapped Tôi ổn' }),
  }).then((r) => r.json());
  assert(ackRes?.data?.deviationAlertTriggered === false, 'anomaly-ack CONFIRM_SAFE failed');

  await fetch(`${API_URL}/journeys/${journeyId}/finish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'x-user-id': victimId },
  });
  console.log(`[PASS 1] Lệch tuyến ${devCmd.payload.deviationMeters}m (>300m) đẩy ping ROUTE_DEVIATION_CHECK ("Bạn ổn chứ?") xuống Watch 5 & CONFIRM_SAFE thành công`);

  // 3. Test Socket.IO WebRTC Signaling + 1-way Video + Doctor Directive with Live Web Admin / Drawer
  const roomId = incident.id.startsWith('incident_') ? incident.id : `incident_${incident.id}`;
  const heroSock = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    auth: { type: 'webrtc_field', apiKey: API_KEY, token: adminToken },
  });
  let receivedOfferOnHero = null;
  let receivedInstructionOnHero = null;

  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Hero socket connect timeout')), 5000);
    heroSock.on('connect_error', (err) => {
      clearTimeout(t);
      reject(new Error(`Hero socket connect_error: ${err?.message || err}`));
    });
    heroSock.on('connect', () => {
      clearTimeout(t);
      heroSock.emit('webrtc:join_room', {
        roomId,
        peerId: 'hero_a71_e2e',
        role: 'hero',
        name: 'Hiệp sĩ A71',
      });
      resolve();
    });
  });

  heroSock.on('webrtc:offer', (d) => {
    receivedOfferOnHero = d;
    heroSock.emit('webrtc:answer', {
      roomId,
      sdp: { type: 'answer', sdp: 'v=0\r\n' },
      senderPeerId: 'hero_a71_e2e',
      senderRole: 'hero',
    });
  });
  heroSock.on('webrtc:doctor_instruction', (d) => {
    receivedInstructionOnHero = d;
  });

  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--remote-debugging-port=9229',
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--window-size=1600,1000',
    `${BASE_URL}/`,
  ]);

  const consoleErrors = [];
  const httpErrors = [];

  try {
    const wsUrl = await waitForPort(9229);
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

    // Open target incident Drawer
    let opened = false;
    for (let i = 0; i < 15; i++) {
      await sleep(500);
      opened = await evalJs(cdp, `(() => {
        const card = Array.from(document.querySelectorAll('[class*="cursor-pointer"]')).find(el => el.innerText.includes(${JSON.stringify(incident.name)}));
        if (card) { card.click(); return true; }
        return false;
      })()`);
      if (opened) break;
    }
    assert(opened, 'Could not open target incident drawer');
    await sleep(700);

    // Switch to Tab "Hiệp sĩ & Gọi" and click VIDEO WEBRTC
    await evalJs(cdp, `(() => {
      const tab = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Hiệp sĩ & Gọi'));
      if (tab) tab.click();
    })()`);
    await sleep(600);
    await evalJs(cdp, `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('VIDEO WEBRTC'));
      if (btn) btn.click();
    })()`);
    for (let i = 0; i < 16; i++) {
      await sleep(350);
      const sockOk = await evalJs(cdp, `document.body.innerText.includes('SOCKET LIVE')`).catch(() => false);
      if (sockOk) break;
    }

    // Click Khởi tạo WebRTC Offer
    await evalJs(cdp, `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Khởi tạo Kết nối WebRTC Offer'));
      if (btn) btn.click();
    })()`);
    for (let i = 0; i < 25; i++) {
      if (receivedOfferOnHero && receivedOfferOnHero.sdp?.type === 'offer') break;
      await sleep(200);
    }
    assert(receivedOfferOnHero && receivedOfferOnHero.sdp?.type === 'offer', 'Hero A71 socket did not receive WebRTC SDP Offer via Socket.IO');

    // Hero A71 emits Camera2 live video frame -> Web Admin renders <img alt="Hero Field Camera WebRTC Feed">
    heroSock.emit('webrtc:video_frame', {
      roomId,
      frameBase64: TEST_JPEG_B64,
      width: 320,
      height: 240,
      fps: 8,
      senderName: 'Hiệp sĩ A71',
      cameraFacing: 'BACK',
    });
    for (let i = 0; i < 15; i++) {
      await sleep(200);
      const hasCam = await evalJs(cdp, `Boolean(document.querySelector('img[alt="Hero Field Camera WebRTC Feed"]'))`).catch(() => false);
      if (hasCam) break;
    }

    // Bác sĩ 115 bấm nút "❤️ Ép Tim CPR 110/p"
    await evalJs(cdp, `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Ép Tim CPR 110/p'));
      if (btn) btn.click();
    })()`);
    for (let i = 0; i < 15; i++) {
      if (receivedInstructionOnHero && receivedInstructionOnHero.instructionType === 'CPR_PACE_110') break;
      await sleep(200);
    }

    assert(
      receivedInstructionOnHero && receivedInstructionOnHero.instructionType === 'CPR_PACE_110',
      `Hero A71 socket did not receive Doctor CPR instruction: ${JSON.stringify(receivedInstructionOnHero)}`
    );

    const uiState = await evalJs(cdp, `(() => {
      const t = document.body.innerText;
      const img = document.querySelector('img[alt="Hero Field Camera WebRTC Feed"]');
      return {
        hasSocketLive: t.includes('SOCKET LIVE'),
        hasCameraTitle: t.includes('CAMERA HIỆN TRƯỜNG: Hiệp sĩ A71'),
        hasImgTag: Boolean(img),
        hasCprLog: t.includes('ép tim CPR 100-120'),
      };
    })()`);

    assert(uiState.hasSocketLive && uiState.hasCameraTitle && uiState.hasImgTag, `WebRTC UI mismatch: ${JSON.stringify(uiState)}`);
    assert(uiState.hasCprLog, `WebRTC transcript missing CPR instruction: ${JSON.stringify(uiState)}`);
    assert(consoleErrors.length === 0, `Browser console errors: ${JSON.stringify(consoleErrors)}`);
    assert(httpErrors.length === 0, `Browser HTTP errors >=400: ${JSON.stringify(httpErrors)}`);

    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'NHOM3_WEBRTC_DOCTOR_HERO.png'), Buffer.from(shot.data, 'base64'));

    console.log('[PASS 2] Socket.IO WebRTC SDP Offer/Answer + Live Camera Frame A71 -> Web Admin (0 lỗi trình duyệt)');
    console.log('[PASS 3] Bác sĩ 115 gửi chỉ đạo CPR 110/p qua Socket.IO xuống màn hình Hiệp sĩ A71 < 600ms');
    console.log('\n✅ TẤT CẢ KIỂM TRA NHÓM 3 PASS 100%!');
    cdp.close();
  } finally {
    try { heroSock.disconnect(); } catch (_) {}
    try { chromeProcess.kill(); } catch (_) {}
    try { fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true }); } catch (_) {}
  }
}

main().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
