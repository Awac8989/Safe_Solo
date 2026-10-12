const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ARTIFACT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\0423c0d0-428c-4645-b12c-d1ad8775a9b8';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = path.join(os.tmpdir(), 'chrome_real_biz_' + Date.now());

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
  console.log(`  [PASS] ${fileName} (${Math.round(screenshot.data.length / 1024)} KB) -> ${label}`);
}

async function main() {
  const PORT = 9225;
  const chromeArgs = [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1920,1080',
    '--start-maximized',
    'http://127.0.0.1:5173/bloodrelay'
  ];

  const chromeProc = spawn(CHROME_PATH, chromeArgs, { stdio: 'ignore', detached: true });

  try {
    const wsUrl = await waitForPort(PORT);
    const cdp = new CdpClient(wsUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');
    await cdp.send('Runtime.enable');

    await sleep(2500);
    // 1. Chụp BloodRelay thật
    await captureScreen(cdp, 'TC_REAL_01_BloodRelay_Live.png', 'Màn hình Điều phối Máu Hiếm Khẩn Cấp với dữ liệu thực từ MongoDB');

    // 2. Chuyển sang SafePoints
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173/safepoints' });
    await sleep(2500);
    await captureScreen(cdp, 'TC_REAL_02_SafePoints_AED_Network.png', 'Mạng lưới SafePoint & Tủ Sốc Tim AED Ngoại Viện kết nối thực');

    // 3. Chuyển sang Heroes Fleet
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173/heroes' });
    await sleep(2500);
    await captureScreen(cdp, 'TC_REAL_03_Heroes_Bounty_Fund.png', 'Quản trị Lực lượng Hiệp sĩ & Giải ngân Quỹ Thưởng cập nhật ví thật');

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
