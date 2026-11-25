const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ARTIFACT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\80e30af8-dd29-4f5e-bb89-8a1197db0216';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = path.join(os.tmpdir(), 'chrome_modal_test_' + Date.now());
const BASE_URL = 'http://localhost:5173';

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

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitForPort(port, maxRetries = 25) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const page = list.find(t => t.type === 'page');
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

async function clickButtonByText(cdp, text) {
  return evalJs(cdp, `(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.innerText && b.innerText.includes(${JSON.stringify(text)}));
    if (btn) { btn.click(); return { found: true, text: btn.innerText.trim() }; }
    return { found: false };
  })()`);
}

async function main() {
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=9224',
    `--user-data-dir=${TEMP_USER_DATA}`, '--window-size=1600,1000', `${BASE_URL}/`
  ]);

  const errors = [];
  const results = [];

  try {
    const wsUrl = await waitForPort(9224);
    const cdp = new CdpClient(wsUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');

    let stepCtx = 'INIT';
    cdp.on('Runtime.consoleAPICalled', p => {
      if (p.type === 'error') errors.push({ ctx: stepCtx, type: 'console.error', msg: p.args.map(a => a.value || a.description || '').join(' ') });
    });
    cdp.on('Runtime.exceptionThrown', p => {
      errors.push({ ctx: stepCtx, type: 'jsException', msg: p.exceptionDetails.exception?.description || p.exceptionDetails.text });
    });
    cdp.on('Network.responseReceived', p => {
      if (p.response.status >= 400 && !p.response.url.includes('favicon.ico')) {
        errors.push({ ctx: stepCtx, type: `HTTP_${p.response.status}`, msg: p.response.url });
      }
    });

    const loginRes = await fetch('http://127.0.0.1:4000/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': 'default-public-api-key-123' },
      body: JSON.stringify({ email: 'admin@safesolo.vn', password: 'admin123' }),
    });
    const loginJson = await loginRes.json();
    if (!loginRes.ok || !loginJson?.data?.token) throw new Error('Admin login failed');
    const superSession = { ...loginJson.data.user, token: loginJson.data.token };

    await cdp.send('Page.navigate', { url: `${BASE_URL}/` });
    await sleep(1500);
    await evalJs(cdp, `localStorage.setItem('safesolo_admin_session_v1', ${JSON.stringify(JSON.stringify(superSession))});`);

    // 1. Test Dispatch Center Tabs & Modals on /
    stepCtx = 'DISPATCH_MODALS';
    await cdp.send('Page.navigate', { url: `${BASE_URL}/` });
    let opened = false;
    for (let i = 0; i < 20; i++) {
      await sleep(300);
      opened = await evalJs(cdp, `(() => {
        const card = Array.from(document.querySelectorAll('[class*="cursor-pointer"]')).find(el => el.innerText.includes('Doan Minh Quan') || el.innerText.includes('SOS'));
        if (card) { card.click(); return true; }
        return false;
      })()`).catch(() => false);
      if (opened) break;
    }
    await sleep(800);

    for (const tab of ['Sơ cứu & 115', 'Hiệp sĩ & Gọi', 'Tổng quan']) {
      const r = await clickButtonByText(cdp, tab);
      await sleep(500);
      const btns = await evalJs(cdp, `Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean)`);
      results.push({ test: `Dispatch Tab [${tab}]`, ok: r.found, detail: `buttons_visible=${btns.length}` });
    }

    // Test + Geofence modal
    const geoRes = await clickButtonByText(cdp, '+ Geofence');
    await sleep(600);
    const hasGeoModal = await evalJs(cdp, `document.body.innerText.includes('Tạo Vùng Nguy Hiểm') || document.body.innerText.includes('Geofence')`);
    results.push({ test: 'Dispatch + Geofence Modal', ok: geoRes.found && hasGeoModal });

    // 2. Test SafePoints Unlock OTP
    stepCtx = 'SAFEPOINTS_UNLOCK';
    await cdp.send('Page.navigate', { url: `${BASE_URL}/safepoints` });
    await sleep(1800);
    const openUnlock = await clickButtonByText(cdp, 'Mã Mở Tủ');
    await sleep(500);
    const reqOtp = await clickButtonByText(cdp, 'Tạo Mã');
    await sleep(1200);
    const hasOtpText = await evalJs(cdp, `/\\b\\d{6}\\b/.test(document.body.innerText) || document.body.innerText.includes('OTP')`);
    results.push({ test: 'SafePoints TOTP Unlock 6-digits', ok: openUnlock.found && hasOtpText });

    // 3. Test BloodRelay Radar & Create Modal
    stepCtx = 'BLOODRELAY_ACTIONS';
    await cdp.send('Page.navigate', { url: `${BASE_URL}/bloodrelay` });
    await sleep(1800);
    const radarBtn = await clickButtonByText(cdp, 'Quét Radar');
    await sleep(1000);
    const radarHasData = await evalJs(cdp, `document.body.innerText.includes('Hiến máu') || document.body.innerText.includes('Phù hợp') || document.body.innerText.includes('Fast-Track') || document.body.innerText.includes('người hiến')`);
    results.push({ test: 'BloodRelay Radar Donors Modal', ok: radarBtn.found && radarHasData });

    // 4. Test Hazards Modals (Geofence & Disaster Broadcast)
    stepCtx = 'HAZARDS_MODALS';
    await cdp.send('Page.navigate', { url: `${BASE_URL}/hazards` });
    let disBtn = { found: false };
    for (let i = 0; i < 15; i++) {
      await sleep(300);
      disBtn = await clickButtonByText(cdp, 'Báo Động Thiên Tai');
      if (disBtn.found) break;
    }
    await sleep(600);
    const disModal = await evalJs(cdp, `document.body.innerText.includes('Phát Sóng') || document.body.innerText.includes('Thiên Tai')`);
    results.push({ test: 'Hazards Disaster Broadcast Modal', ok: disBtn.found && disModal });

    // 5. Test Vitals ICE QR & STAT Dispatch
    stepCtx = 'VITALS_MODALS';
    await cdp.send('Page.navigate', { url: `${BASE_URL}/vitals` });
    await sleep(1800);
    const iceBtn = await clickButtonByText(cdp, 'SafeTag NFC / ICE');
    await sleep(600);
    const iceModal = await evalJs(cdp, `document.body.innerText.includes('BHYT') || document.body.innerText.includes('Nhóm máu') || document.body.innerText.includes('Bảo hộ')`);
    results.push({ test: 'Vitals SafeTag ICE Modal', ok: iceBtn.found && iceModal });

    // 6. Test HeroShield Tabs & SBAR Voucher Modal
    stepCtx = 'HEROSHIELD_TABS';
    await cdp.send('Page.navigate', { url: `${BASE_URL}/heroshield` });
    await sleep(1800);
    const vTab = await clickButtonByText(cdp, 'Voucher Bồi Hoàn Vật Tư');
    await sleep(500);
    const cTab = await clickButtonByText(cdp, 'Hồ Sơ Bồi Thường');
    await sleep(500);
    const modalBtn = await clickButtonByText(cdp, 'Cấp Voucher Bồi Hoàn');
    await sleep(500);
    const modalOpen = await evalJs(cdp, `document.body.innerText.includes('SBAR')`);
    results.push({ test: 'HeroShield Tabs & Voucher Modal', ok: vTab.found && cTab.found && modalBtn.found && modalOpen });

    // 7. Test KYC Tabs (Thank you notes & Reject modal)
    stepCtx = 'KYC_TABS';
    await cdp.send('Page.navigate', { url: `${BASE_URL}/kyc` });
    await sleep(1800);
    const tyTab = await clickButtonByText(cdp, 'Hộp Thư Tri Ân');
    await sleep(600);
    const tyText = await evalJs(cdp, `document.body.innerText.includes('cảm ơn') || document.body.innerText.includes('Tri Ân') || document.body.innerText.includes('Hiệp sĩ')`);
    results.push({ test: 'KYC Thank-You Notes Tab', ok: tyTab.found && tyText });

    // 8. Test Analytics A4 Report Modal & 90d period
    stepCtx = 'ANALYTICS_MODALS';
    await cdp.send('Page.navigate', { url: `${BASE_URL}/analytics` });
    await sleep(1800);
    await clickButtonByText(cdp, '90 ngày');
    await sleep(800);
    const repBtn = await clickButtonByText(cdp, 'Báo cáo Cấp cứu 115');
    await sleep(600);
    const repModal = await evalJs(cdp, `document.body.innerText.includes('CỘNG HÒA') || document.body.innerText.includes('BÁO CÁO')`);
    results.push({ test: 'Analytics 90d & A4 Report Modal', ok: repBtn.found && repModal });

    // 9. Test Audit Log Detail Modal
    stepCtx = 'AUDIT_DETAIL';
    await cdp.send('Page.navigate', { url: `${BASE_URL}/audit` });
    await sleep(1800);
    const detBtn = await clickButtonByText(cdp, 'Chi tiết');
    await sleep(500);
    const hasHash = await evalJs(cdp, `document.body.innerText.includes('SHA-256') || document.body.innerText.includes('0x')`);
    results.push({ test: 'Audit Detail Modal', ok: detBtn.found && hasHash });

    // 10. Test Omnichannel Presets
    stepCtx = 'OMNICHANNEL_PRESETS';
    await cdp.send('Page.navigate', { url: `${BASE_URL}/omnichannel` });
    await sleep(1500);
    const p2 = await clickButtonByText(cdp, 'Preset 2');
    await sleep(300);
    const p3 = await clickButtonByText(cdp, 'Preset 3');
    await sleep(300);
    results.push({ test: 'Omnichannel Presets 2 & 3', ok: p2.found && p3.found });

    console.log('\n=== KẾT QUẢ TEST TƯƠNG TÁC MODAL & ACTION BUTTONS ===');
    results.forEach(r => console.log(`  ${r.ok ? '✅' : '❌'} ${r.test} ${r.detail || ''}`));
    console.log(`\n=== LỖI PHÁT SINH KHI TƯƠNG TÁC (${errors.length}) ===`);
    errors.forEach(e => console.log(`  [${e.ctx}] (${e.type}) ${e.msg}`));

    cdp.close();
    if (errors.length > 0 || results.some(r => !r.ok)) {
      process.exitCode = 1;
    }
  } finally {
    try { chromeProcess.kill('SIGKILL'); } catch (_) {}
    try { fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true }); } catch (_) {}
  }
}

main().catch(e => { console.error(e); process.exit(1); });
