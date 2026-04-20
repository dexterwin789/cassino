const { Client } = require('pg');
const bcrypt = require('bcrypt');
(async () => {
  const db = new Client({ connectionString: 'postgresql://postgres:CMxeFqOjCBbFjpBxtWMZrrUuBsjndwXI@roundhouse.proxy.rlwy.net:57858/railway', ssl: { rejectUnauthorized: false } });
  await db.connect();
  const r = await db.query("SELECT id, username, password_hash, is_active FROM users WHERE username IN ('karlos_araujo','testseed')");
  for (const u of r.rows) {
    const pass = u.username === 'karlos_araujo' ? 'Karlos@123' : 'teste123';
    const ok = await bcrypt.compare(pass, u.password_hash);
    console.log(u.username, 'id=', u.id, 'active=', u.is_active, 'hashOK=', ok, 'hashLen=', u.password_hash.length);
  }
  await db.end();
})();
