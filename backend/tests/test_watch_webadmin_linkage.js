require('dotenv').config({ path: __dirname + '/../.env' });

const BASE_URL = 'http://localhost:4000/api';
const API_KEY = process.env.PUBLIC_API_KEY || 'android-app-key-abc';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

let ADMIN_TOKEN = '';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      ...(ADMIN_TOKEN ? { Authorization: `Bearer ${ADMIN_TOKEN}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function loginAdminJwt() {
  const res = await apiFetch('/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'admin@safesolo.vn',
      password: process.env.TOC_SUPERADMIN_PASSWORD || 'admin123',
    }),
  });
  assert(res.status === 200 && res.data?.data?.token, `Admin login failed: ${JSON.stringify(res.data)}`);
  ADMIN_TOKEN = res.data.data.token;
}

async function main() {
  console.log('================================================================================');
  console.log('   SAFESOLO — TEST LIÊN KẾT HAI CHIỀU SAMSUNG GALAXY WATCH 5 <-> WEB ADMIN TOC  ');
  console.log('================================================================================\n');

  await loginAdminJwt();

  // 1. Lấy nạn nhân trọng điểm đang active từ /admin/vitals/active
  const vitalsBefore = await apiFetch('/admin/vitals/active');
  assert(vitalsBefore.status === 200 && Array.isArray(vitalsBefore.data?.data), 'GET /admin/vitals/active failed');
  const targetVictim = vitalsBefore.data.data.find((v) => v.userId) || vitalsBefore.data.data[0];
  assert(targetVictim && targetVictim.userId, 'Không tìm thấy nạn nhân có userId để liên kết Watch 5');
  console.log(`[1] Nạn nhân mục tiêu: ${targetVictim.victimName} (userId=${targetVictim.userId}, incident=${targetVictim.incidentId})`);

  // 2. Mở SSE stream /api/watch/stream để kiểm tra push thời gian thực
  const sseAbort = new AbortController();
  const receivedSseTypes = [];
  const sseRes = await fetch(`${BASE_URL}/watch/stream?api_key=default-public-api-key-123`, {
    signal: sseAbort.signal,
  });
  assert(sseRes.status === 200, `SSE /watch/stream returned ${sseRes.status}`);
  const reader = sseRes.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = '';

  const pumpSse = (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });
        const parts = sseBuffer.split('\n\n');
        sseBuffer = parts.pop() || '';
        for (const chunk of parts) {
          const dataLine = chunk.split('\n').find((l) => l.startsWith('data: '));
          if (dataLine) {
            try {
              const parsed = JSON.parse(dataLine.slice(6));
              if (parsed?.eventType) receivedSseTypes.push(parsed.eventType);
            } catch (_) {}
          }
        }
      }
    } catch (_) {}
  })();

  await new Promise((r) => setTimeout(r, 400));
  assert(receivedSseTypes.includes('WATCH_SNAPSHOT'), `Thiếu WATCH_SNAPSHOT từ SSE (${receivedSseTypes.join(',')})`);
  console.log('[2] SSE /api/watch/stream nhận WATCH_SNAPSHOT < 400ms -> OK');

  // 3. Auto-pair Galaxy Watch 5 (SM-R900) với userId của nạn nhân
  const pairRes = await apiFetch('/watch/pair/auto-pair', {
    method: 'POST',
    body: JSON.stringify({
      deviceId: 'watch_galaxy_5_test',
      deviceModel: 'Samsung Galaxy Watch 5 (SM-R900)',
      userId: targetVictim.userId,
    }),
  });
  assert(pairRes.status === 200 && pairRes.data?.paired === true, 'Auto-pair Watch 5 thất bại');
  console.log('[3] Ghép nối Galaxy Watch 5 <-> Backend thành công');

  // 4. Watch 5 gửi telemetry sinh tồn nguy kịch + lực va chạm ngã 3.4g
  const vitalsPost = await apiFetch('/watch/vitals', {
    method: 'POST',
    body: JSON.stringify({
      deviceId: 'watch_galaxy_5_test',
      userId: targetVictim.userId,
      heartRate: 146,
      spO2: 88,
      battery: 79,
      steps: 6150,
      isOffWrist: false,
      svmG: 3.4,
      tiltAngle: 78.5,
      forcePersist: true,
    }),
  });
  assert(vitalsPost.status === 200 && vitalsPost.data?.vitals?.heartRate === 146, 'POST /watch/vitals thất bại');

  await new Promise((r) => setTimeout(r, 300));
  const vitalsAfter = await apiFetch('/admin/vitals/active');
  const updatedVictim = vitalsAfter.data.data.find((v) => v.userId === targetVictim.userId);
  assert(updatedVictim, 'Không thấy nạn nhân sau cập nhật');
  assert(updatedVictim.vitals.heartRate === 146, `Web Admin không cập nhật BPM thật (got ${updatedVictim.vitals.heartRate})`);
  assert(updatedVictim.vitals.spo2 === 88, `Web Admin không cập nhật SpO2 thật (got ${updatedVictim.vitals.spo2})`);
  assert(updatedVictim.vitals.svmG === 3.4 && updatedVictim.vitals.fallDetected === true, 'Web Admin không nhận svmG/fallDetected từ Watch 5');
  console.log(`[4] Web Admin /admin/vitals/active cập nhật trực tiếp từ Watch 5 (HR=146 BPM, SpO2=88%, IMU=3.4g) -> OK`);

  // 5. Watch 5 phát cảnh báo tháo đồng hồ (Off-Wrist)
  await apiFetch('/watch/vitals', {
    method: 'POST',
    body: JSON.stringify({
      deviceId: 'watch_galaxy_5_test',
      userId: targetVictim.userId,
      heartRate: 146,
      spO2: 88,
      battery: 79,
      isOffWrist: true,
      svmG: 1.0,
      forcePersist: true,
    }),
  });
  const vitalsOffWrist = await apiFetch('/admin/vitals/active');
  const offVictim = vitalsOffWrist.data.data.find((v) => v.userId === targetVictim.userId);
  assert(offVictim?.vitals?.isOffWrist === true, 'Web Admin không nhận trạng thái isOffWrist từ Watch 5');
  console.log('[5] Web Admin nhận cảnh báo tháo đồng hồ (isOffWrist=true) -> OK');

  // 6. Web Admin TOC gửi lệnh 2 chiều xuống Watch 5 + Điều phối STAT đồng bộ Watch
  const cmdPpg = await apiFetch('/watch/command', {
    method: 'POST',
    body: JSON.stringify({
      userId: targetVictim.userId,
      action: 'INSTANT_MEASURE_REQ',
      payload: { incidentId: targetVictim.incidentId },
      issuedBy: 'Linkage Integration Test',
    }),
  });
  assert(cmdPpg.status === 200 && cmdPpg.data?.data?.deviceId === 'watch_galaxy_5_test', 'POST /watch/command INSTANT_MEASURE_REQ thất bại');

  const dispatchRes = await apiFetch(`/admin/vitals/${targetVictim.incidentId}/instant-dispatch`, {
    method: 'POST',
    body: JSON.stringify({
      ambulanceUnit: 'Kíp 115 BV Chợ Rẫy (Test Watch Link)',
      dispatchNotes: 'Kiểm tra đồng bộ lệnh điều phối xuống mặt đồng hồ Galaxy Watch 5',
      targetSop: 'P1_CARDIAC_ARREST_AED',
      broadcastChannels: ['TELEGRAM'],
    }),
  });
  assert(dispatchRes.status === 200 && String(dispatchRes.data?.data?.watchNotification || '').includes('ENQUEUED:'), 'instant-dispatch không gửi TOC_DISPATCH_ACK tới Watch 5');

  // 7. Watch 5 poll hàng đợi lệnh & phản hồi WATCH_COMMAND_ACK + PRECISION_MEASURE_RESULT
  const pollCmds = await apiFetch('/watch/commands/watch_galaxy_5_test?target=watch');
  const actions = (pollCmds.data?.commands || []).map((c) => c.action);
  assert(actions.includes('INSTANT_MEASURE_REQ'), `Watch không nhận INSTANT_MEASURE_REQ (${actions.join(',')})`);
  assert(actions.includes('TOC_DISPATCH_ACK'), `Watch không nhận TOC_DISPATCH_ACK (${actions.join(',')})`);
  console.log(`[6] Watch 5 nhận đủ lệnh TOC hai chiều: [${actions.join(', ')}] -> OK`);

  await apiFetch('/watch/packet', {
    method: 'POST',
    body: JSON.stringify({
      sender: 'watch',
      type: 'ack',
      action: 'WATCH_COMMAND_ACK',
      payload: {
        deviceId: 'watch_galaxy_5_test',
        userId: targetVictim.userId,
        ackAction: 'INSTANT_MEASURE_REQ',
        status: 'EXECUTED',
        note: 'Galaxy Watch 5 đã đo xong BioActive PPG 10s',
      },
    }),
  });

  await apiFetch('/watch/packet', {
    method: 'POST',
    body: JSON.stringify({
      sender: 'watch',
      type: 'telemetry',
      action: 'PRECISION_MEASURE_RESULT',
      payload: {
        deviceId: 'watch_galaxy_5_test',
        userId: targetVictim.userId,
        heartRate: 138,
        spO2: 90,
        protocol: 'BIOACTIVE_CLINICAL_10S',
      },
    }),
  });

  await new Promise((r) => setTimeout(r, 300));
  const devSnap = await apiFetch('/watch/devices');
  const devices = devSnap.data?.data?.devices || [];
  const events = devSnap.data?.data?.recentEvents || [];
  assert(devices.some((d) => d.deviceId === 'watch_galaxy_5_test' && d.vitals?.heartRate === 138), 'GET /watch/devices chưa cập nhật kết quả PPG 138 BPM');
  assert(events.some((e) => e.type === 'WATCH_COMMAND_ACK'), 'recentEvents thiếu WATCH_COMMAND_ACK');
  assert(receivedSseTypes.includes('WATCH_VITALS') && receivedSseTypes.includes('WATCH_COMMAND_ACK'), `SSE thiếu event (${receivedSseTypes.join(',')})`);
  console.log(`[7] SSE & /watch/devices xác nhận WATCH_COMMAND_ACK + PRECISION_MEASURE_RESULT (138 BPM, 90% SpO2) -> OK`);

  // Dọn thiết bị test tạm
  await apiFetch('/watch/pair/unpair', {
    method: 'POST',
    body: JSON.stringify({ deviceId: 'watch_galaxy_5_test' }),
  });

  sseAbort.abort();
  await pumpSse.catch(() => {});

  console.log('\n================================================================================');
  console.log('   ✅ PASS 7/7 GIAI ĐOẠN LIÊN KẾT HAI CHIỀU WATCH 5 <-> BACKEND <-> WEB ADMIN   ');
  console.log('================================================================================\n');
}

main().catch((err) => {
  console.error('❌ Linkage Test Failed:', err);
  process.exit(1);
});
