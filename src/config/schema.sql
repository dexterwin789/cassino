-- Cassino Platform — PostgreSQL Schema
-- All tables, InnoDB-equivalent, utf8mb4 (default in PG)

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(64) NOT NULL UNIQUE,
  name          VARCHAR(128),
  phone         VARCHAR(32),
  email         VARCHAR(255),
  cpf           VARCHAR(14) UNIQUE,
  birth_date    DATE,
  password_hash VARCHAR(255) NOT NULL,
  bonus         NUMERIC(14,2) NOT NULL DEFAULT 0,
  balance       NUMERIC(14,2) NOT NULL DEFAULT 0,
  credit_score  INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  avatar_url    TEXT,
  referred_by   INT REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallets (
  id            SERIAL PRIMARY KEY,
  user_id       INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance_cents BIGINT NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(32) NOT NULL DEFAULT 'admin',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id            SERIAL PRIMARY KEY,
  user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          VARCHAR(32) NOT NULL DEFAULT 'deposit',
  status        VARCHAR(32) NOT NULL DEFAULT 'pending',
  amount_cents  BIGINT NOT NULL DEFAULT 0,
  provider      VARCHAR(64) DEFAULT 'blackcat',
  provider_ref  VARCHAR(255),
  payload_json  JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_ref ON transactions(provider_ref);

CREATE TABLE IF NOT EXISTS games (
  id          SERIAL PRIMARY KEY,
  game_code   VARCHAR(128) NOT NULL UNIQUE,
  game_name   VARCHAR(255) NOT NULL,
  image_url   TEXT,
  provider    VARCHAR(64),
  category    VARCHAR(64) DEFAULT 'slots',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_games_provider ON games(provider);

CREATE TABLE IF NOT EXISTS themes (
  id          SERIAL PRIMARY KEY,
  slug        VARCHAR(64) NOT NULL UNIQUE,
  name        VARCHAR(128) NOT NULL,
  description TEXT,
  preview_url TEXT,
  css_vars    JSONB NOT NULL DEFAULT '{}',
  layout_config JSONB NOT NULL DEFAULT '{}',
  is_active   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_settings (
  key   VARCHAR(128) PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS banners (
  id          SERIAL PRIMARY KEY,
  image_url   TEXT NOT NULL,
  link_url    TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Bets ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bets (
  id            SERIAL PRIMARY KEY,
  user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id       INT REFERENCES games(id) ON DELETE SET NULL,
  round_id      INT,
  amount_cents  BIGINT NOT NULL DEFAULT 0,
  payout_cents  BIGINT NOT NULL DEFAULT 0,
  multiplier    NUMERIC(10,4) DEFAULT 0,
  status        VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bets_user ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_game ON bets(game_id);
CREATE INDEX IF NOT EXISTS idx_bets_status ON bets(status);

-- ─── Game Rounds ──────────────────────────────────
CREATE TABLE IF NOT EXISTS game_rounds (
  id            SERIAL PRIMARY KEY,
  game_id       INT REFERENCES games(id) ON DELETE SET NULL,
  round_hash    VARCHAR(255),
  seed          VARCHAR(255),
  result        JSONB,
  status        VARCHAR(32) NOT NULL DEFAULT 'open',
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_game_rounds_game ON game_rounds(game_id);
CREATE INDEX IF NOT EXISTS idx_game_rounds_status ON game_rounds(status);

-- ─── Affiliates ───────────────────────────────────
CREATE TABLE IF NOT EXISTS affiliates (
  id            SERIAL PRIMARY KEY,
  user_id       INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  code          VARCHAR(64) NOT NULL UNIQUE,
  commission_pct NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  total_earned_cents BIGINT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_affiliates_code ON affiliates(code);

-- ─── Affiliate Commissions ────────────────────────
CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id              SERIAL PRIMARY KEY,
  affiliate_id    INT NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  referred_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id  INT REFERENCES transactions(id) ON DELETE SET NULL,
  amount_cents    BIGINT NOT NULL DEFAULT 0,
  status          VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_aff_comm_affiliate ON affiliate_commissions(affiliate_id);

-- ─── Support Tickets ──────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id            SERIAL PRIMARY KEY,
  user_id       INT REFERENCES users(id) ON DELETE SET NULL,
  subject       VARCHAR(255) NOT NULL,
  status        VARCHAR(32) NOT NULL DEFAULT 'open',
  priority      VARCHAR(32) NOT NULL DEFAULT 'normal',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);

-- ─── Support Messages ─────────────────────────────
CREATE TABLE IF NOT EXISTS support_messages (
  id            SERIAL PRIMARY KEY,
  ticket_id     INT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type   VARCHAR(16) NOT NULL DEFAULT 'user',
  sender_id     INT,
  message       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_ticket ON support_messages(ticket_id);

-- ─── Promotions ───────────────────────────────────
CREATE TABLE IF NOT EXISTS promotions (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  type          VARCHAR(64) NOT NULL DEFAULT 'bonus',
  value_cents   BIGINT NOT NULL DEFAULT 0,
  value_pct     NUMERIC(5,2) DEFAULT 0,
  min_deposit   BIGINT DEFAULT 0,
  max_uses      INT DEFAULT 0,
  uses_count    INT NOT NULL DEFAULT 0,
  code          VARCHAR(64) UNIQUE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at     TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── User Promotions ──────────────────────────────
CREATE TABLE IF NOT EXISTS user_promotions (
  id            SERIAL PRIMARY KEY,
  user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  promotion_id  INT NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  status        VARCHAR(32) NOT NULL DEFAULT 'claimed',
  amount_cents  BIGINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_promos_user ON user_promotions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_promos_promo ON user_promotions(promotion_id);

-- ─── Admin Audit Log ──────────────────────────────
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id            SERIAL PRIMARY KEY,
  admin_id      INT REFERENCES admin_users(id) ON DELETE SET NULL,
  action        VARCHAR(128) NOT NULL,
  target_type   VARCHAR(64),
  target_id     INT,
  details       JSONB,
  ip_address    VARCHAR(45),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_admin ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON admin_audit_log(action);

-- Session table (created automatically by connect-pg-simple but defining for clarity)
CREATE TABLE IF NOT EXISTS sessions (
  sid    VARCHAR NOT NULL PRIMARY KEY,
  sess   JSONB NOT NULL,
  expire TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);

-- Default inserts
INSERT INTO platform_settings (key, value) VALUES
  ('active_theme', 'default'),
  ('site_name', 'Esportiva'),
  ('maintenance_mode', '0')
ON CONFLICT (key) DO NOTHING;

-- Default themes
INSERT INTO themes (slug, name, description, css_vars, layout_config, is_active) VALUES
(
  'default',
  'Esportiva Classic',
  'Tema padrão com verde esmeralda e navy',
  '{
    "black": "#0B1726",
    "bg": "#0d1b2a",
    "card": "#1b2838",
    "text": "#f6f6f6",
    "green1": "#ff6b3a",
    "green2": "#ff3a00",
    "green3": "#cc2e00",
    "blue": "#ff3a00",
    "accent": "#ff3a00",
    "danger": "#ff4d4d",
    "success": "#34D399"
  }',
  '{
    "gamesPerRow": 4,
    "bannerAspect": "16/7",
    "quickIcons": 6,
    "headerStyle": "classic",
    "footerStyle": "classic",
    "borderRadius": 16
  }',
  TRUE
),
(
  'neon-nights',
  'Neon Nights',
  'Tema cyberpunk com neon roxo e rosa',
  '{
    "black": "#0a0a1a",
    "bg": "#0d0d22",
    "card": "#13132e",
    "text": "#eef0ff",
    "green1": "#ff6b3a",
    "green2": "#ff3a00",
    "green3": "#cc2e00",
    "blue": "#06b6d4",
    "accent": "#ff3a00",
    "danger": "#f43f5e",
    "success": "#22d3ee"
  }',
  '{
    "gamesPerRow": 4,
    "bannerAspect": "16/7",
    "quickIcons": 6,
    "headerStyle": "neon",
    "footerStyle": "neon",
    "borderRadius": 12
  }',
  FALSE
),
(
  'royal-emerald',
  'Royal Emerald',
  'Tema elegante com verde esmeralda e prata',
  '{
    "black": "#030f0a",
    "bg": "#061a12",
    "card": "#0a2419",
    "text": "#f0fdf4",
    "green1": "#ff6b3a",
    "green2": "#ff3a00",
    "green3": "#cc2e00",
    "blue": "#38bdf8",
    "accent": "#ff3a00",
    "danger": "#ef4444",
    "success": "#34d399"
  }',
  '{
    "gamesPerRow": 3,
    "bannerAspect": "16/8",
    "quickIcons": 6,
    "headerStyle": "royal",
    "footerStyle": "royal",
    "borderRadius": 20
  }',
  FALSE
)
ON CONFLICT (slug) DO NOTHING;

-- Default admin (password: Admin@12345)
INSERT INTO admin_users (username, password_hash, role) VALUES
  ('admin', '$2b$10$xJ5QZ5QZ5QZ5QZ5QZ5QZ5.placeholder.hash', 'superadmin')
ON CONFLICT (username) DO NOTHING;
