// Seta saldo generoso para testar jogos em produção
const { Client } = require('pg');
const URL_DB = 'postgresql://postgres:CMxeFqOjCBbFjpBxtWMZrrUuBsjndwXI@roundhouse.proxy.rlwy.net:57858/railway';
(async () => {
  const db = new Client({ connectionString: URL_DB, ssl: { rejectUnauthorized: false } });
  await db.connect();
  // R$5000 em balance (coluna da tabela users) + wallets.balance_cents
  for (const uid of [24, 27]) {
    await db.query('UPDATE users SET balance=5000.00, bonus=500.00 WHERE id=$1', [uid]);
    await db.query(`INSERT INTO wallets (user_id, balance_cents) VALUES ($1, 500000)
      ON CONFLICT (user_id) DO UPDATE SET balance_cents=500000`, [uid]);
  }
  const r = await db.query('SELECT id,username,balance,bonus FROM users WHERE id IN (24,27)');
  console.table(r.rows);
  const w = await db.query('SELECT user_id, balance_cents FROM wallets WHERE user_id IN (24,27)');
  console.table(w.rows);
  await db.end();
  console.log('✅ Saldo atualizado: R$5.000 em balance + R$5.000 em wallet_cents para id 24 e 27');
})();
