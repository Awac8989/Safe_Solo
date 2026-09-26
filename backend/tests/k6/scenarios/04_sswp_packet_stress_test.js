import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, COMMON_HEADERS, generateSswpPacket } from '../config.js';

// ============================================================================
// KỊCH BẢN 4: STRESS TEST & BREAKPOINT CAPACITY DISCOVERY
// Mục đích: Ép tải liên tục vượt ngưỡng để tìm điểm bão hòa (Breaking point)
// Tải: Tăng dần từ 200 -> 500 -> 1000 -> 1500 VUs
// ============================================================================

export const options = {
  stages: [
    { duration: '30s', target: 200 },
    { duration: '1m', target: 500 },
    { duration: '1m', target: 1000 },
    { duration: '1m', target: 1500 }, // Điểm ép tải cực hạn
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(90)<300', 'p(95)<500'],
    http_req_failed: ['rate<0.05'], // Cho phép tỷ lệ rớt tối đa 5% khi bị ép nghẽn
  },
};

export default function () {
  const packet = generateSswpPacket('VITALS_UPDATE', __VU * 1000 + __ITER);
  const payload = JSON.stringify(packet);

  const res = http.post(`${BASE_URL}/api/watch/packet`, payload, {
    headers: COMMON_HEADERS,
  });

  check(res, {
    'Stress packet status is 200': (r) => r.status === 200,
    'Server healthy under stress': (r) => r.status < 500,
  });

  sleep(0.5);
}
