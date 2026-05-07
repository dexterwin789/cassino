const { pool } = require('../src/config/database');

async function rows(sql, params) {
  return (await pool.query(sql, params)).rows;
}

async function inspect() {
  const summary = {
    wallets: (await rows(`
      SELECT COUNT(*)::int AS users_with_balance,
             COALESCE(SUM(balance_cents),0)::bigint AS total_cents,
             COALESCE(MAX(balance_cents),0)::bigint AS max_cents
      FROM wallets
      WHERE balance_cents <> 0
    `))[0],
    demo: (await rows(`
      SELECT COUNT(*)::int AS users_with_demo_balance,
             COALESCE(SUM(demo_balance_cents),0)::bigint AS total_demo_cents,
             COALESCE(MAX(demo_balance_cents),0)::bigint AS max_demo_cents
      FROM users
      WHERE demo_balance_cents <> 0
    `))[0],
    legacy: (await rows(`
      SELECT COUNT(*)::int AS users_with_legacy_balance,
             COALESCE(SUM(balance),0)::numeric(14,2) AS total_legacy_brl,
             COALESCE(MAX(balance),0)::numeric(14,2) AS max_legacy_brl
      FROM users
      WHERE balance <> 0
    `))[0],
    recentByType: await rows(`
      SELECT type, COALESCE(provider, '') AS provider,
             COUNT(*)::int AS count,
             COALESCE(SUM(amount_cents),0)::bigint AS total_cents,
             MIN(created_at) AS first_at,
             MAX(created_at) AS last_at
      FROM transactions
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY type, provider
      ORDER BY count DESC, last_at DESC
      LIMIT 30
    `),
    recurringTransactionPatterns: await rows(`
      WITH ordered AS (
        SELECT id, user_id, type, COALESCE(provider, '') AS provider, amount_cents, created_at,
               EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (
                 PARTITION BY user_id, type, COALESCE(provider, ''), amount_cents
                 ORDER BY created_at
               )))::int AS gap_seconds
        FROM transactions
        WHERE created_at >= NOW() - INTERVAL '14 days'
      )
      SELECT user_id, type, provider, amount_cents, gap_seconds,
             COUNT(*)::int AS repeats,
             MIN(created_at) AS first_at,
             MAX(created_at) AS last_at
      FROM ordered
      WHERE gap_seconds BETWEEN 30 AND 7200
      GROUP BY user_id, type, provider, amount_cents, gap_seconds
      HAVING COUNT(*) >= 3
      ORDER BY repeats DESC, gap_seconds ASC
      LIMIT 50
    `),
    latestTransactions: await rows(`
      SELECT id, user_id, type, status, amount_cents, COALESCE(provider, '') AS provider, created_at
      FROM transactions
      ORDER BY created_at DESC
      LIMIT 20
    `)
  };
  console.log(JSON.stringify(summary, null, 2));
}

async function zero() {
  const client = await pool.connect();
  const balanceSnapshot = 'maintenance_balance_snapshot_20260507';
  const txSnapshot = 'maintenance_revshare_transactions_snapshot_20260507';
  const commissionSnapshot = 'maintenance_revshare_commissions_snapshot_20260507';
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${balanceSnapshot} AS
      SELECT NOW() AS snapshot_at,
             u.id AS user_id,
             u.username,
             u.email,
             COALESCE(w.balance_cents, 0)::bigint AS wallet_balance_cents,
             COALESCE(u.demo_balance_cents, 0)::bigint AS demo_balance_cents,
             COALESCE(u.balance, 0)::numeric(14,2) AS legacy_balance_brl
      FROM users u
      LEFT JOIN wallets w ON w.user_id = u.id
      WHERE COALESCE(w.balance_cents, 0) <> 0
         OR COALESCE(u.demo_balance_cents, 0) <> 0
         OR COALESCE(u.balance, 0) <> 0
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${txSnapshot} AS
      SELECT NOW() AS snapshot_at, t.*
      FROM transactions t
      WHERE t.type = 'commission'
        AND t.provider IN ('revshare', 'revshare_l2')
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${commissionSnapshot} AS
      SELECT NOW() AS snapshot_at, c.*
      FROM affiliate_commissions c
      WHERE c.type IN ('revshare', 'revshare_l2')
    `);
    const wallet = await client.query('UPDATE wallets SET balance_cents = 0, updated_at = NOW() WHERE balance_cents <> 0');
    const demo = await client.query('UPDATE users SET demo_balance_cents = 0, updated_at = NOW() WHERE demo_balance_cents <> 0');
    const legacy = await client.query('UPDATE users SET balance = 0, updated_at = NOW() WHERE balance <> 0');
    const tx = await client.query("DELETE FROM transactions WHERE type = 'commission' AND provider IN ('revshare', 'revshare_l2')");
    const commissions = await client.query("DELETE FROM affiliate_commissions WHERE type IN ('revshare', 'revshare_l2')");
    await client.query(`
      UPDATE affiliates a
      SET total_earned_cents = COALESCE((
        SELECT SUM(c.amount_cents)
        FROM affiliate_commissions c
        WHERE c.affiliate_id = a.id
      ), 0)
    `);
    await client.query(`
      INSERT INTO platform_settings (key, value, updated_at)
      VALUES ('aff_revshare_enabled', '0', NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `);
    await client.query('COMMIT');
    console.log(JSON.stringify({
      ok: true,
      snapshots: { balances: balanceSnapshot, revshare_transactions: txSnapshot, revshare_commissions: commissionSnapshot },
      wallet_rows: wallet.rowCount,
      demo_rows: demo.rowCount,
      legacy_rows: legacy.rowCount,
      deleted_revshare_transaction_rows: tx.rowCount,
      deleted_revshare_commission_rows: commissions.rowCount,
      aff_revshare_enabled: '0'
    }, null, 2));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

const mode = process.argv[2] || 'inspect';
(mode === 'zero' ? zero() : inspect())
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());