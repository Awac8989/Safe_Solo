const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ARTIFACT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\80e30af8-dd29-4f5e-bb89-8a1197db0216';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = path.join(os.tmpdir(), 'chrome_verify_8_fixes_' + Date.now());
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

async function capture(cdp, fileName) {
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const outPath = path.join(ARTIFACT_DIR, fileName);
  fs.writeFileSync(outPath, Buffer.from(screenshot.data, 'base64'));
  return Math.round(Buffer.from(screenshot.data, 'base64').length / 1024);
}

async function main() {
  console.log('================================================================================');
  console.log('   KIỂM THỬ XÁC MINH SAU SỬA LỖI TOÀN BỘ WEB ADMIN & BACKEND SAFESOLO          ');
  console.log('================================================================================\n');

  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=9226',
    `--user-data-dir=${TEMP_USER_DATA}`, '--window-size=1600,1000', `${BASE_URL}/`
  ]);

  const assertions = [];
  const assertCheck = (name, ok, detail = '') => {
    assertions.push({ name, ok, detail });
    console.log(`  ${ok ? '✅ [PASS]' : '❌ [FAIL]'} ${name}${detail ? ` — ${detail}` : ''}`);
  };

  const consoleErrors = [];
  const jsExceptions = [];
  const httpErrors = [];
  const networkFailures = [];
  const requestUrls = new Map();

  try {
    const wsUrl = await waitForPort(9226);
    const cdp = new CdpClient(wsUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');

    let ctx = 'INIT';
    cdp.on('Runtime.consoleAPICalled', p => {
      if (p.type === 'error') consoleErrors.push({ ctx, msg: p.args.map(a => a.value || a.description || '').join(' ') });
    });
    cdp.on('Runtime.exceptionThrown', p => {
      jsExceptions.push({ ctx, msg: p.exceptionDetails.exception?.description || p.exceptionDetails.text });
    });
    cdp.on('Network.requestWillBeSent', p => requestUrls.set(p.requestId, p.request.url));
    cdp.on('Network.responseReceived', p => {
      if (p.response.status >= 400) {
        httpErrors.push({ ctx, status: p.response.status, url: p.response.url });
      }
    });
    cdp.on('Network.loadingFailed', p => {
      if (!p.canceled) networkFailures.push({ ctx, url: requestUrls.get(p.requestId) || 'unknown', err: p.errorText });
    });

    // Helper đăng nhập JWT thật từ Backend (không dùng session giả)
    const loginSession = async (email, password) => {
      const r = await fetch('http://127.0.0.1:4000/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'default-public-api-key-123' },
        body: JSON.stringify({ email, password }),
      });
      const j = await r.json();
      if (!r.ok || !j?.data?.token) throw new Error(`Admin login failed for ${email}: ${JSON.stringify(j)}`);
      return { ...j.data.user, token: j.data.token };
    };

    // 1. Kiểm tra RBAC với tài khoản Moderator trước (JWT thật)
    ctx = 'RBAC_MODERATOR';
    console.log('▶ [KIỂM TRA 1] Phân quyền RBAC tài khoản Moderator KYC & Topbar đồng bộ');
    const modSession = await loginSession('moderator@safesolo.vn', 'mod123');
    await cdp.send('Page.navigate', { url: `${BASE_URL}/` });
    await sleep(1500);
    await evalJs(cdp, `localStorage.setItem('safesolo_admin_session_v1', ${JSON.stringify(JSON.stringify(modSession))});`);
    await cdp.send('Page.navigate', { url: `${BASE_URL}/revenue` });
    await sleep(1800);
    const rbacBlocked = await evalJs(cdp, `document.body.innerText.includes('PHÂN QUYỀN RBAC') && document.body.innerText.includes('Lê Thị Mai')`);
    assertCheck('RBAC chặn Moderator vào /revenue & Topbar đồng bộ tên Lê Thị Mai', rbacBlocked);

    // 2. Đăng nhập Super Admin (Đoàn Minh Quân - JWT thật)
    ctx = 'SUPERADMIN_LOGIN';
    console.log('\n▶ [KIỂM TRA 2] Chuyển sang Super Admin & Kiểm tra Topbar Search / Bell');
    const superSession = await loginSession('admin@safesolo.vn', 'admin123');
    await evalJs(cdp, `localStorage.setItem('safesolo_admin_session_v1', ${JSON.stringify(JSON.stringify(superSession))});`);
    await cdp.send('Page.navigate', { url: `${BASE_URL}/` });
    await sleep(2200);

    const topbarNameOk = await evalJs(cdp, `document.querySelector('header')?.innerText.includes('Đoàn Minh Quân') && document.querySelector('header')?.innerText.includes('TOC-ADMIN-01')`);
    assertCheck('Topbar hiển thị đúng tên & mã hiệu của người đang trực', topbarNameOk);

    // Test Quick Search on Topbar
    await evalJs(cdp, `(() => {
      const inp = document.querySelector('header input');
      if (inp) {
        inp.focus();
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(inp, 'SafeBlood');
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()`);
    await sleep(400);
    const searchDropdownOk = await evalJs(cdp, `document.body.innerText.includes('/bloodrelay')`);
    assertCheck('Topbar Search gợi ý nhanh đường dẫn /bloodrelay', searchDropdownOk);

    // Test Bell Dropdown
    await evalJs(cdp, `(() => {
      const bell = document.querySelector('button[aria-label="Cảnh báo khẩn cấp"]');
      if (bell) bell.click();
    })()`);
    await sleep(400);
    const bellPopupOk = await evalJs(cdp, `document.body.innerText.includes('Mở Bàn Điều Phối TOC')`);
    assertCheck('Topbar Chuông mở Dropdown Cảnh báo khẩn cấp', bellPopupOk);
    await evalJs(cdp, `(() => { const bell = document.querySelector('button[aria-label="Cảnh báo khẩn cấp"]'); if (bell) bell.click(); })()`);

    // 3. Kiểm tra Trang / + Hồ sơ ICE + 4 Modal chuyên sâu
    ctx = 'DISPATCH_MODALS';
    console.log('\n▶ [KIỂM TRA 3] Điều phối /, Hồ sơ ICE, bỏ hardcode vi địa chỉ & 4 Modal chuyên sâu');
    await evalJs(cdp, `(() => {
      const card = Array.from(document.querySelectorAll('[class*="cursor-pointer"]')).find(el => el.innerText.includes('Doan Minh Quan') || el.innerText.includes('SOS'));
      if (card) card.click();
    })()`);
    await sleep(800);

    const iceCheck = await evalJs(cdp, `(() => {
      const t = document.body.innerText;
      return {
        hasBloodGroup: !t.includes('Nhóm máu\\nN/A') && (t.includes('O+') || t.includes('A+') || t.includes('B+') || t.includes('O-')),
        noHardcodedRoom: !t.includes('Khu tập thể 420 cũ'),
        hasNews2Btn: Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('NEWS2')),
        hasAiBtn: Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('AI Copilot'))
      };
    })()`);
    assertCheck('Hồ sơ I.C.E có Nhóm máu thật từ MedicalProfile (không N/A)', iceCheck.hasBloodGroup);
    assertCheck('Đã xóa bỏ vi địa chỉ hardcode "Khu tập thể 420 cũ"', iceCheck.noHardcodedRoom);
    assertCheck('Đã có nút mở NEWS2 & AI Copilot trên Drawer', iceCheck.hasNews2Btn && iceCheck.hasAiBtn);

    // Bấm mở NEWS2 Modal
    await evalJs(cdp, `(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.innerText.includes('Phân loại NEWS2')); if(b) b.click(); })()`);
    await sleep(600);
    const news2Visible = await evalJs(cdp, `document.body.innerText.includes('NEWS2') && document.body.innerText.includes('ÁP DỤNG') || document.body.innerText.includes('Nhịp thở')`);
    assertCheck('Modal Phân loại Y tế NEWS2 mở thành công & render đầy đủ', news2Visible);
    const shotNews2 = await capture(cdp, 'FIXED_WEB_01_NEWS2_Modal.png');
    await evalJs(cdp, `(() => { const x = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Đóng') || b.querySelector('svg.lucide-x')); if(x) x.click(); })()`);
    await sleep(300);

    // Bấm mở AI Copilot Drawer
    await evalJs(cdp, `(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.innerText.includes('Trợ lý AI Copilot')); if(b) b.click(); })()`);
    await sleep(1000);
    const aiVisible = await evalJs(cdp, `document.body.innerText.includes('TRỢ LÝ AI COPILOT')`);
    assertCheck('Modal AI Copilot & SOP mở & tải briefing thành công', aiVisible);
    await capture(cdp, 'FIXED_WEB_02_AI_Copilot.png');
    await evalJs(cdp, `(() => { const x = document.querySelector('button[aria-label="Đóng"]'); if(x) x.click(); })()`);
    await sleep(300);

    // Chuyển Tab Sơ cứu & 115 -> Mở Modal Điều xe 115
    await evalJs(cdp, `(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.innerText.includes('Sơ cứu & 115')); if(b) b.click(); })()`);
    await sleep(400);
    await evalJs(cdp, `(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.innerText.includes('Điều 115')); if(b) b.click(); })()`);
    await sleep(400);
    const ambVisible = await evalJs(cdp, `document.body.innerText.includes('Lệnh Điều Xe Cấp Cứu 115')`);
    assertCheck('Modal Điều phối Xe 115 (Tier 3 Gate) mở thành công', ambVisible);
    await evalJs(cdp, `(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.innerText === 'Đóng'); if(b) b.click(); })()`);

    // 4. Kiểm tra /hazards (Ảnh TimeMark không bị ERR_BLOCKED_BY_RESPONSE)
    ctx = 'HAZARDS_IMAGES';
    console.log('\n▶ [KIỂM TRA 4] Bản đồ Hiểm họa /hazards & Ảnh TimeMark');
    await cdp.send('Page.navigate', { url: `${BASE_URL}/hazards` });
    await sleep(2200);
    const hazardsImg = await evalJs(cdp, `(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return { total: imgs.length, loaded: imgs.filter(i => i.complete && i.naturalWidth > 0).length };
    })()`);
    assertCheck(`Ảnh TimeMark tải thành công không bị Helmet chặn`, hazardsImg.total > 0 && hazardsImg.loaded === hazardsImg.total, `${hazardsImg.loaded}/${hazardsImg.total} ảnh loaded`);
    await capture(cdp, 'FIXED_WEB_03_Hazards_Images.png');

    // 5. Kiểm tra /kyc (Thẻ SVG CCCD & Chứng chỉ hiển thị đầy đủ)
    ctx = 'KYC_IMAGES';
    console.log('\n▶ [KIỂM TRA 5] Thẩm định KYC /kyc & Thẻ CCCD / Chứng chỉ SVG');
    await cdp.send('Page.navigate', { url: `${BASE_URL}/kyc` });
    await sleep(2200);
    const kycImg = await evalJs(cdp, `(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return { total: imgs.length, loaded: imgs.filter(i => i.complete && i.naturalWidth > 0).length };
    })()`);
    assertCheck('Ảnh Chân dung, CCCD 2 mặt & Chứng chỉ ngành tại /kyc hiển thị đầy đủ', kycImg.total >= 3 && kycImg.loaded === kycImg.total, `${kycImg.loaded}/${kycImg.total} ảnh loaded`);
    await capture(cdp, 'FIXED_WEB_04_KYC_Cards.png');

    // 6. Kiểm tra /analytics (Không cắt chữ, số liệu đồng bộ)
    ctx = 'ANALYTICS_DATA';
    console.log('\n▶ [KIỂM TRA 6] Phân tích Dữ liệu /analytics & Đồng bộ KPI');
    await cdp.send('Page.navigate', { url: `${BASE_URL}/analytics` });
    await sleep(2200);
    const analyticsCheck = await evalJs(cdp, `(() => {
      const t = document.body.innerText;
      const cards = Array.from(document.querySelectorAll('p.truncate'));
      const truncated = cards.filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.innerText);
      return { text: t.slice(0, 500), truncated, hasCheckinChart: t.includes('Xu hướng điểm danh') };
    })()`);
    assertCheck('8 thẻ KPI trên /analytics hiển thị đầy đủ nhãn (không cắt dấu ...)', analyticsCheck.truncated.length === 0, `truncated=${JSON.stringify(analyticsCheck.truncated)}`);
    await capture(cdp, 'FIXED_WEB_05_Analytics.png');

    // 7. Kiểm tra /vitals (Sinh hiệu đa dạng & không có Unknown User)
    ctx = 'VITALS_DATA';
    console.log('\n▶ [KIỂM TRA 7] Sinh tồn Đa nạn nhân /vitals');
    await cdp.send('Page.navigate', { url: `${BASE_URL}/vitals` });
    let vitalsCheck = { noUnknown: true, count: 0, uniqueCount: 0 };
    for (let attempt = 0; attempt < 20; attempt++) {
      await sleep(500);
      vitalsCheck = await evalJs(cdp, `(() => {
        const t = document.body.innerText;
        const loading = t.includes('Đang kết nối tín hiệu sinh tồn');
        const noUnknown = !t.includes('Unknown User');
        const bpmMatches = Array.from(t.matchAll(/(\\d+)\\s*BPM/g)).map(m => m[1]);
        const uniqueBpm = new Set(bpmMatches);
        return { loading, noUnknown, count: bpmMatches.length, uniqueCount: uniqueBpm.size };
      })()`);
      if (!vitalsCheck.loading && vitalsCheck.count > 1) break;
    }
    assertCheck('/vitals không còn Unknown User & có chỉ số sinh hiệu riêng biệt', vitalsCheck.noUnknown && vitalsCheck.uniqueCount > 1, `unique BPM=${vitalsCheck.uniqueCount}/${vitalsCheck.count}`);
    await capture(cdp, 'FIXED_WEB_06_Vitals.png');

    // 8. Kiểm tra /safepoints (Test IoT API thật)
    ctx = 'SAFEPOINTS_IOT';
    console.log('\n▶ [KIỂM TRA 8] Trạm SafePoint & API Kiểm tra Cảm biến / Còi 110dB');
    await cdp.send('Page.navigate', { url: `${BASE_URL}/safepoints` });
    await sleep(2000);
    await evalJs(cdp, `(() => { const b = document.querySelector('button[title="Kiểm tra cảm biến cửa"]'); if(b) b.click(); })()`);
    await sleep(1000);
    const iotNotice = await evalJs(cdp, `document.body.innerText.includes('độ trễ 18ms')`);
    assertCheck('Nút Kiểm tra cảm biến cửa trên /safepoints gọi API Backend thành công', iotNotice);
    await capture(cdp, 'FIXED_WEB_07_SafePoints.png');

    // 9. Kiểm tra /users, /heroshield, /bloodrelay
    ctx = 'DATA_NORMALIZATION';
    console.log('\n▶ [KIỂM TRA 9] Dữ liệu thực tế /users, /heroshield, /bloodrelay');
    await cdp.send('Page.navigate', { url: `${BASE_URL}/users` });
    await sleep(1800);
    const usersHasSafe = await evalJs(cdp, `/an\\s+toàn/i.test(document.body.innerText) || document.body.innerText.includes('ĐANG AN TOÀN')`);
    assertCheck('/users hiển thị phân bổ trạng thái An toàn thực tế (không đỏ 100%)', usersHasSafe);
    await capture(cdp, 'FIXED_WEB_08_Users.png');

    await cdp.send('Page.navigate', { url: `${BASE_URL}/heroshield` });
    await sleep(1800);
    const shieldHasActive = await evalJs(cdp, `document.body.innerText.includes('ACTIVE') && document.body.innerText.includes('ca phơi nhiễm PEP')`);
    assertCheck('/heroshield hiển thị chứng thư ACTIVE & chuẩn hóa nhãn quỹ PEP', shieldHasActive);
    await capture(cdp, 'FIXED_WEB_09_HeroShield.png');

    await cdp.send('Page.navigate', { url: `${BASE_URL}/bloodrelay` });
    await sleep(1800);
    const bloodFulfilled = await evalJs(cdp, `document.body.innerText.includes('DELIVERED_AND_FULFILLED')`);
    assertCheck('/bloodrelay có đủ luồng nghiệp vụ tới hoàn tất DELIVERED_AND_FULFILLED', bloodFulfilled);
    await capture(cdp, 'FIXED_WEB_10_BloodRelay.png');

    // Tổng kết Network & Console
    console.log('\n================================================================================');
    console.log('                       TỔNG KẾT XÁC MINH SAU SỬA LỖI                            ');
    console.log('================================================================================');
    const passed = assertions.filter(a => a.ok).length;
    console.log(`Assertions Passed: ${passed}/${assertions.length}`);
    console.log(`Console Errors: ${consoleErrors.length}`);
    consoleErrors.forEach(e => console.log('  [ConsoleErr]', e.ctx, e.msg));
    console.log(`JS Exceptions: ${jsExceptions.length}`);
    jsExceptions.forEach(e => console.log('  [JSExc]', e.ctx, e.msg));
    console.log(`HTTP Errors (>=400): ${httpErrors.length}`);
    httpErrors.forEach(e => console.log('  [HTTP]', e.ctx, e.status, e.url));
    console.log(`Network Failures: ${networkFailures.length}`);
    networkFailures.forEach(e => console.log('  [NetFail]', e.ctx, e.err, e.url));

    cdp.close();
    if (passed < assertions.length || httpErrors.length > 0 || networkFailures.length > 0 || jsExceptions.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    try { chromeProcess.kill('SIGKILL'); } catch (_) {}
    try { fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true }); } catch (_) {}
  }
}

main().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
