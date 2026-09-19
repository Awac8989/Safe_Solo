const db = require('../src/config/database');
const User = require('../src/models/User');
const KYCDocument = require('../src/models/KYCDocument');
const EmergencyLog = require('../src/models/EmergencyLog');
const RescueIncident = require('../src/models/RescueIncident');
const adminPortalService = require('../src/services/adminPortalService');

async function main() {
  await db.$connect();
  console.log('=== REAL DATA IN MONGODB ===');
  const allUsers = await User.find().lean();
  console.log('Total users in DB:', allUsers.length);
  
  const verifiedHeroes = allUsers.filter(u => u.isKycVerified);
  console.log('Verified Heroes in DB:', verifiedHeroes.length);
  verifiedHeroes.forEach((u, i) => {
    console.log(`  [Hero ${i+1}] ${u.fullName} | Phone: ${u.phoneNumber} | Role: ${u.role} | Rescues: ${u.rescuesCount} | Trust: ${u.trustScore}`);
  });

  const kycDocs = await KYCDocument.find().lean();
  console.log('\nKYC Documents in DB:', kycDocs.length);
  kycDocs.forEach((k, i) => {
    const user = allUsers.find(u => String(u._id) === String(k.userId));
    console.log(`  [KYC ${i+1}] ${user?.fullName || k.userId} | Status: ${k.status} | Submitted: ${k.submittedAt}`);
  });

  const emergencies = await EmergencyLog.find({ isResolved: false }).lean();
  console.log('\nOpen Emergency Logs in DB:', emergencies.length);
  emergencies.forEach((e, i) => {
    const user = allUsers.find(u => String(u._id) === String(e.userId));
    console.log(`  [Emergency ${i+1}] User: ${user?.fullName || e.userId} | Triggered: ${e.triggeredAt}`);
  });

  const rescues = await RescueIncident.find({ status: 'ACTIVE' }).lean();
  console.log('\nActive Rescue Incidents in DB:', rescues.length);
  rescues.forEach((r, i) => {
    console.log(`  [Rescue ${i+1}] ID: ${r._id} | Type: ${r.incidentType} | Lat/Lng: ${r.exactLat}, ${r.exactLng}`);
  });

  console.log('\n=== TESTING ADMIN PORTAL SERVICE ENDPOINTS ===');
  const overview = await adminPortalService.getOverview();
  console.log('Overview stats:', overview.stats);
  console.log('Overview incident count:', overview.incidents.length);
  if (overview.incidents.length > 0) {
    console.log('First incident:', {
      id: overview.incidents[0].id,
      name: overview.incidents[0].name,
      type: overview.incidents[0].type,
      vitals: overview.incidents[0].vitals,
      nearbyHeroes: overview.incidents[0].nearbyHeroes,
    });
  }

  const usersList = await adminPortalService.listUsers();
  console.log('\nlistUsers count:', usersList.length);
  const heroCount = usersList.filter(u => u.role === 'hero').length;
  console.log('Users classified as role "hero":', heroCount);

  const kycList = await adminPortalService.listKycQueue();
  console.log('\nlistKycQueue count:', kycList.length);

  await db.$disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
