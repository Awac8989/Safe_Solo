import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, COMMON_HEADERS, generateSmartwatchTelemetry, THRESHOLDS } from '../config.js';

// ============================================================================
// KỊCH BẢN 2: CONTINUOUS TELEMETRY INGESTION LOAD TEST
// Mục đích: Giả lập 100 - 500 đồng hồ thông minh đẩy dữ liệu sinh tồn liên tục
// Tần suất: Mỗi client gửi 1 bản tin / 2 giây
// ============================================================================

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Khởi động nhẹ 50 thiết bị
    { duration: '1m', target: 200 },   // Tăng lên 200 thiết bị
    { duration: '2m', target: 500 },   // Tải ổn định 500 thiết bị
    { duration: '30s', target: 0 },    // Hạ tải dần về 0
  ],
  thresholds: {
    ...THRESHOLDS,
    'http_req_duration{endpoint:vitals}': ['p(95)<150'],
  },
};

export default function () {
  const telemetry = generateSmartwatchTelemetry(__VU * 1000 + __ITER);
  const payload = JSON.stringify(telemetry);

  const res = http.post(`${BASE_URL}/api/watch/vitals`, payload, {
    headers: COMMON_HEADERS,
    tags: { endpoint: 'vitals' },
  });

  check(res, {
    'Vitals update status is 200': (r) => r.status === 200,
    'Vitals payload acknowledged': (r) => r.json('success') === true,
    'Response time is acceptable (< 250ms)': (r) => r.timings.duration < 250,
  });

  // Nghỉ 1-2 giây mô phỏng nhịp đẩy dữ liệu cảm biến định kỳ
  sleep(1.5 + Math.random());
}
