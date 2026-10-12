const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ARTIFACT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\0423c0d0-428c-4645-b12c-d1ad8775a9b8';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = path.join(os.tmpdir(), 'chrome_kyc_prof_' + Date.now());

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
  const PORT = 9227;
  const chromeArgs = [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1920,1080',
    '--start-maximized',
    'http://127.0.0.1:5173/kyc'
  ];

  const chromeProc = spawn(CHROME_PATH, chromeArgs, { stdio: 'ignore', detached: true });

  try {
    const wsUrl = await waitForPort(PORT);
    const cdp = new CdpClient(wsUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');
    await cdp.send('Runtime.enable');

    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        try {
          localStorage.setItem("safesolo_admin_session_v1", JSON.stringify({
            token: "admin_token_bypass",
            expiresAt: Date.now() + 86400000,
            user: {
              id: "ADMIN_ROOT",
              fullName: "Trưởng Ban Thẩm Định Pháp Lý & Y Tế",
              role: "SUPER_ADMIN",
              badge: "DISPATCH_LEAD"
            }
          }));
        } catch(e) {}
      `
    });

    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173/kyc' });
    await sleep(2500);
    await captureScreen(cdp, 'hero_kyc_01_professions_list.png', 'Danh sách Hồ sơ Thẩm định Hiệp sĩ 4 Khối ngành (CAND, PCCC, Y tế, WFR)');

    // Click vào thẻ hồ sơ Công an đầu tiên để xem chi tiết
    await cdp.send('Runtime.evaluate', {
      expression: `
        const card = Array.from(document.querySelectorAll('div, tr, button')).find(el => el.textContent && el.textContent.includes('Nguyễn Quốc Bảo'));
        if (card) card.click();
      `
    });
    await sleep(1500);
    await captureScreen(cdp, 'hero_kyc_02_police_detail_modal.png', 'Chi tiết Thẩm định Thẻ ngành Sĩ quan CAND & Khóa Dân sự');

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
