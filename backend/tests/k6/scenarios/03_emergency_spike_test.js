import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, COMMON_HEADERS, generateSswpPacket } from '../config.js';

// ============================================================================
// KỊCH BẢN 3: EMERGENCY SOS SPIKE TEST
// Mục đích: Đo lường độ trễ khi có sự cố thảm họa hàng loạt (Spike từ 20 -> 1000 VUs)
// Đẩy các gói tin FALL_DETECTED và HARDWARE_SOS cần phát tán Socket.IO tức thì
// ============================================================================

export const options = {
  stages: [
    { duration: '20s', target: 20 },    // Mức tải nền bình thường (20 VUs)
    { duration: '10s', target: 1000 },  // BÙNG NỔ TẢI CẤP TỐC: Vọt lên 1.000 VUs trong 10 giây
    { duration: '1m', target: 1000 },   // Duy trì đỉnh bùng nổ 1 phút
    { duration: '20s', target: 20 },    // Hạ nhiệt nhanh
    { duration: '10s', target: 0 },     // Kết thúc
  ],
  thresholds: {
    http_req_duration: ['p(95)<350', 'p(99)<700'],
    http_req_failed: ['rate<0.02'], // Tỷ lệ lỗi dưới 2% trong cơn bão tải
  },
};

export default function () {
  const actions = ['FALL_DETECTED', 'HARDWARE_SOS', 'CRITICAL_SPO2'];
  const chosenAction = actions[__ITER % actions.length];
  const packet = generateSswpPacket(chosenAction, __VU * 100 + __ITER);
  const payload = JSON.stringify(packet);

  const res = http.post(`${BASE_URL}/api/watch/packet`, payload, {
    headers: COMMON_HEADERS,
    tags: { action: chosenAction },
  });

  check(res, {
    'SSWP emergency packet status is 200': (r) => r.status === 200,
    'Packet received acknowledged': (r) => r.json('success') === true,
    'Ack has valid messageId': (r) => r.json('messageId') !== undefined,
  });

  // Trong cơn bão khẩn cấp, client chỉ đợi 0.2 - 0.5s trước khi gửi tiếp
  sleep(0.3 + Math.random() * 0.4);
}
