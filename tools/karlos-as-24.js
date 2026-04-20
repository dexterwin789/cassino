// Usage: railway run node tools/karlos-as-24.js
// Overwrites user ID 24 with karlos identity and seeds 15 leads
// so logging in as ID 24 shows the full affiliate demo.
require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('../src/config/database');

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const TARGET_ID = 24;
    const email = 'karlosenrique367@gmail.com';
    const username = 'karlosenrique367';
    const name = 'Karlos Enrique';
    const cpf = '11122233344';
    const phone = '11999990000';
    const hash = await bcrypt.hash('123456', 10);

    // Overwrite user ID 24
    const u = await client.query(
      `UPDATE users
         SET email = $1, username = $2, name = $3, cpf = $4, phone = $5,
             password_hash = $6, referred_by = NULL
       WHERE id = $7
       RETURNING id`,
      [email, username, name, cpf, phone, hash, TARGET_ID]
    );
    if (!u.rows.length) throw new Error('User 24 not found — seed base data first');

    // Ensure wallet
    await client.query(
      'INSERT INTO wallets (user_id, balance_cents) VALUES ($1, 0) ON CONFLICT (user_id) DO NOTHING',
      [TARGET_ID]
    );

    // Ensure affiliate row for user 24
    await client.query(
      `INSERT INTO affiliates (user_id, code, commission_pct, total_earned_cents, is_active)
       VALUES ($1, $2, 50, 0, TRUE)
       ON CONFLICT (user_id) DO UPDATE
         SET code = EXCLUDED.code, commission_pct = EXCLUDED.commission_pct, is_active = TRUE`,
      [TARGET_ID, 'karlos24']
    );
    const aff = await client.query('SELECT id FROM affiliates WHERE user_id = $1', [TARGET_ID]);
    const affiliateId = aff.rows[0].id;

    // Wipe any previous demo leads under ID 24
    const prev = await client.query(
      `SELECT id FROM users WHERE username LIKE 'ref_k24_%' OR username LIKE 'ref_k367_%'`
    );
    const prevIds = prev.rows.map(r => r.id);
    if (prevIds.length) {
      await client.query('DELETE FROM affiliate_commissions WHERE referred_user_id = ANY($1)', [prevIds]);
      await client.query('DELETE FROM wallets WHERE user_id = ANY($1)', [prevIds]);
      await client.query('DELETE FROM users WHERE id = ANY($1)', [prevIds]);
    }

    // Seed 15 leads — 10 depositors (5 big, 5 small), 5 only registered
    const leads = [];
    const firstNames = ['Lucas', 'Mateus', 'Rafael', 'Pedro', 'João', 'Gabriel', 'Bruno', 'Thiago', 'Diego', 'Felipe', 'Ana', 'Julia', 'Bianca', 'Camila', 'Larissa'];
    const lastNames = ['Silva', 'Souza', 'Oliveira', 'Costa', 'Pereira', 'Santos', 'Rocha', 'Gomes', 'Alves', 'Lima', 'Nunes', 'Ribeiro', 'Carvalho', 'Barbosa', 'Araujo'];
    const userHash = await bcrypt.hash('lead123', 10);

    for (let i = 0; i < 15; i++) {
      const fn = firstNames[i], ln = lastNames[i];
      const uname = `ref_k24_${i.toString().padStart(2, '0')}`;
      const r = await client.query(
        `INSERT INTO users (username, name, email, phone, cpf, password_hash, referred_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - (INTERVAL '1 day' * $8))
         RETURNING id`,
        [uname, `${fn} ${ln}`, `${uname}@demo.local`, `1199990${i.toString().padStart(4,'0')}`, `0000000${i.toString().padStart(4,'0')}`, userHash, TARGET_ID, Math.floor(Math.random() * 60) + 1]
      );
      const uid = r.rows[0].id;
      leads.push({ id: uid, index: i });
      await client.query('INSERT INTO wallets (user_id, balance_cents) VALUES ($1, 0) ON CONFLICT (user_id) DO NOTHING', [uid]);
    }

    // First 10 are depositors
    const depositors = leads.slice(0, 10);

    let totalEarned = 0;

    for (const lead of depositors) {
      const depCount = lead.index < 5 ? 3 + Math.floor(Math.random() * 4) : 1 + Math.floor(Math.random() * 2);
      for (let d = 0; d < depCount; d++) {
        const amountCents = lead.index < 5 ? (5000 + Math.floor(Math.random() * 20000)) : (2000 + Math.floor(Math.random() * 5000));
        const daysAgo = Math.floor(Math.random() * 45) + 1;
        const txR = await client.query(
          `INSERT INTO transactions (user_id, type, status, amount_cents, provider, created_at, updated_at)
           VALUES ($1, 'deposit', 'paid', $2, 'demo', NOW() - (INTERVAL '1 day' * $3), NOW() - (INTERVAL '1 day' * $3))
           RETURNING id`,
          [lead.id, amountCents, daysAgo]
        );
        // Simulate revshare commissions on losing bets: ~8-15 losing bets per lead per deposit period
        const betCount = 6 + Math.floor(Math.random() * 12);
        for (let b = 0; b < betCount; b++) {
          const betAmt = 500 + Math.floor(Math.random() * 3000);
          const commission = Math.round(betAmt * 0.5); // 50% revshare
          totalEarned += commission;
          await client.query(
            `INSERT INTO affiliate_commissions (affiliate_id, referred_user_id, bet_id, amount_cents, status, type, created_at)
             VALUES ($1, $2, NULL, $3, 'pending', 'revshare', NOW() - (INTERVAL '1 day' * $4) - (INTERVAL '1 hour' * $5))`,
            [affiliateId, lead.id, commission, daysAgo, b]
          );
        }
      }
    }

    await client.query('UPDATE affiliates SET total_earned_cents = $1 WHERE id = $2', [totalEarned, affiliateId]);

    // Set platform defaults: RevShare mode @ 50%
    const kv = [
      ['aff_commission_type', 'revshare'],
      ['aff_revshare_enabled', '1'],
      ['aff_revshare_pct', '50'],
      ['aff_referral_bonus', '5000'],
      ['aff_min_deposit', '2000'],
      ['aff_min_withdrawal', '5000'],
      ['aff_default_commission', '50'],
      ['aff_auto_approve', '1']
    ];
    for (const [k, v] of kv) {
      await client.query(
        `INSERT INTO platform_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [k, v]
      );
    }

    await client.query('COMMIT');
    console.log('✔ User 24 → karlosenrique367@gmail.com / 123456');
    console.log('✔ Affiliate code: karlos24 (50% RevShare)');
    console.log(`✔ 15 leads seeded, 10 depositors, total earned R$${(totalEarned/100).toFixed(2)}`);
    console.log('✔ Platform switched to RevShare 50%');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
