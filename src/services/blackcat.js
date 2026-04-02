const fetch = require('node-fetch');

const BASE_URL = process.env.BLACKCAT_BASE_URL || '';
const API_KEY = process.env.BLACKCAT_API_KEY || '';
const WEBHOOK_URL = process.env.BLACKCAT_WEBHOOK_URL || '';

async function blackcatRequest(method, path, payload = null) {
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

module.exports = { blackcatRequest, createSale, getStatus, normalizeCustomer };
