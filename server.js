require('dotenv').config();
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');
const path = require('path');
const { pool } = require('./src/config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Security — CSP disabled (quebrava imagens/scripts externos). Embed em iframe do straplay liberado via frame-ancestors direto.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  frameguard: false
}));

// Permitir embed apenas no straplay (usa CSP frame-ancestors; X-Frame-Options está desligado via frameguard:false)
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'self' https://vemnabet.bet https://*.vemnabet.bet https://straplay.com https://*.straplay.com https://straplay-production.up.railway.app https://*.up.railway.app"
  );
  next();
});

// Body parsing
// rawBody fica disponível para validação HMAC de webhooks sem depender de JSON.stringify(req.body).
app.use(express.json({
  limit: '15mb',
  verify: (req, res, buf) => {
    req.rawBody = buf ? buf.toString('utf8') : '';
  }
}));
app.use(express.urlencoded({
  extended: true,
  verify: (req, res, buf) => {
    req.rawBody = buf ? buf.toString('utf8') : '';
  }
}));

// Health check endpoint for Railway (must be before any DB/auth middleware)
app.get('/health', (req, res) => res.status(200).send('ok'));

// Trust Railway/Heroku/Cloudflare reverse proxy chain so secure cookies work
// (custom domain goes Cloudflare → Railway → App = 2 hops)
// Usar contagem específica em vez de `true` para evitar spoofing de X-Forwarded-For (rate-limit por IP).
app.set('trust proxy', 2);

// Session cookie config — production on Railway/Cloudflare always HTTPS,
// so use secure+sameSite:none+domain=.vemnabet.bet whenever not running local dev.
// Local dev (localhost) → sameSite:lax, no secure, no domain.
const IS_PROD = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT || !!process.env.RAILWAY_PROJECT_ID;

if (IS_PROD && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'fallback-secret' || process.env.SESSION_SECRET.length < 32)) {
  console.warn('[SECURITY] SESSION_SECRET fraco ou ausente em PRODUÇÃO. Defina uma string aleatória de 32+ caracteres.');
}

// Sessions
app.use(session({
  store: new PgSession({ pool, tableName: 'sessions', createTableIfMissing: true }),
  name: 'vnb_sid',
  secret: process.env.SESSION_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'none' : 'lax',
    // Share session across app.vemnabet.bet (straplay) and vemnabet.bet
    domain: IS_PROD ? '.vemnabet.bet' : undefined
  }
}));

// ── Legacy cookie cleanup ───────────────────────────────────
// Old deploys set cookies as "connect.sid" with host-only scope (no Domain attr),
// which take priority over the new ".vemnabet.bet" cookie and break login in
// non-incognito browsers. Nuke them on every response.
app.use((req, res, next) => {
  if (req.headers.cookie && /(?:^|;\s*)connect\.sid=/.test(req.headers.cookie)) {
    const expire = 'Expires=Thu, 01 Jan 1970 00:00:00 GMT';
    res.append('Set-Cookie', `connect.sid=; Path=/; ${expire}; SameSite=Lax`);
    if (IS_PROD) {
      res.append('Set-Cookie', `connect.sid=; Path=/; Domain=.vemnabet.bet; ${expire}; SameSite=None; Secure`);
      res.append('Set-Cookie', `connect.sid=; Path=/; Domain=vemnabet.bet; ${expire}; SameSite=None; Secure`);
    }
  }
  next();
});

// ── Referral capture middleware ─────────────────────────────
// Captures ?ref=<code|id> from URL (works across vemnabet.bet and
// app.vemnabet.bet) and persists it in session.pendingRef + a
// cross-subdomain cookie. Register picks it up automatically.
app.use((req, res, next) => {
  try {
    const ref = (req.query && (req.query.ref || req.query.subaff) ? String(req.query.ref || req.query.subaff) : '').trim();
    if (ref && /^[A-Za-z0-9_-]{1,64}$/.test(ref)) {
      if (req.session) req.session.pendingRef = ref;
      // Cookie scoped to the parent domain so app.* and root share it
      const cookieParts = [
        `vnb_ref=${encodeURIComponent(ref)}`,
        'Path=/',
        `Max-Age=${30 * 24 * 60 * 60}`,
        'SameSite=Lax'
      ];
      if (IS_PROD) { cookieParts.push('Domain=.vemnabet.bet'); cookieParts.push('Secure'); }
      // Use append so we don't clobber session Set-Cookie already queued by express-session
      res.append('Set-Cookie', cookieParts.join('; '));
      // Fire-and-forget visit tracking (dedup: 1 visit per session, best-effort)
      if (req.session && !req.session.refVisitLogged) {
        req.session.refVisitLogged = true;
        (async () => {
          try {
            const pool = require('./src/config/database');
            // Try link code first, fall back to affiliate code
            const link = await pool.query('SELECT id, affiliate_id FROM affiliate_links WHERE code = $1 LIMIT 1', [ref]);
            let affId = null, linkId = null;
            if (link.rows.length) { linkId = link.rows[0].id; affId = link.rows[0].affiliate_id; }
            else {
              const a = await pool.query('SELECT id FROM affiliates WHERE code = $1 LIMIT 1', [ref]);
              if (a.rows.length) affId = a.rows[0].id;
            }
            if (affId) {
              const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
              const ua = (req.headers['user-agent'] || '').toString().slice(0, 500);
              await pool.query('INSERT INTO affiliate_visits (affiliate_id, link_id, ip, user_agent) VALUES ($1, $2, $3, $4)', [affId, linkId, ip, ua]);
              await pool.query('UPDATE affiliates SET visits_total = visits_total + 1 WHERE id = $1', [affId]);
              if (linkId) await pool.query('UPDATE affiliate_links SET clicks = clicks + 1 WHERE id = $1', [linkId]);
            }
          } catch (_) { /* non-fatal */ }
        })();
      }
    } else if (req.session && !req.session.pendingRef && req.headers.cookie) {
      // Fallback: pick up vnb_ref cookie set by the subdomain tracker
      const m = req.headers.cookie.match(/(?:^|;\s*)vnb_ref=([^;]+)/);
      if (m) {
        const c = decodeURIComponent(m[1]);
        if (/^[A-Za-z0-9_-]{1,64}$/.test(c)) req.session.pendingRef = c;
      }
    }
  } catch (e) { /* non-fatal */ }
  next();
});

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use('/public', express.static(path.join(__dirname, 'public')));

// Prevent Cloudflare/edge from caching HTML + API responses (logged-in state must not be cached)
app.use((req, res, next) => {
  if (req.path.startsWith('/public/') || req.path.startsWith('/assets/') ||
      /\.(css|js|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|eot)$/i.test(req.path)) {
    return next(); // let static assets cache normally
  }
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('CDN-Cache-Control', 'no-store');
  res.set('Cloudflare-CDN-Cache-Control', 'no-store');
  res.set('Vary', 'Cookie');
  next();
});

// Theme middleware — injects full theme object into all views
app.use(async (req, res, next) => {
  try {
    const r = await pool.query(
      `SELECT t.* FROM themes t
       JOIN platform_settings ps ON ps.value = t.slug
       WHERE ps.key = 'active_theme' LIMIT 1`
    );
    const theme = r.rows[0] || null;
    res.locals.activeTheme = theme?.slug || 'default';
    res.locals.theme = theme;
    res.locals.layoutConfig = theme?.layout_config || {};
    if (typeof res.locals.layoutConfig === 'string') {
      try { res.locals.layoutConfig = JSON.parse(res.locals.layoutConfig); } catch { res.locals.layoutConfig = {}; }
    }
    // Sports enabled setting
    const sportsR = await pool.query("SELECT value FROM platform_settings WHERE key = 'sports_enabled' LIMIT 1");
    res.locals.sportsEnabled = sportsR.rows[0]?.value === '1';

    // Logo settings
    const logoR = await pool.query("SELECT key, value FROM platform_settings WHERE key IN ('logo_dark', 'logo_light', 'promo_banner_1', 'promo_banner_2', 'promo_banner_3', 'promo_banner_1_link', 'promo_banner_2_link', 'promo_banner_3_link', 'side_banner_1', 'side_banner_2', 'side_banner_1_link', 'side_banner_2_link', 'min_deposit', 'min_withdrawal', 'career_plan_enabled')");
    const pset = {};
    logoR.rows.forEach(r => { pset[r.key] = r.value; });
    res.locals.logoDark = pset.logo_dark || '';
    res.locals.logoLight = pset.logo_light || '';
    res.locals.promoBanner1 = pset.promo_banner_1 || '';
    res.locals.promoBanner2 = pset.promo_banner_2 || '';
    res.locals.promoBanner3 = pset.promo_banner_3 || '';
    res.locals.promoBanner1Link = pset.promo_banner_1_link || '#';
    res.locals.promoBanner2Link = pset.promo_banner_2_link || '#';
    res.locals.promoBanner3Link = pset.promo_banner_3_link || '#';
    res.locals.sideBanner1 = pset.side_banner_1 || '';
    res.locals.sideBanner2 = pset.side_banner_2 || '';
    res.locals.sideBanner1Link = pset.side_banner_1_link || '#';
    res.locals.sideBanner2Link = pset.side_banner_2_link || '#';
    res.locals.minDepositCents = parseInt(pset.min_deposit || '2000', 10) || 2000;
    res.locals.minWithdrawalCents = parseInt(pset.min_withdrawal || '5000', 10) || 5000;
    res.locals.careerPlanEnabled = pset.career_plan_enabled === '1';
  } catch {
    res.locals.activeTheme = 'default';
    res.locals.theme = null;
    res.locals.layoutConfig = {};
    res.locals.sportsEnabled = false;
    res.locals.logoDark = '';
    res.locals.logoLight = '';
    res.locals.minDepositCents = 2000;
    res.locals.minWithdrawalCents = 5000;
    res.locals.careerPlanEnabled = false;
  }
  res.locals.user = req.session.user || null;
  next();
});

// ── Custom affiliate domains: host → ref resolution (5min in-memory LRU) ──
const { signRef: _signRef, verifyRef: _verifyRef } = require('./src/utils/refToken');
const KNOWN_HOSTS = new Set([
  'vemnabet.bet', 'www.vemnabet.bet', 'app.vemnabet.bet',
  'cassino-production-1faa.up.railway.app',
  'straplay-production.up.railway.app',
  'localhost', '127.0.0.1'
]);
const _domainCache = new Map(); // host → { ref, destination, expires }
function _cacheGet(host) {
  const v = _domainCache.get(host);
  if (!v) return undefined;
  if (v.expires < Date.now()) { _domainCache.delete(host); return undefined; }
  return v;
}
function _cacheSet(host, data) {
  if (_domainCache.size > 500) _domainCache.clear();
  _domainCache.set(host, Object.assign({ expires: Date.now() + 5 * 60 * 1000 }, data));
}

async function resolveCustomHost(host) {
  if (!host) return null;
  host = host.toLowerCase().split(':')[0];
  if (KNOWN_HOSTS.has(host) || /\.up\.railway\.app$/.test(host)) return null;
  const cached = _cacheGet(host);
  if (cached !== undefined) return cached.ref ? cached : null;
  try {
    const r = await pool.query(
      `SELECT a.code, d.destination FROM affiliate_domains d
       JOIN affiliates a ON a.id = d.affiliate_id
       WHERE LOWER(d.domain) = $1 AND d.status IN ('active','pending') AND a.is_active = TRUE
       LIMIT 1`,
      [host]
    );
    if (!r.rows.length) { _cacheSet(host, { ref: null, destination: null }); return null; }
    const data = { ref: r.rows[0].code, destination: r.rows[0].destination || 'app' };
    _cacheSet(host, data);
    return data;
  } catch (e) {
    console.error('[custom-domain resolve]', e.message);
    return null;
  }
}

// Middleware: if request arrives on a registered custom domain → handle it
app.use(async (req, res, next) => {
  const host = (req.headers.host || '').toLowerCase().split(':')[0];
  // Skip /health, /api/webhook*, /public/*, static assets — never custom-domain-handled
  if (!host ||
      req.path === '/health' || req.path === '/healthz' ||
      req.path.startsWith('/api/webhook') ||
      req.path.startsWith('/webhook') ||
      req.path.startsWith('/public/') ||
      req.path.startsWith('/assets/')) return next();

  const d = await resolveCustomHost(host);
  if (!d || !d.ref) return next();

  // Attach ref to the request/session for any downstream logic
  req.affiliateRef = d.ref;
  if (req.session && !req.session.pendingRef) req.session.pendingRef = d.ref;

  // /r/:token, /api/* calls on custom domain → pass through (cookie fallback)
  if (req.path.startsWith('/r/') || req.path.startsWith('/api/')) return next();

  // destination=app → camouflaged 302 to app.vemnabet.bet/r/<token>
  if (d.destination === 'app') {
    const token = _signRef(d.ref);
    if (!token) return next();
    return res.redirect(302, 'https://app.vemnabet.bet/r/' + encodeURIComponent(token));
  }

  // destination=cassino → serve landing with ref cookie
  const parts = [
    `vnb_ref=${encodeURIComponent(d.ref)}`,
    'Path=/',
    `Max-Age=${30 * 24 * 60 * 60}`,
    'SameSite=Lax'
  ];
  if (IS_PROD) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
  return next();
});

// /r/:token — HMAC-signed token carrying an affiliate ref code.
// Sets cookie scoped to .vemnabet.bet and 302s to "/", camouflando o código.
app.get('/r/:token', (req, res) => {
  const ref = _verifyRef(req.params.token);
  if (!ref) return res.redirect(302, '/');
  const parts = [
    `vnb_ref=${encodeURIComponent(ref)}`,
    'Path=/',
    `Max-Age=${30 * 24 * 60 * 60}`,
    'SameSite=Lax'
  ];
  if (IS_PROD) { parts.push('Domain=.vemnabet.bet'); parts.push('Secure'); }
  res.append('Set-Cookie', parts.join('; '));
  if (req.session) req.session.pendingRef = ref;
  return res.redirect(302, '/');
});

// Routes
app.use('/', require('./src/routes/pages'));
app.use('/api', require('./src/routes/api'));
app.use('/api/webhook', require('./src/routes/webhook'));
app.use('/api/webhook/playfivers', require('./src/routes/webhookPlayfivers'));
app.use('/webhook', require('./src/routes/webhookPlayfivers')); // PlayFivers BALANCE calls /webhook
app.use('/admin', require('./src/routes/admin'));
app.use('/admin/api', require('./src/routes/adminApi'));
app.use('/dashboard', require('./src/routes/userDashboard'));

// 404
app.use((req, res) => {
  res.status(404).render('404', { title: 'Não encontrado' });
});

// Error handler
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.stack || err);
  res.status(500).json({ ok: false, msg: 'Erro interno do servidor' });
});

// Auto-migrate on startup
async function autoMigrate() {
  try {
    const fs = require('fs');
    const bcrypt = require('bcrypt');
    const sql = fs.readFileSync(path.join(__dirname, 'src/config/schema.sql'), 'utf8');
    await pool.query(sql);
    console.log('[MIGRATE] Schema applied.');

    await pool.query(`
      UPDATE platform_settings
      SET value = '35000'
      WHERE key = 'aff_min_withdrawal' AND COALESCE(NULLIF(value, ''), '5000') = '5000'
        AND NOT EXISTS (SELECT 1 FROM platform_settings WHERE key = 'migration_aff_min_withdrawal_350')
    `);
    await pool.query(`
      INSERT INTO platform_settings (key, value) VALUES
        ('aff_min_withdrawal', '35000'),
        ('aff_payment_interval_days', '15'),
        ('migration_aff_min_withdrawal_350', '1')
      ON CONFLICT (key) DO NOTHING
    `);
    await pool.query(`
      INSERT INTO platform_settings (key, value) VALUES
        ('min_deposit', '2000'),
        ('min_withdrawal', '5000'),
        ('aff_auto_approve', '0'),
        ('migration_finance_manual_affiliates_20260428', '1')
      ON CONFLICT (key) DO NOTHING
    `);
    await pool.query(`
      UPDATE platform_settings
      SET value = CASE key
        WHEN 'min_deposit' THEN '2000'
        WHEN 'min_withdrawal' THEN '5000'
        WHEN 'aff_auto_approve' THEN '0'
        ELSE value
      END
      WHERE key IN ('min_deposit', 'min_withdrawal', 'aff_auto_approve')
        AND NOT EXISTS (SELECT 1 FROM platform_settings WHERE key = 'migration_finance_manual_affiliates_applied_20260428')
    `);
    await pool.query(`
      INSERT INTO platform_settings (key, value)
      VALUES ('migration_finance_manual_affiliates_applied_20260428', '1')
      ON CONFLICT (key) DO NOTHING
    `);
    // Add columns if missing (safe migrations)
    const addCol = async (table, col, type) => {
      try { await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${type}`); } catch(e) {}
    };
    await addCol('users', 'name', 'VARCHAR(128)');
    await addCol('users', 'birth_date', 'DATE');
    await addCol('users', 'address_cep', 'VARCHAR(16)');
    await addCol('users', 'address_street', 'TEXT');
    await addCol('users', 'address_city', 'VARCHAR(128)');
    await addCol('users', 'address_state', 'VARCHAR(4)');
    await addCol('users', 'pix_type', "VARCHAR(16) DEFAULT 'cpf'");
    await addCol('users', 'pix_key', 'VARCHAR(255)');
    await addCol('users', 'avatar_url', 'TEXT');
    await addCol('users', 'kyc_status', "VARCHAR(16) DEFAULT 'pending'");
    await addCol('users', 'kyc_notes', 'TEXT');
    await addCol('users', 'block_reason', 'TEXT');
    await addCol('affiliate_commissions', 'metadata_json', "JSONB DEFAULT '{}'::jsonb");

    // Top 10 featured games
    await addCol('games', 'is_featured', 'BOOLEAN DEFAULT FALSE');
    await addCol('games', 'featured_order', 'INT DEFAULT 0');

    // PlayFivers integration columns
    await addCol('games', 'pf_game_code', 'VARCHAR(128)');
    await addCol('games', 'pf_provider', 'VARCHAR(128)');
    await addCol('games', 'game_original', 'BOOLEAN DEFAULT FALSE');

    // Game transactions table (PlayFivers webhooks)
    await pool.query(`CREATE TABLE IF NOT EXISTS game_transactions (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game_id INT REFERENCES games(id) ON DELETE SET NULL,
      txn_id VARCHAR(255) UNIQUE,
      round_id VARCHAR(255),
      txn_type VARCHAR(32),
      bet_cents BIGINT DEFAULT 0,
      win_cents BIGINT DEFAULT 0,
      balance_before BIGINT DEFAULT 0,
      balance_after BIGINT DEFAULT 0,
      provider_code VARCHAR(64),
      pf_game_code VARCHAR(128),
      raw_payload JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_gtx_user ON game_transactions(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_gtx_txn ON game_transactions(txn_id)');

    // Jogo Responsável limits
    await addCol('users', 'limit_deposit_type', "VARCHAR(16) DEFAULT 'unlimited'");
    await addCol('users', 'limit_deposit_period', 'VARCHAR(16)');
    await addCol('users', 'limit_deposit_amount', 'INTEGER DEFAULT 0');
    await addCol('users', 'limit_bet_type', "VARCHAR(16) DEFAULT 'unlimited'");
    await addCol('users', 'limit_bet_period', 'VARCHAR(16)');
    await addCol('users', 'limit_bet_amount', 'INTEGER DEFAULT 0');
    await addCol('users', 'limit_loss_type', "VARCHAR(16) DEFAULT 'unlimited'");
    await addCol('users', 'limit_loss_period', 'VARCHAR(16)');
    await addCol('users', 'limit_loss_amount', 'INTEGER DEFAULT 0');
    await addCol('users', 'limit_time_type', "VARCHAR(16) DEFAULT 'unlimited'");
    await addCol('users', 'limit_time_period', 'VARCHAR(16)');
    await addCol('users', 'limit_time_value', 'VARCHAR(16)');

    // Withdrawals table
    await pool.query(`CREATE TABLE IF NOT EXISTS withdrawals (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount_cents INTEGER NOT NULL,
      pix_type VARCHAR(16),
      pix_key VARCHAR(255),
      status VARCHAR(16) DEFAULT 'pending',
      admin_note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    // Login history table
    await pool.query(`CREATE TABLE IF NOT EXISTS login_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ip VARCHAR(64),
      city VARCHAR(128),
      state VARCHAR(64),
      coords VARCHAR(64),
      user_agent TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    // Notifications table
    await pool.query(`CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL DEFAULT 0,
      tipo VARCHAR(30) DEFAULT 'info',
      titulo VARCHAR(255) NOT NULL,
      mensagem TEXT DEFAULT '',
      link VARCHAR(500) DEFAULT '',
      lida BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, lida, created_at DESC)`);

    // Sports categories
    await pool.query(`CREATE TABLE IF NOT EXISTS sports_categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      slug VARCHAR(128) NOT NULL UNIQUE,
      icon_url VARCHAR(512),
      sort_order INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    // Leagues
    await pool.query(`CREATE TABLE IF NOT EXISTS leagues (
      id SERIAL PRIMARY KEY,
      sport_id INT REFERENCES sports_categories(id) ON DELETE CASCADE,
      name VARCHAR(256) NOT NULL,
      slug VARCHAR(256) NOT NULL UNIQUE,
      country VARCHAR(64),
      icon_url VARCHAR(512),
      sort_order INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_leagues_sport ON leagues(sport_id)`);

    // Coupons
    await pool.query(`CREATE TABLE IF NOT EXISTS coupons (
      id SERIAL PRIMARY KEY,
      code VARCHAR(64) NOT NULL UNIQUE,
      description TEXT,
      type VARCHAR(32) NOT NULL DEFAULT 'bonus',
      value_cents INT NOT NULL DEFAULT 0,
      value_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
      min_deposit INT NOT NULL DEFAULT 0,
      max_uses INT NOT NULL DEFAULT 0,
      used_count INT NOT NULL DEFAULT 0,
      max_per_user INT NOT NULL DEFAULT 1,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      starts_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    // User coupons (track usage)
    await pool.query(`CREATE TABLE IF NOT EXISTS user_coupons (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      coupon_id INT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
      used_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_coupons_user ON user_coupons(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_coupons_coupon ON user_coupons(coupon_id)`);

    // User limits (Responsible Gaming)
    await pool.query(`CREATE TABLE IF NOT EXISTS user_limits (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      limit_type VARCHAR(32) NOT NULL DEFAULT 'deposit',
      period VARCHAR(32) NOT NULL DEFAULT 'daily',
      limit_value INT NOT NULL DEFAULT 0,
      enforced_by VARCHAR(16) DEFAULT 'admin',
      admin_notes TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_limits_user ON user_limits(user_id)`);

    // Provider images
    await pool.query(`CREATE TABLE IF NOT EXISTS provider_images (
      id SERIAL PRIMARY KEY,
      provider_name VARCHAR(128) NOT NULL UNIQUE,
      image_url TEXT NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

    // Seed default provider images
    const piCount = await pool.query('SELECT COUNT(*) FROM provider_images');
    if (parseInt(piCount.rows[0].count) === 0) {
      await pool.query(`INSERT INTO provider_images (provider_name, image_url, sort_order) VALUES
        ('PGSOFT', '/public/img/novo/estudio1.png', 1),
        ('EVOLUTION', '/public/img/novo/estudio2.png', 2),
        ('SPRIBE', '/public/img/novo/estudio3.png', 3),
        ('PRAGMATIC', '/public/img/novo/estudio4.png', 4),
        ('1XGAMING', '/public/img/novo/estudio5.png', 5),
        ('NETENT', '/public/img/novo/estudio6.png', 6)
      ON CONFLICT (provider_name) DO NOTHING`);
      console.log('[SEED] Provider images seeded ');
    }

    // Seed test notifications for user 24
    const notifCount = await pool.query('SELECT COUNT(*) FROM notifications WHERE user_id = 24');
    if (parseInt(notifCount.rows[0].count) === 0) {
      await pool.query(`INSERT INTO notifications (user_id, tipo, titulo, mensagem) VALUES
        (24, 'success', 'Bem-vindo à VemNaBet!', 'Sua conta foi criada com sucesso. Aproveite nossos jogos!'),
        (24, 'deposit', 'Depósito confirmado', 'Seu depósito de R$ 100,00 foi creditado na sua carteira.'),
        (24, 'promo', 'Bônus especial de boas-vindas', 'Você ganhou 20 rodadas grátis no Fortune Tiger! Jogue agora.'),
        (24, 'info', 'Verificação de identidade', 'Complete seu cadastro com CPF e data de nascimento para liberar saques.'),
        (24, 'warning', 'Sessão em novo dispositivo', 'Detectamos um novo acesso à sua conta. Se não foi você, altere sua senha.'),
        (0, 'promo', 'Promoção de Páscoa!', 'Deposite R$ 50 e ganhe R$ 25 de bônus. Válido até domingo!'),
        (0, 'info', 'Manutenção programada', 'O sistema ficará indisponível dia 10/04 das 03:00 à s 05:00 para manutenção.')
      `);
      console.log('[MIGRATE] Notifications seeded for user 24 ');
    }

    // ——— Affiliate v3: multiple links + withdrawals + levels —————
    await addCol('affiliates', 'parent_id', 'INT REFERENCES affiliates(id) ON DELETE SET NULL');
    await addCol('affiliates', 'level', 'INT NOT NULL DEFAULT 1');
    await addCol('affiliates', 'visits_total', 'BIGINT NOT NULL DEFAULT 0');
    await addCol('affiliates', 'model', "VARCHAR(16) NOT NULL DEFAULT 'revshare'");
    await addCol('affiliates', 'cpa_amount_cents', 'BIGINT NOT NULL DEFAULT 0');
    await pool.query(`CREATE TABLE IF NOT EXISTS affiliate_links (
      id           SERIAL PRIMARY KEY,
      affiliate_id INT NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
      name         VARCHAR(128) NOT NULL,
      code         VARCHAR(64) NOT NULL UNIQUE,
      clicks       BIGINT NOT NULL DEFAULT 0,
      signups      BIGINT NOT NULL DEFAULT 0,
      deposits     BIGINT NOT NULL DEFAULT 0,
      is_active    BOOLEAN NOT NULL DEFAULT TRUE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_aff_links_aff ON affiliate_links(affiliate_id)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS affiliate_withdrawals (
      id           SERIAL PRIMARY KEY,
      affiliate_id INT NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
      user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount_cents BIGINT NOT NULL DEFAULT 0,
      pix_type     VARCHAR(16),
      pix_key      VARCHAR(255),
      status       VARCHAR(32) NOT NULL DEFAULT 'pending',
      notes        TEXT,
      requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      paid_at      TIMESTAMPTZ
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_aff_wd_user ON affiliate_withdrawals(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_aff_wd_status ON affiliate_withdrawals(status)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS affiliate_visits (
      id           SERIAL PRIMARY KEY,
      affiliate_id INT REFERENCES affiliates(id) ON DELETE CASCADE,
      link_id      INT REFERENCES affiliate_links(id) ON DELETE SET NULL,
      ip           VARCHAR(64),
      user_agent   TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_aff_visits_aff ON affiliate_visits(affiliate_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_aff_visits_created ON affiliate_visits(created_at)`);

    // ——— Per-affiliate "Links Úteis" (4 image+url slots rendered by external app) ——
    await pool.query(`CREATE TABLE IF NOT EXISTS affiliate_useful_links (
      affiliate_id INT NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
      slot         SMALLINT NOT NULL CHECK (slot BETWEEN 1 AND 4),
      image_url    TEXT,
      target_url   TEXT,
      title        VARCHAR(120),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (affiliate_id, slot)
    )`);

    // ——— Per-affiliate custom domains (ref resolved by Host header) ———————
    // mode: 'cname'    → afiliado apontou CNAME para vemnabet.bet/app.vemnabet.bet
    //       'snippet'  → afiliado hospeda o próprio site e usa um snippet que redireciona
    // destination: 'app' (default) → redireciona para https://app.vemnabet.bet
    //              'cassino'       → serve a landing de vemnabet.bet com ref setado
    await pool.query(`CREATE TABLE IF NOT EXISTS affiliate_domains (
      id             SERIAL PRIMARY KEY,
      affiliate_id   INT NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
      domain         VARCHAR(253) NOT NULL,
      mode           VARCHAR(16) NOT NULL DEFAULT 'cname',
      destination    VARCHAR(16) NOT NULL DEFAULT 'app',
      status         VARCHAR(16) NOT NULL DEFAULT 'pending',
      last_checked_at TIMESTAMPTZ,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_aff_domains_domain ON affiliate_domains (LOWER(domain))`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_aff_domains_aff ON affiliate_domains (affiliate_id)`);

    await pool.query(`
      INSERT INTO games (game_code, game_name, image_url, provider, category, sort_order, is_active, pf_game_code, pf_provider, game_original, is_featured, featured_order)
      VALUES ('oficial-pragmatic-live-pp-28401', 'French Roulette', 'https://imagensfivers.com/Games/Pragmatic-Play/PP_28401.webp', 'OFICIAL - PRAGMATIC LIVE', 'live', -100, TRUE, 'PP_28401', 'OFICIAL - PRAGMATIC LIVE', TRUE, TRUE, 1)
      ON CONFLICT (game_code) DO UPDATE SET
        game_name = EXCLUDED.game_name,
        image_url = EXCLUDED.image_url,
        provider = EXCLUDED.provider,
        category = 'live',
        sort_order = LEAST(COALESCE(games.sort_order, 0), -100),
        is_active = TRUE,
        pf_game_code = EXCLUDED.pf_game_code,
        pf_provider = EXCLUDED.pf_provider,
        game_original = TRUE,
        is_featured = TRUE,
        featured_order = 1
    `);
    await pool.query(`
      UPDATE games
      SET sort_order = -100,
          is_featured = TRUE,
          featured_order = 1,
          category = 'live',
          pf_game_code = 'PP_28401',
          pf_provider = 'OFICIAL - PRAGMATIC LIVE',
          provider = 'OFICIAL - PRAGMATIC LIVE'
      WHERE game_code = 'oficial-pragmatic-live-pp-28401' OR pf_game_code IN ('28401', 'PP_28401')
    `);

    // ——— Chatbot sessions (for analytics / escalation) ——————————
    await pool.query(`CREATE TABLE IF NOT EXISTS chat_sessions (
      id           SERIAL PRIMARY KEY,
      user_id      INT REFERENCES users(id) ON DELETE SET NULL,
      session_key  VARCHAR(64) NOT NULL UNIQUE,
      escalated    BOOLEAN NOT NULL DEFAULT FALSE,
      ticket_id    INT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS chat_messages (
      id           SERIAL PRIMARY KEY,
      session_id   INT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      sender       VARCHAR(16) NOT NULL DEFAULT 'user',
      intent       VARCHAR(64),
      message      TEXT NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_chat_msg_sess ON chat_messages(session_id)`);

    // ——— Dedup: deactivate duplicate games (keep synced version) —————
    // Strip "OFICIAL - " prefix so PlayFivers clones (e.g. "OFICIAL - PG SOFT" + "PGSOFT")
    // collapse into the same partition.
    const dedupResult = await pool.query(`
      WITH ranked AS (
        SELECT id,
          ROW_NUMBER() OVER (
            PARTITION BY LOWER(TRIM(COALESCE(game_name,''))),
                         LOWER(TRIM(REGEXP_REPLACE(COALESCE(provider,''),'^OFICIAL\\s*-\\s*','','i')))
            ORDER BY (pf_game_code IS NOT NULL) DESC, id ASC
          ) as rn
        FROM games
        WHERE is_active = TRUE
      )
      UPDATE games SET is_active = FALSE
      WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
    `);
    if (dedupResult.rowCount > 0) console.log('[MIGRATE] Deduped ' + dedupResult.rowCount + ' duplicate games');

    // ——— Deactivate games whose provider is NOT in the funded PlayFivers list —————
    const cleanupResult = await pool.query(`
      UPDATE games SET is_active = FALSE
      WHERE is_active = TRUE
        AND LOWER(COALESCE(pf_provider, provider, '')) !~ '(pg ?soft|pg-soft|pragmatic|evolution|spribe|netent|ezugi|evoplay|hacksaw|nolimit|red tiger|micro gaming|spinomenal|booming|bgaming|3oaks|habanero|playson|reelkingdom|booongo|cq9|tada|epicwin|fachai|jdb|live22|live88|spade gaming|big time gaming|advantplay|alize slots|askmeslot|aviatrix|cg|cp games|dreamgaming|fat ?panda|gtf|queenmaker|turbo games|winfinity|yellowbat|galaxsys|jetx|popok|toptrend|dreamtech|digitain)'
    `);
    if (cleanupResult.rowCount > 0) console.log('[MIGRATE] Deactivated ' + cleanupResult.rowCount + ' non-funded games');

    await pool.query(`
      UPDATE games
      SET category = 'live'
      WHERE LOWER(COALESCE(pf_provider, provider, '')) LIKE '%live%'
        AND pf_game_code IS NOT NULL
        AND pf_provider IS NOT NULL
        AND (
          LOWER(COALESCE(game_name, '')) LIKE '%roulette%'
          OR LOWER(COALESCE(game_name, '')) LIKE '%roleta%'
          OR LOWER(COALESCE(game_name, '')) LIKE '%baccarat%'
          OR LOWER(COALESCE(game_name, '')) LIKE '%blackjack%'
          OR LOWER(COALESCE(game_name, '')) LIKE '%dragon%'
        )
    `);

    const liveRouletteGames = [
      ['oficial-pragmatic-live-pp-203', 'Speed Roulette 1', 'https://imagensfivers.com/Games/Pragmatic-Play/PP_203.webp', 'OFICIAL - PRAGMATIC LIVE', 'PP_203', -99, true, 2],
      ['oficial-pragmatic-live-pp-266', 'VIP Auto Roulette', 'https://imagensfivers.com/Games/Pragmatic-Play/PP_266.webp', 'OFICIAL - PRAGMATIC LIVE', 'PP_266', -98, true, 3],
      ['oficial-pragmatic-live-pp-270', 'Fortune Roulette', 'https://imagensfivers.com/Games/Pragmatic-Play/PP_270.webp', 'OFICIAL - PRAGMATIC LIVE', 'PP_270', -97, true, 4],
      ['oficial-pragmatic-live-pp-292', 'Immersive Roulette Deluxe', 'https://imagensfivers.com/Games/Pragmatic-Play/PP_292.webp', 'OFICIAL - PRAGMATIC LIVE', 'PP_292', -96, false, null],
      ['oficial-pragmatic-live-pp-28201', 'Prive Lounge Roulette', 'https://imagensfivers.com/Games/Pragmatic-Play/PP_28201.webp', 'OFICIAL - PRAGMATIC LIVE', 'PP_28201', -95, false, null],
      ['oficial-pragmatic-live-pp-28301', 'Prive Lounge Roulette Deluxe', 'https://imagensfivers.com/Games/Pragmatic-Play/PP_28301.webp', 'OFICIAL - PRAGMATIC LIVE', 'PP_28301', -94, false, null],
      ['oficial-pragmatic-slots-pp-rla', 'Roulette', 'https://imagensfivers.com/Games/Pragmatic-Play/PP_rla.webp', 'OFICIAL - PRAGMATIC SLOTS', 'PP_rla', -93, false, null],
      ['oficial-evolution-live-evolive-immersive-roulette', 'Immersive Roulette', 'https://imagensfivers.com/Games/Evolution-Live/EVOLIVE_7x0b1tgh7agmf6hv.webp', 'OFICIAL - EVOLUTION LIVE', 'EVOLIVE_7x0b1tgh7agmf6hv', -92, false, null],
      ['oficial-evolution-live-evolive-xxxtreme-lightning-roulette', 'XXXtreme Lightning Roulette', 'https://imagensfivers.com/Games/Evolution-Live/EVOLIVE_XxxtremeLigh0001.webp', 'OFICIAL - EVOLUTION LIVE', 'EVOLIVE_XxxtremeLigh0001', -91, false, null],
      ['oficial-ezugi-ezugi-5001', 'Auto Roulette', 'https://imagensfivers.com/Games/Ezugi/EZUGI_5001.webp', 'OFICIAL - EZUGI', 'EZUGI_5001', -90, false, null],
      ['oficial-live88-bb-2076005', 'Portugues Roulette 1', 'https://imagensfivers.com/Games/Live88/BB_2076005.webp', 'OFICIAL - LIVE88', 'BB_2076005', -89, false, null],
      ['oficial-live88-bb-20749030', 'Deu Green Roulette', 'https://imagensfivers.com/Games/Live88/BB_20749030.webp', 'OFICIAL - LIVE88', 'BB_20749030', -88, false, null]
    ];
    for (const game of liveRouletteGames) {
      await pool.query(`
        INSERT INTO games (game_code, game_name, image_url, provider, category, sort_order, is_active, pf_game_code, pf_provider, game_original, is_featured, featured_order)
        VALUES ($1, $2, $3, $4, 'live', $6, TRUE, $5, $4, TRUE, $7, $8)
        ON CONFLICT (game_code) DO UPDATE SET
          game_name = EXCLUDED.game_name,
          image_url = EXCLUDED.image_url,
          provider = EXCLUDED.provider,
          category = 'live',
          sort_order = EXCLUDED.sort_order,
          is_active = TRUE,
          pf_game_code = EXCLUDED.pf_game_code,
          pf_provider = EXCLUDED.pf_provider,
          game_original = TRUE,
          is_featured = COALESCE(games.is_featured, FALSE) OR EXCLUDED.is_featured,
          featured_order = COALESCE(games.featured_order, EXCLUDED.featured_order)
      `, game);
    }

    // ——— Seed sample data for admin verification —————————————
    // Banners
    const bannerCount = await pool.query('SELECT COUNT(*) FROM banners');
    if (parseInt(bannerCount.rows[0].count) === 0) {
      await pool.query(`INSERT INTO banners (image_url, link_url, sort_order, is_active) VALUES
        ('/public/img/novo/22.webp', '/games?category=crash', 1, TRUE),
        ('/public/img/novo/33.webp', '/games?category=slots', 2, TRUE),
        ('/public/img/novo/44.webp', '/games?category=live', 3, TRUE)
      `);
      console.log('[SEED] Banners seeded ');
    }

    // Sports categories
    const sportCount = await pool.query('SELECT COUNT(*) FROM sports_categories');
    if (parseInt(sportCount.rows[0].count) === 0) {
      await pool.query(`INSERT INTO sports_categories (name, slug, icon_url, sort_order, is_active) VALUES
        ('Futebol', 'futebol', '/public/img/novo/top1.svg', 1, TRUE),
        ('Tênis', 'tenis', '/public/img/novo/top2.svg', 2, TRUE),
        ('Basquete', 'basquete', '/public/img/novo/top3.svg', 3, TRUE),
        ('Vôlei', 'volei', '/public/img/novo/top4.svg', 4, TRUE),
        ('Esportes Virtuais', 'esportes-virtuais', '/public/img/novo/top5.svg', 5, TRUE),
        ('MMA / UFC', 'mma', NULL, 6, TRUE),
        ('Futebol Americano', 'futebol-americano', NULL, 7, TRUE),
        ('Baseball', 'baseball', NULL, 8, TRUE)
      `);
      console.log('[SEED] Sports categories seeded ');
    }

    // Leagues
    const leagueCount = await pool.query('SELECT COUNT(*) FROM leagues');
    if (parseInt(leagueCount.rows[0].count) === 0) {
      const futId = await pool.query("SELECT id FROM sports_categories WHERE slug='futebol' LIMIT 1");
      const basqId = await pool.query("SELECT id FROM sports_categories WHERE slug='basquete' LIMIT 1");
      const fid = futId.rows[0]?.id || 1;
      const bid = basqId.rows[0]?.id || 3;
      await pool.query(`INSERT INTO leagues (sport_id, name, slug, country, icon_url, sort_order, is_active) VALUES
        (${fid}, 'Brasileirão Série A', 'brasileirao-a', 'BR', '/public/img/novo/popular1.svg', 1, TRUE),
        (${fid}, 'Copa Libertadores', 'libertadores', 'SA', '/public/img/novo/popular2.svg', 2, TRUE),
        (${fid}, 'Premier League', 'premier-league', 'GB', '/public/img/novo/popular3.svg', 3, TRUE),
        (${fid}, 'La Liga', 'la-liga', 'ES', '/public/img/novo/popular4.svg', 4, TRUE),
        (${fid}, 'Serie A', 'serie-a-italia', 'IT', '/public/img/novo/popular5.svg', 5, TRUE),
        (${fid}, 'Ligue 1', 'ligue-1', 'FR', '/public/img/novo/popular6.svg', 6, TRUE),
        (${fid}, 'Bundesliga', 'bundesliga', 'DE', '/public/img/novo/popular7.svg', 7, TRUE),
        (${fid}, 'UEFA Champions League', 'champions-league', 'EU', '/public/img/novo/popular8.svg', 8, TRUE),
        (${bid}, 'NBA', 'nba', 'US', '/public/img/novo/popular9.svg', 9, TRUE),
        (${fid}, 'Copa do Brasil', 'copa-do-brasil', 'BR', NULL, 10, TRUE),
        (${fid}, 'Europa League', 'europa-league', 'EU', NULL, 11, TRUE),
        (${fid}, 'Brasileirão Série B', 'brasileirao-b', 'BR', NULL, 12, TRUE)
      `);
      console.log('[SEED] Leagues seeded ');
    }

    // Coupons
    const couponCount = await pool.query('SELECT COUNT(*) FROM coupons');
    if (parseInt(couponCount.rows[0].count) === 0) {
      await pool.query(`INSERT INTO coupons (code, description, type, value_cents, value_pct, min_deposit, max_uses, max_per_user, is_active, expires_at) VALUES
        ('BEMVINDO50', 'Bônus de boas-vindas 50%', 'percentage', 0, 50.00, 2000, 1000, 1, TRUE, NOW() + INTERVAL '90 days'),
        ('PIX20', 'R$ 20 de bônus no PIX', 'bonus', 2000, 0, 5000, 500, 1, TRUE, NOW() + INTERVAL '60 days'),
        ('VEMNABET10', '10% cashback na primeira aposta', 'percentage', 0, 10.00, 1000, 2000, 1, TRUE, NOW() + INTERVAL '30 days'),
        ('FREEBET25', 'Aposta grátis de R$ 25', 'bonus', 2500, 0, 0, 200, 1, TRUE, NOW() + INTERVAL '15 days'),
        ('VIP100', 'Bônus exclusivo VIP R$ 100', 'bonus', 10000, 0, 10000, 50, 1, TRUE, NOW() + INTERVAL '365 days')
      `);
      console.log('[SEED] Coupons seeded ');
    }

    // Promotions
    const promoCount = await pool.query('SELECT COUNT(*) FROM promotions');
    if (parseInt(promoCount.rows[0].count) === 0) {
      await pool.query(`INSERT INTO promotions (title, description, type, value_cents, value_pct, min_deposit, max_uses, code, is_active, starts_at, expires_at) VALUES
        ('Bônus de Primeiro Depósito', 'Ganhe 100% de bônus no seu primeiro depósito até R$ 500', 'bonus', 50000, 100.00, 2000, 0, 'FIRST100', TRUE, NOW(), NOW() + INTERVAL '365 days'),
        ('Cashback Semanal', 'Receba 10% de cashback sobre suas perdas da semana', 'cashback', 0, 10.00, 0, 0, 'CASHBACK10', TRUE, NOW(), NOW() + INTERVAL '365 days'),
        ('Rodadas Grátis Fortune Tiger', '20 rodadas grátis no Fortune Tiger para novos jogadores', 'free_spins', 0, 0, 5000, 500, 'FTIG20', TRUE, NOW(), NOW() + INTERVAL '90 days'),
        ('Indique e Ganhe', 'Ganhe R$ 50 por cada amigo indicado que depositar', 'referral', 5000, 0, 0, 0, NULL, TRUE, NOW(), NULL),
        ('Happy Hour Dobrado', 'Depósitos entre 18h-22h ganham 50% extra', 'bonus', 0, 50.00, 2000, 0, 'HAPPY50', TRUE, NOW(), NOW() + INTERVAL '180 days')
      `);
      console.log('[SEED] Promotions seeded ');
    }

    // Sample users (for bets, transactions, etc.)
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCount.rows[0].count) < 5) {
      const sampleHash = await bcrypt.hash('Senha@123', 10);
      const sampleUsers = [
        ['jogador_pk', 'Pedro Kalil', '11999887766', 'pedro@teste.com', '123.456.789-00', sampleHash, 1500.00],
        ['maria_slots', 'Maria Santos', '21988776655', 'maria@teste.com', '987.654.321-00', sampleHash, 2300.50],
        ['carlos_bet', 'Carlos Oliveira', '31977665544', 'carlos@teste.com', '456.789.123-00', sampleHash, 800.00],
        ['ana_vip', 'Ana Costa', '41966554433', 'ana@teste.com', '321.654.987-00', sampleHash, 5200.75],
        ['lucas_pro', 'Lucas Fernandes', '51955443322', 'lucas@teste.com', '654.321.456-00', sampleHash, 350.00],
        ['julia_lucky', 'Julia Mendes', '61944332211', 'julia@teste.com', '789.123.456-00', sampleHash, 4100.00],
        ['rafael_high', 'Rafael Almeida', '71933221100', 'rafael@teste.com', '147.258.369-00', sampleHash, 8500.00],
        ['camila_win', 'Camila Rodrigues', '81922110099', 'camila@teste.com', '258.369.147-00', sampleHash, 1200.00]
      ];
      for (const [username, name, phone, email, cpf, hash2, bal] of sampleUsers) {
        await pool.query(`INSERT INTO users (username, name, phone, email, cpf, password_hash, balance) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (username) DO NOTHING`, [username, name, phone, email, cpf, hash2, bal]);
      }
      console.log('[SEED] Sample users seeded ');
    }

    // Sample transactions (deposits + withdrawals)
    const txCount = await pool.query("SELECT COUNT(*) FROM transactions WHERE type='deposit' AND status='paid'");
    if (parseInt(txCount.rows[0].count) < 5) {
      const userIds = (await pool.query('SELECT id FROM users ORDER BY id LIMIT 8')).rows.map(r => r.id);
      if (userIds.length >= 5) {
        const txData = [];
        const amounts = [5000, 10000, 2000, 15000, 50000, 3000, 7500, 25000, 1000, 8000, 20000, 12000, 4000, 35000, 6000];
        for (let i = 0; i < 15; i++) {
          const uid = userIds[i % userIds.length];
          const amt = amounts[i];
          const daysAgo = Math.floor(Math.random() * 14);
          txData.push(`(${uid}, 'deposit', 'paid', ${amt}, 'pix', 'PIX-${Date.now()}-${i}', NOW() - INTERVAL '${daysAgo} days')`);
        }
        await pool.query(`INSERT INTO transactions (user_id, type, status, amount_cents, provider, provider_ref, created_at) VALUES ${txData.join(',')}`);
        // Some withdrawal transactions
        for (let i = 0; i < 5; i++) {
          const uid = userIds[i % userIds.length];
          const amt = [3000, 5000, 2000, 10000, 1500][i];
          const daysAgo = Math.floor(Math.random() * 10);
          await pool.query(`INSERT INTO transactions (user_id, type, status, amount_cents, provider, created_at) VALUES ($1, 'withdrawal', 'paid', $2, 'pix', NOW() - INTERVAL '${daysAgo} days')`, [uid, amt]);
        }
        console.log('[SEED] Transactions seeded ');
      }
    }

    // Sample bets
    const betCount = await pool.query('SELECT COUNT(*) FROM bets');
    if (parseInt(betCount.rows[0].count) < 5) {
      const userIds = (await pool.query('SELECT id FROM users ORDER BY id LIMIT 8')).rows.map(r => r.id);
      const gameIds = (await pool.query('SELECT id FROM games WHERE is_active = TRUE ORDER BY RANDOM() LIMIT 15')).rows.map(r => r.id);
      if (userIds.length >= 3 && gameIds.length >= 5) {
        const betValues = [];
        for (let i = 0; i < 25; i++) {
          const uid = userIds[i % userIds.length];
          const gid = gameIds[i % gameIds.length];
          const amt = [500, 1000, 2000, 5000, 10000, 250, 7500, 1500, 3000, 20000][i % 10];
          const mult = (Math.random() * 5).toFixed(4);
          const payout = Math.random() > 0.4 ? Math.floor(amt * parseFloat(mult)) : 0;
          const status = payout > 0 ? 'won' : 'lost';
          const daysAgo = Math.floor(Math.random() * 14);
          betValues.push(`(${uid}, ${gid}, ${amt}, ${payout}, '${mult}', '${status}', NOW() - INTERVAL '${daysAgo} days')`);
        }
        await pool.query(`INSERT INTO bets (user_id, game_id, amount_cents, payout_cents, multiplier, status, created_at) VALUES ${betValues.join(',')}`);
        console.log('[SEED] Bets seeded ');
      }
    }

    // Sample withdrawals
    const wdCount = await pool.query('SELECT COUNT(*) FROM withdrawals');
    if (parseInt(wdCount.rows[0].count) < 3) {
      const userIds = (await pool.query('SELECT id FROM users ORDER BY id LIMIT 8')).rows.map(r => r.id);
      if (userIds.length >= 3) {
        await pool.query(`INSERT INTO withdrawals (user_id, amount_cents, pix_type, pix_key, status, created_at) VALUES
          (${userIds[0]}, 5000, 'cpf', '123.456.789-00', 'pending', NOW() - INTERVAL '1 day'),
          (${userIds[1]}, 10000, 'email', 'maria@teste.com', 'pending', NOW() - INTERVAL '2 days'),
          (${userIds[2]}, 3000, 'phone', '31977665544', 'approved', NOW() - INTERVAL '3 days'),
          (${userIds[3] || userIds[0]}, 25000, 'cpf', '321.654.987-00', 'pending', NOW() - INTERVAL '6 hours'),
          (${userIds[4] || userIds[1]}, 1500, 'random', 'abc-123-def', 'rejected', NOW() - INTERVAL '5 days')
        `);
        console.log('[SEED] Withdrawals seeded ');
      }
    }

    // Sample support tickets
    const ticketCount = await pool.query('SELECT COUNT(*) FROM support_tickets');
    if (parseInt(ticketCount.rows[0].count) < 3) {
      const userIds = (await pool.query('SELECT id FROM users ORDER BY id LIMIT 5')).rows.map(r => r.id);
      if (userIds.length >= 3) {
        const t1 = await pool.query(`INSERT INTO support_tickets (user_id, subject, status, priority) VALUES ($1, 'Depósito não creditado', 'open', 'high') RETURNING id`, [userIds[0]]);
        await pool.query(`INSERT INTO support_messages (ticket_id, sender_type, sender_id, message) VALUES ($1, 'user', $2, 'Fiz um depósito de R$ 100 via PIX há 2 horas e o saldo não foi creditado. Segue comprovante.')`, [t1.rows[0].id, userIds[0]]);
        const t2 = await pool.query(`INSERT INTO support_tickets (user_id, subject, status, priority) VALUES ($1, 'Como funciona o cashback?', 'open', 'normal') RETURNING id`, [userIds[1]]);
        await pool.query(`INSERT INTO support_messages (ticket_id, sender_type, sender_id, message) VALUES ($1, 'user', $2, 'Gostaria de saber como funciona o programa de cashback semanal. Qual o percentual e quando é pago?')`, [t2.rows[0].id, userIds[1]]);
        const t3 = await pool.query(`INSERT INTO support_tickets (user_id, subject, status, priority) VALUES ($1, 'Problema ao sacar', 'closed', 'high') RETURNING id`, [userIds[2]]);
        await pool.query(`INSERT INTO support_messages (ticket_id, sender_type, sender_id, message) VALUES ($1, 'user', $2, 'Meu saque está pendente há 3 dias. Podem verificar?')`, [t3.rows[0].id, userIds[2]]);
        await pool.query(`INSERT INTO support_messages (ticket_id, sender_type, sender_id, message) VALUES ($1, 'admin', 1, 'Olá! Verificamos e o saque foi processado. Deve cair em até 24h úteis.')`, [t3.rows[0].id]);
        console.log('[SEED] Support tickets seeded ');
      }
    }

    // Sample affiliates
    const affCount = await pool.query('SELECT COUNT(*) FROM affiliates');
    if (parseInt(affCount.rows[0].count) < 2) {
      const userIds = (await pool.query('SELECT id FROM users ORDER BY id LIMIT 5')).rows.map(r => r.id);
      if (userIds.length >= 2) {
        await pool.query(`INSERT INTO affiliates (user_id, code, commission_pct, total_earned_cents, is_active) VALUES
          (${userIds[0]}, 'REF-PEDRO', 5.00, 15000, TRUE),
          (${userIds[3] || userIds[1]}, 'REF-ANA', 7.50, 32500, TRUE)
        ON CONFLICT (user_id) DO NOTHING`);
        console.log('[SEED] Affiliates seeded ');
      }
    }

    // Seed user_limits (Jogo Responsável)
    const limitsCount = await pool.query('SELECT COUNT(*) FROM user_limits');
    if (parseInt(limitsCount.rows[0].count) === 0) {
      const userIds = (await pool.query('SELECT id FROM users ORDER BY id LIMIT 5')).rows.map(r => r.id);
      if (userIds.length >= 3) {
        await pool.query(`INSERT INTO user_limits (user_id, limit_type, period, limit_value, enforced_by, admin_notes) VALUES
          (${userIds[0]}, 'deposit', 'daily', 50000, 'user', 'Auto-configurado pelo usuário'),
          (${userIds[0]}, 'bet', 'daily', 10000, 'user', 'Limite de aposta diária'),
          (${userIds[1]}, 'deposit', 'monthly', 500000, 'admin', 'Limite imposto por suspeita de comportamento compulsivo'),
          (${userIds[1]}, 'loss', 'weekly', 100000, 'admin', 'Limite de perda semanal imposto pelo admin'),
          (${userIds[2]}, 'time', 'daily', 480, 'user', 'Limite de 8 horas por dia'),
          (${userIds[2]}, 'deposit', 'weekly', 200000, 'user', 'Limite de depósito semanal R$ 2.000')
        `);
        console.log('[SEED] User limits seeded ');
      }
    }

    // Set top 10 featured games
    const featuredCount = await pool.query('SELECT COUNT(*) FROM games WHERE is_featured = TRUE');
    if (parseInt(featuredCount.rows[0].count) === 0) {
      await pool.query(`UPDATE games SET is_featured = TRUE, featured_order = sub.rn
        FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order, id) AS rn FROM games WHERE is_active = TRUE LIMIT 10) sub
        WHERE games.id = sub.id`);
      console.log('[SEED] Featured games set ');
    }

    // ——— End seed data ———————————————————————————————————————

    // Ensure admin has valid hash
    const hash = await bcrypt.hash('Admin@12345', 10);
    await pool.query(`UPDATE admin_users SET password_hash = $1 WHERE username = 'admin' AND password_hash LIKE '%placeholder%'`, [hash]);
    // Migrate theme gold->green keys
    await pool.query(`
      UPDATE themes SET css_vars = (
        css_vars::jsonb - 'gold1' - 'gold2' - 'gold3'
        || jsonb_build_object('green1', css_vars::jsonb->>'gold1', 'green2', css_vars::jsonb->>'gold2', 'green3', css_vars::jsonb->>'gold3')
      )::text::json
      WHERE css_vars::text LIKE '%"gold1"%'
    `);

    // Fix theme colors: any green/purple ‚¬ orange
    await pool.query(`
      UPDATE themes SET css_vars = jsonb_set(jsonb_set(jsonb_set(jsonb_set(css_vars::jsonb,
        '{green1}', '"#34D399"'), '{green2}', '"#25D366"'), '{green3}', '"#1A9E4C"'), '{accent}', '"#25D366"')
      WHERE css_vars::text LIKE '%10B981%' OR css_vars::text LIKE '%10b981%'
         OR css_vars::text LIKE '%c084fc%' OR css_vars::text LIKE '%6EE7B7%'
         OR css_vars::text LIKE '%6ee7b7%' OR css_vars::text LIKE '%7c3aed%'
         OR css_vars::text LIKE '%047857%'
    `);
    console.log('[MIGRATE] Theme colors ‚¬ orange ');

    // Auto-seed new games (83 total)
    const newGames = [
      ['fortune-pirates','Fortune Pirates','/public/img/games/1.avif','pg','pg',51],
      ['fortune-fruits','Fortune Fruits','/public/img/games/2.webp','pg','pg',52],
      ['midas-fortune','Midas Fortune','/public/img/games/5.webp','pg','quente',53],
      ['fortune-dragon','Fortune Dragon','/public/img/games/7.webp','pg','pg',54],
      ['master-chens-fortune','Master Chens Fortune','/public/img/games/9.webp','pg','pg',55],
      ['fortune-of-giza','Fortune of Giza','/public/img/games/11.webp','pg','pg',56],
      ['fairytale-fortune','Fairytale Fortune','/public/img/games/3.webp','pp','pp',57],
      ['octobeer-fortunes','Octobeer Fortunes','/public/img/games/6.webp','pp','pp',58],
      ['fortune-gems-2','Fortune Gems 2','/public/img/games/10.avif','pp','quente',59],
      ['pandas-fortune-2','Pandas Fortune 2','/public/img/games/4.webp','pp','pp',60],
      ['fortune-gems-3','Fortune Gems 3','/public/img/games/8.webp','pp','pp',61],
      ['fortune-gems','Fortune Gems','/public/img/games/12.webp','pp','pp',62],
      ['fortune-tree','Fortune Tree','/public/img/games/2.webp','pp','pp',63],
      ['drago-jewels','Drago Jewels of Fortune','/public/img/games/5.webp','pp','quente',64],
      ['three-star-fortune','Three Star Fortune','/public/img/games/9.webp','pp','pp',65],
      ['pandas-fortune','Pandas Fortune','/public/img/games/7.webp','pp','pp',66],
      ['fortune-pig','Fortune Pig','/public/img/games/1.avif','pg','pg',67],
      ['fortune-monkey','Fortune Monkey','/public/img/games/3.webp','pg','pg',68],
      ['papai-noel-fortune','Papai Noel da Fortuna','/public/img/games/11.webp','pg','pg',69],
      ['golden-wealth-baccarat','Golden Wealth Baccarat','/public/img/games/6.webp','evolution','live',70],
      ['mega-ball','Mega Ball','/public/img/games/10.avif','evolution','live',71],
      ['dream-catcher','Dream Catcher','/public/img/games/4.webp','evolution','live',72],
      ['football-studio','Football Studio','/public/img/games/8.webp','evolution','live',73],
      ['speed-baccarat','Speed Baccarat','/public/img/games/12.webp','evolution','live',74],
      ['mines-deluxe','Mines Deluxe','/public/img/games/2.webp','wg','mines',75],
      ['hilo','HiLo','/public/img/games/9.webp','spribe','spribe',76],
      ['mini-roulette','Mini Roulette','/public/img/games/5.webp','spribe','spribe',77],
      ['hotline-2','Hotline 2','/public/img/games/7.webp','netent','netent',78],
      ['twin-spin','Twin Spin','/public/img/games/3.webp','netent','netent',79],
      ['rise-of-olympus','Rise of Olympus','/public/img/games/11.webp','playngo','playngo',80],
      ['legacy-of-dead','Legacy of Dead','/public/img/games/1.avif','playngo','playngo',81],
      ['san-quentin','San Quentin','/public/img/games/6.webp','nolimit','nolimit',82],
      ['fire-in-the-hole','Fire in the Hole','/public/img/games/10.avif','nolimit','nolimit',83]
    ];
    for (const [code, name, img, provider, category, sort] of newGames) {
      await pool.query(`INSERT INTO games (game_code, game_name, image_url, provider, category, sort_order) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (game_code) DO NOTHING`, [code, name, img, provider, category, sort]);
    }
    const gc = await pool.query('SELECT COUNT(*) FROM games WHERE is_active = TRUE');
    console.log('[MIGRATE] Games total:', gc.rows[0].count);

  } catch (err) {
    console.error('[MIGRATE] Error:', err.message);
  }
}

autoMigrate().then(() => {
  app.listen(PORT, () => {
    console.log(`VemNaBet rodando em http://localhost:${PORT}`);
    // Detect and store outbound IP on startup
    detectOutboundIp();
  });
});

async function detectOutboundIp() {
  try {
    const fetch = require('node-fetch');
    const r = await fetch('https://api.ipify.org?format=json', { timeout: 10000 });
    const data = await r.json();
    const ip = data.ip;
    console.log(`[IP] Outbound IP: ${ip}`);
    await pool.query(
      "INSERT INTO platform_settings (key, value) VALUES ('server_outbound_ip', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
      [ip]
    );
    await pool.query(
      "INSERT INTO platform_settings (key, value) VALUES ('server_ip_updated_at', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
      [new Date().toISOString()]
    );
  } catch (err) {
    console.warn('[IP] Failed to detect outbound IP:', err.message);
  }
}
