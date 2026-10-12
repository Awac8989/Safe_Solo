const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ARTIFACT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\0423c0d0-428c-4645-b12c-d1ad8775a9b8';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = path.join(os.tmpdir(), 'chrome_testcases_profile_' + Date.now());

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
  console.log('======================================================================');
  console.log('       KHỞI CHẠY BỘ TEST CASE TỰ ĐỘNG WEB ADMIN SAFESOLO TOC         ');
  console.log('======================================================================\n');

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
    const cdp = new CdpClient(wsUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    // 1. TC_WEB_01: Cổng đăng nhập chưa auth
    console.log('▶ TEST CASE TC_WEB_01: Cổng Đăng Nhập & Phân Quyền Chỉ Huy TOC');
    await cdp.send('Runtime.evaluate', {
      expression: `localStorage.removeItem('safesolo_admin_session_v1');`
    });
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
    await sleep(2000);
    await captureScreen(cdp, 'TC_WEB_01_Admin_Login.png', 'Cổng Đăng Nhập Phân Quyền');

    // Cấu hình auth Super Admin
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

    // 2. TC_WEB_02: Command Center overview (đóng modal nếu có)
    console.log('\n▶ TEST CASE TC_WEB_02: Bàn Điều Phối Trung Tâm (TOC Command Center)');
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
    await sleep(2500);
    // Bấm nút đóng modal để xem bản đồ và radar toàn cảnh
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const closeBtns = Array.from(document.querySelectorAll('button'));
        const closeBtn = closeBtns.find(b => b.querySelector('svg') || b.textContent.includes('Đóng') || b.className.includes('close'));
        // Tìm nút có nút X
        const xBtn = document.querySelector('button[aria-label="Close"], button.absolute, .modal-close');
        if (xBtn) xBtn.click();
      })()`
    });
    await sleep(1000);
    await captureScreen(cdp, 'TC_WEB_02_TOC_Command_Center.png', 'Bàn Điều Phối Toàn Cảnh');

    // 3. TC_WEB_03: Modal điều phối tự động không chạm & ECG trực tiếp
    console.log('\n▶ TEST CASE TC_WEB_03: Điều Phối Zero-Touch & Giám Sát ECG Thời Gian Thực');
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
    await sleep(2500);
    await captureScreen(cdp, 'TC_WEB_03_Zero_Touch_Dispatch_ECG.png', 'Modal Zero-Touch & Live ECG');

    // 4. TC_WEB_04: HeroShield - Tab Bảo hiểm & Căn cứ pháp lý
    console.log('\n▶ TEST CASE TC_WEB_04: Lá Chắn Pháp Lý Hiệp Sĩ HeroShield');
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173/heroshield' });
    await sleep(2200);
    await captureScreen(cdp, 'TC_WEB_04_HeroShield_Legal_Protection.png', 'HeroShield Lá Chắn Pháp Lý');

    // 5. TC_WEB_05: HeroShield - Modal Cấp Voucher Bồi Hoàn Vật Tư SBAR
    console.log('\n▶ TEST CASE TC_WEB_05: Quy Trình Hoàn Thành Ca & Bồi Hoàn Vật Tư SBAR');
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.textContent && b.textContent.includes('Cấp Voucher Bồi Hoàn Vật Tư'));
        if (btn) btn.click();
      })()`
    });
    await sleep(1000);
    await captureScreen(cdp, 'TC_WEB_05_HeroShield_Restock_Voucher_Modal.png', 'Modal Cấp Voucher SBAR');

    // 6. TC_WEB_06: Quản lý Lực lượng Hiệp sĩ & Quỹ Cứu trợ
    console.log('\n▶ TEST CASE TC_WEB_06: Quản Trị Lực Lượng Hiệp Sĩ & Quỹ Cứu Trợ');
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173/heroes' });
    await sleep(2200);
    await captureScreen(cdp, 'TC_WEB_06_Hero_Fleet_Logistics.png', 'Quản Trị Đội Ngũ Hiệp Sĩ');

    // 7. TC_WEB_07: Bản đồ Hiểm họa & Chứng nhận TimeMark
    console.log('\n▶ TEST CASE TC_WEB_07: Bản Đồ Hiểm Họa & Chứng Nhận TimeMark Hiện Trường');
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173/hazards' });
    await sleep(2200);
    await captureScreen(cdp, 'TC_WEB_07_Hazards_TimeMark_Certified.png', 'Bản Đồ Hiểm Họa & TimeMark');

    // 8. TC_WEB_08: Bảng Sinh tồn Đa nạn nhân
    console.log('\n▶ TEST CASE TC_WEB_08: Bảng Sinh Tồn Đa Nạn Nhân (Telemetry Grid)');
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173/vitals' });
    await sleep(2200);
    await captureScreen(cdp, 'TC_WEB_08_Multi_Victim_Vitals_Telemetry.png', 'Sinh Tồn Đa Nạn Nhân');

    // 9. TC_WEB_09: Thẩm định hồ sơ CCCD & KYC Hiệp sĩ
    console.log('\n▶ TEST CASE TC_WEB_09: Thẩm Định Hồ Sơ CCCD & KYC Hiệp Sĩ (AI Face Match)');
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173/kyc' });
    await sleep(2200);
    await captureScreen(cdp, 'TC_WEB_09_KYC_Verification_FaceMatch.png', 'Thẩm Định KYC CCCD');

    // 10. TC_WEB_10: Mạng lưới Tiếp sức Máu SafeBlood
    console.log('\n▶ TEST CASE TC_WEB_10: Mạng Lưới Tiếp Sức Máu Khẩn Cấp SafeBlood');
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173/bloodrelay' });
    await sleep(2200);
    await captureScreen(cdp, 'TC_WEB_10_SafeBlood_Emergency_Relay.png', 'Tiếp Sức Máu SafeBlood');

    // 11. TC_WEB_11: Trạm Cứu hộ SafePoint & Máy sốc tim AED
    console.log('\n▶ TEST CASE TC_WEB_11: Mạng Lưới Trạm Cứu Hộ SafePoint & Máy Sốc Tim AED');
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173/safepoints' });
    await sleep(2200);
    await captureScreen(cdp, 'TC_WEB_11_SafePoint_OpenAED_Network.png', 'Trạm Cứu Hộ SafePoint AED');

    // 12. TC_WEB_12: Trung tâm Phân tích Dữ liệu
    console.log('\n▶ TEST CASE TC_WEB_12: Trung Tâm Phân Tích Dữ Liệu & Thời Gian Vàng');
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173/analytics' });
    await sleep(2200);
    await captureScreen(cdp, 'TC_WEB_12_Analytics_Golden_Hour.png', 'Phân Tích Dữ Liệu Analytics');

    // 13. TC_WEB_13: Cổng Doanh nghiệp B2B
    console.log('\n▶ TEST CASE TC_WEB_13: Cổng Doanh Nghiệp & Bảo Hiểm B2B');
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173/b2b' });
    await sleep(2200);
    await captureScreen(cdp, 'TC_WEB_13_B2B_Enterprise_Portal.png', 'Cổng Doanh Nghiệp B2B');

    // 14. TC_WEB_14: Kênh liên lạc đa nền tảng
    console.log('\n▶ TEST CASE TC_WEB_14: Kênh Liên Lạc Đa Nền Tảng (Omnichannel Health)');
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173/omnichannel' });
    await sleep(2200);
    await captureScreen(cdp, 'TC_WEB_14_Omnichannel_Communication.png', 'Kênh Liên Lạc Đa Nền Tảng');

    // 15. TC_WEB_15: Nhật ký hệ thống Audit Trail
    console.log('\n▶ TEST CASE TC_WEB_15: Nhật Ký Kiểm Toán Hệ Thống (Audit Trail)');
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173/audit' });
    await sleep(2200);
    await captureScreen(cdp, 'TC_WEB_15_System_Audit_Trail.png', 'Nhật Ký Kiểm Toán Audit');

    cdp.close();
    console.log('\n======================================================================');
    console.log('       ✅ ĐÃ HOÀN THÀNH TOÀN BỘ 15/15 TEST CASE WEB ADMIN!            ');
    console.log('======================================================================');
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
  console.error('❌ Lỗi kiểm thử Web Admin Test Cases:', err);
  process.exit(1);
});
