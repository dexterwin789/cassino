const { Pool } = require('pg');
const cs = process.env.DATABASE_URL;
const p = new Pool({ connectionString: cs, ssl: cs && cs.includes('proxy') ? { rejectUnauthorized: false } : false });

(async () => {
  const u = await p.query("SELECT id,email,referred_by,created_at FROM users WHERE id=52 OR email='amaralrlq2209@gmail.com'");
  console.log('USER', JSON.stringify(u.rows, null, 2));

  const w = await p.query("SELECT * FROM wallets WHERE user_id=52");
  console.log('WALLET', JSON.stringify(w.rows, null, 2));

  const t = await p.query("SELECT * FROM transactions WHERE user_id=52 ORDER BY id DESC LIMIT 20");
  console.log('TX', JSON.stringify(t.rows, null, 2));

  const af = await p.query("SELECT a.*, u.email FROM affiliates a JOIN users u ON u.id=a.user_id WHERE a.user_id=45");
  console.log('AFFILIATE_OF_REFERRER', JSON.stringify(af.rows, null, 2));

  const c = await p.query("SELECT * FROM affiliate_commissions WHERE referred_user_id=52 ORDER BY id DESC LIMIT 20");
  console.log('COMMISSIONS', JSON.stringify(c.rows, null, 2));

  const bets = await p.query("SELECT * FROM bets WHERE user_id=52 ORDER BY id DESC LIMIT 10");
  console.log('BETS', JSON.stringify(bets.rows, null, 2));

  const gt = await p.query("SELECT * FROM game_transactions WHERE user_id=52 ORDER BY id DESC LIMIT 20").catch(e=>({rows:['ERR '+e.message]}));
  console.log('GAME_TX', JSON.stringify(gt.rows, null, 2));

  const cols = await p.query("SELECT column_name FROM information_schema.columns WHERE table_name='affiliates' ORDER BY ordinal_position");
  console.log('AFFILIATES_COLS', cols.rows.map(r=>r.column_name).join(','));

  const cols2 = await p.query("SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position");
  console.log('USERS_COLS', cols2.rows.map(r=>r.column_name).join(','));

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
