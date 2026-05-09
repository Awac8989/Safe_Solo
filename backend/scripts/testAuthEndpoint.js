const fetch = global.fetch;
if (!fetch) {
  throw new Error('Global fetch is not available in this Node runtime. Use Node 18+ or install a polyfill.');
}

async function main() {
  const url = 'http://localhost:4001/api/auth/login';
  console.log('Calling', url);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: 'test-lookup@example.com' })
  });
  const body = await res.text();
  console.log('Status:', res.status);
  console.log('Body:', body);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
