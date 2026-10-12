require('dotenv').config();
const service = require('../src/services/adminPortalService');

const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const queue = await service.listKycQueue();
  console.log(JSON.stringify(queue.map(q => ({
    name: q.name,
    phone: q.phone,
    status: q.status,
    category: q.professionCategory,
    credential: q.credentialName,
    number: q.credentialNumber,
    unit: q.workingUnit,
    tier: q.specialtyTier,
    score: q.theoryExamScore,
    match: q.match
  })), null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
