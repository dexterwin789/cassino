/**
 * Seed data for karlosenrique367@gmail.com (the account the user logs into).
 * Creates (or reuses) the user, makes them an affiliate, and populates:
 *  - 15 referred users (mix of depositors + non-depositors)
 *  - deposits + bets (won/lost/partial)
 *  - deposit commissions + revshare commissions
 * Idempotent: will NOT duplicate commissions/txns with the same idempotent key.
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const { query, pool } = require('../src/config/database');

const TARGET_EMAIL = 'karlosenrique367@gmail.com';
const TARGET_USERNAME = 'karlosenrique367';
const TARGET_PASSWORD = '123456';
const TARGET_NAME = 'Karlos Enrique';
const AFF_CODE = 'KARLOS367';
const AFF_PCT = 15; // 15%

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function main() {
  console.log('[SEED-KARLOS] Start');

  // 1. Upsert master user
  let u = await query('SELECT id FROM users WHERE email = $1 OR username = $2 LIMIT 1', [TARGET_EMAIL, TARGET_USERNAME]);
  let karlosId;
  if (u.rows[0]) {
    karlosId = u.rows[0].id;
    console.log('[SEED-KARLOS] Found existing user id=' + karlosId);
    // Ensure email + password are set
    const hash = await bcrypt.hash(TARGET_PASSWORD, 10);
    await query('UPDATE users SET email = $1, username = $2, name = $3, password_hash = $4 WHERE id = $5',
      [TARGET_EMAIL, TARGET_USERNAME, TARGET_NAME, hash, karlosId]);
  } else {
    const hash = await bcrypt.hash(TARGET_PASSWORD, 10);
    const ins = await query(
      `INSERT INTO users (username, email, name, password_hash, phone, cpf, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
      [TARGET_USERNAME, TARGET_EMAIL, TARGET_NAME, hash, '11999990000', '00000000000']
    );
    karlosId = ins.rows[0].id;
    console.log('[SEED-KARLOS] Created user id=' + karlosId);
  }

  // 2. Ensure wallet
  await query('INSERT INTO wallets (user_id, balance_cents) VALUES ($1, 0) ON CONFLICT (user_id) DO NOTHING', [karlosId]);

  // 3. Upsert affiliate row
  let aff = await query('SELECT id FROM affiliates WHERE user_id = $1', [karlosId]);
  let affiliateId;
  if (aff.rows[0]) {
    affiliateId = aff.rows[0].id;
    await query('UPDATE affiliates SET code = $1, commission_pct = $2, is_active = TRUE WHERE id = $3',
      [AFF_CODE, AFF_PCT, affiliateId]);
  } else {
    const ins = await query(
      `INSERT INTO affiliates (user_id, code, commission_pct, total_earned_cents, is_active)
       VALUES ($1, $2, $3, 0, TRUE) RETURNING id`,
      [karlosId, AFF_CODE, AFF_PCT]
    );
    affiliateId = ins.rows[0].id;
  }
  console.log('[SEED-KARLOS] Affiliate id=' + affiliateId);

  // 4. Create 15 referred users (idempotent by username pattern)
  const firstNames = ['Lucas', 'Bruno', 'Rafael', 'Matheus', 'Gabriel', 'Thiago', 'Pedro', 'Carlos', 'Rodrigo', 'Felipe', 'Juliana', 'Amanda', 'Beatriz', 'Camila', 'Larissa'];
  const lastNames = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Alves', 'Pereira', 'Costa', 'Rodrigues', 'Ferreira'];
  const referredIds = [];

  for (let i = 0; i < 15; i++) {
    const uname = 'ref_k367_' + (i + 1);
    const name = firstNames[i % firstNames.length] + ' ' + pick(lastNames);
    const email = uname + '@test.local';

    let ru = await query('SELECT id FROM users WHERE username = $1 LIMIT 1', [uname]);
    let rid;
    if (ru.rows[0]) {
      rid = ru.rows[0].id;
      await query('UPDATE users SET referred_by = $1, name = $2, email = $3 WHERE id = $4', [karlosId, name, email, rid]);
    } else {
      const hash = await bcrypt.hash('123456', 10);
      const days = randomInt(1, 45);
      const ins = await query(
        `INSERT INTO users (username, email, name, password_hash, phone, cpf, referred_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - ($8 || ' days')::INTERVAL) RETURNING id`,
        [uname, email, name, hash, '11988880000', String(40000000000 + i).padStart(11, '0'), karlosId, days]
      );
      rid = ins.rows[0].id;
      await query('INSERT INTO wallets (user_id, balance_cents) VALUES ($1, 0) ON CONFLICT (user_id) DO NOTHING', [rid]);
    }
    referredIds.push(rid);
  }
  console.log('[SEED-KARLOS] Referred users: ' + referredIds.length);

  // 5. For ~70% of referred users: create deposit transaction + deposit commission
  const REFERRAL_BONUS_CENTS = 5000;
  const MIN_DEPOSIT_CENTS = 2000;
  let depositsCreated = 0;
  let commissionsCreated = 0;

  for (const rid of referredIds) {
    if (Math.random() > 0.7) continue; // skip ~30%

    const nDeposits = randomInt(1, 3);
    for (let d = 0; d < nDeposits; d++) {
      const amtCents = randomInt(50, 500) * 100; // R$50 - R$500
      const daysAgo = randomInt(0, 30);
      const extTxnId = 'karlos_seed_' + rid + '_' + d;

      // Skip if this idempotent txn already exists
      const existing = await query(
        "SELECT id FROM transactions WHERE user_id = $1 AND provider_ref = $2 LIMIT 1",
        [rid, extTxnId]
      );
      let txId;
      if (existing.rows[0]) {
        txId = existing.rows[0].id;
      } else {
        const insT = await query(
          `INSERT INTO transactions (user_id, type, amount_cents, status, provider, provider_ref, created_at, updated_at)
           VALUES ($1, 'deposit', $2, 'paid', 'seed', $3, NOW() - ($4 || ' days')::INTERVAL, NOW() - ($4 || ' days')::INTERVAL)
           RETURNING id`,
          [rid, amtCents, extTxnId, daysAgo]
        );
        txId = insT.rows[0].id;
        depositsCreated++;
      }

      // Commission (deposit type)
      const commExists = await query('SELECT id FROM affiliate_commissions WHERE transaction_id = $1', [txId]);
      if (!commExists.rows[0] && amtCents >= MIN_DEPOSIT_CENTS) {
        const commCents = Math.floor(amtCents * AFF_PCT / 100);
        const status = daysAgo > 7 ? 'paid' : 'pending';
        await query(
          `INSERT INTO affiliate_commissions (affiliate_id, referred_user_id, transaction_id, amount_cents, status, type, created_at)
           VALUES ($1, $2, $3, $4, $5, 'deposit', NOW() - ($6 || ' days')::INTERVAL)`,
          [affiliateId, rid, txId, commCents, status, daysAgo]
        );
        commissionsCreated++;
      }
    }
  }

  // 6. Bets: add some bets for referred users (mix of won/lost/partial)
  let betsCreated = 0;
  let revshareCreated = 0;
  const gamesR = await query('SELECT id FROM games WHERE is_active = TRUE ORDER BY RANDOM() LIMIT 20');
  const gameIds = gamesR.rows.map(r => r.id);

  // revshare default 5%
  const REVSHARE_PCT = 5;

  for (const rid of referredIds) {
    const nBets = randomInt(0, 30);
    for (let b = 0; b < nBets; b++) {
      const gameId = gameIds.length ? pick(gameIds) : null;
      const betCents = randomInt(5, 100) * 100; // R$5 - R$100
      const roll = Math.random();
      let status, winCents;
      if (roll < 0.55) { status = 'lost'; winCents = 0; }
      else if (roll < 0.85) { status = 'partial'; winCents = Math.floor(betCents * randomInt(30, 80) / 100); }
      else { status = 'won'; winCents = betCents * randomInt(2, 4); }

      const daysAgo = randomInt(0, 20);
      const ins = await query(
        `INSERT INTO bets (user_id, game_id, round_id, amount_cents, payout_cents, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW() - ($7 || ' days')::INTERVAL)
         RETURNING id`,
        [rid, gameId, 0, betCents, winCents, status, daysAgo]
      );
      betsCreated++;

      // Revshare commission for lost bets (seed them regardless of toggle — toggle only affects runtime generation)
      if (status === 'lost') {
        const commCents = Math.floor(betCents * REVSHARE_PCT / 100);
        if (commCents > 0) {
          const commStatus = daysAgo > 7 ? 'paid' : 'pending';
          await query(
            `INSERT INTO affiliate_commissions (affiliate_id, referred_user_id, bet_id, amount_cents, status, type, created_at)
             VALUES ($1, $2, $3, $4, $5, 'revshare', NOW() - ($6 || ' days')::INTERVAL)`,
            [affiliateId, rid, ins.rows[0].id, commCents, commStatus, daysAgo]
          );
          revshareCreated++;
        }
      }
    }
  }

  // 7. Update total_earned on affiliate
  await query(
    `UPDATE affiliates SET total_earned_cents = (
       SELECT COALESCE(SUM(amount_cents),0) FROM affiliate_commissions WHERE affiliate_id = $1 AND status = 'paid'
     ) WHERE id = $1`,
    [affiliateId]
  );

  // Summary
  const summary = await query(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE referred_by = $1) AS referred_total,
      (SELECT COUNT(DISTINCT user_id) FROM transactions WHERE status = 'paid' AND type = 'deposit' AND user_id IN (SELECT id FROM users WHERE referred_by = $1)) AS depositors,
      (SELECT COUNT(*) FROM affiliate_commissions WHERE affiliate_id = $2) AS total_commissions,
      (SELECT COALESCE(SUM(amount_cents),0) FROM affiliate_commissions WHERE affiliate_id = $2 AND status = 'paid') AS paid_cents,
      (SELECT COALESCE(SUM(amount_cents),0) FROM affiliate_commissions WHERE affiliate_id = $2 AND status = 'pending') AS pending_cents,
      (SELECT COUNT(*) FROM affiliate_commissions WHERE affiliate_id = $2 AND type = 'deposit') AS deposit_comm,
      (SELECT COUNT(*) FROM affiliate_commissions WHERE affiliate_id = $2 AND type = 'revshare') AS revshare_comm
  `, [karlosId, affiliateId]);

  console.log('\n============ RESULT ============');
  console.log('User: ' + TARGET_EMAIL + ' / password: ' + TARGET_PASSWORD);
  console.log('User ID: ' + karlosId + ' | Affiliate ID: ' + affiliateId + ' | Code: ' + AFF_CODE);
  console.log('Referred users: ' + summary.rows[0].referred_total);
  console.log('Depositors: ' + summary.rows[0].depositors);
  console.log('Deposits created this run: ' + depositsCreated);
  console.log('Deposit commissions created: ' + commissionsCreated);
  console.log('Bets created: ' + betsCreated);
  console.log('Revshare commissions created: ' + revshareCreated);
  console.log('Total commissions: ' + summary.rows[0].total_commissions + ' (' + summary.rows[0].deposit_comm + ' deposit + ' + summary.rows[0].revshare_comm + ' revshare)');
  console.log('Paid: R$ ' + (parseInt(summary.rows[0].paid_cents) / 100).toFixed(2));
  console.log('Pending: R$ ' + (parseInt(summary.rows[0].pending_cents) / 100).toFixed(2));
  console.log('================================\n');

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
