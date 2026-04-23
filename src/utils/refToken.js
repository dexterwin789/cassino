// refToken.js — HMAC signed short tokens that carry an affiliate ref code.
// Used to camouflage ?ref= in URLs when the user comes from a custom domain.
// The same secret is shared with straplay (DOMAIN_REDIRECT_SECRET env var).
const crypto = require('crypto');

const SECRET = process.env.DOMAIN_REDIRECT_SECRET || 'vnb-domain-redirect-secret-v1';
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 dias

function b64u(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64uDecode(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

function signRef(ref) {
  if (!ref || !/^[A-Za-z0-9_-]{1,64}$/.test(ref)) return null;
  const payload = b64u(JSON.stringify({ r: ref, e: Date.now() + MAX_AGE_MS }));
  const sig = b64u(crypto.createHmac('sha256', SECRET).update(payload).digest()).slice(0, 22);
  return payload + '.' + sig;
}

function verifyRef(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const idx = token.indexOf('.');
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = b64u(crypto.createHmac('sha256', SECRET).update(payload).digest()).slice(0, 22);
  if (expected.length !== sig.length) return null;
  // Constant-time compare
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const obj = JSON.parse(b64uDecode(payload).toString('utf8'));
    if (!obj || typeof obj !== 'object') return null;
    if (obj.e && obj.e < Date.now()) return null;
    if (!obj.r || !/^[A-Za-z0-9_-]{1,64}$/.test(obj.r)) return null;
    return obj.r;
  } catch { return null; }
}

module.exports = { signRef, verifyRef };
