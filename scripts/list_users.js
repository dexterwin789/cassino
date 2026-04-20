const { Client } = require('pg');
const URL = 'postgresql://postgres:CMxeFqOjCBbFjpBxtWMZrrUuBsjndwXI@roundhouse.proxy.rlwy.net:57858/railway';
(async () => {
  const db = new Client({ connectionString: URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const all = await db.query('SELECT id, username, name, referred_by, created_at FROM users ORDER BY id');
  console.log('=== TODOS OS USUÁRIOS ===');
  console.table(all.rows);
  const k = await db.query("SELECT id, username, name FROM users WHERE name ILIKE '%karlos%' OR name ILIKE '%araujo%' OR username ILIKE '%karlos%'");
  console.log('\n=== MATCHES karlos/araujo ===');
  console.table(k.rows);
  await db.end();
})();
