// Middleware opcional para validar origem de webhooks.
// Lê platform_settings.<settingKey> (CSV de IPs / CIDRs / hostnames simples).
// Se vazio → permissivo (comportamento atual). Se preenchido → bloqueia origens fora da lista.
// Também permite header de assinatura simples se settings.<settingKey>_secret estiver definido (HMAC SHA256 do raw body em hex no header indicado).
const crypto = require('crypto');
const { query } = require('../config/database');

// Cache 60s por chave para não consultar DB toda request.
const cache = new Map();
function clearWebhookGuardCache() {
  cache.clear();
}

async function getSetting(key) {
  const c = cache.get(key);
  if (c && Date.now() - c.ts < 60 * 1000) return c.value;
  try {
    const r = await query('SELECT value FROM platform_settings WHERE key = $1 LIMIT 1', [key]);
    const v = r.rows[0]?.value || '';
    cache.set(key, { ts: Date.now(), value: v });
    return v;
  } catch {
    return '';
  }
}

function clientIp(req) {
  // trust proxy=2 já normaliza req.ip
  return (req.ip || req.connection?.remoteAddress || '').replace(/^::ffff:/, '');
}

function ipMatches(ip, allowed) {
  // Suporte: IP exato ou prefixo "x.y." (simples, sem CIDR completo)
  for (const a of allowed) {
    const t = a.trim();
    if (!t) continue;
    if (t === ip) return true;
    if (t.endsWith('.') && ip.startsWith(t)) return true;
    if (t.endsWith('*') && ip.startsWith(t.slice(0, -1))) return true;
  }
  return false;
}

/**
 * @param {string} ipsKey  setting key com CSV de IPs permitidos
 * @param {string} secretKey  setting key opcional com HMAC secret
 * @param {string} sigHeader  header onde a assinatura HMAC chega (ex: 'x-blackcat-signature')
 */
function webhookGuard({ ipsKey, secretKey, sigHeader }) {
  return async (req, res, next) => {
    try {
      const allowedRaw = ipsKey ? await getSetting(ipsKey) : '';
      const secret = secretKey ? await getSetting(secretKey) : '';

      // 1) IP whitelist
      if (allowedRaw && allowedRaw.trim()) {
        const allowed = allowedRaw.split(',').map(s => s.trim()).filter(Boolean);
        const ip = clientIp(req);
        if (!ipMatches(ip, allowed)) {
          console.warn('[WEBHOOK_GUARD] IP bloqueado:', ip, 'allowed:', allowed.join(','));
          return res.status(403).json({ ok: false, msg: 'Origem n\u00e3o autorizada.' });
        }
      }

      // 2) HMAC signature
      if (secret && sigHeader) {
        const sig = (req.headers[sigHeader.toLowerCase()] || '').toString().trim().replace(/^sha256=/i, '');
        if (!sig) {
          console.warn('[WEBHOOK_GUARD] HMAC ausente em header', sigHeader);
          return res.status(401).json({ ok: false, msg: 'Assinatura ausente.' });
        }
        if (!/^[a-f0-9]{64}$/i.test(sig)) {
          console.warn('[WEBHOOK_GUARD] HMAC em formato inválido');
          return res.status(401).json({ ok: false, msg: 'Assinatura inválida.' });
        }
        const raw = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.body || {});
        const expected = crypto.createHmac('sha256', secret.trim()).update(raw).digest('hex');
        const a = Buffer.from(sig, 'hex');
        const b = Buffer.from(expected, 'hex');
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
          console.warn('[WEBHOOK_GUARD] HMAC inv\u00e1lido');
          return res.status(401).json({ ok: false, msg: 'Assinatura inv\u00e1lida.' });
        }
      }

      next();
    } catch (err) {
      console.error('[WEBHOOK_GUARD] erro interno:', err);
      next(); // não derruba o webhook por erro do guard
    }
  };
}

module.exports = { webhookGuard, clearWebhookGuardCache };
