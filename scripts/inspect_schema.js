const { Pool } = require('pg');
const p = new Pool({
  connectionString: 'postgresql://postgres:FSSRyVSBeEIjJNkmHTspwcGbuQyGoEdj@interchange.proxy.rlwy.net:11184/railway',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  const t = ['affiliate_commissions', 'users', 'affiliates', 'notifications'];
  for (const x of t) {
    const r = await p.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`,
      [x]
    );
    console.log('==', x, '==');
    r.rows.forEach(c => console.log(' ', c.column_name, c.data_type));
  }
  // referred_by on users
  const ref = await p.query(`SELECT COUNT(*) FROM users WHERE referred_by = 24`);
  console.log('users referred_by=24:', ref.rows[0].count);
  await p.end();
})().catch(e => { console.error(e.message); process.exit(1); });
