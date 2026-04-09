const router = require('express').Router();
const { query } = require('../config/database');
const { requireAdmin } = require('../middleware/auth');

router.use(requireAdmin);

// ─── Users ────────────────────────────────────────

router.get('/users', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const active = req.query.active || '';
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 25, 1), 200);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    let where = [];
    let params = [];
    let idx = 1;

    if (q) {
      where.push(`(u.username ILIKE $${idx} OR u.phone ILIKE $${idx} OR CAST(u.id AS TEXT) = $${idx + 1})`);
      params.push(`%${q}%`, q);
      idx += 2;
    }

    if (active === '1' || active === '0') {
      where.push(`u.is_active = $${idx}`);
      params.push(active === '1');
      idx++;
    }

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const countR = await query(`SELECT COUNT(*) AS c FROM users u ${whereSql}`, params);
    const total = parseInt(countR.rows[0].c);

    const rowsR = await query(`
      SELECT u.id, u.username, u.phone, u.bonus, u.balance, u.credit_score, u.is_active, u.created_at,
             u.kyc_status, u.block_reason,
             COALESCE(w.balance_cents, 0) AS wallet_balance_cents
      FROM users u
      LEFT JOIN wallets w ON w.user_id = u.id
      ${whereSql}
      ORDER BY u.id DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, limit, offset]);

    res.json({ ok: true, page, limit, total, rows: rowsR.rows });
  } catch (err) {
    console.error('[ADMIN API USERS]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao listar usuários.' });
  }
});

// Toggle user active
router.post('/users/:id/toggle', async (req, res) => {
  try {
    await query('UPDATE users SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro.' });
  }
});

// ─── Deposits ─────────────────────────────────────

router.get('/deposits', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const status = req.query.status || '';
    const from = req.query.from || '';
    const to = req.query.to || '';
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 25, 1), 200);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    let where = ["t.type = 'deposit'"];
    let params = [];
    let idx = 1;

    if (q) {
      where.push(`(CAST(t.id AS TEXT) = $${idx} OR CAST(t.user_id AS TEXT) = $${idx} OR t.provider_ref ILIKE $${idx + 1})`);
      params.push(q, `%${q}%`);
      idx += 2;
    }

    const allowed = ['pending', 'paid', 'failed', 'canceled'];
    if (status && allowed.includes(status)) {
      where.push(`t.status = $${idx}`);
      params.push(status);
      idx++;
    }

    if (from) {
      where.push(`t.created_at >= $${idx}`);
      params.push(from + ' 00:00:00');
      idx++;
    }
    if (to) {
      where.push(`t.created_at <= $${idx}`);
      params.push(to + ' 23:59:59');
      idx++;
    }

    const whereSql = 'WHERE ' + where.join(' AND ');

    const countR = await query(`SELECT COUNT(*) AS c FROM transactions t ${whereSql}`, params);
    const total = parseInt(countR.rows[0].c);

    const rowsR = await query(`
      SELECT t.id, t.user_id, t.status, t.amount_cents, t.provider, t.provider_ref, t.created_at, t.updated_at
      FROM transactions t
      ${whereSql}
      ORDER BY t.id DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, limit, offset]);

    res.json({ ok: true, page, limit, total, rows: rowsR.rows });
  } catch (err) {
    console.error('[ADMIN API DEPOSITS]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao listar depósitos.' });
  }
});

// ─── Games ────────────────────────────────────────

router.get('/games', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const active = req.query.active || '';
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 25, 1), 200);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    let where = [];
    let params = [];
    let idx = 1;

    if (q) {
      where.push(`(g.game_code ILIKE $${idx} OR g.game_name ILIKE $${idx} OR g.provider ILIKE $${idx})`);
      params.push(`%${q}%`);
      idx++;
    }

    if (active === '1' || active === '0') {
      where.push(`g.is_active = $${idx}`);
      params.push(active === '1');
      idx++;
    }

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const countR = await query(`SELECT COUNT(*) AS c FROM games g ${whereSql}`, params);
    const total = parseInt(countR.rows[0].c);

    const rowsR = await query(`
      SELECT g.id, g.game_code, g.game_name, g.image_url, g.provider, g.category, g.is_active, g.created_at
      FROM games g
      ${whereSql}
      ORDER BY g.id DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, limit, offset]);

    res.json({ ok: true, page, limit, total, rows: rowsR.rows });
  } catch (err) {
    console.error('[ADMIN API GAMES]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao listar jogos.' });
  }
});

router.post('/games', async (req, res) => {
  try {
    const { game_code, game_name, image_url, provider, category } = req.body;
    if (!game_code || !game_name) return res.status(400).json({ ok: false, msg: 'Código e nome obrigatórios.' });

    const r = await query(
      'INSERT INTO games (game_code, game_name, image_url, provider, category) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [game_code, game_name, image_url || null, provider || null, category || 'slots']
    );
    res.json({ ok: true, game: r.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, msg: 'Código já existe.' });
    res.status(500).json({ ok: false, msg: 'Erro ao criar jogo.' });
  }
});

router.post('/games/:id/toggle', async (req, res) => {
  try {
    await query('UPDATE games SET is_active = NOT is_active WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro.' });
  }
});

router.delete('/games/:id', async (req, res) => {
  try {
    await query('DELETE FROM games WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao excluir.' });
  }
});

// Sync games from PlayFivers API
router.post('/games/sync-playfivers', async (req, res) => {
  try {
    const pf = require('../services/playfivers');
    const result = await pf.getGames();
    if (!result.data || result.data.status !== 1 || !Array.isArray(result.data.data)) {
      return res.status(502).json({ ok: false, msg: 'Erro ao buscar jogos da PlayFivers: ' + (result.data.msg || 'resposta inválida') });
    }

    const games = result.data.data;
    let inserted = 0, updated = 0, skipped = 0;

    for (const g of games) {
      if (!g.game_code || !g.name) { skipped++; continue; }
      const providerName = (g.provider && g.provider.name) ? g.provider.name : '';
      const slug = (providerName + '-' + g.game_code).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      // Check if already exists by pf_game_code + pf_provider
      const existing = await query(
        'SELECT id FROM games WHERE pf_game_code = $1 AND pf_provider = $2',
        [g.game_code, providerName]
      );

      if (existing.rows.length) {
        // Update image/name/status
        await query(
          `UPDATE games SET game_name = $1, image_url = $2, is_active = $3, game_original = $4 WHERE id = $5`,
          [g.name, g.image_url || null, g.status !== false, g.original === true, existing.rows[0].id]
        );
        updated++;
      } else {
        // Check slug collision
        const slugCheck = await query('SELECT id FROM games WHERE game_code = $1', [slug]);
        const finalSlug = slugCheck.rows.length ? slug + '-' + Date.now() : slug;

        await query(
          `INSERT INTO games (game_code, game_name, image_url, provider, category, is_active, pf_game_code, pf_provider, game_original)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [finalSlug, g.name, g.image_url || null, providerName, 'slots', g.status !== false, g.game_code, providerName, g.original === true]
        );
        inserted++;
      }
    }

    // After sync, mark popular/hot games as featured
    const hotGameNames = [
      'fortune tiger', 'fortune rabbit', 'fortune ox', 'fortune mouse', 'fortune dragon',
      'gates of olympus', 'sweet bonanza', 'big bass bonanza', 'big bass splash',
      'sugar rush', 'starlight princess', 'dog house', 'wolf gold',
      'aviator', 'spaceman', 'mines', 'plinko', 'dice',
      'crazy time', 'lightning roulette', 'gonzo\'s treasure hunt',
      'the dog house megaways', 'fruit party', 'madame destiny megaways',
      'wild west gold', 'book of dead', 'reactoonz',
      'tigre sortudo', 'dragon tiger', 'cash bonanza'
    ];
    let featuredCount = 0;
    for (let i = 0; i < hotGameNames.length; i++) {
      const r = await query(
        `UPDATE games SET is_featured = TRUE, featured_order = $1 WHERE LOWER(game_name) LIKE $2 AND pf_game_code IS NOT NULL AND is_featured = FALSE`,
        [i + 1, '%' + hotGameNames[i] + '%']
      );
      if (r.rowCount > 0) featuredCount += r.rowCount;
    }

    res.json({ ok: true, msg: `Sincronização concluída: ${inserted} novos, ${updated} atualizados, ${skipped} ignorados. ${featuredCount} jogos marcados como destaque.`, total: games.length, inserted, updated, skipped, featured: featuredCount });
  } catch (err) {
    console.error('[SYNC PLAYFIVERS]', err);
    res.status(500).json({ ok: false, msg: 'Erro na sincronização: ' + err.message });
  }
});

// Get server outbound IP (for PlayFivers IP whitelist)
router.get('/server-ip', async (req, res) => {
  try {
    const fetch = require('node-fetch');
    const r = await fetch('https://api.ipify.org?format=json');
    const data = await r.json();
    res.json({ ok: true, ip: data.ip });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao obter IP: ' + err.message });
  }
});

// ─── Themes ───────────────────────────────────────

router.get('/themes', async (req, res) => {
  try {
    const r = await query('SELECT * FROM themes ORDER BY is_active DESC, name');
    const activeR = await query("SELECT value FROM platform_settings WHERE key = 'active_theme'");
    res.json({ ok: true, themes: r.rows, activeTheme: activeR.rows[0]?.value || 'default' });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao listar temas.' });
  }
});

router.post('/themes/activate', async (req, res) => {
  try {
    const { slug } = req.body;
    if (!slug) return res.status(400).json({ ok: false, msg: 'Slug obrigatório.' });

    // Deactivate all, activate chosen
    await query('UPDATE themes SET is_active = FALSE');
    await query('UPDATE themes SET is_active = TRUE WHERE slug = $1', [slug]);
    await query(`INSERT INTO platform_settings (key, value) VALUES ('active_theme', $1) ON CONFLICT (key) DO UPDATE SET value = $1`, [slug]);

    res.json({ ok: true, msg: 'Tema ativado.' });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao ativar tema.' });
  }
});

router.post('/themes', async (req, res) => {
  try {
    const { slug, name, description, css_vars, layout_config } = req.body;
    if (!slug || !name) return res.status(400).json({ ok: false, msg: 'Slug e nome obrigatórios.' });

    const r = await query(
      `INSERT INTO themes (slug, name, description, css_vars, layout_config) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [slug, name, description || '', css_vars || {}, layout_config || {}]
    );
    res.json({ ok: true, theme: r.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, msg: 'Slug já existe.' });
    res.status(500).json({ ok: false, msg: 'Erro ao criar tema.' });
  }
});

router.put('/themes/:id', async (req, res) => {
  try {
    const { name, description, css_vars, layout_config } = req.body;
    await query(
      `UPDATE themes SET name = COALESCE($1, name), description = COALESCE($2, description), 
       css_vars = COALESCE($3, css_vars), layout_config = COALESCE($4, layout_config), 
       updated_at = NOW() WHERE id = $5`,
      [name, description, css_vars ? JSON.stringify(css_vars) : null, layout_config ? JSON.stringify(layout_config) : null, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao atualizar tema.' });
  }
});

router.delete('/themes/:id', async (req, res) => {
  try {
    // Don't allow deleting default theme
    const check = await query('SELECT slug FROM themes WHERE id = $1', [req.params.id]);
    if (check.rows[0]?.slug === 'default') {
      return res.status(400).json({ ok: false, msg: 'Não pode excluir tema padrão.' });
    }
    await query('DELETE FROM themes WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao excluir.' });
  }
});

// ─── Transactions (all types) ─────────────────────

router.get('/transactions', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const type = req.query.type || '';
    const status = req.query.status || '';
    const from = req.query.from || '';
    const to = req.query.to || '';
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 25, 1), 200);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    let where = [];
    let params = [];
    let idx = 1;

    if (q) {
      where.push(`(CAST(t.id AS TEXT) = $${idx} OR CAST(t.user_id AS TEXT) = $${idx} OR t.provider_ref ILIKE $${idx + 1})`);
      params.push(q, `%${q}%`);
      idx += 2;
    }

    const allowedTypes = ['deposit', 'withdrawal', 'bonus', 'bet', 'win'];
    if (type && allowedTypes.includes(type)) {
      where.push(`t.type = $${idx}`);
      params.push(type);
      idx++;
    }

    const allowedStatuses = ['pending', 'paid', 'failed', 'canceled', 'completed'];
    if (status && allowedStatuses.includes(status)) {
      where.push(`t.status = $${idx}`);
      params.push(status);
      idx++;
    }

    if (from) { where.push(`t.created_at >= $${idx}`); params.push(from + ' 00:00:00'); idx++; }
    if (to) { where.push(`t.created_at <= $${idx}`); params.push(to + ' 23:59:59'); idx++; }

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const countR = await query(`SELECT COUNT(*) AS c FROM transactions t ${whereSql}`, params);
    const total = parseInt(countR.rows[0].c);

    const rowsR = await query(`
      SELECT t.id, t.user_id, u.username, t.type, t.status, t.amount_cents, t.provider, t.provider_ref, t.created_at, t.updated_at
      FROM transactions t
      LEFT JOIN users u ON u.id = t.user_id
      ${whereSql}
      ORDER BY t.id DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, limit, offset]);

    res.json({ ok: true, page, limit, total, rows: rowsR.rows });
  } catch (err) {
    console.error('[ADMIN API TRANSACTIONS]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao listar transações.' });
  }
});

// ─── Banners ──────────────────────────────────────

router.get('/banners', async (req, res) => {
  try {
    const r = await query('SELECT * FROM banners ORDER BY sort_order, id DESC');
    res.json({ ok: true, rows: r.rows, total: r.rows.length, page: 1, limit: 200 });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao listar banners.' });
  }
});

router.post('/banners', async (req, res) => {
  try {
    const { image_url, link_url, sort_order } = req.body;
    if (!image_url) return res.status(400).json({ ok: false, msg: 'URL da imagem obrigatória.' });
    const r = await query(
      'INSERT INTO banners (image_url, link_url, sort_order) VALUES ($1, $2, $3) RETURNING *',
      [image_url, link_url || null, parseInt(sort_order) || 0]
    );
    res.json({ ok: true, banner: r.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao criar banner.' });
  }
});

router.post('/banners/:id/toggle', async (req, res) => {
  try {
    await query('UPDATE banners SET is_active = NOT is_active WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro.' });
  }
});

router.delete('/banners/:id', async (req, res) => {
  try {
    await query('DELETE FROM banners WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao excluir.' });
  }
});

// ─── Settings ─────────────────────────────────────

router.get('/settings', async (req, res) => {
  try {
    const r = await query('SELECT key, value FROM platform_settings ORDER BY key');
    res.json({ ok: true, settings: r.rows });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro.' });
  }
});

router.post('/settings', async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ ok: false, msg: 'Key obrigatória.' });
    await query(
      'INSERT INTO platform_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      [key, value || '']
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro.' });
  }
});

// ─── Dashboard Stats ──────────────────────────────

router.get('/stats', async (req, res) => {
  try {
    const [usersR, txR, revenueR, todayR, weekR] = await Promise.all([
      query('SELECT COUNT(*) AS c FROM users'),
      query("SELECT COUNT(*) AS c FROM transactions WHERE type='deposit' AND status='paid'"),
      query("SELECT COALESCE(SUM(amount_cents), 0) AS total FROM transactions WHERE type='deposit' AND status='paid'"),
      query("SELECT COUNT(*) AS c FROM users WHERE created_at >= CURRENT_DATE"),
      query(`SELECT DATE(created_at) AS d, COUNT(*) AS c FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '7 days' GROUP BY DATE(created_at) ORDER BY d`)
    ]);

    // Last 7 deposits
    const recentR = await query(`
      SELECT t.id, t.user_id, u.username, t.amount_cents, t.status, t.created_at
      FROM transactions t LEFT JOIN users u ON u.id = t.user_id
      WHERE t.type = 'deposit'
      ORDER BY t.id DESC LIMIT 7
    `);

    res.json({
      ok: true,
      totalUsers: parseInt(usersR.rows[0].c),
      totalDeposits: parseInt(txR.rows[0].c),
      totalRevenue: parseInt(revenueR.rows[0].total),
      todayUsers: parseInt(todayR.rows[0].c),
      weekChart: weekR.rows,
      recentDeposits: recentR.rows
    });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro.' });
  }
});

// ─── Bets ─────────────────────────────────────────

router.get('/bets', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const status = req.query.status || '';
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 25, 1), 200);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    let where = [];
    let params = [];
    let idx = 1;

    if (q) {
      where.push(`(CAST(b.id AS TEXT) = $${idx} OR CAST(b.user_id AS TEXT) = $${idx})`);
      params.push(q);
      idx++;
    }
    const allowedStatuses = ['pending', 'won', 'lost', 'canceled'];
    if (status && allowedStatuses.includes(status)) {
      where.push(`b.status = $${idx}`);
      params.push(status);
      idx++;
    }

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const countR = await query(`SELECT COUNT(*) AS c FROM bets b ${whereSql}`, params);
    const total = parseInt(countR.rows[0].c);

    const rowsR = await query(`
      SELECT b.id, b.user_id, u.username, b.game_id, g.game_name, b.amount_cents, b.payout_cents, b.multiplier, b.status, b.created_at
      FROM bets b
      LEFT JOIN users u ON u.id = b.user_id
      LEFT JOIN games g ON g.id = b.game_id
      ${whereSql}
      ORDER BY b.id DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, limit, offset]);

    res.json({ ok: true, page, limit, total, rows: rowsR.rows });
  } catch (err) {
    console.error('[ADMIN API BETS]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao listar apostas.' });
  }
});

// ─── Affiliates ───────────────────────────────────

router.get('/affiliates', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 25, 1), 200);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    let where = [];
    let params = [];
    let idx = 1;

    if (q) {
      where.push(`(a.code ILIKE $${idx} OR u.username ILIKE $${idx})`);
      params.push(`%${q}%`);
      idx++;
    }

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const countR = await query(`SELECT COUNT(*) AS c FROM affiliates a LEFT JOIN users u ON u.id = a.user_id ${whereSql}`, params);
    const total = parseInt(countR.rows[0].c);

    const rowsR = await query(`
      SELECT a.id, a.user_id, u.username, a.code, a.commission_pct, a.total_earned_cents, a.is_active, a.created_at
      FROM affiliates a
      LEFT JOIN users u ON u.id = a.user_id
      ${whereSql}
      ORDER BY a.id DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, limit, offset]);

    res.json({ ok: true, page, limit, total, rows: rowsR.rows });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao listar afiliados.' });
  }
});

router.post('/affiliates/:id/toggle', async (req, res) => {
  try {
    await query('UPDATE affiliates SET is_active = NOT is_active WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro.' });
  }
});

// ─── Support Tickets ──────────────────────────────

router.get('/support', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const status = req.query.status || '';
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 25, 1), 200);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    let where = [];
    let params = [];
    let idx = 1;

    if (q) {
      where.push(`(st.subject ILIKE $${idx} OR CAST(st.id AS TEXT) = $${idx + 1})`);
      params.push(`%${q}%`, q);
      idx += 2;
    }
    const allowedStatuses = ['open', 'in_progress', 'closed'];
    if (status && allowedStatuses.includes(status)) {
      where.push(`st.status = $${idx}`);
      params.push(status);
      idx++;
    }

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const countR = await query(`SELECT COUNT(*) AS c FROM support_tickets st ${whereSql}`, params);
    const total = parseInt(countR.rows[0].c);

    const rowsR = await query(`
      SELECT st.id, st.user_id, u.username, st.subject, st.status, st.priority, st.created_at, st.updated_at
      FROM support_tickets st
      LEFT JOIN users u ON u.id = st.user_id
      ${whereSql}
      ORDER BY st.id DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, limit, offset]);

    res.json({ ok: true, page, limit, total, rows: rowsR.rows });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao listar tickets.' });
  }
});

router.get('/support/:id/messages', async (req, res) => {
  try {
    const r = await query(
      'SELECT sm.*, CASE WHEN sm.sender_type = \'admin\' THEN au.username ELSE u.username END AS sender_name FROM support_messages sm LEFT JOIN users u ON sm.sender_type = \'user\' AND u.id = sm.sender_id LEFT JOIN admin_users au ON sm.sender_type = \'admin\' AND au.id = sm.sender_id WHERE sm.ticket_id = $1 ORDER BY sm.id',
      [req.params.id]
    );
    res.json({ ok: true, messages: r.rows });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro.' });
  }
});

router.post('/support/:id/reply', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ ok: false, msg: 'Mensagem obrigatória.' });
    await query(
      'INSERT INTO support_messages (ticket_id, sender_type, sender_id, message) VALUES ($1, $2, $3, $4)',
      [req.params.id, 'admin', req.session.admin.id, message]
    );
    await query("UPDATE support_tickets SET status = 'in_progress', updated_at = NOW() WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao responder.' });
  }
});

router.post('/support/:id/close', async (req, res) => {
  try {
    await query("UPDATE support_tickets SET status = 'closed', updated_at = NOW() WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro.' });
  }
});

// ─── Promotions ───────────────────────────────────

router.get('/promotions', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 25, 1), 200);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    let where = [];
    let params = [];
    let idx = 1;

    if (q) {
      where.push(`(p.title ILIKE $${idx} OR p.code ILIKE $${idx})`);
      params.push(`%${q}%`);
      idx++;
    }

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const countR = await query(`SELECT COUNT(*) AS c FROM promotions p ${whereSql}`, params);
    const total = parseInt(countR.rows[0].c);

    const rowsR = await query(`
      SELECT p.*, (SELECT COUNT(*) FROM user_promotions up WHERE up.promotion_id = p.id) AS claimed_count
      FROM promotions p
      ${whereSql}
      ORDER BY p.id DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, limit, offset]);

    res.json({ ok: true, page, limit, total, rows: rowsR.rows });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao listar promoções.' });
  }
});

router.post('/promotions', async (req, res) => {
  try {
    const { title, description, type, value_cents, value_pct, min_deposit, max_uses, code, starts_at, expires_at } = req.body;
    if (!title) return res.status(400).json({ ok: false, msg: 'Título obrigatório.' });
    const r = await query(
      `INSERT INTO promotions (title, description, type, value_cents, value_pct, min_deposit, max_uses, code, starts_at, expires_at) 
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [title, description || '', type || 'bonus', parseInt(value_cents) || 0, parseFloat(value_pct) || 0, parseInt(min_deposit) || 0, parseInt(max_uses) || 0, code || null, starts_at || null, expires_at || null]
    );
    res.json({ ok: true, promotion: r.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, msg: 'Código já existe.' });
    res.status(500).json({ ok: false, msg: 'Erro ao criar promoção.' });
  }
});

router.post('/promotions/:id/toggle', async (req, res) => {
  try {
    await query('UPDATE promotions SET is_active = NOT is_active WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro.' });
  }
});

router.delete('/promotions/:id', async (req, res) => {
  try {
    await query('DELETE FROM promotions WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao excluir.' });
  }
});

// ─── Audit Log ────────────────────────────────────

router.get('/audit', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 25, 1), 200);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    let where = [];
    let params = [];
    let idx = 1;

    if (q) {
      where.push(`(al.action ILIKE $${idx} OR al.target_type ILIKE $${idx})`);
      params.push(`%${q}%`);
      idx++;
    }

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const countR = await query(`SELECT COUNT(*) AS c FROM admin_audit_log al ${whereSql}`, params);
    const total = parseInt(countR.rows[0].c);

    const rowsR = await query(`
      SELECT al.id, al.admin_id, au.username AS admin_name, al.action, al.target_type, al.target_id, al.ip_address, al.created_at
      FROM admin_audit_log al
      LEFT JOIN admin_users au ON au.id = al.admin_id
      ${whereSql}
      ORDER BY al.id DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, limit, offset]);

    res.json({ ok: true, page, limit, total, rows: rowsR.rows });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao listar logs.' });
  }
});

// ─── Withdrawals ──────────────────────────────────

router.get('/withdrawals', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const status = req.query.status || '';
    const from = req.query.from || '';
    const to = req.query.to || '';
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 25, 1), 200);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    let where = [];
    let params = [];
    let idx = 1;

    if (q) {
      where.push(`(CAST(w.id AS TEXT) = $${idx} OR CAST(w.user_id AS TEXT) = $${idx})`);
      params.push(q);
      idx++;
    }
    const allowedStatuses = ['pending', 'approved', 'rejected', 'paid'];
    if (status && allowedStatuses.includes(status)) {
      where.push(`w.status = $${idx}`);
      params.push(status);
      idx++;
    }
    if (from) { where.push(`w.created_at >= $${idx}`); params.push(from + ' 00:00:00'); idx++; }
    if (to) { where.push(`w.created_at <= $${idx}`); params.push(to + ' 23:59:59'); idx++; }

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const countR = await query(`SELECT COUNT(*) AS c FROM withdrawals w ${whereSql}`, params);
    const total = parseInt(countR.rows[0].c);

    const rowsR = await query(`
      SELECT w.id, w.user_id, u.username, w.amount_cents, w.pix_type, w.pix_key, w.status, w.admin_note, w.created_at, w.updated_at
      FROM withdrawals w
      LEFT JOIN users u ON u.id = w.user_id
      ${whereSql}
      ORDER BY w.id DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, limit, offset]);

    res.json({ ok: true, page, limit, total, rows: rowsR.rows });
  } catch (err) {
    console.error('[ADMIN API WITHDRAWALS]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao listar saques.' });
  }
});

router.post('/withdrawals/:id/approve', async (req, res) => {
  try {
    const { admin_note } = req.body;
    await query(
      "UPDATE withdrawals SET status = 'approved', admin_note = $2, updated_at = NOW() WHERE id = $1 AND status = 'pending'",
      [req.params.id, admin_note || null]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao aprovar.' });
  }
});

router.post('/withdrawals/:id/reject', async (req, res) => {
  try {
    const { admin_note } = req.body;
    const wd = await query('SELECT user_id, amount_cents FROM withdrawals WHERE id = $1', [req.params.id]);
    if (!wd.rows[0]) return res.status(404).json({ ok: false, msg: 'Saque não encontrado.' });

    await query(
      "UPDATE withdrawals SET status = 'rejected', admin_note = $2, updated_at = NOW() WHERE id = $1 AND status = 'pending'",
      [req.params.id, admin_note || 'Rejeitado pelo admin']
    );
    // Refund wallet
    await query('UPDATE wallets SET balance_cents = balance_cents + $2 WHERE user_id = $1', [wd.rows[0].user_id, wd.rows[0].amount_cents]);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao rejeitar.' });
  }
});

// ─── Financial Reports ────────────────────────────

router.get('/reports', async (req, res) => {
  try {
    const from = req.query.from || new Date(Date.now() - 30*86400000).toISOString().slice(0,10);
    const to = req.query.to || new Date().toISOString().slice(0,10);
    const fromTs = from + ' 00:00:00';
    const toTs = to + ' 23:59:59';

    const [depR, wdR, betR, winR, usersR, newR] = await Promise.all([
      query("SELECT COUNT(*) AS c, COALESCE(SUM(amount_cents),0) AS total FROM transactions WHERE type='deposit' AND status='paid' AND created_at BETWEEN $1 AND $2", [fromTs, toTs]),
      query("SELECT COUNT(*) AS c, COALESCE(SUM(amount_cents),0) AS total FROM withdrawals WHERE status IN ('approved','paid') AND created_at BETWEEN $1 AND $2", [fromTs, toTs]),
      query("SELECT COALESCE(SUM(amount_cents),0) AS total FROM bets WHERE created_at BETWEEN $1 AND $2", [fromTs, toTs]),
      query("SELECT COALESCE(SUM(payout_cents),0) AS total FROM bets WHERE status='won' AND created_at BETWEEN $1 AND $2", [fromTs, toTs]),
      query("SELECT COUNT(DISTINCT user_id) AS c FROM transactions WHERE created_at BETWEEN $1 AND $2", [fromTs, toTs]),
      query("SELECT COUNT(*) AS c FROM users WHERE created_at BETWEEN $1 AND $2", [fromTs, toTs])
    ]);

    // Daily breakdown
    const dailyR = await query(`
      SELECT d.d,
        COALESCE((SELECT SUM(amount_cents) FROM transactions WHERE type='deposit' AND status='paid' AND DATE(created_at)=d.d), 0) AS dep,
        COALESCE((SELECT SUM(amount_cents) FROM withdrawals WHERE status IN ('approved','paid') AND DATE(created_at)=d.d), 0) AS wd,
        COALESCE((SELECT SUM(amount_cents) FROM bets WHERE DATE(created_at)=d.d), 0) AS bet,
        COALESCE((SELECT SUM(payout_cents) FROM bets WHERE status='won' AND DATE(created_at)=d.d), 0) AS win
      FROM generate_series($1::date, $2::date, '1 day'::interval) AS d(d)
      ORDER BY d.d
    `, [from, to]);

    const deposits_total = parseInt(depR.rows[0].total);
    const withdrawals_total = parseInt(wdR.rows[0].total);
    const bets_total = parseInt(betR.rows[0].total);
    const wins_total = parseInt(winR.rows[0].total);

    res.json({
      ok: true,
      deposits_total, deposits_count: parseInt(depR.rows[0].c),
      withdrawals_total, withdrawals_count: parseInt(wdR.rows[0].c),
      bets_total, wins_total,
      ggr: bets_total - wins_total,
      active_users: parseInt(usersR.rows[0].c),
      new_users: parseInt(newR.rows[0].c),
      daily: dailyR.rows
    });
  } catch (err) {
    console.error('[ADMIN API REPORTS]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao gerar relatório.' });
  }
});

router.get('/reports/csv', async (req, res) => {
  try {
    const from = req.query.from || new Date(Date.now() - 30*86400000).toISOString().slice(0,10);
    const to = req.query.to || new Date().toISOString().slice(0,10);

    const dailyR = await query(`
      SELECT d.d,
        COALESCE((SELECT SUM(amount_cents) FROM transactions WHERE type='deposit' AND status='paid' AND DATE(created_at)=d.d), 0) AS dep,
        COALESCE((SELECT SUM(amount_cents) FROM withdrawals WHERE status IN ('approved','paid') AND DATE(created_at)=d.d), 0) AS wd,
        COALESCE((SELECT SUM(amount_cents) FROM bets WHERE DATE(created_at)=d.d), 0) AS bet,
        COALESCE((SELECT SUM(payout_cents) FROM bets WHERE status='won' AND DATE(created_at)=d.d), 0) AS win
      FROM generate_series($1::date, $2::date, '1 day'::interval) AS d(d)
      ORDER BY d.d
    `, [from, to]);

    let csv = 'Data,Depósitos (R$),Saques (R$),Apostado (R$),Pago (R$),GGR (R$)\n';
    dailyR.rows.forEach(r => {
      const d = new Date(r.d).toLocaleDateString('pt-BR');
      csv += `${d},${(parseInt(r.dep)/100).toFixed(2)},${(parseInt(r.wd)/100).toFixed(2)},${(parseInt(r.bet)/100).toFixed(2)},${(parseInt(r.win)/100).toFixed(2)},${((parseInt(r.bet)-parseInt(r.win))/100).toFixed(2)}\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=relatorio_${from}_${to}.csv`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao exportar.' });
  }
});

// ─── Notifications ────────────────────────────────

router.get('/notifications', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const tipo = req.query.tipo || '';
    const target = req.query.target || '';
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 25, 1), 200);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    let where = [];
    let params = [];
    let idx = 1;

    if (q) {
      where.push(`(n.titulo ILIKE $${idx} OR n.mensagem ILIKE $${idx})`);
      params.push(`%${q}%`);
      idx++;
    }
    if (tipo) {
      where.push(`n.tipo = $${idx}`);
      params.push(tipo);
      idx++;
    }
    if (target === 'global') {
      where.push('n.user_id = 0');
    } else if (target === 'individual') {
      where.push('n.user_id > 0');
    }

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const countR = await query(`SELECT COUNT(*) AS c FROM notifications n ${whereSql}`, params);
    const total = parseInt(countR.rows[0].c);

    const rowsR = await query(`
      SELECT n.id, n.user_id, n.tipo, n.titulo, n.mensagem, n.link, n.lida, n.created_at,
             CASE WHEN n.user_id > 0 THEN u.username ELSE NULL END AS username
      FROM notifications n
      LEFT JOIN users u ON n.user_id > 0 AND u.id = n.user_id
      ${whereSql}
      ORDER BY n.id DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, limit, offset]);

    res.json({ ok: true, page, limit, total, rows: rowsR.rows });
  } catch (err) {
    console.error('[ADMIN API NOTIFICATIONS]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao listar notificações.' });
  }
});

router.post('/notifications', async (req, res) => {
  try {
    const { titulo, mensagem, tipo, user_id, link } = req.body;
    if (!titulo) return res.status(400).json({ ok: false, msg: 'Título obrigatório.' });

    const r = await query(
      'INSERT INTO notifications (user_id, tipo, titulo, mensagem, link) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [parseInt(user_id) || 0, tipo || 'info', titulo, mensagem || '', link || '']
    );
    res.json({ ok: true, notification: r.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao criar notificação.' });
  }
});

router.delete('/notifications/:id', async (req, res) => {
  try {
    await query('DELETE FROM notifications WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao excluir.' });
  }
});

// ─── User Limits (Responsible Gaming) ─────────────

router.get('/limits', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const limit_type = req.query.limit_type || '';
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 25, 1), 200);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    let where = [];
    let params = [];
    let idx = 1;

    if (q) {
      where.push(`CAST(ul.user_id AS TEXT) = $${idx}`);
      params.push(q);
      idx++;
    }
    if (limit_type) {
      where.push(`ul.limit_type = $${idx}`);
      params.push(limit_type);
      idx++;
    }

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const countR = await query(`SELECT COUNT(*) AS c FROM user_limits ul ${whereSql}`, params);
    const total = parseInt(countR.rows[0].c);

    const rowsR = await query(`
      SELECT ul.id, ul.user_id, u.username, ul.limit_type, ul.period, ul.limit_value, ul.is_active, ul.enforced_by, ul.admin_notes, ul.created_at
      FROM user_limits ul
      LEFT JOIN users u ON u.id = ul.user_id
      ${whereSql}
      ORDER BY ul.id DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, limit, offset]);

    res.json({ ok: true, page, limit, total, rows: rowsR.rows });
  } catch (err) {
    console.error('[ADMIN API LIMITS]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao listar limites.' });
  }
});

router.post('/limits', async (req, res) => {
  try {
    const { user_id, limit_type, period, limit_value, admin_notes } = req.body;
    if (!user_id || !limit_type) return res.status(400).json({ ok: false, msg: 'User ID e tipo obrigatórios.' });

    const r = await query(
      `INSERT INTO user_limits (user_id, limit_type, period, limit_value, enforced_by, admin_notes)
       VALUES ($1, $2, $3, $4, 'admin', $5)
       ON CONFLICT (user_id, limit_type, period) DO UPDATE SET limit_value = $4, enforced_by = 'admin', admin_notes = $5, is_active = TRUE, updated_at = NOW()
       RETURNING *`,
      [parseInt(user_id), limit_type, period || 'daily', parseInt(limit_value) || 0, admin_notes || null]
    );
    res.json({ ok: true, limit: r.rows[0] });
  } catch (err) {
    console.error('[ADMIN API LIMITS CREATE]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao criar limite.' });
  }
});

router.post('/limits/:id/toggle', async (req, res) => {
  try {
    await query('UPDATE user_limits SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro.' });
  }
});

router.delete('/limits/:id', async (req, res) => {
  try {
    await query('DELETE FROM user_limits WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao excluir.' });
  }
});

// ─── Leagues & Sports ─────────────────────────────

router.get('/leagues', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 25, 1), 200);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    let where = [];
    let params = [];
    let idx = 1;

    if (q) {
      where.push(`(item.name ILIKE $${idx} OR item.slug ILIKE $${idx})`);
      params.push(`%${q}%`);
      idx++;
    }

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

    // Combine sports + leagues into one list
    const countR = await query(`
      SELECT (SELECT COUNT(*) FROM sports_categories sc ${whereSql.replace(/item\./g,'sc.')}) +
             (SELECT COUNT(*) FROM leagues l ${whereSql.replace(/item\./g,'l.')}) AS c
    `, params.length ? [...params, ...params] : []);
    const total = parseInt(countR.rows[0].c);

    const rowsR = await query(`
      (SELECT sc.id, 'sport' AS item_type, sc.name, sc.slug, NULL AS country, NULL AS sport_name, sc.sort_order, sc.is_active, sc.created_at
       FROM sports_categories sc ${whereSql.replace(/item\./g,'sc.')}
      )
      UNION ALL
      (SELECT l.id, 'league' AS item_type, l.name, l.slug, l.country, sc.name AS sport_name, l.sort_order, l.is_active, l.created_at
       FROM leagues l
       LEFT JOIN sports_categories sc ON sc.id = l.sport_id
       ${whereSql.replace(/item\./g,'l.')}
      )
      ORDER BY item_type, sort_order, name
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, ...params, limit, offset]);

    res.json({ ok: true, page, limit, total, rows: rowsR.rows });
  } catch (err) {
    console.error('[ADMIN API LEAGUES]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao listar.' });
  }
});

router.post('/sports', async (req, res) => {
  try {
    const { name, slug, icon_url, sort_order } = req.body;
    if (!name || !slug) return res.status(400).json({ ok: false, msg: 'Nome e slug obrigatórios.' });
    const r = await query(
      'INSERT INTO sports_categories (name, slug, icon_url, sort_order) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, slug, icon_url || null, parseInt(sort_order) || 0]
    );
    res.json({ ok: true, sport: r.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, msg: 'Slug já existe.' });
    res.status(500).json({ ok: false, msg: 'Erro ao criar esporte.' });
  }
});

router.post('/leagues', async (req, res) => {
  try {
    const { sport_id, name, slug, country, icon_url, sort_order } = req.body;
    if (!name || !slug) return res.status(400).json({ ok: false, msg: 'Nome e slug obrigatórios.' });
    const r = await query(
      'INSERT INTO leagues (sport_id, name, slug, country, icon_url, sort_order) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [parseInt(sport_id) || null, name, slug, country || null, icon_url || null, parseInt(sort_order) || 0]
    );
    res.json({ ok: true, league: r.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, msg: 'Slug já existe.' });
    res.status(500).json({ ok: false, msg: 'Erro ao criar liga.' });
  }
});

router.post('/leagues/:id/toggle', async (req, res) => {
  try {
    const { item_type } = req.body;
    if (item_type === 'sport') {
      await query('UPDATE sports_categories SET is_active = NOT is_active WHERE id = $1', [req.params.id]);
    } else {
      await query('UPDATE leagues SET is_active = NOT is_active WHERE id = $1', [req.params.id]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro.' });
  }
});

router.delete('/leagues/:id', async (req, res) => {
  try {
    const { item_type } = req.body;
    if (item_type === 'sport') {
      await query('DELETE FROM sports_categories WHERE id = $1', [req.params.id]);
    } else {
      await query('DELETE FROM leagues WHERE id = $1', [req.params.id]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao excluir.' });
  }
});

// ─── Coupons ──────────────────────────────────────

router.get('/coupons', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const active = req.query.active || '';
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 25, 1), 200);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    let where = [];
    let params = [];
    let idx = 1;

    if (q) {
      where.push(`(c.code ILIKE $${idx} OR c.description ILIKE $${idx})`);
      params.push(`%${q}%`);
      idx++;
    }
    if (active === '1' || active === '0') {
      where.push(`c.is_active = $${idx}`);
      params.push(active === '1');
      idx++;
    }

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const countR = await query(`SELECT COUNT(*) AS c FROM coupons c ${whereSql}`, params);
    const total = parseInt(countR.rows[0].c);

    const rowsR = await query(`
      SELECT c.*
      FROM coupons c
      ${whereSql}
      ORDER BY c.id DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, limit, offset]);

    res.json({ ok: true, page, limit, total, rows: rowsR.rows });
  } catch (err) {
    console.error('[ADMIN API COUPONS]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao listar cupons.' });
  }
});

router.post('/coupons', async (req, res) => {
  try {
    const { code, description, type, value_cents, value_pct, min_deposit, max_uses, max_per_user, starts_at, expires_at } = req.body;
    if (!code) return res.status(400).json({ ok: false, msg: 'Código obrigatório.' });

    const r = await query(
      `INSERT INTO coupons (code, description, type, value_cents, value_pct, min_deposit, max_uses, max_per_user, starts_at, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [code.toUpperCase(), description || '', type || 'bonus', parseInt(value_cents) || 0, parseFloat(value_pct) || 0, parseInt(min_deposit) || 0, parseInt(max_uses) || 0, parseInt(max_per_user) || 1, starts_at || null, expires_at || null]
    );
    res.json({ ok: true, coupon: r.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, msg: 'Código já existe.' });
    res.status(500).json({ ok: false, msg: 'Erro ao criar cupom.' });
  }
});

router.post('/coupons/:id/toggle', async (req, res) => {
  try {
    await query('UPDATE coupons SET is_active = NOT is_active WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro.' });
  }
});

router.delete('/coupons/:id', async (req, res) => {
  try {
    await query('DELETE FROM coupons WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao excluir.' });
  }
});

// ─── Enhanced User Actions (KYC + Balance) ────────

router.post('/users/:id/kyc', async (req, res) => {
  try {
    const { kyc_status, kyc_notes } = req.body;
    const allowed = ['pending', 'verified', 'rejected'];
    if (!allowed.includes(kyc_status)) return res.status(400).json({ ok: false, msg: 'Status inválido.' });

    await query('UPDATE users SET kyc_status = $2, kyc_notes = $3, updated_at = NOW() WHERE id = $1', [req.params.id, kyc_status, kyc_notes || null]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao atualizar KYC.' });
  }
});

router.post('/users/:id/balance', async (req, res) => {
  try {
    const { amount_cents, reason } = req.body;
    const amt = parseInt(amount_cents);
    if (!amt) return res.status(400).json({ ok: false, msg: 'Valor obrigatório.' });

    await query('UPDATE wallets SET balance_cents = balance_cents + $2 WHERE user_id = $1', [req.params.id, amt]);

    // Log in audit
    await query(
      'INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.session.admin.id, 'balance_adjust', 'user', parseInt(req.params.id), JSON.stringify({ amount_cents: amt, reason: reason || '' }), req.ip]
    );

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao ajustar saldo.' });
  }
});

router.post('/users/:id/block', async (req, res) => {
  try {
    const { block_reason } = req.body;
    await query('UPDATE users SET is_active = FALSE, block_reason = $2, updated_at = NOW() WHERE id = $1', [req.params.id, block_reason || 'Bloqueado pelo admin']);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao bloquear.' });
  }
});

// ─── Enhanced Dashboard Stats ─────────────────────

router.get('/stats/enhanced', async (req, res) => {
  try {
    const [usersR, depR, wdR, revenueR, todayR, gamesR, betR, winR, weekR, pendingWdR] = await Promise.all([
      query('SELECT COUNT(*) AS c FROM users'),
      query("SELECT COUNT(*) AS c FROM transactions WHERE type='deposit' AND status='paid'"),
      query("SELECT COUNT(*) AS c, COALESCE(SUM(amount_cents),0) AS total FROM withdrawals WHERE status IN ('approved','paid')"),
      query("SELECT COALESCE(SUM(amount_cents),0) AS total FROM transactions WHERE type='deposit' AND status='paid'"),
      query("SELECT COUNT(*) AS c FROM users WHERE created_at >= CURRENT_DATE"),
      query('SELECT COUNT(*) AS c FROM games WHERE is_active = TRUE'),
      query("SELECT COALESCE(SUM(amount_cents),0) AS total FROM bets"),
      query("SELECT COALESCE(SUM(payout_cents),0) AS total FROM bets WHERE status='won'"),
      query(`SELECT DATE(created_at) AS d, COUNT(*) AS c FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '7 days' GROUP BY DATE(created_at) ORDER BY d`),
      query("SELECT COUNT(*) AS c, COALESCE(SUM(amount_cents),0) AS total FROM withdrawals WHERE status='pending'")
    ]);

    // Additional premium data
    const [todayDepR, todayRevR, revenueChartR, topDepositorsR, topGamesR, recentActivityR, convR] = await Promise.all([
      query("SELECT COUNT(*) AS c FROM transactions WHERE type='deposit' AND status='paid' AND created_at >= CURRENT_DATE"),
      query("SELECT COALESCE(SUM(amount_cents),0) AS total FROM transactions WHERE type='deposit' AND status='paid' AND created_at >= CURRENT_DATE"),
      query(`SELECT DATE(created_at) AS d,
        COALESCE(SUM(CASE WHEN type='deposit' AND status='paid' THEN amount_cents END),0) AS deposits,
        COALESCE(SUM(CASE WHEN type='withdrawal' THEN amount_cents END),0) AS withdrawals
        FROM transactions WHERE created_at >= CURRENT_DATE - INTERVAL '14 days'
        GROUP BY DATE(created_at) ORDER BY d`),
      query(`SELECT u.id, u.username, COALESCE(SUM(t.amount_cents),0) AS total_deposited, COUNT(t.id) AS dep_count
        FROM users u JOIN transactions t ON t.user_id = u.id AND t.type='deposit' AND t.status='paid'
        GROUP BY u.id, u.username ORDER BY total_deposited DESC LIMIT 5`),
      query(`SELECT g.game_name, g.provider, COUNT(b.id) AS bet_count, COALESCE(SUM(b.amount_cents),0) AS total_bet
        FROM games g JOIN bets b ON b.game_id = g.id
        GROUP BY g.id, g.game_name, g.provider ORDER BY bet_count DESC LIMIT 5`),
      query(`(SELECT 'deposit' AS type, t.user_id, u.username, t.amount_cents, t.status, t.created_at
        FROM transactions t LEFT JOIN users u ON u.id = t.user_id
        WHERE t.type='deposit' ORDER BY t.created_at DESC LIMIT 5)
        UNION ALL
        (SELECT 'withdrawal' AS type, w.user_id, u.username, w.amount_cents, w.status, w.created_at
        FROM withdrawals w LEFT JOIN users u ON u.id = w.user_id
        ORDER BY w.created_at DESC LIMIT 5)
        UNION ALL
        (SELECT 'register' AS type, u.id AS user_id, u.username, 0 AS amount_cents, 'ok' AS status, u.created_at
        FROM users u ORDER BY u.created_at DESC LIMIT 5)
        ORDER BY created_at DESC LIMIT 15`),
      query("SELECT COUNT(DISTINCT user_id) AS c FROM transactions WHERE type='deposit' AND status='paid'")
    ]);

    const recentR = await query(`
      SELECT t.id, t.user_id, u.username, t.amount_cents, t.status, t.created_at
      FROM transactions t LEFT JOIN users u ON u.id = t.user_id
      WHERE t.type = 'deposit'
      ORDER BY t.id DESC LIMIT 7
    `);

    const totalBets = parseInt(betR.rows[0].total);
    const totalWins = parseInt(winR.rows[0].total);
    const totalUsersN = parseInt(usersR.rows[0].c);
    const depositingUsers = parseInt(convR.rows[0].c);

    res.json({
      ok: true,
      totalUsers: totalUsersN,
      totalDeposits: parseInt(depR.rows[0].c),
      totalRevenue: parseInt(revenueR.rows[0].total),
      todayUsers: parseInt(todayR.rows[0].c),
      totalGames: parseInt(gamesR.rows[0].c),
      totalWithdrawals: parseInt(wdR.rows[0].c),
      totalWithdrawalsAmount: parseInt(wdR.rows[0].total),
      pendingWithdrawals: parseInt(pendingWdR.rows[0].c),
      pendingWithdrawalsAmount: parseInt(pendingWdR.rows[0].total),
      ggr: totalBets - totalWins,
      weekChart: weekR.rows,
      recentDeposits: recentR.rows,
      // Premium data
      todayDeposits: parseInt(todayDepR.rows[0].c),
      todayRevenue: parseInt(todayRevR.rows[0].total),
      revenueChart: revenueChartR.rows,
      topDepositors: topDepositorsR.rows,
      topGames: topGamesR.rows,
      recentActivity: recentActivityR.rows,
      conversionRate: totalUsersN > 0 ? ((depositingUsers / totalUsersN) * 100).toFixed(1) : '0.0',
      totalBets: totalBets,
      totalPayouts: totalWins
    });
  } catch (err) {
    console.error('[ADMIN API STATS ENHANCED]', err);
    res.status(500).json({ ok: false, msg: 'Erro.' });
  }
});

// ─── Top 10 Featured Games ────────────────────────

router.get('/top10', async (req, res) => {
  try {
    const featured = await query(`
      SELECT g.id, g.game_code, g.game_name, g.image_url, g.provider, g.category, g.is_featured, g.featured_order
      FROM games g WHERE g.is_featured = TRUE AND g.is_active = TRUE
      ORDER BY g.featured_order, g.id
    `);
    res.json({ ok: true, rows: featured.rows });
  } catch (err) {
    console.error('[ADMIN API TOP10]', err);
    res.status(500).json({ ok: false, msg: 'Erro.' });
  }
});

router.get('/top10/available', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    let sql = 'SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE AND is_featured = FALSE';
    const params = [];
    if (q) {
      sql += ' AND (game_code ILIKE $1 OR game_name ILIKE $1 OR provider ILIKE $1)';
      params.push('%' + q + '%');
    }
    sql += ' ORDER BY game_name LIMIT 50';
    const r = await query(sql, params);
    res.json({ ok: true, rows: r.rows });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro.' });
  }
});

router.post('/top10/add', async (req, res) => {
  try {
    const { game_id } = req.body;
    if (!game_id) return res.status(400).json({ ok: false, msg: 'game_id obrigatório.' });
    const maxR = await query('SELECT COALESCE(MAX(featured_order), 0) + 1 AS next FROM games WHERE is_featured = TRUE');
    const next = maxR.rows[0].next;
    await query('UPDATE games SET is_featured = TRUE, featured_order = $1 WHERE id = $2', [next, game_id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao adicionar.' });
  }
});

router.post('/top10/remove', async (req, res) => {
  try {
    const { game_id } = req.body;
    if (!game_id) return res.status(400).json({ ok: false, msg: 'game_id obrigatório.' });
    await query('UPDATE games SET is_featured = FALSE, featured_order = 0 WHERE id = $1', [game_id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao remover.' });
  }
});

router.post('/top10/reorder', async (req, res) => {
  try {
    const { order } = req.body; // array of game ids in order
    if (!Array.isArray(order)) return res.status(400).json({ ok: false, msg: 'Ordem inválida.' });
    for (let i = 0; i < order.length; i++) {
      await query('UPDATE games SET featured_order = $1 WHERE id = $2 AND is_featured = TRUE', [i + 1, order[i]]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao reordenar.' });
  }
});

module.exports = router;
