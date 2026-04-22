#!/usr/bin/env node
/*
 * Seed realistic metrics for the affiliate dashboard.
 *
 * Popula (idempotente) — para CADA afiliado que tem leads:
 *  - affiliate_visits distribuídas nos últimos 90 dias
 *  - transactions deposits/pix_in para os leads em datas variadas
 *  - withdrawals (paid) esporádicos dos leads
 *  - affiliate_commissions (type='deposit' CPA + type='revshare') referentes aos depósitos
 *
 * Uso:
 *   DATABASE_URL=postgres://... node scripts/seed-affiliate-metrics.js
 *   (ou com railway run node scripts/seed-affiliate-metrics.js)
 *
 * É seguro rodar múltiplas vezes — usa contagem mínima antes de inserir
 * (se já houver dados históricos suficientes, pula).
 */
const { Pool } = require('pg');

const connStr = process.env.DATABASE_URL || process.env.PG_URL;
if (!connStr) {
  console.error('[seed] DATABASE_URL não definida.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: connStr,
  ssl: connStr.includes('localhost') ? false : { rejectUnauthorized: false }
});

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function daysAgoISO(d) {
  const now = new Date();
  const past = new Date(now.getTime() - d * 86400000);
  past.setHours(randInt(6, 22), randInt(0, 59), randInt(0, 59));
  return past.toISOString();
}

(async () => {
  const client = await pool.connect();
  try {
    console.log('[seed] conectado ao banco. Procurando afiliados com leads...');

    // Afiliados ativos que têm ao menos 1 lead
    const affs = await client.query(`
      SELECT a.id AS aff_id, a.user_id, a.code, a.commission_pct
      FROM affiliates a
      WHERE EXISTS (SELECT 1 FROM users u WHERE u.referred_by = a.user_id)
    `);
    console.log(`[seed] ${affs.rowCount} afiliado(s) com leads encontrado(s).`);

    for (const aff of affs.rows) {
      const affId = aff.aff_id;
      const pct = parseFloat(aff.commission_pct || 50);

      // Leads deste afiliado
      const leadsR = await client.query('SELECT id, username, email FROM users WHERE referred_by = $1 ORDER BY id', [aff.user_id]);
      const leads = leadsR.rows;
      if (!leads.length) continue;

      console.log(`[seed] Afiliado #${affId} (${aff.code}) — ${leads.length} leads`);

      // ── 1. Visitas (alvo: pelo menos 180)
      const visCnt = await client.query('SELECT COUNT(*)::int AS c FROM affiliate_visits WHERE affiliate_id=$1', [affId]);
      const need = Math.max(0, 180 - visCnt.rows[0].c);
      if (need > 0) {
        const values = [];
        const params = [];
        let p = 1;
        for (let i = 0; i < need; i++) {
          const day = randInt(0, 90);
          values.push(`($${p++}, $${p++}, $${p++}, $${p++})`);
          params.push(affId, '10.' + randInt(1,254) + '.' + randInt(1,254) + '.' + randInt(1,254),
                      pick(['Mozilla/5.0 Android', 'Mozilla/5.0 iPhone', 'Mozilla/5.0 Windows Chrome']),
                      daysAgoISO(day));
        }
        await client.query(
          `INSERT INTO affiliate_visits (affiliate_id, ip, user_agent, created_at) VALUES ${values.join(',')}`,
          params
        );
        await client.query('UPDATE affiliates SET visits_total = visits_total + $1 WHERE id=$2', [need, affId]);
        console.log(`  + ${need} visitas inseridas`);
      }

      // ── 2. Depósitos históricos + commissions (alvo: cada lead com 2-5 depósitos)
      for (const lead of leads) {
        const depCnt = await client.query(
          `SELECT COUNT(*)::int AS c FROM transactions
           WHERE user_id=$1 AND status='paid' AND type IN ('deposit','pix_in')`,
          [lead.id]
        );
        const currentDeps = depCnt.rows[0].c;
        const targetDeps = randInt(2, 5);
        const toInsert = Math.max(0, targetDeps - currentDeps);

        for (let i = 0; i < toInsert; i++) {
          const amount = pick([3000, 5000, 10000, 15000, 20000, 30000, 50000, 10000, 5000]); // cents
          const day = randInt(1, 60);
          const createdAt = daysAgoISO(day);

          const txR = await client.query(
            `INSERT INTO transactions (user_id, type, amount_cents, status, provider, provider_ref, created_at, updated_at)
             VALUES ($1, 'deposit', $2, 'paid', 'seed', $3, $4, $4)
             RETURNING id`,
            [lead.id, amount, 'seed-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8), createdAt]
          );
          const txId = txR.rows[0].id;

          // Comissão revshare = pct% sobre o depósito
          const revshare = Math.round(amount * pct / 100);
          await client.query(
            `INSERT INTO affiliate_commissions
             (affiliate_id, referred_user_id, transaction_id, type, amount_cents, status, created_at)
             VALUES ($1, $2, $3, 'revshare', $4, 'paid', $5)`,
            [affId, lead.id, txId, revshare, createdAt]
          );

          // CPA bonus no primeiro depósito (apenas se ≥ R$30 = 3000c)
          if (i === 0 && currentDeps === 0 && amount >= 3000) {
            await client.query(
              `INSERT INTO affiliate_commissions
               (affiliate_id, referred_user_id, transaction_id, type, amount_cents, status, created_at)
               VALUES ($1, $2, $3, 'deposit', 2000, 'paid', $4)`,
              [affId, lead.id, txId, createdAt]
            );
          }
        }
        if (toInsert > 0) console.log(`  + ${toInsert} depósitos + comissões para lead ${lead.username || lead.id}`);
      }

      // ── 3. Saques históricos (alguns leads sacando parte do que depositaram)
      const wdGoal = Math.ceil(leads.length * 0.4); // ~40% dos leads
      for (let i = 0; i < wdGoal; i++) {
        const lead = pick(leads);
        const existingWd = await client.query('SELECT COUNT(*)::int AS c FROM withdrawals WHERE user_id=$1', [lead.id]);
        if (existingWd.rows[0].c >= 2) continue;
        const amount = pick([2000, 5000, 8000, 10000, 15000]);
        const day = randInt(1, 45);
        await client.query(
          `INSERT INTO withdrawals (user_id, amount_cents, pix_type, pix_key, status, created_at, updated_at)
           VALUES ($1, $2, 'cpf', '000.000.000-00', 'paid', $3, $3)`,
          [lead.id, amount, daysAgoISO(day)]
        );
      }
      console.log(`  + ~${wdGoal} saques distribuídos`);
    }

    console.log('[seed] CONCLUÍDO com sucesso.');
    process.exit(0);
  } catch (err) {
    console.error('[seed] ERRO:', err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
})();
