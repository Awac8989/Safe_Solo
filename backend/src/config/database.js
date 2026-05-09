const sql = require('mssql');

const config = {
  server: process.env.MSSQL_SERVER || 'MINHQUANDOAN\\MSSQLSERVER112',
  database: process.env.MSSQL_DATABASE || 'SafeSoloDB',
  user: process.env.MSSQL_USER || '',        // để trống nếu dùng Windows Auth
  password: process.env.MSSQL_PASSWORD || '', // để trống nếu dùng Windows Auth
  port: parseInt(process.env.MSSQL_PORT) || 1433,
  options: {
    encrypt: false,                           // false cho local dev
    trustServerCertificate: true,
    enableArithAbort: true,
    instanceName: process.env.MSSQL_INSTANCE || 'MSSQLSERVER112',
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// Nếu không có user/password → dùng Windows Authentication
if (!config.user) {
  config.authentication = {
    type: 'ntlm',
    options: {
      domain: process.env.MSSQL_DOMAIN || '',
      userName: process.env.MSSQL_USER || '',
      password: process.env.MSSQL_PASSWORD || '',
    },
  };
  // Xóa user/password để tránh conflict
  delete config.user;
  delete config.password;
}

let pool = null;

async function getPool() {
  if (pool) return pool;
  try {
    pool = await sql.connect(config);
    console.log('✅ Connected to MSSQL:', config.server, '/', config.database);
    return pool;
  } catch (err) {
    console.error('❌ MSSQL connection failed:', err.message);
    throw err;
  }
}

async function query(queryStr, params = {}) {
  const p = await getPool();
  const request = p.request();
  // Bind parameters
  for (const [key, value] of Object.entries(params)) {
    request.input(key, value);
  }
  return request.query(queryStr);
}

async function closePool() {
  if (pool) {
    await pool.close();
    pool = null;
    console.log('🔌 MSSQL pool closed');
  }
}

module.exports = { sql, getPool, query, closePool, config };