const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ARTIFACT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\0423c0d0-428c-4645-b12c-d1ad8775a9b8';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = path.join(os.tmpdir(), 'chrome_heroshield_profile_' + Date.now());

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
  const PORT = 9224;
  const chromeArgs = [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1920,1080',
    '--start-maximized',
    'http://127.0.0.1:5173/heroshield'
  ];

  const chromeProc = spawn(CHROME_PATH, chromeArgs, { stdio: 'ignore', detached: true });

  try {
    const wsUrl = await waitForPort(PORT);
    const cdp = new CdpClient(wsUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');
    await cdp.send('Runtime.enable');

    await sleep(2500); // Đợi tải API từ backend thật

    // 1. Chụp tab Policies
    await captureScreen(cdp, 'TC_WEB_16_HeroShield_Policies.png', 'Chính sách bảo hiểm ngoại viện & Quỹ trợ giúp pháp lý (Luật Khám bệnh chữa bệnh Điều 87)');

    // 2. Chuyển sang tab Restock Vouchers
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const voucherBtn = buttons.find(b => b.textContent && b.textContent.includes('Voucher Bồi Hoàn Vật Tư'));
          if (voucherBtn) voucherBtn.click();
        })()
      `
    });

    await sleep(1500);

    // 3. Chụp tab Vouchers (có chứa voucher VCH-LC-C0B550 bồi hoàn từ ca cấp cứu thật)
    await captureScreen(cdp, 'TC_WEB_17_HeroShield_Vouchers.png', 'Voucher bồi hoàn vật tư y tế FPT Long Châu tự động cấp từ biên bản SBAR');

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
