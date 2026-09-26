import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, COMMON_HEADERS, generateSmartwatchTelemetry, generateSswpPacket } from '../config.js';

// ============================================================================
// KỊCH BẢN 5: COMPOSITE SOAK & ENDURANCE TEST
// Mục đích: Kiểm thử độ bền dài hạn, phát hiện rò rỉ bộ nhớ (Memory Leak)
// và nghẽn hàng đợi Event Loop khi duy trì tải đa dạng trong thời gian dài
// ============================================================================

export const options = {
  stages: [
    { duration: '1m', target: 100 },   // Khởi động
    { duration: '30m', target: 100 },  // Duy trì tải liên tục 100 VUs trong 30 phút
    { duration: '1m', target: 0 },     // Kết thúc
  ],
  thresholds: {
    http_req_duration: ['avg<120', 'p(95)<250'],
    http_req_failed: ['rate<0.005'],
  },
};

export default function () {
  const vuId = __VU;
  const iter = __ITER;

  // 1. Phân bổ lưu lượng hỗn hợp (Traffic mix)
  const roll = Math.random();

  if (roll < 0.6) {
    // 60% Lưu lượng: Đẩy thông số sinh tồn định kỳ
    const telemetry = generateSmartwatchTelemetry(vuId * 100 + iter);
    const res = http.post(`${BASE_URL}/api/watch/vitals`, JSON.stringify(telemetry), {
      headers: COMMON_HEADERS,
    });
    check(res, { 'Vitals status is 200': (r) => r.status === 200 });
  } else if (roll < 0.85) {
    // 25% Lưu lượng: Gửi gói tin SSWP (Cảnh báo & Đồng bộ)
    const packet = generateSswpPacket('VITALS_UPDATE', vuId * 100 + iter);
    const res = http.post(`${BASE_URL}/api/watch/packet`, JSON.stringify(packet), {
      headers: COMMON_HEADERS,
    });
    check(res, { 'SSWP status is 200': (r) => r.status === 200 });
  } else {
    // 15% Lưu lượng: Tra cứu trạng thái ghép nối hoặc Health Check
    const res = http.get(`${BASE_URL}/api/watch/pair/status/watch_galaxy_5`, {
      headers: COMMON_HEADERS,
    });
    check(res, { 'Pair status responded': (r) => r.status === 200 });
  }

  sleep(1.0 + Math.random() * 0.5);
}
