const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ARTIFACT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\0423c0d0-428c-4645-b12c-d1ad8775a9b8';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = path.join(os.tmpdir(), 'chrome_cdp_profile_' + Date.now());

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
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
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

async function waitForPort(port, maxRetries = 20) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const page = list.find(t => t.type === 'page');
        if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      }
    } catch (_) {}
    await sleep(500);
  }
  throw new Error(`Timeout waiting for Chrome CDP port ${port}`);
}

async function captureScreen(cdp, fileName, label) {
  const screenshot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false
  });
  const outPath = path.join(ARTIFACT_DIR, fileName);
  fs.writeFileSync(outPath, Buffer.from(screenshot.data, 'base64'));
  console.log(`  -> Đã lưu ảnh: ${fileName} (${Math.round(screenshot.data.length / 1024)} KB) - ${label}`);
}

async function main() {
  console.log('🚀 Đang khởi động Google Chrome Headless CDP...');
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9222',
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--window-size=1600,1000',
    'http://127.0.0.1:5173/'
  ]);

  try {
    const wsUrl = await waitForPort(9222);
    console.log('✅ Đã kết nối Chrome CDP:', wsUrl);

    const cdp = new CdpClient(wsUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    console.log('🔑 Đang cấu hình phiên Tổng Chỉ Huy TOC...');
    const sessionUser = {
      id: "admin_01",
      name: "Đoàn Minh Quân (Chỉ Huy Trưởng)",
      email: "admin@safesolo.vn",
      role: "superadmin",
      roleTitle: "Tổng Chỉ Huy Hệ Thống (Super Admin)",
      badgeNumber: "TOC-ADMIN-01",
      shiftStartTime: "08:00"
    };

    await cdp.send('Runtime.evaluate', {
      expression: `localStorage.setItem('safesolo_admin_session_v1', ${JSON.stringify(JSON.stringify(sessionUser))});`
    });

    const routeTests = [
      {
        fileName: 'web_06_safepoints.png',
        url: 'http://127.0.0.1:5173/safepoints',
        title: 'Mạng Lưới SafePoint & Máy Sốc Tim AED'
      },
      {
        fileName: 'web_07_vitals.png',
        url: 'http://127.0.0.1:5173/vitals',
        title: 'Giám Sát Sinh Tồn Đa Nạn Nhân'
      },
      {
        fileName: 'web_08_kyc.png',
        url: 'http://127.0.0.1:5173/kyc',
        title: 'Thẩm Định Hồ Sơ & KYC Hiệp Sĩ CCCD'
      },
      {
        fileName: 'web_09_analytics.png',
        url: 'http://127.0.0.1:5173/analytics',
        title: 'Phân Tích Dữ Liệu & Thời Gian Vàng 4 Phút'
      },
      {
        fileName: 'web_11_audit_immutable.png',
        url: 'http://127.0.0.1:5173/audit',
        title: 'Nhật Ký Hệ Thống & Kiểm Toán Bất Biến SHA-256'
      }
    ];

    for (const test of routeTests) {
      console.log(`\n📸 Đang mở màn hình: ${test.title} (${test.url})...`);
      await cdp.send('Page.navigate', { url: test.url });
      await sleep(2200);
      await captureScreen(cdp, test.fileName, test.title);
    }

    // Kiểm thử tương tác mở Modal Cấp Voucher SBAR trên HeroShield
    console.log(`\n📸 Đang kiểm thử tương tác: Mở Modal Cấp Voucher Bồi Hoàn Vật Tư (SBAR) trên HeroShield...`);
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173/heroshield' });
    await sleep(2000);

    // Click nút Cấp Voucher Bồi Hoàn Vật Tư (SBAR)
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.textContent && b.textContent.includes('Cấp Voucher Bồi Hoàn Vật Tư'));
        if (btn) { btn.click(); return 'CLICKED'; }
        return 'NOT_FOUND';
      })()`
    });
    await sleep(1000);
    await captureScreen(cdp, 'web_10_heroshield_voucher_modal.png', 'Modal Bồi Hoàn Vật Tư SBAR');

    // Kiểm thử mở Modal Báo Cáo Cấp Cứu 115 A4 trên Analytics
    console.log(`\n📸 Đang kiểm thử tương tác: Mở Modal Báo Cáo Cấp Cứu 115 (A4) trên Analytics...`);
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173/analytics' });
    await sleep(2000);
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.textContent && b.textContent.includes('Báo cáo Cấp cứu 115 (A4)'));
        if (btn) { btn.click(); return 'CLICKED'; }
        return 'NOT_FOUND';
      })()`
    });
    await sleep(1000);
    await captureScreen(cdp, 'web_12_analytics_report_a4_modal.png', 'Modal Báo Cáo Cấp Cứu 115 A4');

    cdp.close();
    console.log('\n🎉 Hoàn thành xuất sắc kiểm thử và chụp ảnh toàn bộ các phân hệ Web Admin!');
  } finally {
    try {
      chromeProcess.kill('SIGKILL');
    } catch (_) {}
    try {
      fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true });
    } catch (_) {}
  }
}

main().catch(err => {
  console.error('❌ Lỗi kiểm thử Web Admin:', err);
  process.exit(1);
});
