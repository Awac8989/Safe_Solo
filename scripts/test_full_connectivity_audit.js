/**
 * SAFESOLO — FULL CONNECTIVITY & REDUNDANCY AUDIT TEST SUITE
 * Verifies every fixed API route, Flutter route parity, Watch 5 <-> Backend <-> Web Admin linkage,
 * duplicate removal, and core service endpoints against live Backend (:4000) & Web Admin (:5173).
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const API_KEY = 'android-app-key-abc';
let ADMIN_TOKEN = '';

function requestJson(port, reqPath, { method = 'GET', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body !== null ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: reqPath,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(ADMIN_TOKEN &&
          port === 4000 &&
          !headers?.['x-user-id'] &&
          (reqPath.startsWith('/api/admin') || reqPath.startsWith('/api/watch/command'))
            ? { Authorization: `Bearer ${ADMIN_TOKEN}` }
            : {}),
          ...(headers || {}),
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(raw);
          } catch (_) {}
          resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw });
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(8000, () => req.destroy(new Error(`Timeout on ${method} ${reqPath}`)));
    if (payload) req.write(payload);
    req.end();
  });
}

function walkFiles(dir, extFilter) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full, extFilter));
    } else if (entry.name.endsWith(extFilter)) {
      out.push(full);
    }
  }
  return out;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const loginRes = await requestJson(4000, '/api/admin/auth/login', {
    method: 'POST',
    headers: { 'x-api-key': API_KEY },
    body: { email: 'admin@safesolo.vn', password: process.env.TOC_SUPERADMIN_PASSWORD || 'admin123' },
  });
  assert(loginRes.status === 200 && loginRes.body?.data?.token, `Admin JWT login failed: ${loginRes.status} ${loginRes.raw}`);
  ADMIN_TOKEN = loginRes.body.data.token;

  const results = [];
  const runCase = async (name, fn) => {
    try {
      const detail = await fn();
      results.push({ name, pass: true, detail });
      console.log(`[PASS] ${name}${detail ? ' — ' + detail : ''}`);
    } catch (err) {
      results.push({ name, pass: false, error: err.message });
      console.error(`[FAIL] ${name} — ${err.message}`);
    }
  };

  // TC-01: Static Redundancy & Named Route Parity Audit
  await runCase('TC-01 Static Redundancy & Route Parity (Backend + Flutter + Web)', async () => {
    const serverSrc = fs.readFileSync(path.join(ROOT, 'backend/server.js'), 'utf8');
    for (const dupMount of ['/api/auth', '/api/medical', '/api/guardians', '/api/location', '/api/radar', '/api/chat', '/api/feed', '/api/community', '/api/kyc']) {
      assert(!serverSrc.includes(`app.use('${dupMount}'`), `Duplicate direct mount remains in server.js: ${dupMount}`);
    }

    const indexSrc = fs.readFileSync(path.join(ROOT, 'backend/src/routes/index.js'), 'utf8');
    assert(indexSrc.includes("apiRouter.use('/moments', momentRoutes)"), 'momentRoutes missing in index.js');

    const momentSrc = fs.readFileSync(path.join(ROOT, 'backend/src/routes/momentRoutes.js'), 'utf8');
    assert(!momentSrc.includes('{ apiKeyAuth }'), 'momentRoutes.js still uses destructured { apiKeyAuth }');

    const emSrc = fs.readFileSync(path.join(ROOT, 'backend/src/routes/emergencyRoutes.js'), 'utf8');
    const peCount = (emSrc.match(/massive-pulmonary-embolism/g) || []).length;
    assert(peCount === 1, `Expected 1 massive-pulmonary-embolism route in emergencyRoutes.js, found ${peCount}`);

    const watchUiSrc = fs.readFileSync(path.join(ROOT, 'lib/views/watch/smartwatch_connection_page.dart'), 'utf8');
    const findPhoneCount = (watchUiSrc.match(/packet\.action == WatchAction\.findPhonePing/g) || []).length;
    assert(findPhoneCount === 1, `Expected 1 findPhonePing branch in smartwatch_connection_page.dart, found ${findPhoneCount}`);

    // Verify all Flutter pushNamed routes exist in main.dart routes map
    const mainDart = fs.readFileSync(path.join(ROOT, 'lib/main.dart'), 'utf8');
    const definedRoutes = new Set([...mainDart.matchAll(/'(\/[^']+)'\s*:/g)].map((m) => m[1]));
    const dartFiles = walkFiles(path.join(ROOT, 'lib'), '.dart');
    const missingRoutes = [];
    for (const f of dartFiles) {
      const content = fs.readFileSync(f, 'utf8');
      for (const m of content.matchAll(/Navigator\.pushNamed\(\s*[^,]+,\s*'(\/[^']+)'/g)) {
        if (!definedRoutes.has(m[1])) {
          missingRoutes.push(`${path.relative(ROOT, f)} -> ${m[1]}`);
        }
      }
    }
    assert(missingRoutes.length === 0, `Unregistered Flutter named routes: ${missingRoutes.join(', ')}`);

    // Verify Web Admin routes vs AppSidebar.tsx
    const routeFiles = fs
      .readdirSync(path.join(ROOT, 'web-admin/src/routes'))
      .filter((f) => f.endsWith('.tsx') && !f.startsWith('__') && f !== 'index.tsx' && f !== 'login.tsx')
      .map((f) => '/' + f.replace(/\.tsx$/, ''));
    const sidebarSrc = fs.readFileSync(path.join(ROOT, 'web-admin/src/components/AppSidebar.tsx'), 'utf8');
    const missingLinks = routeFiles.filter((r) => !sidebarSrc.includes(`"${r}"`) && !sidebarSrc.includes(`'${r}'`));
    assert(missingLinks.length === 0, `Orphan web-admin routes missing in AppSidebar.tsx: ${missingLinks.join(', ')}`);

    return `0 dup server mounts, 0 dup branches, 0 missing Flutter routes, ${routeFiles.length} Web routes linked 1:1`;
  });

  // TC-02: Moments API (/api/v1/moments & /api/moments) + API Key Guard
  await runCase('TC-02 Moments Routes (/api/v1/moments & /api/moments)', async () => {
    const unauth = await requestJson(4000, '/api/v1/moments');
    assert(unauth.status === 401, `Expected 401 without x-api-key, got ${unauth.status}`);

    const v1Res = await requestJson(4000, '/api/v1/moments', { headers: { 'x-api-key': API_KEY } });
    assert(v1Res.status === 200 && Array.isArray(v1Res.body), `GET /api/v1/moments failed: ${v1Res.status}`);

    const apiRes = await requestJson(4000, '/api/moments', { headers: { 'x-api-key': API_KEY } });
    assert(apiRes.status === 200 && Array.isArray(apiRes.body), `GET /api/moments failed: ${apiRes.status}`);
    return `v1 & v0 return HTTP 200 (${v1Res.body.length} moments)`;
  });

  // TC-03: SafeTag Issue + Tier-1 Public ICE Scan (GET /public-ice/:code & GET /public/:code)
  await runCase('TC-03 SafeTag Public ICE GET Without Body Crash', async () => {
    const usersRes = await requestJson(4000, '/api/admin/users', { headers: { 'x-api-key': API_KEY } });
    const users = Array.isArray(usersRes.body?.data) ? usersRes.body.data : [];
    assert(usersRes.status === 200 && users.length > 0, 'No users found in /api/admin/users');
    const demoUser = users[0];

    const issueRes = await requestJson(4000, '/api/safetags/issue', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY },
      body: { userId: demoUser.id || demoUser._id, tagType: 'SILICONE_WRISTBAND' },
    });
    assert(issueRes.status === 201 && issueRes.body?.data?.tagCode, `SafeTag issue failed: ${issueRes.status} ${issueRes.raw}`);
    const tagCode = issueRes.body.data.tagCode;

    const pubRes = await requestJson(4000, `/api/safetags/public/${encodeURIComponent(tagCode)}`, {
      headers: { 'x-api-key': API_KEY },
    });
    assert(pubRes.status === 200 && pubRes.body?.success === true, `GET /safetags/public/${tagCode} failed: ${pubRes.status} ${pubRes.raw}`);

    const iceRes = await requestJson(4000, `/api/safetags/public-ice/${encodeURIComponent(tagCode)}`, {
      headers: { 'x-api-key': API_KEY },
    });
    assert(
      iceRes.status === 200 && iceRes.body?.success === true && iceRes.body?.data?.tagUid === tagCode && iceRes.body?.data?.bloodType,
      `GET /safetags/public-ice/${tagCode} incomplete: ${iceRes.status} ${iceRes.raw}`
    );
    return `tagCode=${tagCode}, bloodType=${iceRes.body.data.bloodType}, HTTP 200 on both aliases`;
  });

  // TC-04: BloodRelay Donor Certificate Aliases (Flutter + Web Admin parity)
  await runCase('TC-04 BloodRelay Certificate Aliases (Flutter + Web Admin)', async () => {
    const activeRes = await requestJson(4000, '/api/blood-relay/active', { headers: { 'x-api-key': API_KEY } });
    assert(activeRes.status === 200 && Array.isArray(activeRes.body?.data), `GET /blood-relay/active failed: ${activeRes.status}`);

    const withDonor = activeRes.body.data.find((r) => Array.isArray(r.matchedDonors) && r.matchedDonors.length > 0);
    if (withDonor) {
      const donorId = withDonor.matchedDonors[0].donorId;
      const webCert = await requestJson(4000, `/api/blood-relay/${withDonor._id}/certificate/${donorId}`, {
        headers: { 'x-api-key': API_KEY },
      });
      assert(
        webCert.status === 200 && webCert.body?.certificateNumber && webCert.body?.data?.certificateNumber,
        `Web certificate endpoint failed or missing top-level+data fields: ${webCert.status} ${webCert.raw}`
      );
      const flutterCert = await requestJson(4000, `/api/blood-relay/requests/${withDonor._id}/donors/${donorId}/certificate`, {
        headers: { 'x-api-key': API_KEY },
      });
      assert(
        flutterCert.status === 200 && flutterCert.body?.data?.certificateNumber === webCert.body.certificateNumber,
        `Flutter certificate alias mismatch: ${flutterCert.status} ${flutterCert.raw}`
      );
      return `Matched request ${withDonor._id}, cert=${webCert.body.certificateNumber} (200 OK on both routes)`;
    }

    // Even if empty database, verify route is mounted (domain error != 404 Route not found)
    const probe = await requestJson(4000, '/api/blood-relay/requests/000000000000000000000000/donors/000000000000000000000000/certificate', {
      headers: { 'x-api-key': API_KEY },
    });
    assert(probe.body?.error !== 'Route not found', 'Flutter certificate alias still unmounted (Route not found)');
    return `Mounted cleanly (probe HTTP ${probe.status}, no active matchedDonors in DB)`;
  });

  // TC-05: Emergencies Compatibility (/api/emergencies/:incidentId & POST /:incidentId/resolve)
  await runCase('TC-05 Emergencies Get & Resolve Routes + Victim Ownership Guard', async () => {
    const usersRes = await requestJson(4000, '/api/admin/users', { headers: { 'x-api-key': API_KEY } });
    const users = Array.isArray(usersRes.body?.data) ? usersRes.body.data : [];
    assert(users.length >= 2, 'Need at least 2 users to test victim ownership guard');
    const victimId = users[0].id || users[0]._id;
    const otherId = users[1].id || users[1]._id;

    const broadcast = await requestJson(4000, '/api/radar/broadcast', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY, 'x-user-id': victimId },
      body: {
        lat: 10.7769,
        lng: 106.7009,
        incidentType: 'MEDICAL',
        severity: 4,
        medicalNotes: '[AUDIT_TEST] Temporary connectivity audit incident (auto-resolved)',
      },
    });
    assert(broadcast.status === 201 || broadcast.status === 200, `Broadcast test incident failed: ${broadcast.status} ${broadcast.raw}`);
    const incidentId = broadcast.body?.data?.incident?.id || broadcast.body?.data?.incidentId || broadcast.body?.data?._id;
    assert(incidentId, `Missing incidentId in broadcast response: ${broadcast.raw}`);

    const getRes = await requestJson(4000, `/api/emergencies/${incidentId}?userId=${victimId}`, {
      headers: { 'x-api-key': API_KEY },
    });
    assert(getRes.status === 200 && getRes.body?.success === true, `GET /api/emergencies/${incidentId} failed: ${getRes.status} ${getRes.raw}`);

    const forbidRes = await requestJson(4000, `/api/emergencies/${incidentId}/resolve`, {
      method: 'POST',
      headers: { 'x-api-key': API_KEY },
      body: { userId: otherId },
    });
    assert(forbidRes.status === 403, `Expected 403 when non-victim resolves, got ${forbidRes.status} ${forbidRes.raw}`);

    const resolveRes = await requestJson(4000, `/api/emergencies/${incidentId}/resolve`, {
      method: 'POST',
      headers: { 'x-api-key': API_KEY },
      body: { userId: victimId },
    });
    assert(
      resolveRes.status === 200 && resolveRes.body?.success === true,
      `POST /api/emergencies/${incidentId}/resolve failed: ${resolveRes.status} ${resolveRes.raw}`
    );
    return `Incident ${incidentId} fetched (200), non-victim blocked (403), victim resolved (200)`;
  });

  // TC-06: Two-Way Watch 5 <-> Backend <-> Web Admin SSE & Command ACK Roundtrip
  await runCase('TC-06 Watch 5 <-> Backend <-> Web Admin Two-Way SSE Roundtrip', async () => {
    const usersRes = await requestJson(4000, '/api/admin/users', { headers: { 'x-api-key': API_KEY } });
    const users = Array.isArray(usersRes.body?.data) ? usersRes.body.data : [];
    assert(users.length > 0, 'No users found in /api/admin/users');
    const victim = users[0];
    const victimId = victim.id || victim._id;

    // Open SSE stream
    const sseEvents = [];
    const sseReq = await new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: 4000,
          path: '/api/watch/stream',
          method: 'GET',
          headers: { 'x-api-key': API_KEY, Accept: 'text/event-stream' },
        },
        (res) => {
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            for (const line of chunk.split('\n')) {
              if (line.startsWith('data: ')) {
                try {
                  sseEvents.push(JSON.parse(line.slice(6)));
                } catch (_) {}
              }
            }
          });
          resolve({ req, res, status: res.statusCode });
        }
      );
      req.on('error', reject);
      req.end();
    });
    assert(sseReq.status === 200, `SSE /api/watch/stream failed: ${sseReq.status}`);

    const pairRes = await requestJson(4000, '/api/watch/pair/auto-pair', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY },
      body: { deviceId: 'watch_galaxy_5', deviceModel: 'Samsung Galaxy Watch 5 (SM-R900)', userId: victimId },
    });
    assert(pairRes.status === 200 && pairRes.body?.paired === true, 'Watch auto-pair failed');

    const cmdRes = await requestJson(4000, '/api/watch/command', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY },
      body: { deviceId: 'watch_galaxy_5', action: 'FIND_WATCH_PING', note: '[AUDIT_TEST] Ping Watch 5' },
    });
    assert(cmdRes.status === 200 && cmdRes.body?.success === true, `POST /api/watch/command failed: ${cmdRes.status}`);

    const pollWatch = await requestJson(4000, '/api/watch/commands/watch_galaxy_5?target=watch', {
      headers: { 'x-api-key': API_KEY },
    });
    assert(
      pollWatch.status === 200 && Array.isArray(pollWatch.body?.commands) && pollWatch.body.commands.some((c) => c.action === 'FIND_WATCH_PING'),
      `Watch poll missing FIND_WATCH_PING: ${pollWatch.raw}`
    );

    const ackRes = await requestJson(4000, '/api/watch/packet', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY },
      body: {
        sender: 'watch',
        type: 'ack',
        action: 'WATCH_COMMAND_ACK',
        messageId: `audit_ack_${Date.now()}`,
        payload: { deviceId: 'watch_galaxy_5', userId: victimId, ackAction: 'FIND_WATCH_PING', status: 'EXECUTED', heartRate: 76, spO2: 99 },
      },
    });
    assert(ackRes.status === 200 && ackRes.body?.success === true, `ACK post failed: ${ackRes.status}`);

    await new Promise((r) => setTimeout(r, 250));
    sseReq.req.destroy();
    const eventTypes = sseEvents.map((e) => e.eventType);
    assert(
      eventTypes.includes('WATCH_COMMAND_ENQUEUED') && eventTypes.includes('WATCH_COMMAND_ACK'),
      `Missing SSE events: ${JSON.stringify(eventTypes)}`
    );
    return `SSE received [${eventTypes.join(', ')}]`;
  });

  // TC-07: Core Backend Endpoints + Web Admin Live Check
  await runCase('TC-07 Core Endpoints (/health, /admin/*, /watch/devices, /hospitals, /safepoints, Web :5173)', async () => {
    const endpoints = [
      '/health',
      '/api/health',
      '/api/admin/overview',
      '/api/admin/users',
      '/api/watch/devices',
      '/api/hospitals',
      '/api/safepoints/nearby?lat=10.7769&lng=106.7009',
      '/api/blood-relay/active',
    ];
    for (const ep of endpoints) {
      const r = await requestJson(4000, ep, { headers: { 'x-api-key': API_KEY } });
      assert(r.status === 200, `${ep} returned HTTP ${r.status}`);
    }
    const webHome = await requestJson(5173, '/');
    assert(webHome.status === 200 && webHome.raw.toLowerCase().includes('<!doctype html>'), `Web Admin :5173 root check failed: ${webHome.status}`);
    return `${endpoints.length} backend routes 200 OK + Web Admin :5173 HTML live`;
  });

  const failed = results.filter((r) => !r.pass);
  console.log(`\n=== CONNECTIVITY AUDIT SUMMARY: ${results.length - failed.length}/${results.length} PASSED ===`);
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
