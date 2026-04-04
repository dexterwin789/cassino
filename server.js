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
  } catch (err) {
    console.error('[MIGRATE] Error:', err.message);
  }
}

autoMigrate().then(() => {
  app.listen(PORT, () => {
    console.log(`Esportiva rodando em http://localhost:${PORT}`);
  });
});
