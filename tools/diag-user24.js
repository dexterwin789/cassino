require('dotenv').config();
const { pool } = require('../src/config/database');
(async () => {
  try {
    const u = await pool.query("SELECT id, username, email, name, referred_by FROM users WHERE id = 24");
    console.log('User 24:', JSON.stringify(u.rows[0], null, 2));

    const leads = await pool.query("SELECT id, username, name, created_at FROM users WHERE referred_by = 24 ORDER BY id");
    console.log('\nLeads (referred_by=24):', leads.rows.length);
    leads.rows.slice(0,5).forEach(r => console.log(`  #${r.id} ${r.username} ${r.name}`));

    const bets = await pool.query("SELECT COUNT(*) AS c FROM bets WHERE user_id = 24");
    console.log('\nBets of user 24:', bets.rows[0].c);

    const tx = await pool.query("SELECT id, type, status, amount_cents, created_at FROM transactions WHERE user_id = 24 ORDER BY id DESC LIMIT 5");
    console.log('\nTransactions of user 24:', tx.rows.length);
    tx.rows.forEach(r => console.log(`  #${r.id} ${r.type} ${r.status} ${r.amount_cents}`));

    const aff = await pool.query("SELECT a.id, a.code, a.is_active, a.total_earned_cents FROM affiliates a WHERE a.user_id = 24");
    console.log('\nAffiliate row:', aff.rows[0]);

    const comm = await pool.query("SELECT COUNT(*) AS c, SUM(amount_cents) AS total FROM affiliate_commissions WHERE affiliate_id = (SELECT id FROM affiliates WHERE user_id=24)");
    console.log('\nCommissions:', comm.rows[0]);

    const settings = await pool.query("SELECT key, value FROM platform_settings WHERE key LIKE 'aff_%' ORDER BY key");
    console.log('\nAff settings:');
    settings.rows.forEach(r => console.log(`  ${r.key} = ${r.value}`));
  } catch (e) { console.error(e); }
  finally { await pool.end(); }
})();
