#!/usr/bin/env node
/**
 * JSESSIONID Poller — VemNaBet
 * ----------------------------
 * Roda LOCAL (no PC do dono) ou em qualquer máquina com IP brasileiro.
 * Renova periodicamente as JSESSIONID das roletas Pragmatic Live e empurra
 * para o backend (rota /api/roulette/pragmatic/ingest) usando INGEST_TOKEN.
 *
 * Por que existe?
 *   O egress do Railway está sendo bloqueado (HTTP 451) na cadeia de launch
 *   do PlayFivers. A partir de um IP BR comum, a cadeia funciona normalmente.
 *
 * Configuração: copie tools/.env.example para tools/.env e preencha.
 *
 * Proxy (futuro): se você quiser, defina OUTBOUND_PROXY no .env (ex.
 *   http://user:pass@host:port). O poller passa a usar esse proxy para tudo.
 *
 * Uso:
 *   node tools/jsession-poller.js
 *   ou clique em tools/jsession-poller.bat
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------- carregar .env (sem dependência) ----------
function loadDotEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}
loadDotEnv();

// ---------- config ----------
const CONFIG = {
  backendUrl: (process.env.BACKEND_URL || 'https://vemnabet.bet').replace(/\/$/, ''),
  ingestToken: process.env.INGEST_TOKEN || '',
  agentToken: process.env.PLAYFIVERS_AGENT_TOKEN || '',
  secretKey: process.env.PLAYFIVERS_SECRET_KEY || '',
  outboundProxy: process.env.OUTBOUND_PROXY || '',
  intervalMs: parseInt(process.env.POLL_INTERVAL_MS || '60000', 10),
  renewAfterMs: parseInt(process.env.RENEW_AFTER_MS || (12 * 60 * 1000), 10), // renova a cada 12 min
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
};

const GAMES = [
  {
    label: 'Fortune Roulette',
    gameCode: 'oficial-pragmatic-live-pp-270',
    pfGameCode: 'PP_270',
    provider: 'OFICIAL - PRAGMATIC LIVE'
  },
  {
    label: 'French Roulette',
    gameCode: 'oficial-pragmatic-live-pp-28401',
    pfGameCode: 'PP_28401',
    provider: 'OFICIAL - PRAGMATIC LIVE'
  }
];

// ---------- proxy agent (opcional) ----------
function getProxyAgent() {
  if (!CONFIG.outboundProxy) return undefined;
  try {
    const { HttpsProxyAgent } = require('https-proxy-agent');
    return new HttpsProxyAgent(CONFIG.outboundProxy);
  } catch (e) {
    console.warn('[POLLER] OUTBOUND_PROXY definido mas https-proxy-agent não instalado. Rode: npm i https-proxy-agent');
    return undefined;
  }
}

// ---------- fetch helpers ----------
const fetchFn = (typeof fetch === 'function')
  ? fetch
  : (() => { try { return require('node-fetch'); } catch { return null; } })();

if (!fetchFn) {
  console.error('[POLLER] Node 18+ é necessário (fetch nativo) ou instale node-fetch.');
  process.exit(1);
}

async function httpRequest(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const agent = getProxyAgent();
  const opts = { ...options, signal: controller.signal };
  if (agent && !opts.agent) opts.agent = agent;
  try {
    return await fetchFn(url, opts);
  } finally {
    clearTimeout(timer);
  }
}

function parseJSessionId(text) {
  const match = String(text || '').match(/JSESSIONID=([^&"'<>\s;]+)/i);
  if (!match) return '';
  try { return decodeURIComponent(match[1]); } catch { return match[1]; }
}

// ---------- backend launch-url (PlayFivers via backend whitelisted IP) ----------
async function getLaunchUrlFromBackend(game) {
  const url = `${CONFIG.backendUrl}/api/roulette/pragmatic/launch-url?game_code=${encodeURIComponent(game.gameCode)}`;
  const resp = await httpRequest(url, {
    headers: {
      'X-Ingest-Token': CONFIG.ingestToken,
      'User-Agent': 'vnb-jsession-poller/1.0'
    }
  }, 20000);
  const data = await resp.json().catch(() => ({}));
  if (!data.ok || !data.launch_url) {
    throw new Error(`backend launch-url HTTP ${resp.status} msg=${data.msg || 'sem launch_url'}`);
  }
  return { launchUrl: data.launch_url, nestedUrl: data.nested_url };
}

// Segue redirects + lê body + Set-Cookie procurando JSESSIONID
async function readJSessionFromUrl(url) {
  const cookies = [];
  let current = url;
  let redirects = 0;
  while (redirects < 6) {
    const resp = await httpRequest(current, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': CONFIG.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
      }
    }, 15000);
    // capturar cookies
    const sc = resp.headers.raw ? resp.headers.raw()['set-cookie'] : (resp.headers.getSetCookie ? resp.headers.getSetCookie() : []);
    if (sc && sc.length) cookies.push(...sc);
    // tentar achar na URL final, body ou cookies
    let jsession = parseJSessionId(resp.url || current);
    if (!jsession && cookies.length) jsession = parseJSessionId(cookies.join('; '));
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get('location');
      if (jsession) return jsession;
      if (!loc) break;
      current = new URL(loc, current).toString();
      redirects++;
      continue;
    }
    if (jsession) return jsession;
    const body = await resp.text();
    jsession = parseJSessionId(body);
    if (jsession) return jsession;
    // detectar challenge HTML do PlayFivers
    if (/class\s*=\s*["']?man["']?/i.test(body)) {
      throw new Error(`challenge anti-bot em ${new URL(current).host} (HTTP ${resp.status})`);
    }
    throw new Error(`sem JSESSIONID em ${new URL(current).host} (HTTP ${resp.status})`);
  }
  throw new Error('redirects demais sem JSESSIONID');
}

async function pushToBackend(gameCode, jsession) {
  const resp = await httpRequest(`${CONFIG.backendUrl}/api/roulette/pragmatic/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Ingest-Token': CONFIG.ingestToken,
      'User-Agent': 'vnb-jsession-poller/1.0'
    },
    body: JSON.stringify({ game_code: gameCode, jsessionid: jsession })
  }, 20000);
  const data = await resp.json().catch(() => ({}));
  if (!data.ok) throw new Error(`backend rejeitou: HTTP ${resp.status} ${data.msg || ''}`);
  return data;
}

// ---------- loop ----------
const state = new Map(); // gameCode -> { jsession, renewedAt }

async function tickGame(game) {
  const now = Date.now();
  const prev = state.get(game.gameCode);
  if (prev && prev.jsession && (now - prev.renewedAt) < CONFIG.renewAfterMs) {
    return { game: game.label, action: 'skip', age: Math.round((now - prev.renewedAt) / 1000) + 's' };
  }
  const { launchUrl, nestedUrl } = await getLaunchUrlFromBackend(game);
  const candidates = [];
  if (nestedUrl) candidates.push(nestedUrl);
  candidates.push(launchUrl);

  let lastErr = null;
  for (const c of candidates) {
    try {
      const jsession = await readJSessionFromUrl(c);
      const push = await pushToBackend(game.gameCode, jsession);
      state.set(game.gameCode, { jsession, renewedAt: Date.now() });
      return { game: game.label, action: 'renewed', count: push.count, msg: push.msg };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('falha desconhecida');
}

async function tickAll() {
  const stamp = new Date().toISOString();
  for (const game of GAMES) {
    try {
      const r = await tickGame(game);
      console.log(`[${stamp}] ${r.game}: ${r.action}`, r.count !== undefined ? `count=${r.count}` : '', r.msg || r.age || '');
    } catch (err) {
      console.warn(`[${stamp}] ${game.label}: ERRO ${err.message}`);
    }
  }
}

function validateConfig() {
  const missing = [];
  if (!CONFIG.ingestToken) missing.push('INGEST_TOKEN');
  if (missing.length) {
    console.error('[POLLER] Faltando no .env: ' + missing.join(', '));
    console.error('[POLLER] Copie tools/.env.example para tools/.env e preencha.');
    process.exit(1);
  }
}

(async () => {
  validateConfig();
  console.log('[POLLER] iniciado. backend=' + CONFIG.backendUrl + ' interval=' + CONFIG.intervalMs + 'ms renew=' + CONFIG.renewAfterMs + 'ms proxy=' + (CONFIG.outboundProxy ? 'sim' : 'não'));
  await tickAll();
  setInterval(tickAll, CONFIG.intervalMs);
})();
