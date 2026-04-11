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
    // Sports enabled setting
    const sportsR = await pool.query("SELECT value FROM platform_settings WHERE key = 'sports_enabled' LIMIT 1");
    res.locals.sportsEnabled = sportsR.rows[0]?.value === '1';

    // Logo settings
    const logoR = await pool.query("SELECT key, value FROM platform_settings WHERE key IN ('logo_dark', 'logo_light', 'promo_banner_1', 'promo_banner_2', 'promo_banner_3', 'promo_banner_1_link', 'promo_banner_2_link', 'promo_banner_3_link', 'side_banner_1', 'side_banner_2', 'side_banner_1_link', 'side_banner_2_link')");
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
  } catch {
    res.locals.activeTheme = 'default';
    res.locals.theme = null;
    res.locals.layoutConfig = {};
    res.locals.sportsEnabled = false;
    res.locals.logoDark = '';
    res.locals.logoLight = '';
  }
  res.locals.user = req.session.user || null;
  next();
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
      console.log('[SEED] Provider images seeded ✓');
    }

    // Seed test notifications for user 24
    const notifCount = await pool.query('SELECT COUNT(*) FROM notifications WHERE user_id = 24');
    if (parseInt(notifCount.rows[0].count) === 0) {
      await pool.query(`INSERT INTO notifications (user_id, tipo, titulo, mensagem) VALUES
        (24, 'success', 'Bem-vindo à CassinoBet!', 'Sua conta foi criada com sucesso. Aproveite nossos jogos!'),
        (24, 'deposit', 'Depósito confirmado', 'Seu depósito de R$ 100,00 foi creditado na sua carteira.'),
        (24, 'promo', 'Bônus especial de boas-vindas', 'Você ganhou 20 rodadas grátis no Fortune Tiger! Jogue agora.'),
        (24, 'info', 'Verificação de identidade', 'Complete seu cadastro com CPF e data de nascimento para liberar saques.'),
        (24, 'warning', 'Sessão em novo dispositivo', 'Detectamos um novo acesso à sua conta. Se não foi você, altere sua senha.'),
        (0, 'promo', 'Promoção de Páscoa!', 'Deposite R$ 50 e ganhe R$ 25 de bônus. Válido até domingo!'),
        (0, 'info', 'Manutenção programada', 'O sistema ficará indisponível dia 10/04 das 03:00 às 05:00 para manutenção.')
      `);
      console.log('[MIGRATE] Notifications seeded for user 24 ✓');
    }

    // ─── Dedup: deactivate duplicate games (keep synced version) ─────
    const dedupResult = await pool.query(`
      WITH ranked AS (
        SELECT id,
          ROW_NUMBER() OVER (
            PARTITION BY LOWER(game_name), LOWER(COALESCE(provider,''))
            ORDER BY (pf_game_code IS NOT NULL) DESC, id DESC
          ) as rn
        FROM games
        WHERE is_active = TRUE
      )
      UPDATE games SET is_active = FALSE
      WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
    `);
    if (dedupResult.rowCount > 0) console.log('[MIGRATE] Deduped ' + dedupResult.rowCount + ' duplicate games');

    // ─── Deactivate all games that are NOT PG Soft or Pragmatic ─────
    const cleanupResult = await pool.query(`
      UPDATE games SET is_active = FALSE
      WHERE is_active = TRUE
        AND LOWER(COALESCE(pf_provider, provider, '')) NOT SIMILAR TO '%(pg soft|pg|pragmatic|pragmatic play)%'
    `);
    if (cleanupResult.rowCount > 0) console.log('[MIGRATE] Deactivated ' + cleanupResult.rowCount + ' non-PG/Pragmatic games');

    // ─── Seed sample data for admin verification ─────────────
    // Banners
    const bannerCount = await pool.query('SELECT COUNT(*) FROM banners');
    if (parseInt(bannerCount.rows[0].count) === 0) {
      await pool.query(`INSERT INTO banners (image_url, link_url, sort_order, is_active) VALUES
        ('/public/img/novo/22.webp', '/games?category=crash', 1, TRUE),
        ('/public/img/novo/33.webp', '/games?category=slots', 2, TRUE),
        ('/public/img/novo/44.webp', '/games?category=live', 3, TRUE)
      `);
      console.log('[SEED] Banners seeded ✓');
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
      console.log('[SEED] Sports categories seeded ✓');
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
      console.log('[SEED] Leagues seeded ✓');
    }

    // Coupons
    const couponCount = await pool.query('SELECT COUNT(*) FROM coupons');
    if (parseInt(couponCount.rows[0].count) === 0) {
      await pool.query(`INSERT INTO coupons (code, description, type, value_cents, value_pct, min_deposit, max_uses, max_per_user, is_active, expires_at) VALUES
        ('BEMVINDO50', 'Bônus de boas-vindas 50%', 'percentage', 0, 50.00, 2000, 1000, 1, TRUE, NOW() + INTERVAL '90 days'),
        ('PIX20', 'R$ 20 de bônus no PIX', 'bonus', 2000, 0, 5000, 500, 1, TRUE, NOW() + INTERVAL '60 days'),
        ('ESPORTIVA10', '10% cashback na primeira aposta', 'percentage', 0, 10.00, 1000, 2000, 1, TRUE, NOW() + INTERVAL '30 days'),
        ('FREEBET25', 'Aposta grátis de R$ 25', 'bonus', 2500, 0, 0, 200, 1, TRUE, NOW() + INTERVAL '15 days'),
        ('VIP100', 'Bônus exclusivo VIP R$ 100', 'bonus', 10000, 0, 10000, 50, 1, TRUE, NOW() + INTERVAL '365 days')
      `);
      console.log('[SEED] Coupons seeded ✓');
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
      console.log('[SEED] Promotions seeded ✓');
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
      console.log('[SEED] Sample users seeded ✓');
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
        console.log('[SEED] Transactions seeded ✓');
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
        console.log('[SEED] Bets seeded ✓');
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
        console.log('[SEED] Withdrawals seeded ✓');
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
        console.log('[SEED] Support tickets seeded ✓');
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
        console.log('[SEED] Affiliates seeded ✓');
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
        console.log('[SEED] User limits seeded ✓');
      }
    }

    // Set top 10 featured games
    const featuredCount = await pool.query('SELECT COUNT(*) FROM games WHERE is_featured = TRUE');
    if (parseInt(featuredCount.rows[0].count) === 0) {
      await pool.query(`UPDATE games SET is_featured = TRUE, featured_order = sub.rn
        FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order, id) AS rn FROM games WHERE is_active = TRUE LIMIT 10) sub
        WHERE games.id = sub.id`);
      console.log('[SEED] Featured games set ✓');
    }

    // ─── End seed data ───────────────────────────────────────

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
