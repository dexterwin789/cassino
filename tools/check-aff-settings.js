require('dotenv').config();
const { query, pool } = require('../src/config/database');

(async () => {
  const r = await query("SELECT key, value FROM platform_settings WHERE key LIKE 'aff_%' ORDER BY key");
  console.log('Affiliate settings in DB:');
  console.table(r.rows);
  await pool.end();
})();
