const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ARTIFACT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\0423c0d0-428c-4645-b12c-d1ad8775a9b8';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = path.join(os.tmpdir(), 'chrome_cdp_kyc_' + Date.now());

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
  return new Promise((r) => setTimeout(r, ms));
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
  console.log('🚀 Đang khởi động Google Chrome Headless CDP để chụp minh chứng Hero KYC...');
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9223',
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--window-size=1600,1050',
    'http://127.0.0.1:5173/',
  ]);

  try {
    const wsUrl = await waitForPort(9223);
    console.log('✅ Đã kết nối Chrome CDP:', wsUrl);

    const cdp = new CdpClient(wsUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await sleep(2500);

    console.log('🔑 Cấu hình phiên Tổng Chỉ Huy TOC (127.0.0.1)...');
    const sessionUser = {
      id: 'admin_01',
      name: 'Đoàn Minh Quân (Chỉ Huy Trưởng)',
      email: 'admin@safesolo.vn',
      role: 'superadmin',
      roleTitle: 'Tổng Chỉ Huy Hệ Thống (Super Admin)',
      badgeNumber: 'TOC-ADMIN-01',
      shiftStartTime: '08:00',
    };

    await cdp.send('Runtime.evaluate', {
      expression: `localStorage.setItem('safesolo_admin_session_v1', ${JSON.stringify(JSON.stringify(sessionUser))});`,
    });
    await sleep(600);

    console.log('🧭 Điều hướng trực tiếp tới http://127.0.0.1:5173/kyc...');
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173/kyc' });
    await sleep(3500);

    // 1. Chụp ứng viên Y tế / Điều dưỡng (Đỗ Thu Trang)
    console.log('\n--- BƯỚC 1: Thẩm định Bác sĩ / Điều dưỡng (Đỗ Thu Trang) ---');
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const rows = Array.from(document.querySelectorAll('tr'));
          const target = rows.find(r => r.innerText.includes('Đỗ Thu Trang') || r.innerText.includes('Y tế'));
          if (target) target.click();
        })()
      `,
    });
    await sleep(1500);
    await captureScreen(cdp, 'hero_kyc_01_nurse_medic.png', 'Thẩm định Y tá / Paramedic BV Chợ Rẫy (Đủ điều kiện, Mở phê duyệt Tier Paramedic/Medic)');

    // 2. Chụp ứng viên Công an / An ninh (Nguyễn Quốc Bảo)
    console.log('\n--- BƯỚC 2: Thẩm định Công an / CAND (Nguyễn Quốc Bảo) ---');
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const rows = Array.from(document.querySelectorAll('tr'));
          const target = rows.find(r => r.innerText.includes('Nguyễn Quốc Bảo'));
          if (target) target.click();
        })()
      `,
    });
    await sleep(1500);
    await captureScreen(cdp, 'hero_kyc_02_police_security.png', 'Thẩm định Sĩ quan CAND (Đủ điều kiện, Mở phê duyệt Tier Police/Security)');

    // 3. Chụp ứng viên Cứu hỏa / PCCC & CNCH (Lê Văn Tùng)
    console.log('\n--- BƯỚC 3: Thẩm định Cứu hỏa / PCCC (Lê Văn Tùng) ---');
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const rows = Array.from(document.querySelectorAll('tr'));
          const target = rows.find(r => r.innerText.includes('Lê Văn Tùng'));
          if (target) target.click();
        })()
      `,
    });
    await sleep(1500);
    await captureScreen(cdp, 'hero_kyc_03_firefighter_rescue.png', 'Thẩm định Cảnh sát PCCC & CNCH (Đủ điều kiện, Mở phê duyệt Tier Fire/Rescue)');

    // 4. Chụp ứng viên Cứu hộ dã ngoại / Thám hiểm WFR (Trần Hoàng Nam)
    console.log('\n--- BƯỚC 4: Thẩm định Cứu hộ dã ngoại WFR (Trần Hoàng Nam) ---');
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const rows = Array.from(document.querySelectorAll('tr'));
          const target = rows.find(r => r.innerText.includes('Trần Hoàng Nam'));
          if (target) target.click();
        })()
      `,
    });
    await sleep(1500);
    await captureScreen(cdp, 'hero_kyc_04_wilderness_explorer.png', 'Thẩm định Cứu hộ Dã ngoại WFR (Đủ điều kiện, Mở phê duyệt Tier Wilderness Explorer)');

    // 5. Chụp ứng viên Dân sự chưa đạt chuẩn (Nguyễn Văn Minh)
    console.log('\n--- BƯỚC 5: Kiểm tra Cổng kiểm soát nghiêm ngặt đối với Dân sự (Nguyễn Văn Minh) ---');
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const rows = Array.from(document.querySelectorAll('tr'));
          const target = rows.find(r => r.innerText.includes('Nguyễn Văn Minh') || r.innerText.includes('Dân sự'));
          if (target) target.click();
        })()
      `,
    });
    await sleep(1500);
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const scrollables = Array.from(document.querySelectorAll('.overflow-y-auto'));
          if (scrollables.length >= 2) {
            scrollables[1].scrollTop = 450;
          }
        })()
      `,
    });
    await sleep(800);
    await captureScreen(cdp, 'hero_kyc_05_unqualified_civilian_locked.png', 'Cổng an toàn Khóa cứng nút Phê duyệt đối với Dân sự không có chứng chỉ chuyên môn');

    cdp.close();
    console.log('\n🎉 ĐÃ CHỤP THÀNH CÔNG TOÀN BỘ MINH CHỨNG THẨM ĐỊNH HIỆP SĨ!');
  } catch (err) {
    console.error('❌ Lỗi kiểm thử CDP:', err);
  } finally {
    try {
      chromeProcess.kill();
      fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true });
    } catch (_) {}
  }
}

main();
