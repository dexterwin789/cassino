const fetch = require('node-fetch');
const { pool } = require('../config/database');

const ENV_BASE_URL = process.env.BLACKCAT_BASE_URL || '';
const ENV_API_KEY = process.env.BLACKCAT_API_KEY || '';
const ENV_WEBHOOK_URL = process.env.BLACKCAT_WEBHOOK_URL || '';

// Cached overrides from platform_settings (5 minute cache)
let _settingsCache = { ts: 0, data: null };
async function loadOverrides() {
  if (_settingsCache.data && Date.now() - _settingsCache.ts < 5 * 60 * 1000) return _settingsCache.data;
  try {
    const r = await pool.query(
      "SELECT key, value FROM platform_settings WHERE key IN ('blackcat_api_key','blackcat_base_url','blackcat_webhook_url')"
    );
    const o = {};
    r.rows.forEach(row => { o[row.key] = row.value; });
    _settingsCache = { ts: Date.now(), data: o };
    return o;
  } catch {
    return {};
  }
}
function clearBlackcatCache() { _settingsCache = { ts: 0, data: null }; }

async function getCreds() {
  const o = await loadOverrides();
  return {
    BASE_URL: (o.blackcat_base_url || ENV_BASE_URL || '').trim(),
    API_KEY: (o.blackcat_api_key || ENV_API_KEY || '').trim(),
    WEBHOOK_URL: (o.blackcat_webhook_url || ENV_WEBHOOK_URL || '').trim()
  };
}

async function blackcatRequest(method, path, payload = null) {
  const { BASE_URL, API_KEY } = await getCreds();
  const url = `${BASE_URL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

  const opts = {
    method: method.toUpperCase(),
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    timeout: 30000
  };

  if (payload) {
    opts.body = JSON.stringify(payload);
  }

  const resp = await fetch(url, opts);
  const data = await resp.json();

  if (!resp.ok || data.success === false) {
    throw new Error(`BlackCat HTTP ${resp.status}: ${data.message || data.error || JSON.stringify(data)}`);
  }

  return data;
}

function normalizeCustomer(user) {
  const name = (user.username || `Cliente ${user.id}`).trim() || `Cliente ${user.id}`;
  const email = (user.email || `cli${user.id}@exemplo.com`).trim() || `cli${user.id}@exemplo.com`;
  const phone = (user.phone || '11999999999').replace(/\D+/g, '');
  let cpf = (user.cpf || '11111111111').replace(/\D+/g, '');
  if (cpf.length !== 11) cpf = cpf.substring(0, 11).padEnd(11, '1');

  return {
    name,
    email,
    phone: phone.length >= 10 ? phone : '11999999999',
    doc: cpf,
    document: { number: cpf, type: 'cpf' }
  };
}

async function createSale(amountCents, title, user, externalRef) {
  if (amountCents <= 0) throw new Error('amountCents inválido');

  const customer = normalizeCustomer(user);
  const { WEBHOOK_URL } = await getCreds();

  const payload = {
    amount: amountCents,
    currency: 'BRL',
    paymentMethod: 'pix',
    items: [{ title, unitPrice: amountCents, quantity: 1, tangible: false }],
    customer,
    pix: { expiresInDays: 1 },
    postbackUrl: WEBHOOK_URL
  };

  if (externalRef) payload.externalRef = externalRef;

  return blackcatRequest('POST', '/sales/create-sale', payload);
}

async function getStatus(transactionId) {
  return blackcatRequest('GET', `/sales/${encodeURIComponent(transactionId)}/status`);
}

module.exports = { blackcatRequest, createSale, getStatus, normalizeCustomer, clearBlackcatCache, getCreds };
