// Simula EXATAMENTE a query do /api/login no DB de produção
const { Client } = require('pg');
const bcrypt = require('bcrypt');
(async () => {
  const db = new Client({ connectionString: 'postgresql://postgres:CMxeFqOjCBbFjpBxtWMZrrUuBsjndwXI@roundhouse.proxy.rlwy.net:57858/railway', ssl: { rejectUnauthorized: false } });
  await db.connect();
  for (const [login, password] of [['karlos_araujo','Karlos@123'], ['testseed','teste123']]) {
    const r = await db.query(
      `SELECT u.id, u.username, u.name, u.phone, u.email, u.cpf, u.password_hash,
              COALESCE(w.balance_cents, 0) AS wallet_balance_cents
       FROM users u
       LEFT JOIN wallets w ON w.user_id = u.id
       WHERE u.username = $1 OR u.email = $1 OR u.cpf = $2`,
      [login, login.replace(/\D/g, '')]
    );
    console.log('\n>>>', login, '(', password, ')');
    console.log('  rows found:', r.rows.length);
    const u = r.rows[0];
    if (u) {
      const ok = await bcrypt.compare(password, u.password_hash);
      console.log('  id:', u.id, 'username:', u.username);
      console.log('  bcrypt.compare =>', ok);
    }
  }
  await db.end();
})();
