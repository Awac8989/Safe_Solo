import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, COMMON_HEADERS } from '../config.js';

// ============================================================================
// KỊCH BẢN 1: SMOKE & SANITY TEST
// Mục đích: Xác nhận tính sẵn sàng cơ bản của API trước khi tăng tải nặng
// ============================================================================

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_duration: ['avg<50', 'p(95)<100'],
    http_req_failed: ['rate<0.001'],
  },
};

export default function () {
  const resHealth = http.get(`${BASE_URL}/health`, { headers: COMMON_HEADERS });
  check(resHealth, {
    'Health check status is 200': (r) => r.status === 200,
    'Health body reports running': (r) => r.json('success') === true,
  });

  const resApiHealth = http.get(`${BASE_URL}/api/health`, { headers: COMMON_HEADERS });
  check(resApiHealth, {
    'API health status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
