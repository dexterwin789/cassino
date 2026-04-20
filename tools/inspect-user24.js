require('dotenv').config();
const { query, pool } = require('../src/config/database');

(async () => {
  const u = await query(
    `SELECT id, username, email, name, referred_by, balance, bonus, created_at
     FROM users
     WHERE id = 24
        OR email = $1
        OR username = $2
        OR email ILIKE $3
     ORDER BY id LIMIT 10`,
    ['karlosenrique367@gmail.com', 'karlosenrique367', '%karlosenrique%']
  );
  console.log('\n=== USER 24 ===');
  console.log(JSON.stringify(u.rows, null, 2));

  const a = await query('SELECT * FROM affiliates WHERE user_id = 24');
  console.log('\n=== AFFILIATE ROW (user_id=24) ===');
  console.log(JSON.stringify(a.rows, null, 2));

  const r = await query(
    `SELECT id, username, email, balance, created_at
     FROM users WHERE referred_by = 24 ORDER BY id DESC LIMIT 20`
  );
  console.log('\n=== REFERRED USERS (count =', r.rowCount, ') ===');
  console.log(JSON.stringify(r.rows, null, 2));

  const comm = await query(
    `SELECT ac.*, u.username AS referred_username
     FROM affiliate_commissions ac
     LEFT JOIN users u ON u.id = ac.referred_user_id
     WHERE ac.affiliate_id IN (SELECT id FROM affiliates WHERE user_id = 24)
     ORDER BY ac.id DESC LIMIT 10`
  );
  console.log('\n=== COMMISSIONS (top 10) ===');
  console.log(JSON.stringify(comm.rows, null, 2));

  const sum = await query(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE referred_by = 24)::INT AS referred,
       (SELECT COUNT(*) FROM affiliate_commissions WHERE affiliate_id IN (SELECT id FROM affiliates WHERE user_id = 24))::INT AS comm,
       (SELECT COALESCE(SUM(amount_cents),0) FROM affiliate_commissions WHERE affiliate_id IN (SELECT id FROM affiliates WHERE user_id = 24) AND status = 'paid')::BIGINT AS earned_cents,
       (SELECT COUNT(*) FROM transactions t WHERE t.user_id IN (SELECT id FROM users WHERE referred_by = 24) AND t.status='paid')::INT AS paid_deposits,
       (SELECT COUNT(*) FROM bets WHERE user_id IN (SELECT id FROM users WHERE referred_by = 24))::INT AS bets_by_refs,
       (SELECT COALESCE(SUM(amount_cents),0) FROM bets WHERE user_id IN (SELECT id FROM users WHERE referred_by = 24) AND status = 'lost')::BIGINT AS bets_lost_cents
     `
  );
  console.log('\n=== SUMMARY FOR USER 24 ===');
  console.log(JSON.stringify(sum.rows[0], null, 2));

  await pool.end();
})();
