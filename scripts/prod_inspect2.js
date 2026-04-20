const { Client } = require('pg');
const URL = 'postgresql://postgres:FSSRyVSBeEIjJNkmHTspwcGbuQyGoEdj@interchange.proxy.rlwy.net:11184/railway';

(async () => {
  const db = new Client({ connectionString: URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  for (const t of ['wallets','sessions','affiliates']) {
    const c = await db.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [t]);
    console.log(`\n== ${t} ==`);
    console.log(c.rows.map(r=>`  ${r.column_name} (${r.data_type})`).join('\n'));
  }

  // wallet for 24
  try {
    const w = await db.query(`SELECT * FROM wallets WHERE user_id=24`);
    console.log('\nWallet 24:', w.rows);
  } catch(e) { console.log('wallet err:', e.message); }

  // Check how bets are linked to casino vs sport
  const b = await db.query(`SELECT id, game_id, amount_cents, payout_cents, status, created_at FROM bets WHERE user_id=24 ORDER BY id DESC LIMIT 3`);
  console.log('\nBets sample:', b.rows);

  // Existing users with referred_by=24
  const r = await db.query(`SELECT id, email, cpf, balance, referred_by FROM users WHERE referred_by=24`);
  console.log('\nLeads of 24:', r.rows);

  // Transactions sample
  const t = await db.query(`SELECT id, type, status, amount_cents, created_at FROM transactions WHERE user_id=24 ORDER BY id DESC`);
  console.log('\nTransactions 24:', t.rows);

  // games list
  const g = await db.query(`SELECT id, game_code, game_name FROM games ORDER BY id LIMIT 5`);
  console.log('\nGames:', g.rows);

  await db.end();
})().catch(e => { console.error(e); process.exit(1); });
