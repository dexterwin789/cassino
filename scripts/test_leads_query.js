const { Pool } = require('pg');
const p = new Pool({
  connectionString: 'postgresql://postgres:FSSRyVSBeEIjJNkmHTspwcGbuQyGoEdj@interchange.proxy.rlwy.net:11184/railway',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  const r = await p.query(`
    SELECT u.id, u.username, u.name, u.email, u.created_at,
      COALESCE((SELECT SUM(amount_cents) FROM transactions WHERE user_id = u.id AND status = 'paid' AND type IN ('deposit','pix_in')), 0) AS deposited_cents,
      COALESCE((SELECT COUNT(*)::int FROM bets WHERE user_id = u.id), 0) AS bets_count,
      COALESCE((SELECT SUM(amount_cents) FROM bets WHERE user_id = u.id), 0) AS bets_volume_cents,
      COALESCE((
        SELECT SUM(ac.amount_cents)
        FROM affiliate_commissions ac
        JOIN affiliates a ON a.id = ac.affiliate_id
        WHERE a.user_id = $1 AND ac.referred_user_id = u.id
      ), 0) AS commission_cents
    FROM users u
    WHERE u.referred_by = $1
    ORDER BY u.created_at DESC
    LIMIT 500
  `, [24]);
  console.log(JSON.stringify(r.rows, null, 2));
  await p.end();
})().catch(e => { console.error(e.message); process.exit(1); });
