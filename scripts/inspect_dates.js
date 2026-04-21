const { Pool } = require('pg');
const p = new Pool({
  connectionString: 'postgresql://postgres:FSSRyVSBeEIjJNkmHTspwcGbuQyGoEdj@interchange.proxy.rlwy.net:11184/railway',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  const now = await p.query("SELECT NOW() AS server_now, CURRENT_DATE AS today, CURRENT_DATE - INTERVAL '1 day' AS yesterday, current_setting('TIMEZONE') AS tz");
  console.log('SERVER:', now.rows[0]);

  const leads = await p.query("SELECT id, username, created_at FROM users WHERE referred_by = 24 ORDER BY created_at DESC");
  console.log('LEADS:', leads.rows);

  const bets = await p.query("SELECT id, user_id, amount_cents, payout_cents, status, created_at FROM bets WHERE user_id = 24 ORDER BY created_at DESC LIMIT 5");
  console.log('BETS (user 24, latest 5):', bets.rows);

  const tx = await p.query("SELECT id, type, status, amount_cents, created_at FROM transactions WHERE user_id = 24 ORDER BY created_at DESC LIMIT 5");
  console.log('TX (user 24, latest 5):', tx.rows);

  const lh = await p.query("SELECT column_name FROM information_schema.columns WHERE table_name='login_history' ORDER BY ordinal_position");
  console.log('LOGIN_HISTORY cols:', lh.rows.map(x => x.column_name).join(','));

  const lhData = await p.query("SELECT * FROM login_history WHERE user_id = 24 ORDER BY created_at DESC LIMIT 3");
  console.log('LOGIN_HISTORY user 24:', lhData.rows);

  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
