require('dotenv').config();
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');
const path = require('path');
const { pool } = require('./src/config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Security
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust Railway/Heroku reverse proxy so secure cookies work
app.set('trust proxy', 1);

// Sessions
app.use(session({
  store: new PgSession({ pool, tableName: 'sessions', createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use('/public', express.static(path.join(__dirname, 'public')));

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
  } catch {
    res.locals.activeTheme = 'default';
    res.locals.theme = null;
    res.locals.layoutConfig = {};
  }
  res.locals.user = req.session.user || null;
  next();
});

// Routes
app.use('/', require('./src/routes/pages'));
app.use('/api', require('./src/routes/api'));
app.use('/api/webhook', require('./src/routes/webhook'));
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

    // Fix theme colors: any green/purple → orange
    await pool.query(`
      UPDATE themes SET css_vars = jsonb_set(jsonb_set(jsonb_set(jsonb_set(css_vars::jsonb,
        '{green1}', '"#ff6b3a"'), '{green2}', '"#ff3a00"'), '{green3}', '"#cc2e00"'), '{accent}', '"#ff3a00"')
      WHERE css_vars::text LIKE '%10B981%' OR css_vars::text LIKE '%10b981%'
         OR css_vars::text LIKE '%c084fc%' OR css_vars::text LIKE '%6EE7B7%'
         OR css_vars::text LIKE '%6ee7b7%' OR css_vars::text LIKE '%7c3aed%'
         OR css_vars::text LIKE '%047857%'
    `);
    console.log('[MIGRATE] Theme colors → orange ✓');

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
    console.log(`Esportiva rodando em http://localhost:${PORT}`);
  });
});
