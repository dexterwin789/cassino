const fetch = require('node-fetch');

const API_BASE = 'https://api.playfivers.com';
const AGENT_TOKEN = () => process.env.PLAYFIVERS_AGENT_TOKEN || '';
const SECRET_KEY = () => process.env.PLAYFIVERS_SECRET_KEY || '';

// Optional: set OUTBOUND_PROXY=http://ip:port to route PlayFivers calls through a fixed proxy
function getProxyAgent() {
  const proxy = process.env.OUTBOUND_PROXY;
  if (!proxy) return undefined;
  try {
    const { HttpsProxyAgent } = require('https-proxy-agent');
    return new HttpsProxyAgent(proxy);
  } catch (e) {
    console.warn('[PLAYFIVERS] https-proxy-agent not installed, ignoring OUTBOUND_PROXY');
    return undefined;
  }
}

async function pfRequest(method, path, body = null) {
  const url = `${API_BASE}${path}`;
  const agent = getProxyAgent();
  const opts = {
    method: method.toUpperCase(),
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000
  };
  if (agent) opts.agent = agent;
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(url, opts);
  const data = await resp.json();
  return { status: resp.status, data };
}

// GET /api/v2/providers
async function getProviders() {
  return pfRequest('GET', '/api/v2/providers');
}

// GET /api/v2/games?provider=ID
async function getGames(providerId) {
  const qs = providerId ? `?provider=${providerId}` : '';
  return pfRequest('GET', `/api/v2/games${qs}`);
}

// POST /api/v2/game_launch
async function launchGame({ userCode, gameCode, provider, gameOriginal, userBalance, lang, userRtp }) {
  const body = {
    agentToken: AGENT_TOKEN(),
    secretKey: SECRET_KEY(),
    user_code: userCode,
    game_code: gameCode,
    provider: provider,
    game_original: gameOriginal === true || gameOriginal === 'true',
    user_balance: userBalance,
    lang: lang || 'pt'
  };
  if (userRtp !== undefined && userRtp !== null) body.user_rtp = parseInt(userRtp);
  return pfRequest('POST', '/api/v2/game_launch', body);
}

// GET /api/v2/balances
async function getBalances() {
  return pfRequest('GET', `/api/v2/balances?agentToken=${encodeURIComponent(AGENT_TOKEN())}&secretKey=${encodeURIComponent(SECRET_KEY())}`);
}

// GET /api/v2/agent
async function getAgent() {
  return pfRequest('GET', `/api/v2/agent?agentToken=${encodeURIComponent(AGENT_TOKEN())}&secretKey=${encodeURIComponent(SECRET_KEY())}`);
}

// PUT /api/v2/agent
async function updateAgent(settings) {
  return pfRequest('PUT', '/api/v2/agent', {
    agentToken: AGENT_TOKEN(),
    secretKey: SECRET_KEY(),
    ...settings
  });
}

// POST /api/v2/free_bonus
async function freeBonus({ userCode, gameCode, rounds }) {
  return pfRequest('POST', '/api/v2/free_bonus', {
    agent_token: AGENT_TOKEN(),
    secret_key: SECRET_KEY(),
    user_code: userCode,
    game_code: gameCode,
    rounds: parseInt(rounds)
  });
}

module.exports = { getProviders, getGames, launchGame, getBalances, getAgent, updateAgent, freeBonus };
