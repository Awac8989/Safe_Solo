const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ARTIFACT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\80e30af8-dd29-4f5e-bb89-8a1197db0216';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = path.join(os.tmpdir(), 'chrome_audit_web_' + Date.now());
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
          for (const fn of this.listeners.get(data.method)) {
            fn(data.params);
          }
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

  close() {
    if (this.ws) this.ws.close();
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

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

async function evaluate(cdp, expression) {
  const res = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (res.exceptionDetails) {
    throw new Error('JS Eval Error: ' + JSON.stringify(res.exceptionDetails));
  }
  return res.result ? res.result.value : undefined;
}

async function capture(cdp, fileName) {
  const screenshot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false
  });
  const outPath = path.join(ARTIFACT_DIR, fileName);
  fs.writeFileSync(outPath, Buffer.from(screenshot.data, 'base64'));
  return Math.round(Buffer.from(screenshot.data, 'base64').length / 1024);
}

async function main() {
  console.log('================================================================================');
  console.log('   KIỂM TOÁN & TEST NGHIỆP VỤ TOÀN BỘ WEB ADMIN SAFESOLO (http://localhost:5173)');
  console.log('================================================================================\n');

  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9223',
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--window-size=1600,1000',
    `${BASE_URL}/`
  ]);

  const findings = [];
  const consoleErrors = [];
  const jsExceptions = [];
  const networkFailures = [];
  const httpErrors = [];

  try {
    const wsUrl = await waitForPort(9223);
    const cdp = new CdpClient(wsUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');

    let currentContext = 'INIT';

    cdp.on('Runtime.consoleAPICalled', (params) => {
      if (params.type === 'error') {
        const msg = params.args.map(a => a.value || a.description || '').join(' ');
        consoleErrors.push({ context: currentContext, msg });
      }
    });

    cdp.on('Runtime.exceptionThrown', (params) => {
      const detail = params.exceptionDetails;
      const msg = detail.exception?.description || detail.text || 'Unknown JS exception';
      jsExceptions.push({ context: currentContext, msg });
    });

    const requestUrls = new Map();
    cdp.on('Network.requestWillBeSent', (params) => {
      requestUrls.set(params.requestId, params.request.url);
    });

    cdp.on('Network.responseReceived', (params) => {
      const status = params.response.status;
      if (status >= 400) {
        httpErrors.push({
          context: currentContext,
          status,
          url: params.response.url,
          statusText: params.response.statusText
        });
      }
    });

    cdp.on('Network.loadingFailed', (params) => {
      const url = requestUrls.get(params.requestId) || 'unknown';
      if (!params.canceled) {
        networkFailures.push({
          context: currentContext,
          url,
          errorText: params.errorText
        });
      }
    });

    // =========================================================================
    // KỊCH BẢN 1: ĐĂNG NHẬP & BẢO MẬT RBAC
    // =========================================================================
    currentContext = 'LOGIN_FLOW';
    console.log('▶ [NGHIỆP VỤ 1] Kiểm thử Cổng Đăng Nhập TOC & Xác thực');
    await cdp.send('Page.navigate', { url: `${BASE_URL}/` });
    await sleep(1800);
    await evaluate(cdp, `localStorage.removeItem('safesolo_admin_session_v1');`);
    await cdp.send('Page.reload');
    await sleep(2000);

    const loginHtmlLen = await evaluate(cdp, `document.body.innerText.length`);
    const hasLoginBtn = await evaluate(cdp, `document.body.innerText.includes('ĐĂNG NHẬP HỆ THỐNG') || document.body.innerText.includes('CỔNG ĐIỀU HÀNH KHẨN CẤP')`);
    console.log(`  - Login Screen render: textLen=${loginHtmlLen}, hasLoginUI=${hasLoginBtn}`);
    if (!hasLoginBtn) findings.push('LOGIN: Không hiển thị màn hình đăng nhập khi chưa xác thực');

    // Test đăng nhập sai mật khẩu
    await evaluate(cdp, `(() => {
      const presetBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Tổng Chỉ Huy'));
      if (presetBtn) presetBtn.click();
    })()`);
    await sleep(200);
    // Cố ý sửa password thành sai rồi submit
    await evaluate(cdp, `(() => {
      const pwInput = document.querySelector('input[type="password"]');
      if (pwInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(pwInput, 'wrongpass');
        pwInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const submitBtn = document.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    })()`);
    await sleep(700);
    const wrongPassError = await evaluate(cdp, `document.body.innerText.includes('Mật khẩu ca trực không chính xác')`);
    console.log(`  - Nhập sai mật khẩu có chặn & báo lỗi: ${wrongPassError ? 'OK' : 'CHƯA BÁO LỖI'}`);
    if (!wrongPassError) findings.push('LOGIN: Nhập sai mật khẩu không hiển thị thông báo lỗi');

    const kbLogin = await capture(cdp, 'AUDIT_WEB_01_Login.png');
    console.log(`  - Chụp AUDIT_WEB_01_Login.png (${kbLogin} KB)`);

    // Đăng nhập thật bằng preset Super Admin
    await evaluate(cdp, `(() => {
      const presetBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Tổng Chỉ Huy'));
      if (presetBtn) presetBtn.click();
    })()`);
    await sleep(200);
    await evaluate(cdp, `(() => {
      const submitBtn = document.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    })()`);
    await sleep(1500);
    const isLoggedIn = await evaluate(cdp, `!!localStorage.getItem('safesolo_admin_session_v1')`);
    console.log(`  - Đăng nhập thành công vào TOC Dashboard: ${isLoggedIn ? 'OK' : 'FAILED'}`);
    if (!isLoggedIn) findings.push('LOGIN: Đăng nhập bằng tài khoản preset hợp lệ thất bại');

    // =========================================================================
    // KỊCH BẢN 2: KIỂM TRA TOÀN BỘ 14 ROUTES THEO NGHIỆP VỤ
    // =========================================================================
    const routes = [
      { path: '/', name: 'TOC Điều Phối Trung Tâm', shot: 'AUDIT_WEB_02_Dispatch.png', expectText: 'Điều phối' },
      { path: '/safepoints', name: 'Trạm Cứu Hộ SafePoint & AED', shot: 'AUDIT_WEB_03_SafePoints.png', expectText: 'SafePoint' },
      { path: '/bloodrelay', name: 'Ngân Hàng Máu SafeBlood', shot: 'AUDIT_WEB_04_BloodRelay.png', expectText: 'SafeBlood' },
      { path: '/hazards', name: 'Bản Đồ Hiểm Họa & TimeMark', shot: 'AUDIT_WEB_05_Hazards.png', expectText: 'Hiểm họa' },
      { path: '/vitals', name: 'Sinh Tồn Đa Nạn Nhân', shot: 'AUDIT_WEB_06_Vitals.png', expectText: 'Sinh tồn' },
      { path: '/heroes', name: 'Đội Ngũ Hiệp Sĩ', shot: 'AUDIT_WEB_07_Heroes.png', expectText: 'Hiệp sĩ' },
      { path: '/heroshield', name: 'Lá Chắn Pháp Lý HeroShield', shot: 'AUDIT_WEB_08_HeroShield.png', expectText: 'HeroShield' },
      { path: '/b2b', name: 'Cổng Doanh Nghiệp B2B', shot: 'AUDIT_WEB_09_B2B.png', expectText: 'B2B' },
      { path: '/kyc', name: 'Thẩm Định KYC Hiệp Sĩ', shot: 'AUDIT_WEB_10_KYC.png', expectText: 'Thẩm định' },
      { path: '/analytics', name: 'Phân Tích Dữ Liệu', shot: 'AUDIT_WEB_11_Analytics.png', expectText: 'Phân tích' },
      { path: '/users', name: 'Người Dùng Ứng Dụng', shot: 'AUDIT_WEB_12_Users.png', expectText: 'Người dùng' },
      { path: '/omnichannel', name: 'Kênh Liên Lạc Đa Nền Tảng', shot: 'AUDIT_WEB_13_Omnichannel.png', expectText: 'Kênh' },
      { path: '/revenue', name: 'Doanh Thu & Đối Tác', shot: 'AUDIT_WEB_14_Revenue.png', expectText: 'Doanh thu' },
      { path: '/audit', name: 'Nhật Ký Hệ Thống Audit', shot: 'AUDIT_WEB_15_Audit.png', expectText: 'Nhật ký' },
    ];

    for (const r of routes) {
      currentContext = `ROUTE:${r.path}`;
      console.log(`\n▶ Kiểm tra Route [${r.path}] - ${r.name}`);
      await cdp.send('Page.navigate', { url: `${BASE_URL}${r.path}` });
      await sleep(2200);

      const diag = await evaluate(cdp, `(() => {
        const text = document.body.innerText || '';
        const imgs = Array.from(document.querySelectorAll('img'));
        const brokenImgs = imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.src);
        const horizontalOverflow = document.documentElement.scrollWidth > window.innerWidth + 2;
        return {
          textLen: text.trim().length,
          hasErrorBoundary: text.includes('Hệ thống gặp lỗi'),
          has404: text.includes('Trang bạn tìm không tồn tại'),
          hasNaN: /\\bNaN\\b/.test(text),
          hasUndefined: /\\bundefined\\b/.test(text),
          hasInvalidDate: text.includes('Invalid Date'),
          hasLoadingSpinner: text.includes('Đang tải dữ liệu'),
          brokenImgs,
          imgCount: imgs.length,
          horizontalOverflow,
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          snippet: text.replace(/\\s+/g, ' ').slice(0, 180)
        };
      })()`);

      const kb = await capture(cdp, r.shot);
      console.log(`  - Render: textLen=${diag.textLen}, imgs=${diag.imgCount}, brokenImgs=${diag.brokenImgs.length}, overflowX=${diag.horizontalOverflow} (${diag.scrollWidth}/${diag.innerWidth}), shot=${r.shot} (${kb} KB)`);
      if (diag.hasErrorBoundary) findings.push(`[${r.path}] Bị ErrorBoundary: Hệ thống gặp lỗi!`);
      if (diag.has404) findings.push(`[${r.path}] Trả về trang 404!`);
      if (diag.textLen < 80) findings.push(`[${r.path}] Nội dung quá ít/trống (${diag.textLen} chars)`);
      if (diag.hasNaN) findings.push(`[${r.path}] Hiển thị chữ 'NaN' trên giao diện!`);
      if (diag.hasUndefined) findings.push(`[${r.path}] Hiển thị chữ 'undefined' trên giao diện!`);
      if (diag.hasInvalidDate) findings.push(`[${r.path}] Hiển thị 'Invalid Date' trên giao diện!`);
      if (diag.hasLoadingSpinner) findings.push(`[${r.path}] Vẫn còn kẹt trạng thái 'Đang tải dữ liệu' sau 2.2s!`);
      if (diag.brokenImgs.length > 0) findings.push(`[${r.path}] Có ${diag.brokenImgs.length} ảnh bị lỗi tải (broken img): ${diag.brokenImgs.join(', ')}`);
      if (diag.horizontalOverflow) findings.push(`[${r.path}] Tràn màn hình ngang (${diag.scrollWidth}px > ${diag.innerWidth}px)`);
    }

    // =========================================================================
    // KỊCH BẢN 3: TƯƠNG TÁC NGHIỆP VỤ CHUYÊN SÂU TRÊN TRANG CHỦ ĐIỀU PHỐI (/)
    // =========================================================================
    currentContext = 'INTERACTION:DISPATCH';
    console.log('\n▶ [NGHIỆP VỤ 3] Kiểm thử Tương tác Điều phối Sự cố trên TOC /');
    await cdp.send('Page.navigate', { url: `${BASE_URL}/` });
    await sleep(2200);

    // Click vào sự cố đầu tiên trong danh sách (nếu có)
    const dispatchCheck = await evaluate(cdp, `(() => {
      const incidentCards = Array.from(document.querySelectorAll('[class*="cursor-pointer"]'))
        .filter(el => el.innerText.includes('SOS') || el.innerText.includes('Y tế') || el.innerText.includes('Báo động') || el.innerText.includes('P1'));
      if (incidentCards.length > 0) {
        incidentCards[0].click();
        return { clicked: true, count: incidentCards.length, firstText: incidentCards[0].innerText.slice(0, 100) };
      }
      return { clicked: false, count: 0 };
    })()`);
    console.log('  - Tìm & Click sự cố:', JSON.stringify(dispatchCheck));
    await sleep(1000);

    if (dispatchCheck.clicked) {
      const shotDrawer = await capture(cdp, 'AUDIT_WEB_16_Dispatch_Drawer.png');
      console.log(`  - Chụp AUDIT_WEB_16_Dispatch_Drawer.png (${shotDrawer} KB)`);

      // Thử mở AI Copilot / Dossier / NEWS2
      const modalBtns = await evaluate(cdp, `(() => {
        const btns = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean);
        return btns.slice(0, 30);
      })()`);
      console.log('  - Các nút thao tác đang hiện diện:', modalBtns.join(' | '));
    } else {
      findings.push('[DISPATCH /] Không tìm thấy thẻ sự cố nào để bấm mở chi tiết điều phối!');
    }

    // =========================================================================
    // KỊCH BẢN 4: KIỂM TRA TƯƠNG TÁC NGHIỆP VỤ TRÊN /kyc & /safepoints & /bloodrelay
    // =========================================================================
    currentContext = 'INTERACTION:KYC';
    console.log('\n▶ [NGHIỆP VỤ 4] Kiểm thử Tương tác Thẩm định KYC (/kyc)');
    await cdp.send('Page.navigate', { url: `${BASE_URL}/kyc` });
    await sleep(2000);
    const kycDiag = await evaluate(cdp, `(() => {
      const text = document.body.innerText;
      const imgs = Array.from(document.querySelectorAll('img'));
      return {
        hasApplicants: text.includes('Chờ thẩm định') || text.includes('Đã phê duyệt') || text.includes('Đoàn') || text.includes('Nguyễn'),
        hasApproveBtn: Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Phê duyệt') || b.innerText.includes('Duyệt')),
        hasRejectBtn: Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Từ chối')),
        brokenImgSrcs: imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.src),
        totalImgs: imgs.length
      };
    })()`);
    console.log('  - KYC Diagnostics:', JSON.stringify(kycDiag));
    if (kycDiag.brokenImgSrcs.length > 0) {
      findings.push(`[KYC /kyc] Ảnh CCCD/Selfie bị hỏng (${kycDiag.brokenImgSrcs.length}/${kycDiag.totalImgs}): ${kycDiag.brokenImgSrcs.join(', ')}`);
    }

    // Tổng kết báo cáo
    console.log('\n================================================================================');
    console.log('                        BÁO CÁO PHÁT HIỆN LỖI WEB ADMIN                         ');
    console.log('================================================================================');
    console.log(`1. Lỗi Console (console.error): ${consoleErrors.length}`);
    consoleErrors.forEach(e => console.log(`   [${e.context}] ${e.msg}`));
    console.log(`\n2. JS Exceptions chưa bắt: ${jsExceptions.length}`);
    jsExceptions.forEach(e => console.log(`   [${e.context}] ${e.msg}`));
    console.log(`\n3. Lỗi HTTP API (>= 400): ${httpErrors.length}`);
    httpErrors.forEach(e => console.log(`   [${e.context}] HTTP ${e.status} ${e.url}`));
    console.log(`\n4. Lỗi Network Request Failed: ${networkFailures.length}`);
    networkFailures.forEach(e => console.log(`   [${e.context}] ${e.errorText} -> ${e.url}`));
    console.log(`\n5. Vấn đề Nghiệp vụ & UI Phát hiện: ${findings.length}`);
    findings.forEach(f => console.log(`   - ${f}`));

    // Ghi report JSON để tiện xử lý
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'audit_web_admin_report.json'), JSON.stringify({
      consoleErrors, jsExceptions, httpErrors, networkFailures, findings
    }, null, 2));

    cdp.close();
  } finally {
    try { chromeProcess.kill('SIGKILL'); } catch (_) {}
    try { fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true }); } catch (_) {}
  }
}

main().catch(err => {
  console.error('❌ Audit script fatal error:', err);
  process.exit(1);
});
