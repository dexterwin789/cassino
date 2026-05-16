// Cleanup script — zera toda a parte financeira do VemNaBet
// 1) Backup tabelas em maintenance_finance_*_<ts>
// 2) Apaga depósitos/saques/apostas/game_tx/comissões/user_promotions
// 3) Zera wallets, users (balance/demo/bonus), affiliates (totais)
// 4) Reativa aff_revshare_enabled=1
const { Pool } = require('pg');
const cs = process.env.DATABASE_URL;
if (!cs) { console.error('Missing DATABASE_URL'); process.exit(1); }
const p = new Pool({ connectionString: cs, ssl: cs.includes('proxy') ? { rejectUnauthorized: false } : false });

const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
const suf = `_${ts}`;

const TABLES = [
  'transactions',
  'withdrawals',
  'bets',
  'game_transactions',
  'affiliate_commissions',
  'user_promotions'
];

async function tableExists(client, name) {
  const r = await client.query("SELECT 1 FROM information_schema.tables WHERE table_name=$1", [name]);
  return r.rowCount > 0;
}

async function colExists(client, table, col) {
  const r = await client.query("SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2", [table, col]);
  return r.rowCount > 0;
}

(async () => {
  const client = await p.connect();
  try {
    console.log('=== BACKUP ===');
    for (const t of TABLES) {
      if (!(await tableExists(client, t))) { console.log(`skip ${t} (not exists)`); continue; }
      const bk = `maintenance_finance_${t}${suf}`;
      await client.query(`CREATE TABLE ${bk} AS SELECT * FROM ${t}`);
      const c = await client.query(`SELECT COUNT(*)::int AS c FROM ${bk}`);
      console.log(`  backup ${t} -> ${bk} (${c.rows[0].c} rows)`);
    }

    console.log('=== DELETE ===');
    await client.query('BEGIN');
    for (const t of TABLES) {
      if (!(await tableExists(client, t))) continue;
      const r = await client.query(`DELETE FROM ${t}`);
      console.log(`  DELETE ${t} -> ${r.rowCount}`);
    }

    console.log('=== ZERO BALANCES ===');
    // wallets
    if (await colExists(client, 'wallets', 'balance_cents')) {
      const r = await client.query('UPDATE wallets SET balance_cents=0');
      console.log(`  wallets.balance_cents=0 -> ${r.rowCount}`);
    }
    // users.balance / balance_cents / demo_balance_cents / bonus / bonus_cents
    for (const col of ['balance', 'balance_cents', 'demo_balance_cents', 'bonus', 'bonus_cents']) {
      if (await colExists(client, 'users', col)) {
        const r = await client.query(`UPDATE users SET ${col}=0`);
        console.log(`  users.${col}=0 -> ${r.rowCount}`);
      }
    }
    // affiliates totals
    for (const col of ['total_earned_cents', 'total_commissions_cents', 'total_referrals', 'total_paid_cents', 'visits_total']) {
      if (await colExists(client, 'affiliates', col)) {
        const r = await client.query(`UPDATE affiliates SET ${col}=0`);
        console.log(`  affiliates.${col}=0 -> ${r.rowCount}`);
      }
    }

    console.log('=== ENABLE REVSHARE ===');
    await client.query(`INSERT INTO platform_settings (key,value) VALUES ('aff_revshare_enabled','1')
      ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`);
    await client.query(`INSERT INTO platform_settings (key,value) VALUES ('aff_commission_type','revshare')
      ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`);
    await client.query(`INSERT INTO platform_settings (key,value) VALUES ('aff_revshare_pct','50')
      ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`);
    const s = await client.query("SELECT key,value FROM platform_settings WHERE key IN ('aff_revshare_enabled','aff_commission_type','aff_revshare_pct') ORDER BY key");
    s.rows.forEach(r => console.log(`  ${r.key}=${r.value}`));

    await client.query('COMMIT');
    console.log('\n=== DONE ===');
    console.log(`Backups suffix: ${suf}`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('ERR', e);
    process.exit(1);
  } finally {
    client.release();
    await p.end();
  }
})();
