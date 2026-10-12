const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ARTIFACT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\0423c0d0-428c-4645-b12c-d1ad8775a9b8';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = path.join(os.tmpdir(), 'chrome_eco_final_' + Date.now());

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

async function captureScreen(cdp, fileName, label) {
  const screenshot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false
  });
  const outPath = path.join(ARTIFACT_DIR, fileName);
  fs.writeFileSync(outPath, Buffer.from(screenshot.data, 'base64'));
  console.log(`  📸 [CAPTURE] ${fileName} (${Math.round(screenshot.data.length / 1024)} KB) -> ${label}`);
}

async function main() {
  const PORT = 9226;
  const chromeArgs = [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1920,1080',
    '--start-maximized',
    'http://127.0.0.1:5173/safepoints'
  ];

  const chromeProc = spawn(CHROME_PATH, chromeArgs, { stdio: 'ignore', detached: true });

  try {
    const wsUrl = await waitForPort(PORT);
    const cdp = new CdpClient(wsUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');
    await cdp.send('Runtime.enable');

    // Tiêm Session Admin vào LocalStorage trước khi render
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        try {
          localStorage.setItem("safesolo_admin_session_v1", JSON.stringify({
            token: "admin_token_bypass",
            expiresAt: Date.now() + 86400000,
            user: {
              id: "ADMIN_ROOT",
              fullName: "Chỉ Huy Trưởng Điều Phối Cấp Cứu",
              role: "SUPER_ADMIN",
              badge: "DISPATCH_LEAD"
            }
          }));
        } catch(e) {}
      `
    });

    // 1. SafePoints Page
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173/safepoints' });
    await sleep(2500);
    await captureScreen(cdp, 'eco_01_safepoints_aed_overview.png', 'Mạng lưới trạm SafePoint & Tủ máy sốc tim OpenAED');

    // 1b. Click mở modal unlock tủ AED đầu tiên
    await cdp.send('Runtime.evaluate', {
      expression: `
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Mã Mở Tủ'));
        if (btn) btn.click();
      `
    });
    await sleep(1500);
    await captureScreen(cdp, 'eco_02_safepoints_unlock_modal.png', 'Modal phát lệnh mở khóa tủ AED khẩn cấp sinh TOTP');

    // 1c. Click Kích Hoạt Sinh Mã OTP
    const resClick = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Kích Hoạt Sinh Mã OTP'));
          if (btn) {
            btn.click();
            return 'CLICKED_OTP_BTN';
          }
          return 'OTP_BTN_NOT_FOUND: ' + Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).join(' | ');
        })()
      `,
      returnByValue: true
    });
    console.log('  Result click OTP btn:', resClick?.result?.value);
    await sleep(3000);
    await captureScreen(cdp, 'eco_02b_safepoints_otp_active.png', 'Mã TOTP 6 chữ số mở tủ AED khẩn cấp sinh từ hệ thống');

    // 2. BloodRelay Page
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173/bloodrelay' });
    await sleep(2500);
    await captureScreen(cdp, 'eco_03_bloodrelay_active_board.png', 'Bảng điều phối máu khẩn cấp ngoại viện SafeBlood Relay');

    // 2b. Click mở modal tạo yêu cầu điều phối máu
    await cdp.send('Runtime.evaluate', {
      expression: `
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Phát Lệnh') || b.innerText.includes('Tạo Yêu Cầu') || b.innerText.includes('Thêm ca máu'));
        if (btn) btn.click();
      `
    });
    await sleep(1000);
    await captureScreen(cdp, 'eco_04_bloodrelay_create_modal.png', 'Modal kích hoạt điều phối nhóm máu hiếm O- STAT');

    cdp.close();
  } finally {
    try {
      chromeProc.kill();
    } catch (_) {}
    try {
      fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true });
    } catch (_) {}
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
