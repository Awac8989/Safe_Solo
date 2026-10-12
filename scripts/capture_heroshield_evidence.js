const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ARTIFACT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\0423c0d0-428c-4645-b12c-d1ad8775a9b8';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = path.join(os.tmpdir(), 'chrome_heroshield_' + Date.now());

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    const WebSocket = require('c:/Users/Admin/SafeSolo/backend/node_modules/ws');
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.on('open', () => resolve());
      this.ws.on('error', reject);
      this.ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.id && this.callbacks.has(msg.id)) {
          const { res, rej } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) rej(msg.error);
          else res(msg.result);
        }
      });
    });
  }

  send(method, params = {}) {
    return new Promise((res, rej) => {
      const id = this.id++;
      this.callbacks.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

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
    await sleep(500);
  }
  throw new Error(`Timeout waiting for Chrome CDP port ${port}`);
}

async function captureScreen(cdp, fileName, label) {
  const screenshot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  const outPath = path.join(ARTIFACT_DIR, fileName);
  fs.writeFileSync(outPath, Buffer.from(screenshot.data, 'base64'));
  console.log(`  📸 Đã lưu ảnh: ${fileName} (${Math.round(screenshot.data.length / 1024)} KB) - ${label}`);
}

async function main() {
  console.log('🚀 Đang khởi động Google Chrome Headless CDP để chụp minh chứng HeroShield...');
  const port = 9229;
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--window-size=1600,1050',
    'http://localhost:5173/',
  ]);

  try {
    const wsUrl = await waitForPort(port);
    console.log('✅ Đã kết nối Chrome CDP:', wsUrl);

    const cdp = new CdpClient(wsUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    const adminSession = {
      id: "admin_01",
      name: "Đoàn Minh Quân (Chỉ Huy Trưởng)",
      email: "admin@safesolo.vn",
      role: "superadmin",
      roleTitle: "Tổng Chỉ Huy Hệ Thống (Super Admin)",
      badgeNumber: "TOC-ADMIN-01",
      shiftStartTime: "08:00"
    };

    // Tiêm localStorage trước khi bất kỳ script nào chạy
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        try {
          localStorage.setItem('safesolo_admin_session_v1', JSON.stringify(${JSON.stringify(adminSession)}));
          localStorage.setItem('safesolo_admin_token', 'jwt-mock-super-admin-token-2026');
          localStorage.setItem('safesolo_admin_user', JSON.stringify(${JSON.stringify(adminSession)}));
        } catch(e) {}
      `,
    });

    console.log('\n📄 1. Điều hướng tới Bàn Quản Trị HeroShield (/heroshield)...');
    await cdp.send('Page.navigate', { url: 'http://localhost:5173/heroshield' });
    await sleep(3500);

    // Ảnh 1: Tab 1 - Policies
    await captureScreen(cdp, 'heroshield_01_policies.png', 'Chứng thư bảo hiểm Good Samaritan ngoại viện');
    await sleep(1000);

    // Ảnh 2: Tab 2 - Restock Vouchers (dùng ID tab-vouchers)
    console.log('\n🎟️ 2. Chuyển sang Tab Voucher Bồi Hoàn Vật Tư Sơ Cứu...');
    await cdp.send('Runtime.evaluate', {
      expression: `document.getElementById('tab-vouchers')?.click();`,
    });
    await sleep(1500);
    await captureScreen(cdp, 'heroshield_02_vouchers.png', 'Voucher bồi hoàn vật tư sơ cứu FPT Long Châu');
    await sleep(1000);

    // Ảnh 3: Tab 3 - Claims & PEP Exposure (dùng ID tab-claims)
    console.log('\n🛡️ 3. Chuyển sang Tab Hồ Sơ Bồi Thường & Quỹ Phơi Nhiễm PEP...');
    await cdp.send('Runtime.evaluate', {
      expression: `document.getElementById('tab-claims')?.click();`,
    });
    await sleep(1500);
    await captureScreen(cdp, 'heroshield_03_claims_pep.png', 'Hồ sơ yêu cầu bồi hoàn thuốc phơi nhiễm PEP 72h');
    await sleep(1000);

    // Ảnh 4: Modal Thẩm Định & Chi Trả Payout (dùng ID btn-settle-claim-0)
    console.log('\n💰 4. Mở Modal Thẩm Định & Duyệt Chi Trả Bồi Thường...');
    await cdp.send('Runtime.evaluate', {
      expression: `document.getElementById('btn-settle-claim-0')?.click();`,
    });
    await sleep(1500);
    await captureScreen(cdp, 'heroshield_04_settle_modal.png', 'Modal Thẩm định và Chi trả 1.500.000đ vào ví Hiệp Sĩ');

    // Đóng modal chi trả
    await cdp.send('Runtime.evaluate', {
      expression: `
        const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('Hủy bỏ'));
        if (cancelBtn) cancelBtn.click();
      `,
    });
    await sleep(1000);

    // Ảnh 5: Modal Cấp Voucher SBAR (dùng ID btn-open-sbar-modal)
    console.log('\n🎁 5. Mở Modal Cấp Voucher Bồi Hoàn SBAR...');
    await cdp.send('Runtime.evaluate', {
      expression: `document.getElementById('btn-open-sbar-modal')?.click();`,
    });
    await sleep(1500);
    await captureScreen(cdp, 'heroshield_05_issue_voucher_modal.png', 'Modal Cấp Voucher SBAR từ Recommendation ca cứu hộ');

    cdp.close();
    console.log('\n✨ ĐÃ HOÀN TẤT BẮT GIỮ TẤT CẢ 5 ẢNH MINH CHỨNG!');
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
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
