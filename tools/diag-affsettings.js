const { Pool } = require('pg');
const cs = process.env.DATABASE_URL;
const p = new Pool({ connectionString: cs, ssl: cs && cs.includes('proxy') ? { rejectUnauthorized: false } : false });

(async () => {
  const s = await p.query("SELECT key,value FROM platform_settings WHERE key LIKE 'aff_%' ORDER BY key");
  console.log('AFFILIATE SETTINGS:');
  s.rows.forEach(r => console.log('  ', r.key, '=', r.value));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
