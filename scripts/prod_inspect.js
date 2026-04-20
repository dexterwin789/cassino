// Seed PROD DB (beautiful-essence) - user 24 karlosenrique367@gmail.com
const { Client } = require('pg');
const URL = 'postgresql://postgres:FSSRyVSBeEIjJNkmHTspwcGbuQyGoEdj@interchange.proxy.rlwy.net:11184/railway';

(async () => {
  const db = new Client({ connectionString: URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  // 1) Check tables
  const tbls = await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1`);
  console.log('TABLES:', tbls.rows.map(r=>r.table_name).join(', '));

  // 2) Show current user 24
  const u = await db.query(`SELECT id, username, email, cpf, balance, bonus FROM users WHERE id=24`);
  console.log('USER 24:', u.rows[0]);

  // 3) Set balance R$5000 + bonus R$500
  await db.query(`UPDATE users SET balance=5000.00, bonus=500.00, updated_at=NOW() WHERE id=24`);
  await db.query(`UPDATE users SET balance=5000.00, bonus=500.00, updated_at=NOW() WHERE id=22`);

  // 4) Detect columns for bets/transactions/withdrawals
  for (const t of ['bets','transactions','withdrawals','games','user_leads','referrals']) {
    const c = await db.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [t]);
    console.log(`\n== ${t} ==`);
    console.log(c.rows.map(r=>`  ${r.column_name} (${r.data_type})`).join('\n') || '  (not found)');
  }

  // 5) Count current items for user 24
  for (const t of ['bets','transactions','withdrawals']) {
    try {
      const r = await db.query(`SELECT COUNT(*)::int AS n FROM ${t} WHERE user_id=24`);
      console.log(`user24 ${t}: ${r.rows[0].n}`);
    } catch(e) { console.log(`user24 ${t}: SKIP (${e.message})`); }
  }

  await db.end();
})().catch(e => { console.error(e); process.exit(1); });
