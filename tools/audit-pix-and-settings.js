const { Pool } = require('pg');
const cs = process.env.DATABASE_URL;
if (!cs) { console.error('Missing DATABASE_URL'); process.exit(1); }
const p = new Pool({ connectionString: cs, ssl: cs.includes('proxy') ? { rejectUnauthorized: false } : false });

(async () => {
  const settings = await p.query(`
    SELECT key, CASE
      WHEN key LIKE '%api_key%' OR key LIKE '%secret%' THEN CONCAT('[set:', LENGTH(value), ' chars]')
      ELSE value
    END AS value
    FROM platform_settings
    WHERE key IN (
      'blackcat_base_url','blackcat_webhook_url','blackcat_api_key',
      'blackcat_webhook_ips','blackcat_webhook_secret',
      'playfivers_webhook_ips','playfivers_webhook_secret',
      'aff_commission_type','aff_revshare_enabled','aff_revshare_pct','min_deposit'
    )
    ORDER BY key
  `);
  console.log('SETTINGS');
  for (const r of settings.rows) console.log(`${r.key}=${r.value || ''}`);

  const summary = await p.query(`
    SELECT status, COUNT(*)::int AS count, COALESCE(SUM(amount_cents),0)::bigint AS total_cents
    FROM transactions
    WHERE type='deposit'
    GROUP BY status
    ORDER BY status
  `);
  console.log('\nDEPOSIT SUMMARY');
  console.table(summary.rows);

  const recent = await p.query(`
    SELECT t.id, t.user_id, u.email, t.status, t.amount_cents, t.provider, t.provider_ref,
           t.created_at, t.updated_at,
           LEFT(COALESCE(t.payload_json::text,''), 260) AS payload_head
    FROM transactions t
    LEFT JOIN users u ON u.id=t.user_id
    WHERE t.type='deposit'
    ORDER BY t.id DESC
    LIMIT 30
  `);
  console.log('\nRECENT DEPOSITS');
  console.table(recent.rows.map(r => ({
    id: r.id,
    user_id: r.user_id,
    email: r.email,
    status: r.status,
    amount: Number(r.amount_cents)/100,
    provider_ref: r.provider_ref,
    created_at: r.created_at,
    updated_at: r.updated_at,
    payload_head: r.payload_head
  })));

  const suspicious = await p.query(`
    SELECT t.id, t.user_id, u.email, t.status, t.amount_cents, t.provider_ref, t.created_at, t.updated_at,
           t.payload_json->>'transactionId' AS payload_transaction_id,
           t.payload_json->>'status' AS payload_status,
           t.payload_json->>'event' AS payload_event,
           t.payload_json->>'externalReference' AS payload_external_reference
    FROM transactions t
    LEFT JOIN users u ON u.id=t.user_id
    WHERE t.type='deposit'
      AND t.status <> 'paid'
      AND t.created_at >= NOW() - INTERVAL '14 days'
    ORDER BY t.id DESC
  `);
  console.log('\nNON-PAID DEPOSITS LAST 14D');
  console.table(suspicious.rows.map(r => ({
    id: r.id,
    user_id: r.user_id,
    email: r.email,
    status: r.status,
    amount: Number(r.amount_cents)/100,
    provider_ref: r.provider_ref,
    created_at: r.created_at,
    payload_status: r.payload_status,
    payload_event: r.payload_event,
    payload_transaction_id: r.payload_transaction_id,
    payload_external_reference: r.payload_external_reference
  })));

  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
