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

module.exports = router;
