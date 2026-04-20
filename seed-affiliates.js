// seed-affiliates.js — Populates affiliate system with realistic data end-to-end:
//   - 8 affiliates (different commission tiers)
//   - 10-25 referred users per affiliate (users.referred_by set)
//   - Deposits (transactions paid) per referred user
//   - affiliate_commissions row per deposit (paid/pending)
//   - Bets from referred users
//   - total_earned_cents recomputed from commissions
// Run: railway run node seed-affiliates.js   OR   node seed-affiliates.js
require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool, query } = require('./src/config/database');

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const AFFILIATES = [
  { username: 'karlos',       code: 'KARLOS10',   pct: 10 },
  { username: 'maria_bet',    code: 'MARIA20',    pct: 20 },
  { username: 'ana_vip',      code: 'ANAPRO15',   pct: 15 },
  { username: 'lucastop',     code: 'LUCASVIP25', pct: 25 },
  { username: 'bruno_slot',   code: 'BRUNO08',    pct: 8  },
  { username: 'rafaella',     code: 'RAFAVIP',    pct: 12 },
  { username: 'pedro_pro',    code: 'PEDRO5',     pct: 5  },
  { username: 'vip_player',   code: 'VIP30',      pct: 30 }
];

const FIRST_NAMES = ['João','Pedro','Maria','Ana','Carlos','Lucas','Felipe','Julia','Bruno','Rafaela','Gabriel','Marina','Rodrigo','Camila','Thiago','Bianca','Eduardo','Larissa','Diego','Natalia','Fernando','Patricia','Gustavo','Isabela','Ricardo','Amanda','Vinicius','Carolina','Marcelo','Priscila'];
const LAST_NAMES = ['Silva','Santos','Oliveira','Souza','Lima','Pereira','Costa','Almeida','Rodrigues','Ferreira','Ribeiro','Alves','Carvalho','Gomes','Martins','Rocha','Dias','Nascimento','Melo','Araujo'];

function fakeCPF() {
  return String(rand(10000000000, 99999999999));
}
function fakePhone() {
  return String(rand(11, 99)) + String(rand(900000000, 999999999));
}

async function seed() {
  console.log('[SEED-AFF] Starting...');
  const pass = await bcrypt.hash('123456', 10);

  // ── Platform settings ──────────────────────────
  const settings = {
    aff_default_commission: '10',
    aff_min_deposit:        '2000',  // 20 reais in cents
    aff_cookie_days:        '30',
    aff_auto_approve:       '1',
    aff_referral_bonus:     '5000',  // 50 reais in cents
    aff_max_affiliates:     '0',
    aff_min_withdrawal:     '5000'   // 50 reais in cents
  };
  for (const [k, v] of Object.entries(settings)) {
    await query(
      `INSERT INTO platform_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [k, v]
    );
  }
  console.log('[SEED-AFF] Platform settings OK');

  // ── Ensure base users exist ────────────────────
  for (const a of AFFILIATES) {
    const exists = await query('SELECT id FROM users WHERE username = $1', [a.username]);
    if (exists.rows.length === 0) {
      await query(
        `INSERT INTO users (username, name, phone, email, cpf, password_hash, balance)
         VALUES ($1, $2, $3, $4, $5, $6, 100)
         ON CONFLICT (username) DO NOTHING`,
        [a.username, a.username, fakePhone(), `${a.username}@vemnabet.bet`, fakeCPF(), pass]
      );
    }
  }

  // ── Clear previous affiliate + related data (idempotent) ──
  await query(`DELETE FROM affiliate_commissions`);
  await query(`DELETE FROM affiliates`);
  // Keep referred_by relationships cleared only for users that still exist and will be replaced
  await query(`UPDATE users SET referred_by = NULL WHERE referred_by IS NOT NULL`);
  // Clear previously-seeded demo referred users to avoid bloat
  await query(`DELETE FROM users WHERE username LIKE 'ref_%'`);
  console.log('[SEED-AFF] Cleared old affiliate data');

  // ── Create affiliates ──────────────────────────
  const affList = [];
  for (const a of AFFILIATES) {
    const u = await query('SELECT id FROM users WHERE username = $1', [a.username]);
    if (u.rows.length === 0) continue;
    const userId = u.rows[0].id;
    const r = await query(
      `INSERT INTO affiliates (user_id, code, commission_pct, total_earned_cents, is_active)
       VALUES ($1, $2, $3, 0, TRUE)
       RETURNING id, user_id, code, commission_pct`,
      [userId, a.code, a.pct]
    );
    affList.push(r.rows[0]);
  }
  console.log(`[SEED-AFF] ${affList.length} affiliates created`);

  // ── Create referred users + transactions + commissions + bets ──
  let totalRef = 0;
  let totalTx = 0;
  let totalComm = 0;
  let totalBets = 0;
  let globalIdx = 0;

  // Get some game ids to assign bets to
  const gamesR = await query('SELECT id FROM games WHERE is_active = TRUE LIMIT 30');
  const gameIds = gamesR.rows.map(g => g.id);

  for (const aff of affList) {
    const numRefs = rand(10, 25);
    for (let i = 0; i < numRefs; i++) {
      globalIdx++;
      const fname = pick(FIRST_NAMES);
      const lname = pick(LAST_NAMES);
      const username = `ref_${aff.code.toLowerCase()}_${i}_${globalIdx}`;
      const name = `${fname} ${lname}`;
      const email = `${fname.toLowerCase()}.${lname.toLowerCase()}${globalIdx}@gmail.com`;
      const daysAgo = rand(1, 90);

      const ur = await query(
        `INSERT INTO users (username, name, phone, email, cpf, password_hash, balance, referred_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 0, $7, NOW() - ($8 || ' days')::INTERVAL)
         RETURNING id`,
        [username, name, fakePhone(), email, fakeCPF(), pass, aff.user_id, daysAgo]
      );
      const refUserId = ur.rows[0].id;
      totalRef++;

      // Wallet
      await query(
        `INSERT INTO wallets (user_id, balance_cents) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET balance_cents = EXCLUDED.balance_cents`,
        [refUserId, rand(0, 50000)]
      );

      // Transactions (deposits)
      const numDeposits = rand(1, 8);
      for (let j = 0; j < numDeposits; j++) {
        const amt = pick([2000, 3000, 5000, 10000, 20000, 50000, 100000, 25000, 15000]); // cents
        const status = Math.random() < 0.85 ? 'paid' : pick(['pending','failed']);
        const txDaysAgo = rand(0, daysAgo);
        const txR = await query(
          `INSERT INTO transactions (user_id, type, status, amount_cents, provider, provider_ref, created_at)
           VALUES ($1, 'deposit', $2, $3, 'blackcat', $4, NOW() - ($5 || ' days')::INTERVAL)
           RETURNING id`,
          [refUserId, status, amt, `seed-tx-${refUserId}-${j}-${Date.now()}-${globalIdx}`, txDaysAgo]
        );
        totalTx++;

        // Commission only if deposit is paid and >= min deposit
        const minDep = parseInt(settings.aff_min_deposit);
        if (status === 'paid' && amt >= minDep) {
          const commAmt = Math.floor(amt * (parseFloat(aff.commission_pct) / 100));
          const commStatus = Math.random() < 0.7 ? 'paid' : 'pending';
          await query(
            `INSERT INTO affiliate_commissions (affiliate_id, referred_user_id, transaction_id, amount_cents, status, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW() - ($6 || ' days')::INTERVAL)`,
            [aff.id, refUserId, txR.rows[0].id, commAmt, commStatus, txDaysAgo]
          );
          totalComm++;
        }
      }

      // Bets
      const numBets = rand(0, 15);
      for (let b = 0; b < numBets; b++) {
        if (gameIds.length === 0) break;
        const gameId = pick(gameIds);
        const betAmt = pick([500, 1000, 2000, 5000, 10000, 20000]); // cents
        const won = Math.random() < 0.40;
        const mult = won ? (Math.random() * 5 + 1).toFixed(2) : 0;
        const payout = won ? Math.floor(betAmt * parseFloat(mult)) : 0;
        const betStatus = won ? 'won' : 'lost';
        const betDaysAgo = rand(0, daysAgo);
        await query(
          `INSERT INTO bets (user_id, game_id, amount_cents, payout_cents, multiplier, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW() - ($7 || ' days')::INTERVAL)`,
          [refUserId, gameId, betAmt, payout, mult, betStatus, betDaysAgo]
        );
        totalBets++;
      }
    }
  }

  // ── Recompute total_earned_cents per affiliate ────
  await query(`
    UPDATE affiliates a SET total_earned_cents = COALESCE((
      SELECT SUM(amount_cents) FROM affiliate_commissions
      WHERE affiliate_id = a.id AND status = 'paid'
    ), 0)
  `);

  // ── Summary ──────────────────────────────────
  const summary = await query(`
    SELECT
      (SELECT COUNT(*) FROM affiliates)::INT AS affiliates,
      (SELECT COUNT(*) FROM affiliate_commissions)::INT AS commissions,
      (SELECT COUNT(*) FROM affiliate_commissions WHERE status='paid')::INT AS paid_comm,
      (SELECT COALESCE(SUM(amount_cents),0) FROM affiliate_commissions WHERE status='paid')::BIGINT AS paid_cents,
      (SELECT COUNT(*) FROM users WHERE referred_by IS NOT NULL)::INT AS referred_users,
      (SELECT COUNT(*) FROM transactions WHERE type='deposit' AND status='paid')::INT AS paid_deposits,
      (SELECT COALESCE(SUM(amount_cents),0) FROM transactions WHERE type='deposit' AND status='paid')::BIGINT AS deposits_cents
  `);

  const s = summary.rows[0];
  console.log('\n──────── AFFILIATES SEED SUMMARY ────────');
  console.log('Affiliates:       ', s.affiliates);
  console.log('Referred users:   ', s.referred_users, ` (this run created ${totalRef})`);
  console.log('Deposits:         ', s.paid_deposits, ` (this run created ${totalTx} tx rows)`);
  console.log('Deposits volume:  ', `R$ ${(Number(s.deposits_cents)/100).toFixed(2)}`);
  console.log('Commissions rows: ', s.commissions, ` (this run created ${totalComm})`);
  console.log('Paid commissions: ', s.paid_comm);
  console.log('Commissions paid: ', `R$ ${(Number(s.paid_cents)/100).toFixed(2)}`);
  console.log('Bets created:     ', totalBets);
  console.log('─────────────────────────────────────────\n');

  // List top affiliates
  const top = await query(`
    SELECT a.code, u.username, a.commission_pct, a.total_earned_cents,
      (SELECT COUNT(*) FROM users WHERE referred_by = a.user_id)::INT AS refs,
      (SELECT COUNT(*) FROM affiliate_commissions WHERE affiliate_id = a.id)::INT AS comm_count
    FROM affiliates a JOIN users u ON u.id = a.user_id
    ORDER BY a.total_earned_cents DESC
  `);
  console.log('Top affiliates:');
  top.rows.forEach(r => {
    console.log(`  ${r.code.padEnd(12)} (${r.username.padEnd(12)}) ${r.commission_pct}% | refs=${r.refs} | commissions=${r.comm_count} | earned=R$ ${(Number(r.total_earned_cents)/100).toFixed(2)}`);
  });

  await pool.end();
  console.log('\n[SEED-AFF] Done.');
}

seed().catch(err => {
  console.error('[SEED-AFF] ERROR:', err);
  process.exit(1);
});
