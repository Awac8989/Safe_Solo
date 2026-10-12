async function main() {
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': 'default-public-api-key-123'
  };

  console.log('--- 1. TEST SAFEPOINT UNLOCK REQUEST ---');
  const res1 = await fetch('http://127.0.0.1:4000/api/safepoints/AED-CR-001/unlock-request', {
    method: 'POST',
    headers,
    body: JSON.stringify({ rescuerId: 'HERO_001', purpose: 'AHA CPR Ngừng tim ngoại viện' })
  });
  const data1 = await res1.json();
  console.log('Unlock SafePoint Result:', data1);

  console.log('\n--- 2. TEST BLOOD RELAY CREATE REQUEST ---');
  const res2 = await fetch('http://127.0.0.1:4000/api/blood-relay/create', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      targetBloodGroup: 'O_MINUS',
      unitsRequired: 2,
      urgencyLevel: 'EXTREME_IMMEDIATE',
      hospitalLocation: {
        hospitalName: 'Bệnh viện Chợ Rẫy - Trung tâm Cấp cứu 115',
        address: '201B Nguyễn Chí Thanh, Phường 12, Quận 5, TP.HCM',
        contactPhone: '02838554137',
        coordinates: [106.6598, 10.7578]
      },
      clinicalJustification: 'Bệnh nhân sốc mất máu cấp do vỡ tạng sau tai nạn đâm va trên Quốc lộ 1A.'
    })
  });
  const data2 = await res2.json();
  console.log('Blood Relay Create Result:', data2);

  console.log('\n--- 3. TEST HERO BOUNTY REAL DISBURSEMENT ---');
  const res3 = await fetch('http://127.0.0.1:4000/api/admin/heroes/hero-01/bounty', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      heroId: 'hero-01',
      amount: 250000,
      reason: 'Hỗ trợ xăng xe & cấp cứu nạn nhân sốc mất máu'
    })
  });
  const data3 = await res3.json();
  console.log('Hero Bounty Disburse Result:', data3);
}

main().catch(console.error);
