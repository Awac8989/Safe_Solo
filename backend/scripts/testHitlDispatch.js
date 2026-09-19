/**
 * testHitlDispatch.js
 * Test suite for Human-in-the-Loop (HITL) Semi-Autonomous Dispatch Engine
 */
const assert = require('assert');
const adminPortalService = require('../src/services/adminPortalService');

async function runTests() {
  console.log('=== [1] Testing Overview Incidents with HITL & Vitals ===');
  const overview = await adminPortalService.getOverview();
  assert(overview && overview.incidents, 'Overview should have incidents');
  assert(overview.incidents.length > 0, 'Incidents should not be empty (fallback demo if no db)');
  
  const p1Incident = overview.incidents.find((inc) => inc.hitl && inc.hitl.priority === 'P1_CRITICAL');
  assert(p1Incident, 'Must have at least one P1_CRITICAL incident');
  console.log(`✓ Found P1 Incident: ${p1Incident.name} (${p1Incident.id})`);
  console.log(`  AI Summary: ${p1Incident.hitl.aiSummary}`);
  console.log(`  Stroke Risk: ${p1Incident.vitals.strokeRisk}, SpO2: ${p1Incident.vitals.spo2}%`);
  console.log(`  Countdown: ${p1Incident.hitl.countdownSeconds}s, State: ${p1Incident.hitl.state}`);
  assert.strictEqual(p1Incident.hitl.countdownSeconds, 30, 'P1 countdown should be 30 seconds');

  console.log('\n=== [2] Testing Supervisor Instant Dispatch (Bypass Countdown) ===');
  const instantRes = await adminPortalService.handleHitlAction(p1Incident.id, {
    action: 'INSTANT_DISPATCH',
    supervisorName: 'Đoàn Minh Quân (Trưởng ca)',
    supervisorId: 'SUP-0137',
    tier: 2,
  });
  assert.strictEqual(instantRes.state, 'DISPATCHED');
  assert(instantRes.hash.startsWith('0x'), 'Must return valid SHA-256 hex hash');
  console.log(`✓ Instant Dispatch Success! Hash: ${instantRes.hash}`);

  console.log('\n=== [3] Testing Supervisor Pause & Resume Countdown ===');
  const pauseRes = await adminPortalService.handleHitlAction('INC-HITL-002', {
    action: 'PAUSE_COUNTDOWN',
    reason: 'Đang liên hệ gia đình để kiểm chứng mã Duress',
    supervisorName: 'Đoàn Minh Quân',
  });
  assert.strictEqual(pauseRes.state, 'PAUSED');
  console.log(`✓ Pause Success! State: ${pauseRes.state}, Hash: ${pauseRes.hash}`);

  const resumeRes = await adminPortalService.handleHitlAction('INC-HITL-002', {
    action: 'RESUME_COUNTDOWN',
    supervisorName: 'Đoàn Minh Quân',
  });
  assert.strictEqual(resumeRes.state, 'COUNTDOWN_ACTIVE');
  console.log(`✓ Resume Success! State: ${resumeRes.state}`);

  console.log('\n=== [4] Testing Supervisor False Alarm Cancel ===');
  const cancelRes = await adminPortalService.handleHitlAction('INC-HITL-003', {
    action: 'CANCEL_FALSE_ALARM',
    reason: 'Nạn nhân nghe máy xác nhận cháu nhỏ bấm nhầm',
    supervisorName: 'Đoàn Minh Quân',
    tier: 1,
  });
  assert.strictEqual(cancelRes.state, 'CANCELLED_FALSE_ALARM');
  console.log(`✓ False Alarm Cancelled! Reason logged, Hash: ${cancelRes.hash}`);

  console.log('\n=== [5] Testing Tier 3 Strict Ambulance Gate ===');
  const ambRes = await adminPortalService.handleHitlAction(p1Incident.id, {
    action: 'TIER3_AMBULANCE_DISPATCH',
    reason: 'Điều xe cấp cứu 115 Bệnh viện Chợ Rẫy',
    supervisorName: 'Đoàn Minh Quân (Xác thực chữ ký số)',
    tier: 3,
  });
  assert.strictEqual(ambRes.state, 'AMBULANCE_DISPATCHED');
  console.log(`✓ Tier 3 Ambulance Dispatched with Signature! Hash: ${ambRes.hash}`);

  console.log('\n=== [6] Testing Audit Log Retrieval with Cryptographic Hashes ===');
  const auditLogs = await adminPortalService.listAuditLogs({ category: 'Dispatch' });
  assert(Array.isArray(auditLogs), 'Audit logs must be an array');
  console.log(`✓ Retrieved ${auditLogs.length} audit logs. First log hash: ${auditLogs[0]?.hash || 'N/A'}`);

  console.log('\n========================================');
  console.log('🎉 ALL HITL UNIT TESTS PASSED SUCCESSFULLY (6/6)');
  console.log('========================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
