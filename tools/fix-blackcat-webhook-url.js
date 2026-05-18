const { Pool } = require('pg');
const cs = process.env.DATABASE_URL;
if (!cs) { console.error('Missing DATABASE_URL'); process.exit(1); }
const p = new Pool({ connectionString: cs, ssl: cs.includes('proxy') ? { rejectUnauthorized: false } : false });

const target = process.argv[2] || 'https://vemnabet.bet/api/webhook/blackcat';
(async () => {
  const before = await p.query("SELECT value FROM platform_settings WHERE key='blackcat_webhook_url' LIMIT 1");
  await p.query(`INSERT INTO platform_settings (key,value) VALUES ('blackcat_webhook_url',$1)
    ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [target]);
  const after = await p.query("SELECT value FROM platform_settings WHERE key='blackcat_webhook_url' LIMIT 1");
  console.log('blackcat_webhook_url before:', before.rows[0]?.value || '');
  console.log('blackcat_webhook_url after :', after.rows[0]?.value || '');
  await p.end();
})();
