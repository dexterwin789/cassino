const fetch = require('node-fetch');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const BASE = process.env.TEST_BASE_URL || 'https://vemnabet.bet';
const cs = process.env.DATABASE_URL;
if (!cs) { console.error('Missing DATABASE_URL'); process.exit(1); }
const pool = new Pool({ connectionString: cs, ssl: cs.includes('proxy') ? { rejectUnauthorized: false } : false });

const runId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const affEmail = `copilot.aff.${runId}@example.com`;
const refEmail = `copilot.ref.${runId}@example.com`;
const password = 'Teste123!';
const affCode = `CP${runId.slice(-10)}`;
let affUserId = null;
let refUserId = null;
let affiliateId = null;
let txId = null;
let providerTxId = null;
let betId = null;
let commissionId = null;

function makeCpf(seed) {
  return String(seed).replace(/\D/g, '').slice(-11).padStart(11, '0');
}

function makeJar() {
  const jar = new Map();
  return {
    add(res) {
      const setCookies = res.headers.raw()['set-cookie'] || [];
      for (const c of setCookies) {
        const first = c.split(';')[0];
        const eq = first.indexOf('=');
        if (eq > 0) jar.set(first.slice(0, eq), first.slice(eq + 1));
      }
    },
    header() {
      return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
    },
    dump() {
      return Array.from(jar.keys());
    }
  };
}

async function http(jar, path, options = {}) {
  const headers = Object.assign({ 'User-Agent': 'VemNaBet-flow-test/1.0' }, options.headers || {});
  if (jar && jar.header()) headers.Cookie = jar.header();
  const res = await fetch(`${BASE}${path}`, { redirect: 'manual', ...options, headers });
  if (jar) jar.add(res);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { res, text, json };
}

function assert(cond, msg, extra) {
  if (!cond) {
    const err = new Error(msg);
    err.extra = extra;
    throw err;
  }
}

async function waitForSite() {
  for (let i = 0; i < 20; i++) {
    try {
      const r = await fetch(`${BASE}/health`, { timeout: 8000 });
      if (r.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
}

async function setupAffiliate() {
  const hash = await bcrypt.hash(password, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const u = await client.query(
      `INSERT INTO users (username, name, phone, email, cpf, birth_date, password_hash, referred_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NULL)
       RETURNING id`,
      [affEmail, 'Copilot Afiliado Teste', '11999990001', affEmail, makeCpf(runId), '1990-01-01', hash]
    );
    affUserId = u.rows[0].id;
    await client.query('INSERT INTO wallets (user_id, balance_cents) VALUES ($1,0) ON CONFLICT DO NOTHING', [affUserId]);
    const a = await client.query(
      `INSERT INTO affiliates (user_id, code, commission_pct, is_active, model, status)
       VALUES ($1,$2,50,TRUE,'revshare','approved') RETURNING id`,
      [affUserId, affCode]
    );
    affiliateId = a.rows[0].id;
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function runFlow() {
  await waitForSite();
  await setupAffiliate();
  console.log('TEST AFFILIATE', { affUserId, affiliateId, affCode, affEmail });

  const referredJar = makeJar();
  const landing = await http(referredJar, `/?ref=${encodeURIComponent(affCode)}`);
  assert(landing.res.status >= 200 && landing.res.status < 400, 'Landing with ref failed', { status: landing.res.status });
  assert(referredJar.dump().includes('vnb_ref'), 'vnb_ref cookie not set from referral link', referredJar.dump());

  const reg = await http(referredJar, '/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: refEmail,
      email: refEmail,
      password,
      phone: '11999990002',
      cpf: makeCpf(Number(runId) + 17),
      name: 'Copilot Indicado Teste',
      birth_date: '1992-02-02'
    })
  });
  assert(reg.json?.ok, 'Register referred user failed', { status: reg.res.status, body: reg.text });
  refUserId = reg.json.user.id;

  const refCheck = await pool.query('SELECT referred_by FROM users WHERE id=$1', [refUserId]);
  assert(Number(refCheck.rows[0]?.referred_by) === Number(affUserId), 'referred_by was not stored from referral link', refCheck.rows[0]);
  console.log('REGISTER OK', { refUserId, referred_by: refCheck.rows[0].referred_by });

  const dep = await http(referredJar, '/api/deposit/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount_brl: 20 })
  });
  assert(dep.json?.ok, 'Deposit create failed', { status: dep.res.status, body: dep.text });
  txId = dep.json.tx_id;
  providerTxId = dep.json.transactionId;
  assert(providerTxId && dep.json.copyPaste, 'Deposit response missing provider tx or PIX code', dep.json);
  console.log('DEPOSIT CREATE OK', { txId, providerTxId, externalReference: dep.json.externalReference });

  const wh = await http(null, '/api/webhook/blackcat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transactionId: providerTxId,
      status: 'PAID',
      amount: 2000,
      externalReference: String(txId),
      event: 'transaction.paid',
      paidAt: new Date().toISOString()
    })
  });
  assert(wh.json?.ok && (wh.json.credited || wh.json.already_paid), 'BlackCat webhook did not credit deposit', { status: wh.res.status, body: wh.text });

  const paidCheck = await pool.query(`
    SELECT t.status, w.balance_cents
    FROM transactions t JOIN wallets w ON w.user_id=t.user_id
    WHERE t.id=$1`, [txId]);
  assert(paidCheck.rows[0]?.status === 'paid', 'Deposit not marked paid after webhook', paidCheck.rows[0]);
  assert(Number(paidCheck.rows[0]?.balance_cents) >= 2000, 'Wallet not credited after deposit', paidCheck.rows[0]);
  console.log('DEPOSIT WEBHOOK OK', paidCheck.rows[0]);

  const round = String(Number(runId.slice(-9)) + 300000000);
  const pf = await http(null, '/api/webhook/playfivers/transaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'WinBet',
      game_type: 'slot',
      user_code: refEmail,
      agent_code: 'flow-test',
      agent_secret: 'flow-test',
      user_balance: 20,
      game_original: false,
      slot: {
        bet: 2,
        win: 0,
        type: 'BASE',
        txn_id: `flow-${runId}`,
        round_id: round,
        txn_type: 'debit_credit',
        game_code: 'POPOK_294',
        provider_code: 'POPOK',
        created_at: new Date().toISOString().slice(0, 10),
        user_before_balance: 20,
        user_after_balance: 18
      }
    })
  });
  assert(pf.res.ok && pf.json && pf.json.balance === 18, 'PlayFivers webhook failed or returned unexpected balance', { status: pf.res.status, body: pf.text });
  console.log('PLAYFIVERS BET OK', pf.json);

  for (let i = 0; i < 20; i++) {
    const cr = await pool.query(`
      SELECT ac.id AS commission_id, ac.amount_cents, ac.status, ac.type, ac.bet_id,
             b.id AS bet_id, b.amount_cents AS bet_cents, b.payout_cents,
             aw.balance_cents AS affiliate_wallet_cents
      FROM affiliate_commissions ac
      JOIN bets b ON b.id=ac.bet_id
      JOIN wallets aw ON aw.user_id=$2
      WHERE ac.affiliate_id=$1 AND ac.referred_user_id=$3
      ORDER BY ac.id DESC LIMIT 1`, [affiliateId, affUserId, refUserId]);
    if (cr.rows[0]) {
      commissionId = cr.rows[0].commission_id;
      betId = cr.rows[0].bet_id;
      assert(Number(cr.rows[0].amount_cents) === 100, 'Unexpected commission amount, expected R$1.00', cr.rows[0]);
      assert(cr.rows[0].status === 'paid', 'Commission not paid', cr.rows[0]);
      assert(Number(cr.rows[0].affiliate_wallet_cents) >= 100, 'Affiliate wallet not credited with commission', cr.rows[0]);
      console.log('REVSHARE OK', cr.rows[0]);
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert(commissionId, 'No revshare commission generated after lost bet');

  const affJar = makeJar();
  const login = await http(affJar, '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: affEmail, password })
  });
  assert(login.json?.ok, 'Affiliate login failed', { status: login.res.status, body: login.text });

  const me = await http(affJar, '/api/affiliate/me');
  assert(me.json?.ok && me.json.is_affiliate, 'Affiliate me failed', { status: me.res.status, body: me.text });
  assert(Number(me.json.stats.total_leads) >= 1, 'Affiliate stats did not show lead', me.json);
  assert(Number(me.json.stats.paid_commission_cents) >= 100, 'Affiliate stats did not show paid commission', me.json);

  const leads = await http(affJar, '/api/referrals/leads?period=all');
  assert(leads.json?.ok, 'Referral leads endpoint failed', { status: leads.res.status, body: leads.text });
  const lead = leads.json.leads.find(x => x.email === refEmail);
  assert(lead, 'Referral lead not visible in INDIQUE E GANHE list', leads.json.leads.slice(0, 3));
  assert(Number(lead.deposited_cents) >= 2000, 'Lead deposit not visible in panel', lead);
  assert(Number(lead.bets_count) >= 1, 'Lead bet not visible in panel', lead);
  assert(Number(lead.commission_cents) >= 100, 'Lead commission not visible in panel', lead);

  console.log('PANEL ENDPOINTS OK', {
    affiliate_me: me.json.stats,
    lead: {
      id: lead.id,
      deposited_cents: lead.deposited_cents,
      bets_count: lead.bets_count,
      bets_volume_cents: lead.bets_volume_cents,
      commission_cents: lead.commission_cents,
      commission_paid_cents: lead.commission_paid_cents
    }
  });
}

async function cleanup() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (affUserId || refUserId) {
      const ids = [affUserId, refUserId].filter(Boolean);
      await client.query('DELETE FROM notifications WHERE user_id = ANY($1::int[])', [ids]);
      if (affiliateId || refUserId) {
        await client.query('DELETE FROM affiliate_commissions WHERE affiliate_id = $1 OR referred_user_id = $2', [affiliateId || 0, refUserId || 0]);
      }
      await client.query('DELETE FROM transactions WHERE user_id = ANY($1::int[])', [ids]);
      if (refUserId) {
        await client.query('DELETE FROM bets WHERE user_id=$1', [refUserId]);
        await client.query('DELETE FROM game_transactions WHERE user_id=$1', [refUserId]);
      }
      await client.query('DELETE FROM login_history WHERE user_id = ANY($1::int[])', [ids]);
      await client.query('DELETE FROM wallets WHERE user_id = ANY($1::int[])', [ids]);
      if (affiliateId) await client.query('DELETE FROM affiliates WHERE id=$1', [affiliateId]);
      await client.query('DELETE FROM users WHERE id = ANY($1::int[])', [ids]);
    }
    await client.query('COMMIT');
    console.log('CLEANUP OK', { affUserId, refUserId, txId, providerTxId, betId, commissionId });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('CLEANUP ERR', e.message);
  } finally {
    client.release();
  }
}

(async () => {
  let ok = false;
  try {
    await runFlow();
    ok = true;
  } catch (e) {
    console.error('TEST FAILED:', e.message);
    if (e.extra) console.error('EXTRA:', JSON.stringify(e.extra, null, 2).slice(0, 4000));
  } finally {
    await cleanup();
    await pool.end();
  }
  if (!ok) process.exit(1);
  console.log('TEST PASSED: affiliate -> register -> deposit -> blackcat webhook -> playfivers lost bet -> revshare -> panel endpoints');
})();
