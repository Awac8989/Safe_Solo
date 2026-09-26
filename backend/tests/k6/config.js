// ============================================================================
// SAFESOLO BACKEND PERFORMANCE BENCHMARK CONFIGURATION (k6)
// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03
// ============================================================================

export const BASE_URL = __ENV.TARGET_URL || 'http://localhost:4000';

export const THRESHOLDS = {
  // Độ trễ trung bình < 100ms, p95 < 200ms, p99 < 500ms
  http_req_duration: ['avg<100', 'p(95)<200', 'p(99)<500'],
  // Tỷ lệ lỗi cho phép < 1%
  http_req_failed: ['rate<0.01'],
};

export const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'SafeSolo-K6-Benchmark-Engine/1.0',
  'X-Benchmark-Client': 'KTPM03-DoanMinhQuan',
};

// Hàm sinh payload thông số sinh tồn ngẫu nhiên mô phỏng Galaxy Watch 5
export function generateSmartwatchTelemetry(index = 1) {
  const heartRate = Math.floor(65 + Math.random() * 45); // 65 - 110 BPM
  const spO2 = Math.floor(94 + Math.random() * 6);       // 94 - 100%
  const battery = Math.floor(40 + Math.random() * 60);    // 40 - 100%
  const svmG = (0.8 + Math.random() * 0.6).toFixed(2);    // 0.8 - 1.4g
  const tiltAngle = Math.floor(Math.random() * 35);       // 0 - 35 độ

  return {
    deviceId: `watch_benchmark_node_${(index % 100).toString().padLeft(3, '0')}`,
    heartRate,
    spO2,
    battery,
    steps: 5400 + (index * 12),
    isOffWrist: false,
    svmG: parseFloat(svmG),
    tiltAngle,
    timestamp: Date.now(),
  };
}

// Hàm sinh gói tin SSWP (SafeSolo Watch Protocol)
export function generateSswpPacket(action = 'VITALS_UPDATE', index = 1) {
  return {
    version: '1.0',
    messageId: `msg_k6_${Date.now()}_${index}`,
    sender: 'watch',
    action: action,
    timestamp: Date.now(),
    payload: {
      deviceId: `watch_benchmark_node_${(index % 100).toString().padLeft(3, '0')}`,
      userId: `user_test_${index % 50}`,
      heartRate: action === 'CRITICAL_SPO2' ? 135 : 78,
      spO2: action === 'CRITICAL_SPO2' ? 84 : 98,
      svmG: action === 'FALL_DETECTED' ? 4.8 : 1.05,
      tiltAngle: action === 'FALL_DETECTED' ? 72.0 : 15.0,
      note: 'k6 performance stress payload',
    },
  };
}
