const { Pool } = require('pg');
const { getStatus } = require('../src/services/blackcat');
const cs = process.env.DATABASE_URL;
if (!cs) { console.error('Missing DATABASE_URL'); process.exit(1); }
const p = new Pool({ connectionString: cs, ssl: cs.includes('proxy') ? { rejectUnauthorized: false } : false });

(async () => {
  const r = await p.query(`
    SELECT id, user_id, amount_cents, provider_ref, created_at
    FROM transactions
    WHERE type='deposit' AND status='pending' AND provider='blackcat'
    ORDER BY id DESC
    LIMIT 20
  `);
  console.log(`Pending deposits: ${r.rowCount}`);
  for (const tx of r.rows) {
    try {
      const status = await getStatus(tx.provider_ref);
      console.log('\nTX', tx.id, tx.provider_ref, 'amount', Number(tx.amount_cents)/100);
      console.log(JSON.stringify(status, null, 2).slice(0, 2000));
    } catch (e) {
      console.log('\nTX', tx.id, tx.provider_ref, 'ERR', e.message);
    }
  }
  await p.end();
})();
