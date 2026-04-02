-- Cassino Platform — PostgreSQL Schema
-- All tables, InnoDB-equivalent, utf8mb4 (default in PG)

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(64) NOT NULL UNIQUE,
  phone         VARCHAR(32),
  email         VARCHAR(255),
  cpf           VARCHAR(14),
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
  ('site_name', 'Cassino'),
  ('maintenance_mode', '0')
ON CONFLICT (key) DO NOTHING;

-- Default themes
INSERT INTO themes (slug, name, description, css_vars, layout_config, is_active) VALUES
(
  'default',
  'Gold Classic',
  'Tema padrão com preto & dourado premium',
  '{
    "black": "#000",
    "bg": "#0b0b0b",
    "card": "#141414",
    "text": "#f6f6f6",
    "gold1": "#ffe39a",
    "gold2": "#f4c44c",
    "gold3": "#b97a0d",
    "blue": "#1a78ff",
    "accent": "#f4c44c",
    "danger": "#ff4d4d",
    "success": "#2ee76b"
  }',
  '{
    "gamesPerRow": 4,
    "bannerAspect": "16/7",
    "quickIcons": 6,
    "headerStyle": "classic",
    "footerStyle": "classic"
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
    "gold1": "#c084fc",
    "gold2": "#a855f7",
    "gold3": "#7c3aed",
    "blue": "#06b6d4",
    "accent": "#a855f7",
    "danger": "#f43f5e",
    "success": "#22d3ee"
  }',
  '{
    "gamesPerRow": 4,
    "bannerAspect": "16/7",
    "quickIcons": 6,
    "headerStyle": "neon",
    "footerStyle": "neon"
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
    "gold1": "#6ee7b7",
    "gold2": "#10b981",
    "gold3": "#047857",
    "blue": "#38bdf8",
    "accent": "#10b981",
    "danger": "#ef4444",
    "success": "#34d399"
  }',
  '{
    "gamesPerRow": 3,
    "bannerAspect": "16/8",
    "quickIcons": 6,
    "headerStyle": "royal",
    "footerStyle": "royal"
  }',
  FALSE
)
ON CONFLICT (slug) DO NOTHING;

-- Default admin (password: Admin@12345)
INSERT INTO admin_users (username, password_hash, role) VALUES
  ('admin', '$2b$10$xJ5QZ5QZ5QZ5QZ5QZ5QZ5.placeholder.hash', 'superadmin')
ON CONFLICT (username) DO NOTHING;
